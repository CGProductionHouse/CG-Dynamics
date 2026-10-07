export const SERVICE_KEYS = ['linkedin', 'google_ads', 'meta_ads', 'instagram', 'tiktok', 'google_business_profile', 'website_digital_experience'] as const
export type ServiceKey = typeof SERVICE_KEYS[number]
export type EntitlementState = 'included' | 'not_included' | 'unknown' | 'not_applicable'
export interface ServiceEntitlement {
  service_key: ServiceKey; state: EntitlementState
  connection: 'connected' | 'needs_connection' | 'unavailable'
  verified_at: string | null; requested_at: string | null
}
export function visibleClientServices(items: readonly ServiceEntitlement[] | null, surface: 'overview' | 'performance'): ServiceEntitlement[] {
  // Overview is a results destination, never a setup or upsell surface.
  if (surface === 'overview' || !items) return []
  return SERVICE_KEYS.flatMap(key => {
    const item = items.find(row => row.service_key === key)
    if (!item?.verified_at || !Number.isFinite(Date.parse(item.verified_at))) return []
    return ['included', 'not_included', 'not_applicable'].includes(item.state) ? [item] : []
  }).slice(0, 7)
}
export function parseServiceEntitlements(data: unknown): ServiceEntitlement[] {
  if (!Array.isArray(data) || data.length !== SERVICE_KEYS.length) throw new Error('Incomplete service verification')
  const seen = new Set<string>()
  return data.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid service verification')
    const row = item as Record<string, unknown>
    if (!SERVICE_KEYS.includes(row.service_key as ServiceKey) || seen.has(String(row.service_key))
      || !['included', 'not_included', 'unknown', 'not_applicable'].includes(String(row.state))
      || !['connected', 'needs_connection', 'unavailable'].includes(String(row.connection))) throw new Error('Invalid service verification')
    for (const key of ['verified_at', 'requested_at']) {
      if (row[key] !== null && (typeof row[key] !== 'string' || !Number.isFinite(Date.parse(row[key] as string)))) throw new Error('Invalid service timestamp')
    }
    if (row.state !== 'unknown' && !row.verified_at) throw new Error('Unverified service scope')
    seen.add(String(row.service_key))
    return { service_key: row.service_key as ServiceKey, state: row.state as EntitlementState,
      connection: row.connection as ServiceEntitlement['connection'], verified_at: row.verified_at as string | null, requested_at: row.requested_at as string | null }
  })
}
export const SERVICE_COPY: Record<ServiceKey, { name: string; opportunityName?: string; benefit: string; value: string; icon: 'linkedin' | 'google' | 'facebook' | 'instagram' | 'tiktok' | 'web' }> = {
  linkedin: { name: 'LinkedIn', icon: 'linkedin', benefit: 'Build credibility with professional decision-makers. Share your expertise, grow your network and support recruitment with a considered business presence.', value: 'A professional voice for your business.' },
  google_ads: { name: 'Google Ads', icon: 'google', benefit: 'Reach people already searching for what you offer. A focused paid-search plan can connect relevant searches with calls and enquiries, with measurement built in.', value: 'Intent-led search, with clear measurement.' },
  meta_ads: { name: 'Meta Ads', icon: 'facebook', benefit: 'Give strong creative a targeted audience. Explore local reach and relevant retargeting through paid Facebook and Instagram campaigns, separate from organic content.', value: 'Targeted distribution for your campaign creative.' },
  instagram: { name: 'Instagram', icon: 'instagram', benefit: 'Help people discover the visual side of your brand. Showcase your work through a cohesive feed, Stories and Reels that make your business recognisable.', value: 'A visual home for your brand story.' },
  tiktok: { name: 'TikTok', icon: 'tiktok', benefit: 'Bring your business to life through native short-form video. Build discovery with useful, engaging stories shaped for how people watch on TikTok.', value: 'Short-form stories made for discovery.' },
  google_business_profile: { name: 'Google Business Profile', icon: 'google', benefit: 'Make local discovery easier on Google Search and Maps. Keep your presence useful for people looking for directions, contact details and reviews.', value: 'A clear local presence on Search and Maps.' },
  website_digital_experience: { name: 'Website / Digital Experience', opportunityName: 'Premium CG-built website', icon: 'web', benefit: 'Give your brand a premium digital home, built by CG. Explore a website shaped around your business, with a clear enquiry journey and an agreed measurement plan. Scope and pricing are confirmed with you before anything is added to your package.', value: 'A considered digital destination and enquiry journey.' },
}

export function servicePresentation(item: ServiceEntitlement) {
  if (item.state === 'not_included') return { kind: 'opportunity', label: 'Beyond your current package', canRequest: !item.requested_at } as const
  if (item.state === 'included' && item.connection === 'connected') return { kind: 'connected', label: 'Included · connected', canRequest: false } as const
  if (item.state === 'included' && item.connection === 'needs_connection') return { kind: 'connection', label: 'Included · connection needed', canRequest: false } as const
  return { kind: 'neutral', label: item.state === 'included' ? 'Included · connection not verified' : item.state === 'not_applicable' ? 'Not applicable to your package' : 'Package verification pending', canRequest: false } as const
}
