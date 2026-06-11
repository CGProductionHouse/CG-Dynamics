import { supabase } from '../supabase'

export interface ImportedMetaPost {
  id: string
  client_id: string
  source: string
  platform: 'facebook' | 'instagram' | 'tiktok'
  import_batch_id: string
  source_file_name: string | null
  row_number: number
  meta_post_id: string | null
  publish_time: string | null
  caption: string | null
  permalink: string | null
  post_type: string | null
  reach: number
  impressions: number
  engagements: number
  reactions: number
  comments: number
  shares: number
  clicks: number
  video_views: number
  raw: Record<string, string>
  created_at: string
}

export type ImportedMetaPostInput = Omit<ImportedMetaPost, 'id' | 'created_at'>

export async function importMetaPosts(rows: ImportedMetaPostInput[]) {
  const { data, error } = await supabase
    .from('imported_meta_posts')
    .insert(rows)
    .select('*')
  return { data: (data ?? []) as ImportedMetaPost[], error }
}

export async function listImportedMetaPosts(clientId: string, startDate?: string, endDate?: string) {
  let query = supabase
    .from('imported_meta_posts')
    .select('*')
    .eq('client_id', clientId)
    .order('publish_time', { ascending: true, nullsFirst: false })

  if (startDate) query = query.gte('publish_time', `${startDate}T00:00:00`)
  if (endDate) query = query.lte('publish_time', `${endDate}T23:59:59`)

  const { data, error } = await query
  return { data: (data ?? []) as ImportedMetaPost[], error }
}
