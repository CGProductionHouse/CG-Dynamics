export type OneDriveVerificationStatus = 'VERIFIED' | 'MISSING' | 'PARTIAL' | 'UNVERIFIED'

export interface OneDriveChildItem {
  id: string
  name: string
  isFolder: boolean
}

export interface OneDriveReadAdapter {
  getItem?: (driveId: string, itemId: string) => Promise<{
    driveId: string
    itemId: string
    name: string
  } | null>
  listChildren?: (driveId: string, itemId: string) => Promise<OneDriveChildItem[] | null>
}

export interface ExactContentRunFolderMapping {
  content_run_id: string
  client_id: string
  drive_id: string
  month_folder_item_id: string
  folder_name?: string | null
}

export type ExactMappingValidation =
  | { ok: true; mapping: ExactContentRunFolderMapping }
  | { ok: false; blocker: string }

export interface OneDriveInspectionEvidence {
  status: OneDriveVerificationStatus
  inspection_complete: boolean
  inspected_folder_count: number
  uninspected_folder_count: number
  media_file_count: number
  other_file_count: number
  media_types: Record<string, number>
  expected_media_file_count: number | null
  expected_upload_complete: boolean | null
  blocker: string | null
}

const MEDIA_EXTENSIONS = new Set([
  '3gp', 'aac', 'arw', 'avi', 'bmp', 'cr2', 'cr3', 'dng', 'flac', 'gif', 'heic',
  'heif', 'jpeg', 'jpg', 'm4a', 'm4v', 'mkv', 'mov', 'mp3', 'mp4', 'mpeg', 'mpg',
  'nef', 'ogg', 'orf', 'png', 'raf', 'raw', 'rw2', 'tif', 'tiff', 'wav', 'webm', 'webp',
])

const MAX_FOLDER_DEPTH = 8
const MAX_INSPECTED_ITEMS = 5_000

function extensionOf(name: string): string {
  const lastDot = name.lastIndexOf('.')
  return lastDot > -1 ? name.slice(lastDot + 1).toLowerCase() : ''
}

export function unavailableOneDriveEvidence(blocker: string): OneDriveInspectionEvidence {
  return {
    status: 'UNVERIFIED',
    inspection_complete: false,
    inspected_folder_count: 0,
    uninspected_folder_count: 0,
    media_file_count: 0,
    other_file_count: 0,
    media_types: {},
    expected_media_file_count: null,
    expected_upload_complete: null,
    blocker,
  }
}

/** Validate the exact #307 durable mapping without any name/path fallback. */
export function validateExactContentRunFolderMapping(
  value: unknown,
  contentRunId: string,
  clientId: string,
): ExactMappingValidation {
  if (!value || typeof value !== 'object') {
    return { ok: false, blocker: 'exact_content_run_folder_not_mapped' }
  }
  const mapping = value as Partial<ExactContentRunFolderMapping>
  if (mapping.content_run_id !== contentRunId) {
    return { ok: false, blocker: 'mapped_folder_content_run_mismatch' }
  }
  if (mapping.client_id !== clientId) {
    return { ok: false, blocker: 'mapped_folder_client_mismatch' }
  }
  if (
    typeof mapping.drive_id !== 'string' || mapping.drive_id.length === 0
    || typeof mapping.month_folder_item_id !== 'string' || mapping.month_folder_item_id.length === 0
  ) {
    return { ok: false, blocker: 'exact_content_run_folder_mapping_incomplete' }
  }
  return { ok: true, mapping: mapping as ExactContentRunFolderMapping }
}

/** Confirm Graph returned metadata for the same durable drive/item IDs. */
export function validateExactFolderMetadata(
  folder: { driveId: string; itemId: string; name: string } | null,
  mapping: ExactContentRunFolderMapping,
): string | null {
  if (!folder) return 'authorised_folder_metadata_unavailable'
  if (folder.driveId !== mapping.drive_id || folder.itemId !== mapping.month_folder_item_id) {
    return 'mapped_folder_identity_mismatch'
  }
  return null
}

/**
 * Recursively inspect one exact folder selected by durable Graph IDs.
 *
 * VERIFIED means a complete inspection found at least the canonical expected
 * media count. MISSING means a complete inspection found none. PARTIAL means
 * media/coverage is incomplete or no canonical expectation is available.
 * UNVERIFIED means no authorised folder listing could be completed at all.
 */
export async function inspectExactOneDriveFolder(
  adapter: OneDriveReadAdapter,
  driveId: string,
  rootItemId: string,
  expectedMediaFileCount: number | null = null,
): Promise<OneDriveInspectionEvidence> {
  if (!adapter.listChildren) {
    return unavailableOneDriveEvidence('delegated_onedrive_folder_reader_unavailable')
  }

  const queue = [{ itemId: rootItemId, depth: 0 }]
  const seen = new Set<string>()
  const mediaTypes: Record<string, number> = {}
  let inspectedFolderCount = 0
  let mediaFileCount = 0
  let otherFileCount = 0
  let incomplete = false
  let uninspectedFolderCount = 0
  let inspectedItems = 0

  while (queue.length > 0) {
    const next = queue.shift()!
    if (seen.has(next.itemId)) continue
    seen.add(next.itemId)

    let children: OneDriveChildItem[] | null
    try {
      children = await adapter.listChildren(driveId, next.itemId)
    } catch {
      children = null
    }
    if (children == null) {
      incomplete = true
      uninspectedFolderCount += 1
      continue
    }
    inspectedFolderCount += 1

    for (const child of children) {
      inspectedItems += 1
      if (inspectedItems > MAX_INSPECTED_ITEMS) {
        incomplete = true
        uninspectedFolderCount += queue.length
        queue.length = 0
        break
      }
      if (child.isFolder) {
        if (next.depth < MAX_FOLDER_DEPTH) queue.push({ itemId: child.id, depth: next.depth + 1 })
        else {
          incomplete = true
          uninspectedFolderCount += 1
        }
        continue
      }

      const extension = extensionOf(child.name)
      if (MEDIA_EXTENSIONS.has(extension)) {
        mediaFileCount += 1
        mediaTypes[extension] = (mediaTypes[extension] ?? 0) + 1
      } else {
        otherFileCount += 1
      }
    }
  }

  if (inspectedFolderCount === 0) {
    return unavailableOneDriveEvidence('authorised_folder_listing_failed')
  }

  const expectedCount = Number.isInteger(expectedMediaFileCount) && expectedMediaFileCount! > 0
    ? expectedMediaFileCount
    : null
  const expectationMet = expectedCount == null ? null : mediaFileCount >= expectedCount
  let status: OneDriveVerificationStatus
  let blocker: string | null = null
  if (incomplete) {
    status = 'PARTIAL'
    blocker = 'folder_inspection_incomplete'
  } else if (mediaFileCount === 0) {
    status = 'MISSING'
  } else if (expectedCount == null) {
    status = 'PARTIAL'
    blocker = 'expected_upload_count_unavailable'
  } else if (!expectationMet) {
    status = 'PARTIAL'
    blocker = 'expected_upload_incomplete'
  } else {
    status = 'VERIFIED'
  }

  return {
    status,
    inspection_complete: !incomplete,
    inspected_folder_count: inspectedFolderCount,
    uninspected_folder_count: uninspectedFolderCount,
    media_file_count: mediaFileCount,
    other_file_count: otherFileCount,
    media_types: mediaTypes,
    expected_media_file_count: expectedCount,
    expected_upload_complete: expectationMet,
    blocker,
  }
}
