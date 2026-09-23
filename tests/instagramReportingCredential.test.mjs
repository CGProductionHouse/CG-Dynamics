import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { encryptInstagramAccessToken } from '../supabase/functions/_shared/instagramTokenEncryption.ts'
import { resolveInstagramReportingCredential } from '../supabase/functions/_shared/instagramReportingCredential.ts'

const clientId = '123e4567-e89b-42d3-a456-426614174000'
const otherClientId = '223e4567-e89b-42d3-a456-426614174000'
const assetId = '323e4567-e89b-42d3-a456-426614174000'
const connectionId = '423e4567-e89b-42d3-a456-426614174000'
const accountId = '998877665544'
const keyVersion = 'v1'
const keyBase64 = btoa(String.fromCharCode(...Uint8Array.from({ length: 32 }, (_, i) => i)))
const now = new Date('2026-09-23T10:00:00.000Z')

async function fixture(overrides = {}) {
  const encrypted = await encryptInstagramAccessToken({
    accessToken: 'standalone-provider-secret', keyBase64,
    context: { clientId, instagramAccountId: accountId, keyVersion },
  })
  const asset = {
    id: assetId, clientId, instagramAccountId: accountId,
    instagramConnectionId: connectionId, facebookPageId: null,
    ...overrides.asset,
  }
  const connection = {
    id: connectionId, client_id: clientId, instagram_account_id: accountId,
    status: 'connected', confirmed_asset_id: assetId,
    ...overrides.connection,
  }
  const token = {
    ciphertext_base64: encrypted.ciphertextBase64,
    iv_base64: encrypted.ivBase64,
    encryption_version: encrypted.encryptionVersion,
    key_version: encrypted.keyVersion,
    token_expires_at: '2026-10-23T10:00:00.000Z',
    ...overrides.token,
  }
  return {
    asset,
    metaConnectionId: '523e4567-e89b-42d3-a456-426614174000',
    metaBaseUrl: 'https://graph.facebook.com/v24.0', metaApiVersion: 'v24.0',
    metaUserToken: 'meta-user-token', pageToken: null,
    loadStandalone: async () => ({ connection, token }),
    encryptionKeyBase64: overrides.encryptionKeyBase64 ?? keyBase64,
    supportedKeyVersion: overrides.supportedKeyVersion ?? keyVersion,
    instagramGraphVersion: 'v24.0', now,
  }
}

test('standalone route decrypts only the exact reviewed client/account/asset binding', async () => {
  const credential = await resolveInstagramReportingCredential(await fixture())
  assert.equal(credential.route, 'standalone_instagram')
  assert.equal(credential.token, 'standalone-provider-secret')
  assert.equal(credential.connectionId, connectionId)
  assert.equal(credential.baseUrl, 'https://graph.instagram.com/v24.0')
})

test('Page-linked Instagram remains preferred and never loads the standalone credential', async () => {
  let loaded = false
  const input = await fixture({ asset: { facebookPageId: '112233' } })
  input.pageToken = 'page-token'
  input.loadStandalone = async () => { loaded = true; throw new Error('must not run') }
  const credential = await resolveInstagramReportingCredential(input)
  assert.equal(credential.route, 'page_linked')
  assert.equal(credential.token, 'page-token')
  assert.equal(loaded, false)
})

for (const [name, overrides, code] of [
  ['cross-client mismatch', { connection: { client_id: otherClientId } }, 'client_mismatch'],
  ['account mismatch', { connection: { instagram_account_id: '112233445566' } }, 'account_mismatch'],
  ['review binding mismatch', { connection: { confirmed_asset_id: null } }, 'review_binding_invalid'],
  ['missing encrypted token', { token: { ciphertext_base64: null } }, 'encrypted_token_missing'],
  ['unsupported key version', { supportedKeyVersion: 'v2' }, 'key_version_unsupported'],
  ['expired token', { token: { token_expires_at: '2026-09-22T10:00:00.000Z' } }, 'token_expired'],
]) {
  test(`standalone route fails closed on ${name}`, async () => {
    await assert.rejects(resolveInstagramReportingCredential(await fixture(overrides)), error => error.code === code)
  })
}

test('wrong key/AAD failure is safe and never leaks credential material', async () => {
  const badKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(255)))
  await assert.rejects(resolveInstagramReportingCredential(await fixture({ encryptionKeyBase64: badKey })), error => {
    assert.equal(error.code, 'credential_authentication_failed')
    assert.doesNotMatch(error.message, /standalone-provider-secret|ciphertext|additional data|AAD/i)
    return true
  })
})

test('worker keeps Facebook on Meta/Page credentials and records platform-scoped Instagram failure checkpoints', () => {
  const worker = readFileSync(new URL('../supabase/functions/meta-sync-worker/index.ts', import.meta.url), 'utf8')
  assert.match(worker, /fetchMappedPageToken\(baseUrl, accessToken/)
  assert.match(worker, /resolveInstagramReportingCredential\(/)
  assert.match(worker, /savePlatformState\('instagram', 'failed'/)
  assert.match(worker, /Completed platform data was preserved/)
  assert.doesNotMatch(worker, /platform: 'facebook'[\s\S]{0,240}instagramCredential\.token/)
})
