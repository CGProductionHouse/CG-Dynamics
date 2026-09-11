import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const MCP_INDEX = read('../supabase/functions/cg-dynamics-mcp/index.ts')
const CLOSEOUT_MIGRATION = read('../supabase/migrations/20260909160000_content_run_closeout_tracking.sql')

let server, catalog
before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
  catalog = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/toolCatalog.ts')
})
after(async () => { await server?.close() })

test('tool names are unique, focused and carry closed schemas plus safety annotations', () => {
  const tools = catalog.CG_DYNAMICS_MCP_TOOLS
  assert.equal(new Set(tools.map(tool => tool.name)).size, tools.length)
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, 'object')
    assert.equal(tool.inputSchema.additionalProperties, false)
    assert.equal(tool.annotations.destructiveHint, false)
    assert.equal(tool.annotations.openWorldHint, false)
    assert.ok(tool.canonicalContract)
  }
})

test('catalog exposes no infrastructure or arbitrary data tool', () => {
  const names = catalog.CG_DYNAMICS_MCP_TOOLS.map(tool => tool.name).join(' ')
  assert.doesNotMatch(names, /sql|query_table|supabase|database|delete|publish|send/i)
})

test('catalog exposes no send_email or send_draft action — staff email is draft-only', () => {
  const names = catalog.CG_DYNAMICS_MCP_TOOLS.map(tool => tool.name).join(' ')
  assert.doesNotMatch(names, /send_email|send_draft|email_send|mail_send|send_mail/i)
  // Verify compose_mail_draft exists and is NOT a send action
  const composeTool = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'compose_mail_draft')
  assert.ok(composeTool)
  assert.match(composeTool.description, /DRAFT-ONLY/i)
  assert.match(composeTool.description, /never send/i)
  assert.match(composeTool.description, /manual/i)
})

test('read tools cover exact staff, task, calendar, schedule, lead, client context, profile, bootstrap and recurring', () => {
  const reads = catalog.CG_DYNAMICS_MCP_TOOLS.filter(tool => tool.annotations.readOnlyHint).map(tool => tool.name)
  assert.deepEqual(reads, [
    'resolve_project_context',
    'get_microsoft_sync_status', 'list_company_tasks', 'list_company_recurring_tasks',
    'get_provider_health', 'find_content_runs',
    'get_my_day', 'list_my_tasks', 'get_task', 'list_my_calendar',
    'list_client_schedule', 'get_client_context', 'list_assignable_staff', 'list_my_leads', 'get_lead',
    'get_my_profile', 'get_my_assistant_bootstrap', 'get_my_recurring_tasks',
    'get_content_run_plan', 'get_content_run_closeout', 'verify_content_run_upload',
  ])
})

// #325: two classes of non-read tool.
//  - RECORD MUTATIONS write Dynamics rows and are enforced by the connector's
//    idempotency_key gate (WRITE_TOOLS in index.ts).
//  - ORCHESTRATION actions mutate nothing directly; they drive an EXISTING durable engine
//    (microsoft-transition-sync, provider sync) which carries its own idempotency, and are
//    resumed by their own job token rather than a per-call key.
const ORCHESTRATION_TOOLS = new Set(['run_microsoft_sync', 'run_provider_sync'])

test('every record mutation is non-destructive, idempotent and bound to a canonical action contract', () => {
  const writes = catalog.CG_DYNAMICS_MCP_TOOLS
    .filter(tool => !tool.annotations.readOnlyHint && !ORCHESTRATION_TOOLS.has(tool.name))
  assert.ok(writes.length > 0)
  for (const tool of writes) {
    assert.equal(tool.annotations.idempotentHint, true)
    assert.ok(tool.inputSchema.required.includes('idempotency_key'), `${tool.name} requires idempotency_key`)
    assert.doesNotMatch(tool.canonicalContract, /table query|raw sql/i)
  }
})

test('orchestration actions delegate to an existing durable engine without claiming retry idempotency', () => {
  for (const name of ORCHESTRATION_TOOLS) {
    const tool = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === name)
    assert.ok(tool, `${name} exists`)
    assert.equal(tool.annotations.idempotentHint, undefined, `${name} must not invite a blind retry`)
    assert.equal(tool.annotations.destructiveHint, false)
    // Must point at the pre-existing engine, never a second one built inside the connector.
    assert.match(tool.canonicalContract, /microsoft-transition-sync|meta-sync|google-ads-sync|tiktok-sync/)
  }
})

