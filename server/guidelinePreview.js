const origin = 'https://www.cgdynamics.co.za'
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const tag = (name, value, property = false) => `<meta ${property ? 'property' : 'name'}="${name}" content="${escape(value)}" />`

export function guidelinePreviewTarget(url) {
  const parsed = new URL(url, origin)
  const path = parsed.pathname.match(/^\/guidelines\/([^/]+)\/([^/]+)\/?$/)
  const slug = path ? path[1] : parsed.searchParams.getAll('slug').length === 1 ? parsed.searchParams.get('slug') : ''
  const token = path ? path[2] : parsed.searchParams.getAll('token').length === 1 ? parsed.searchParams.get('token') : ''
  return slug && slug.length <= 180 && /^[a-z0-9]+(-[a-z0-9]+)*-content-guideline$/.test(slug)
    && /^[a-f0-9]{64}$/.test(token ?? '') ? { slug, token } : null
}

function metadata(snapshot, target, logoForClient) {
  const name = snapshot?.client?.name
  const guide = snapshot?.guide
  if (typeof name !== 'string' || !name.trim() || name.length > 250 || !Array.isArray(guide?.videos) || !guide.videos.length) return null
  const title = `${name} · Content Guideline`
  const month = typeof guide.month === 'string' && /^\d{4}-\d{2}-01$/.test(guide.month) ? new Date(`${guide.month}T12:00:00Z`) : null
  const period = month && Number.isFinite(month.getTime()) ? new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(month) : ''
  const count = guide.videos.length
  const description = `${period ? `${period} · ` : ''}${count} video${count === 1 ? '' : 's'}. Ready for your review.`
  const published = Date.parse(guide.published_at)
  const canonical = `${origin}/guidelines/${target.slug}/${target.token}?v=cg2${Number.isFinite(published) ? `-${published}` : ''}`
  const logo = logoForClient(name)
  return { title, description, canonical, image: typeof logo === 'string' && /^\/client-logos\/[a-z0-9-]+\.(png|jpe?g|webp)$/.test(logo) ? `${origin}${logo}` : null, name }
}

export function renderGuidelinePreview(template, meta) {
  const title = meta?.title ?? 'Content guideline unavailable | CG'
  const tags = [tag('robots', 'noindex, nofollow, noarchive'), tag('referrer', 'no-referrer')]
  if (meta) {
    tags.push(tag('description', meta.description), tag('og:title', title, true), tag('og:description', meta.description, true),
      tag('og:type', 'website', true), tag('og:site_name', 'CG Production House', true), tag('og:url', meta.canonical, true),
      tag('twitter:card', meta.image ? 'summary_large_image' : 'summary'), tag('twitter:title', title), tag('twitter:description', meta.description))
    if (meta.image) tags.push(tag('og:image', meta.image, true), tag('og:image:alt', `${meta.name} logo`, true), tag('twitter:image', meta.image))
  }
  // Keep the exact built app shell/assets. No video scripts or staff data are embedded.
  return template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escape(title)}</title>`)
    .replace(/<meta\b[^>]*(?:property|name)=["'](?:og:|twitter:|description["']|robots["']|referrer["'])[^>]*>/gi, '')
    .replace('</head>', `${tags.join('\n')}\n</head>`)
}

export function createGuidelinePreviewHandler({ loadTemplate, fetchSnapshot, logoForClient = () => null }) {
  return async request => {
    const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } })
    const target = guidelinePreviewTarget(request.url)
    let meta = null, status = target ? 200 : 404
    try {
      if (target) {
        const snapshot = await fetchSnapshot(target)
        meta = metadata(snapshot, target, logoForClient)
        if (!meta) status = 404
      }
    } catch {
      // Log no URL/token/content. Let the normal client page retry its own read.
      console.error('Guideline preview: published metadata unavailable')
      status = 503
      headers['Retry-After'] = '30'
    }
    const html = renderGuidelinePreview(await loadTemplate(), meta)
    return new Response(request.method === 'HEAD' ? null : html, { status, headers })
  }
}
