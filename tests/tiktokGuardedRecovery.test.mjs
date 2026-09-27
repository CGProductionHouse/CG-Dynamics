import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const shared = read('../supabase/functions/_shared/tiktok.ts')
const sync = read('../supabase/functions/tiktok-sync/index.ts')
const recovery = read('../supabase/functions/tiktok-recover-connection/index.ts')

test('silent refresh uses the current TikTok token endpoint and persists rotated refresh tokens', () => {
  assert.match(shared, /https:\/\/open\.tiktokapis\.com\/v2\/oauth\/token\//)
  assert.doesNotMatch(shared, /\/v2\/oauth\/token\/refresh\//)
  assert.match(shared, /refresh_token: body\.refresh_token \?\? refreshToken/)
})

test('refresh verifies exact provider identity before token persistence', () => {
  const identityCheck = shared.indexOf("if (expectedOpenId && body.open_id !== expectedOpenId)")
  const tokenUpdate = shared.indexOf(".update({", identityCheck)
  assert.ok(identityCheck > 0)
  assert.ok(tokenUpdate > identityCheck)
  assert.match(sync, /refreshTiktokToken\(sb, connectionId, tokenRows\.refresh_token, exactConnection\.tiktok_open_id\)/)
})

test('recovery defaults to preflight and exposes no token values', () => {
  assert.match(recovery, /body\.mode === 'apply' \? 'apply' : 'preflight'/)
  assert.match(recovery, /refreshTokenPresent: true/)
  assert.doesNotMatch(recovery, /refresh_token:\s*tokenRow\.refresh_token/)
  assert.doesNotMatch(recovery, /access_token/)
})

test('recovery is exact-client, exact-connection, exact-provider-identity and needs_reauth only', () => {
  assert.match(recovery, /\.eq\('id', connectionId\)/)
  assert.match(recovery, /\.eq\('client_id', clientId\)/)
  assert.match(recovery, /\.eq\('tiktok_open_id', expectedOpenId\)/)
  assert.match(recovery, /connection\.status !== 'needs_reauth'/)
  assert.match(recovery, /\.eq\('status', 'needs_reauth'\)/)
})

test('apply restores connected only after successful silent refresh', () => {
  const refreshCall = recovery.indexOf('await refreshTiktokToken')
  const connectedUpdate = recovery.indexOf("status: 'connected'")
  assert.ok(refreshCall > 0)
  assert.ok(connectedUpdate > refreshCall)
  assert.match(recovery, /last_error: null/)
})


test('guarded recovery accepts only the configured internal worker token as the server-to-server alternative', () => {
  assert.match(recovery, /WORKER_INTERNAL_TOKEN/)
  assert.match(recovery, /X-Internal-Worker-Token/)
  assert.match(recovery, /configuredWorkerToken\.length >= 32 && suppliedWorkerToken === configuredWorkerToken/)
  assert.match(recovery, /if \(!isInternalWorker\) \{[\s\S]*auth\.getUser\(bearer\)/)
})

test('background worker recovers an exact needs_reauth connection before normal TikTok sync', () => {
  const worker = read('../supabase/functions/background-worker/index.ts')
  const recoveryCall = worker.indexOf('/functions/v1/tiktok-recover-connection')
  const syncCall = worker.indexOf('/functions/v1/tiktok-sync', recoveryCall)
  assert.ok(recoveryCall > 0)
  assert.ok(syncCall > recoveryCall)
  assert.match(worker, /\.eq\('id', connectionId\)[\s\S]*\.eq\('client_id', clientId\)[\s\S]*\.eq\('tiktok_open_id', tiktokOpenId\)/)
  assert.match(worker, /exactConnection\.status === 'needs_reauth'/)
  assert.match(worker, /expectedConnectionId: connectionId/)
  assert.match(worker, /expectedTiktokOpenId: tiktokOpenId/)
  assert.match(worker, /mode: 'apply'/)
})
