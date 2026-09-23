import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const sync = read('../supabase/functions/tiktok-sync/index.ts')
const queue = read('../supabase/functions/tiktok-connection-queue/index.ts')
const page = read('../src/pages/admin/TikTokIntegrationPage.tsx')

const { classifyTiktokConnectionRecovery } = await import('../supabase/functions/_shared/tiktokFreshness.ts')

const recoveryState = overrides => classifyTiktokConnectionRecovery({
  connectionStatus: 'connected',
  missingScopes: [],
  tokenPresent: true,
  tokenExpired: true,
  tokenRefreshable: true,
  ...overrides,
})

describe('TikTok failed-refresh recovery', () => {
  test('keeps an expired refreshable connection pending before durable failure evidence', () => {
    assert.equal(recoveryState({}), 'refresh_pending')
  })

  test('requires reconnect after the exact connection records failed recovery', () => {
    assert.equal(recoveryState({ connectionStatus: 'needs_reauth' }), 'reconnect_required')
    assert.match(queue, /classifyTiktokConnectionRecovery/)
    assert.match(queue, /state === 'reconnect_required'/)
  })

  test('persists only a safe exact-client reconnect marker after provider rejection', () => {
    assert.match(sync, /status: 'needs_reauth'/)
    assert.match(sync, /Stored TikTok refresh recovery failed\. Reconnect this exact account through TikTok OAuth\./)
    assert.match(sync, /\.eq\('id', connectionId\)[\s\S]*\.eq\('client_id', body\.clientId\)[\s\S]*\.eq\('status', 'connected'\)/)
    assert.doesNotMatch(sync, /tokenRows\.refresh_token[^\n]*console/)
  })

  test('leaves transport failures retryable and preserves canonical exact-client OAuth', () => {
    assert.match(sync, /TikTok token refresh could not reach the provider/)
    assert.match(page, /Reconnect with TikTok/)
    assert.match(page, /startTiktokOAuth\(item\.clientId\)/)
  })
})
