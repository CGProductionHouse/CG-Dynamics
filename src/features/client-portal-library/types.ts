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

export interface ClientPortalLibraryState {
  clientName: string
  clientLogoUrl: string | null
  available: boolean
  categories: ClientPortalLibraryCategory[]
  assets: ClientPortalLibraryAsset[]
}
