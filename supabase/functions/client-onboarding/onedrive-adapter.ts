// Microsoft Graph upload adapter for client onboarding.
// Uses a dedicated least-privilege Microsoft app for upload operations.
// The existing microsoft-transition-sync connector is read-only and must not be modified.
//
// Upload protocol: sequential chunked PUT requests to the Graph resumable
// upload session URL. Each chunk is sent with Content-Length and Content-Range
// headers. After the final chunk, Graph returns the completed DriveItem.

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0'

// Default 10 MB chunk size. Graph requires 320 KB–60 MB per chunk.
export const DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024

// Retry configuration
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2_000

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
  name: string
  size: number
  mimeType: string
  webUrl: string
}

export interface ChunkedUploadParams {
  uploadUrl: string
  fileBuffer: ArrayBuffer
  fileSize: number
  mimeType: string
  onChunkUploaded?: (bytesUploaded: number) => void
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

// Sleep helper for retry delays.
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Upload a single chunk to the Graph upload session URL.
// Uses PUT with Content-Length and Content-Range headers per the Graph protocol.
// Returns { ok, body? } — the body is populated on the final chunk with the DriveItem.
async function uploadChunk(
  uploadUrl: string,
  chunk: ArrayBuffer,
  startByte: number,
  endByte: number,
  totalSize: number,
  retries = MAX_RETRIES,
): Promise<{ ok: boolean; body?: GraphDriveItem }> {
  const contentRange = `bytes ${startByte}-${endByte - 1}/${totalSize}`
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(chunk.byteLength),
          'Content-Range': contentRange,
        },
        body: chunk,
        signal: AbortSignal.timeout(120_000),
      })
      if (response.ok) {
        const body = await response.json() as GraphDriveItem
        return { ok: true, body }
      }
      if (response.status >= 500 && attempt < retries) {
        await sleep(RETRY_DELAY_MS * (attempt + 1))
        continue
      }
      return { ok: false }
    } catch {
      if (attempt < retries) {
        await sleep(RETRY_DELAY_MS * (attempt + 1))
        continue
      }
      return { ok: false }
    }
  }
  return { ok: false }
}

function graphItemToResult(item: GraphDriveItem): DriveItemResult {
  return {
    id: item.id,
    name: item.name,
    size: item.size,
    mimeType: item.file?.mimeType ?? 'application/octet-stream',
    webUrl: item.webUrl ?? '',
  }
}

// Upload a file in sequential chunks to the Graph resumable upload session.
// Returns the DriveItem from the final Graph response, or null on failure.
export async function uploadFileChunked(
  params: ChunkedUploadParams,
  chunkSize = DEFAULT_CHUNK_SIZE,
): Promise<DriveItemResult | null> {
  const { uploadUrl, fileBuffer, fileSize, onChunkUploaded } = params
  let bytesUploaded = 0
  let lastItem: GraphDriveItem | undefined

  while (bytesUploaded < fileSize) {
    const endByte = Math.min(bytesUploaded + chunkSize, fileSize)
    const chunk = fileBuffer.slice(bytesUploaded, endByte)
    const result = await uploadChunk(uploadUrl, chunk, bytesUploaded, endByte, fileSize)
    if (!result.ok) return null
    if (result.body) lastItem = result.body
    bytesUploaded = endByte
    onChunkUploaded?.(bytesUploaded)
  }

  return lastItem ? graphItemToResult(lastItem) : null
}

// Verify a DriveItem exists in the given folder by querying Graph directly.
// This is used after upload completion to confirm the file landed.
export async function verifyDriveItem(
  driveId: string,
  folderItemId: string,
  filename: string,
): Promise<DriveItemResult | null> {
  const cfg = uploadAppConfig()
  if (!isUploadAdapterConfigured()) return null

  const accessToken = await getAccessToken(cfg.tenantId, cfg.clientId, cfg.clientSecret)
  if (!accessToken) return null

  try {
    // List children of the folder and find by name
    const response = await fetch(
      `${GRAPH_ROOT}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folderItemId)}/children?$select=id,name,size,file,webUrl&$filter=name eq '${encodeURIComponent(filename)}'`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(30_000),
      },
    )
    if (!response.ok) return null
    const data = await response.json() as { value?: GraphDriveItem[] }
    const item = data.value?.[0]
    if (!item || !item.file) return null
    return {
      id: item.id,
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
