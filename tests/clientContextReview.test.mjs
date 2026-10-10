import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const sql = read('../supabase/migrations/20261010163723_review_client_context_updates.sql')
const data = read('../src/lib/clientContextReview.ts')
const panel = read('../src/components/strategy/ClientContextReview.tsx')
const strategy = read('../src/pages/admin/MonthlyStrategyPage.tsx')

test('review RPC is exact-client, manager-only, state-fenced and auditable', () => {
  assert.match(sql, /add column if not exists reviewed_by_profile_id uuid references public\.profiles\(id\)/)
  assert.match(sql, /add column if not exists reviewed_at timestamptz/)
  assert.match(sql, /security definer\s+set search_path = ''/)
  assert.match(sql, /if auth\.uid\(\) is null then raise exception/)
  assert.match(sql, /profile\.id = auth\.uid\(\)[\s\S]*profile\.is_active[\s\S]*profile\.role in \('admin', 'manager'\)/)
  assert.match(sql, /p_expected_state is distinct from 'unreviewed'/)
  assert.match(sql, /p_decision not in \('incorporated', 'rejected'\)/)
  assert.match(sql, /update_row\.id = p_update_id and update_row\.client_id = p_client_id\s+for update/)
  assert.match(sql, /where id = v_update\.id and client_id = p_client_id and review_state = p_expected_state/)
  assert.match(sql, /reviewed_by_profile_id = v_actor\.id,[\s\S]*reviewed_at = now\(\)/)
  assert.match(sql, /revoke all on function public\.review_client_context_update\(uuid, uuid, text, text\)[\s\S]*from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.review_client_context_update\(uuid, uuid, text, text\)[\s\S]*to authenticated/)
  assert.doesNotMatch(sql, /monthly_client_strategies|monthly_deliverables|background_jobs/)
})

test('the manager panel reads only exact pending context and sends no client or actor override', () => {
  assert.match(data, /from\('client_context_updates'\)[\s\S]*\.eq\('client_id', clientId\)\.eq\('review_state', 'unreviewed'\)/)
  assert.match(data, /\.limit\(20\)/)
  assert.match(data, /rpc\('review_client_context_update', \{\s*p_client_id: clientId,\s*p_update_id: updateId,\s*p_expected_state: 'unreviewed',\s*p_decision: decision/)
  assert.match(data, /receipt\.client_id !== clientId \|\| receipt\.update_id !== updateId/)
  assert.match(strategy, /canReviewClientContext = isAdmin \|\| profile\?\.role === 'manager'/)
  assert.match(strategy, /client && !loading && canReviewClientContext && <ClientContextReview key=\{clientId\} clientId=\{clientId\}/)
  assert.match(panel, /<details key=\{update\.id\}/)
  assert.match(panel, /reviewClientContextUpdate\(clientId, update\.id, decision\)/)
  assert.doesNotMatch(panel, /client_portal|published|approve/i)
})
