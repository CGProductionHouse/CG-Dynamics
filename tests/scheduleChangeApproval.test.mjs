import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const sql = read('../supabase/migrations/20260731090000_client_schedule_change_approval.sql')
const lib = read('../src/lib/scheduleChangeRequests.ts')

test('staff can only PROPOSE — no direct UPDATE/DELETE policy exists', () => {
  assert.match(sql, /for insert to authenticated\s+with check \(is_staff\(\) and requested_by = auth\.uid\(\) and status = 'pending'\)/)
  // No UPDATE/DELETE *policy* exists (the "for update" row-lock in the RPC is not
  // a policy — a policy grant reads "for <cmd> to <role>").
  assert.doesNotMatch(sql, /for (update|delete) to /i)
})

test('apply + reject are admin-gated SECURITY DEFINER functions', () => {
  for (const fn of ['apply_client_schedule_change_request', 'reject_client_schedule_change_request']) {
    const body = sql.slice(sql.indexOf(`function public.${fn}`))
    assert.match(body, /security definer/)
    assert.match(body, /if not is_admin\(\) then raise exception/)
  }
})

test('apply whitelist never assigns client_id (no cross-client moves)', () => {
  const update = sql.slice(sql.indexOf('update public.monthly_deliverables d set'), sql.indexOf('where d.id = req.deliverable_id'))
  assert.doesNotMatch(update, /client_id\s*=/)
  for (const field of ['scheduled_date', 'due_date', 'production_status', 'assigned_to_name', 'notes']) {
    assert.match(update, new RegExp(`${field}\\s*=`))
  }
})

test('every request, apply and reject writes an audit row to planner_activity_log', () => {
  assert.match(sql, /trg_cscr_audit_insert after insert/)
  assert.match(sql, /'client_schedule_change', new\.deliverable_id, 'requested'/)
  assert.match(sql, /'client_schedule_change', req\.deliverable_id, 'applied'/)
  assert.match(sql, /'client_schedule_change', req\.deliverable_id, 'rejected'/)
})

test('client library proposes via the table and approves/rejects via the RPCs only', () => {
  assert.match(lib, /from\('client_schedule_change_requests'\)\s*\.insert/)
  assert.match(lib, /rpc\('apply_client_schedule_change_request'/)
  assert.match(lib, /rpc\('reject_client_schedule_change_request'/)
  // No direct update of monthly_deliverables from the client library.
  assert.doesNotMatch(lib, /monthly_deliverables/)
})
