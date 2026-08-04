import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const panel = read('../src/components/assistant/DailyAssistantCapture.tsx')
const composer = read('../src/components/assistant/GlobalAssistantComposer.tsx')
const client = read('../src/lib/dailyAssistant.ts')

// ── Required state model: Ready → Recording → Transcribing → Reviewing → Applying → Complete (+ Failed) ──

test('explicit seven-stage state machine drives the mobile voice flow', () => {
  assert.match(panel, /type CaptureStage = 'ready' \| 'recording' \| 'transcribing' \| 'reviewing' \| 'applying' \| 'complete' \| 'failed'/)
  for (const stage of ['ready', 'recording', 'transcribing', 'reviewing', 'applying', 'complete', 'failed']) {
    assert.ok(panel.includes(`stage === '${stage}'`), `panel must branch on the ${stage} stage`)
  }
})

// 1. Ready shows one recording entry point.
test('ready state shows exactly one recording entry point', () => {
  assert.match(panel, /Record your update/)
  assert.match(panel, /Nothing writes until you review and confirm\./)
  const recordEntries = panel.match(/Record voice note/g) ?? []
  assert.equal(recordEntries.length, 1, 'exactly one record button')
  const startHandlers = panel.match(/onClick=\{\(\) => void startRecording\(\)\}/g) ?? []
  assert.equal(startHandlers.length, 1, 'exactly one microphone start handler')
  // The typed textarea is a typing path, not a second recording entry point.
  assert.match(panel, /placeholder="Or type what happened\.\.\."/)
  assert.match(panel, /Review this note/)
})

// 2. Recording shows duration and one stop control.
test('recording state shows elapsed duration and a single stop control', () => {
  assert.match(panel, /formatDuration\(seconds\)/)
  assert.match(panel, />Recording<\/p>/)
  const stopButtons = panel.match(/Stop and review/g) ?? []
  assert.equal(stopButtons.length, 1, 'exactly one stop control')
  assert.match(panel, /aria-label="Stop recording and review"/)
  assert.match(panel, /Speak naturally\. You can mix English and Afrikaans\./)
})

// 3. Duplicate recording start is blocked.
test('duplicate recording starts are blocked', () => {
  assert.match(panel, /if \(recorderRef\.current\) return/)
  assert.match(panel, /recorderRef\.current = recorder/)
})

// 4. Stopping transitions directly to Transcribing.
test('stopping transitions directly to the transcribing state', () => {
  assert.match(panel, /if \(analyse && mountedRef\.current\) setStage\('transcribing'\)/)
  assert.match(panel, /Transcribing your update/)
  // No generic idle assistant view is rendered while transcribing.
  assert.doesNotMatch(panel, /stage === 'transcribing'[\s\S]{0,200}Record voice note/)
})

// 5. Generic suggestions stay hidden during recording/transcribing/reviewing/applying.
test('generic suggestions stay hidden across every capture stage', () => {
  const hidden = composer.slice(composer.indexOf('const mobileSuggestionAreaHidden'), composer.indexOf('applying', composer.indexOf('const mobileSuggestionAreaHidden')) + 'applying'.length)
  assert.ok(hidden.includes('dailyCaptureOpen'), 'composer must hide suggestions while the daily capture panel is open')
  assert.doesNotMatch(panel, /What should I do next\?/)
  assert.ok(panel.includes('Applying your update'))
  assert.ok(panel.includes('Transcribing your update'))
})

// 6. Reviewing preserves existing edit and confirmation handlers.
test('reviewing preserves the existing edit and confirmation handlers', () => {
  assert.match(panel, /Review before applying/)
  assert.match(panel, /onChange=\{patch => updateSuggestion\(index, patch\)\}/)
  assert.match(panel, /onClick=\{\(\) => void confirm\(\)\}/)
  assert.match(panel, /Confirm selected/)
  assert.match(panel, /applyDailyAssistantCapture\(analysis\)/)
  assert.match(panel, /This may already be covered by/)
})

// 7. Applying disables duplicate apply.
test('applying state disables duplicate apply', () => {
  assert.match(panel, /if \(!analysis \|\| busy\) return/)
  assert.match(panel, /Applying your update/)
  const applyingCard = panel.slice(panel.indexOf("stage === 'applying'"), panel.indexOf("stage === 'complete'"))
  assert.doesNotMatch(applyingCard, /Confirm selected|onClick=\{\(\) => void confirm\(\)\}/, 'no apply button exists while applying')
})

