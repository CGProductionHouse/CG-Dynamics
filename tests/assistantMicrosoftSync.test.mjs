import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const chatFn = read('../supabase/functions/cg-assistant-chat/index.ts')
const syncLib = read('../src/lib/assistantMicrosoftSync.ts')
const composer = read('../src/components/assistant/GlobalAssistantComposer.tsx')

let server
let parseAssistantAction
let defaultMicrosoftSyncRange

const CTX = {
  today: '2026-08-03',
  clients: [{ id: 'c-dulux', name: 'Dulux' }],
  staffNames: ['Franco Nel', 'Christie-Ann'],
  role: 'admin',
  currentClientId: null,
  currentClientName: null,
}

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ parseAssistantAction, defaultMicrosoftSyncRange } = await server.ssrLoadModule('/src/lib/assistantActions.ts'))
})

after(async () => { await server.close() })

// ── The exact production regression ─────────────────────────────────────────
// On 2026-08-02 an admin asked CG Assistant to run a Microsoft sync while
// Microsoft 365 was live (transition_status=active, "2025 CLIENTS SCHEDULE"
// plan source). The assistant replied that Microsoft was not connected, and the
// admin then ran the same sync successfully from the Microsoft Import page two
// minutes later. The request must parse into a real, confirmable sync action.
test('the failed production request now parses into a Microsoft sync action', () => {
  const phrases = [
    'run a microsoft sync',
    'Run a Microsoft sync',
    'run a microsoft 365 sync',
    'sync microsoft',
    'sync Microsoft 365',
    'microsoft sync',
    'can you run the microsoft sync please',
    'sync planner',
    'sync outlook',
    'pull the latest planner tasks',
    'import outlook calendar changes',
    'reconcile microsoft data',
  ]
  for (const phrase of phrases) {
    const result = parseAssistantAction(phrase, CTX)
    assert.ok(result && 'type' in result, `no action parsed for: ${phrase}`)
    assert.equal(result.type, 'microsoft.sync', `wrong action for: ${phrase}`)
  }
})

test('Afrikaans and mixed Microsoft sync phrasing is understood', () => {
  for (const phrase of ['sinkroniseer microsoft', 'trek die planner take in', 'verfris outlook kalender data']) {
    const result = parseAssistantAction(phrase, CTX)
    assert.ok(result && 'type' in result, `no action parsed for: ${phrase}`)
    assert.equal(result.type, 'microsoft.sync', `wrong action for: ${phrase}`)
  }
})

test('Microsoft sync proposes an editable bounded range and no client scope', () => {
  const result = parseAssistantAction('run a microsoft sync', CTX)
  assert.equal(result.fields.range_start, '2026-08-01')
  assert.equal(result.fields.range_end, '2027-01-31')
  assert.equal(result.clientId, null)
  assert.match(result.title, /Microsoft 365 sync/)
})

test('default range is a bounded forward window well inside the 370-day server cap', () => {
  const { start, end } = defaultMicrosoftSyncRange('2026-08-03')
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000
  assert.ok(days > 150 && days < 200, `unexpected window: ${days} days`)
  assert.ok(days < 370, 'range must stay under the server 370-day cap')
})

test('Microsoft phrasing is never routed to a Meta sync, and Meta phrasing is untouched', () => {
  for (const phrase of ['sync microsoft', 'sync planner', 'run a microsoft sync']) {
    const result = parseAssistantAction(phrase, CTX)
    assert.notEqual(result.fields?.job, 'meta_sync', `Microsoft phrase leaked into Meta sync: ${phrase}`)
  }
  const meta = parseAssistantAction('sync all connected meta clients', CTX)
  assert.equal(meta.type, 'job.enqueue')
  assert.equal(meta.fields.job, 'meta_sync')
})

test('unrelated chat still falls through to conversation', () => {
  assert.equal(parseAssistantAction('what is happening with microsoft teams culture', CTX)?.type ?? null, null)
  assert.equal(parseAssistantAction('What should I focus on today?', CTX), null)
})

// ── Real integration state, not a model guess ───────────────────────────────
test('chat function reads REAL Microsoft state from the same truth as Integrations', () => {
  assert.match(chatFn, /getMicrosoftIntegrationState/)
  assert.match(chatFn, /microsoft_sync_settings/)
  assert.match(chatFn, /transition_status/)
  assert.match(chatFn, /microsoft_sync_plan_sources/)
  assert.match(chatFn, /MICROSOFT_SYNC_SOURCES_JSON/)
})

test('Microsoft state is injected into the system prompt as non-contradictable fact', () => {
  assert.match(chatFn, /Live Microsoft 365 integration state \(from diagnostics, do not contradict it\)/)
  assert.match(chatFn, /never say it is not connected/)
})

test('the blanket not-connected instruction can no longer swallow Microsoft or Meta', () => {
  assert.match(chatFn, /This never applies to Meta Business or Microsoft 365 — for those, use the live state above/)
})

test('Microsoft is a real registry entry, not a "future connection"', () => {
  const entry = chatFn.slice(chatFn.indexOf("key: 'microsoft'"), chatFn.indexOf("key: 'cg-hours'"))
  assert.match(entry, /status: 'protected'/)
  assert.doesNotMatch(entry, /Future connection/)
})

