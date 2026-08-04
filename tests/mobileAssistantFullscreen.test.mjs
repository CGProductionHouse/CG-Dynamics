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
const composer = read('../src/components/assistant/GlobalAssistantComposer.tsx')
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

// ── The sheet is sized to what the user can actually see ────────────────────
test('the full-screen sheet is sized to the VISUAL viewport, never a vh unit', () => {
  // Measured in-browser: with a 336px keyboard on a 390x844 iPhone the sheet
  // ended at exactly 508px — the keyboard's top edge. A 100dvh sheet would have
  // run to 844 and put the composer under the keyboard.
  assert.match(composer, /height: `\$\{viewport\.height\}px`/)
  assert.match(composer, /transform: `translateY\(\$\{viewport\.offsetTop\}px\)`/)
  const shellClass = composer.slice(composer.indexOf('const shellClass'), composer.indexOf('const innerClass'))
  assert.doesNotMatch(shellClass, /100dvh|100vh|h-screen/, 'the sheet must not be sized with a viewport height unit')
})

test('the composer is the fixed footer of the sheet, so it sits above the keyboard', () => {
  assert.match(composer, /mobileFullscreen \? 'shrink-0' : ''/)
  const scrollClass = composer.slice(composer.indexOf('const scrollClass'), composer.indexOf('const scrollClass') + 400)
  assert.match(scrollClass, /min-h-0 flex-1/, 'the message list must absorb the height change, not the composer')
})

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

// ── The page behind is genuinely blocked ─────────────────────────────────────
test('opening the sheet freezes the page behind and restores its scroll on close', () => {
  const lock = viewportLib.slice(viewportLib.indexOf('export function useBodyScrollLock'))
  // overflow:hidden alone does not stop iOS scrolling the document.
  assert.match(lock, /position = 'fixed'/)
  assert.match(lock, /top = `-\$\{scrollY\}px`/)
  assert.match(lock, /window\.scrollTo\(0, scrollY\)/, 'closing must return the user to exactly where they were')
  assert.match(composer, /useBodyScrollLock\(mobileFullscreen\)/)
})

test('the page behind cannot be tapped or reached by assistive tech', () => {
  assert.match(layout, /aria-hidden=\{assistantFullscreen \|\| undefined\}/)
  assert.match(layout, /inert=\{assistantFullscreen \|\| undefined\}/)
  assert.match(composer, /aria-modal=\{mobileFullscreen \? true : undefined\}/)
  assert.match(composer, /role=\{mobileFullscreen \? 'dialog' : undefined\}/)
})

// ── Navigation hides and reliably comes back ─────────────────────────────────
test('the bottom navigation is removed while the sheet is open, not merely covered', () => {
  assert.match(layout, /\{!assistantFullscreen && \(\s*<nav[\s\S]*?Primary mobile navigation/)
  assert.match(layout, /<GlobalAssistantComposer onMobileFullscreenChange=\{setAssistantFullscreen\} \/>/)
})

test('the navigation can never be left hidden if the composer unmounts while open', () => {
  assert.match(composer, /useEffect\(\(\) => \(\) => \{ onMobileFullscreenChangeRef\.current\?\.\(false\) \}, \[\]\)/)
})

test('back and Escape close the sheet instead of leaving the page', () => {
  assert.match(composer, /window\.history\.pushState\(\{ cgAssistant: true \}, ''\)/)
  assert.match(composer, /popstate/)
  assert.match(composer, /event\.key === 'Escape'/)
})

// ── Desktop keeps its own experience ─────────────────────────────────────────
test('desktop keeps the docked panel and is never locked or made full-screen', () => {
  assert.match(composer, /const mobileFullscreen = isMobile && open && !onAssistantPage/)
  const shellClass = composer.slice(composer.indexOf('const shellClass'), composer.indexOf('const innerClass'))
  // The non-fullscreen branch keeps the existing docked positioning.
  assert.match(shellClass, /md:right-5/)
  assert.match(shellClass, /--assistant-viewport-inset/)
})

// ── Recently completed mobile work is preserved ──────────────────────────────
test('the simplified mobile start screen is unchanged', () => {
  assert.match(composer, /What do you need help with\?/)
  assert.match(composer, /Record my update/)
  assert.match(composer, /What should I do next\?/)
  assert.match(composer, /mobileSuggestionAreaHidden/)
})

test('the mobile composer control states are unchanged', () => {
  assert.match(composer, /const mobileMicPrimary = speechSupported && !sending && \(listening \|\| input\.trim\(\) === ''\)/)
  assert.match(composer, /const mobileSendPrimary = sending \|\| \(!listening && input\.trim\(\) !== ''\)/)
})

test('the daily voice-state flow still renders and stays bounded in the sheet', () => {
  assert.match(composer, /<DailyAssistantCapture/)
  // An open capture/debrief/proposal takes the flexible space so it can never
  // push the composer off the bottom once the keyboard opens.
  assert.match(composer, /const overlayOpen = dailyCaptureOpen \|\| debriefOpen \|\| Boolean\(proposal\)/)
  assert.match(composer, /overlayOpen \? 'shrink' : 'flex-1'/)
  assert.match(composer, /mobileFullscreen && overlayOpen \? 'min-h-0 flex-1 overflow-y-auto overscroll-contain' : 'contents'/)
})

test('iOS still cannot zoom the composer inputs on focus', () => {
  assert.match(indexCss, /\[data-assistant-composer\] textarea[\s\S]*font-size: 16px/)
})

// ── Safe areas ───────────────────────────────────────────────────────────────
test('the sheet respects the notch and the home indicator', () => {
  const innerClass = composer.slice(composer.indexOf('const innerClass'), composer.indexOf('const overlayOpen'))
  assert.match(innerClass, /env\(safe-area-inset-bottom\)/)
  assert.match(innerClass, /env\(safe-area-inset-left\)/)
  assert.match(innerClass, /env\(safe-area-inset-right\)/)
  assert.match(composer, /pt-\[max\(0\.625rem,env\(safe-area-inset-top\)\)\]/)
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

test('the error surface offers a retry that does not duplicate the question', () => {
  assert.match(composer, /role="alert"/)
  assert.match(composer, /Try again/)
  assert.match(composer, /function retryLastMessage/)
  const body = composer.slice(composer.indexOf('function retryLastMessage'), composer.indexOf('function newChat'))
  assert.match(body, /trimmed\.at\(-1\)\?\.role === 'assistant'/)
  assert.match(body, /trimmed\.at\(-1\)\?\.role === 'user'/)
})

test('a failure is never presented as a success', () => {
  assert.match(composer, /const friendly = friendlyAssistantError\(response\.error\)/)
  assert.match(composer, /setChatErrorRetryable\(friendly\.retryable\)/)
})
