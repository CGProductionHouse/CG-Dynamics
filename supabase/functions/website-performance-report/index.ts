import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' },
})

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const day = /^\d{4}-\d{2}-\d{2}$/

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1]
  if (!bearer) return json({ error: 'Authentication required' }, 401)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const builderUrl = Deno.env.get('WEBSITE_BUILDER_REPORTING_URL')
  const builderToken = Deno.env.get('WEBSITE_BUILDER_REPORTING_TOKEN')
  if (!supabaseUrl || !serviceKey || !builderUrl || !builderToken) return json({ error: 'Reporting not configured' }, 503)
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user }, error: authError } = await supabase.auth.getUser(bearer)
  if (authError || !user) return json({ error: 'Authentication required' }, 401)
  const { data: profile, error: roleError } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (roleError) return json({ error: 'Authorization unavailable' }, 503)
  if (!['admin', 'manager', 'staff', 'team'].includes(profile?.role ?? '')) return json({ error: 'Forbidden' }, 403)

  let input: { clientId?: unknown; from?: unknown; to?: unknown }
  try { input = await request.json() } catch { return json({ error: 'Malformed request' }, 400) }
  if (typeof input.clientId !== 'string' || !uuid.test(input.clientId) ||
    typeof input.from !== 'string' || typeof input.to !== 'string' || !day.test(input.from) || !day.test(input.to)) {
    return json({ error: 'Invalid report request' }, 400)
  }
  const start = Date.parse(`${input.from}T00:00:00Z`)
  const end = Date.parse(`${input.to}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) ||
    new Date(start).toISOString().slice(0, 10) !== input.from || new Date(end).toISOString().slice(0, 10) !== input.to ||
    end <= start || end - start > 93 * 86_400_000) {
    return json({ error: 'Invalid date range' }, 400)
  }
  const { data: client, error: clientError } = await supabase.from('clients').select('id, active').eq('id', input.clientId).maybeSingle()
  if (clientError) return json({ error: 'Client lookup unavailable' }, 503)
  if (!client?.active) return json({ error: 'Client not eligible' }, 404)
  let mappings: Record<string, number>
  try { mappings = JSON.parse(Deno.env.get('WEBSITE_REPORTING_CLIENT_MAP') ?? '{}') } catch { return json({ error: 'Reporting mapping invalid' }, 503) }
  const websiteId = mappings[input.clientId]
  if (!Number.isSafeInteger(websiteId) || websiteId < 1) return json({ error: 'Website not mapped' }, 404)
  // Fail closed if one Builder website is accidentally assigned to multiple clients.
  if (Object.values(mappings).filter((id) => id === websiteId).length !== 1) return json({ error: 'Reporting mapping ambiguous' }, 503)
  try {
    const endpoint = new URL(`/api/reporting/websites/${websiteId}`, builderUrl)
    if (endpoint.protocol !== 'https:') return json({ error: 'Reporting endpoint invalid' }, 503)
    endpoint.searchParams.set('from', input.from)
    endpoint.searchParams.set('to', input.to)
    const upstream = await fetch(endpoint, { headers: { Authorization: `Bearer ${builderToken}` } })
    if (!upstream.ok) return json({ error: 'Website report unavailable' }, 503)
    const report = await upstream.json()
    if (report?.version !== 1 || report.websiteId !== websiteId || report.period?.from !== input.from || report.period?.to !== input.to) {
      return json({ error: 'Website report contract mismatch' }, 503)
    }
    return json({ clientId: input.clientId, report })
  } catch { return json({ error: 'Website report unavailable' }, 503) }
})
