import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const PAGE_SOURCE = read('../src/pages/admin/CommandCentrePage.tsx')
const LIB_SOURCE = read('../src/lib/commandCentre.ts')

// Active-only directory. Inactive clients are excluded before the parser ever
// sees them (listActiveClients filters active = true), so the parser can only
// ever select from this list.
const activeClients = [
  { id: 'toyota-bfn', name: 'Toyota Bloemfontein' },
  { id: 'staffy', name: 'The Staffy' },
  { id: 'piek', name: 'Piek Group' },
  { id: 'supa-bfn', name: 'Supa Quick BFN' },
  { id: 'supa-centurion', name: 'Supa Quick Centurion' },
  { id: 'zooz', name: 'Zooz Lifestyle WFF' },
  { id: 'madison', name: 'Madison Wear' },
  { id: 'video-kreatief', name: 'Video Kreatief' },
]

let parseMorningList
let morningEditToInput

before(async () => {
  const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ parseMorningList, morningEditToInput } = await server.ssrLoadModule('/src/lib/commandCentre.ts'))
  await server.close()
})

after(async () => {
  // server already closed in before()
})

function parseSingle(text) {
  const tasks = parseMorningList(text, activeClients)
  assert.equal(tasks.length, 1, `expected exactly one parsed task for: ${text}`)
  return tasks[0]
}

// Mirrors the preview row mapping in CommandCentrePage: the client dropdown is
// populated from clientId (never left "No client" when a match exists), and the
// manual override stays untouched.
function toInput(task, overrides = {}) {
  const edit = {
    id: task.id,
    clientOption: task.clientId ? task.clientId : '',
    manualClientName: '',
    clientName: task.clientName,
    title: task.title,
    bucket: task.bucket,
    priority: task.priority,
    dueDate: task.dueDate,
    notes: task.notes || '',
    ...overrides,
  }
  return morningEditToInput(edit)
}

// ── Live production fixtures ─────────────────────────────────────────────────

test('5 idees toyota asap auto-assigns Toyota Bloemfontein', () => {
  const task = parseSingle('- 5 idees toyota asap')
  assert.equal(task.clientId, 'toyota-bfn')
  assert.equal(task.clientName, 'Toyota Bloemfontein')
  assert.ok(!task.title.toLowerCase().includes('toyota'), 'client token is stripped from the title')
  const input = toInput(task)
  assert.equal(input.client_id, 'toyota-bfn')
  assert.equal(input.client_name, 'Toyota Bloemfontein')
})

test('Staffy Quiz night video auto-assigns The Staffy and maps to Video', () => {
  const task = parseSingle('- Staffy Quiz night video')
  assert.equal(task.clientId, 'staffy')
  assert.equal(task.clientName, 'The Staffy')
  assert.equal(task.bucket, 'Video')
  assert.ok(!task.reviewReasons.includes('No confident client match'))
  const input = toInput(task)
  assert.equal(input.client_id, 'staffy')
  assert.equal(input.client_name, 'The Staffy')
  assert.equal(input.bucket, 'Video')
})

test('Piek group video (die engen een) still matches Piek Group + Video', () => {
  const task = parseSingle('- Piek group video (die engen een)')
  assert.equal(task.clientId, 'piek')
  assert.equal(task.clientName, 'Piek Group')
  assert.equal(task.bucket, 'Video')
  assert.match(task.notes ?? '', /die engen een/)
  const input = toInput(task)
  assert.equal(input.client_id, 'piek')
  assert.equal(input.client_name, 'Piek Group')
})

// ── Case, punctuation, aliases ───────────────────────────────────────────────

test('lowercase and punctuation variants still auto-match', () => {
  const toyota = parseSingle('- 5 idees TOYOTA, ASAP')
  assert.equal(toyota.clientId, 'toyota-bfn')
  const staffy = parseSingle('- staffy quiz-night video!!')
  assert.equal(staffy.clientId, 'staffy')
  assert.equal(staffy.bucket, 'Video')
  const piek = parseSingle('- piek.group video')
  assert.equal(piek.clientId, 'piek')
  assert.equal(piek.bucket, 'Video')
})

