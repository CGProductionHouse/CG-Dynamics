import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Issue #157 — after a successful Microsoft reconciliation apply the page stayed
// scrolled at the bottom and kept showing the completed preview as though it
// were still the active workflow.
//
// Root cause: applyReviewed called prepareSnapshot(snapshot) on the SAME
// snapshot it had just applied, rebuilding the finished preview as live state.

const page = readFileSync(new URL('../src/pages/admin/MicrosoftImportPage.tsx', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n')

const applyFn = page.slice(page.indexOf('async function applyReviewed'), page.indexOf('async function changeTransitionStatus'))
const resetFn = page.slice(page.indexOf('function resetToReadyState'), page.indexOf('function scrollWorkspaceToTop'))

// ── 1. One clear success confirmation ───────────────────────────────────────
test('a successful apply shows one clear confirmation', () => {
  assert.match(applyFn, /setApplyResult\(result\)/)
  assert.match(page, /data-testid="apply-confirmation"/)
  assert.match(page, /role="status" aria-live="polite"/)
  assert.match(page, /Reconciliation applied/)
  // Exactly one confirmation element — it used to be easy to end up with the
  // banner rendered in two places as the layout moved.
  assert.equal((page.match(/data-testid="apply-confirmation"/g) ?? []).length, 1)
})

test('the confirmation sits above the fetch panel so it is seen after scrolling up', () => {
  assert.ok(page.indexOf('data-testid="apply-confirmation"') < page.indexOf('Fetch complete configured sources'),
    'the confirmation must render before the fetch panel')
})

test('the confirmation says where the run went and that nothing auto-starts', () => {
  assert.match(page, /Recent reconciliation runs<\/span> below/)
  assert.match(page, /nothing starts on its own/)
})

// ── 2. The completed preview is cleared ─────────────────────────────────────
test('a successful apply clears the completed preview from the workspace', () => {
  // The bug: the finished snapshot was re-reconciled back into the workspace.
  // Slice from the first statement, not the comment above it — the comment
  // deliberately quotes the old broken call.
  assert.doesNotMatch(
    applyFn.slice(applyFn.indexOf('rememberAppliedPreviewJob(appliedJobId)')),
    /prepareSnapshot/,
    'a clean success must not rebuild the applied snapshot as the active preview',
  )
  assert.match(applyFn, /resetToReadyState\(\)/)
  assert.match(resetFn, /setSnapshot\(null\)/)
  assert.match(resetFn, /setItems\(\[\]\)/)
  assert.match(resetFn, /setJob\(null\)/)
  assert.match(resetFn, /setReviewed\(false\)/)
  assert.match(resetFn, /setApproveRemovals\(false\)/)
  assert.match(resetFn, /setRecovery\(null\)/)
})

// ── 3. Scroll to top ────────────────────────────────────────────────────────
test('a successful apply returns the page to the top', () => {
  assert.match(applyFn, /scrollWorkspaceToTop\(\)/)
  const scroll = page.slice(page.indexOf('function scrollWorkspaceToTop'), page.indexOf('// Resume any in-flight preview job'))
  assert.match(scroll, /window\.scrollTo\(0, 0\)/)
  // On desktop the page scrolls inside AdminLayout's <main>, not the window.
  assert.match(scroll, /if \(main\) main\.scrollTop = 0/)
  // Measured in-browser: behavior:'smooth' did not move the element at all
  // when frames were not being produced (1281.6px -> 1281.6px). Returning to
  // the top is the point of this fix, so it must not depend on a frame.
  const scrollCode = scroll.replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(scrollCode, /behavior: 'smooth'/)
  assert.doesNotMatch(scrollCode, /scrollTo\(\{/)
})

// ── 4. Clean ready state ────────────────────────────────────────────────────
test('the workspace returns to a clean Ready to sync state', () => {
  assert.match(page, /const workspaceReady = !snapshot && !job && !recovery && !loading && !applying/)
  assert.match(page, /data-testid="ready-to-sync"/)
  assert.match(page, /Ready to sync<\/span>/)
})

test('the next fetch action stays available and obvious', () => {
  assert.match(page, /'Preview latest changes'\}<\/button>/)
  assert.match(page, /void previewLatest\(\)/)
})

// ── 5. History is retained ──────────────────────────────────────────────────
test('the completed run is retained in Recent reconciliation runs', () => {
  // loadStatus refreshes `runs`; it must run BEFORE the workspace is cleared so
  // the run is on screen the moment the preview disappears.
  assert.ok(applyFn.indexOf('await loadStatus()') < applyFn.indexOf('resetToReadyState()'),
    'history must be refreshed before the workspace is reset')
  assert.doesNotMatch(resetFn, /setRuns\(/, 'the reset must never clear sync history')
  assert.doesNotMatch(resetFn, /setSelectedRunId\(/, 'the reset must not drop the selected run')
  assert.doesNotMatch(resetFn, /setRunItems\(/)
  assert.doesNotMatch(resetFn, /setApplyResult\(/, 'the reset must not clear the confirmation')
  assert.match(page, /Recent reconciliation runs/)
})

test('failure, conflict and audit history is preserved', () => {
  // A run with errors keeps the preview so the admin can act, and still records
  // the run and its failures.
  assert.match(applyFn, /if \(result\.errors\.length > 0\) \{/)
  const failurePath = applyFn.slice(applyFn.indexOf('if (result.errors.length > 0)'), applyFn.indexOf('Clean success'))
  assert.match(failurePath, /await prepareSnapshot\(snapshot\)/)
  assert.match(failurePath, /setError\(result\.errors\[0\]\)/)
  assert.doesNotMatch(failurePath, /resetToReadyState/, 'a partial failure must not clear the workspace')
  // The failed-change recovery path off Sync history is untouched.
  assert.match(page, /prepareRunRecovery\(selectedRun\.id\)/)
  assert.match(page, /Prepare failed-change recovery/)
})

// ── 6. Refresh does not reopen the completed preview ────────────────────────
test('refreshing does not restore the applied preview as the active workflow', () => {
  assert.match(page, /rememberAppliedPreviewJob\(appliedJobId\)/)
  const resume = page.slice(page.indexOf('const resumeJobEvent'), page.indexOf('async function prepareSnapshot'))
  assert.match(resume, /if \(latest\.job\.jobId === readAppliedPreviewJob\(\)\) return/)
  // The pre-existing completeness guard stays as the second line of defence.
  assert.match(resume, /!latest\.job\.progress\.allRequiredComplete && latest\.job\.status === 'running'/)
})

test('the applied-preview marker is session scoped, not durable', () => {
  // The durable record of a finished run is the row in Sync history; this is
  // only about not re-adopting it as the active workspace in this session.
  assert.match(page, /window\.sessionStorage\.setItem\(APPLIED_PREVIEW_JOB_KEY/)
  assert.doesNotMatch(page, /localStorage\.setItem\(APPLIED_PREVIEW_JOB_KEY/)
  // Storage being unavailable must never break apply.
  const remember = page.slice(page.indexOf('function rememberAppliedPreviewJob'), page.indexOf('function readAppliedPreviewJob'))
  assert.match(remember, /try \{/)
  assert.match(remember, /\} catch \{/)
})

// ── 7. No automatic second sync ─────────────────────────────────────────────
test('a successful apply never starts another sync', () => {
  assert.doesNotMatch(applyFn, /previewLatest\(/, 'apply must not kick off another fetch')
  assert.doesNotMatch(applyFn, /startMicrosoftPreviewJob/)
  assert.doesNotMatch(applyFn, /driveJob/)
  assert.doesNotMatch(resetFn, /previewLatest|startMicrosoftPreviewJob|driveJob/)
})

// ── Existing safety must be untouched ───────────────────────────────────────
test('reconciliation safety and confirmation gates are unchanged', () => {
  assert.match(applyFn, /if \(!snapshot \|\| applying \|\| !reviewed \|\| migrationNeeded\) return/)
  assert.match(applyFn, /currentState\.transitionStatus !== 'active'/)
  assert.match(applyFn, /Preview was not applied/)
  // The reviewed checkbox and removal approval still gate the apply button.
  assert.match(page, /I reviewed the reconciliation preview and approve the safe Microsoft-owned field changes/)
  assert.match(page, /Approve \{removalCount\} source-removal actions/)
  assert.match(page, /disabled=\{!canApply\}/)
})

test('the apply still reports CG-only writes and never writes to Microsoft', () => {
  assert.match(page, /CG Dynamics only\. No Microsoft writes were made\./)
})
