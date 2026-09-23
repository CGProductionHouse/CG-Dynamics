import { readPackageAuthority, type PackageSettings } from './packageAuthority.ts'

export type SocialProviderEligibilityState = 'eligible' | 'excluded' | 'unresolved'

export interface SocialProviderEligibility {
  state: SocialProviderEligibilityState
  reason: string
}

const SOCIAL_DELIVERABLE_FIELDS = [
  'professional_videos_per_month',
  'reels_per_month',
  'photo_posts_per_month',
  'design_posters_per_month',
  'animated_posters_per_month',
] as const satisfies ReadonlyArray<keyof PackageSettings>

const EXPLICIT_NON_SOCIAL_SCOPE = [
  /no recurring social(?:-|\s)media(?: management)? package/,
  /no ongoing social(?:-|\s)media package/,
  /remove(?:d)? from recurring social(?:-|\s)management/,
  /does not manage (?:their )?socials?/,
  /videos? (?:are )?supplied only/,
  /website service only/,
] as const

const EXPLICIT_SOCIAL_SCOPE = [
  /social(?:-|\s)media management/,
  /caption generation/,
  /instagram (?:story|stories)/,
  /facebook post/,
] as const

function scopeText(settings: PackageSettings): string {
  return [settings.other_agreed_deliverables, settings.package_notes, settings.package_exclusions]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLocaleLowerCase()
}

/**
 * Exact confirmed package/service scope is the provider-rollout authority.
 * Active status alone never makes a client eligible, and unknown scope is held.
 */
export function classifySocialProviderEligibility(packageSettings: unknown): SocialProviderEligibility {
  const authority = readPackageAuthority(packageSettings)
  if (authority.status !== 'confirmed' || !authority.settings) {
    return { state: 'unresolved', reason: 'Package/service scope is not currently confirmed.' }
  }

  const text = scopeText(authority.settings)
  if (EXPLICIT_NON_SOCIAL_SCOPE.some(pattern => pattern.test(text))) {
    return { state: 'excluded', reason: 'Confirmed package/service scope explicitly excludes recurring social management.' }
  }

  const hasSocialDeliverable = SOCIAL_DELIVERABLE_FIELDS.some(field => {
    const value = authority.settings?.[field]
    return typeof value === 'number' && value > 0
  })
  if (hasSocialDeliverable || EXPLICIT_SOCIAL_SCOPE.some(pattern => pattern.test(text))) {
    return { state: 'eligible', reason: 'Confirmed package/service scope includes recurring social content or management.' }
  }

  return { state: 'unresolved', reason: 'Confirmed package does not yet prove or exclude recurring social service scope.' }
}
