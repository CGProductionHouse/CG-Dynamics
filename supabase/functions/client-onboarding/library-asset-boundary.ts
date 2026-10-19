// Recheck live provider ancestry before granting or serving a curated asset.
// Publication is not authority to keep serving a file moved into a private tree.
export async function isAssetInsideCategory(
  read: (id: string) => Promise<{ id: string; driveId: string; parentId: string; file: boolean; mime: string | null; size: number | null } | null>,
  expected: { itemId: string; driveId: string; categoryId: string; rootId: string; mime: string | null; size: number | null },
) {
  const category = await read(expected.categoryId)
  if (!category || category.id !== expected.categoryId || category.file || category.driveId !== expected.driveId || category.parentId !== expected.rootId) return false
  let id = expected.itemId
  const seen = new Set<string>()
  for (let depth = 0; depth <= 5; depth++) {
    if (seen.has(id)) return false
    seen.add(id)
    const item = await read(id)
    if (!item || item.id !== id || item.driveId !== expected.driveId) return false
    if (depth === 0 && (!item.file || item.mime !== expected.mime || item.size !== expected.size)) return false
    if (depth > 0 && item.file) return false
    if (item.parentId === expected.categoryId) return true
    if (!item.parentId) return false
    id = item.parentId
  }
  return false
}
