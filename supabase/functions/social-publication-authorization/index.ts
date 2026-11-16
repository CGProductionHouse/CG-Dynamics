import { requireAdminOrManager } from '../_shared/auth.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { facebookPublicationRuntime, readFacebookPublicationConfiguration } from '../_shared/facebookPublicationRuntime.ts'
import { facebookPublicationStaffHandler } from '../_shared/facebookPublicationStaff.ts'
import { socialPublicationAuthorizationStore } from '../_shared/socialPublicationAuthorizationStore.ts'

// UNDEPLOYED candidate. JWT + active manager, default-off server gates. Never
// submits to a provider here: confirmation atomically queues the existing job.
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const auth = await requireAdminOrManager(request)
  if (!auth.ok) return Response.json({ ok: false, error: 'PUBLICATION_ACCESS_UNAVAILABLE' }, { status: auth.status,
    headers: { ...corsHeaders, 'Cache-Control': 'no-store' } })
  const sb = auth.value.supabase, configuration = readFacebookPublicationConfiguration(name => Deno.env.get(name))
  const handler = facebookPublicationStaffHandler({
    async authenticate() {
      const { data, error } = await sb.from('profiles').select('role,is_active').eq('id', auth.value.user.id).maybeSingle()
      return error || !data ? null : { id: auth.value.user.id, role: data.role, active: data.is_active === true }
    },
    runtime: configuration ? facebookPublicationRuntime(sb, configuration) : null,
    persistence: socialPublicationAuthorizationStore(sb),
  })
  const result = await handler(request), headers = new Headers(result.headers)
  for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value)
  return new Response(result.body, { status: result.status, headers })
})
