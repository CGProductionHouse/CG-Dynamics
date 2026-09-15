import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'
import { isGoogleAdsManagerRole } from './google-ads-policy.ts'

export type AuthorizedRequest = {
  supabase: SupabaseClient
  user: User
  role: 'admin' | 'manager'
}

export type ClientOwnerRequest = {
  supabase: SupabaseClient
  user: User
  role: 'admin' | 'manager' | 'client'
}

export type AuthorizationResult =
  | { ok: true; value: AuthorizedRequest }
  | { ok: false; status: number; error: string }

export type ClientOwnerAuthorizationResult =
  | { ok: true; value: ClientOwnerRequest }
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

/**
 * Authorize an admin, manager, or a client viewing their own data.
 *
 * Clients may only access resources for the exact client_id linked to their profile.
 * This preserves exact-client isolation while letting client-facing pages read their
 * own Google Ads + GA4 reporting.
 */
export async function requireClientOwnerOrManager(
  request: Request,
  clientId: string,
): Promise<ClientOwnerAuthorizationResult> {
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
    .select('role, client_id')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) return { ok: false, status: 503, error: 'Authorization check unavailable.' }

  const role = profile?.role
  if (isGoogleAdsManagerRole(role)) {
    return { ok: true, value: { supabase, user, role } }
  }
  if (role === 'client' && profile?.client_id === clientId) {
    return { ok: true, value: { supabase, user, role } }
  }
  return { ok: false, status: 403, error: 'Access denied.' }
}
