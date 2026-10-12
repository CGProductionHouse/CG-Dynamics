import type { DriveChild } from '../_shared/portal-visibility.ts'

/** Scope discovery to the existing exact-client production binding, never a name guess. */
export function resolveBoundClientRoot(
  clientId: string,
  clientsDriveId: string,
  mapping: { client_id: string; drive_id: string; client_folder_item_id: string } | null,
  clientsChildren: DriveChild[],
): { driveId: string; itemId: string } | { error: string; httpStatus: 404 | 409 } {
  if (!mapping || !clientId || mapping.client_id !== clientId ||
    mapping.drive_id !== clientsDriveId || !clientsDriveId || !mapping.client_folder_item_id.trim()) {
    return { error: 'Verified exact-client OneDrive mapping required.', httpStatus: 409 }
  }
  const matches = clientsChildren.filter(item => item.isFolder && item.id === mapping.client_folder_item_id)
  if (matches.length !== 1) {
    return { error: 'Mapped client folder is missing or ambiguous under Clients.', httpStatus: matches.length ? 409 : 404 }
  }
  return { driveId: mapping.drive_id, itemId: matches[0].id }
}
