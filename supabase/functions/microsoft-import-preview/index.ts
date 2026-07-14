import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const ALLOWED_SOURCES = new Set([
  'outlook-calendar',
  'planner-to-do',
  'planner-master-client-to-do',
  'planner-cg-socials',
  'planner-monthly-client-socials',
])

const MICROSOFT_CONFIGURATION = [
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
  'MICROSOFT_TENANT_ID',
  'MICROSOFT_REDIRECT_URI',
] as const

const REQUIRED_PERMISSIONS = [
  'User.Read',
  'Calendars.Read',
  'Tasks.Read',
  'offline_access',
  'Group.Read.All only if Planner plan discovery cannot use configured plan IDs',
]

function validDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500)
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profileError || profile?.role !== 'admin') {
    return jsonResponse({ ok: false, error: 'Admin access required.' }, 403)
  }

  let body: { source?: unknown; rangeStart?: unknown; rangeEnd?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: 'A JSON request body is required.' }, 400)
  }

  if (typeof body.source !== 'string' || !ALLOWED_SOURCES.has(body.source)) {
    return jsonResponse({ ok: false, error: 'Unsupported Microsoft preview source.' }, 400)
  }
  if (!validDateKey(body.rangeStart) || !validDateKey(body.rangeEnd)) {
    return jsonResponse({ ok: false, error: 'Preview dates must use YYYY-MM-DD.' }, 400)
  }

  const start = Date.parse(`${body.rangeStart}T00:00:00Z`)
  const end = Date.parse(`${body.rangeEnd}T00:00:00Z`)
  const rangeDays = Math.ceil((end - start) / 86_400_000)
  if (rangeDays < 0 || rangeDays > 93) {
    return jsonResponse({ ok: false, error: 'Preview range must be 93 days or fewer.' }, 400)
  }

  const missingConfiguration = MICROSOFT_CONFIGURATION.filter(name => !Deno.env.get(name))
  return jsonResponse({
    ok: true,
    status: 'setup_required',
    message: 'Microsoft delegated OAuth and encrypted refresh-token storage must be configured before read-only Graph previews can run.',
    missingConfiguration: [
      ...missingConfiguration,
      'Reviewed encrypted delegated-token storage and Microsoft OAuth start/callback flow',
    ],
    requiredPermissions: REQUIRED_PERMISSIONS,
  })
})
