// Issue #463 — isolated Monthly Strategy Autopilot entrypoint.
// Prepared for a later, small shared-worker handoff; this function does not
// create a scheduler and is not deployed by this PR.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  runMonthlyStrategyAutopilot,
  type StrategyAutopilotClient,
} from '../_shared/monthlyStrategyAutopilot.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STAFF_ROLES = new Set(['owner', 'admin', 'manager', 'staff', 'team'])

function johannesburgDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders, status: 204 })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  const url = (Deno.env.get('SUPABASE_URL') ?? '').trim()
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim()
  const workerToken = (Deno.env.get('WORKER_INTERNAL_TOKEN') ?? '').trim()
  const systemProfileId = (Deno.env.get('WORKER_SYSTEM_PROFILE_ID') ?? '').trim()
  const suppliedToken = request.headers.get('X-Internal-Worker-Token') ?? ''
  if (!url || !serviceKey) return jsonResponse({ error: 'Server configuration error.' }, 500)
  if (workerToken.length < 32 || suppliedToken !== workerToken) return jsonResponse({ error: 'Worker authentication required.' }, 401)
  if (!UUID_RE.test(systemProfileId)) return jsonResponse({ error: 'Worker system profile is not configured.' }, 503)

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('id,role,is_active').eq('id', systemProfileId).maybeSingle()
  if (profileError || !profile || profile.is_active !== true || !STAFF_ROLES.has(profile.role)) {
    return jsonResponse({ error: 'Worker system profile is unavailable.' }, 503)
  }

  try {
    const result = await runMonthlyStrategyAutopilot(supabase as unknown as StrategyAutopilotClient, {
      today: johannesburgDate(),
      systemProfileId,
    })
    return jsonResponse(result, result.ok ? 200 : 207)
  } catch (error) {
    console.error('monthly-strategy-autopilot failed', error)
    return jsonResponse({ error: 'Monthly strategy preparation failed safely.' }, 500)
  }
})