test('exact full client names and directory aliases auto-match', () => {
  const full = parseSingle('- Toyota Bloemfontein shoot')
  assert.equal(full.clientId, 'toyota-bfn')
  assert.equal(full.bucket, 'Video')
  const alias = parseSingle('- madison wear logo')
  assert.equal(alias.clientId, 'madison')
  assert.equal(alias.clientName, 'Madison Wear')
})

test('a content word that happens to sit in a client name never auto-assigns', () => {
  const task = parseSingle('- Video design poster')
  assert.equal(task.clientId, null)
  assert.equal(task.clientName, null)
  const staffy = parseSingle('- Staffy quiz night video')
  assert.equal(staffy.clientId, 'staffy', 'the real client token still wins')
})

// ── Ambiguity and active-only safety ─────────────────────────────────────────

test('a genuinely ambiguous client token remains unresolved', () => {
  const task = parseSingle('- Supa Quick poster design')
  assert.equal(task.clientId, null)
  assert.equal(task.clientName, null)
  assert.equal(task.clientConfidence, 'needs_review')
  const input = toInput(task)
  assert.equal(input.client_id, null)
  assert.equal(input.client_name, null)
})

test('inactive clients are never selected', () => {
  assert.match(LIB_SOURCE, /listActiveClients[\s\S]*\.eq\('active', true\)/, 'only active clients reach the parser')
  const task = parseSingle('- Sunset Villa design') // not in the active directory
  assert.equal(task.clientId, null)
  assert.equal(task.clientName, null)
})

// ── Preview vs final payload never disagree ──────────────────────────────────

test('suggested match and actual selected client can never disagree', () => {
  assert.match(PAGE_SOURCE, /clientOption: t\.clientId \? t\.clientId : ''/, 'dropdown populates from clientId')
  assert.doesNotMatch(PAGE_SOURCE, /clientConfidence === 'matched' \? t\.clientId/, 'never gates the value on the badge')
  for (const text of [
    '- 5 idees toyota asap',
    '- Staffy Quiz night video',
    '- Piek group video (die engen een)',
  ]) {
    const task = parseSingle(text)
    assert.ok(task.clientId, `expected a client for: ${text}`)
    const input = toInput(task)
    assert.equal(input.client_id, task.clientId)
    assert.equal(input.client_name, task.clientName)
  }
})

test('manual correction before confirmation is preserved', () => {
  const task = parseSingle('- Staffy Quiz night video')
  const manual = toInput(task, {
    clientOption: '__manual__',
    manualClientName: 'Quick Fox Bakery',
    clientName: 'Quick Fox Bakery',
  })
  assert.equal(manual.client_id, null)
  assert.equal(manual.client_name, 'Quick Fox Bakery')
  const repick = toInput(task, {
    clientOption: 'madison',
    manualClientName: '',
    clientName: 'Madison Wear',
  })
  assert.equal(repick.client_id, 'madison')
  assert.equal(repick.client_name, 'Madison Wear')
})

// ── Bucket inference stays intact ────────────────────────────────────────────

test('bucket inference is not damaged', () => {
  const guide = parseSingle('- The Staffy content guide')
  assert.equal(guide.clientId, 'staffy')
  assert.equal(guide.bucket, 'Content Guides')
  const web = parseSingle('- Madison Wear website')
  assert.equal(web.clientId, 'madison')
  assert.equal(web.bucket, 'Websites')
  const request = parseSingle('- Toyota Bloemfontein client request')
  assert.equal(request.clientId, 'toyota-bfn')
  assert.equal(request.bucket, 'Client Requests')
})

test('edit and shoot map to Video where appropriate', () => {
  const reel = parseSingle('- Staffy reel edit')
  assert.equal(reel.bucket, 'Video')
  const shoot = parseSingle('- Piek group shoot')
  assert.equal(shoot.bucket, 'Video')
  assert.equal(shoot.clientId, 'piek')
})
