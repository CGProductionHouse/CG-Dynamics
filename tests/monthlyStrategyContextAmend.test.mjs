import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const migration = readFileSync('supabase/migrations/20260923193000_monthly_strategy_context_amend.sql', 'utf8')
const functionBody = migration.slice(migration.indexOf('create or replace function public.amend_monthly_client_strategy_with_context('))

test('atomic strategy context amendment preserves canonical guards', () => {
  assert.match(functionBody, /resolve_monthly_strategy_actor\(p_actor_profile_id\)/)
  assert.match(functionBody, /assert_monthly_strategy_input\(p_client_id, p_strategy_month, p_strategy_data\)/)
  assert.match(functionBody, /jsonb_typeof\(p_seed_context\).*object/s)
  assert.match(functionBody, /p_seed_context ->> 'client_id'.*p_client_id::text/s)
  assert.match(functionBody, /p_seed_context ->> 'strategy_month'.*p_strategy_month::text/s)
  assert.match(functionBody, /for update/i)
  assert.match(functionBody, /Strategy version conflict/)
})

test('strategy and seed context are written atomically with durable revision evidence', () => {
  assert.match(functionBody, /set strategy_data = p_strategy_data,\s*seed_context = p_seed_context/s)
  assert.match(functionBody, /version = version \+ 1/)
  assert.match(functionBody, /monthly_client_strategy_revisions/)
  assert.match(functionBody, /before_seed_context/)
  assert.match(functionBody, /after_seed_context/)
  assert.match(functionBody, /idempotency_key = p_idempotency_key/)
  assert.match(functionBody, /Idempotency key reused with a different request/)
})

test('new RPC is not exposed to anon and remains available to authenticated staff and service role', () => {
  assert.match(migration, /revoke all on function public\.amend_monthly_client_strategy_with_context[\s\S]*from public, anon;/)
  assert.match(migration, /grant execute on function public\.amend_monthly_client_strategy_with_context[\s\S]*to authenticated, service_role;/)
})
