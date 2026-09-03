// Microsoft Graph upload adapter for client onboarding.
// Uses a dedicated least-privilege Microsoft app for upload operations.
// The existing microsoft-transition-sync connector is read-only and must not be modified.
//
// The browser uploads sequential chunks to the short-lived Graph session URL.
// This adapter creates sessions and verifies completed DriveItems server-side.

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0'

interface UploadSessionParams {
  clientId: string
  filename: string
  fileSize: number
  mimeType: string
}

export interface UploadSessionResult {
  uploadUrl: string
  expiresAt: string
  driveId: string
  itemId: string
}

interface FolderResolution {
  driveId: string
  itemId: string
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

interface GraphUploadSessionResponse {
  uploadUrl: string
  expirationDateTime: string
}

interface GraphDriveItem {
  id: string
  name: string
  size: number
  file?: { mimeType?: string }
  webUrl?: string
  parentReference?: { driveId?: string; id?: string }
}

// Read-only optional env vars for the dedicated upload app.
// These MUST be a separate app from the read-only transition sync connector.
function uploadAppConfig() {
  return {
    tenantId: Deno.env.get('ONBOARDING_MS_TENANT_ID') ?? '',
    clientId: Deno.env.get('ONBOARDING_MS_CLIENT_ID') ?? '',
    clientSecret: Deno.env.get('ONBOARDING_MS_CLIENT_SECRET') ?? '',
  }
}

export function isUploadAdapterConfigured(): boolean {
  const cfg = uploadAppConfig()
  return Boolean(cfg.tenantId && cfg.clientId && cfg.clientSecret)
}

async function getAccessToken(tenantId: string, clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    })
    const response = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(30_000),
      },
    )
    if (!response.ok) return null
    const data = await response.json() as { access_token?: string }
    return data.access_token ?? null
  } catch {
    return null
  }
}

// Resolve the client's Brand Identity folder from the CG OneDrive structure.
// This queries a mapping table that staff populate when they first set up a client.
// The table must store the exact driveId + itemId of the existing "Brand Identity" folder.
async function resolveClientFolder(
  token: string,
  clientId: string,
): Promise<FolderResolution | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return null

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Query the existing client_onboarding_drive_mapping table (created by staff)
    const { data, error } = await service
      .from('client_onboarding_drive_mapping')
      .select('drive_id, folder_item_id')
      .eq('client_id', clientId)
      .eq('active', true)
      .maybeSingle()

    if (error || !data) return null
    return { driveId: data.drive_id, itemId: data.folder_item_id }
  } catch {
    return null
  }
}

// Create a resumable upload session via Microsoft Graph.
// The uploadUrl returned is a short-lived, unauthenticated endpoint that
// accepts PUT requests for the file content.
export async function createUploadSession(
  params: UploadSessionParams,
): Promise<UploadSessionResult | null> {
  const cfg = uploadAppConfig()
  if (!isUploadAdapterConfigured()) return null

  const accessToken = await getAccessToken(cfg.tenantId, cfg.clientId, cfg.clientSecret)
  if (!accessToken) return null

  const folder = await resolveClientFolder(accessToken, params.clientId)
  if (!folder) return null

  try {
    const response = await fetch(
      `${GRAPH_ROOT}/drives/${encodeURIComponent(folder.driveId)}/items/${encodeURIComponent(folder.itemId)}:/${encodeURIComponent(params.filename)}:/createUploadSession`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          item: {
            '@microsoft.graph.conflictBehavior': 'rename',
            name: params.filename,
          },
        }),
        signal: AbortSignal.timeout(30_000),
      },
    )

    if (!response.ok) return null
    const session = await response.json() as GraphUploadSessionResponse

    return {
      uploadUrl: session.uploadUrl,
      expiresAt: session.expirationDateTime,
      driveId: folder.driveId,
      itemId: folder.itemId,
    }
  } catch {
    return null
  }
}

// Verify the exact DriveItem returned by the final upload chunk.
export async function verifyDriveItem(
  driveId: string,
  itemId: string,
  folderItemId: string,
  expectedSize: number,
): Promise<DriveItemResult | null> {
  const cfg = uploadAppConfig()
  if (!isUploadAdapterConfigured()) return null

  const accessToken = await getAccessToken(cfg.tenantId, cfg.clientId, cfg.clientSecret)
  if (!accessToken) return null

  try {
    const response = await fetch(
      `${GRAPH_ROOT}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}?$select=id,name,size,file,webUrl,parentReference`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(30_000),
      },
    )
    if (!response.ok) return null
    const item = await response.json() as GraphDriveItem
    if (
      !item.id || !item.file || item.size !== expectedSize
      || item.parentReference?.driveId !== driveId
      || item.parentReference?.id !== folderItemId
    ) return null
    return {
      id: item.id,
      driveId: item.parentReference.driveId,
      parentItemId: item.parentReference.id,
      name: item.name,
      size: item.size,
      mimeType: item.file.mimeType ?? 'application/octet-stream',
      webUrl: item.webUrl ?? '',
    }
  } catch {
    return null
  }
}

// Download a file from OneDrive by driveId + itemId.
// Returns the raw content as a ReadableStream so the Edge Function can proxy it.
export async function downloadFile(
  driveId: string,
  itemId: string,
): Promise<{ stream: ReadableStream; mimeType: string; filename: string } | null> {
  const cfg = uploadAppConfig()
  if (!isUploadAdapterConfigured()) return null

  const accessToken = await getAccessToken(cfg.tenantId, cfg.clientId, cfg.clientSecret)
  if (!accessToken) return null

  try {
    // Get file metadata first
    const metaResponse = await fetch(
      `${GRAPH_ROOT}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(30_000),
      },
    )
    if (!metaResponse.ok) return null
    const meta = await metaResponse.json() as {
      name: string
      file?: { mimeType?: string }
    }

    // Stream the file content
    const contentResponse = await fetch(
      `${GRAPH_ROOT}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(60_000),
      },
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
