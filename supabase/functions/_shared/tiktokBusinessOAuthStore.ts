import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { classifySocialProviderEligibility } from '../../../src/lib/socialProviderEligibility.ts'
import { normalizeBusinessHandle, type BusinessOAuthStore } from './tiktokBusinessOAuth.ts'

export function businessOAuthStore(sb: SupabaseClient): BusinessOAuthStore {
  return {
    async prepare(input) {
      const [actor, client, connection] = await Promise.all([
        sb.from('profiles').select('role,is_active').eq('id', input.actorId).maybeSingle(),
        sb.from('clients').select('id,package_settings').eq('id', input.clientId).eq('active', true).maybeSingle(),
        sb.from('tiktok_connections').select('id,profile_deep_link').eq('id', input.connectionId).eq('client_id', input.clientId).eq('status', 'connected').maybeSingle(),
      ])
      if (actor.error || client.error || connection.error || !actor.data?.is_active || !['admin', 'manager'].includes(actor.data.role)
        || !client.data || !connection.data || classifySocialProviderEligibility(client.data.package_settings).state !== 'eligible') return false
      // Preserve a known canonical handle. Short provider profile links cannot
      // be identity-matched by display name; initial pairing requires the exact
      // explicit handle confirmation recorded in this state by the staff actor.
      try {
        const link = new URL(connection.data.profile_deep_link)
        if (['www.tiktok.com', 'tiktok.com'].includes(link.hostname) && /^\/@[^/]+\/?$/.test(link.pathname)
          && normalizeBusinessHandle(link.pathname.split('/')[1]) !== input.handle) return false
      } catch { /* No inferred handle fallback; explicit staff target is required. */ }
      const { error } = await sb.from('tiktok_business_oauth_states').insert({ state_hash: input.stateHash, client_id: input.clientId,
        connection_id: input.connectionId, requested_by: input.actorId, expected_handle: input.handle, expires_at: input.expiresAt })
      return !error
    },
    async consume(hash) {
      const { data, error } = await sb.rpc('consume_tiktok_business_oauth_state', { p_hash: hash })
      if (error) throw new Error('TikTok Business state unavailable.')
      return data ?? null
    },
    async complete(input) {
      const { data, error } = await sb.rpc('complete_tiktok_business_oauth', { p_state: input.state.id, p_open_id: input.openId,
        p_handle: input.handle, p_display: input.displayName, p_scopes: input.scopes, p_access: input.access, p_refresh: input.refresh,
        p_access_expiry: input.accessExpiry, p_refresh_expiry: input.refreshExpiry })
      return !error && typeof data === 'string'
    },
  }
}
