import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const queue = read('../supabase/functions/tiktok-connection-queue/index.ts')
const start = read('../supabase/functions/tiktok-oauth-start/index.ts')
const callback = read('../supabase/functions/tiktok-oauth-callback/index.ts')
const status = read('../supabase/functions/tiktok-connection-status/index.ts')
const page = read('../src/pages/admin/TikTokIntegrationPage.tsx')
const migration = read('../supabase/migrations/20260923143000_tiktok_exact_account_identity.sql')

describe('TikTok active-client connection queue', () => {
  test('server-side discovery pages every truth scan and excludes inactive clients', () => {
    assert.match(queue, /fetchAllRows/)
    assert.match(queue, /\.from\('clients'\)\.select\('id, name'\)\.eq\('active', true\)/)
    assert.match(queue, /\.from\('tiktok_connections'\)/)
    assert.match(queue, /\.from\('tiktok_connection_tokens'\)/)
  })

  test('queue and OAuth require an active admin or manager', () => {
    for (const source of [queue, start]) {
      assert.match(source, /select\('role, is_active'\)/)
      assert.match(source, /!profile\?\.is_active/)
      assert.match(source, /\['admin', 'manager'\]\.includes\(profile\.role\)/)
    }
    assert.match(start, /\.eq\('active', true\)/)
    assert.match(callback, /\.eq\('id', clientId\)\.eq\('active', true\)/)
    assert.match(callback, /consumedState\.user_id/)
  })

  test('callback binds provider identity to the state-owned client and rejects cross-client reuse', () => {
    assert.match(callback, /const clientId = consumedState\.client_id/)
    assert.match(callback, /const verifiedOpenId = openId \?\? tiktokUser\?\.open_id/)
    assert.match(callback, /openId !== tiktokUser\.open_id/)
    assert.match(callback, /\.eq\('tiktok_open_id', verifiedOpenId\)/)
    assert.match(callback, /\.neq\('client_id', clientId\)/)
    assert.match(migration, /unique index if not exists tiktok_connections_exact_provider_account_idx/)
  })

  test('callback returns the exact client to the queue without exposing provider IDs', () => {
    assert.match(callback, /url\.searchParams\.set\('client', clientId\)/)
    assert.doesNotMatch(page, /tiktokOpenId/)
    assert.match(page, /searchParams\.get\('client'\)/)
  })

  test('reconnect-required rows remain visible while sync authority stays connected-only', () => {
    assert.match(status, /\.eq\('client_id', body\.clientId\)/)
    assert.match(status, /\.order\('last_connected_at'/)
    assert.doesNotMatch(status, /resolveTiktokConnectionForClient/)
    assert.match(page, /Reconnect with TikTok/)
    assert.match(page, /refresh_pending/)
  })

  test('keeps the rollout read-only and never implements password collection', () => {
    assert.match(page, /never asks for or stores a TikTok password/)
    assert.match(page, /Publishing is unavailable in this rollout/)
    assert.match(page, /does not request video\.publish or video\.upload/)
    assert.doesNotMatch(page, /type="password"/)
  })
})
