import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const composer = read('../src/components/assistant/GlobalAssistantComposer.tsx')
const assistantPage = read('../src/pages/admin/AssistantPage.tsx')
const actions = read('../src/lib/assistantActions.ts')
const videos = read('../src/lib/assistantVideos.ts')
const workflow = read('../src/pages/admin/ContentWorkflowPage.tsx')
const planner = read('../src/pages/admin/PlannerPage.tsx')
const work = read('../src/pages/admin/MyWorkPage.tsx')

test('assistant sessions are user-scoped and profile changes synchronously clear user state and context refs', () => {
  assert.match(composer, /`\$\{SESSION_KEY_PREFIX\}:\$\{userId\}`/)
  assert.match(assistantPage, /`\$\{SESSION_KEY_PREFIX\}:\$\{userId\}`/)
  const reset = composer.slice(composer.indexOf('if (profileIdRef.current !== profileId)'), composer.indexOf('const speechSupported'))
  for (const token of ['setMessages(loadSession(profileId))', 'setProposal(null)', 'setDebrief(null)', 'workContextRef.current = null', 'clientsRef.current = []', 'staffRef.current = []', 'managementRef.current = null', 'memoryRef.current = []']) assert.match(reset, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(assistantPage, /if \(profileIdRef\.current !== profileId\)[\s\S]*setMessages\(loadSessionMessages\(profileId\)\)[\s\S]*setLocalWorkContext\(null\)/)
})

test('both sends ignore prior-profile responses and always release sending state', () => {
  for (const source of [composer, assistantPage]) {
    assert.match(source, /const sendingProfileId = profileIdRef\.current/)
    assert.match(source, /profileIdRef\.current !== sendingProfileId/)
    assert.match(source, /finally \{/)
  }
})

test('task.assign updates the exact open Planner task and never creates a replacement', () => {
  const assign = composer.slice(composer.indexOf("p.type === 'task.assign'"), composer.indexOf("p.type === 'task.update'"))
  assert.match(assign, /p\.target\?\.type !== 'planner_task'/)
  assert.match(assign, /updateAssistantTask\(\{ taskId: p\.target\.id, action: 'assign'/)
  assert.doesNotMatch(assign, /createAssistantTask/)
  assert.doesNotMatch(assign, /action: 'due'/)
  assert.match(assign, /The due date was not changed; update it separately/)
  assert.match(actions, /current backend cannot apply both atomically/)
  assert.match(actions, /Open the Planner task first so I know exactly which existing task to assign/)
})

test('supported Work board routes supply assistant task context and hydrate notification deep links', () => {
  assert.match(composer, /location\.pathname === '\/admin\/work' \|\| location\.pathname === '\/admin\/my-work'/)
  assert.match(composer, /searchParams\.get\('tab'\) === 'board'/)
  assert.doesNotMatch(composer, /location\.pathname\.startsWith\('\/admin\/planner'\)/)
  assert.match(planner, /getPlannerTaskBoardId\(routeTaskId\)/)
  assert.match(planner, /setDrawerTask\(linkedTask\)/)
  assert.match(planner, /if \(isPlannerHistoryTask\(linkedTask\)\) setWorkView\('history'\)/)
  assert.match(work, /if \(taskId\) next\.set\('id', taskId\)/)
})

test('confirmed actions fail closed and recheck profile/action identity after every awaited write', () => {
  assert.match(composer, /const actionRequestId = \+\+actionRequestRef\.current/)
  assert.match(composer, /Boolean\(applyingProfileId\) && profileIdRef\.current === applyingProfileId && actionRequestRef\.current === actionRequestId/)
  const apply = composer.slice(composer.indexOf('async function applyProposal()'), composer.indexOf('// ── Meeting debrief flow'))
  for (const awaitedWrite of [
    'enqueueBackgroundJob',
    'nudgeBackgroundWorker',
    'createCompanyEvent',
    'logPlannerActivity',
    'proposeScheduleChange',
    'addAssistantMemory',
    'createAssistantTask',
  ]) {
    assert.match(apply, new RegExp(`await ${awaitedWrite}\\([\\s\\S]*?\\n\\s*if \\(!actionIsCurrent\\(\\)\\) return`), `${awaitedWrite} must recheck action identity`)
  }
  assert.match(apply, /catch \(err\) \{\s*if \(actionIsCurrent\(\)\) setProposalError/)
  assert.match(apply, /finally \{\s*if \(actionIsCurrent\(\)\) setApplying\(false\)/)
  const assign = apply.slice(apply.indexOf("p.type === 'task.assign'"), apply.indexOf("p.type === 'task.update'"))
  const update = apply.slice(apply.indexOf("p.type === 'task.update'"), apply.indexOf("p.type === 'video.mark_shot'"))
  for (const taskBranch of [assign, update]) assert.match(taskBranch, /await updateAssistantTask\([\s\S]*?if \(!actionIsCurrent\(\)\) return/)
  const videosBlock = composer.slice(composer.indexOf("p.type === 'video.mark_shot'"), composer.indexOf("} else {", composer.indexOf("p.type === 'video.mark_shot'")))
  assert.match(videosBlock, /if \(!actionIsCurrent\(\)\) return[\s\S]*assistantUpdateVideo[\s\S]*if \(!actionIsCurrent\(\)\) return/)
})

test('profile replacement clears stale action errors and invalidates in-flight actions', () => {
  const reset = composer.slice(composer.indexOf('if (profileIdRef.current !== profileId)'), composer.indexOf('const speechSupported'))
  assert.match(reset, /actionRequestRef\.current \+= 1/)
  assert.match(reset, /setProposalError\(null\)/)
  const apply = composer.slice(composer.indexOf('async function applyProposal()'), composer.indexOf('// ── Meeting debrief flow'))
  assert.doesNotMatch(apply, /catch \(err\) \{\s*setProposalError/)
})

test('meeting debrief analysis and confirmation use unique profile-bound request tokens', () => {
  assert.doesNotMatch(composer, /debriefActiveRef/)
  assert.match(composer, /interface DebriefRequestToken \{[\s\S]*id: number[\s\S]*profileId: string/)
  assert.match(composer, /const token = \{ id: \+\+debriefRequestSeqRef\.current, profileId: requestedProfileId \}/)
  assert.match(composer, /debriefAnalysisRequestRef\.current = token/)
  assert.match(composer, /debriefConfirmationRequestRef\.current = token/)
  assert.match(composer, /return current === token && profileIdRef\.current === token\.profileId/)
})

test('meeting debrief async continuations cannot update another request or profile', () => {
  const recording = composer.slice(composer.indexOf('async function startDebriefRecording()'), composer.indexOf('function stopDebriefRecording()'))
  assert.match(recording, /await navigator\.mediaDevices\.getUserMedia[\s\S]*if \(!debriefRequestIsCurrent\('analysis', requestToken\)\)/)
  assert.match(recording, /catch \{\s*if \(debriefRequestIsCurrent\('analysis', requestToken\)\) setDebriefError/)

  const analysis = composer.slice(composer.indexOf('async function analyseDebrief('), composer.indexOf('async function confirmDebrief()'))
  assert.match(analysis, /await analyseMeetingAudio|await analyseMeetingText/)
  assert.match(analysis, /await analyseMeetingText[\s\S]*if \(!debriefRequestIsCurrent\('analysis', requestToken\)\) return/)
  assert.match(analysis, /if \(debriefRequestIsCurrent\('analysis', requestToken\)\) setDebriefError/)
  assert.match(analysis, /finally \{\s*if \(debriefRequestIsCurrent\('analysis', requestToken\)\)[\s\S]*setDebriefBusy\(false\)/)

  const confirmation = composer.slice(composer.indexOf('async function confirmDebrief()'), composer.indexOf('function closeDebrief()'))
  assert.match(confirmation, /const draft = debrief/)
  assert.match(confirmation, /await applyMeetingDebrief\([\s\S]*if \(!debriefRequestIsCurrent\('confirmation', requestToken\)\) return/)
  assert.match(confirmation, /catch \{\s*if \(debriefRequestIsCurrent\('confirmation', requestToken\)\) setDebriefError/)
  assert.match(confirmation, /finally \{\s*if \(debriefRequestIsCurrent\('confirmation', requestToken\)\)[\s\S]*setDebriefBusy\(false\)/)
})

test('meeting debrief requests are invalidated on profile change, close, restart, new debrief, and unmount', () => {
  const profileReset = composer.slice(composer.indexOf('if (profileIdRef.current !== profileId)'), composer.indexOf('const speechSupported'))
  assert.match(profileReset, /invalidateDebriefRequests\(\)/)
  assert.match(composer, /useEffect\(\(\) => \(\) => \{\s*invalidateDebriefRequests\(\)/)
  for (const functionName of ['closeDebrief', 'startNewDebrief', 'restartDebriefDraft']) {
    const start = composer.indexOf(`function ${functionName}()`)
    const body = composer.slice(start, composer.indexOf('\n  }', start) + 4)
    assert.match(body, /invalidateDebriefRequests\(\)/, `${functionName} must invalidate pending requests first`)
  }
  assert.match(composer, /onClick=\{closeDebrief\}/)
  assert.match(composer, /onClick=\{startNewDebrief\}/)
  assert.match(composer, /onClick=\{restartDebriefDraft\}/)
})

test('Planner publishes plain task identity and clears stale task context on board switch', () => {
  assert.match(planner, /next\.set\('task', task\.title\)/)
  const selectBoard = planner.slice(planner.indexOf('function selectBoard'), planner.indexOf('function refreshActiveBoardTasks'))
  assert.match(selectBoard, /next\.delete\('id'\)/)
  assert.match(selectBoard, /next\.delete\('task'\)/)
  assert.match(selectBoard, /setSearchParams\(next, \{ replace: true \}\)/)
})

test('Content Workflow preserves selected runId and Assistant validates that exact run before preview/write', () => {
  assert.match(workflow, /next\.set\('runId', run\.id\)/)
  assert.match(workflow, /const legacyRunId = searchParams\.get\('run'\)[\s\S]*const runId = searchParams\.get\('runId'\) \?\? legacyRunId/)
  assert.match(workflow, /if \(canonicalize\) setSearchParams/)
  assert.match(composer, /const run = await resolveContentRun\(selectedRunId\)/)
  assert.match(composer, /target: \{ type: 'content_run', id: run\.id, label: run\.name \}/)
  assert.match(videos, /\.eq\('id', runId\)[\s\S]*\.maybeSingle\(\)/)
  assert.doesNotMatch(videos, /order\('run_date'|limit\(1\)|eq\('client_id'/)
})

test('schedule changes clarify before preview when no typed Client Schedule target is open', () => {
  assert.match(composer, /parsed\.type === 'schedule\.propose' && \(!location\.pathname\.startsWith\('\/admin\/client-schedule'\) \|\| !recordId\)/)
  assert.match(composer, /Open the Client Schedule post first so I know exactly which item to change/)
})

test('composer uses visualViewport inset and 44px primary touch targets', () => {
  assert.match(composer, /useVisualViewportBottomInset\(\)/)
  assert.match(composer, /--assistant-viewport-inset/)
  assert.match(composer, /h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-teal/)
  assert.match(composer, /h-11 w-11 items-center justify-center rounded-full border/)
})

test('operation errors are separate and sends use try-finally rather than leaving stale busy state', () => {
  for (const name of ['chatError', 'proposalError', 'debriefError']) assert.match(composer, new RegExp(`const \\[${name}, set${name[0].toUpperCase()}${name.slice(1)}\\]`))
  assert.match(composer, /setProposalError\(null\)/)
  assert.match(composer, /setDebriefError\(null\)/)
  assert.match(composer, /finally \{[\s\S]*setSending\(false\)/)
  assert.match(assistantPage, /finally \{[\s\S]*setIsSending\(false\)/)
})

test('Meta preview uses plain previous-month wording while payload remains backend compatible', () => {
  assert.match(actions, /sync_previous_month/)
  assert.doesNotMatch(actions, /fields: \{ job: 'meta_sync', baseline:/)
  assert.match(composer, /Also sync the previous month/)
  assert.match(composer, /payload: jobType === 'meta_sync' \? \{ baseline: syncPreviousMonth \} : \{\}/)
})

test('action preview hides internal job key, shows target identity, and keeps optional task fields editable', () => {
  assert.match(composer, /key === 'job' \|\| key === 'sync_previous_month'/)
  assert.match(composer, /proposal\.target\.type === 'planner_task' \? 'Task' : 'Content Run'/)
  assert.match(composer, /key === 'assignee' \|\| key === 'due_date'/)
  assert.match(composer, /placeholder=\{key === 'assignee' \|\| key === 'due_date' \? 'Optional'/)
})

test('schedule approval copy reflects manager and admin permissions', () => {
  assert.match(actions, /manager or admin approves them/)
  assert.match(composer, /manager or admin approves it/)
  assert.doesNotMatch(actions, /until an Admin approves/)
})
