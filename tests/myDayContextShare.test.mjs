import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { before, test } from 'node:test'
import { createServer } from 'vite'

// #338 regression coverage. The repo has no React effect-rendering harness, so the
// timing decision lives in a pure module (tested directly) and the wiring in the
// composer / Hub / store is asserted from source with comments stripped.

let share
before(async () => {
  const server = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  // Close in finally: a load failure must fail these tests, not hang the suite.
  try {
    share = await server.ssrLoadModule('/src/lib/myDayContextShare.ts')
  } finally {
    await server.close()
  }
})

const code = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')

const context = { tasks: [] }
const state = (status, profileId, value = null) => ({ status, profileId, context: value })

test('a slow Hub still loading this user makes the composer wait instead of fetching twice', () => {
  // The reported case: on an iPhone the Hub took ~10s, so the old 2s timer fired
  // with no shared context and ran the duplicate queries anyway.
  assert.equal(share.resolveWorkContextSource(state('loading', 'u1'), 'u1'), 'wait')
  assert.equal(share.workContextDelay('wait'), share.HUB_CONTEXT_WAIT_LIMIT_MS)
  assert.ok(share.HUB_CONTEXT_WAIT_LIMIT_MS > 10_000, 'must outlast a slow Hub load')
  assert.ok(share.HUB_CONTEXT_WAIT_LIMIT_MS > share.COMPOSER_FETCH_DELAY_MS)
})

test('a published Hub context for this user is reused immediately', () => {
  assert.equal(share.resolveWorkContextSource(state('ready', 'u1', context), 'u1'), 'shared')
  assert.equal(share.workContextDelay('shared'), 0)
})

test('another user’s shared context is never used', () => {
  assert.equal(share.resolveWorkContextSource(state('ready', 'u1', context), 'u2'), 'fetch')
  assert.equal(share.resolveWorkContextSource(state('loading', 'u1'), 'u2'), 'fetch')
})

test('direct navigation, a failed Hub load or no profile fall back to fetching', () => {
  assert.equal(share.resolveWorkContextSource(share.IDLE_SHARED_MY_DAY, 'u1'), 'fetch')
  assert.equal(share.resolveWorkContextSource(state('error', 'u1'), 'u1'), 'fetch')
  assert.equal(share.resolveWorkContextSource(state('ready', 'u1', null), 'u1'), 'fetch')
  assert.equal(share.resolveWorkContextSource(state('ready', null, context), null), 'fetch')
  assert.equal(share.workContextDelay('fetch'), share.COMPOSER_FETCH_DELAY_MS)
})

test('the composer decides at render time, not inside a timer that captured null', () => {
  const composer = code('src/components/assistant/GlobalAssistantComposer.tsx')
  assert.match(composer, /resolveWorkContextSource\(sharedMyDay, profileId\)/)
  assert.match(composer, /workContextDelay\(workContextSource\)/)
  assert.match(composer, /\[profile, profileId, workContextSource, sharedWorkContext\]/,
    'the effect must re-run when the Hub publishes, clearing the pending fallback timer')
  assert.doesNotMatch(composer, /sharedMyDayContext/, 'the old captured-at-mount pattern must be gone')
})

test('the Hub announces its load before querying and always settles it', () => {
  const hub = code('src/pages/admin/CgHubPage.tsx')
  const body = hub.slice(hub.indexOf('async function loadAll()'), hub.indexOf('const loadAllEvent'))
  const begin = body.indexOf('myDayShare.beginLoad(')
  assert.ok(begin > 0, 'beginLoad must be called')
  assert.ok(begin < body.indexOf('listTasks('), 'the load is announced before the queries start')
  assert.ok(body.indexOf('myDayShare.publish(') > body.indexOf('getMyDayContext('), 'publish after the context is built')
  assert.ok(body.indexOf('myDayShare.fail(') > body.indexOf('catch'), 'a failed load releases waiting consumers')
})

test('the shared-state provider keeps its actions stable', () => {
  const store = code('src/contexts/MyDayContextStore.tsx')
  assert.match(store, /useMemo<MyDayShareActions>/, 'publishers must not re-render on every state change')
  assert.match(store, /MyDayShareActionsContext\.Provider/)
  assert.match(store, /SharedMyDayStateContext\.Provider/)
})
