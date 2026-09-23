import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  INSTAGRAM_TOKEN_ENCRYPTION_VERSION,
  buildInstagramTokenAdditionalData,
  decodeInstagramTokenEncryptionKey,
  decryptInstagramAccessToken,
  encryptInstagramAccessToken,
} from '../supabase/functions/_shared/instagramTokenEncryption.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const callback = read('../supabase/functions/instagram-oauth-callback/index.ts')
const login = read('../supabase/functions/_shared/instagramLogin.ts')
const correction = read('../supabase/migrations/20260922144059_standalone_instagram_token_encryption.sql')
const foundation = read('../supabase/migrations/20260922140000_instagram_login_fallback_foundation.sql')
const worker = read('../supabase/functions/meta-sync-worker/index.ts')

const clientId = '123e4567-e89b-42d3-a456-426614174000'
const instagramAccountId = '998877665544'
const context = { clientId, instagramAccountId, keyVersion: 'v1' }

function base64(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const keyBase64 = base64(Uint8Array.from({ length: 32 }, (_, index) => index))
const wrongKeyBase64 = base64(Uint8Array.from({ length: 32 }, (_, index) => 255 - index))

function mutateBase64(value) {
  const bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0))
  bytes[0] ^= 0x01
  return base64(bytes)
}

test('AES-256-GCM round trip uses a fresh 96-bit IV and versioned exact-identity AAD', async () => {
  const first = await encryptInstagramAccessToken({ accessToken: 'provider-secret-token', keyBase64, context })
  const second = await encryptInstagramAccessToken({ accessToken: 'provider-secret-token', keyBase64, context })

  assert.equal(first.encryptionVersion, INSTAGRAM_TOKEN_ENCRYPTION_VERSION)
  assert.equal(first.keyVersion, 'v1')
  assert.equal(Uint8Array.from(atob(first.ivBase64), c => c.charCodeAt(0)).byteLength, 12)
  assert.notEqual(first.ivBase64, second.ivBase64)
  assert.notEqual(first.ciphertextBase64, second.ciphertextBase64)
  assert.equal(await decryptInstagramAccessToken({ encrypted: first, keyBase64, context }), 'provider-secret-token')

  const aad = new TextDecoder().decode(buildInstagramTokenAdditionalData(context))
  assert.equal(aad, `cg-dynamics|${INSTAGRAM_TOKEN_ENCRYPTION_VERSION}|v1|${clientId}|${instagramAccountId}`)
})

test('decryption rejects the wrong key and exact-client/account AAD mismatches', async () => {
  const encrypted = await encryptInstagramAccessToken({ accessToken: 'provider-secret-token', keyBase64, context })
  await assert.rejects(
    decryptInstagramAccessToken({ encrypted, keyBase64: wrongKeyBase64, context }),
    /could not be authenticated/,
  )
  await assert.rejects(
    decryptInstagramAccessToken({
      encrypted,
      keyBase64,
      context: { ...context, clientId: '223e4567-e89b-42d3-a456-426614174000' },
    }),
    /could not be authenticated/,
  )
  await assert.rejects(
    decryptInstagramAccessToken({
      encrypted,
      keyBase64,
      context: { ...context, instagramAccountId: '112233445566' },
    }),
    /could not be authenticated/,
  )
})

test('decryption rejects tampered ciphertext and IV', async () => {
  const encrypted = await encryptInstagramAccessToken({ accessToken: 'provider-secret-token', keyBase64, context })
  await assert.rejects(
    decryptInstagramAccessToken({
      encrypted: { ...encrypted, ciphertextBase64: mutateBase64(encrypted.ciphertextBase64) },
      keyBase64,
      context,
    }),
    /could not be authenticated/,
  )
  await assert.rejects(
    decryptInstagramAccessToken({
      encrypted: { ...encrypted, ivBase64: mutateBase64(encrypted.ivBase64) },
      keyBase64,
      context,
    }),
    /could not be authenticated/,
  )
})

test('strict key decoding rejects absent, malformed, non-canonical and non-32-byte keys', () => {
  assert.equal(decodeInstagramTokenEncryptionKey(keyBase64).byteLength, 32)
  assert.throws(() => decodeInstagramTokenEncryptionKey(undefined), /encryption key is invalid/)
  assert.throws(() => decodeInstagramTokenEncryptionKey('not*base64'), /canonical RFC 4648 base64/)
  assert.throws(() => decodeInstagramTokenEncryptionKey(`${keyBase64}\n`), /encryption key is invalid/)
  assert.throws(() => decodeInstagramTokenEncryptionKey(base64(new Uint8Array(31))), /exactly 32 bytes/)
})

