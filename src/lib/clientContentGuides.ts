import { supabase } from './supabase'

export interface PublishedGuidelineVideo {
  position: number
  title: string
  script: string | null
  objective: string | null
  hook: string | null
  shot_breakdown: string | null
  cta: string | null
  visual_notes: string | null
  platform: string | null
  format: string | null
}

export interface PublishedContentGuideline {
  row_key: string
  title: string
  month: string | null
  run_name: string
  filming_date: string | null
  published_at: string
  videos: PublishedGuidelineVideo[]
}

const UNAVAILABLE = 'Published guidelines could not be loaded safely.'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const VIDEO_TEXT_FIELDS = ['script', 'objective', 'hook', 'shot_breakdown', 'cta', 'visual_notes', 'platform', 'format'] as const
const nullableText = (value: unknown): value is string | null => value === null || typeof value === 'string'
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

// Defence in depth for the existing ownership/publication-bound RPC. Extra
// transport fields never become client state; malformed data is not an empty plan.
function projectGuide(value: unknown, month: string): PublishedContentGuideline | null {
  if (!record(value) || typeof value.row_key !== 'string' || !value.row_key
    || typeof value.title !== 'string' || typeof value.run_name !== 'string'
    || value.month !== `${month}-01`
    || !(value.filming_date === null || validDate(value.filming_date))
    || typeof value.published_at !== 'string' || !validDate(value.published_at.slice(0, 10))
    || !/^\d{4}-\d{2}-\d{2}T/.test(value.published_at) || !Number.isFinite(Date.parse(value.published_at))
    || !Array.isArray(value.videos)) return null

  const videos: PublishedGuidelineVideo[] = []
  for (const video of value.videos) {
    if (!record(video) || typeof video.position !== 'number' || !Number.isSafeInteger(video.position) || video.position < 1
      || typeof video.title !== 'string' || !VIDEO_TEXT_FIELDS.every(field => nullableText(video[field]))) return null
    videos.push({
      position: video.position, title: video.title,
      ...Object.fromEntries(VIDEO_TEXT_FIELDS.map(field => [field, video[field]])) as Pick<PublishedGuidelineVideo, typeof VIDEO_TEXT_FIELDS[number]>,
    })
  }
  return {
    row_key: value.row_key, title: value.title, month: value.month,
    run_name: value.run_name, filming_date: value.filming_date,
    published_at: value.published_at, videos,
  }
}

export async function fetchPublishedGuides(
  clientId: string,
  month: string,
): Promise<{ data: PublishedContentGuideline[] | null; error: string | null }> {
  if (!UUID.test(clientId) || !MONTH.test(month)) return { data: null, error: UNAVAILABLE }
  try {
    const { data, error } = await supabase.rpc('client_portal_published_content_guidelines', {
      p_client_id: clientId,
      p_month: `${month}-01`,
    })
    if (error || !Array.isArray(data)) return { data: null, error: UNAVAILABLE }
    const projected = data.map(row => projectGuide(row, month))
    if (projected.some(row => row === null)) return { data: null, error: UNAVAILABLE }
    return { data: projected as PublishedContentGuideline[], error: null }
  } catch {
    return { data: null, error: UNAVAILABLE }
  }
}
