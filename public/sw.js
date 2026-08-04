const DEFAULT_PATH = '/admin/assistant'
const ALLOWED_PREFIXES = ['/admin/', '/dashboard']

function safePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_PATH
  try {
    const target = new URL(value, self.location.origin)
    if (target.origin !== self.location.origin) return DEFAULT_PATH
    if (!ALLOWED_PREFIXES.some(prefix => target.pathname.startsWith(prefix))) return DEFAULT_PATH
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return DEFAULT_PATH
  }
}

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { payload = {} }
  const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title : 'CG Dynamics'
  const body = typeof payload.body === 'string' ? payload.body : 'You have a new notification.'
  const notificationId = typeof payload.notificationId === 'string' ? payload.notificationId : 'general'
  const url = safePath(payload.url)
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/CG_App_Icon.png',
    badge: '/CG_ICON_TEAL.png',
    tag: `cg-dynamics:${notificationId}`,
    renotify: false,
    data: { url, notificationId },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const path = safePath(event.notification.data?.url)
  const targetUrl = new URL(path, self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue
      await client.navigate(targetUrl)
      return client.focus()
    }
    return self.clients.openWindow(targetUrl)
  })())
})
