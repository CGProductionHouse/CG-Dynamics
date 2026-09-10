import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, ctx, catalog
before(async () => {
  server = await createServer({
    root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  ctx = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/projectContext.ts')
  catalog = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/toolCatalog.ts')
})
after(async () => { await server?.close() })

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const INDEX = read('../supabase/functions/cg-dynamics-mcp/index.ts')
const MIGRATION = read('../supabase/migrations/20260909190000_mcp_dual_principal_audit.sql')

// Exact canonical ids standing in for the real Dynamics records.
const FRANCO = '11111111-1111-4111-8111-111111111111'
const SYDNEY = '22222222-2222-4222-8222-222222222222'
const PSG = '33333333-3333-4333-8333-333333333333'
const RED_OAK = '44444444-4444-4444-8444-444444444444'
const ADMIN_USER = '55555555-5555-4555-8555-555555555555'
const ADMIN_PROFILE = '66666666-6666-4666-8666-666666666666'

const connection = { userId: ADMIN_USER, profileId: ADMIN_PROFILE, role: 'admin' }

// ── Context parsing: explicit, exact, fail-closed ────────────────────────────

test('missing context fails closed — admin OAuth never implies a Project', () => {
  for (const bad of [undefined, null, {}, 'staff', []]) {
    assert.equal(ctx.parseProjectContext(bad).ok, false, `must reject ${JSON.stringify(bad)}`)
  }
  assert.match(ctx.parseProjectContext(undefined).error, /Project context is required/)
})

test('staff context requires an exact canonical staff_profile_id, never a name', () => {
  const ok = ctx.parseProjectContext({ context_kind: 'staff', staff_profile_id: FRANCO })
  assert.equal(ok.ok, true)
  assert.equal(ok.context.contextKind, 'staff')
  assert.equal(ok.context.staffProfileId, FRANCO)
  assert.equal(ok.context.clientId, null)

  assert.equal(ctx.parseProjectContext({ context_kind: 'staff' }).ok, false)
  assert.equal(ctx.parseProjectContext({ context_kind: 'staff', staff_profile_id: 'Franco' }).ok, false)
  assert.equal(ctx.parseProjectContext({ context_kind: 'staff', staff_profile_id: FRANCO, client_id: PSG }).ok, false,
    'staff context must not smuggle a client')
})

test('client context requires an exact canonical client_id, never a fuzzy name', () => {
  const ok = ctx.parseProjectContext({ context_kind: 'client', client_id: PSG })
  assert.equal(ok.ok, true)
  assert.equal(ok.context.clientId, PSG)
  assert.equal(ok.context.staffProfileId, null)

  assert.equal(ctx.parseProjectContext({ context_kind: 'client', client_id: 'PSG' }).ok, false)
  assert.equal(ctx.parseProjectContext({ context_kind: 'client', client_id: PSG, staff_profile_id: FRANCO }).ok, false)
})

test('company_admin must be explicit and carries no staff or client id', () => {
  assert.equal(ctx.parseProjectContext({ context_kind: 'company_admin' }).ok, true)
  assert.equal(ctx.parseProjectContext({ context_kind: 'company_admin', staff_profile_id: FRANCO }).ok, false)
  assert.equal(ctx.parseProjectContext({ context_kind: 'company_admin', client_id: PSG }).ok, false)
  assert.equal(ctx.parseProjectContext({ context_kind: 'owner' }).ok, false)
})

// ── Franco vs Sydney: per-staff Projects on one shared connection ────────────

test('Franco and Sydney Projects resolve to different effective subjects', () => {
  const franco = ctx.parseProjectContext({ context_kind: 'staff', staff_profile_id: FRANCO })
  const sydney = ctx.parseProjectContext({ context_kind: 'staff', staff_profile_id: SYDNEY })
  assert.notEqual(franco.context.staffProfileId, sydney.context.staffProfileId)

  const francoAudit = ctx.buildAuditEnvelope(connection, franco.context)
  const sydneyAudit = ctx.buildAuditEnvelope(connection, sydney.context)

  // Effective subject differs per Project...
  assert.equal(francoAudit.effective_staff_profile_id, FRANCO)
  assert.equal(sydneyAudit.effective_staff_profile_id, SYDNEY)
  // ...while the communal connection principal is identical and separately recorded.
  assert.equal(francoAudit.connection_principal_user_id, ADMIN_USER)
  assert.equal(sydneyAudit.connection_principal_user_id, ADMIN_USER)
  assert.notEqual(francoAudit.effective_staff_profile_id, francoAudit.connection_principal_profile_id,
    'the admin OAuth principal must not become the staff subject')
})

test('audit envelope always carries both principals', () => {
  const client = ctx.parseProjectContext({ context_kind: 'client', client_id: PSG })
  const audit = ctx.buildAuditEnvelope(connection, client.context)
  assert.deepEqual(audit, {
    connection_principal_user_id: ADMIN_USER,
    connection_principal_profile_id: ADMIN_PROFILE,
    connection_principal_role: 'admin',
    effective_context_kind: 'client',
    effective_staff_profile_id: null,
    effective_client_id: PSG,
  })
})

// ── Exact-client isolation ──────────────────────────────────────────────────

test('a client Project cannot read another client, even under admin OAuth', () => {
  const cross = ctx.resolveClientScopeForInput('client', PSG, { client_id: RED_OAK, task_type: 'caption' })
  assert.equal(cross.ok, false)
  assert.match(cross.error, /Cross-client request refused/)
  assert.match(cross.error, new RegExp(PSG))
})

test('a client Project has its exact client pinned onto client-scoped calls', () => {
  const pinned = ctx.resolveClientScopeForInput('client', PSG, { task_type: 'caption' })
  assert.equal(pinned.ok, true)
  assert.equal(pinned.input.client_id, PSG, 'client_id is injected, not left open')

  const same = ctx.resolveClientScopeForInput('client', PSG, { client_id: PSG })
  assert.equal(same.ok, true)
})

test('staff and company_admin contexts are not client-pinned', () => {
  for (const kind of ['staff', 'company_admin']) {
    const r = ctx.resolveClientScopeForInput(kind, null, { client_id: RED_OAK })
    assert.equal(r.ok, true)
    assert.equal(r.input.client_id, RED_OAK)
  }
})

test('a record belonging to another client fails closed mid-handler', () => {
  const bad = ctx.assertRecordClientMatchesContext('client', PSG, RED_OAK, 'content run')
  assert.equal(bad.allowed, false)
  assert.match(bad.error, /Cross-client request refused/)

  assert.equal(ctx.assertRecordClientMatchesContext('client', PSG, PSG, 'content run').allowed, true)
  assert.equal(ctx.assertRecordClientMatchesContext('client', PSG, null, 'content run').allowed, false, 'missing client fails closed')
  assert.equal(ctx.assertRecordClientMatchesContext('staff', null, RED_OAK, 'content run').allowed, true)
})

// ── Tool policy ─────────────────────────────────────────────────────────────

test('staff-subject tools are refused in a client Project', () => {
  for (const tool of ['get_my_day', 'list_my_tasks', 'list_my_leads', 'get_my_assistant_bootstrap', 'compose_mail_draft']) {
    const r = ctx.assertToolAllowedInContext(tool, 'client')
    assert.equal(r.allowed, false, `${tool} must not run in a client Project`)
    assert.match(r.error, /not available in a client Project/)
    assert.match(r.error, /context_kind="staff"/)
  }
})

test('staff-subject tools run in staff and company_admin contexts', () => {
  for (const kind of ['staff', 'company_admin']) {
    assert.equal(ctx.assertToolAllowedInContext('get_my_day', kind).allowed, true)
    assert.equal(ctx.assertToolAllowedInContext('list_my_leads', kind).allowed, true)
  }
})

test('client-scoped tools are allowed in every context', () => {
  for (const kind of ['staff', 'client', 'company_admin']) {
    for (const tool of ctx.CLIENT_SCOPED_TOOLS) {
      assert.equal(ctx.assertToolAllowedInContext(tool, kind).allowed, true, `${tool}/${kind}`)
    }
  }
})

// ── Catalog contract ────────────────────────────────────────────────────────

test('every operational tool requires the Project context; the bootstrap tool does not', () => {
  const tools = catalog.CG_DYNAMICS_MCP_TOOLS
  const bootstrap = tools.find(t => t.name === 'resolve_project_context')
  assert.ok(bootstrap, 'resolve_project_context must exist')
  assert.ok(!(bootstrap.inputSchema.required ?? []).includes('context'), 'bootstrap must not require context')

  for (const tool of tools.filter(t => t.name !== 'resolve_project_context')) {
    assert.ok(tool.inputSchema.properties.context, `${tool.name} exposes context`)
    assert.ok(tool.inputSchema.required.includes('context'), `${tool.name} requires context`)
  }
  assert.deepEqual(bootstrap.inputSchema.properties.context_kind.enum, ['staff', 'client', 'company_admin'])
})

test('server instructions state the shared-connection rule', () => {
  const s = catalog.CG_DYNAMICS_MCP_SERVER_INSTRUCTIONS
  assert.match(s, /shared by the whole CG Production House ChatGPT account/)
  assert.match(s, /NOT the staff identity/)
  assert.match(s, /resolve_project_context/)
  assert.match(s, /Never reuse another Project's context/)
})

// ── Server wiring ───────────────────────────────────────────────────────────

test('the bearer token resolves only the connection principal, not the staff subject', () => {
  assert.match(INDEX, /interface ConnectionPrincipal/)
  assert.match(INDEX, /connection: ConnectionPrincipal/)
  // Effective subject comes from resolveOperatingContext, not from the token's profile.
  assert.match(INDEX, /async function resolveOperatingContext\(/)
  assert.match(INDEX, /const resolved = await resolveOperatingContext\(supabase, connection, parsed\.context\)/)
})

test('context is resolved per call and never cached server-side', () => {
  // No module-level mutable context store keyed by connection.
  assert.doesNotMatch(INDEX, /(let|const)\s+(currentContext|contextCache|sessionContext)\b/)
  assert.match(INDEX, /const parsed = parseProjectContext\(rawContext\)/)
})

test('staff context resolution requires an active canonical staff profile', () => {
  assert.match(INDEX, /No canonical staff profile matches that exact staff_profile_id/)
  assert.match(INDEX, /not an active CG staff member/)
})

test('company_admin is never inferred from the connected account role', () => {
  assert.match(INDEX, /company_admin context requires the connected account to hold an admin or manager role/)
  assert.match(INDEX, /ADMIN_CONTEXT_ROLES/)
})

test('resolve_project_context uses exact equality with a single-match guard', () => {
  assert.match(INDEX, /\.eq\('full_name', input\.staff_full_name\.trim\(\)\)/)
  assert.match(INDEX, /\.eq\('name', input\.client_name\.trim\(\)\)/)
  assert.doesNotMatch(INDEX, /\.ilike\(|\.like\(/, 'no fuzzy matching anywhere in the connector')
  assert.match(INDEX, /matched more than one active staff profile/)
  assert.match(INDEX, /matched more than one active client/)
})

test('every tool response carries the dual-principal audit envelope', () => {
  assert.match(INDEX, /const audit = buildAuditEnvelope\(connection, parsed\.context\)/)
  assert.match(INDEX, /_context: audit/)
  assert.match(INDEX, /mcp_record_idempotency_with_context/)
})

test('content-run tools enforce client scope before acting', () => {
  assert.match(INDEX, /async function assertRunInClientScope\(/)
  assert.match(INDEX, /const scopeError = await assertRunInClientScope\(staff, input\.content_run_id\)/)
  assert.match(INDEX, /assertRecordClientMatchesContext\(staff\.contextKind, staff\.effectiveClientId/)
})

test('existing MCP safety rules are preserved', () => {
  assert.match(INDEX, /Write tools require an idempotency_key/)
  assert.match(INDEX, /const isWrite = WRITE_TOOLS\.has\(toolName\)/)
  assert.match(INDEX, /checkIdempotency\(staff\.supabase, staff\.profileId/)
  // OAuth discovery from #316/#318 untouched.
  assert.match(INDEX, /isProtectedResourceMetadataRequest\(url\.pathname\)/)
  assert.match(INDEX, /buildWwwAuthenticateChallenge/)
})

// ── Audit migration ─────────────────────────────────────────────────────────

test('audit migration is additive and prepared-only', () => {
  assert.match(MIGRATION, /Prepared only\. Do not apply to production without explicit CA approval\./)
  for (const col of ['connection_principal_user_id', 'effective_context_kind', 'effective_staff_profile_id', 'effective_client_id']) {
    assert.ok(MIGRATION.includes(col), `adds ${col}`)
  }
  assert.match(MIGRATION, /add column if not exists/)
  assert.doesNotMatch(MIGRATION, /drop (table|column)/i, 'never destructive')
  assert.match(MIGRATION, /create or replace function public\.mcp_record_idempotency_with_context/)
})
