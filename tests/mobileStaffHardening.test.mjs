import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const sql = read('../supabase/migrations/20260801160000_assistant_hardening_notifications_and_rls.sql')
const cscrMigration = read('../supabase/migrations/20260731090000_client_schedule_change_approval.sql')
const commandCentre = read('../src/lib/commandCentre.ts')
const composer = read('../src/components/assistant/GlobalAssistantComposer.tsx')
const taskDrawer = read('../src/components/operations/TaskDetailDrawer.tsx')
const opsHub = read('../src/pages/admin/OpsHubPage.tsx')
const cgHub = read('../src/pages/admin/CgHubPage.tsx')
const myWork = read('../src/pages/admin/MyWorkPage.tsx')
const plannerPage = read('../src/pages/admin/PlannerPage.tsx')
const clientSchedulePage = read('../src/pages/admin/ClientSchedulePage.tsx')
const contentWorkflow = read('../src/pages/admin/ContentWorkflowPage.tsx')
const contentGuideline = read('../src/pages/admin/contentGuideline.tsx')
const commandCentrePage = read('../src/pages/admin/CommandCentrePage.tsx')
const companyCalendar = read('../src/pages/admin/CompanyCalendarPage.tsx')
const mobileViewport = read('../src/lib/mobileViewport.ts')
const indexCss = read('../src/index.css')

// ── Migration: schedule change-request notifications ─────────────────────────

test('proposal trigger notifies admins AND audits (not just audits)', () => {
  assert.match(sql, /insert into public\.notifications[\s\S]*select p\.id, 'schedule_change_proposed'[\s\S]*from public\.profiles p[\s\S]*where p\.role = 'admin'/)
  assert.match(sql, /'client_schedule_change', new\.deliverable_id, 'requested'/)
})

test('apply/reject RPCs notify the requester with an outcome', () => {
  const apply = sql.slice(sql.indexOf('function public.apply_client_schedule_change_request'))
  const reject = sql.slice(sql.indexOf('function public.reject_client_schedule_change_request'))
  assert.match(apply, /req\.requested_by, 'schedule_change_applied'/)
  assert.match(apply, /was approved and applied/)
  assert.match(reject, /req\.requested_by, 'schedule_change_rejected'/)
  assert.match(reject, /was declined/)
})

test('apply/reject are still admin-gated SECURITY DEFINER with grants re-applied', () => {
  assert.match(sql, /grant execute on function public\.apply_client_schedule_change_request\(uuid, text\) to authenticated/)
  assert.match(sql, /grant execute on function public\.reject_client_schedule_change_request\(uuid, text\) to authenticated/)
  for (const fn of ['apply_client_schedule_change_request', 'reject_client_schedule_change_request']) {
    const body = sql.slice(sql.indexOf(`function public.${fn}`))
    assert.match(body, /security definer/)
    assert.match(body, /if not is_admin\(\) then raise exception/)
  }
})

// ── Migration: debrief RLS author-or-manager (no staff-wide read) ─────────────

test('meeting_debriefs + content_run_debriefs SELECT are author-or-manager only', () => {
  assert.match(sql, /drop policy if exists "meeting_debriefs: staff select" on public\.meeting_debriefs/)
  assert.match(sql, /create policy "meeting_debriefs: author or manager"[\s\S]*using \(created_by = auth\.uid\(\) or public\.is_manager\(\)\)/)
  assert.match(sql, /drop policy if exists "content_run_debriefs: staff select" on public\.content_run_debriefs/)
  assert.match(sql, /create policy "content_run_debriefs: author or manager"[\s\S]*using \(created_by = auth\.uid\(\) or public\.is_manager\(\)\)/)
  // No *create* of a staff-wide select policy survives in the new migration.
  assert.doesNotMatch(sql, /create policy "meeting_debriefs: staff select"/)
  assert.doesNotMatch(sql, /create policy "content_run_debriefs: staff select"/)
})

