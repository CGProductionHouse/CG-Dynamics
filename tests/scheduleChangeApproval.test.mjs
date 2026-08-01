import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const originalSql = read('../supabase/migrations/20260731090000_client_schedule_change_approval.sql')
const sql = read('../supabase/migrations/20260801180000_client_schedule_acceptance_hardening.sql')
const lib = read('../src/lib/scheduleChangeRequests.ts')
const page = read('../src/pages/admin/ClientSchedulePage.tsx')

test('staff broad row update is removed and assigned status RPC denies other fields', () => {
  assert.match(sql, /drop policy if exists "monthly_deliverables: staff production status update"/)
  const body = sql.slice(sql.indexOf('function public.update_assigned_client_schedule_status'), sql.indexOf('function public.save_client_schedule_deliverable'))
  assert.match(body, /actor\.role not in \('staff','team'\)/)
  assert.match(body, /id = auth\.uid\(\) and is_active is true/)
  assert.match(body, /is_primary := target\.assigned_to_user_id = auth\.uid\(\)/)
  assert.match(body, /is_helper := name_matches = 1 and exists/)
  assert.match(body, /Schedule item is not assigned to this user/)
  assert.match(body, /set production_status = p_production_status/)
  for (const denied of ['scheduled_date =', 'client_id =', 'assigned_to_name =']) assert.doesNotMatch(body, new RegExp(denied))
})

test('apply + reject are manager/admin-gated SECURITY DEFINER functions', () => {
  for (const fn of ['apply_client_schedule_change_request', 'reject_client_schedule_change_request']) {
    const body = sql.slice(sql.indexOf(`function public.${fn}`))
    assert.match(body, /security definer/)
    assert.match(body, /if not public\.is_manager\(\).*then raise exception/s)
  }
})

test('approval whitelist never assigns client_id (no cross-client moves)', () => {
  const update = sql.slice(sql.indexOf('update public.monthly_deliverables d set'), sql.indexOf('where d.id = req.deliverable_id'))
  assert.doesNotMatch(update, /client_id\s*=/)
  for (const field of ['scheduled_date', 'due_date', 'production_status', 'assigned_to_name', 'notes']) {
    assert.match(update, new RegExp(`${field}\\s*=`))
  }
})

test('every request, apply and reject writes an audit row to planner_activity_log', () => {
  assert.match(originalSql, /trg_cscr_audit_insert after insert/)
  assert.match(originalSql, /'client_schedule_change', new\.deliverable_id, 'requested'/)
  assert.match(sql, /'client_schedule_change', req\.deliverable_id, 'applied'/)
  assert.match(sql, /'client_schedule_change', req\.deliverable_id, 'rejected'/)
})

test('client library proposes via the table and approves/rejects via the RPCs only', () => {
  assert.match(lib, /from\('client_schedule_change_requests'\)\s*\.insert/)
  assert.match(lib, /rpc\('apply_client_schedule_change_request'/)
  assert.match(lib, /rpc\('reject_client_schedule_change_request'/)
  // monthly_deliverables appears only as a read relationship for current values.
  assert.doesNotMatch(lib, /from\(['"]monthly_deliverables['"]\).*\.update/s)
  assert.match(lib, /\.eq\('requested_by', authData\.user\.id\)/)
})

test('drawer save is one guarded atomic RPC with stale checking and before/after audit', () => {
  const body = sql.slice(sql.indexOf('function public.save_client_schedule_deliverable'), sql.indexOf('-- Compare every proposed field'))
  assert.match(body, /if not public\.is_manager\(\)/)
  assert.match(body, /for update/)
  assert.match(body, /target\.updated_at is distinct from p_expected_updated_at/)
  assert.match(body, /jsonb_build_object\('before', before_row, 'after', to_jsonb\(target\)\)/)
  assert.match(body, /assignee_count <> 1/)
  assert.match(body, /assigned_to_user_id = assignee_id/)
  assert.match(body, /assigned_to_name = assignee_name/)
  assert.match(lib, /rpc\('save_client_schedule_deliverable'/)
  assert.doesNotMatch(page, /updateMonthlyDeliverable(Status|Schedule|Core)/)
})

test('name changes atomically resolve or clear the canonical schedule assignee', () => {
  const staffStatus = sql.slice(sql.indexOf('function public.update_assigned_client_schedule_status'), sql.indexOf('function public.save_client_schedule_deliverable'))
  const apply = sql.slice(sql.indexOf('function public.apply_client_schedule_change_request'), sql.indexOf('function public.reject_client_schedule_change_request'))
  assert.match(staffStatus, /is_primary := target\.assigned_to_user_id = auth\.uid\(\)/)
  assert.match(staffStatus, /target\.assigned_to_user_id is null[\s\S]*name_matches = 1/)
  assert.match(staffStatus, /is_helper := name_matches = 1 and exists/)
  assert.match(staffStatus, /unnest\(coalesce\(target\.helper_names, '\{\}'::text\[\]\)\)/)
  assert.match(staffStatus, /role in \('admin','manager','staff','team'\)/)
  assert.match(staffStatus, /if not \(is_primary or is_helper\)/)
  assert.match(apply, /if req\.change \? 'assigned_to_name'/)
  assert.match(apply, /assigned_to_user_id = case when req\.change \? 'assigned_to_name' then assignee_id/)
  assert.match(apply, /assigned_to_name = case when req\.change \? 'assigned_to_name' then assignee_name/)
})

test('new proposals capture a server baseline and stale approvals conflict', () => {
  assert.match(sql, /trigger trg_cscr_capture_baseline before insert/)
  assert.match(sql, /new\.target_updated_at := target\.updated_at/)
  assert.match(sql, /jsonb_object_keys\(req\.change\)/)
  assert.match(sql, /Schedule item changed since this request/)
})

test('Client Schedule exposes pending review and requester outcome UI', () => {
  for (const label of ['Schedule change review', 'Pending review', 'My requests', 'Current:', 'Proposed:', 'Requested by:', 'Reason:', 'Review note', 'Approve', 'Reject', 'Refresh requests']) {
    assert.match(page, new RegExp(label))
  }
  assert.match(page, /Loading schedule requests/)
  assert.match(page, /No requests are waiting for review/)
  assert.match(page, /Request approved and schedule updated/)
  assert.match(page, /min-h-11/)
})

test('drawer role gate gives staff production status only', () => {
  assert.match(page, /canManage \? SIMPLIFIED_STATUS_OPTIONS : SIMPLIFIED_STATUS_OPTIONS\.slice\(0, 4\)/)
  assert.match(page, /Staff can update production status only/)
  assert.match(page, /updateAssignedScheduleStatus/)
})
