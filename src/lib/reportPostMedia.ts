// Only public social-provider media is eligible. Never turn internal storage,
// arbitrary tracker URLs or an embedded access token into client-visible media.
export function reportPostImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || /(?:access_token|authorization|api_key|secret)|[?&][^=&]*%/i.test(url.search)) return null
    return ['fbcdn.net', 'cdninstagram.com', 'tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com']
      .some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : null
  } catch { return null }
}

export function reportPostPermalink(value: unknown, platform: string | null): string | null {
  if (typeof value !== 'string') return null
  const hosts = platform === 'facebook' ? ['facebook.com', 'fb.watch']
    : platform === 'instagram' ? ['instagram.com'] : platform === 'tiktok' ? ['tiktok.com'] : []
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || /(?:access_token|authorization|api_key|secret)|[?&][^=&]*%/i.test(url.search)) return null
    return hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : null
  } catch { return null }
}
