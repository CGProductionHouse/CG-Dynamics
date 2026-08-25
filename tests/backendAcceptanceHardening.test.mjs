import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const sql = read('../supabase/migrations/20260801170000_backend_acceptance_hardening.sql')
const backgroundWorker = read('../supabase/functions/background-worker/index.ts')
const metaWorker = read('../supabase/functions/meta-sync-worker/index.ts')
const assistantChat = read('../supabase/functions/cg-assistant-chat/index.ts')
const meetingDebrief = read('../supabase/functions/meeting-debrief/index.ts')

function functionBody(name, nextMarker) {
  const start = sql.indexOf(`function public.${name}`)
  assert.notEqual(start, -1, `${name} must exist`)
  const end = nextMarker ? sql.indexOf(nextMarker, start) : sql.length
  return sql.slice(start, end === -1 ? sql.length : end)
}

test('assistant memory is active-workforce-only with explicit privileges', () => {
  assert.match(sql, /assistant_memory: active staff own rows[\s\S]*user_id = auth\.uid\(\)[\s\S]*profile\.is_active[\s\S]*profile\.role in \('admin', 'manager', 'staff', 'team'\)/)
  assert.match(sql, /revoke all on table public\.assistant_memory from public, anon, authenticated/)
  assert.match(sql, /grant select, insert, update, delete on table public\.assistant_memory to authenticated/)
})

test('assistant task RPCs enforce active profile and visible-board rules', () => {
  for (const name of ['create_assistant_task', 'update_assistant_task']) {
    const body = functionBody(name, name === 'create_assistant_task' ? '-- Assignment changes' : 'revoke all on function public.create_assistant_task')
    assert.match(body, /profile\.is_active/)
    assert.match(body, /board\.visibility in \('public_internal', 'staff'\)/)
    assert.match(body, /board\.visibility = 'admin_only' and v_actor\.role = 'admin'/)
  }
})

test('assistant assignments are canonical and manager-only', () => {
  const create = functionBody('create_assistant_task', '-- Assignment changes')
  const update = functionBody('update_assistant_task', 'revoke all on function public.create_assistant_task')
  assert.match(create, /v_actor\.role not in \('admin', 'manager'\)/)
  assert.match(create, /set_planner_task_assignees_internal/)
  assert.match(update, /set_planner_task_assignees_internal/)
  assert.match(update, /v_has_canonical_assignees/)
  assert.match(update, /assignment\.profile_id = auth\.uid\(\)/)
})

test('assistant completion uses canonical done status and is idempotent without archiving', () => {
  const update = functionBody('update_assistant_task', 'revoke all on function public.create_assistant_task')
  assert.match(update, /v_task\.status = 'done'[\s\S]*return v_task/)
  assert.match(update, /update_planner_task_status\(v_task\.id, 'done'\)/)
  assert.doesNotMatch(update, /set\s+archived_at\s*=/i)
})

test('meeting apply and report prep require active manager authority', () => {
  const apply = functionBody('apply_meeting_debrief', 'revoke all on function public.apply_meeting_debrief')
  const reports = functionBody('prepare_monthly_reports', 'revoke all on function public.prepare_monthly_reports')
  assert.match(apply, /profile\.is_active[\s\S]*profile\.role in \('admin', 'manager'\)/)
  assert.match(apply, /update public\.company_calendar_events/)
  assert.match(apply, /set_planner_task_assignees_internal/)
  assert.match(reports, /auth\.role\(\) is distinct from 'service_role' and not public\.is_active_planner_manager\(\)/)
})

test('durable queue definitions are committed, allowlisted, leased, and service-role transitioned', () => {
  for (const name of ['enqueue_background_job', 'claim_next_background_job', 'update_background_job_progress', 'complete_background_job', 'fail_background_job', 'defer_background_job']) {
    assert.match(sql, new RegExp(`create or replace function public\\.${name}\\(`))
  }
  const enqueue = functionBody('enqueue_background_job', 'create or replace function public.claim_next_background_job')
  assert.match(enqueue, /profile\.is_active[\s\S]*profile\.role in \('admin', 'manager'\)/)
  assert.match(enqueue, /p_job_type not in \('meta_sync', 'report_prep'\)/)
  assert.match(sql, /where job\.status = 'running'[\s\S]*job\.locked_at < now\(\) - interval '5 minutes'/)
  assert.match(sql, /for update skip locked/i)
  for (const name of ['claim_next_background_job', 'update_background_job_progress', 'complete_background_job', 'fail_background_job', 'defer_background_job']) {
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\([^;]+\\) to service_role`))
  }
  for (const name of ['update_background_job_progress', 'complete_background_job', 'fail_background_job', 'defer_background_job']) {
    const body = functionBody(name, name === 'defer_background_job' ? 'revoke all on function public.enqueue_background_job' : undefined)
    assert.match(body, /p_locked_by text/)
    assert.match(body, /locked_by = btrim\(p_locked_by\)/)
    assert.match(body, /Lease owner required/)
  }
  const defer = functionBody('defer_background_job', 'revoke all on function public.enqueue_background_job')
  assert.match(defer, /attempts = greatest\(0, job\.attempts - 1\)/)
  assert.match(defer, /status = 'queued'/)
})

test('terminal job notifications use truthful outcomes and safe staff destinations', () => {
  const claim = functionBody('claim_next_background_job', 'drop function if exists public.update_background_job_progress')
  const complete = functionBody('complete_background_job', 'create or replace function public.fail_background_job')
  const fail = functionBody('fail_background_job', 'revoke all on function public.enqueue_background_job')
  assert.match(complete, /insert into public\.notifications\(user_id, type, title, body, entity_type, entity_id, link\)/)
  assert.match(fail, /insert into public\.notifications\(user_id, type, title, body, entity_type, entity_id, link\)/)
  assert.match(complete, /job finished successfully/)
  assert.match(complete, /'\/admin\/integrations\/meta'/)
  assert.match(complete, /'\/admin\/reports'/)
  assert.match(fail, /job failed after '[\s\S]*v_job\.attempts/)
  assert.match(fail, /if v_job\.status = 'failed'/)
  assert.match(claim, /for v_failed_job in[\s\S]*where job\.status = 'running'[\s\S]*job\.attempts >= job\.max_attempts[\s\S]*returning job\.\*/)
  assert.match(claim, /insert into public\.notifications\(user_id, type, title, body, entity_type, entity_id, link\)/)
  assert.match(claim, /worker lease expired/)
  assert.match(claim, /and job\.attempts < job\.max_attempts/)
})

test('background worker fails closed and checks every queue transition RPC', () => {
  assert.match(backgroundWorker, /throw new Error\(`Unsupported background job type:/)
  assert.match(backgroundWorker, /completeError[\s\S]*throw new Error/)
  assert.match(backgroundWorker, /failError[\s\S]*status: 500/)
  assert.match(backgroundWorker, /updateJobProgress[\s\S]*if \(error\) throw new Error/)
  assert.match(backgroundWorker, /p_locked_by: worker/g)
  assert.match(backgroundWorker, /defer_background_job/)
})

