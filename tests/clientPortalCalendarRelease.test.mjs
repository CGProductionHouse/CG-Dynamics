import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(
  new URL('../supabase/phase-29a-client-portal-calendar-release.sql', import.meta.url),
  'utf8',
)

test('client calendar RPCs stay narrow, authenticated and ownership-bound', () => {
  assert.match(sql, /security definer/g)
  assert.match(sql, /when public\.is_staff\(\) then p_client_id/)
  assert.match(sql, /else public\.my_client_id\(\)/)
  assert.match(sql, /md\.client_id = c\.allowed_client_id/)
  assert.match(sql, /e\.client_id = c\.allowed_client_id/)
  assert.match(sql, /revoke all on function public\.client_portal_month_ahead_posts\(uuid, date\)/)
  assert.match(sql, /grant execute on function public\.client_portal_month_ahead_events\(uuid, date\)\s+to authenticated/)
})

test('client post status mapping matches canonical production states', () => {
  for (const status of [
    'scheduled_posted',
    'meta_drafts',
    'awaiting_client',
    'ready_review',
    'in_progress',
  ]) {
    assert.ok(sql.includes(`'${status}'`), `maps ${status}`)
  }
  assert.match(sql, /then 'scheduled_posted'/)
  assert.match(sql, /then 'awaiting_approval'/)
  assert.match(sql, /then 'for_review'/)
  assert.match(sql, /then 'in_production'/)
})

test('client event month bounds use the Johannesburg business timezone', () => {
  assert.match(sql, /at time zone 'Africa\/Johannesburg'/)
  assert.match(sql, /e\.event_type in \('shoot', 'content_run', 'client_event'\)/)
  assert.doesNotMatch(sql, /assigned_to|helper|notes|priority|linked_/)
})
