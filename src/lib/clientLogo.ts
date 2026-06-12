// Shared client-logo resolution.
//
// Logos live in /public/client-logos and are named by a slug derived from the
// client name (see scripts/sync-client-logos.mjs and CLIENT_LOGO_MAINTENANCE.md).
// The runtime slug must faithfully match a client name, so unlike the file
// maintenance script it does NOT strip "extra" words — a client legitimately
// named e.g. "New Era" must resolve to new-era, not era.

export const CLIENT_LOGO_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'svg'] as const

export function clientSlug(name: string): string {
  return name
    // split camelCase / PascalCase joins: RedOak -> Red Oak
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Ordered list of logo sources to try:
//   1. clients.logo_url when filled in
//   2. local /client-logos/<slug>.<ext> for each supported extension
// Consumers fall back to initials when every candidate fails to load.
export function clientLogoCandidates(client: { name: string; logo_url?: string | null }): string[] {
  const candidates: string[] = []
  if (client.logo_url && client.logo_url.trim()) {
    candidates.push(client.logo_url.trim())
  }
  const slug = clientSlug(client.name)
  if (slug) {
    for (const ext of CLIENT_LOGO_EXTENSIONS) {
      candidates.push(`/client-logos/${slug}.${ext}`)
    }
  }
  return candidates
}

export function clientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
