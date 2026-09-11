import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

// #341 — client-Project operational writes. The rules are exercised through the production
// modules (projectContext.ts, clientWorkspace.ts, toolCatalog.ts); the index.ts wiring and the
// canonical SQL are asserted from source. The We Ar Fuels / Sydney meeting from #341 is the
// acceptance fixture. Every id here is synthetic: no real client or staff data is used.

let server
let ctx
let ws
let catalog
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  const load = p => server.ssrLoadModule(`/supabase/functions/cg-dynamics-mcp/${p}`)
  ctx = await load('projectContext.ts')
  ws = await load('clientWorkspace.ts')
  catalog = await load('toolCatalog.ts')
})
after(async () => { await server?.close() })

const stripJs = source => source
  .replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')
const INDEX = stripJs(readFileSync(new URL('../supabase/functions/cg-dynamics-mcp/index.ts', import.meta.url), 'utf8'))
const SQL_RAW = readFileSync(new URL('../supabase/migrations/20260911160000_client_workspace_actions.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const SQL = SQL_RAW.replace(/--.*$/gm, '')

const WE_AR_FUELS = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a41'
const RED_OAK = '7a2b3c4d-5e6f-4a70-8b8c-9d0e1f2a3b52'
const CONNECTION_PROFILE = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c63'
const SYDNEY = '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d74'
const SYDNEY_NEL = '3d4e5f60-7182-4c9d-8e1f-2a3b4c5d6e85'
const FRANCO = '4e5f6071-8293-4d0e-9f2a-3b4c5d6e7f96'
const LEAVER = '5f607182-93a4-4e1f-8a3b-4c5d6e7f8a07'
const PORTAL_USER = '6071a293-b4c5-4f2a-9b4c-5d6e7f8a9b18'

const DIRECTORY = [
  { id: SYDNEY, full_name: 'Sydney Oosthuizen', role: 'staff', is_active: true, email: 'sydney@example.test', pay_rate_hourly: 999, phone: '000' },
  { id: SYDNEY_NEL, full_name: 'Sydney Nel', role: 'staff', is_active: false, email: 'nel@example.test' },
  { id: FRANCO, full_name: 'Franco Lessing', role: 'staff', is_active: true },
  { id: LEAVER, full_name: 'Past Employee', role: 'team', is_active: false },
  { id: PORTAL_USER, full_name: 'Client Portal User', role: 'client', is_active: true },
]

const scope = { clientId: WE_AR_FUELS, actorProfileId: CONNECTION_PROFILE, connectionUserId: CONNECTION_PROFILE }
const key = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

// The three follow-ups CA's We Ar Fuels meeting produced for Sydney (#341).
const SYDNEY_ACTIONS = [
  'Garage Talks: reusable interview-question script and the first CG interview script',
  'Research the best use of the R6,000 boosting budget',
  'Script the large-client farm video around El Niño, drought and peace of mind',
]

const CLIENT_WORKSPACE_WRITES = ['record_client_request', 'create_client_followup_task', 'record_client_update']

// ── Acceptance: We Ar Fuels / Sydney ────────────────────────────────────────

test('the We Ar Fuels Project turns the three meeting actions into same-client follow-ups for Sydney', () => {
  const created = SYDNEY_ACTIONS.map((title, index) => {
    const resolved = ws.resolveAssignee(DIRECTORY, { assignee_profile_id: SYDNEY })
    assert.equal(resolved.ok, true)
    const linkage = ws.planMicrosoftLinkage({ microsoft_write: 'not_requested' })
    // A model-supplied client id is ignored: the Project scope is the only client authority.
    const built = ws.buildClientTaskWrite('follow_up', scope, { title, idempotency_key: key(index + 1), client_id: RED_OAK }, resolved.assignee, linkage, 'create_client_followup_task')
    assert.equal(built.ok, true, built.error)
    return built.params
  })

  for (const params of created) {
    assert.equal(params.p_client_id, WE_AR_FUELS, 'pinned to the Project client')
    assert.equal(params.p_assignee_profile_id, SYDNEY, 'assigned to the exact Sydney')
    assert.equal(params.p_actor_profile_id, CONNECTION_PROFILE, 'the caller is the connection principal, not Sydney')
    assert.notEqual(params.p_actor_profile_id, SYDNEY)
    assert.equal(params.p_kind, 'follow_up')
    assert.equal(params.p_due_date, null, 'no due date was given, so none is invented')
    assert.equal(params.p_microsoft_task_id, null)
    assert.equal(params.p_source_context.source, 'chatgpt_client_project')
  }
  assert.deepEqual(created.map(p => p.p_title), SYDNEY_ACTIONS)
  assert.equal(new Set(created.map(p => p.p_idempotency_key)).size, 3, 'three distinct writes')

  const sync = ws.gradeFollowupSync('dynamics_only', true)
  assert.equal(sync.verdict, 'PASS')
  const shaped = ws.shapeClientTaskResult('follow_up', {
    replayed: false,
    task: { id: '8a9b0c1d-2e3f-4a5b-8c6d-7e8f9a0b1c29', title: SYDNEY_ACTIONS[0], client_id: WE_AR_FUELS, client_name: 'We Ar Fuels', status: 'to_do', priority: 'normal', due_date: null },
    assignee: { profile_id: SYDNEY, full_name: 'Sydney Oosthuizen' },
  }, sync)
  assert.equal(shaped.created, true)
  assert.equal(shaped.task.client_id, WE_AR_FUELS)
  assert.deepEqual(shaped.assignee, { profile_id: SYDNEY, full_name: 'Sydney Oosthuizen' })
  assert.equal(shaped.verdict, 'PASS')
})

test('the Garage Talks content direction is recorded as a durable We Ar Fuels update', () => {
  const built = ws.buildClientUpdateWrite(scope, {
    update_kind: 'content_direction',
    title: 'Garage Talks interview series',
    body: 'We Ar Fuels wants a recurring Garage Talks interview series, starting with a CG interview. Farm content leans on El Niño and drought: peace of mind for large clients.',
    decisions: ['Build a reusable interview-question script', 'Use the R6,000 boosting budget deliberately'],
    linked_task_ids: ['8a9b0c1d-2e3f-4a5b-8c6d-7e8f9a0b1c29'],
    idempotency_key: key(10),
    client_id: RED_OAK,
  })
  assert.equal(built.ok, true, built.error)
  assert.equal(built.params.p_client_id, WE_AR_FUELS)
  assert.equal(built.params.p_update_kind, 'content_direction')
  assert.equal(built.params.p_actor_profile_id, CONNECTION_PROFILE)

  const summary = ws.summarizeClientUpdates([
    { id: '9b0c1d2e-3f4a-4b5c-9d6e-7f8a9b0c1d30', update_kind: 'content_direction', title: 'Garage Talks interview series', body: 'x', review_state: 'unreviewed', source_kind: 'chatgpt_client_project', created_at: '2026-09-11T10:00:00Z' },
    { id: '0c1d2e3f-4a5b-4c6d-8e7f-8a9b0c1d2e41', update_kind: 'client_fact', title: 'Rejected note', body: 'y', review_state: 'rejected', created_at: '2026-09-11T11:00:00Z' },
    { id: '1d2e3f4a-5b6c-4d7e-9f8a-9b0c1d2e3f52', update_kind: 'client_preference', title: 'Newer', body: 'z', review_state: 'unreviewed', created_at: '2026-09-11T12:00:00Z' },
  ])
  assert.deepEqual(summary.map(u => u.title), ['Newer', 'Garage Talks interview series'], 'newest first, rejected excluded')
  assert.equal(summary[1].provenance.source, 'chatgpt_client_project')
})

// ── Isolation ───────────────────────────────────────────────────────────────

test('a Red Oak client_id can never redirect a We Ar Fuels write', () => {
  const refused = ctx.resolveClientScopeForInput('client', WE_AR_FUELS, { client_id: RED_OAK, title: 'x' })
  assert.equal(refused.ok, false)
  assert.match(refused.error, /Cross-client request refused/)
  const pinned = ctx.resolveClientScopeForInput('client', WE_AR_FUELS, { title: 'x' })
  assert.equal(pinned.input.client_id, WE_AR_FUELS)
  // The handlers take the client from the resolved scope, never from input.
  assert.match(INDEX, /clientId: staff\.effectiveClientId, actorProfileId: staff\.connection\.profileId/)
  // And the database refuses cross-client deliverables, linked tasks and calendar events.
  assert.match(SQL, /Cross-client schedule change refused/)
  assert.match(SQL, /Linked tasks must be existing tasks for this same client/)
  assert.match(SQL, /Cross-client calendar event refused/)
  assert.match(SQL, /already linked to a different client/)
})

test('generic create_task still fails in a client Project, and the staff-subject guard is unchanged', () => {
  const r = ctx.assertToolAllowedInContext('create_task', 'client')
  assert.equal(r.allowed, false)
  assert.match(r.error, /not available in a client Project/)
  assert.deepEqual([...ctx.STAFF_SUBJECT_TOOLS], [
    'get_my_day', 'list_my_tasks', 'get_task', 'list_my_calendar', 'list_my_leads', 'get_lead',
    'create_task', 'update_task', 'update_lead', 'add_lead_research', 'get_my_profile',
    'update_my_preferences', 'get_my_assistant_bootstrap', 'get_my_recurring_tasks',
    'create_recurring_task', 'compose_mail_draft', 'log_lead_email_activity',
    'find_content_runs', 'link_content_run_deliverables', 'upsert_calendar_event',
  ])
})

test('client-workspace actions run only inside a client Project', () => {
  assert.deepEqual([...ctx.CLIENT_WORKSPACE_ACTIONS], CLIENT_WORKSPACE_WRITES)
  for (const tool of CLIENT_WORKSPACE_WRITES) {
    assert.equal(ctx.assertToolAllowedInContext(tool, 'client').allowed, true, `${tool} in a client Project`)
    for (const kind of ['staff', 'company_admin']) {
      const r = ctx.assertToolAllowedInContext(tool, kind)
      assert.equal(r.allowed, false, `${tool} must not run in a ${kind} context`)
      assert.match(r.error, /client-Project action/)
    }
  }
})

test('assigning Sydney never gives the client Project Sydney\'s staff permissions', () => {
  // A client Project cannot smuggle a staff subject into its context.
  const smuggled = ctx.parseProjectContext({ context_kind: 'client', client_id: WE_AR_FUELS, staff_profile_id: SYDNEY })
  assert.equal(smuggled.ok, false)
  // Assignment is stateless: the Project is still a client Project with no staff subject.
  for (const tool of ['get_my_day', 'list_my_tasks', 'update_task', 'compose_mail_draft']) {
    assert.equal(ctx.assertToolAllowedInContext(tool, 'client').allowed, false)
  }
  // The recorded caller is the connection principal; assignment runs through the manager rule.
  assert.match(SQL, /p_actor_profile_id uuid/)
  assert.match(SQL, /Only a manager can assign Planner tasks/)
  assert.match(SQL, /set_planner_task_assignees_internal\(\s*v_task\.id, array\[v_assignee\.id\], v_actor\.id/)
  const workspace = INDEX.slice(INDEX.indexOf('function clientWorkspaceScope('), INDEX.indexOf('const toolHandlers'))
  assert.doesNotMatch(workspace, /effectiveStaffProfileId/, 'client-workspace writes never read a staff subject')
})

test('inactive, ambiguous, unknown or first-name-only assignees fail closed', () => {
  const code = input => ws.resolveAssignee(DIRECTORY, input).code
  assert.equal(code({ assignee_profile_id: SYDNEY_NEL }), 'ASSIGNEE_INACTIVE')
  assert.equal(code({ assignee_name: 'Sydney Nel' }), 'ASSIGNEE_INACTIVE')
  assert.equal(code({ assignee_profile_id: '99999999-9999-4999-8999-999999999999' }), 'ASSIGNEE_NOT_FOUND')
  assert.equal(code({ assignee_profile_id: PORTAL_USER }), 'ASSIGNEE_NOT_FOUND', 'a client portal user is not CG staff')
  assert.equal(code({ assignee_name: 'Nobody Here' }), 'ASSIGNEE_NOT_FOUND')
  assert.equal(code({}), 'ASSIGNEE_REQUIRED')
  assert.equal(code({ assignee_profile_id: FRANCO, assignee_name: 'Sydney Oosthuizen' }), 'ASSIGNEE_CONFLICT')

  const firstName = ws.resolveAssignee(DIRECTORY, { assignee_name: 'Sydney' })
  assert.equal(firstName.ok, false, 'a first name alone never resolves')
  assert.equal(firstName.code, 'ASSIGNEE_NOT_FOUND')
  assert.deepEqual(firstName.candidates, [{ profile_id: SYDNEY, full_name: 'Sydney Oosthuizen', role: 'staff' }], 'active candidates only, safe fields only')

  const twins = [...DIRECTORY, { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', full_name: 'Sydney Oosthuizen', role: 'staff', is_active: true }]
  const ambiguous = ws.resolveAssignee(twins, { assignee_name: 'sydney oosthuizen' })
  assert.equal(ambiguous.code, 'ASSIGNEE_AMBIGUOUS')
  assert.equal(ambiguous.candidates.length, 2)

  assert.equal(ws.resolveAssignee(DIRECTORY, { assignee_name: '  sydney   OOSTHUIZEN ' }).assignee.profile_id, SYDNEY, 'exact full name, case and spacing insensitive')
  // The database re-checks the assignee on its own.
  assert.match(SQL, /Assignee must be an active CG staff member/)
})

test('the assignment directory returns only safe fields for active staff', () => {
  assert.equal(ctx.assertToolAllowedInContext('list_assignable_staff', 'client').allowed, true)
  assert.equal(ws.ASSIGNABLE_STAFF_SELECT, 'id, full_name, role, is_active')
  const listed = ws.listAssignableStaff(DIRECTORY)
  assert.deepEqual(listed.map(s => s.full_name), ['Franco Lessing', 'Sydney Oosthuizen'])
  for (const person of listed) assert.deepEqual(Object.keys(person).sort(), ['full_name', 'profile_id', 'role'])
  assert.doesNotMatch(JSON.stringify(listed), /email|phone|pay_rate|example\.test/)
  assert.deepEqual(ws.listAssignableStaff(DIRECTORY, 'syd').map(s => s.full_name), ['Sydney Oosthuizen'])
  assert.match(INDEX, /\.select\(ASSIGNABLE_STAFF_SELECT\)/)
})

// ── Values, sync and idempotency ────────────────────────────────────────────

test('due dates are never invented', () => {
  assert.deepEqual(ws.validateExplicitDate(undefined), { ok: true, value: null })
  assert.deepEqual(ws.validateExplicitDate('2026-09-19'), { ok: true, value: '2026-09-19' })
  assert.equal(ws.validateExplicitDate('next Friday').ok, false)
  assert.equal(ws.validateExplicitDate('2026-02-30').ok, false)
  const linkage = ws.planMicrosoftLinkage({ microsoft_write: 'not_requested' })
  const assignee = ws.resolveAssignee(DIRECTORY, { assignee_profile_id: SYDNEY }).assignee
  assert.equal(ws.buildClientTaskWrite('follow_up', scope, { title: 'x', due_date: 'soon', idempotency_key: key(1) }, assignee, linkage, 't').ok, false)
})

test('#325: follow-ups stay Dynamics-only, link Planner by durable id, or report PARTIAL SYNC', () => {
  assert.equal(ws.planMicrosoftLinkage({ microsoft_write: 'not_requested' }).mode, 'dynamics_only')
  assert.equal(ws.planMicrosoftLinkage({ microsoft_write: 'succeeded', microsoft_task_id: 't1', microsoft_plan_id: 'p1' }).mode, 'microsoft_linked')
  assert.equal(ws.planMicrosoftLinkage({ microsoft_write: 'succeeded', microsoft_task_id: 't1' }).ok, false, 'a Planner write needs its full durable identity')
  assert.equal(ws.planMicrosoftLinkage({ microsoft_write: 'failed', microsoft_task_id: 't1' }).ok, false, 'a failed Planner write has no identity to link')
  assert.equal(ws.planMicrosoftLinkage({ microsoft_write: 'maybe' }).ok, false)

  assert.equal(ws.gradeFollowupSync('microsoft_failed', true).verdict, 'PARTIAL_SYNC')
  assert.equal(ws.gradeFollowupSync('microsoft_failed', true).sync_state, 'PARTIAL SYNC')
  assert.equal(ws.gradeFollowupSync('microsoft_linked', true).verdict, 'PASS')
  assert.equal(ws.gradeFollowupSync('microsoft_linked', false).sync_state, 'DYNAMICS_WRITE_FAILED')
  assert.equal(ws.gradeFollowupSync('dynamics_only', false).verdict, 'FAIL')

  const linked = ws.planMicrosoftLinkage({ microsoft_write: 'succeeded', microsoft_task_id: 't1', microsoft_plan_id: 'p1' })
  assert.equal(ws.buildClientTaskWrite('client_request', scope, { title: 'x', idempotency_key: key(2) }, null, linked, 'record_client_request').ok, false, 'client requests are Dynamics-only')

  assert.equal(ws.isProtectedMicrosoftPlanName('MASTER CLIENT TO DO'), true)
  assert.equal(ws.isProtectedMicrosoftPlanName('Client Socials — September 2026'), true)
  assert.equal(ws.isProtectedMicrosoftPlanName('WE AR FUELS'), false)
  assert.match(SQL, /MASTER CLIENT TO DO\|CLIENT SOCIALS/)
})

test('a retry returns the original record instead of creating another', () => {
  const replay = ws.shapeClientTaskResult('follow_up', {
    replayed: true,
    task: { id: '8a9b0c1d-2e3f-4a5b-8c6d-7e8f9a0b1c29', client_id: WE_AR_FUELS },
    assignee: { profile_id: SYDNEY, full_name: 'Sydney Oosthuizen' },
  }, ws.gradeFollowupSync('dynamics_only', true))
  assert.equal(replay.created, false)
  assert.equal(replay.replayed, true)
  assert.match(replay.replay_note, /nothing new was created/)

  // The router lets an identical repeat reach the canonical per-client key instead of answering
  // with a bare status; a reused key with different input is still refused.
  assert.match(INDEX, /CLIENT_WORKSPACE_ACTIONS\.includes\(toolName\) && !conflict/)
  assert.match(INDEX, /replayThroughCanonicalKey = true/)
  assert.match(INDEX, /isWrite && idempotencyKey && !replayThroughCanonicalKey/)
  // The database serialises each (client, key) and returns the existing row before inserting.
  assert.match(SQL, /v_hash := 'cgw-' \|\| p_client_id::text \|\| '-' \|\| p_idempotency_key::text/)
  assert.match(SQL, /pg_advisory_xact_lock\(hashtextextended\(v_hash, 0\)\)/)
  assert.match(SQL, /create unique index if not exists client_context_updates_client_key_idx\s+on public\.client_context_updates \(client_id, idempotency_key\)/)
})

test('nothing is reported as created or recorded without a real record id', () => {
  assert.equal(ws.shapeClientTaskResult('follow_up', { task: {} }, null).verdict, 'FAIL')
  assert.ok(ws.shapeClientTaskResult('client_request', null, null).error)
  assert.ok(ws.shapeClientUpdateResult({ update: { title: 'x' } }).error)
})

// ── Client Schedule, protected sources and durable intelligence ─────────────

test('Client Schedule changes are only ever pending proposals', () => {
  const noAssignee = ws.planMicrosoftLinkage({})
  const ok = ws.buildClientTaskWrite('client_request', scope, {
    title: 'Move the October reel',
    idempotency_key: key(3),
    schedule_change: { deliverable_id: '2e3f4a5b-6c7d-4e8f-8a9b-0c1d2e3f4a63', change: { scheduled_date: '2026-10-09' }, reason: 'Client asked' },
  }, null, noAssignee, 'record_client_request')
  assert.equal(ok.ok, true, ok.error)
  assert.equal(ok.params.p_schedule_change.deliverable_id, '2e3f4a5b-6c7d-4e8f-8a9b-0c1d2e3f4a63')
  assert.equal(ws.buildClientTaskWrite('client_request', scope, { title: 'x', idempotency_key: key(4), schedule_change: { deliverable_id: 'nope', change: {} } }, null, noAssignee, 't').ok, false)
  const assignee = ws.resolveAssignee(DIRECTORY, { assignee_profile_id: SYDNEY }).assignee
  assert.equal(ws.buildClientTaskWrite('follow_up', scope, { title: 'x', idempotency_key: key(5), schedule_change: { deliverable_id: '2e3f4a5b-6c7d-4e8f-8a9b-0c1d2e3f4a63', change: { a: 1 } } }, assignee, noAssignee, 't').ok, false, 'only a client request may propose a schedule change')

  assert.doesNotMatch(SQL, /(insert into|update|delete from)\s+public\.monthly_deliverables/i, 'Client Schedule truth is never written')
  assert.match(SQL, /insert into public\.client_schedule_change_requests\([\s\S]*?'pending'/)
})

test('client direction is append-only, never rewrites the guide, and comes back through fresh client context', () => {
  assert.equal(ws.buildClientUpdateWrite(scope, { update_kind: 'gossip', title: 'x', body: 'y', idempotency_key: key(6) }).ok, false)
  assert.equal(ws.buildClientUpdateWrite(scope, { update_kind: 'content_direction', title: 'x', idempotency_key: key(7) }).ok, false, 'body required')
  assert.equal(ws.buildClientUpdateWrite(scope, { update_kind: 'content_direction', title: 'x', body: 'y', linked_task_ids: ['not-a-task'], idempotency_key: key(8) }).ok, false)

  assert.match(SQL, /create trigger trg_client_context_updates_append_only\s+before update or delete/)
  assert.match(SQL, /only review_state may change/)
  assert.match(SQL, /revoke insert, update, delete on public\.client_context_updates from anon, authenticated/)
  assert.doesNotMatch(SQL, /(insert into|update)\s+public\.client_guides/i, 'the derived client guide is never overwritten')
  assert.match(SQL, /insert into public\.meeting_debriefs\(/, 'meeting outcomes reuse meeting_debriefs')

  assert.match(INDEX, /const recordedUpdates = await loadRecordedClientUpdates\(staff, clientId\)/)
  assert.equal((INDEX.match(/recorded_client_updates: recordedUpdates\.view/g) ?? []).length, 2, 'returned whether or not the guide is ready')
  assert.match(INDEX, /\.from\('client_context_updates'\)[\s\S]{0,300}\.eq\('client_id', clientId\)/)
})

test('every mutation records the connection principal and the effective client', () => {
  for (const field of ["'connection_principal_user_id', p_connection_principal_user_id", "'effective_context_kind', 'client'", "'effective_client_id', v_client.id"]) {
    assert.ok(SQL.includes(field), `activity log records ${field}`)
  }
  assert.match(SQL, /connection_principal_user_id uuid not null/)
  assert.match(SQL, /effective_context_kind text not null default 'client'/)
  assert.match(SQL_RAW, /Prepared only\. Do not apply to production without explicit CA approval\./)
  assert.match(SQL, /grant execute on function public\.record_client_workspace_task\([\s\S]*?\) to service_role;/)
  assert.match(SQL, /from public, anon, authenticated;/)
  assert.doesNotMatch(SQL, /drop (table|column)/i)
  assert.match(INDEX, /const audit = buildAuditEnvelope\(connection, parsed\.context\)/)
})

// ── Catalogue ───────────────────────────────────────────────────────────────

test('the catalogue exposes the four client-workspace tools with closed, context-bound schemas', () => {
  const tools = Object.fromEntries(catalog.CG_DYNAMICS_MCP_TOOLS.map(t => [t.name, t]))
  for (const name of ['list_assignable_staff', ...CLIENT_WORKSPACE_WRITES]) {
    const tool = tools[name]
    assert.ok(tool, `${name} exists`)
    assert.equal(tool.dependency, '#341')
    assert.equal(tool.inputSchema.additionalProperties, false)
    assert.ok(tool.inputSchema.required.includes('context'))
    assert.equal(tool.inputSchema.properties.client_id, undefined, `${name} takes its client only from the Project context`)
    assert.equal(tool.inputSchema.properties.staff_profile_id, undefined)
  }
  assert.equal(tools.list_assignable_staff.annotations.readOnlyHint, true)
  for (const name of CLIENT_WORKSPACE_WRITES) {
    assert.equal(tools[name].annotations.readOnlyHint, false)
    assert.equal(tools[name].annotations.idempotentHint, true)
    assert.ok(tools[name].inputSchema.required.includes('idempotency_key'))
    assert.match(tools[name].description, /Client Project only/)
    assert.match(tools[name].description, /Only say "(recorded|created\/assigned)" after/)
  }
  assert.ok(tools.create_client_followup_task.inputSchema.required.includes('microsoft_write'))
  assert.match(tools.create_client_followup_task.description, /gains no permissions/)
  assert.match(tools.create_client_followup_task.description, /never invented/)
  assert.match(catalog.CG_DYNAMICS_MCP_SERVER_INSTRUCTIONS, /record_client_request, create_client_followup_task and record_client_update/)
  for (const name of ['list_assignable_staff', ...CLIENT_WORKSPACE_WRITES]) {
    assert.match(INDEX, new RegExp(`${name}: handle[A-Za-z]+`))
  }
})
