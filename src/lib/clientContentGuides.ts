import { supabase } from './supabase'

export type PublishedGuide = {
  row_key: string
  title: string
  deliverable_title: string | null
  objective: string | null
  hook: string | null
  script: string | null
  shot_breakdown: string | null
  cta: string | null
  visual_notes: string | null
  platform: string | null
  format: string | null
  canonical_name: string | null
  video_number: number | null
  published_at: string
}

export async function fetchPublishedGuides(
  clientId: string,
  month: string,
): Promise<{ data: PublishedGuide[] | null; error: string | null }> {
  const { data, error } = await supabase.rpc('client_portal_published_guides', {
    p_client_id: clientId,
    p_month: `${month}-01`,
  })

  if (error) return { data: null, error: error.message }
  return { data: data as unknown as PublishedGuide[], error: null }
}
