import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

// Generic client identity matching (PR 4).
//
// commandCentre.ts held a CLIENT_ALIASES map naming twelve real clients, so a
// new client could not be recognised without a code change, and the suggestion
// badge was computed separately from the value that was saved — letting the
// preview name a client the saved task did not carry.

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const matcherSrc = read('../src/lib/clientMatcher.ts')
const commandCentre = read('../src/lib/commandCentre.ts')
const page = read('../src/pages/admin/CommandCentrePage.tsx')
const migration = read('../supabase/migrations/20260805130000_client_aliases_directory.sql')

let server, M
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  M = await server.ssrLoadModule('/src/lib/clientMatcher.ts')
})
after(async () => { await server.close() })

// A slice of the REAL production directory (45 active, 1 inactive), plus the
// stored aliases seeded by the migration.
const DIR = [
  { id: 'toyota', name: 'Toyota Bloemfontein', active: true },
  { id: 'staffy', name: 'The Staffy', active: true, aliases: ['the staffordhire pub'] },
  { id: 'piek', name: 'Piek Group', active: true },
  { id: 'supa-bfn', name: 'Supa Quick BFN', active: true },
  { id: 'supa-cent', name: 'Supa Quick Centurion', active: true },
  { id: 'bouwer', name: 'Bouwer & Coetzee Attorneys', active: true, aliases: ['bouwer coetzee attorneys'] },
  { id: 'rc', name: 'RC-Polypipe', active: true, aliases: ['rc polypipe'] },
  { id: 'bloem', name: 'Bloem Marble & Granite', active: true, aliases: ['bloem marble'] },
  { id: 'daisy', name: 'Daisy & Co', active: true },
  { id: 'tbs', name: 'TBS', active: true },
  { id: 'psg', name: 'PSG', active: true },
  { id: 'wiseman', name: 'Wiseman Group', active: true },
  { id: 'braize', name: 'Braize', active: true },
  { id: 'braize-old', name: 'Braize Promotions', active: false },
  { id: 'case', name: 'Case Bloemfontein', active: true, aliases: ['case'] },
]

const match = (text, dir = DIR) => M.matchClient(text, dir)

// ── No client is named in code ──────────────────────────────────────────────
test('the matcher names no real client', () => {
  const code = matcherSrc.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  for (const name of ['Toyota', 'Staffy', 'Piek', 'Supa', 'Bouwer', 'Coetzee', 'Zooz', 'Madison',
                      'Wiseman', 'Loraclox', 'Securiforce', 'Germoparts', 'Dulux', 'Braize',
                      'Polypipe', 'Ehrlich', 'Daisy', 'Bloemfontein']) {
    assert.ok(!code.includes(name), `matcher must not mention ${name}`)
  }
})

test('CLIENT_ALIASES and its word lists are gone from commandCentre', () => {
  // Comments may narrate the removal; code may not contain it.
  const code = commandCentre.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.ok(!code.includes('CLIENT_ALIASES'), 'the hardcoded alias map must be removed')
  assert.ok(!code.includes('COMMON_CLIENT_WORDS'))
  for (const name of ['Zooz', 'Madison', 'Bouwer', 'Supa Quick', 'Wiseman', 'Loraclox', 'Securiforce', 'Germoparts']) {
    assert.ok(!code.includes(name), `commandCentre must not mention ${name}`)
  }
})

test('non-derivable spellings live in the database, not in code', () => {
  assert.match(migration, /create table if not exists public\.client_aliases/)
  assert.match(migration, /Derivable forms .* must NOT be stored here/)
  assert.match(commandCentre, /from\('client_aliases'\)/)
})

// ── Adding a client needs no code change ────────────────────────────────────
test('a brand-new active client matches with no code change', () => {
  const withNew = [...DIR, { id: 'new-co', name: 'Kalahari Biltong', active: true }]
  assert.equal(match('kalahari biltong posters', withNew).clientId, 'new-co')
  assert.equal(match('biltong shoot next week', withNew).clientId, 'new-co')
  // And before it exists, the same text matches nothing.
  assert.equal(match('kalahari biltong posters').clientId, null)
})

test('a renamed client follows the directory', () => {
  const renamed = DIR.map(c => c.id === 'piek' ? { ...c, name: 'Piek Holdings' } : c)
  assert.equal(match('piek holdings video', renamed).clientId, 'piek')
})

// ── Acceptance cases ────────────────────────────────────────────────────────
test('production acceptance: toyota, staffy, piek', () => {
  assert.equal(match('5 idees toyota asap').clientName, 'Toyota Bloemfontein')
  assert.equal(match('Staffy Quiz night video').clientName, 'The Staffy')
  assert.equal(match('Piek group video (die engen een)').clientName, 'Piek Group')
})

// ── Normalisation ───────────────────────────────────────────────────────────
test('case, punctuation, hyphens and ampersands do not change the result', () => {
  const want = 'Bouwer & Coetzee Attorneys'
  for (const text of ['Bouwer & Coetzee Attorneys brief', 'bouwer and coetzee attorneys brief',
                      'BOUWER & COETZEE ATTORNEYS brief', 'bouwer coetzee attorneys brief']) {
    assert.equal(match(text).clientName, want, text)
  }
  for (const text of ['RC-Polypipe site', 'rc polypipe site', 'RC Polypipe site']) {
    assert.equal(match(text).clientName, 'RC-Polypipe', text)
  }
  assert.equal(match('daisy & co posters').clientName, 'Daisy & Co')
  assert.equal(match('daisy and co posters').clientName, 'Daisy & Co')
})

