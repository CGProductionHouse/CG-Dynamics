import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/20260908140000_meta_incremental_asset_checkpoints.sql')
const worker = read('../supabase/functions/meta-sync-worker/index.ts')
const enqueue = read('../supabase/functions/meta-sync-enqueue/index.ts')
const integration = read('../src/pages/admin/MetaIntegrationPage.tsx')
const status = read('../supabase/functions/meta-connection-status/index.ts')

test('sync items carry an exact asset and explicit workload class', () => {
  assert.match(migration, /asset_id uuid references public\.meta_client_assets/)
  assert.match(migration, /sync_kind in \('historical', 'incremental', 'targeted_backfill'\)/)
  assert.match(enqueue, /clientByAsset\.get\(item\.assetId\) !== item\.clientId/)
  assert.match(enqueue, /asset_id: item\.assetId/)
  assert.match(worker, /item\.asset_id \? linkedAssetQuery\.eq\('id', item\.asset_id\)/)
})

test('per-platform success checkpoint is atomic and lease fenced', () => {
  assert.match(migration, /create table if not exists public\.meta_asset_sync_checkpoints/)
  assert.match(migration, /v_item := public\.meta_sync_require_lease/)
  assert.match(migration, /select public\.meta_sync_checkpoint_item/)
  assert.match(migration, /case when v_success then greatest\(checkpoint\.high_watermark_at, excluded\.high_watermark_at\)/)
  assert.match(worker, /meta_sync_checkpoint_platform_terminal/)
  assert.match(worker, /p_health_state: terminalHealthState/)
})

test('operations UI reports checkpoint absence and never infers a successful refresh', () => {
  assert.match(status, /meta_asset_sync_checkpoints/)
  assert.match(status, /last_attempted_at, last_successful_at/)
  assert.match(integration, /no durable checkpoint recorded/)
  assert.match(integration, /refresh diagnostics unavailable/)
})

test('Meta connection health cannot select another provider as its verified insight', () => {
  assert.match(status, /\.from\('platform_sync_runs'\)[\s\S]*\.in\('platform', \['facebook', 'instagram'\]\)[\s\S]*\.in\('health_state', \['verified', 'verified_partial'\]\)/)
})