test('content_run_debriefs staff-wide select is dropped and replaced by the new migration', () => {
  const runDebriefSql = read('../supabase/phase-30a-content-run-voice-debrief.sql')
  // The original phase-30a file ships the bug (staff-wide read)…
  assert.match(runDebriefSql, /create policy "content_run_debriefs: staff select"[\s\S]*using \(\(select public\.is_staff\(\)\)\)/)
  // …and the hardening migration drops exactly that policy before tightening.
  assert.match(sql, /drop policy if exists "content_run_debriefs: staff select" on public\.content_run_debriefs/)
})

// ── Migration: assistant block sets status + canonical multi-assignment ───────

test('assistant block sets status=blocked so blocked tasks surface on boards', () => {
  const body = sql.slice(sql.indexOf('function public.update_assistant_task'))
  assert.match(body, /p_action = 'block' then/)
  assert.match(body, /set status = 'blocked', notes = coalesce\(notes,''\) \|\| E'\\n\[BLOCKED\] /)
})

test('assignee gate honours canonical planner_task_assignees OR legacy name', () => {
  const body = sql.slice(sql.indexOf('function public.update_assistant_task'))
  assert.match(body, /is_assignee := exists \(select 1 from public\.planner_task_assignees a where a\.task_id = t\.id and a\.profile_id = auth\.uid\(\)\)/)
  assert.match(body, /t\.assigned_to_name is not null and lower\(t\.assigned_to_name\) = lower\(coalesce\(actor_name,''\)\)/)
  assert.match(body, /p_action in \('complete','comment','block'\) and not \(is_manager\(\) or is_assignee\) then raise exception/)
})

// ── Frontend: request state ordering (approved/scheduled precedes assigned) ───

test('requestStateFromTask: scheduled/approved precede assigned, done/blocked close', () => {
  const fn = commandCentre.slice(commandCentre.indexOf('export function requestStateFromTask'))
  assert.ok(fn.indexOf("if (task.status === 'done' || task.status === 'blocked') return 'closed'") > -1)
  assert.ok(fn.indexOf("if (task.package_action && task.deliverable_id) return 'scheduled'") < fn.indexOf("if (task.package_action) return 'approved'"))
  assert.ok(fn.indexOf("if (task.package_action) return 'approved'") < fn.indexOf("if (task.assigned_to_user_id || task.assigned_to_name) return 'assigned'"))
})

test('TaskDetailDrawer renders request state from requestStateFromTask, not hardcoded priority', () => {
  assert.match(taskDrawer, /requestStateFromTask, requestStateLabel/)
  assert.match(taskDrawer, /requestStateLabel\(requestStateFromTask\(task\)\)/)
  assert.doesNotMatch(taskDrawer, /task\.priority === 'client_request' \? 'captured' : 'closed'/)
})

// ── Frontend: My Work blocked visibility + silent failures ────────────────────

test('OpsHub My Work surfaces blocked tasks between Waiting and No Due Date', () => {
  assert.match(opsHub, /const blocked = useMemo\(\(\) => myTasks\.filter\(t => t\.status === 'blocked'\)/)
  assert.match(opsHub, /Blocked \(\$\{blocked\.length\}\)/)
  assert.match(opsHub, /tasks=\{blocked\} color="text-red-300"/)
})

test('My Work video queue + content runs render errors instead of silently hiding', () => {
  assert.match(myWork, /if \(videos\.length === 0 && !loadError\) return null/)
  assert.match(myWork, /Could not load your video queue: \{loadError\}/)
  assert.match(myWork, /if \(runs\.length === 0 && !loadError\) return null/)
  assert.match(myWork, /Could not load your content runs: \{loadError\}/)
})

// ── Frontend: CgHub best-effort errors + quick-add message lifecycle ──────────

test('CgHub surfaces Content Runs/videos best-effort errors into loadErrors', () => {
  assert.match(cgHub, /bestEffortErrors\.length > 0\) \{\s*setLoadErrors\(current => \[\.\.\.current, \.\.\.bestEffortErrors\]\)/)
  assert.match(cgHub, /\.filter\(\(e\): e is string => Boolean\(e\)\)/)
  assert.match(cgHub, /\{loadErrors\.length > 0 &&/)
  assert.match(cgHub, /loadErrors\.map\(error => <p key=\{error\}/)
})

test('CgHub quick-add success message auto-clears after 4s', () => {
  assert.match(cgHub, /setQuickMessage\('Task added to Daily Tasks\.'\)\s*window\.setTimeout\(\(\) => setQuickMessage\(null\), 4000\)/)
})

// ── Frontend: Content Workflow status change does not full-reload ─────────────

test('setRunStatus refreshes runs only — no full loadAll() skeleton flash', () => {
  const fn = contentWorkflow.slice(contentWorkflow.indexOf('async function refreshRunsOnly'), contentWorkflow.indexOf('async function addExtraShot'))
  assert.match(fn, /listRuns\(\)/)
  assert.match(fn, /setRuns\(result\.data\)/)
  assert.doesNotMatch(fn, /loadAll\(\)/)
})

test('ShootMode accepts + renders an error prop and Content Workflow wires it', () => {
  assert.match(contentGuideline, /error: string \| null/)
  assert.match(contentGuideline, /\{error && <p className="rounded-lg border border-red-400\/25 bg-red-400\/10 px-3 py-2 text-sm text-red-200">\{error\}<\/p>\}/)
  assert.match(contentWorkflow, /error=\{cardError\}/)
  assert.match(contentWorkflow, /setShootMode\(false\); setCardError\(null\)/)
})

// ── Frontend: composer recordId + idempotency + debrief guard ─────────────────

test('composer uses typed Planner task context for in-place task updates', () => {
  assert.match(composer, /const onPlannerBoard = \(location\.pathname === '\/admin\/work' \|\| location\.pathname === '\/admin\/my-work'\) && searchParams\.get\('tab'\) === 'board'/)
  assert.match(composer, /const plannerTaskId = onPlannerBoard \? \(searchParams\.get\('id'\) \?\? ''\) : ''/)
  assert.match(composer, /if \(plannerTaskId\) parts\.push\(`plannerTaskId: \$\{plannerTaskId\}`\)/)
  assert.match(composer, /updateAssistantTask\(\{ taskId: p\.target\.id, action \}\)/)
})

test('composer enqueue idempotency key is user-scoped', () => {
  assert.match(composer, /idempotencyKey: `\$\{applyingProfileId\}:\$\{jobType\}-\$\{today\}/)
})

test('composer debrief requests are profile-bound and invalidated on close', () => {
  assert.match(composer, /const token = \{ id: \+\+debriefRequestSeqRef\.current, profileId: requestedProfileId \}/)
  assert.match(composer, /return current === token && profileIdRef\.current === token\.profileId/)
  assert.match(composer, /if \(blob\.size > 0 && debriefRequestIsCurrent\('analysis', requestToken\)\) \{\s*void analyseDebrief\(\{ audio: blob, durationSeconds/)
  assert.match(composer, /function closeDebrief\(\) \{\s*invalidateDebriefRequests\(\)/)
})

test('composer keeps the widest debrief candidate set so the meeting select never collapses', () => {
  assert.match(composer, /if \(res\.data\.candidates\.length > 0 && !input\.eventId\) setDebriefCandidates\(res\.data\.candidates\)/)
  assert.match(composer, /debriefCandidates\.map\(c =>/)
})

test('composer success message is truthful about assignee notification', () => {
  assert.match(composer, /\? ' \(assignees notified\)' : ' — some assignee names could not be matched'/)
  assert.match(composer, /created on the board\$\{notificationNote\}/)
})

// ── Frontend: recordId URL wiring on Planner + Client Schedule ────────────────

test('Planner openTask/closeTask set/clear ?id= so the composer can act on the record', () => {
  assert.match(plannerPage, /next\.set\('id', task\.id\)/)
  assert.match(plannerPage, /next\.delete\('id'\)/)
  assert.match(plannerPage, /setSearchParams\(next, \{ replace: true \}\)/)
})

test('Client Schedule openDeliverable/closeDeliverable set/clear ?id=', () => {
  assert.match(clientSchedulePage, /params\.set\('id', item\.id\)/)
  assert.match(clientSchedulePage, /params\.delete\('id'\)/)
  assert.match(clientSchedulePage, /onClose=\{closeDeliverable\}/)
})

// ── Frontend: mobile keyboard overlap — fixed drawer save bars track the viewport ──

test('mobileViewport hook tracks visualViewport keyboard inset and returns 0 on desktop', () => {
  assert.match(mobileViewport, /window\.visualViewport/)
  assert.match(mobileViewport, /vv\.addEventListener\('resize', update\)/)
  assert.match(mobileViewport, /window\.innerHeight - vv\.height/)
  assert.match(mobileViewport, /keyboardSpace/)
})

test('fixed drawer save bars pad bottom by the keyboard inset', () => {
  assert.match(taskDrawer, /keyboardInset = useVisualViewportBottomInset\(\)/)
  assert.match(taskDrawer, /paddingBottom: keyboardInset > 0 \? `calc\(0\.75rem \+ \$\{keyboardInset\}px\)` : undefined/)
  assert.match(clientSchedulePage, /keyboardInset > 0 \? `calc\(1rem \+ \$\{keyboardInset\}px\)` : undefined/)
  assert.match(companyCalendar, /keyboardInset > 0 \? `calc\(1rem \+ \$\{keyboardInset\}px\)` : undefined/)
  assert.match(commandCentrePage, /keyboardInset > 0 \? `calc\(1rem \+ \$\{keyboardInset\}px\)` : undefined/)
})

// ── Frontend: composer mobile input zoom + width overflow ────────────────────

test('composer inputs/textareas sit at ≥16px on mobile so iOS does not auto-zoom on focus', () => {
  assert.match(indexCss, /@media \(max-width: 640px\)/)
  assert.match(indexCss, /\[data-assistant-composer\] input[\s\S]*font-size: 16px/)
  assert.match(indexCss, /\[data-assistant-composer\] textarea[\s\S]*font-size: 16px/)
  assert.match(composer, /data-assistant-composer/)
})

test('composer textarea can shrink below its placeholder width so the bar fits the viewport', () => {
  assert.match(composer, /min-h-\[4\.5rem\] min-w-0 flex-1 resize-none overflow-y-hidden/)
})

test('composer bar respects left/right safe-area insets on mobile while desktop is unchanged', () => {
  assert.match(composer, /pl-\[max\(0\.5rem,env\(safe-area-inset-left\)\)\]/)
  assert.match(composer, /pr-\[max\(0\.5rem,env\(safe-area-inset-right\)\)\]/)
  assert.match(composer, /md:inset-x-auto md:right-5/)
  assert.match(composer, /md:px-0/)
})

// ── Frontend: composer mobile initial-state simplification ───────────────────

test('mobile idle shows exactly two primary actions before any interaction', () => {
  assert.match(composer, /What do you need\?/)
  assert.match(composer, /Record my update/)
  assert.match(composer, /Sort me out for today/)
  assert.match(composer, /grid grid-cols-2 gap-1\.5/)
  assert.match(composer, /messages\.length === 0 && !sending && !mobileSuggestionAreaHidden && \(/)
})

test('secondary suggestions are hidden behind the More toggle, not on the idle surface', () => {
  assert.match(composer, /moreOpen \?/)
  assert.match(composer, /setMoreOpen\(true\)/)
  assert.match(composer, /setMoreOpen\(false\)/)
  assert.match(composer, />More<\/button>/)
})

test('typing hides every mobile suggestion', () => {
  const start = composer.indexOf('const mobileSuggestionAreaHidden')
  const expr = composer.slice(start, composer.indexOf('applying', start))
  assert.match(expr, /input\.trim\(\) !== ''/)
})

test('recording, transcribing, reviewing and applying all hide the suggestions', () => {
  const start = composer.indexOf('const mobileSuggestionAreaHidden')
  const expr = composer.slice(start, composer.indexOf('applying', start) + 'applying'.length)
  for (const term of ['sending', 'listening', 'dailyCaptureOpen', 'debriefOpen', 'debriefRecording', 'debriefBusy', 'Boolean(debrief)', 'Boolean(proposal)', 'applying']) {
    assert.ok(expr.includes(term), `expected mobileSuggestionAreaHidden to include ${term}`)
  }
})

test('entering any non-idle state collapses More so idle restores the two primary actions', () => {
  assert.match(composer, /const mobileSuggestionAreaHidden =/)
  assert.match(composer, /onChange=\{event => \{ setInput\(event\.target\.value\); setMoreOpen\(false\) \}\}/)
  assert.match(composer, /async function send\(text: string\) \{[\s\S]*?setMoreOpen\(false\)/)
  assert.match(composer, /function startDailyCapture\(\) \{[\s\S]*?setMoreOpen\(false\)/)
  assert.match(composer, /function startNewDebrief\(\) \{[\s\S]*?setMoreOpen\(false\)/)
  assert.match(composer, /function startListening\(\) \{[\s\S]*?setMoreOpen\(false\)/)
  assert.match(composer, /function newChat\(\) \{[\s\S]*?setMoreOpen\(false\)/)
  assert.match(composer, /messages\.length === 0 && !sending && !mobileSuggestionAreaHidden && \(/)
})

test('mobile context renders as one compact line', () => {
  assert.match(composer, /const mobileContextLabel = clientId/)
  assert.match(composer, /clientsRef\.current\.find\(c => c\.id === clientId\)\?\.name \?\? pageLabel/)
  assert.match(composer, />Context: \{mobileContextLabel\}</)
})

test('desktop suggestion behaviour and header remain available', () => {
  assert.match(composer, /hidden space-y-2 py-2 md:block/)
  assert.match(composer, /Ask anything about your work, clients or this page\./)
  assert.match(composer, /md:block">Knows: \{pageLabel\}/)
})

test('existing suggestion actions stay wired to the same handlers', () => {
  assert.match(composer, /onClick=\{startDailyCapture\}/)
  assert.match(composer, /onClick=\{\(\) => void send\('Sort me out for today'\)\}/)
  assert.match(composer, /onClick=\{\(\) => void send\(s\)\}/)
  const chipUses = composer.match(/\{starterChips\}/g) ?? []
  assert.equal(chipUses.length, 2, 'starter chips should be shared by mobile More and desktop, not duplicated')
})

// ── Frontend: composer mobile control cleanup ────────────────────────────────

test('empty mobile composer shows exactly one primary microphone action', () => {
  assert.match(composer, /const mobileMicPrimary = speechSupported && !sending && \(listening \|\| input\.trim\(\) === ''\)/)
  assert.match(composer, /const mobileSendPrimary = sending \|\| \(!listening && input\.trim\(\) !== ''\)/)
  assert.match(composer, /<div className="flex shrink-0 items-center md:hidden">/)
  assert.match(composer, /hidden shrink-0 items-center gap-1 md:flex/)
  assert.match(composer, /border border-transparent bg-brand-teal text-black font-black/)
  // Empty input → mic is primary, send is NOT rendered: exactly one of the two
  // branches can win inside the single mobile primary slot.
  assert.match(composer, /mobileSendPrimary \? \([\s\S]*?\) : mobileMicPrimary \? \([\s\S]*?\) : null/)
  assert.doesNotMatch(composer, /mobileSendPrimary[\s\S]{0,80}input\.trim\(\) === ''/)
})

test('text input switches the primary action to send', () => {
  assert.match(composer, /sending \? 'bg-brand-teal\/70' : 'bg-brand-teal hover:bg-brand-teal\/90'/)
  assert.match(composer, /\{sending \? '[^']*' : '↑'\}/)
  assert.match(composer, /mobileSendPrimary \? \([\s\S]*?\) : mobileMicPrimary \? \([\s\S]*?\) : null/)
  // Typed input → mic drops out (mobileMicPrimary requires empty input or
  // listening), send becomes the only primary control.
  assert.match(composer, /mobileMicPrimary = speechSupported && !sending && \(listening \|\| input\.trim\(\) === ''\)/)
  assert.match(composer, /mobileSendPrimary = sending \|\| \(!listening && input\.trim\(\) !== ''\)/)
})

test('duplicate send is blocked while sending', () => {
  assert.match(composer, /disabled=\{sending \|\| listening \|\| !input\.trim\(\)\}/)
  assert.match(composer, /if \(!clean \|\| sendingRef\.current \|\| sending \|\| applying \|\| !sendingProfileId\) return/)
})

test('duplicate microphone start is blocked while listening', () => {
  assert.match(composer, /const listeningRef = useRef\(false\)/)
  assert.match(composer, /function startListening\(\) \{\s*if \(listeningRef\.current\) return/)
  assert.match(composer, /function toggleMic\(\) \{\s*if \(listeningRef\.current\) stopListening\(\)\s*else startListening\(\)/)
  assert.match(composer, /recognition\.onend = \(\) => \{[\s\S]*voiceManualStopRef\.current[\s\S]*recognitionRestartTimerRef\.current = window\.setTimeout/)
})

test('controls stay within the mobile composer width', () => {
  assert.match(composer, /min-h-\[4\.5rem\] min-w-0 flex-1 resize-none overflow-y-hidden/)
  assert.match(composer, /h-11 w-11 shrink-0/)
  assert.match(composer, /mobileSendPrimary \? \([\s\S]*?\) : mobileMicPrimary \? \([\s\S]*?\) : null/)
  const mobilePrimaryDivs = composer.match(/<div className="flex shrink-0 items-center md:hidden">/g) ?? []
  assert.equal(mobilePrimaryDivs.length, 1, 'exactly one mobile right-control container')
  // The whole bar is width-constrained inside the 375px viewport: fixed inset-x-0
  // wrapper + safe-area side padding + a w-full inner column (no min-w).
  assert.match(composer, /fixed inset-x-0 bottom-\[calc\(3\.5rem\+env\(safe-area-inset-bottom\)/)
  assert.match(composer, /pl-\[max\(0\.5rem,env\(safe-area-inset-left\)\)\] pr-\[max\(0\.5rem,env\(safe-area-inset-right\)\)\]/)
  assert.match(composer, /pointer-events-auto mx-auto w-full max-w-2xl md:mx-0 md:w-\[26rem\]/)
})

test('all main controls meet the 44px tap-target requirement', () => {
  const fixed44 = composer.match(/h-11 w-11/g) ?? []
  assert.equal(fixed44.length, 5, 'action, mobile mic/send and desktop mic/send are all exactly 44px')
  assert.match(composer, /min-h-11 min-w-11 rounded-md px-1 text-\[10px\]/)
})

test('accessible labels and focus states exist on the composer controls', () => {
  assert.match(composer, /aria-label="Add action"/)
  assert.match(composer, /aria-expanded=\{plusOpen\}/)
  assert.match(composer, /aria-label=\{listening \? 'Stop voice input' : 'Start voice input'\}/)
  assert.match(composer, /aria-pressed=\{listening\}/)
  assert.match(composer, /aria-label="Send message"/)
  assert.match(composer, /aria-label="Ask CG Assistant"/)
  assert.match(composer, /focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal/)
})

test('composer exposes the exact spec accessible names', () => {
  for (const name of ['Add action', 'Start voice input', 'Stop voice input', 'Send message']) {
    assert.ok(composer.includes(name), `composer must expose accessible name "${name}"`)
  }
})

test('active voice state exposes an explicit stop label', () => {
  assert.match(composer, /aria-label=\{listening \? 'Stop voice input' : 'Start voice input'\}/)
  assert.match(composer, /animate-pulse[\s\S]*?bg-red-400\/15 text-red-200/)
})

test('desktop composer controls remain available', () => {
  assert.match(composer, /onClick=\{\(\) => setMicLang\(l => \(l === 'en-ZA' \? 'af-ZA' : 'en-ZA'\)\)\}/)
  assert.match(composer, /\{micLang === 'en-ZA' \? 'EN' : 'AF'\}/)
  assert.match(composer, /hidden shrink-0 items-center gap-1 md:flex/)
  assert.match(composer, /className="hidden h-11 w-11 shrink-0/)
})

test('existing send, voice and action handlers stay wired', () => {
  assert.match(composer, /onSubmit=\{handleSubmit\}/)
  assert.match(composer, /function handleSubmit\(event: FormEvent<HTMLFormElement>\) \{\s*event\.preventDefault\(\)\s*void send\(input\)/)
  assert.match(composer, /onClick=\{toggleMic\}/)
  assert.match(composer, /recognition\.start\(\)/)
  assert.match(composer, /onClick=\{\(\) => setPlusOpen\(value => !value\)\}/)
  assert.match(composer, /onClick=\{\(\) => \{ attachRef\.current\?\.click\(\) \}\}/)
})
