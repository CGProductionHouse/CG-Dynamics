// Microsoft Graph adapter for the CG Production House OneDrive.
//
// AUTH MODEL (#225, corrected 2026-09-09): the source-of-truth OneDrive is a PERSONAL
// Microsoft account (onedrive.live.com). App-only / client-credentials is NOT supported
// for personal accounts, so this adapter uses DELEGATED OAuth: a one-time interactive
// consent mints a refresh token (see onedrive-oauth-* functions), stored encrypted by
// onedrive-token-store.ts, and refreshed here for unattended server-side calls.
//
// Boundaries: durable driveId/itemId only (no path guessing at runtime), create-only
// folder helper (no rename/move/delete), raw Graph ids/tokens never returned to clients.

import {
  getStoredTokens,
  isTokenStoreConfigured,
  ONEDRIVE_ACCOUNT_KEY,
  saveTokens,
} from './onedrive-token-store.ts'
import { computeTokenState } from '../_shared/onedrive-canonical.ts'

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0'

// ---- Delegated OAuth config (personal Microsoft account) ---------------------------

function oauthConfig() {
  return {
    clientId: Deno.env.get('ONEDRIVE_MS_CLIENT_ID') ?? '',
    clientSecret: Deno.env.get('ONEDRIVE_MS_CLIENT_SECRET') ?? '',
    // Personal Microsoft accounts authenticate against the consumers authority.
    authority:
      Deno.env.get('ONEDRIVE_MS_AUTHORITY') ?? 'https://login.microsoftonline.com/consumers',
    // Least-privilege delegated scopes for list/read/create folders + refresh.
    scope: Deno.env.get('ONEDRIVE_MS_SCOPE') ?? 'Files.ReadWrite offline_access openid profile',
  }
}

/**
 * Static configuration check (synchronous, used to gate endpoints).
 * True when the delegated app + encrypted token store are configured. Whether a
 * refresh token actually exists is checked at call time (getValidAccessToken).
 */
export function isUploadAdapterConfigured(): boolean {
  const cfg = oauthConfig()
  return Boolean(cfg.clientId && cfg.clientSecret && isTokenStoreConfigured())
}

/**
 * Return a valid delegated access token, refreshing (and persisting the rotated
 * refresh token) when needed. Returns null when unconfigured, when no consent has
 * happened yet, or when the refresh token is no longer valid (re-consent required).
 */
export async function getValidAccessToken(): Promise<string | null> {
  if (!isUploadAdapterConfigured()) return null
  const stored = await getStoredTokens(ONEDRIVE_ACCOUNT_KEY)
  const state = computeTokenState({
    hasRefreshToken: Boolean(stored?.refreshToken),
    accessTokenExpiresAt: stored?.accessTokenExpiresAt ?? null,
    now: Date.now(),
    skewSeconds: 300,
  })
  if (state === 'needs_consent') return null
  if (state === 'valid') return stored!.accessToken

  // needs_refresh
  const cfg = oauthConfig()
  try {
    const body = new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: stored!.refreshToken,
      scope: cfg.scope,
    })
    const res = await fetch(`${cfg.authority}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null // invalid_grant => re-consent required
    const data = (await res.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
      scope?: string
    }
    if (!data.access_token) return null
    const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000
    // Personal-account refresh tokens rotate: persist the new one (or keep the old).
    await saveTokens({
      refreshToken: data.refresh_token ?? stored!.refreshToken,
      accessToken: data.access_token,
      accessTokenExpiresAt: expiresAt,
      scope: data.scope ?? stored!.scope,
    })
    return data.access_token
  } catch {
    return null
  }
}

// ---- One-time delegated consent (authorization-code + PKCE) ------------------------

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Generate a PKCE verifier + S256 challenge and a random state. */
export async function newPkce(): Promise<{ state: string; verifier: string; challenge: string }> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)))
  const state = base64url(crypto.getRandomValues(new Uint8Array(24)))
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  )
  return { state, verifier, challenge: base64url(digest) }
}

/** Build the Microsoft authorize URL for the one-time interactive consent. */
export function buildAuthorizeUrl(state: string, challenge: string, redirectUri: string): string | null {
  const cfg = oauthConfig()
  if (!cfg.clientId || !redirectUri) return null
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: cfg.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  return `${cfg.authority}/oauth2/v2.0/authorize?${q.toString()}`
}

/** Exchange an authorization code for tokens and persist them (initial consent). */
export async function exchangeAuthorizationCode(
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<boolean> {
  const cfg = oauthConfig()
  if (!cfg.clientId || !cfg.clientSecret || !redirectUri) return false
  try {
    const body = new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      scope: cfg.scope,
    })
    const res = await fetch(`${cfg.authority}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return false
    const data = (await res.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
      scope?: string
    }
    if (!data.refresh_token) return false // offline_access must be granted
    return await saveTokens({
      refreshToken: data.refresh_token,
      accessToken: data.access_token ?? null,
      accessTokenExpiresAt: data.access_token ? Date.now() + (data.expires_in ?? 3600) * 1000 : null,
      scope: data.scope ?? null,
    })
  } catch {
    return false
  }
}

