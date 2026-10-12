// Temporary exact-Piek dispatcher for the bounded November strategy pilot.
// Delete the deployed function after one attempt; never expose the internal keys.
import { readMonthlyStrategyPilotGrant } from '../_shared/monthlyStrategyPilot.ts'

const PROJECT_HOST = 'ehtjfntukiwbgptqgbzy.supabase.co'
const PIEK_CLIENT_ID = 'ed7aa1ae-de21-4151-a8f9-54796b234c1f'
const PILOT_MONTH = '2026-11-01'
const MAX_ZAR_MICROS = 25_000_000

function serviceRoleJwt(bearer: string): boolean {
  if (!bearer.startsWith('Bearer ')) return false
  const parts = bearer.slice(7).split('.')
  if (parts.length !== 3) return false
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

Deno.serve(async request => {
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  // Gateway verify_jwt=true verifies the signature before this role check.
  const suppliedBearer = request.headers.get('Authorization') ?? ''
  const suppliedPilotToken = request.headers.get('X-Monthly-Strategy-Pilot-Token') ?? ''
  const pilotToken = (Deno.env.get('MONTHLY_STRATEGY_PILOT_INVOKE_TOKEN') ?? '').trim()
  if (!serviceRoleJwt(suppliedBearer) || pilotToken.length < 32 || suppliedPilotToken !== pilotToken) {
    return new Response(null, { status: 401 })
  }
  const grant = readMonthlyStrategyPilotGrant(
    (Deno.env.get('MONTHLY_STRATEGY_PILOT_CLIENT_ID') ?? '').trim(),
    (Deno.env.get('MONTHLY_STRATEGY_PILOT_MAX_ZAR') ?? '').trim(),
    (Deno.env.get('MONTHLY_STRATEGY_PILOT_EXPIRES_AT') ?? '').trim(),
  )
  if (grant?.clientId !== PIEK_CLIENT_ID || grant.maxZarMicros > MAX_ZAR_MICROS ||
      (Deno.env.get('MONTHLY_STRATEGY_AI_ENABLED') ?? '').trim().toLowerCase() === 'true') {
    return new Response(null, { status: 403 })
  }
  const url = (Deno.env.get('SUPABASE_URL') ?? '').trim()
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim()
  const workerToken = (Deno.env.get('WORKER_INTERNAL_TOKEN') ?? '').trim()
  let projectHost = ''
  try { projectHost = new URL(url).host } catch { /* fail closed below */ }
  if (!serviceKey || workerToken.length < 32 || projectHost !== PROJECT_HOST) {
    return new Response(null, { status: 503 })
  }
  try {
    const response = await fetch(`${url}/functions/v1/monthly-strategy-autopilot`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'X-Internal-Worker-Token': workerToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'pilot_generate_next_month', clientId: PIEK_CLIENT_ID, strategyMonth: PILOT_MONTH }),
      signal: AbortSignal.timeout(90_000),
    })
    return new Response(response.body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch {
    return new Response(null, { status: 502 })
  }
})
