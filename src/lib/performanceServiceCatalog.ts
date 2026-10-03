/** Discovery is not proof of an entitlement or a provider connection. */
export const PERFORMANCE_SERVICE_TABS = [
  { key: 'overview', label: 'Overview', icon: 'overview' },
  { key: 'facebook', label: 'Facebook', icon: 'facebook' },
  { key: 'instagram', label: 'Instagram', icon: 'instagram' },
  { key: 'tiktok', label: 'TikTok', icon: 'tiktok' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'linkedin' },
  { key: 'google', label: 'Google', icon: 'google' },
  { key: 'web', label: 'Website Performance', icon: 'web' },
  { key: 'email', label: 'Email marketing', icon: 'email' },
] as const

/** User-initiated conversation only. Never sends or changes a package. */
export function serviceConversationUrl(service: string, clientName?: string) {
  const message = `Hi Amonique, I'd like to discuss ${service}${clientName ? ` for ${clientName}` : ''} and our monthly package.`
  return `https://wa.me/27791152339?text=${encodeURIComponent(message)}`
}
