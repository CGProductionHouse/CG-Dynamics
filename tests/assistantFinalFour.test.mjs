import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const sql = read('../supabase/migrations/20260801150000_assistant_meeting_debrief_content_and_reports.sql')
const worker = read('../supabase/functions/background-worker/index.ts')
const debriefFn = read('../supabase/functions/meeting-debrief/index.ts')
const debriefLib = read('../src/lib/meetingDebrief.ts')
const videosLib = read('../src/lib/assistantVideos.ts')
const composer = read('../src/components/assistant/GlobalAssistantComposer.tsx')

// ── Meeting debrief ─────────────────────────────────────────────────────────
test('meeting_debriefs is staff-read-only; only the service role writes; RLS on', () => {
  assert.match(sql, /alter table public\.meeting_debriefs enable row level security/)
  assert.match(sql, /for select to authenticated\s+using \(\(select public\.is_staff\(\)\)\)/)
  assert.match(sql, /revoke all on table public\.meeting_debriefs from public, anon, authenticated/)
  assert.match(sql, /grant insert, select, update on table public\.meeting_debriefs to service_role/)
})

test('apply_meeting_debrief: draft-only, author-or-manager, staff-gated SECURITY DEFINER', () => {
  const body = sql.slice(sql.indexOf('function public.apply_meeting_debrief'))
  assert.match(body, /security definer/)
  assert.match(body, /if not public\.is_staff\(\) then raise exception/)
  assert.match(body, /status <> 'draft' then raise exception/)
  assert.match(body, /created_by <> auth\.uid\(\) and not public\.is_manager\(\)/)
})

test('debrief tasks are CANONICAL planner_tasks with audit + assignee notification; missing due dates stay null', () => {
  const body = sql.slice(sql.indexOf('function public.apply_meeting_debrief'))
  assert.match(body, /insert into public\.planner_tasks/)
  assert.match(body, /'cg_assistant_meeting'/)
  assert.match(body, /insert into public\.planner_activity_log[\s\S]*'assistant_created'/)
  assert.match(body, /insert into public\.notifications/)
  // due date only parsed when a real YYYY-MM-DD was given; otherwise null.
  assert.match(body, /~ '\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$' then \(v_task ->> 'due_date'\)::date else null/)
})

test('debrief notes append to the matched meeting without overwriting existing notes', () => {
  const body = sql.slice(sql.indexOf('function public.apply_meeting_debrief'))
  assert.match(body, /update public\.company_calendar_events\s+set notes = coalesce\(notes,''\) \|\| v_notes_block/)
})

test('edge fn: transcript is untrusted evidence; names resolve only from real directories; no invented due dates', () => {
  assert.match(debriefFn, /untrusted evidence/)
  assert.match(debriefFn, /ONLY names from the provided staff list/i)
  assert.match(debriefFn, /Never invent a due date/i)
  // clients are excluded from the staff directory used for assignment
  assert.match(debriefFn, /neq\('role', 'client'\)/)
})

test('edge fn: applying runs as the signed-in user (auth gate + audit attribution)', () => {
  assert.match(debriefFn, /createClient\(supabaseUrl, anonKey, \{ global: \{ headers: \{ Authorization: authorization \} \} \}\)/)
  assert.match(debriefFn, /rpc\('apply_meeting_debrief'/)
})

test('client lib exposes analyse (audio + text) and apply with edited sections', () => {
  assert.match(debriefLib, /analyseMeetingAudio/)
  assert.match(debriefLib, /analyseMeetingText/)
  assert.match(debriefLib, /applyMeetingDebrief/)
  assert.match(debriefLib, /decisions: input\.decisions/)
  assert.match(debriefLib, /unresolved: input\.unresolved/)
})

// ── Direct video actions ────────────────────────────────────────────────────
test('assistant_update_video reuses the proven debrief transition rules', () => {
  const body = sql.slice(sql.indexOf('function public.assistant_update_video'))
  assert.match(body, /if not public\.is_staff\(\) then raise exception/)
  assert.match(body, /security definer/)
  // shot honours footage link → ready_to_edit
  assert.match(body, /onedrive_footage_url,''\) ~\* '\^https:\/\/' then 'ready_to_edit'/)
  // moving detaches the deliverable and requires re-confirmation
  assert.match(body, /deliverable_id = null/)
  assert.match(body, /Client Schedule link requires confirmation/)
  // in-production videos are protected
  assert.match(body, /not in \('not_shot','shot'\) then raise exception/)
  // audited
  assert.match(body, /'assistant_video_' \|\| p_action/)
})

test('composer executes video actions directly (no routing for supported actions)', () => {
  assert.match(composer, /assistantUpdateVideo\(\{ runId, videoNumber: n, action: 'shot' \}\)/)
  assert.match(composer, /'move_to_month' : 'move_next_month'/)
  // only calendar.cancel still routes
  assert.doesNotMatch(composer, /admin\/content\?tab=runs/)
})

test('video lib resolves the run deterministically and asks instead of guessing', () => {
  assert.match(videosLib, /resolveContentRun/)
  assert.match(videosLib, /return null/)
})

// ── Real background handlers ────────────────────────────────────────────────
test('worker meta_sync drives the REAL batch engine (no placeholder)', () => {
  assert.match(worker, /runMetaSyncBatch/)
  assert.match(worker, /meta_sync_batches/)
  assert.match(worker, /meta-sync-worker/)
  assert.match(worker, /x-worker-secret/)
})

test('worker meta_sync is idempotent per job (retry resumes the same batch)', () => {
  assert.match(worker, /contains\('summary', \{ background_job_id: job\.id \}\)/)
})

test('worker meta_sync returns truthful outcomes: pending → retry, all-failed → error', () => {
  assert.match(worker, /still processing[\s\S]*Retrying/)
  assert.match(worker, /completed === 0/)
  assert.match(worker, /Meta sync failed for all items/)
  assert.match(worker, /itemsCompleted: completed/)
  assert.match(worker, /itemsFailed: failed/)
})

test('worker report_prep calls the real idempotent RPC and exposes progress', () => {
  assert.match(worker, /rpc\('prepare_monthly_reports'/)
  assert.match(worker, /update_background_job_progress/)
})

test('prepare_monthly_reports is idempotent and only runs for completed months', () => {
  const body = sql.slice(sql.indexOf('function public.prepare_monthly_reports'))
  assert.match(body, /Report prep only runs for a completed month/)
  assert.match(body, /v_reused := v_reused \+ 1/)
  assert.match(body, /where active = true/)
})

test('prepare_monthly_reports allows staff and the headless worker, never anon users', () => {
  const body = sql.slice(sql.indexOf('function public.prepare_monthly_reports'))
  assert.match(body, /if not public\.is_staff\(\) and auth\.uid\(\) is not null then raise exception/)
  assert.match(sql, /revoke all on function public\.prepare_monthly_reports\(date\) from public, anon/)
})

// ── One editable confirmation before any write ──────────────────────────────
test('composer debrief flow shows one editable confirmation and applies only on confirm', () => {
  assert.match(composer, /Meeting debrief/)
  assert.match(composer, /Background notes/)
  assert.match(composer, /Decisions \(one per line\)/)
  assert.match(composer, /Unresolved \(one per line\)/)
  assert.match(composer, /confirmDebrief/)
  assert.match(composer, /Nothing is saved until you confirm/)
})
