import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, assistant
before(async () => {
  server = await createServer({
    root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://example.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
    },
  })
  assistant = await server.ssrLoadModule('/src/lib/staffAssistant.ts')
})
after(async () => { await server?.close() })

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const SQL = read('../supabase/migrations/20260908220000_staff_assistant_workspaces.sql')
const PAGE = read('../src/pages/admin/MyAssistantPage.tsx')
const APP = read('../src/App.tsx')
const SERVICE = read('../src/lib/businessDevelopmentLeads.ts')

const profile = { id: '11111111-1111-4111-8111-111111111111', full_name: 'Example Staff' }
const draft = {
  responsibilities: ['Client work'], recurringDuties: ['Morning review'], workingPreferences: ['Concise'],
  outputPreferences: ['Lead with outcome'], leadResearchCriteria: ['Verify sources'],
  repeatedCorrections: ['Do not guess'], commonTaskTypes: ['Lead research'], projectName: 'Example Assistant', projectUrl: '',
}

test('one staff assistant profile is keyed by exact canonical profile id', () => {
  assert.match(SQL, /profile_id uuid primary key references public\.profiles\(id\)/)
  assert.match(SQL, /where profile_id = auth\.uid\(\)/)
  assert.doesNotMatch(SQL, /where.*full_name\s*=/i)
})

test('staff Project Instructions are recoverable, exact-person and mutable-free', () => {
  const instructions = assistant.buildStaffProjectInstructions(profile, draft)
  assert.match(instructions, /Canonical Dynamics staff profile ID: 11111111/)
  assert.match(instructions, /live Work\/My Day\/Planner/)
  assert.match(instructions, /canonical Dynamics Leads workspace/)
  assert.match(instructions, /Do not hardcode mutable daily tasks/)
  assert.doesNotMatch(instructions, /today at \d/i)
})

test('Project URL validator accepts only HTTPS chatgpt.com Project paths', () => {
  assert.equal(assistant.isSafeChatGptProjectUrl('https://chatgpt.com/project/example'), true)
  assert.equal(assistant.isSafeChatGptProjectUrl('https://evil.example/project/example'), false)
  assert.equal(assistant.isSafeChatGptProjectUrl('javascript:alert(1)'), false)
})

test('personal context is own-profile only while managers receive setup health projection', () => {
  assert.match(SQL, /"Staff read own assistant profile"/)
  assert.match(SQL, /profile_id = auth\.uid\(\)/)
  assert.doesNotMatch(SQL, /Admins read staff assistant profiles/)
  assert.match(SQL, /list_staff_assistant_setup_health/)
  assert.match(SQL, /Manager access required/)
  assert.doesNotMatch(SQL, /chatgpt_project_reference\s+as/i)
})

test('staff cannot self-grant assistant access scope', () => {
  assert.match(SQL, /set_staff_assistant_access_scope/)
  assert.match(SQL, /p\.role in \('admin', 'manager'\)/)
  assert.doesNotMatch(SQL, /p_approved_access_scope text\[\][\s\S]*save_my_staff_assistant_profile/)
})

test('lead model includes practical states and durable action fields', () => {
  for (const state of ['to_research','to_contact','contacted_awaiting_response','follow_up','active_opportunity','nurture','won_converted','closed_not_fit']) {
    assert.ok(SQL.includes(`'${state}'`), `missing ${state}`)
    assert.ok(SERVICE.includes(`'${state}'`), `service missing ${state}`)
  }
  for (const field of ['qualification','last_action','last_action_at','next_action','follow_up_at','source_kind','source_url']) {
    assert.match(SQL, new RegExp(`\\b${field}\\b`))
  }
})

test('lead ownership and research are cross-staff isolated', () => {
  assert.match(SQL, /owner_profile_id = auth\.uid\(\)/)
  assert.match(SQL, /Lead owner or manager reads leads/)
  assert.match(SQL, /Visible lead research can be read/)
  assert.match(SQL, /p\.is_active is true/)
  assert.doesNotMatch(SQL, /my_client_id\(\)/)
})

test('lead writes are auditable, idempotent and not hard deletable', () => {
  assert.match(SQL, /idempotency_key uuid not null/)
  assert.match(SQL, /business_development_leads_owner_idempotency_idx/)
  assert.match(SERVICE, /crypto\.randomUUID\(\)/)
  assert.match(SERVICE, /onConflict: 'owner_profile_id,idempotency_key'/)
  assert.match(SQL, /business_development_lead_events/)
  assert.match(SQL, /after insert or update on public\.business_development_leads/)
  assert.doesNotMatch(SQL, /grant delete.*business_development_leads/i)
})

test('My Assistant reuses live My Day and provides leads/setup without cloning tasks', () => {
  assert.match(PAGE, /getMyDayContext\(profile\)/)
  assert.match(PAGE, /listMyBusinessDevelopmentLeads/)
  assert.match(PAGE, /Copy current Instructions/)
  assert.match(PAGE, /Team Assistants/)
  const createdTables = [...SQL.matchAll(/create table if not exists public\.([a-z0-9_]+)/gi)].map(match => match[1])
  assert.equal(createdTables.some(name => name.includes('assistant') && name.includes('task')), false)
})

test('My Assistant route is staff-only inside the existing app shell', () => {
  assert.match(APP, /<Route element=\{<RequireStaff \/>\}>/)
  assert.match(APP, /path="\/admin\/my-assistant" element=\{<MyAssistantPage \/>\}/)
})
