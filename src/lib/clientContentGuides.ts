import { supabase } from './supabase'

export interface PublishedGuidelineVideo {
  position: number
  title: string
  script: string
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

export async function fetchPublishedGuides(
  clientId: string,
  month: string,
): Promise<{ data: PublishedContentGuideline[] | null; error: string | null }> {
  const { data, error } = await supabase.rpc('client_portal_published_content_guidelines', {
    p_client_id: clientId,
    p_month: `${month}-01`,
  })

  if (error) return { data: null, error: error.message }
  return { data: data as unknown as PublishedContentGuideline[], error: null }
}
