/** Names report inputs, not provider freshness or the origin of every individual metric. */
export function reportSourceAttribution(
  tab: string,
  available: { meta: boolean; tiktok: boolean; googleAds: boolean },
): string | null {
  const sources = [
    available.meta && ['overview', 'facebook', 'instagram'].includes(tab) ? 'Meta Business Sync' : null,
    available.tiktok && ['overview', 'tiktok'].includes(tab) ? 'TikTok reporting' : null,
    available.googleAds && ['overview', 'google'].includes(tab) ? 'Google Ads Sync' : null,
  ].filter((source): source is string => source !== null)

  if (sources.length === 0) return null
  if (sources.length === 1) return `Source: ${sources[0]}.`
  return `Sources: ${sources.slice(0, -1).join(', ')} and ${sources.at(-1)}.`
}
