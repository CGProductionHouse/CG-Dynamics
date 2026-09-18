export const CLIENT_PORTAL_LIBRARY_CATEGORIES = [
  'brand_identity',
  'graphic_design',
  'video',
  'photography',
] as const

export type ClientPortalLibraryCategory = typeof CLIENT_PORTAL_LIBRARY_CATEGORIES[number]

export interface ClientPortalLibraryAsset {
  id: string
  category: ClientPortalLibraryCategory
  displayName: string
  mimeType: string | null
  sizeBytes: number | null
  publishedAt: string
  deliverableTitle: string | null
  planMonth: string | null
}

export interface ClientPortalLibraryMonthSummary {
  month: number
  fileCount: number
}

export interface ClientPortalLibraryYearSummary {
  year: number
  fileCount: number
  months: ClientPortalLibraryMonthSummary[]
}

export interface ClientPortalLibraryCategorySummary {
  category: ClientPortalLibraryCategory
  fileCount: number
  years: ClientPortalLibraryYearSummary[]
}

export interface ClientPortalLibraryState {
  clientName: string
  clientLogoUrl: string | null
  available: boolean
  categories: ClientPortalLibraryCategorySummary[]
}

export interface ClientPortalLibraryFilesPage {
  assets: ClientPortalLibraryAsset[]
  nextOffset: number | null
}

export type ClientPortalAssetPurpose = 'inline' | 'download' | 'stream' | 'thumbnail'

export interface ClientPortalAssetAccess {
  url: string
  expiresAt: string
}