test('capabilities answer reports the live Microsoft line', () => {
  assert.match(chatFn, /buildMicrosoftStatusLine\(microsoftState\)/)
  assert.match(chatFn, /Microsoft 365: connected/)
})

test('integration state is ALWAYS real — never conditional on naming the integration', () => {
  // Previously the state was only fetched when the message named the
  // integration, so "what can you do?" had no state and the model guessed,
  // reporting live Microsoft as unavailable. There is no finite list of
  // phrasings that can ask about capabilities, so it is always fetched now.
  assert.match(chatFn, /await Promise\.all\(\[\s*getMetaIntegrationState\(sb\),\s*getMicrosoftIntegrationState\(sb\),\s*\]\)/)
  assert.doesNotMatch(chatFn, /isMicrosoftMention/)
  assert.doesNotMatch(chatFn, /isMetaMention/)
})

test('restricted requests still short-circuit before any integration lookup', () => {
  const restrictedAt = chatFn.indexOf('if (isRestrictedRequest(message))')
  const fetchAt = chatFn.indexOf('getMetaIntegrationState(sb),')
  assert.ok(restrictedAt > -1 && fetchAt > -1 && restrictedAt < fetchAt,
    'restricted guard must return before the integration state round trips')
})

// ── Controlled sync, truthful reporting, protections intact ─────────────────
test('sync verifies live availability BEFORE running anything', () => {
  const body = syncLib.slice(syncLib.indexOf('export async function runMicrosoftSync'))
  const availabilityAt = body.indexOf('checkMicrosoftSyncAvailability')
  const startAt = body.indexOf('startMicrosoftPreviewJob')
  assert.ok(availabilityAt > -1 && startAt > -1 && availabilityAt < startAt, 'availability must be checked before job_start')
  assert.match(body, /notConnected: true/)
})

test('sync drives the existing durable preview job and reports progress', () => {
  assert.match(syncLib, /startMicrosoftPreviewJob/)
  assert.match(syncLib, /processMicrosoftPreviewJob/)
  assert.match(syncLib, /getMicrosoftPreviewResult/)
  assert.match(syncLib, /onProgress/)
  assert.match(syncLib, /sources complete/)
})

test('sync never claims success on a partial or failed run', () => {
  const body = syncLib.slice(syncLib.indexOf('export async function runMicrosoftSync'))
  assert.match(body, /if \(!progress\.allRequiredComplete\)/)
  assert.match(body, /ok: false[\s\S]*could not complete every required source/)
  assert.match(body, /did not finish within the safety limit/)
})

test('sync reports the real record count and does NOT claim it applied anything', () => {
  assert.match(syncLib, /recordCount = snapshot\.records\.length/)
  assert.match(syncLib, /Nothing has been changed yet — review and apply it on the Microsoft Import page/)
})

test('composer enforces admin-only truthfully instead of claiming not connected', () => {
  const branch = composer.slice(composer.indexOf("p.type === 'microsoft.sync'"), composer.indexOf("p.type === 'calendar.create'"))
  assert.match(branch, /profile\?\.role !== 'admin'/)
  assert.match(branch, /restricted to admins/)
  // A permission problem must never be reported as a connection problem. Check
  // the user-facing strings only (comments may legitimately discuss the bug).
  const userFacingStrings = [...branch.matchAll(/setProposalError\('([^']*)'\)/g)].map(m => m[1])
  assert.ok(userFacingStrings.length >= 2, 'expected user-facing error strings')
  for (const message of userFacingStrings) {
    assert.doesNotMatch(message, /not connected/i, `permission/validation error must not claim a connection failure: ${message}`)
  }
})

test('composer validates the confirmed range before running', () => {
  const branch = composer.slice(composer.indexOf("p.type === 'microsoft.sync'"), composer.indexOf("p.type === 'calendar.create'"))
  assert.match(branch, /rangeEnd <= rangeStart/)
  assert.match(branch, /runMicrosoftSync\(rangeStart, rangeEnd/)
})

test('composer shows a confirmation step first and live progress while running', () => {
  // The proposal preview is the confirmation gate: the action is only executed
  // from applyProposal, which runs on explicit confirm.
  const branch = composer.slice(composer.indexOf("p.type === 'microsoft.sync'"), composer.indexOf("p.type === 'calendar.create'"))
  assert.match(branch, /setMicrosoftSyncNote/)
  assert.match(composer, /Microsoft 365 sync<\/p>/)
})

// ── Conversational grounding (no model guessing) ────────────────────────────
test('assistant context carries REAL Microsoft state, admin-scoped', () => {
  assert.match(composer, /checkMicrosoftSyncAvailability\(\)/)
  assert.match(composer, /microsoftStateRef/)
  assert.match(composer, /microsoft365: CONNECTED/)
  assert.match(composer, /microsoft365: unavailable for sync/)
  // Only admins fetch it — the status endpoint is admin-gated server-side.
  const effect = composer.slice(composer.indexOf('Live Microsoft 365 state for grounded answers'))
  assert.match(effect.slice(0, 400), /profile\?\.role === 'admin'/)
})

test('a failed status lookup adds no line at all rather than guessing', () => {
  const effect = composer.slice(composer.indexOf('Live Microsoft 365 state for grounded answers'))
  assert.match(effect.slice(0, 600), /if \(!active \|\| profileIdRef\.current !== requestedProfileId \|\| state\.error\) return/)
})
