export const GRAPH_UPLOAD_CHUNK_SIZE = 10 * 1024 * 1024

const MAX_CHUNK_RETRIES = 3

export interface UploadedDriveItem {
  id: string
  name: string
  size: number
  file?: { mimeType?: string }
  webUrl?: string
}

function retryDelay(attempt: number) {
  return new Promise(resolve => setTimeout(resolve, 500 * attempt))
}

async function putChunk(
  uploadUrl: string,
  chunk: Blob,
  start: number,
  totalSize: number,
): Promise<Response | null> {
  const end = start + chunk.size - 1

  for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt += 1) {
    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Range': `bytes ${start}-${end}/${totalSize}` },
        body: chunk,
        signal: AbortSignal.timeout(120_000),
      })
      if (response.ok) return response
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500
      if (!retryable || attempt === MAX_CHUNK_RETRIES) return null
    } catch {
      if (attempt === MAX_CHUNK_RETRIES) return null
    }
    await retryDelay(attempt)
  }

  return null
}

export async function uploadFileToGraphSession(
  uploadUrl: string,
  file: File,
  onProgress?: (progress: number) => void,
  chunkSize = GRAPH_UPLOAD_CHUNK_SIZE,
): Promise<{ item: UploadedDriveItem | null; error: string | null }> {
  let offset = 0

  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size))
    const response = await putChunk(uploadUrl, chunk, offset, file.size)
    if (!response) return { item: null, error: 'File upload failed. Please check your connection and try again.' }

    offset += chunk.size
    onProgress?.(Math.round((offset / file.size) * 100))

    if (offset === file.size) {
      const item = await response.json().catch(() => null) as UploadedDriveItem | null
      if (!item?.id || !item.name || !Number.isFinite(item.size)) {
        return { item: null, error: 'Microsoft could not confirm the uploaded file. Please try again.' }
      }
      return { item, error: null }
    }
  }

  return { item: null, error: 'This file appears to be empty.' }
}
