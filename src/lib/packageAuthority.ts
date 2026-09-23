export interface PackageSettings {
  professional_videos_per_month: number | null
  reels_per_month: number | null
  photo_posts_per_month: number | null
  design_posters_per_month: number | null
  animated_posters_per_month: number | null
  campaign_management_included: boolean | null
  monthly_campaign_budget: number | null
  shoot_days_per_month: number | null
  website_updates_per_month: number | null
  other_agreed_deliverables: string | null
  package_notes: string | null
  package_exclusions: string | null
}

export type PackageFieldState = 'known' | 'explicit_zero' | 'unknown'
export type PackageFieldStates = Record<keyof PackageSettings, PackageFieldState>

export interface PackageVerificationReceipt {
  status: 'confirmed'
  version: 1 | 2
  confirmed_at: string
  confirmed_by_profile_id: string
  evidence_note: string
  inference_note: string
  source_references: string[]
  field_states?: PackageFieldStates
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

export const PACKAGE_FIELDS = Object.keys(EMPTY_PACKAGE_SETTINGS) as Array<keyof PackageSettings>

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
    else if (value === null) result[key] = null
  }
  if (typeof source.campaign_management_included === 'boolean') {
    result.campaign_management_included = source.campaign_management_included
  } else if (source.campaign_management_included === null) result.campaign_management_included = null
  for (const key of ['other_agreed_deliverables', 'package_notes', 'package_exclusions'] as const) {
    if (typeof source[key] === 'string') result[key] = source[key]
    else if (source[key] === null) result[key] = null
  }
  return result
}

function readVerification(raw: unknown): PackageVerificationReceipt | null {
  const verification = record(record(raw)?.verification)
  if (
    verification?.status !== 'confirmed'
    || (verification.version !== 1 && verification.version !== 2)
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
  const fieldStates = record(verification.field_states)
  if (verification.version === 2 && (
    !fieldStates
    || PACKAGE_FIELDS.some(field => !['known', 'explicit_zero', 'unknown'].includes(String(fieldStates[field])))
  )) return null
  return {
    status: 'confirmed',
    version: verification.version,
    confirmed_at: verification.confirmed_at,
    confirmed_by_profile_id: verification.confirmed_by_profile_id,
    evidence_note: verification.evidence_note.trim(),
    inference_note: typeof verification.inference_note === 'string' ? verification.inference_note.trim() : '',
    source_references: verification.source_references.map(value => (value as string).trim()),
    ...(verification.version === 2 ? { field_states: fieldStates as PackageFieldStates } : {}),
  }
}

export function buildPackageFieldStates(settings: PackageSettings): PackageFieldStates {
  return Object.fromEntries(PACKAGE_FIELDS.map(field => {
    const value = settings[field]
    if (value === null) return [field, 'unknown']
    if (typeof value === 'string' && value.trim() === '') return [field, 'unknown']
    if (PACKAGE_NUMBER_FIELDS.includes(field as (typeof PACKAGE_NUMBER_FIELDS)[number]) && value === 0) {
      return [field, 'explicit_zero']
    }
    return [field, 'known']
  })) as PackageFieldStates
}

function receiptMatchesValues(settings: Partial<PackageSettings>, verification: PackageVerificationReceipt): boolean {
  if (verification.version === 1) return PACKAGE_FIELDS.every(field => settings[field] !== null)
  return PACKAGE_FIELDS.every(field => {
    const value = settings[field]
    const state = verification.field_states?.[field]
    if (state === 'unknown') return value === null
    if (state === 'explicit_zero') return typeof value === 'number' && value === 0
    if (state !== 'known' || value === null) return false
    if (PACKAGE_NUMBER_FIELDS.includes(field as (typeof PACKAGE_NUMBER_FIELDS)[number])) {
      return typeof value === 'number' && value > 0
    }
    if (typeof value === 'string') return value.trim().length > 0
    return typeof value === 'boolean'
  })
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
  if (!verification || missingFields.length > 0 || !receiptMatchesValues(explicitValues, verification)) {
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
