import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const migration = read('../supabase/migrations/20260909160000_content_run_closeout_tracking.sql')
const index = read('../supabase/functions/cg-dynamics-mcp/index.ts')
const catalog = read('../supabase/functions/cg-dynamics-mcp/toolCatalog.ts')

test('closeout persistence has nullable UUID idempotency with a non-null partial unique index', () => {
  assert.match(migration, /idempotency_key uuid,/)
  assert.match(migration, /create unique index if not exists content_run_closeouts_idempotency_key_idx[\s\S]*?\(idempotency_key\)[\s\S]*?where idempotency_key is not null/)
  assert.match(migration, /idempotency_key = excluded\.idempotency_key/)
  assert.match(migration, /idempotency_key = coalesce\(p_idempotency_key, idempotency_key\)/)
})

test('closeout manager access uses the canonical active role helper, never mail capability metadata', () => {
  assert.match(migration, /public\.is_active_planner_manager\(\)/)
  assert.doesNotMatch(migration, /mail_scope|company_mail_manager/)
  assert.match(migration, /and role in \('admin', 'manager', 'staff', 'team'\)/)
  assert.match(migration, /v_actor_role not in \('admin', 'manager'\)/)
  assert.match(migration, /grant execute on function public\.get_content_run_closeout\(uuid, uuid\) to service_role/)
  assert.doesNotMatch(migration, /grant execute on function public\.get_content_run_closeout[\s\S]*?to authenticated/)
  assert.match(migration, /Closeout access denied/)
  assert.match(migration, /Closeout update denied/)
  assert.match(migration, /Closeout upload update denied/)
})

test('only verified mapped-folder evidence can resolve a closeout', () => {
  assert.match(migration, /closed_at = case when excluded\.upload_status = 'verified' then now\(\) else null end/)
  assert.match(migration, /closed_at = case when p_upload_status = 'verified' then now\(\) else null end/)
  assert.match(catalog, /caller cannot supply or promote status\/evidence/)
  assert.match(catalog, /staff self-report remains UNVERIFIED/i)
})

test('content-run plan reads one exact run and exact-client canonical planning structures', () => {
  assert.match(index, /\.from\('content_runs'\)[\s\S]*?\.eq\('id', runId\)/)
  assert.match(index, /\.from\('content_guidelines'\)[\s\S]*?\.eq\('content_run_id', runId\)[\s\S]*?\.eq\('client_id', run\.client_id\)/)
  assert.match(index, /\.from\('content_run_items'\)[\s\S]*?\.eq\('run_id', runId\)/)
  assert.match(index, /\.from\('content_guide_ideas'\)[\s\S]*?\.eq\('content_guideline_id', guideline\.id\)[\s\S]*?\.eq\('client_id', run\.client_id\)/)
  assert.match(index, /Content Run has no exact client assigned/)
  assert.doesNotMatch(index, /fuzzy.*content.run/i)
})

test('bootstrap directs the assistant to retrieve rather than retype the canonical plan', () => {
  assert.match(index, /use get_content_run_plan to retrieve the canonical shot list/)
  assert.match(index, /Never ask staff to recreate a plan already in Dynamics/)
})

test('MCP passes its exact authenticated profile into service-only closeout actions', () => {
  assert.match(index, /rpc\('get_content_run_closeout',[\s\S]*?p_actor_profile_id: staff\.profileId/)
  assert.match(index, /rpc\('close_content_run',[\s\S]*?p_actor_profile_id: staff\.profileId/)
  assert.match(index, /rpc\('update_closeout_upload_status',[\s\S]*?p_actor_profile_id: staff\.profileId/)
})
