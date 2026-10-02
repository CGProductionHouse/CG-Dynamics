import { supabase } from './supabase'
import type { ResolutionClient } from './entitlementResolution'
import { SERVICE_KEYS } from './clientServicePresentation'

export async function readEntitlementResolutionQueue(): Promise<ResolutionClient[]> {
  const rows: ResolutionClient[] = []
  let cursor: string | null = null
  for (let page = 0; page < 100; page++) {
    const { data, error }: { data: unknown; error: unknown } = await supabase.rpc('get_admin_entitlement_resolution_queue', { p_after_client_id: cursor, p_page_size: 50 })
    if (error) throw error // Never present a truncated fleet as a complete queue.
    if (!Array.isArray(data) || data.length > 50) throw new Error('Invalid resolution page')
    for (const item of data) {
      if (!item || typeof item.client_id !== 'string' || typeof item.client_name !== 'string'
        || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(item.client_id)
        || (cursor !== null && item.client_id <= cursor) || !Array.isArray(item.entitlements)
        || !Array.isArray(item.connections) || item.connections.length !== SERVICE_KEYS.length
        || SERVICE_KEYS.some(key => item.connections.filter((c: { service_key: string; connection: string }) => c.service_key === key
          && ['connected', 'needs_connection', 'unavailable'].includes(c.connection)).length !== 1)) throw new Error('Invalid resolution identity/page')
      if (item.entitlements.length > SERVICE_KEYS.length || new Set(item.entitlements.map((e: { service_key: string }) => e.service_key)).size !== item.entitlements.length
        || item.entitlements.some((e: Record<string, unknown>) => !e || !SERVICE_KEYS.includes(e.service_key as typeof SERVICE_KEYS[number])
          || !['included', 'not_included', 'not_applicable', 'unknown'].includes(String(e.state))
          || typeof e.evidence_note !== 'string' || !Array.isArray(e.source_references)
          || e.source_references.some(s => typeof s !== 'string') || typeof e.verified_at !== 'string'
          || !Number.isFinite(Date.parse(e.verified_at)) || !Number.isInteger(e.revision) || Number(e.revision) < 1
          || (e.notes !== null && typeof e.notes !== 'string'))) throw new Error('Invalid resolution evidence')
      cursor = item.client_id
      rows.push(item as ResolutionClient)
    }
    if (data.length < 50) return rows
  }
  throw new Error('Resolution queue exceeded bounded paging limit')
}