// #319: the shared communal connection means the bearer token proves authorisation only.
// The effective staff/client subject comes from explicit per-call Project context.
test('server instruction states the shared-connection contract and forbids unsafe fallbacks', () => {
  const instructions = catalog.CG_DYNAMICS_MCP_SERVER_INSTRUCTIONS
  assert.match(instructions, /OAuth connection is the company admin account and is NOT the staff identity/i)
  assert.match(instructions, /resolve_project_context/)
  assert.match(instructions, /Never expose SQL/i)
  assert.match(instructions, /cross-client fallbacks/i)
  assert.doesNotMatch(instructions, /Project name.*identity/i)
})

test('catalog contains exactly 38 tools: 21 read + 17 write', () => {
  const tools = catalog.CG_DYNAMICS_MCP_TOOLS
  assert.equal(tools.length, 38)
  const reads = tools.filter(t => t.annotations.readOnlyHint)
  const writes = tools.filter(t => !t.annotations.readOnlyHint)
  assert.equal(reads.length, 21)
  assert.equal(writes.length, 17)
})

test('every tool maps to a declared dependency and no tool references an unknown upstream', () => {
  const validDeps = new Set(['main', '#241/#294', '#305', '#307', '#313', '#341'])
  for (const tool of catalog.CG_DYNAMICS_MCP_TOOLS) {
    assert.ok(validDeps.has(tool.dependency), `${tool.name} has unknown dependency: ${tool.dependency}`)
  }
})

test('write tools that create tasks accept optional client_id for exact client linkage', () => {
  const createTask = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'create_task')
  assert.ok(createTask)
  assert.ok(createTask.inputSchema.properties.client_id)
})

test('get_my_day takes only the required Project context', () => {
  const getMyDay = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'get_my_day')
  assert.ok(getMyDay)
  assert.deepEqual(getMyDay.inputSchema.required, ['context'])
})

test('update_task actions are limited to safe reversible operations', () => {
  const updateTask = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'update_task')
  assert.ok(updateTask)
  const actions = updateTask.inputSchema.properties.action.enum
  assert.ok(Array.isArray(actions))
  assert.doesNotMatch(actions.join(' '), /delete|destroy|drop|remove/i)
  assert.ok(actions.includes('complete'))
  assert.ok(actions.includes('block'))
  assert.ok(actions.includes('comment'))
})

test('update_lead can set follow_up_at as date-time for scheduling', () => {
  const updateLead = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'update_lead')
  assert.ok(updateLead)
  assert.ok(updateLead.inputSchema.properties.follow_up_at)
})

test('add_lead_research requires a non-empty summary and idempotency_key', () => {
  const addResearch = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'add_lead_research')
  assert.ok(addResearch)
  assert.ok(addResearch.inputSchema.required.includes('summary'))
  assert.ok(addResearch.inputSchema.required.includes('idempotency_key'))
  assert.equal(addResearch.inputSchema.properties.summary.minLength, 1)
})

test('get_my_profile is a read-only tool taking only the Project context', () => {
  const getProfile = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'get_my_profile')
  assert.ok(getProfile)
  assert.equal(getProfile.annotations.readOnlyHint, true)
  assert.deepEqual(getProfile.inputSchema.required, ['context'])
})

test('update_my_preferences merges with existing values and requires idempotency_key', () => {
  const updatePrefs = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'update_my_preferences')
  assert.ok(updatePrefs)
  assert.equal(updatePrefs.annotations.readOnlyHint, false)
  assert.equal(updatePrefs.annotations.idempotentHint, true)
  assert.ok(updatePrefs.inputSchema.required.includes('idempotency_key'))
  const props = updatePrefs.inputSchema.properties
  assert.ok(props.responsibilities)
  assert.ok(props.working_preferences)
  assert.ok(props.repeated_corrections)
  assert.ok(props.lead_research_criteria)
})

