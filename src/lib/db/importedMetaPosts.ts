import { supabase } from '../supabase'
import { detectReportPeriod } from '../reportPeriod'

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

export interface ImportedMetaPostGroup {
  key: string
  import_batch_id: string | null
  client_id: string
  platform: ImportedMetaPost['platform']
  source_file_name: string | null
  period_start: string | null
  period_end: string | null
  created_at: string
  post_count: number
  total_reach: number
  total_views: number
  total_engagements: number
  can_delete_by_batch: boolean
}

function uniqueRowsByPostId(rows: ImportedMetaPostInput[]) {
  const keyedRows = new Map<string, ImportedMetaPostInput>()
  const rowsWithoutPostId: ImportedMetaPostInput[] = []

  rows.forEach(row => {
    if (!row.meta_post_id) {
      rowsWithoutPostId.push(row)
      return
    }
    if (!keyedRows.has(row.meta_post_id)) keyedRows.set(row.meta_post_id, row)
  })

  return [...keyedRows.values(), ...rowsWithoutPostId]
}

export async function importMetaPosts(rows: ImportedMetaPostInput[]) {
  const uniqueRows = uniqueRowsByPostId(rows)
  const rowsByScope = new Map<string, {
    clientId: string
    platform: ImportedMetaPostInput['platform']
    postIds: string[]
  }>()

  uniqueRows.forEach(row => {
    if (!row.meta_post_id) return
    const scopeKey = `${row.client_id}:${row.platform}`
    const scope = rowsByScope.get(scopeKey) ?? {
      clientId: row.client_id,
      platform: row.platform,
      postIds: [],
    }
    scope.postIds.push(row.meta_post_id)
    rowsByScope.set(scopeKey, scope)
  })

  for (const scope of rowsByScope.values()) {
    const { error } = await supabase
      .from('imported_meta_posts')
      .delete()
      .eq('client_id', scope.clientId)
      .eq('platform', scope.platform)
      .in('meta_post_id', scope.postIds)

    if (error) return { data: [], error }
  }

  const { data, error } = await supabase
    .from('imported_meta_posts')
    .insert(uniqueRows)
    .select('*')
  return { data: (data ?? []) as ImportedMetaPost[], error }
}

export async function listAllImportedMetaPosts() {
  const { data, error } = await supabase
    .from('imported_meta_posts')
    .select('*')
    .order('created_at', { ascending: false })

  return { data: (data ?? []) as ImportedMetaPost[], error }
}

function groupKeyForPost(post: ImportedMetaPost) {
  if (post.import_batch_id) return `batch:${post.import_batch_id}`
  const period = detectReportPeriod([post.publish_time], post.source_file_name)
  return [
    'fallback',
    post.client_id,
    post.platform,
    period?.start ?? 'no-start',
    period?.end ?? 'no-end',
    post.source_file_name ?? 'no-file',
  ].join(':')
}

export async function listImportGroups() {
  const { data, error } = await listAllImportedMetaPosts()
  if (error) return { data: [] as ImportedMetaPostGroup[], error }

  const groups = new Map<string, ImportedMetaPost[]>()
  data.forEach(post => {
    const key = groupKeyForPost(post)
    groups.set(key, [...(groups.get(key) ?? []), post])
  })

  const importGroups = [...groups.entries()].map(([key, posts]) => {
    const detectedPeriod = detectReportPeriod(
      posts.map(post => post.publish_time),
      posts[0]?.source_file_name
    )
    const latestCreatedAt = posts
      .map(post => post.created_at)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]

    return {
      key,
      import_batch_id: posts[0]?.import_batch_id ?? null,
      client_id: posts[0]?.client_id ?? '',
      platform: posts[0]?.platform ?? 'facebook',
      source_file_name: posts[0]?.source_file_name ?? null,
      period_start: detectedPeriod?.start ?? null,
      period_end: detectedPeriod?.end ?? null,
      created_at: latestCreatedAt ?? '',
      post_count: posts.length,
      total_reach: posts.reduce((sum, post) => sum + post.reach, 0),
      total_views: posts.reduce((sum, post) => sum + post.impressions, 0),
      total_engagements: posts.reduce((sum, post) => sum + post.engagements, 0),
      can_delete_by_batch: Boolean(posts[0]?.import_batch_id),
    } satisfies ImportedMetaPostGroup
  })

  return { data: importGroups, error: null }
}

export async function deleteImportGroup(group: ImportedMetaPostGroup) {
  if (group.import_batch_id) {
    return supabase
      .from('imported_meta_posts')
      .delete()
      .eq('import_batch_id', group.import_batch_id)
  }

  let query = supabase
    .from('imported_meta_posts')
    .delete()
    .eq('client_id', group.client_id)
    .eq('platform', group.platform)

  if (group.period_start) query = query.gte('publish_time', `${group.period_start}T00:00:00`)
  if (group.period_end) query = query.lte('publish_time', `${group.period_end}T23:59:59`)
  if (group.source_file_name) query = query.eq('source_file_name', group.source_file_name)

  return query
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