async function graphGet<T>(path: string): Promise<T | null> {
  const token = await getValidAccessToken()
  if (!token) return null
  try {
    const res = await fetch(`${GRAPH_ROOT}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

// ---- Types -------------------------------------------------------------------------

interface UploadSessionParams {
  clientId: string
  category: 'logo' | 'services' | 'optional'
  filename: string
  fileSize: number
  mimeType: string
}

export interface UploadSessionResult {
  uploadUrl: string
  expiresAt: string
  driveId: string
  itemId: string
  folderName: string
}

interface FolderResolution {
  driveId: string
  itemId: string
  folderName: string
}

export interface DriveItemResult {
  id: string
  driveId: string
  parentItemId: string
  name: string
  size: number
  mimeType: string
  webUrl: string
}

export interface FolderRef {
  driveId: string
  itemId: string
  name: string
  webUrl: string
}

export interface ChildItem {
  id: string
  name: string
  isFolder: boolean
  webUrl: string
}

interface GraphUploadSessionResponse {
  uploadUrl: string
  expirationDateTime: string
}

interface GraphDriveItem {
  id: string
  name: string
  size?: number
  folder?: { childCount?: number }
  file?: { mimeType?: string }
  webUrl?: string
  parentReference?: { driveId?: string; id?: string }
}

// ---- #225 durable folder helpers (read + create-only) ------------------------------

/** Resolve the durable driveId + itemId + webUrl of the personal OneDrive `Clients` root. */
export async function resolveClientsFolder(): Promise<FolderRef | null> {
  const item = await graphGet<GraphDriveItem>('/me/drive/root:/Clients')
  if (!item?.id) return null
  const driveId = item.parentReference?.driveId
  if (!driveId) {
    // parentReference.driveId is present on children; for root:/Clients fetch drive id.
    const drive = await graphGet<{ id?: string }>('/me/drive?$select=id')
    if (!drive?.id) return null
    return { driveId: drive.id, itemId: item.id, name: item.name, webUrl: item.webUrl ?? '' }
  }
  return { driveId, itemId: item.id, name: item.name, webUrl: item.webUrl ?? '' }
}

/** List children of a folder by durable ids (paged). Read-only. */
export async function listChildren(driveId: string, itemId: string): Promise<ChildItem[] | null> {
  const token = await getValidAccessToken()
  if (!token) return null
  const out: ChildItem[] = []
  let url:
    | string
    | null = `${GRAPH_ROOT}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/children?$select=id,name,folder,webUrl&$top=200`
  try {
    while (url) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) return null
      const page = (await res.json()) as {
        value?: GraphDriveItem[]
        '@odata.nextLink'?: string
      }
      for (const it of page.value ?? []) {
        out.push({
          id: it.id,
          name: it.name,
          isFolder: Boolean(it.folder),
          webUrl: it.webUrl ?? '',
        })
      }
      url = page['@odata.nextLink'] ?? null
    }
    return out
  } catch {
    return null
  }
}

/** Get durable metadata + webUrl for one item (used by "Open production folder"). */
export async function getItem(driveId: string, itemId: string): Promise<FolderRef | null> {
  const item = await graphGet<GraphDriveItem>(
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}?$select=id,name,webUrl,parentReference`,
  )
  if (!item?.id) return null
  return {
    driveId: item.parentReference?.driveId ?? driveId,
    itemId: item.id,
    name: item.name,
    webUrl: item.webUrl ?? '',
  }
}

/**
 * Create a canonical child folder ONLY when it does not already exist. Explicit staff
 * action; never renames/moves/deletes. Returns the existing or newly created folder.
 * Uses conflictBehavior 'fail' so a race never silently duplicates/renames.
 */
export async function ensureCanonicalChildFolder(
  driveId: string,
  parentItemId: string,
  name: string,
): Promise<{ ref: FolderRef; created: boolean } | null> {
  const children = await listChildren(driveId, parentItemId)
  if (children == null) return null
  const existing = children.find((c) => c.isFolder && c.name === name)
  if (existing) {
    return { ref: { driveId, itemId: existing.id, name: existing.name, webUrl: existing.webUrl }, created: false }
  }
  const token = await getValidAccessToken()
  if (!token) return null
  try {
    const res = await fetch(
      `${GRAPH_ROOT}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentItemId)}/children`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail',
        }),
        signal: AbortSignal.timeout(30_000),
      },
    )
    if (!res.ok) return null
    const item = (await res.json()) as GraphDriveItem
    if (!item.id) return null
    return {
      ref: { driveId, itemId: item.id, name: item.name, webUrl: item.webUrl ?? '' },
      created: true,
    }
  } catch {
    return null
  }
}

