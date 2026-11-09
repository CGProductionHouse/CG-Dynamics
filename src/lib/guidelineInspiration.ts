/** Public social references only. Never fetch/embed third-party content here. */
export function guidelineInspiration(value: unknown): { url: string; platform: string } | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text || text.length > 2048 || /[\s\\]/.test(text) || !/^https:\/\//i.test(text)) return null
  try {
    const url = new URL(text)
    if (url.username || url.password || url.port || !/^\/[a-z0-9@%_-]/i.test(url.pathname)) return null
    const platforms: Record<string, string> = {
      'tiktok.com': 'TikTok', 'www.tiktok.com': 'TikTok', 'm.tiktok.com': 'TikTok', 'vt.tiktok.com': 'TikTok', 'vm.tiktok.com': 'TikTok',
      'instagram.com': 'Instagram', 'www.instagram.com': 'Instagram', 'm.instagram.com': 'Instagram',
      'facebook.com': 'Facebook', 'www.facebook.com': 'Facebook', 'm.facebook.com': 'Facebook', 'web.facebook.com': 'Facebook', 'fb.watch': 'Facebook',
      'youtube.com': 'YouTube', 'www.youtube.com': 'YouTube', 'm.youtube.com': 'YouTube', 'youtu.be': 'YouTube',
    }
    const platform = platforms[url.hostname]
    if (!platform || /^\/(?:redirect|l\.php|login|accounts)(?:\/|$)/i.test(url.pathname)) return null
    return { url: url.href, platform }
  } catch { return null }
}

export function inspirationInputError(url: string | null | undefined, note: string | null | undefined): string | null {
  if (url?.trim() && !guidelineInspiration(url)) return 'Use an HTTPS TikTok, Instagram, Facebook or YouTube link.'
  if (note && note.trim().length > 1000) return 'Keep the inspiration note under 1,000 characters.'
  return null
}
