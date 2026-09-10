import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const mcp = read('../supabase/functions/cg-dynamics-mcp/index.ts')
const adapter = read('../supabase/functions/client-onboarding/onedrive-adapter.ts')
const tokenStore = read('../supabase/functions/client-onboarding/onedrive-token-store.ts')
const oauthStart = read('../supabase/functions/onedrive-oauth-start/index.ts')
const oauthCallback = read('../supabase/functions/onedrive-oauth-callback/index.ts')
const mappingMigration = read('../supabase/migrations/20260908150000_client_onedrive_production_mapping.sql')
const tokenMigration = read('../supabase/migrations/20260909090000_microsoft_oauth_tokens.sql')

test('#311 consumes the canonical #307 delegated adapter rather than defining another adapter', () => {
  assert.match(mcp, /import\('\.\.\/client-onboarding\/onedrive-adapter\.ts'\)/)
  assert.match(adapter, /grant_type:\s*'refresh_token'/)
  assert.match(adapter, /login\.microsoftonline\.com\/consumers/)
  assert.match(adapter, /export async function getItem/)
  assert.match(adapter, /export async function listChildren/)
  assert.doesNotMatch(mcp, /graph\.microsoft\.com|grant_type|refresh_token/)
})

test('verification consumes only #307 read helpers and exposes no OneDrive mutation tool', () => {
  assert.match(mcp, /adapter\.getItem\(/)
  assert.match(mcp, /inspectExactOneDriveFolder\(\s*adapter,/)
  assert.doesNotMatch(mcp, /adapter\.(?:createUploadSession|ensureCanonicalChildFolder|verifyDriveItem|downloadFile)\(/)
  // #325: the connector now delegates to SIBLING Supabase Edge Functions (reconciliation and
  // provider sync), so a blanket "no POST" check no longer expresses the real rule. The rule
  // is: no mutating HTTP to Microsoft Graph / OneDrive, and every outbound call must target
  // an internal /functions/v1/ endpoint.
  const outbound = [...mcp.matchAll(/fetch\(([^\n]*)/g)].map(m => m[1])
  for (const call of outbound) {
    assert.doesNotMatch(call, /graph\.microsoft\.com|onedrive|sharepoint/i, 'no direct Graph/OneDrive HTTP from the MCP')
  }
  assert.doesNotMatch(mcp, /fetch\(`?https:\/\/(?!\$)/, 'no hardcoded external host')
  assert.match(mcp, /functions\/v1\/\$\{fn\}/, 'outbound delegation targets internal Edge Functions only')
})

test('#307 adapter reads exact durable IDs with paginated Graph children and fails closed', () => {
  assert.match(adapter, /\/drives\/\$\{encodeURIComponent\(driveId\)\}\/items\/\$\{encodeURIComponent\(itemId\)\}/)
  assert.match(adapter, /@odata\.nextLink/)
  assert.match(adapter, /if \(!token\) return null/)
  assert.doesNotMatch(adapter, /root:\/Clients.*(?:find|match)/i)
})

test('#307 mapping contract is one exact client and one exact folder per content run', () => {
  assert.match(mappingMigration, /create table if not exists public\.client_onedrive_mappings/)
  assert.match(mappingMigration, /create table if not exists public\.content_run_onedrive_folders/)
  assert.match(mappingMigration, /unique \(client_id\)/)
  assert.match(mappingMigration, /unique \(content_run_id\)/)
  assert.match(mappingMigration, /get_content_run_onedrive_folder\(p_content_run_id uuid\)/)
  assert.match(mappingMigration, /where f\.content_run_id = p_content_run_id/)
  assert.doesNotMatch(mappingMigration, /ilike|similarity|levenshtein/i)
})

test('#307 token store remains encrypted, service-role-only and fail-closed', () => {
  assert.match(tokenStore, /AES-GCM/)
  assert.match(tokenStore, /ONEDRIVE_TOKEN_ENC_KEY/)
  assert.match(tokenStore, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(tokenMigration, /refresh_token_enc text/)
  assert.match(tokenMigration, /revoke all/)
  assert.match(tokenMigration, /revoke all on public\.microsoft_oauth_tokens from anon, authenticated/)
  assert.doesNotMatch(tokenMigration, /refresh_token\s+text/)
})

test('#307 delegated consent entry points are present but remain setup-gated', () => {
  assert.match(oauthStart, /ONEDRIVE_OAUTH_SETUP_TOKEN/)
  assert.match(oauthStart, /provided !== setupToken/)
  assert.match(oauthStart, /newPkce\(\)/)
  assert.match(oauthCallback, /takePendingAuth\(state\)/)
  assert.match(oauthCallback, /exchangeAuthorizationCode\(code, verifier, redirectUri\)/)
  assert.doesNotMatch(oauthCallback, /refresh_token|access_token/)
})
