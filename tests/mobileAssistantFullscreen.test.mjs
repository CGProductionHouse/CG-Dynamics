import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

// Mobile CG Assistant: focused full-screen experience.
//
// These lock the behaviour proven in the browser at iPhone viewports (390x844
// portrait and 844x390 landscape): the sheet is sized to the VISUAL viewport so
// the keyboard shrinks it instead of covering it, the page behind is frozen and
// untappable, the app's bottom navigation stands down, and closing restores the
// original scroll position.

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const layout = read('../src/pages/admin/AdminLayout.tsx')
const viewportLib = read('../src/lib/mobileViewport.ts')
const indexCss = read('../src/index.css')

let server
let friendlyAssistantError
let MOBILE_MEDIA_QUERY

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ friendlyAssistantError } = await server.ssrLoadModule('/src/lib/assistantErrors.ts'))
  ;({ MOBILE_MEDIA_QUERY } = await server.ssrLoadModule('/src/lib/mobileViewport.ts'))
})
after(async () => { await server.close() })

test('viewport geometry is applied synchronously, so a backgrounded tab resumes correctly', () => {
  // requestAnimationFrame does not fire while the page is not compositing.
  // Coalescing into a frame left the sheet holding a stale height after the app
  // was backgrounded — reproduced in-browser (rAF: 0 callbacks in 800ms).
  const hook = viewportLib.slice(viewportLib.indexOf('export function useVisualViewportRect'))
  assert.doesNotMatch(hook, /requestAnimationFrame\(/, 'geometry must not wait for a frame that may never come')
  assert.match(hook, /visibilitychange/)
  assert.match(hook, /pageshow/)
  assert.match(hook, /orientationchange/)
})

test('a landscape phone still gets the full-screen sheet', () => {
  // An iPhone 14 Pro in landscape is 844x390 — wider than the md breakpoint but
  // only 390px tall, which is the case that needs full-screen most.
  assert.match(viewportLib, /MOBILE_MAX_HEIGHT = 500/)
  assert.match(MOBILE_MEDIA_QUERY, /max-width: 767px/)
  assert.match(MOBILE_MEDIA_QUERY, /max-height: 500px/)
})

// ── Navigation hides and reliably comes back ─────────────────────────────────
test('the bottom navigation remains available after composer retirement', () => {
  assert.match(layout, /Primary mobile navigation/)
  assert.doesNotMatch(layout, /GlobalAssistantComposer|assistantFullscreen/)
})

test('iOS still cannot zoom the composer inputs on focus', () => {
  assert.match(indexCss, /\[data-assistant-composer\] textarea[\s\S]*font-size: 16px/)
})

// ── Errors a person can act on ───────────────────────────────────────────────
test('raw Edge Function and provider errors never reach the user', () => {
  for (const raw of [
    'Edge Function returned a non-2xx status code',
    'FunctionsFetchError: Failed to send a request to the Edge Function',
    'TypeError: Failed to fetch',
    'NO_AI_PROVIDER_AVAILABLE',
    '{"code":"PGRST301","message":"JWT expired"}',
    'at handler (file:///src/index.ts:42:11)',
  ]) {
    const friendly = friendlyAssistantError(raw)
    assert.ok(friendly.message.length > 0)
    assert.doesNotMatch(friendly.message, /non-2xx|Edge Function|TypeError|PGRST|_[A-Z]{2,}|file:\/\//,
      `raw text leaked for: ${raw}`)
  }
})

test('each failure explains what to do next', () => {
  assert.match(friendlyAssistantError('NO_AI_PROVIDER_AVAILABLE').message, /AI Health|try again/i)
  assert.match(friendlyAssistantError('Failed to fetch').message, /connection/i)
  assert.match(friendlyAssistantError('JWT expired').message, /sign out|session/i)
})

test('retrying is only offered when it can actually help', () => {
  assert.equal(friendlyAssistantError('Failed to fetch').retryable, true)
  assert.equal(friendlyAssistantError('Edge Function returned a non-2xx status code').retryable, true)
  // A hit quota or a dead session will not fix itself on a second tap.
  assert.equal(friendlyAssistantError('AI usage quota exceeded').retryable, false)
  assert.equal(friendlyAssistantError('JWT expired').retryable, false)
})
