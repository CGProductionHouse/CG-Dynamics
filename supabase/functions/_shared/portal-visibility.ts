// Shared pure helpers for Brand Hub (#396).
//
// visiblePortalMonths: next calendar month visible on the 1st of the prior month.
// CG business timezone: Africa/Johannesburg (SAST, UTC+2, no DST).
//
// portalClientSlug: canonical underscore-normalised portal root slug.
// resolvePortalMapping: pure/fakeable portal root + category resolution.
//
// Pure functions — no network, no Deno, no React.

/** CG business timezone for portal visibility. */
export const PORTAL_VISIBILITY_TIMEZONE = 'Africa/Johannesburg' as const

/**
 * Return the set of { year, month } pairs currently visible to a client.
 * Always includes the current month; always includes the next calendar month.
 * Year boundary: Dec -> Jan rolls the year.
 */
export function visiblePortalMonths(now = new Date()): Array<{ year: number; month: number }> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PORTAL_VISIBILITY_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0)
  const year = get('year')
  const month = get('month')
  const months: Array<{ year: number; month: number }> = [{ year, month }]
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  months.push({ year: nextYear, month: nextMonth })
  return months
}

// ── Canonical portal slug ─────────────────────────────────────────────────────

/**
 * Canonical underscore-normalised portal client slug.
 *
 * Replaces runs of non-alphanumeric characters with a single underscore,
 * trims leading/trailing underscores, preserves case.
 *
 * Examples (from approved physical OneDrive names):
 *   Red Oak              -> Red_Oak
 *   AV Event Life        -> AV_Event_Life
 *   C&L Innovations      -> C_L_Innovations
 *   RC-Polypipe          -> RC_Polypipe
 *   Bloem Marble & Granite -> Bloem_Marble_Granite
 *   Dulux Paint & Paper Bloemfontein -> Dulux_Paint_Paper_Bloemfontein
 */
export function portalClientSlug(clientName: string): string {
  return clientName
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Expected portal root folder name for a given client name. */
export function portalRootFolderName(clientName: string): string {
  return `A_ClientPortal_${portalClientSlug(clientName)}`
}

// ── Pure portal mapping resolver ──────────────────────────────────────────────

export interface DriveChild {
  id: string
  name: string
  isFolder: boolean
}

export interface PortalMappingPlan {
  rootItemId: string
  rootFolderName: string
  categories: Array<{
    key: string
    expectedName: string
    folderId: string
    folderName: string
  }>
}

export interface PortalMappingError {
  error: string
  httpStatus: number
}

export const PORTAL_REQUIRED_CATEGORIES = [
  { key: 'brand_identity', expectedName: 'Brand Identity' },
  { key: 'graphic_design', expectedName: 'Graphic Design' },
  { key: 'video', expectedName: 'Video' },
] as const

/**
 * Pure portal root + category resolution.
 *
 * Finds the exact A_ClientPortal_<slug> root among rootChildren,
 * then validates all three required categories among categoryChildren.
 * Uses exact string equality only — no fuzzy matching, no case folding.
 *
 * Requires exactly one match for root and each category.
 * Zero matches → not-found; more than one → conflict (fail closed).
 * Returns either a complete mapping plan or an error. No partial state.
 */
export function resolvePortalMapping(
  clientName: string,
  rootChildren: readonly DriveChild[],
  categoryChildren: readonly DriveChild[],
): PortalMappingPlan | PortalMappingError {
  const expectedRootName = portalRootFolderName(clientName)
  const rootMatches = rootChildren.filter(c => c.isFolder && c.name === expectedRootName)
  if (rootMatches.length === 0) return { error: `Portal folder not found: ${expectedRootName}`, httpStatus: 404 }
  if (rootMatches.length > 1) return { error: `Duplicate portal root folders: ${expectedRootName} (${rootMatches.length} found)`, httpStatus: 409 }
  const root = rootMatches[0]

  const categories: PortalMappingPlan['categories'] = []
  for (const cat of PORTAL_REQUIRED_CATEGORIES) {
    const matches = categoryChildren.filter(c => c.isFolder && c.name === cat.expectedName)
    if (matches.length === 0) return { error: `Required portal category not found: ${cat.expectedName}`, httpStatus: 404 }
    if (matches.length > 1) return { error: `Duplicate portal category: ${cat.expectedName} (${matches.length} found)`, httpStatus: 409 }
    categories.push({ key: cat.key, expectedName: cat.expectedName, folderId: matches[0].id, folderName: matches[0].name })
  }

  return { rootItemId: root.id, rootFolderName: root.name, categories }
}
