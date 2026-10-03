const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function previewClientId(role: string | undefined, requested: string | null): string | null {
  return (role === 'admin' || role === 'manager') && requested && UUID.test(requested) ? requested : null
}

export function portalPreviewPath(clientId: string, clientPath: string) {
  const parsed = new URL(clientPath, 'https://preview.invalid')
  const params = new URLSearchParams(parsed.search)
  params.set('client', clientId)
  params.set('area', parsed.pathname.replace(/^\/client\/?/, '') || 'overview')
  return `/admin/client-portal-preview?${params.toString()}`
}