// ---- Existing onboarding upload path (now delegated) -------------------------------

// Resolve the existing destination that staff mapped for this client and category.
async function resolveClientFolder(
  clientId: string,
  category: UploadSessionParams['category'],
): Promise<FolderResolution | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return null
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await service
      .from('client_onboarding_drive_mapping')
      .select('drive_id, folder_item_id, folder_name')
      .eq('client_id', clientId)
      .eq('upload_category', category)
      .eq('active', true)
      .maybeSingle()
    if (error || !data) return null
    return { driveId: data.drive_id, itemId: data.folder_item_id, folderName: data.folder_name }
  } catch {
    return null
  }
}

export async function createUploadSession(
  params: UploadSessionParams,
): Promise<UploadSessionResult | null> {
  if (!isUploadAdapterConfigured()) return null
  const accessToken = await getValidAccessToken()
  if (!accessToken) return null
  const folder = await resolveClientFolder(params.clientId, params.category)
  if (!folder) return null
  try {
    const response = await fetch(
      `${GRAPH_ROOT}/drives/${encodeURIComponent(folder.driveId)}/items/${encodeURIComponent(folder.itemId)}:/${encodeURIComponent(params.filename)}:/createUploadSession`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: { '@microsoft.graph.conflictBehavior': 'rename', name: params.filename },
        }),
        signal: AbortSignal.timeout(30_000),
      },
    )
    if (!response.ok) return null
    const session = (await response.json()) as GraphUploadSessionResponse
    return {
      uploadUrl: session.uploadUrl,
      expiresAt: session.expirationDateTime,
      driveId: folder.driveId,
      itemId: folder.itemId,
      folderName: folder.folderName,
    }
  } catch {
    return null
  }
}

export async function verifyDriveItem(
  driveId: string,
  itemId: string,
  folderItemId: string,
  expectedSize: number,
): Promise<DriveItemResult | null> {
  const item = await graphGet<GraphDriveItem>(
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}?$select=id,name,size,file,webUrl,parentReference`,
  )
  if (!item) return null
  if (
    !item.id || !item.file || item.size !== expectedSize ||
    item.parentReference?.driveId !== driveId || item.parentReference?.id !== folderItemId
  ) return null
  return {
    id: item.id,
    driveId: item.parentReference.driveId,
    parentItemId: item.parentReference.id,
    name: item.name,
    size: item.size ?? 0,
    mimeType: item.file.mimeType ?? 'application/octet-stream',
    webUrl: item.webUrl ?? '',
  }
}

export async function downloadFile(
  driveId: string,
  itemId: string,
): Promise<{ stream: ReadableStream; mimeType: string; filename: string } | null> {
  const accessToken = await getValidAccessToken()
  if (!accessToken) return null
  try {
    const metaResponse = await fetch(
      `${GRAPH_ROOT}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30_000) },
    )
    if (!metaResponse.ok) return null
    const meta = (await metaResponse.json()) as { name: string; file?: { mimeType?: string } }
    const contentResponse = await fetch(
      `${GRAPH_ROOT}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(60_000) },
    )
    if (!contentResponse.ok || !contentResponse.body) return null
    return {
      stream: contentResponse.body,
      mimeType: meta.file?.mimeType ?? 'application/octet-stream',
      filename: meta.name,
    }
  } catch {
    return null
  }
}