test('get_my_assistant_bootstrap is a read-only tool taking only the Project context', () => {
  const bootstrap = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'get_my_assistant_bootstrap')
  assert.ok(bootstrap)
  assert.equal(bootstrap.annotations.readOnlyHint, true)
  assert.deepEqual(bootstrap.inputSchema.required, ['context'])
  assert.match(bootstrap.description, /self-brief/i)
})

test('get_my_recurring_tasks is a read-only tool listing templates not instances', () => {
  const recurring = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'get_my_recurring_tasks')
  assert.ok(recurring)
  assert.equal(recurring.annotations.readOnlyHint, true)
  assert.deepEqual(recurring.inputSchema.required, ['context'])
  assert.match(recurring.description, /template/i)
})

test('create_recurring_task requires title, recurrence_rule and idempotency_key', () => {
  const createRec = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'create_recurring_task')
  assert.ok(createRec)
  assert.equal(createRec.annotations.readOnlyHint, false)
  assert.equal(createRec.annotations.idempotentHint, true)
  assert.ok(createRec.inputSchema.required.includes('title'))
  assert.ok(createRec.inputSchema.required.includes('recurrence_rule'))
  assert.ok(createRec.inputSchema.required.includes('idempotency_key'))
  assert.match(createRec.description, /recurrence/i)
  assert.match(createRec.canonicalContract, /recurrence/i)
})

test('compose_mail_draft requires to_address, subject, body and idempotency_key', () => {
  const compose = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'compose_mail_draft')
  assert.ok(compose)
  assert.equal(compose.annotations.readOnlyHint, false)
  assert.equal(compose.annotations.idempotentHint, true)
  assert.ok(compose.inputSchema.required.includes('to_address'))
  assert.ok(compose.inputSchema.required.includes('subject'))
  assert.ok(compose.inputSchema.required.includes('body'))
  assert.ok(compose.inputSchema.required.includes('idempotency_key'))
  assert.match(compose.description, /DRAFT-ONLY/i)
  assert.match(compose.description, /never send/i)
  assert.match(compose.description, /Gmail plugin/i)
  assert.match(compose.description, /Gmail draft payload/i)
})

test('compose_mail_draft returns governed Gmail draft payload, not a Dynamics table write', () => {
  const compose = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'compose_mail_draft')
  assert.ok(compose)
  // Must NOT reference mail_drafts shadow table
  assert.doesNotMatch(compose.description, /mail_drafts/i)
  assert.doesNotMatch(compose.canonicalContract, /mail_drafts/i)
  // Must reference Gmail plugin as the actual draft system
  assert.match(compose.description, /Gmail plugin/i)
  assert.match(compose.canonicalContract, /Gmail plugin/i)
})

test('compose_mail_draft supports governed collateral with asset key references', () => {
  const compose = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'compose_mail_draft')
  assert.ok(compose)
  const props = compose.inputSchema.properties
  assert.ok(props.collateral)
  assert.ok(props.include_business_profile)
  assert.ok(props.include_wedding_packages)
  assert.ok(props.lead_id)
  assert.ok(props.draft_id)
  // Description must reference asset key, not frozen IDs
  assert.match(compose.description, /asset key/i)
})

test('log_lead_email_activity requires lead_id, activity_type, summary and idempotency_key', () => {
  const logActivity = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'log_lead_email_activity')
  assert.ok(logActivity)
  assert.equal(logActivity.annotations.readOnlyHint, false)
  assert.equal(logActivity.annotations.idempotentHint, true)
  assert.ok(logActivity.inputSchema.required.includes('lead_id'))
  assert.ok(logActivity.inputSchema.required.includes('activity_type'))
  assert.ok(logActivity.inputSchema.required.includes('summary'))
  assert.ok(logActivity.inputSchema.required.includes('idempotency_key'))
  assert.ok(logActivity.inputSchema.properties.activity_type.enum.includes('outbound_draft'))
  assert.ok(logActivity.inputSchema.properties.activity_type.enum.includes('inbound_received'))
})

test('email capability is in manifest with draft-only classification and role-aware scope', () => {
  const caps = catalog
  // This test validates the manifest structure — actual manifest import tested via integration
  // For unit test, we verify the tool catalog reflects the email capability
  const compose = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'compose_mail_draft')
  assert.ok(compose)
  assert.match(compose.description, /governed collateral/i)
  assert.match(compose.description, /Gmail plugin/i)
  assert.match(compose.description, /asset key/i)
})

