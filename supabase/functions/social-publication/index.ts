import { requireAdminOrManager } from '../_shared/auth.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { publicationManagementHandler, readPublicationManagementStatus } from '../_shared/socialPublicationManagement.ts'
import { socialPublicationAuthorizationStore } from '../_shared/socialPublicationAuthorizationStore.ts'

// Staff status and withdrawal only. No provider submission, new authorization,
// worker dispatch, credentials or Microsoft access is reachable through this entry.
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const auth = await requireAdminOrManager(request)
  if (!auth.ok) return new Response(JSON.stringify({ ok: false, error: 'PUBLICATION_ACCESS_UNAVAILABLE' }), { status: auth.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  const sb = auth.value.supabase
  const handler = publicationManagementHandler({
    async authenticate() {
      const { data, error } = await sb.from('profiles').select('role,is_active').eq('id', auth.value.user.id).maybeSingle()
      return error || !data ? null : { id: auth.value.user.id, role: data.role, active: data.is_active === true }
    },
    readStatus: (reviewId, actorId) => readPublicationManagementStatus(sb, actorId, reviewId),
    revoke: socialPublicationAuthorizationStore(sb).revoke,
  })
  const result = await handler(request)
  const headers = new Headers(result.headers)
  for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value)
  return new Response(result.body, { status: result.status, headers })
})
