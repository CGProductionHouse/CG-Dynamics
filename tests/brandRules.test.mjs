import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// Pure brand-rule helpers load through Vite SSR (no Supabase import). The
// migration is checked by parsing its source. No database is touched.

let server
let r
const MIGRATION = readFileSync('supabase/migrations/20261111090000_client_brand_profiles_and_rules.sql', 'utf8')

before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  r = await server.ssrLoadModule('/src/lib/brandRules.ts')
})
after(async () => { await server?.close() })

test('hex colours normalise and reject non-colours', () => {
  assert.equal(r.normaliseHex('#9B4F1B'), '#9b4f1b')
  assert.equal(r.normaliseHex('0a2f37'), '#0a2f37')
  assert.equal(r.normaliseHex('#fff'), '#ffffff')
  assert.equal(r.normaliseHex('orange'), null)
  assert.equal(r.normaliseHex('#12345'), null)
})

test('colour lists keep roles, drop duplicates and report rejects', () => {
  const { colours, rejected } = r.parseColourList('#9b4f1b orange, 0A2F37 teal\n#9B4F1B, blue')
  assert.deepEqual(colours, [{ hex: '#9b4f1b', role: 'orange' }, { hex: '#0a2f37', role: 'teal' }])
  assert.deepEqual(rejected, ['blue'])
  assert.equal(r.formatColourList(colours), '#9b4f1b orange, #0a2f37 teal')
})

test('Canva brand kit ids come from a bare id or a canva.com/brand link only', () => {
  assert.equal(r.parseCanvaBrandKitId('https://www.canva.com/brand/kAGn0NB0i8s'), 'kAGn0NB0i8s')
  assert.equal(r.parseCanvaBrandKitId('https://www.canva.com/brand/kAGn0NB0i8s/ingredient/IG-abc'), 'kAGn0NB0i8s')
  assert.equal(r.parseCanvaBrandKitId('kAG-lS42OsY'), 'kAG-lS42OsY')
  assert.equal(r.parseCanvaBrandKitId('javascript:alert(1)'), null)
  assert.equal(r.parseCanvaBrandKitId(''), null)
  assert.equal(r.canvaBrandKitUrl('kAGn0NB0i8s'), 'https://www.canva.com/brand/kAGn0NB0i8s')
  assert.equal(r.canvaBrandKitUrl('bad id'), null)
})

test('rule text length is validated', () => {
  assert.ok(r.validateRuleText('  ab '))
  assert.equal(r.validateRuleText('No full stops'), null)
  assert.ok(r.validateRuleText('x'.repeat(501)))
})

test('client view shows its own and house rules, musts first, retired hidden', () => {
  const base = { category: 'copy', source: null }
  const rules = [
    { ...base, id: '1', client_id: null, priority: 'should', rule: 'house should', created_at: '2026-11-01', retired_at: null },
    { ...base, id: '2', client_id: 'c1', priority: 'should', rule: 'client should', created_at: '2026-11-02', retired_at: null },
    { ...base, id: '3', client_id: null, priority: 'must', rule: 'house must', created_at: '2026-11-03', retired_at: null },
    { ...base, id: '4', client_id: 'c1', priority: 'must', rule: 'client must', created_at: '2026-11-04', retired_at: null },
    { ...base, id: '5', client_id: 'c2', priority: 'must', rule: 'other client', created_at: '2026-11-05', retired_at: null },
    { ...base, id: '6', client_id: 'c1', priority: 'must', rule: 'retired', created_at: '2026-11-06', retired_at: '2026-11-07' },
  ]
  assert.deepEqual(r.rulesForClient(rules, 'c1').map(rule => rule.id), ['4', '3', '2', '1'])
})

test('brand brief text lists the kit, colours, fonts, voice and labelled rules', () => {
  const text = r.brandBriefText({
    clientName: 'Piek Group',
    colours: [{ hex: '#25334e' }],
    fonts: ['Lastica', 'Barlow'],
    toneVoice: null,
    canvaKitId: 'kAGn0NB0i8s',
    rules: [{ id: '1', client_id: null, priority: 'must', category: 'copy', rule: 'No full stops', source: null, created_at: '', retired_at: null }],
  })
  assert.match(text, /^Brand rules: Piek Group/)
  assert.match(text, /canva\.com\/brand\/kAGn0NB0i8s/)
  assert.match(text, /Fonts: Lastica, Barlow/)
  assert.match(text, /MUST \(house, On-screen copy\): No full stops/)
})

test('migration keeps brand tables staff-only with RLS', () => {
  assert.match(MIGRATION, /alter table public\.client_brand_profiles enable row level security/)
  assert.match(MIGRATION, /alter table public\.client_brand_rules enable row level security/)
  assert.match(MIGRATION, /revoke all on public\.client_brand_profiles, public\.client_brand_rules from anon, authenticated/)
  assert.doesNotMatch(MIGRATION, /to anon/)
  assert.doesNotMatch(MIGRATION, /auth\.role\(\) = 'authenticated'/)
  assert.doesNotMatch(MIGRATION, /grant [^;]*delete/i)
  for (const name of ['brand profile staff read', 'brand rule staff read']) {
    assert.match(MIGRATION, new RegExp(`"${name}"[^;]*is_active_content_staff\\(\\)`))
  }
})

test('migration limits writes: managers for profiles and house rules, retire-only updates', () => {
  assert.match(MIGRATION, /"brand profile manager insert"[^;]*is_manager\(\)/)
  assert.match(MIGRATION, /"brand profile manager update"[^;]*is_manager\(\)/)
  assert.match(MIGRATION, /"brand rule staff insert"[^;]*created_by = auth\.uid\(\)[^;]*client_id is not null or public\.is_manager\(\)/)
  assert.match(MIGRATION, /"brand rule manager retire"[^;]*is_manager\(\)/)
  assert.match(MIGRATION, /Brand rules cannot be edited/)
  assert.match(MIGRATION, /PREPARED, NOT APPLIED/)
})
