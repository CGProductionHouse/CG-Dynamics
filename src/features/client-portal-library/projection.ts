import { CLIENT_PORTAL_LIBRARY_CATEGORIES, type ClientPortalLibraryCategory, type ClientPortalLibraryFilesPage, type ClientPortalLibraryState } from './types'

const record = (value: unknown): value is Record<string, unknown> => value != null && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const nullableText = (value: unknown): value is string | null => value === null || typeof value === 'string'
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const period = (value: unknown, min: number, max: number): value is number => count(value) && value >= min && value <= max
const category = (value: unknown): value is ClientPortalLibraryCategory => CLIENT_PORTAL_LIBRARY_CATEGORIES.some(item => item === value)
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const month = /^\d{4}-(0[1-9]|1[0-2])$/
function timestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) return false
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10)
}

/** Validate the existing server projection, never fill unknown counts or carry extra transport fields. */
export function projectLibraryState(value: unknown): ClientPortalLibraryState | null {
  if (!record(value) || !text(value.clientName) || !nullableText(value.clientLogoUrl)
    || typeof value.available !== 'boolean' || !Array.isArray(value.categories)
    || (!value.available && value.categories.length !== 0)) return null
  const categories: ClientPortalLibraryState['categories'] = []
  const seen = new Set<string>()
  for (const item of value.categories) {
    if (!record(item) || !category(item.category) || seen.has(item.category) || !count(item.fileCount) || !Array.isArray(item.years)) return null
    seen.add(item.category)
    const years: ClientPortalLibraryState['categories'][number]['years'] = []
    const seenYears = new Set<number>()
    for (const year of item.years) {
      if (!record(year) || !period(year.year, 2000, 2100) || seenYears.has(year.year) || !count(year.fileCount) || !Array.isArray(year.months)) return null
      seenYears.add(year.year)
      const months: typeof years[number]['months'] = []
      const seenMonths = new Set<number>()
      for (const entry of year.months) {
        if (!record(entry) || !period(entry.month, 1, 12) || seenMonths.has(entry.month) || !count(entry.fileCount)) return null
        seenMonths.add(entry.month)
        months.push({ month: entry.month, fileCount: entry.fileCount })
      }
      if (months.reduce((sum, entry) => sum + entry.fileCount, 0) !== year.fileCount) return null
      years.push({ year: year.year, fileCount: year.fileCount, months })
    }
    if (item.category === 'brand_identity' ? years.length !== 0 : years.reduce((sum, year) => sum + year.fileCount, 0) !== item.fileCount) return null
    categories.push({ category: item.category, fileCount: item.fileCount, years })
  }
  return { clientName: value.clientName, clientLogoUrl: value.clientLogoUrl, available: value.available, categories }
}

export function projectLibraryFiles(value: unknown, requestedCategory: ClientPortalLibraryCategory, offset: number): ClientPortalLibraryFilesPage | null {
  if (!record(value) || !Array.isArray(value.assets) || value.assets.length > 24
    || !(value.nextOffset === null || (count(value.nextOffset) && value.nextOffset === offset + 24))) return null
  const assets: ClientPortalLibraryFilesPage['assets'] = []
  const seen = new Set<string>()
  for (const asset of value.assets) {
    if (!record(asset) || !text(asset.id) || !uuid.test(asset.id) || seen.has(asset.id.toLowerCase())
      || asset.category !== requestedCategory || !text(asset.displayName) || !nullableText(asset.mimeType)
      || !(asset.sizeBytes === null || count(asset.sizeBytes)) || !timestamp(asset.publishedAt)
      || !nullableText(asset.deliverableTitle) || !(asset.planMonth === null || (typeof asset.planMonth === 'string' && month.test(asset.planMonth)))) return null
    seen.add(asset.id.toLowerCase())
    assets.push({ id: asset.id, category: requestedCategory, displayName: asset.displayName,
      mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, publishedAt: asset.publishedAt,
      deliverableTitle: asset.deliverableTitle, planMonth: asset.planMonth })
  }
  return { assets, nextOffset: value.nextOffset as number | null }
}
