import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const adapter = read('../supabase/functions/client-onboarding/onedrive-adapter.ts')
const tokenStore = read('../supabase/functions/client-onboarding/onedrive-token-store.ts')
const oauthStart = read('../supabase/functions/onedrive-oauth-start/index.ts')
const oauthCallback = read('../supabase/functions/onedrive-oauth-callback/index.ts')
const tokenMigration = read('../supabase/migrations/20260909090000_microsoft_oauth_tokens.sql')
const mapMigration = read('../supabase/migrations/20260908130000_client_onedrive_production_mapping.sql')
const appCanonical = read('../src/lib/onedriveCanonical.ts')
const denoCanonical = read('../supabase/functions/_shared/onedrive-canonical.ts')

test('adapter uses delegated OAuth, not client_credentials', () => {
  assert.doesNotMatch(adapter, /client_credentials/, 'no app-only grant')
  assert.doesNotMatch(adapter, /scope=.*\.default|\.default/, 'no .default scope')
  assert.match(adapter, /grant_type:\s*'refresh_token'/, 'refresh-token grant')
  assert.match(adapter, /grant_type:\s*'authorization_code'/, 'auth-code grant for consent')
  assert.match(adapter, /login\.microsoftonline\.com\/consumers/, 'consumers authority default')
  assert.match(adapter, /Files\.ReadWrite offline_access openid profile/, 'least-privilege scopes')
  assert.doesNotMatch(adapter, /Files\.ReadWrite\.All|Files\.SelectedOperations\.Selected|Sites\.Selected/)
})

test('adapter talks to /me/drive and rotates the refresh token', () => {
  assert.match(adapter, /\/me\/drive/, 'personal drive endpoint')
  assert.match(adapter, /refreshToken:\s*data\.refresh_token\s*\?\?\s*stored!\.refreshToken/, 'persists rotated refresh token')
})

test('adapter exposes durable folder helpers and is create-only (no rename/move/delete)', () => {
  for (const fn of ['resolveClientsFolder', 'listChildren', 'getItem', 'ensureCanonicalChildFolder']) {
    assert.match(adapter, new RegExp(`export async function ${fn}`), `${fn} exported`)
  }
  // create-only: conflictBehavior fail on folder creation, no destructive verbs
  assert.match(adapter, /conflictBehavior'?:?\s*'fail'/, 'create uses conflictBehavior fail')
  assert.doesNotMatch(adapter, /method:\s*'DELETE'/, 'no delete')
  assert.doesNotMatch(adapter, /method:\s*'PATCH'/, 'no rename/move via PATCH')
})

test('adapter preserves the four exports index.ts depends on', () => {
  for (const fn of ['isUploadAdapterConfigured', 'createUploadSession', 'verifyDriveItem', 'downloadFile']) {
    assert.match(adapter, new RegExp(`export (async )?function ${fn}`), `${fn} still exported`)
  }
})

test('adapter fails closed and never returns raw tokens to callers', () => {
  assert.match(adapter, /if \(!isUploadAdapterConfigured\(\)\) return null/, 'fail closed when unconfigured')
  // getValidAccessToken is internal; Graph helpers return refs/metadata, not tokens
  assert.doesNotMatch(adapter, /return .*refreshToken.*\}/)
})

test('token store encrypts at rest with AES-GCM and is service-role only', () => {
  assert.match(tokenStore, /AES-GCM/, 'AES-GCM')
  assert.match(tokenStore, /ONEDRIVE_TOKEN_ENC_KEY/, 'encryption key from env')
  assert.match(tokenStore, /SUPABASE_SERVICE_ROLE_KEY/, 'service role')
  assert.match(tokenStore, /refresh_token_enc/, 'stores ciphertext column')
  assert.doesNotMatch(tokenStore, /select\('.*refresh_token[^_]/, 'never selects a plaintext refresh_token column')
  assert.match(tokenStore, /export async function savePendingAuth/)
  assert.match(tokenStore, /export async function takePendingAuth/, 'single-use PKCE consume')
})

test('oauth start is setup-gated and uses PKCE S256', () => {
  assert.match(oauthStart, /ONEDRIVE_OAUTH_SETUP_TOKEN/, 'setup token gate')
  assert.match(oauthStart, /provided !== setupToken/, 'rejects wrong token')
  assert.match(oauthStart, /newPkce\(\)/, 'generates PKCE')
  assert.match(oauthStart, /buildAuthorizeUrl\(state, challenge, redirectUri\)/, 'builds authorize URL')
  assert.match(oauthStart, /status: 302/, 'redirects to Microsoft')
  assert.match(adapter, /code_challenge_method:\s*'S256'/, 'PKCE S256 in authorize URL')
})

test('oauth callback validates state, exchanges code, never shows tokens', () => {
  assert.match(oauthCallback, /takePendingAuth\(state\)/, 'validates+consumes PKCE state')
  assert.match(oauthCallback, /exchangeAuthorizationCode\(code, verifier, redirectUri\)/, 'code exchange')
  assert.doesNotMatch(oauthCallback, /refresh_token|access_token/, 'no token echoed to browser')
})

test('token migration is additive, RLS-on, service-role only', () => {
  assert.match(tokenMigration, /create table if not exists public\.microsoft_oauth_tokens/)
  assert.match(tokenMigration, /enable row level security/)
  assert.match(tokenMigration, /revoke all on public\.microsoft_oauth_tokens from anon, authenticated/)
  assert.match(tokenMigration, /refresh_token_enc text/, 'encrypted column, not plaintext')
  assert.doesNotMatch(tokenMigration, /drop table|truncate/i)
})

test('mapping migration: videos_folder_item_id is nullable (map-before-Videos)', () => {
  assert.match(
    mapMigration,
    /videos_folder_item_id text check \(videos_folder_item_id is null/,
    'nullable videos folder id',
  )
  assert.doesNotMatch(mapMigration, /videos_folder_item_id text not null/)
})

test('pure canonical module is identical across app and Deno copies (no drift)', () => {
  // Strip the Deno copy header line and compare the rest.
  const denoBody = denoCanonical.replace(/^\/\/ Deno edge copy[^\n]*\n/, '')
  assert.equal(denoBody, appCanonical, 'src/lib and _shared canonical copies must match')
})
