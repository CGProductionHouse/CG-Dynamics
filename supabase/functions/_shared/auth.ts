import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'
import { isGoogleAdsManagerRole } from './google-ads-policy.ts'

export type AuthorizedRequest = {
  supabase: SupabaseClient
  user: User
  role: 'admin' | 'manager'
}

export type AuthorizationResult =
  | { ok: true; value: AuthorizedRequest }
  | { ok: false; status: number; error: string }

export async function requireAdminOrManager(request: Request): Promise<AuthorizationResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, status: 500, error: 'Server configuration error.' }
  }

  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') ?? '')
  if (!match?.[1]) return { ok: false, status: 401, error: 'Authentication required.' }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error: authError } = await supabase.auth.getUser(match[1])
  if (authError || !user) return { ok: false, status: 401, error: 'Authentication required.' }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) return { ok: false, status: 503, error: 'Authorization check unavailable.' }
  if (!isGoogleAdsManagerRole(profile?.role)) {
    return { ok: false, status: 403, error: 'Admin or manager access required.' }
  }

  return { ok: true, value: { supabase, user, role: profile.role } }
}
