import { supabase } from '../supabase'
import { withRequestTimeout } from './requestTimeout'
import type { Platform } from '../reportStats'

export type ManualSourceType = 'meta_csv' | 'manual_summary' | 'tiktok_csv' | 'other'

export const MANUAL_SOURCE_LABELS: Record<ManualSourceType, string> = {
  meta_csv: 'Meta Business Suite CSV',
  manual_summary: 'Manual dashboard summary',
  tiktok_csv: 'TikTok CSV',
  other: 'Other',
}

export interface ManualPlatformMetric {
  id: string
  client_id: string
  month: string
  platform: Platform
  source_type: ManualSourceType
  views: number
  reach: number
  engagements: number
  accounts_engaged: number
  profile_visits: number
  external_link_taps: number
  followers: number
  top_content_notes: string | null
  content_type_split_notes: string | null
  general_notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string | null
}

export interface ManualMetricInput {
  id?: string
  client_id: string
  month: string
  platform: Platform
  source_type: ManualSourceType
  views: number
  reach: number
  engagements: number
  accounts_engaged: number
  profile_visits: number
  external_link_taps: number
  followers: number
  top_content_notes: string | null
  content_type_split_notes: string | null
  general_notes: string | null
  created_by: string | null
}

function payload(input: ManualMetricInput) {
  return {
    client_id: input.client_id,
    month: input.month,
    platform: input.platform,
    source_type: input.source_type,
    views: input.views,
    reach: input.reach,
    engagements: input.engagements,
    accounts_engaged: input.accounts_engaged,
    profile_visits: input.profile_visits,
    external_link_taps: input.external_link_taps,
    followers: input.followers,
    top_content_notes: input.top_content_notes,
    content_type_split_notes: input.content_type_split_notes,
    general_notes: input.general_notes,
    created_by: input.created_by,
  }
}

export async function listManualMetrics() {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('manual_platform_metrics')
      .select('*')
      .order('month', { ascending: false })
      .order('platform', { ascending: true }),
    'Loading manual metrics took too long. Please try again.'
  )
  return { data: (data ?? []) as ManualPlatformMetric[], error }
}

// Used by the client/preview master report — RLS scopes clients to their own.
export async function listManualMetricsForClientMonth(clientId: string, month: string) {
  const { data, error } = await supabase
    .from('manual_platform_metrics')
    .select('*')
    .eq('client_id', clientId)
    .eq('month', month)

  return { data: (data ?? []) as ManualPlatformMetric[], error }
}

// All manual metrics for a client across every month — used by the report
// builder so the admin can see what is available and pick the right month.
export async function listManualMetricsForClient(clientId: string) {
  const { data, error } = await supabase
    .from('manual_platform_metrics')
    .select('*')
    .eq('client_id', clientId)
    .order('month', { ascending: false })
    .order('platform', { ascending: true })

  return { data: (data ?? []) as ManualPlatformMetric[], error }
}

export async function saveManualMetric(input: ManualMetricInput) {
  const body = payload(input)
  const result = input.id
    ? await supabase.from('manual_platform_metrics').update(body).eq('id', input.id).select('*').single()
    : await supabase.from('manual_platform_metrics').insert(body).select('*').single()

  return { data: result.data as ManualPlatformMetric | null, error: result.error }
}

export async function deleteManualMetric(id: string) {
  const { error } = await supabase.from('manual_platform_metrics').delete().eq('id', id)
  return { error }
}

export type ManualMetricUpsert = Omit<ManualMetricInput, 'id'>

// Insert-or-update by (client_id, month, platform) — used by the manual
// summary CSV import so re-importing a month updates rather than duplicates.
export async function upsertManualMetrics(rows: ManualMetricUpsert[]) {
  const { data, error } = await supabase
    .from('manual_platform_metrics')
    .upsert(rows.map(payload), { onConflict: 'client_id,month,platform' })
    .select('*')
  return { data: (data ?? []) as ManualPlatformMetric[], error }
}
