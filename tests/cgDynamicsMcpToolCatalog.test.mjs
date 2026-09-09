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

test('read-first release covers exact staff, task, calendar, schedule, lead and client context', () => {
  const reads = catalog.CG_DYNAMICS_MCP_TOOLS.filter(tool => tool.annotations.readOnlyHint).map(tool => tool.name)
  assert.deepEqual(reads, ['get_my_day','list_my_tasks','get_task','list_my_calendar','list_client_schedule','get_client_context','list_my_leads','get_lead'])
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