// 8. Complete uses verified result counts.
test('complete state summarises verified result counts only', () => {
  assert.match(panel, /completeResult\.tasks_created/)
  assert.match(panel, /completeResult\.tasks_updated/)
  assert.match(panel, /completeResult\.existing_tasks_linked/)
  assert.match(panel, /completeResult\.timeline_notes_saved/)
  assert.match(panel, />Done<\/button>/)
})

// 9. Complete can reset to a clean Ready state.
test('complete state can reset to a clean ready state', () => {
  assert.match(panel, /Record another update/)
  assert.match(panel, /setCompleteResult\(null\)/)
  assert.match(panel, /setStage\('ready'\)/)
  assert.match(panel, /function startOver\(\)/)
})

// 10. Failure presents plain-language Retry.
test('failure presents plain-language retry', () => {
  assert.match(panel, />Try again<\/button>/)
  assert.match(panel, /Nothing was applied\. Retry the note, or type it instead\./)
  assert.match(panel, /Microphone access is blocked\. Allow it in Safari settings, or type the note instead\./)
})

// 11. Raw Edge Function/provider errors are not the primary user message.
test('raw provider errors never become the primary user message', () => {
  assert.match(panel, /const failureCopy = failedStep === 'recording'/)
  assert.doesNotMatch(panel, /setError\(result\.error\)/)
  assert.doesNotMatch(panel, /setError\(error\.message\)/)
  assert.match(panel, /console\.error\('\[daily-capture\] transcription failed', result\.error\)/)
  assert.match(panel, /console\.error\('\[daily-capture\] apply failed', result\.error\)/)
})

// 12. No task is written before explicit confirmation.
test('no task write happens before explicit confirmation', () => {
  const occurrences = panel.match(/applyDailyAssistantCapture/g) ?? []
  assert.equal(occurrences.length, 2, 'apply appears only in the import and one confirm() call')
  const confirmBody = panel.slice(panel.indexOf('function confirm'), panel.indexOf('function retry'))
  assert.equal((confirmBody.match(/applyDailyAssistantCapture/g) ?? []).length, 1, 'apply is only reachable through confirm()')
  assert.match(confirmBody, /if \(!analysis \|\| busy\) return/)
  assert.match(confirmBody, /Resolve or deselect every amber item before saving\./)
})

// 13. Desktop behaviour remains compatible.
test('desktop capture and timeline behaviour remain compatible', () => {
  assert.match(panel, /Today \/ open loops/)
  assert.match(panel, /'capture' \| 'timeline'/)
  assert.match(panel, /min-h-20 w-full/)
  assert.match(panel, /onClick=\{onClose\}/)
  assert.match(panel, /aria-label="Close daily capture"/)
})

// 14. Existing daily-capture contract strings are preserved.
test('existing daily-capture contract strings are preserved', () => {
  for (const value of [
    'Confirm selected',
    'Nothing writes until you review and confirm.',
    'Uploading securely',
    'Try again',
    'min-h-20',
    'safe-area-inset-bottom',
    'localStorage.setItem(draftKey',
    "document.visibilityState === 'hidden'",
    'recorder.start(1000)',
    'MAX_VOICE_SECONDS',
    'Review this note',
    'My day capture',
  ]) {
    assert.ok(panel.includes(value), `panel must preserve "${value}"`)
  }
})

// ── Retry / idempotency ──────────────────────────────────────────────────────

test('transcription retry reuses the preserved audio instead of re-requesting the mic', () => {
  assert.match(panel, /pendingAudioRef\.current = \{ blob, duration \}/)
  assert.match(panel, /function retry\(\) \{\s*if \(failedStep === 'recording'\) \{ void startRecording\(\); return \}/)
  assert.match(panel, /failedStep === 'transcription' && pendingAudioRef\.current/)
})

test('apply retry can never duplicate writes because the RPC finalises the capture once', () => {
  assert.match(panel, /already been finalised/i)
  assert.match(panel, /async function settleFromAppliedCapture\(\)/)
  assert.match(panel, /applied_actions as Record<string, number> \| null \| undefined/)
})

test('starting over from reviewing clears only the unconfirmed capture', () => {
  assert.match(panel, /function startOver\(\) \{\s*setAnalysis\(null\)\s*setText\(''\)/)
  assert.match(panel, /setFailedStep\(null\)\s*setStage\('ready'\)/)
})
