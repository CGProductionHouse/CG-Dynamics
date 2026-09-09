import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

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

test('read tools cover exact staff, task, calendar, schedule, lead, client context, profile, bootstrap and recurring', () => {
  const reads = catalog.CG_DYNAMICS_MCP_TOOLS.filter(tool => tool.annotations.readOnlyHint).map(tool => tool.name)
  assert.deepEqual(reads, [
    'get_my_day', 'list_my_tasks', 'get_task', 'list_my_calendar',
    'list_client_schedule', 'get_client_context', 'list_my_leads', 'get_lead',
    'get_my_profile', 'get_my_assistant_bootstrap', 'get_my_recurring_tasks',
  ])
})

test('every mutation is non-destructive, idempotent and bound to a canonical action contract', () => {
  const writes = catalog.CG_DYNAMICS_MCP_TOOLS.filter(tool => !tool.annotations.readOnlyHint)
  assert.ok(writes.length > 0)
  for (const tool of writes) {
    assert.equal(tool.annotations.idempotentHint, true)
    assert.ok(tool.inputSchema.required.includes('idempotency_key'))
    assert.doesNotMatch(tool.canonicalContract, /table query|raw sql/i)
  }
})

test('server instruction resolves exact bearer identity and forbids unsafe fallbacks', () => {
  const instructions = catalog.CG_DYNAMICS_MCP_SERVER_INSTRUCTIONS
  assert.match(instructions, /bearer token.*exact active CG staff profile/i)
  assert.match(instructions, /Never expose SQL/i)
  assert.match(instructions, /cross-client fallbacks/i)
  assert.doesNotMatch(instructions, /Project name.*identity/i)
})

test('catalog contains exactly 17 tools: 11 read + 6 write', () => {
  const tools = catalog.CG_DYNAMICS_MCP_TOOLS
  assert.equal(tools.length, 17)
  const reads = tools.filter(t => t.annotations.readOnlyHint)
  const writes = tools.filter(t => !t.annotations.readOnlyHint)
  assert.equal(reads.length, 11)
  assert.equal(writes.length, 6)
})

test('every tool maps to a declared dependency and no tool references an unknown upstream', () => {
  const validDeps = new Set(['main', '#241/#294', '#305'])
  for (const tool of catalog.CG_DYNAMICS_MCP_TOOLS) {
    assert.ok(validDeps.has(tool.dependency), `${tool.name} has unknown dependency: ${tool.dependency}`)
  }
})

test('write tools that create tasks accept optional client_id for exact client linkage', () => {
  const createTask = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'create_task')
  assert.ok(createTask)
  assert.ok(createTask.inputSchema.properties.client_id)
})

test('get_my_day requires no input parameters', () => {
  const getMyDay = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'get_my_day')
  assert.ok(getMyDay)
  assert.deepEqual(getMyDay.inputSchema.required, [])
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

test('get_my_profile is a read-only tool with no required parameters', () => {
  const getProfile = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'get_my_profile')
  assert.ok(getProfile)
  assert.equal(getProfile.annotations.readOnlyHint, true)
  assert.deepEqual(getProfile.inputSchema.required, [])
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

test('get_my_assistant_bootstrap is a read-only tool requiring no parameters', () => {
  const bootstrap = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'get_my_assistant_bootstrap')
  assert.ok(bootstrap)
  assert.equal(bootstrap.annotations.readOnlyHint, true)
  assert.deepEqual(bootstrap.inputSchema.required, [])
  assert.match(bootstrap.description, /self-brief/i)
})

test('get_my_recurring_tasks is a read-only tool listing templates not instances', () => {
  const recurring = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'get_my_recurring_tasks')
  assert.ok(recurring)
  assert.equal(recurring.annotations.readOnlyHint, true)
  assert.deepEqual(recurring.inputSchema.required, [])
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
