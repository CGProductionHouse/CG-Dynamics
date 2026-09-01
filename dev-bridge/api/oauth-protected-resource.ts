import { protectedResourceMetadata } from '../src/auth.js'

export default {
  fetch(request: Request) {
    if (request.method !== 'GET') return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: { Allow: 'GET' } })
    return Response.json(protectedResourceMetadata(), { headers: { 'Cache-Control': 'public, max-age=300' } })
  },
}
