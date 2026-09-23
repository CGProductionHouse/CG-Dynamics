export interface PackageSettings {
  professional_videos_per_month: number
  reels_per_month: number
  photo_posts_per_month: number
  design_posters_per_month: number
  animated_posters_per_month: number
  campaign_management_included: boolean
  monthly_campaign_budget: number
  shoot_days_per_month: number
  website_updates_per_month: number
  other_agreed_deliverables: string
  package_notes: string
  package_exclusions: string
}

export interface PackageVerificationReceipt {
  status: 'confirmed'
  version: 1
  confirmed_at: string
  confirmed_by_profile_id: string
  evidence_note: string
  inference_note: string
  source_references: string[]
}

export interface PackageAuthorityState {
  status: 'confirmed' | 'unverified'
  settings: PackageSettings | null
  verification: PackageVerificationReceipt | null
  explicitValues: Partial<PackageSettings>
  missingFields: Array<keyof PackageSettings>
}

export const PACKAGE_NUMBER_FIELDS = [
  'professional_videos_per_month',
  'reels_per_month',
  'photo_posts_per_month',
  'design_posters_per_month',
  'animated_posters_per_month',
  'monthly_campaign_budget',
  'shoot_days_per_month',
  'website_updates_per_month',
] as const satisfies ReadonlyArray<keyof PackageSettings>

export const EMPTY_PACKAGE_SETTINGS: PackageSettings = {
  professional_videos_per_month: 0,
  reels_per_month: 0,
  photo_posts_per_month: 0,
  design_posters_per_month: 0,
  animated_posters_per_month: 0,
  campaign_management_included: false,
  monthly_campaign_budget: 0,
  shoot_days_per_month: 0,
  website_updates_per_month: 0,
  other_agreed_deliverables: '',
  package_notes: '',
  package_exclusions: '',
}

const PACKAGE_FIELDS = Object.keys(EMPTY_PACKAGE_SETTINGS) as Array<keyof PackageSettings>

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function explicitPackageValues(raw: unknown): Partial<PackageSettings> {
  const source = record(raw)
  if (!source) return {}
  const result: Partial<PackageSettings> = {}
  for (const key of PACKAGE_NUMBER_FIELDS) {
    const value = source[key]
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) result[key] = value
  }
  if (typeof source.campaign_management_included === 'boolean') {
    result.campaign_management_included = source.campaign_management_included
  }
  for (const key of ['other_agreed_deliverables', 'package_notes', 'package_exclusions'] as const) {
    if (typeof source[key] === 'string') result[key] = source[key]
  }
  return result
}

function readVerification(raw: unknown): PackageVerificationReceipt | null {
  const verification = record(record(raw)?.verification)
  if (
    verification?.status !== 'confirmed'
    || verification.version !== 1
    || typeof verification.confirmed_at !== 'string'
    || !Number.isFinite(Date.parse(verification.confirmed_at))
    || typeof verification.confirmed_by_profile_id !== 'string'
    || verification.confirmed_by_profile_id.length === 0
    || typeof verification.evidence_note !== 'string'
    || verification.evidence_note.trim().length < 12
    || !Array.isArray(verification.source_references)
    || verification.source_references.length === 0
    || verification.source_references.some(value => typeof value !== 'string' || value.trim().length === 0)
  ) return null
  return {
    status: 'confirmed',
    version: 1,
    confirmed_at: verification.confirmed_at,
    confirmed_by_profile_id: verification.confirmed_by_profile_id,
    evidence_note: verification.evidence_note.trim(),
    inference_note: typeof verification.inference_note === 'string' ? verification.inference_note.trim() : '',
    source_references: verification.source_references.map(value => (value as string).trim()),
  }
}

/**
 * A package becomes authority only when every field was explicitly stored and
 * the server-authored confirmation receipt is complete. Missing values never
 * inherit the legacy display defaults, so blank data can never become zero.
 */
export function readPackageAuthority(raw: unknown): PackageAuthorityState {
  const explicitValues = explicitPackageValues(raw)
  const missingFields = PACKAGE_FIELDS.filter(key => explicitValues[key] === undefined)
  const verification = readVerification(raw)
  if (!verification || missingFields.length > 0) {
    return { status: 'unverified', settings: null, verification, explicitValues, missingFields }
  }
  return {
    status: 'confirmed',
    settings: explicitValues as PackageSettings,
    verification,
    explicitValues,
    missingFields: [],
  }
}

/** Legacy display reader only. Never use this to decide authoritative scope. */
export function readPackageSettings(raw: unknown): PackageSettings {
  return { ...EMPTY_PACKAGE_SETTINGS, ...explicitPackageValues(raw) }
}

export function packageAuthorityLabel(raw: unknown): string {
  const authority = readPackageAuthority(raw)
  return authority.status === 'confirmed' && authority.verification
    ? `Confirmed ${new Date(authority.verification.confirmed_at).toLocaleDateString('en-ZA')}`
    : 'Package unverified'
}
