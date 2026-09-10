import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Platform = 'facebook' | 'instagram'

export interface MetaPostPayload {
  report_id: string
  platform: Platform
  meta_post_id: string
  publish_time: string | null
  meta_post_type?: string | null
  caption: string | null
  permalink: string | null
  views: number | null
  reach: number | null
  reactions: number
  comments: number
  shares: number
  total_clicks?: number
  raw: Record<string, unknown>
}

export interface MetaSyncLease {
  itemId: string
  generation: number
}

export async function upsertMetaReportPost(
  sb: SupabaseClient,
  args: {
    clientId: string
    metaObjectId: string
    metaObjectType?: string | null
    payload: MetaPostPayload
    lease?: MetaSyncLease
  },
): Promise<{ postId: string; inserted: boolean; reusedImported: boolean }> {
  const { data, error } = await sb.rpc('meta_sync_upsert_report_post', {
    p_item_id: args.lease?.itemId ?? null,
    p_lease_generation: args.lease?.generation ?? null,
    p_client_id: args.clientId,
    p_meta_object_id: args.metaObjectId,
    p_meta_object_type: args.metaObjectType ?? null,
    p_payload: args.payload,
  })
  if (error) {
    throw new Error(`Could not atomically reconcile ${args.payload.platform} report post: ${error.message} (${error.code ?? 'unknown'})`)
  }
  const result = Array.isArray(data) ? data[0] : data
  if (!result?.post_id) throw new Error(`Could not atomically reconcile ${args.payload.platform} report post: missing post id`)
  return {
    postId: String(result.post_id),
    inserted: result.inserted === true,
    reusedImported: result.reused_imported === true,
  }
}
