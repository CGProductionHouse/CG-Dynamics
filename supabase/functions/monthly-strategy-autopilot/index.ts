// Canonical monthly seed and bounded exact-client next-month generation.
// The existing worker owns cadence; model generation is disabled by default.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  runMonthlyStrategyAutopilot,
  type StrategyAutopilotClient,
} from '../_shared/monthlyStrategyAutopilot.ts'
import { runCurrentMonthStrategyContextRevision, runNextMonthStrategyGeneration } from '../_shared/monthlyStrategyGeneration.ts'
import { authorizesMonthlyStrategyPilot, monthlyStrategyInvocationAuth, readMonthlyStrategyPilotGrant } from '../_shared/monthlyStrategyPilot.ts'
import type { AiUsageClient } from '../_shared/aiUsage.ts'

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
  const pilotInvokeToken = (Deno.env.get('MONTHLY_STRATEGY_PILOT_INVOKE_TOKEN') ?? '').trim()
  const systemProfileId = (Deno.env.get('WORKER_SYSTEM_PROFILE_ID') ?? '').trim()
  const suppliedToken = request.headers.get('X-Internal-Worker-Token') ?? ''
  const suppliedPilotToken = request.headers.get('X-Monthly-Strategy-Pilot-Token') ?? ''
  const suppliedBearer = request.headers.get('Authorization') ?? ''
  if (!url || !serviceKey) return jsonResponse({ error: 'Server configuration error.' }, 500)
  const authMode = monthlyStrategyInvocationAuth({
    serviceKey, suppliedBearer, workerToken, suppliedWorkerToken: suppliedToken,
    pilotToken: pilotInvokeToken, suppliedPilotToken,
  })
  if (!authMode) {
    if (suppliedPilotToken.length >= 32) {
      console.warn('monthly-strategy-pilot-auth-denied', {
        bearerMatched: suppliedBearer === `Bearer ${serviceKey}`,
        pilotConfigured: pilotInvokeToken.length >= 32,
        pilotMatched: pilotInvokeToken.length >= 32 && suppliedPilotToken === pilotInvokeToken,
      })
    }
    return jsonResponse({ error: 'Worker authentication required.' }, 401)
  }
  if (!UUID_RE.test(systemProfileId)) return jsonResponse({ error: 'Worker system profile is not configured.' }, 503)

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('id,role,is_active').eq('id', systemProfileId).maybeSingle()
  if (profileError || !profile || profile.is_active !== true || !STAFF_ROLES.has(profile.role)) {
    return jsonResponse({ error: 'Worker system profile is unavailable.' }, 503)
  }

  try {
    const payload = await request.json().catch(() => ({})) as Record<string, unknown>
    // The temporary pilot credential cannot invoke the scheduler or normal
    // generation paths; the existing worker credential remains unchanged.
    if (authMode === 'pilot' && payload.action !== 'pilot_generate_next_month') {
      return jsonResponse({ error: 'Worker authentication required.' }, 401)
    }
    const today = johannesburgDate()
    const generationEnabled = (Deno.env.get('MONTHLY_STRATEGY_AI_ENABLED') ?? '').trim().toLowerCase() === 'true'
    const pilot = payload.action === 'pilot_generate_next_month'
    if (pilot || payload.action === 'generate_next_month' || payload.action === 'revise_current_month_context') {
      if (!pilot && !generationEnabled) return jsonResponse({ ok: true, state: 'disabled' })
      const clientId = typeof payload.clientId === 'string' ? payload.clientId : ''
      const strategyMonth = typeof payload.strategyMonth === 'string' ? payload.strategyMonth : ''
      if (!UUID_RE.test(clientId) || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(strategyMonth)) {
        return jsonResponse({ error: 'Exact strategy generation identity required.' }, 400)
      }
      const pilotGrant = pilot && !generationEnabled
        ? readMonthlyStrategyPilotGrant(
          (Deno.env.get('MONTHLY_STRATEGY_PILOT_CLIENT_ID') ?? '').trim(),
          (Deno.env.get('MONTHLY_STRATEGY_PILOT_MAX_ZAR') ?? '').trim(),
          (Deno.env.get('MONTHLY_STRATEGY_PILOT_EXPIRES_AT') ?? '').trim(),
        ) : null
      if (pilot && !authorizesMonthlyStrategyPilot(pilotGrant, clientId, generationEnabled)) {
        return jsonResponse({ error: 'Exact-client strategy pilot is unavailable.' }, 403)
      }
      const generate = payload.action === 'revise_current_month_context'
        ? runCurrentMonthStrategyContextRevision : runNextMonthStrategyGeneration
      const result = await generate(
        supabase as unknown as StrategyAutopilotClient & AiUsageClient,
        { clientId, strategyMonth, today, systemProfileId,
          ...(pilotGrant ? { pilot: {
            maxZarMicros: pilotGrant.maxZarMicros,
            grantId: pilotGrant.expiresAt,
          } } : {}) },
      )
      return jsonResponse(result)
    }
    if (payload.action != null) return jsonResponse({ error: 'Unsupported strategy action.' }, 400)
    const result = await runMonthlyStrategyAutopilot(supabase as unknown as StrategyAutopilotClient, {
      today,
      systemProfileId,
      enqueueGeneration: generationEnabled,
    })
    return jsonResponse(result, result.ok ? 200 : 207)
  } catch {
    console.error('monthly-strategy-autopilot failed safely')
    return jsonResponse({ error: 'Monthly strategy preparation failed safely.' }, 500)
  }
})
