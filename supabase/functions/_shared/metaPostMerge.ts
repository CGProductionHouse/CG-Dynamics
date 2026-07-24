import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Platform = 'facebook' | 'instagram'

interface PostRow {
  id: string
  publish_time: string | null
  caption: string | null
  permalink: string | null
  raw: unknown
}

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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function normalizedCaption(value: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function normalizedPermalink(value: string | null): string {
  const raw = (value ?? '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return raw.toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '')
  }
}

function closePublishTime(left: string | null, right: string | null): boolean {
  if (!left || !right) return false
  const delta = Math.abs(Date.parse(left) - Date.parse(right))
  return Number.isFinite(delta) && delta <= 18 * 60 * 60 * 1000
}

function isImported(row: PostRow): boolean {
  return asRecord(row.raw).source !== 'meta_sync'
}

async function findImportedMatch(
  sb: SupabaseClient,
  payload: MetaPostPayload,
): Promise<PostRow | null> {
  const { data, error } = await sb
    .from('posts')
    .select('id, publish_time, caption, permalink, raw')
    .eq('report_id', payload.report_id)
    .eq('platform', payload.platform)
  if (error) throw new Error(`Could not inspect existing ${payload.platform} report posts: ${error.message}`)

  const imported = (data ?? []).filter((row): row is PostRow => Boolean(row?.id) && isImported(row as PostRow))
  if (imported.length === 0) return null

  const { data: mappings, error: mappingsError } = await sb
    .from('meta_content_mappings')
    .select('post_id')
    .in('post_id', imported.map(row => row.id))
  if (mappingsError) throw new Error(`Could not inspect existing Meta post mappings: ${mappingsError.message}`)

  const alreadyMapped = new Set((mappings ?? []).map(row => row.post_id).filter(Boolean))
  const candidates = imported.filter(row => !alreadyMapped.has(row.id))
  const permalink = normalizedPermalink(payload.permalink)
  const permalinkMatches = permalink
    ? candidates.filter(row => normalizedPermalink(row.permalink) === permalink)
    : []
  if (permalinkMatches.length === 1) return permalinkMatches[0]

  const caption = normalizedCaption(payload.caption)
  if (!caption) return null
  const captionMatches = candidates.filter(row =>
    normalizedCaption(row.caption) === caption
    && closePublishTime(row.publish_time, payload.publish_time),
  )
  return captionMatches.length === 1 ? captionMatches[0] : null
}

function importedUpdate(row: PostRow, payload: MetaPostPayload): Record<string, unknown> {
  return {
    permalink: row.permalink || payload.permalink,
    raw: {
      ...asRecord(row.raw),
      meta_sync: payload.raw,
    },
  }
}

export async function upsertMetaReportPost(
  sb: SupabaseClient,
  args: {
    clientId: string
    metaObjectId: string
    metaObjectType?: string | null
    payload: MetaPostPayload
  },
): Promise<{ postId: string; inserted: boolean; reusedImported: boolean }> {
  const { clientId, metaObjectId, metaObjectType, payload } = args
  const now = new Date().toISOString()
  const { data: mappings, error: mappingLookupError } = await sb
    .from('meta_content_mappings')
    .select('id, post_id')
    .eq('client_id', clientId)
    .eq('platform', payload.platform)
    .eq('meta_object_id', metaObjectId)
    .limit(1)
  if (mappingLookupError) throw new Error(`Could not inspect existing Meta content mapping: ${mappingLookupError.message}`)

  const mapping = mappings?.[0] ?? null
  let existingPost: PostRow | null = null
  if (mapping?.post_id) {
    const { data, error } = await sb
      .from('posts')
      .select('id, publish_time, caption, permalink, raw')
      .eq('id', mapping.post_id)
      .maybeSingle()
    if (error) throw new Error(`Could not inspect mapped ${payload.platform} post: ${error.message}`)
    existingPost = data as PostRow | null
  }
  if (!existingPost) existingPost = await findImportedMatch(sb, payload)

  let postId: string
  let inserted = false
  const reusedImported = Boolean(existingPost && isImported(existingPost))
  if (existingPost) {
    const update = reusedImported ? importedUpdate(existingPost, payload) : payload
    const { error } = await sb.from('posts').update(update).eq('id', existingPost.id)
    if (error) throw new Error(`Could not update ${payload.platform} report post: ${error.message}`)
    postId = existingPost.id
  } else {
    const { data, error } = await sb.from('posts').insert(payload).select('id').single()
    if (error || !data?.id) throw new Error(`Could not save ${payload.platform} report post: ${error?.message ?? 'missing post id'}`)
    postId = data.id
    inserted = true
  }

  const mappingPayload = {
    client_id: clientId,
    report_id: payload.report_id,
    post_id: postId,
    platform: payload.platform,
    meta_object_id: metaObjectId,
    meta_object_type: metaObjectType ?? null,
    permalink: payload.permalink,
    last_synced_at: now,
  }
  if (mapping) {
    const { error } = await sb.from('meta_content_mappings').update(mappingPayload).eq('id', mapping.id)
    if (error) throw new Error(`Could not update ${payload.platform} content mapping: ${error.message}`)
  } else {
    const { error } = await sb.from('meta_content_mappings').insert(mappingPayload)
    if (error) throw new Error(`Could not save ${payload.platform} content mapping: ${error.message}`)
  }

  return { postId, inserted, reusedImported }
}
