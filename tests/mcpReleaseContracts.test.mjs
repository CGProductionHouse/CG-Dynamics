import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const source = readFileSync('supabase/functions/cg-dynamics-mcp/index.ts', 'utf8')
const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true)
function handler(name) {
  const statement = ast.statements.find(node => ts.isVariableStatement(node) &&
    node.declarationList.declarations.some(d => d.name.getText(ast) === name))
  assert.ok(statement, name)
  const collateral = ast.statements.find(node => ts.isVariableStatement(node) &&
    node.declarationList.declarations.some(d => d.name.getText(ast) === 'GOVERNED_COLLATERAL'))
  const js = ts.transpileModule(`${collateral.getText(ast)}\n${statement.getText(ast)}`, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
  }).outputText
  return new Function('tableExists', 'ADMIN_CONTEXT_ROLES', `${js}; return ${name}`)(async () => true, new Set(['admin', 'manager']))
}
function database(rows, readError = null) {
  const writes = []
  return { writes, from(table) {
    let fields = '*'
    const query = { select(value) { fields = value; return this }, eq() { return this },
      order() { return this }, limit() { return this },
      async maybeSingle() {
        const row = rows[table] ?? null
        return { data: row && Object.fromEntries(Object.entries(row).filter(([key]) =>
          fields === '*' || fields.split(',').map(x => x.trim()).includes(key))), error: readError }
      },
      then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject) },
    }
    return query
  }, async rpc(name, args) { writes.push({ name, args }); return { data: {}, error: null } } }
}
const staff = { profileId: 'staff-a', role: 'staff' }

test('lead read checks the selected owner: own allowed, foreign denied', async () => {
  const read = handler('handleGetLead')
  const own = await read({ ...staff, supabase: database({ business_development_leads: { id: 'lead', owner_profile_id: 'staff-a' } }) }, { lead_id: 'lead' })
  assert.equal(own.error, undefined)
  const foreign = await read({ ...staff, supabase: database({ business_development_leads: { id: 'lead', owner_profile_id: 'staff-b' } }) }, { lead_id: 'lead' })
  assert.match(foreign.error, /own leads/)
  const teamForeign = await read({ ...staff, role: 'team', supabase: database({ business_development_leads: { id: 'lead', owner_profile_id: 'staff-b' } }) }, { lead_id: 'lead' })
  assert.match(teamForeign.error, /own leads/)
})

test('preference amendment preserves existing ChatGPT project identity', async () => {
  const sb = database({ staff_assistant_profiles: { chatgpt_project_name: 'Existing project', chatgpt_project_url: 'https://chatgpt.com/g/example', working_preferences: ['Keep'] } })
  await handler('handleUpdateMyPreferences')({ ...staff, supabase: sb }, { responsibilities: ['Updated'] })
  assert.equal(sb.writes[0].args.p_chatgpt_project_name, 'Existing project')
  assert.equal(sb.writes[0].args.p_chatgpt_project_url, 'https://chatgpt.com/g/example')
  assert.deepEqual(sb.writes[0].args.p_working_preferences, ['Keep'])
  const unreadable = database({}, { message: 'Read unavailable' })
  const refused = await handler('handleUpdateMyPreferences')({ ...staff, supabase: unreadable }, { responsibilities: ['Updated'] })
  assert.equal(refused.error, 'Read unavailable')
  assert.equal(unreadable.writes.length, 0)
})

test('governed default collateral has durable keys and deduplicates explicit selection', async () => {
  const sb = database({ staff_assistant_profiles: { email_setup_status: 'ready', preferred_company_from: 'staff@example.test', signature_text: 'Signature', mail_scope: 'owned_threads_only' } })
  const compose = handler('handleComposeMailDraft')
  const input = { body: 'Draft only', include_business_profile: true, include_wedding_packages: true }
  const result = await compose({ ...staff, supabase: sb }, input)
  assert.deepEqual(result.collateral_to_attach.map(x => x.drive_asset_key), ['collateral/cg-business-profile-latest.pdf', 'collateral/cg-wedding-packages-latest.pdf'])
  const explicit = await compose({ ...staff, supabase: sb }, { ...input, collateral: ['cg_business_profile'] })
  assert.equal(explicit.collateral_to_attach.filter(x => x.drive_asset_key === 'collateral/cg-business-profile-latest.pdf').length, 1)
  const invalid = await compose({ ...staff, supabase: sb }, { ...input, collateral: { length: 1 } })
  assert.match(invalid.error, /array of strings/)
  assert.equal(sb.writes.length, 0)
})