test('Meta worker checkpoints safe cursors and resumes both platforms within its deadline', () => {
  assert.match(sql, /add column if not exists facebook_next_cursor text/)
  assert.match(sql, /add column if not exists instagram_next_cursor text/)
  assert.match(sql, /facebook_sync_state in \('pending', 'facts_pending', 'complete', 'failed', 'not_applicable'\)/)
  assert.match(sql, /facebook_next_cursor !~ '\[\[:cntrl:\]\]'/)
  assert.match(sql, /returning item\.[\s\S]*item\.facebook_next_cursor[\s\S]*item\.instagram_sync_state/)
  assert.match(sql, /item\.attempts >= 3 and item\.facebook_sync_state not in \('complete', 'failed', 'not_applicable'\) then 'failed'/)
  assert.match(metaWorker, /META_COLLECTION_PAGE_CAP = 25/)
  assert.match(metaWorker, /while \(pagesFetched < META_COLLECTION_PAGE_CAP\)/)
  assert.match(metaWorker, /invocationDeadline/)
  assert.match(metaWorker, /remainingMs < MIN_PAGE_REQUEST_BUDGET_MS \+ PAGE_FETCH_RESERVE_MS/)
  assert.match(metaWorker, /requestTimeoutMs/)
  assert.match(metaWorker, /requestUrl\.searchParams\.set\('after', nextCursor\)/)
  assert.match(metaWorker, /safePagingCursor\(page\.paging\?\.cursors\?\.after\)/)
  assert.match(metaWorker, /await processPage[\s\S]*await checkpoint\(candidateCursor, !nextUrl, pagePostsSynced\)/)
  assert.match(metaWorker, /fetchMetaCollection\([\s\S]*Facebook posts fetch/)
  assert.match(metaWorker, /fetchMetaCollection\([\s\S]*Instagram media fetch/)
  assert.match(metaWorker, /facebookCursor,[\s\S]*'Facebook posts fetch'/)
  assert.match(metaWorker, /instagramCursor,[\s\S]*'Instagram media fetch'/)
  assert.match(metaWorker, /complete \? 'facts_pending' : 'pending'/)
  assert.match(metaWorker, /providerPaging\.facebook/)
  assert.match(metaWorker, /providerPaging\.instagram/)
  assert.match(metaWorker, /RetryableIncompleteError/)
  assert.match(metaWorker, /e instanceof RetryableIncompleteError && \(item\.attempts < 3 \|\| isMetaRateLimitError/)
  assert.match(metaWorker, /itemStatus = 'queued'/)
  assert.match(metaWorker, /Incomplete pagination exhausted 3 bounded attempts/)
  assert.match(metaWorker, /assertWorkBudget\(invocationDeadline, 'Facebook post upserts'\)/)
  assert.match(metaWorker, /assertWorkBudget\(invocationDeadline, 'Instagram post upserts'\)/)
  assert.match(metaWorker, /assertWorkBudget\(invocationDeadline, 'Facebook account facts'\)/)
  assert.match(metaWorker, /assertWorkBudget\(invocationDeadline, 'Instagram account facts'\)/)
  assert.match(metaWorker, /!TERMINAL_META_STATES\.has\(facebookState\) \|\| !TERMINAL_META_STATES\.has\(instagramState\)/)
})

test('service-role Edge Functions reject inactive profiles and manual Meta sync is manager-only', () => {
  assert.match(assistantChat, /select\('role, is_active'\)/)
  assert.match(assistantChat, /profile\?\.is_active !== true/)
  assert.match(meetingDebrief, /select\('role, is_active'\)/)
  assert.match(meetingDebrief, /profile\?\.is_active !== true/)
  assert.match(metaWorker, /profile\?\.is_active === true && \['admin', 'manager'\]\.includes\(profile\.role\)/)
})
