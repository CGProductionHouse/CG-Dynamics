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

test('composer reads recordId from URL (?id=) so in-place task.update works', () => {
  assert.match(composer, /const recordId = searchParams\.get\('reportId'\) \?\? searchParams\.get\('runId'\) \?\? searchParams\.get\('id'\) \?\? ''/)
  assert.match(composer, /if \(recordId\) parts\.push\(`recordId: \$\{recordId\}`\)/)
  assert.match(composer, /updateAssistantTask\(\{ taskId: recordId, action \}\)/)
})

test('composer enqueue idempotency key is user-scoped', () => {
  assert.match(composer, /idempotencyKey: `\$\{profile\?\.id \?\? 'anon'\}:\$\{jobType\}-\$\{today\}/)
})

test('composer debrief close clears the active guard so stale analysis never surfaces', () => {
  assert.match(composer, /if \(!debriefActiveRef\.current\) return/)
  assert.match(composer, /if \(blob\.size > 0 && debriefActiveRef\.current\) void analyseDebrief/)
  // Close resets candidates + guard.
  assert.match(composer, /debriefActiveRef\.current = false; setDebriefOpen\(false\); setDebrief\(null\); setDebriefText\(''\); setDebriefCandidates\(\[\]\)/)
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
