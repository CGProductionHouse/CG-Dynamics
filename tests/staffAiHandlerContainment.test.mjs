import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const read = p => readFileSync(p, 'utf8')

// Compile the actual source declaration, not a parallel normalization mock.
function sourceFunction(source, name) {
  const tree = ts.createSourceFile('handler.ts', source, ts.ScriptTarget.Latest, true)
  const declaration = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
  assert.ok(declaration, `Missing real function ${name}`)
  const js = ts.transpileModule(declaration.getText(tree), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
  return new Function(`${js}; return ${name}`)()
}
const normalizeAction = sourceFunction(read('supabase/functions/cg-assistant-chat/index.ts'), 'normalizeAction')
test('real normalizer maps default/unknown inputs to chat and preserves only existing diagnostic/status actions', () => {
  for (const value of [undefined, null, '', 'chat', 'unknown', 'CHAT', 'run', false, 0, {}, []]) {
    assert.equal(normalizeAction(value), 'chat')
  }
  for (const value of ['diagnostics', 'test_provider', 'specialist_status']) assert.equal(normalizeAction(value), value)
})
// Execute the real HTTP handler with fail-fast synthetic dependencies. Any provider,
// credential inventory, client-data read, write or audit after authentication fails.
function handler(path, role = 'staff', active = true, authenticated = true) {
  const source = read(path)
  const start = source.indexOf('Deno.serve(')
  let captured
  const profile = { role, is_active: active }
  const db = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'fixture' } : null }, error: null }) },
    from(table) {
      assert.equal(table, 'profiles')
      return { select: () => ({ eq: () => ({ single: async () => ({ data: profile }), maybeSingle: async () => ({ data: profile }) }) }) }
    },
  }
  const deny = () => { throw Error('Retired handler reached provider or mutation') }
  const deps = {
    Deno: { env: { get: () => 'synthetic' }, serve: fn => { captured = fn } },
    env: () => 'synthetic', createClient: () => db, corsHeaders: {},
    STAFF_ROLES: ['admin', 'manager', 'staff', 'team', 'owner'],
    jsonResponse: (data, status = 200) => Response.json(data, { status }),
    normalizeAction,
    requestId: deny, routeAiChat: deny, getMarketingAiState: deny,
  }
  const js = ts.transpileModule(source.slice(start).replace(/^import .*$/gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  new Function(...Object.keys(deps), js)(...Object.values(deps))
  return (action, method = 'POST') => captured(new Request('https://fixture.invalid', { method, ...(method === 'POST' ? { body: JSON.stringify({ action, message: 'hello', clientId: 'fixture' }) } : {}) }))
}
for (const role of ['staff','team','manager','admin','owner']) {
  test(`retired chat/default returns 410 without model/data access: ${role}`, async () => {
    const call = handler('supabase/functions/cg-assistant-chat/index.ts', role)
    for (const action of ['chat', undefined, 'unknown']) {
      const response = await call(action)
      assert.equal(response.status, 410)
      assert.equal((await response.json()).code, 'STAFF_AI_RETIRED')
    }
  })
  test(`retired marketing execution returns 410 without artifact/provider access: ${role}`, async () => {
    assert.equal((await handler('supabase/functions/marketing-workflow/index.ts', role)('run')).status, 410)
  })
}
for (const path of ['supabase/functions/cg-assistant-chat/index.ts', 'supabase/functions/marketing-workflow/index.ts']) {
  test(`auth and method gates remain ahead of retirement: ${path}`, async () => {
    assert.equal((await handler(path, 'client')('run')).status, 403)
    assert.equal((await handler(path, 'staff', false)('run')).status, 403)
    assert.equal((await handler(path, 'staff', true, false)('run')).status, 401)
    assert.equal((await handler(path)('run', 'GET')).status, 405)
    assert.equal((await handler(path)('run', 'OPTIONS')).status, 200)
  })
}
