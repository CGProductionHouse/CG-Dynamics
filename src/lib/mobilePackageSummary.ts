import type { readPackageAuthority } from './db/clients'

export function mobilePackageSummary(authority: ReturnType<typeof readPackageAuthority>) {
  const pkg = authority.settings
  if (authority.status !== 'confirmed' || !pkg) return 'Package needs review'
  const quantities = [
    [pkg.design_posters_per_month, 'posters'],
    [pkg.photo_posts_per_month, 'photos'],
    [pkg.professional_videos_per_month, 'videos'],
    [pkg.reels_per_month, 'reels'],
  ] as const
  const parts = quantities.filter(([value]) => typeof value === 'number' && value > 0).map(([value, label]) => `${value} ${label}`)
  if (quantities.some(([value]) => value === null)) parts.push('some quantities unconfirmed')
  return parts.join(' · ') || 'Package verified · view scope'
}