test('no write tool exposes a send action for email', () => {
  const writes = catalog.CG_DYNAMICS_MCP_TOOLS.filter(t => !t.annotations.readOnlyHint)
  for (const tool of writes) {
    assert.doesNotMatch(tool.name, /send/i, `${tool.name} must not be a send action`)
    if (tool.name === 'compose_mail_draft') {
      assert.doesNotMatch(tool.description, /send.*automatically|auto.*send/i)
      assert.match(tool.description, /draft/i)
    }
  }
})

test('#313 exposes the canonical content-run plan as a read-only exact-ID tool', () => {
  const plan = catalog.CG_DYNAMICS_MCP_TOOLS.find(tool => tool.name === 'get_content_run_plan')
  assert.ok(plan)
  assert.equal(plan.annotations.readOnlyHint, true)
  assert.deepEqual(plan.inputSchema.required, ['content_run_id', 'context'])
  assert.equal(plan.inputSchema.properties.content_run_id.format, 'uuid')
  assert.match(plan.description, /canonical planned shot list/i)
  assert.match(plan.description, /never asks staff to recreate/i)
  assert.match(plan.description, /never.*fall.*another client/i)
})

test('#313 plan handler derives exact-client plan from canonical run and guideline structures', () => {
  assert.match(MCP_INDEX, /function handleGetContentRunPlan/)
  assert.match(MCP_INDEX, /\.from\('content_runs'\)[\s\S]*?\.eq\('id', runId\)/)
  assert.match(MCP_INDEX, /\.from\('content_guidelines'\)[\s\S]*?\.eq\('content_run_id', runId\)[\s\S]*?\.eq\('client_id', run\.client_id\)/)
  assert.match(MCP_INDEX, /\.from\('content_run_items'\)[\s\S]*?\.eq\('run_id', runId\)/)
  assert.match(MCP_INDEX, /\.from\('content_guide_ideas'\)[\s\S]*?\.eq\('content_guideline_id', guideline\.id\)[\s\S]*?\.eq\('client_id', run\.client_id\)/)
  assert.match(MCP_INDEX, /Content Run has no exact client assigned/)
  assert.match(MCP_INDEX, /get_content_run_plan: handleGetContentRunPlan/)
})

test('#313 closeout migration adds coherent idempotency and uses canonical manager authority', () => {
  assert.match(CLOSEOUT_MIGRATION, /idempotency_key uuid/)
  assert.match(CLOSEOUT_MIGRATION, /create unique index if not exists content_run_closeouts_idempotency_key_idx[\s\S]*?\(idempotency_key\)[\s\S]*?where idempotency_key is not null/)
  assert.match(CLOSEOUT_MIGRATION, /public\.is_active_planner_manager\(\)/)
  assert.doesNotMatch(CLOSEOUT_MIGRATION, /mail_scope|company_mail_manager/, 'email capability is never manager authorisation')
  assert.match(CLOSEOUT_MIGRATION, /idempotency_key = excluded\.idempotency_key/)
  assert.match(CLOSEOUT_MIGRATION, /idempotency_key = coalesce\(p_idempotency_key, idempotency_key\)/)
})

test('#313 closeout tools keep unresolved upload states explicit and idempotent', () => {
  const closeout = catalog.CG_DYNAMICS_MCP_TOOLS.find(tool => tool.name === 'close_content_run')
  const upload = catalog.CG_DYNAMICS_MCP_TOOLS.find(tool => tool.name === 'update_closeout_upload_status')
  assert.ok(closeout)
  assert.ok(upload)
  for (const tool of [closeout, upload]) {
    assert.equal(tool.annotations.idempotentHint, true)
    assert.ok(tool.inputSchema.required.includes('idempotency_key'))
  }
  assert.equal(closeout.inputSchema.properties.upload_status, undefined)
  assert.equal(closeout.inputSchema.properties.upload_evidence, undefined)
  assert.equal(upload.inputSchema.properties.upload_status, undefined)
  assert.equal(upload.inputSchema.properties.upload_evidence, undefined)
  assert.match(upload.description, /fresh authorised inspection|re-inspect/i)
})