test('helpers reject malformed version, IV, ciphertext and AAD context', async () => {
  const encrypted = await encryptInstagramAccessToken({ accessToken: 'provider-secret-token', keyBase64, context })
  await assert.rejects(
    decryptInstagramAccessToken({
      encrypted: { ...encrypted, encryptionVersion: 'instagram-token-aes-256-gcm-v2' },
      keyBase64,
      context,
    }),
    /version is unsupported/,
  )
  await assert.rejects(
    decryptInstagramAccessToken({ encrypted: { ...encrypted, ivBase64: 'AQ==' }, keyBase64, context }),
    /exactly 12 bytes/,
  )
  await assert.rejects(
    decryptInstagramAccessToken({ encrypted: { ...encrypted, ciphertextBase64: 'AQ==' }, keyBase64, context }),
    /ciphertext is invalid/,
  )
  await assert.rejects(
    encryptInstagramAccessToken({ accessToken: 'token', keyBase64, context: { ...context, clientId: 'not-a-uuid' } }),
    /client ID is invalid/,
  )
  await assert.rejects(
    encryptInstagramAccessToken({ accessToken: 'token', keyBase64, context: { ...context, instagramAccountId: 'handle' } }),
    /account ID is invalid/,
  )
  await assert.rejects(
    encryptInstagramAccessToken({ accessToken: 'token', keyBase64, context: { ...context, keyVersion: 'latest' } }),
    /key version is invalid/,
  )
})

test('callback encrypts before persistence and passes ciphertext metadata only', () => {
  const encryptionIndex = callback.indexOf('encryptInstagramAccessToken({')
  const persistenceIndex = callback.indexOf("sb.rpc('complete_instagram_login_connection'")
  assert.ok(encryptionIndex > 0 && persistenceIndex > encryptionIndex)
  assert.match(callback, /INSTAGRAM_TOKEN_ENCRYPTION_KEY_B64/)
  assert.match(callback, /INSTAGRAM_TOKEN_ENCRYPTION_KEY_VERSION/)
  assert.match(callback, /p_token_ciphertext_base64: encryptedToken\.ciphertextBase64/)
  assert.match(callback, /p_token_iv_base64: encryptedToken\.ivBase64/)
  assert.doesNotMatch(callback, /p_access_token/)
  assert.doesNotMatch(callback, /console\.(?:log|error)[^\n]*(?:access_token|ciphertext|ivBase64|encryptionKey)/i)
})

test('correction migration aborts on plaintext rows before removing the old path', () => {
  const guardIndex = correction.indexOf('where access_token is not null')
  const dropColumnIndex = correction.indexOf('drop column access_token')
  const dropRpcIndex = correction.indexOf('drop function public.complete_instagram_login_connection')
  assert.ok(guardIndex > 0 && dropRpcIndex > guardIndex && dropColumnIndex > dropRpcIndex)
  assert.match(correction, /Plaintext standalone Instagram token rows exist; aborting/)
  assert.match(correction, /drop function public\.complete_instagram_login_connection\([\s\S]*text\[\], text, timestamptz/)
  assert.doesNotMatch(correction, /p_access_token/)
})

test('final schema and RPC expose only versioned ciphertext fields behind service role', () => {
  for (const field of ['ciphertext_base64', 'iv_base64', 'encryption_version', 'key_version']) {
    assert.match(correction, new RegExp(`add column ${field} text`))
  }
  assert.match(correction, /drop column access_token/)
  assert.match(correction, /set search_path = ''/)
  assert.match(correction, /auth\.role\(\) is distinct from 'service_role'/)
  assert.match(correction, /status = 'pending_review'/)
  assert.match(correction, /Client already has a canonical Instagram mapping/)
  assert.match(correction, /Instagram account is already assigned to another client/)
  assert.match(correction, /grant execute on function public\.complete_instagram_login_connection[\s\S]*to service_role/)
  assert.match(foundation, /revoke all on public\.meta_instagram_connection_tokens from anon, authenticated/)
  assert.doesNotMatch(correction, /meta_client_assets\s*\([^)]*insert/i)
})

test('activation stays disabled and decrypt remains unwired from live Meta workers', () => {
  assert.match(login, /INSTAGRAM_STANDALONE_LIVE_ACTIVATION_ENABLED: boolean = false/)
  assert.doesNotMatch(worker, /instagramTokenEncryption|decryptInstagramAccessToken/)
})