test('a harmless leading word is optional', () => {
  assert.equal(match('the staffy quiz').clientName, 'The Staffy')
  assert.equal(match('staffy quiz').clientName, 'The Staffy')
})

test('accents are ignored', () => {
  const dir = [...DIR, { id: 'cafe', name: 'Café Zoë', active: true }]
  assert.equal(match('cafe zoe menu design', dir).clientId, 'cafe')
})

// ── Ambiguity is never guessed ──────────────────────────────────────────────
test('a token shared by two clients never auto-selects', () => {
  const m = match('supa quick poster')
  assert.equal(m.clientId, null)
  assert.equal(m.clientName, null)
  assert.deepEqual(m.ambiguousBetween, ['Supa Quick BFN', 'Supa Quick Centurion'])
  assert.match(m.reason, /more than one active client/)
})

test('two different clients mentioned together stay unresolved', () => {
  const m = match('toyota and psg joint shoot')
  assert.equal(m.clientId, null)
  assert.equal(m.ambiguousBetween.length, 2)
})

test('a weak or common word alone never selects', () => {
  for (const text of ['group video', 'the new plan', 'admin asap', 'pty ltd invoice']) {
    assert.equal(match(text).clientId, null, text)
  }
})

test('a bare work word never selects a client that carries it in its name', () => {
  const dir = [...DIR, { id: 'vk', name: 'Video Kreatief', active: true }]
  assert.equal(match('video design poster', dir).clientId, null)
  // The full name still matches.
  assert.equal(match('video kreatief reel', dir).clientId, 'vk')
})

test('a short client code cannot match inside an unrelated word', () => {
  // "TBS" and "PSG" must not match inside longer words.
  assert.equal(match('subtbscription notes').clientId, null)
  assert.equal(match('tbs updates').clientName, 'TBS')
})

// ── Inactive clients ────────────────────────────────────────────────────────
test('an inactive client is never selected', () => {
  const m = match('braize promotions campaign')
  // "Braize" is active and matches; the inactive "Braize Promotions" never can.
  assert.notEqual(m.clientId, 'braize-old')
  const onlyInactive = [{ id: 'gone', name: 'Retired Client', active: false }]
  assert.equal(match('retired client work', onlyInactive).clientId, null)
})

// ── Suggestion and selection cannot diverge ─────────────────────────────────
test('clientId and clientName are set together or not at all', () => {
  for (const text of ['5 idees toyota asap', 'supa quick poster', 'nothing here', 'group video']) {
    const m = match(text)
    assert.equal(m.clientId === null, m.clientName === null, text)
  }
})

test('the selection object cannot show a suggestion without a client', () => {
  const good = M.clientSelection(match('5 idees toyota asap'))
  assert.equal(good.showSuggestion, true)
  assert.equal(good.clientId, 'toyota')
  assert.equal(good.suggestionLabel, good.clientName)

  const bad = M.clientSelection(match('supa quick poster'))
  assert.equal(bad.showSuggestion, false)
  assert.equal(bad.clientId, null)
  assert.equal(bad.suggestionLabel, null)
  assert.equal(bad.needsManualSelection, true)
})

test('the UI renders the SELECTED client, never a separate suggestion', () => {
  assert.match(page, /data-testid="selected-client"/)
  assert.match(page, /edit\.clientOption && edit\.clientOption !== '__manual__'/)
  // The old "Suggested client" label is gone — it was the divergence.
  assert.ok(!page.includes("'Suggested client'"))
  assert.ok(!page.includes("confidence === 'suggested'"))
})

test('there is no in-between confidence state that could show a badge alone', () => {
  assert.match(commandCentre, /clientConfidence: 'confident' \| 'needs_review'/)
  const code = commandCentre.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.ok(!code.includes("'suggested'"))
})

test('the saved payload derives id and name from one source', () => {
  const fn = commandCentre.slice(commandCentre.indexOf('export function morningEditToInput'))
  assert.match(fn, /const resolvedName = selectedClientId/)
  assert.match(fn, /clients\.find\(c => c\.id === selectedClientId\)\?\.name/)
  // A directory client can never be saved as a name with no id.
  assert.match(fn, /: null/)
})

// ── Bucket inference stays independent ──────────────────────────────────────
test('bucket inference never changes the client result', () => {
  const withBucketWord = match('Staffy Quiz night video')
  const withoutBucketWord = match('Staffy Quiz night')
  assert.equal(withBucketWord.clientId, withoutBucketWord.clientId)
  // And the matcher has no bucket concept at all.
  assert.ok(!matcherSrc.includes('bucket'), 'client matching must not know about buckets')
})

// ── Historical data is not rewritten ────────────────────────────────────────
test('the matcher is pure and rewrites nothing', () => {
  assert.ok(!matcherSrc.includes('supabase'), 'the matcher must not touch the database')
  assert.ok(!/\.update\(|\.insert\(|\.delete\(/.test(matcherSrc))
})
