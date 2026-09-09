// Encrypted server-side store for the delegated OneDrive OAuth tokens (#225).
//
// The CG Dynamics OneDrive is a PERSONAL Microsoft account, so app-only/client-credentials
// is impossible. We use delegated OAuth: a one-time interactive consent mints a refresh
// token, which we keep here (encrypted at rest) and use for unattended access.
//
// Security posture:
//   * Refresh/access tokens are encrypted with AES-256-GCM using ONEDRIVE_TOKEN_ENC_KEY
//     (base64, 32 bytes). The DB never stores plaintext tokens.
//   * The table is service-role only (RLS on, revoked from anon/authenticated).
//   * Personal-account refresh tokens ROTATE on every use — callers MUST persist the
//     rotated refresh token returned by each refresh (saveTokens handles this).
//   * Raw tokens never leave the server; they are never returned to any client.

const ACCESS = 'https://esm.sh/@supabase/supabase-js@2'

export const ONEDRIVE_ACCOUNT_KEY = 'onedrive_personal'

export interface StoredTokens {
  refreshToken: string
  accessToken: string | null
  accessTokenExpiresAt: number | null // epoch ms
  scope: string | null
}

interface TokenRow {
  account_key: string
  refresh_token_enc: string
  access_token_enc: string | null
  access_token_expires_at: string | null
  scope: string | null
}

function encKey(): Uint8Array | null {
  const b64 = Deno.env.get('ONEDRIVE_TOKEN_ENC_KEY') ?? ''
  if (!b64) return null
  try {
    const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    return raw.length === 32 ? raw : null
  } catch {
    return null
  }
}

export function isTokenStoreConfigured(): boolean {
  return Boolean(
    encKey() &&
      Deno.env.get('SUPABASE_URL') &&
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  )
}

async function importKey(): Promise<CryptoKey | null> {
  const raw = encKey()
  if (!raw) return null
  return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

// Format: base64( iv(12) || ciphertext )
async function encrypt(plaintext: string): Promise<string | null> {
  const key = await importKey()
  if (!key) return null
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(plaintext)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data))
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv, 0)
  out.set(ct, iv.length)
  return btoa(String.fromCharCode(...out))
}

async function decrypt(payload: string | null): Promise<string | null> {
  if (!payload) return null
  const key = await importKey()
  if (!key) return null
  try {
    const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
    const iv = bytes.slice(0, 12)
    const ct = bytes.slice(12)
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
    return new TextDecoder().decode(pt)
  } catch {
    return null
  }
}

async function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) return null
  const { createClient } = await import(ACCESS)
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Read + decrypt the stored tokens for the personal OneDrive account. */
export async function getStoredTokens(
  accountKey = ONEDRIVE_ACCOUNT_KEY,
): Promise<StoredTokens | null> {
  const svc = await serviceClient()
  if (!svc) return null
  const { data, error } = await svc
    .from('microsoft_oauth_tokens')
    .select('account_key, refresh_token_enc, access_token_enc, access_token_expires_at, scope')
    .eq('account_key', accountKey)
    .maybeSingle()
  if (error || !data) return null
  const row = data as TokenRow
  const refreshToken = await decrypt(row.refresh_token_enc)
  if (!refreshToken) return null
  return {
    refreshToken,
    accessToken: await decrypt(row.access_token_enc),
    accessTokenExpiresAt: row.access_token_expires_at
      ? new Date(row.access_token_expires_at).getTime()
      : null,
    scope: row.scope,
  }
}

/**
 * Persist a pending PKCE verifier + state for the one-time consent flow.
 * The verifier is encrypted at rest; state is a random lookup key with a short TTL.
 */
export async function savePendingAuth(
  state: string,
  verifier: string,
  ttlSeconds = 600,
  accountKey = ONEDRIVE_ACCOUNT_KEY,
): Promise<boolean> {
  const svc = await serviceClient()
  if (!svc) return false
  const pending_verifier_enc = await encrypt(verifier)
  if (!pending_verifier_enc) return false
  const { error } = await svc.from('microsoft_oauth_tokens').upsert(
    {
      account_key: accountKey,
      pending_state: state,
      pending_verifier_enc,
      pending_expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'account_key' },
  )
  return !error
}

/** Validate + consume a pending PKCE verifier for the given state (single use). */
export async function takePendingAuth(
  state: string,
  accountKey = ONEDRIVE_ACCOUNT_KEY,
): Promise<string | null> {
  const svc = await serviceClient()
  if (!svc || !state) return null
  const { data, error } = await svc
    .from('microsoft_oauth_tokens')
    .select('pending_state, pending_verifier_enc, pending_expires_at')
    .eq('account_key', accountKey)
    .maybeSingle()
  if (error || !data) return null
  const row = data as {
    pending_state: string | null
    pending_verifier_enc: string | null
    pending_expires_at: string | null
  }
  if (!row.pending_state || row.pending_state !== state) return null
  if (!row.pending_expires_at || new Date(row.pending_expires_at).getTime() < Date.now()) return null
  const verifier = await decrypt(row.pending_verifier_enc)
  // Clear pending regardless (single use).
  await svc
    .from('microsoft_oauth_tokens')
    .update({ pending_state: null, pending_verifier_enc: null, pending_expires_at: null })
    .eq('account_key', accountKey)
  return verifier
}

/**
 * Encrypt + upsert tokens after initial consent or after a refresh.
 * Always persists the (rotated) refresh token so the next unattended call works.
 */
export async function saveTokens(
  tokens: StoredTokens,
  accountKey = ONEDRIVE_ACCOUNT_KEY,
): Promise<boolean> {
  const svc = await serviceClient()
  if (!svc) return false
  const refresh_token_enc = await encrypt(tokens.refreshToken)
  if (!refresh_token_enc) return false
  const access_token_enc = tokens.accessToken ? await encrypt(tokens.accessToken) : null
  const { error } = await svc.from('microsoft_oauth_tokens').upsert(
    {
      account_key: accountKey,
      refresh_token_enc,
      access_token_enc,
      access_token_expires_at: tokens.accessTokenExpiresAt
        ? new Date(tokens.accessTokenExpiresAt).toISOString()
        : null,
      scope: tokens.scope,
      rotated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'account_key' },
  )
  return !error
}
