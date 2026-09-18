import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseEnsureClientInput, secretsMatch } from './policy.ts'

const headers = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers })
}

Deno.serve(async request => {
  if (request.method !== 'POST') return json({ ok: false, code: 'method_not_allowed' }, 405)

  const bridgeSecret = Deno.env.get('CG_HOURS_BRIDGE_SECRET')
  const authorized = await secretsMatch(request.headers.get('x-cg-hours-bridge-secret'), bridgeSecret)
  if (!authorized) return json({ ok: false, code: 'unauthorized' }, 401)

  const parsed = parseEnsureClientInput(await request.json().catch(() => null))
  if (!parsed.ok) return json({ ok: false, code: parsed.code }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, code: 'service_unavailable' }, 503)

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await service.rpc('ensure_client_from_cg_hours', {
    p_hours_client_id: parsed.value.hoursClientId,
    p_exact_name: parsed.value.exactName,
    p_request_id: parsed.value.requestId,
  })
  if (error) return json({ ok: false, code: 'ensure_unavailable' }, 503)

  const result = data as { ok?: boolean; code?: string }
  if (result?.ok === true) return json(result, 200)
  if (result?.code === 'name_collision' || result?.code === 'request_conflict') return json(result, 409)
  return json(result ?? { ok: false, code: 'ensure_failed' }, 400)
})
