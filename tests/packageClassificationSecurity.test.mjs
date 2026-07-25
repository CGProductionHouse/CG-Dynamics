import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL(
    '../supabase/migrations/20260725170354_package_classification_client_guard.sql',
    import.meta.url,
  ),
  'utf8',
)

test('package classification preserves manager-only authorization', () => {
  assert.match(migration, /if not public\.is_manager\(\) then/)
  assert.match(migration, /Manager access required for package classification/)
  assert.match(
    migration,
    /revoke all on function public\.admin_set_package_classification[\s\S]*from public, anon, authenticated;/,
  )
  assert.match(
    migration,
    /grant execute on function public\.admin_set_package_classification[\s\S]*to authenticated;/,
  )
})

test('valid linking locks both records and compares their client ownership', () => {
  assert.match(
    migration,
    /from public\.command_centre_tasks[\s\S]*where id = p_task_id[\s\S]*for update;/,
  )
  assert.match(
    migration,
    /from public\.monthly_deliverables[\s\S]*where id = p_deliverable_id[\s\S]*for update;/,
  )
  assert.match(
    migration,
    /v_task\.client_id is distinct from v_deliverable\.client_id/,
  )
})

test('cross-client links are rejected before the task update', () => {
  const rejection = migration.indexOf(
    "raise exception 'Task and deliverable must belong to the same client'",
  )
  const update = migration.indexOf('update public.command_centre_tasks')

  assert.ok(rejection >= 0, 'same-client rejection is present')
  assert.ok(update > rejection, 'cross-client validation runs before mutation')
})

test('a deliverable cannot be incompatibly linked to another task', () => {
  assert.match(
    migration,
    /where deliverable_id = p_deliverable_id[\s\S]*and id <> p_task_id/,
  )
  assert.match(
    migration,
    /Deliverable is already linked to another task/,
  )
})

test('monthly deliverables remain canonical and are never mutated', () => {
  assert.doesNotMatch(
    migration,
    /(insert\s+into|update|delete\s+from)\s+public\.monthly_deliverables/i,
  )
})
