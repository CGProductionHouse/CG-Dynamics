import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { ContentGuideIdea } from '../../../src/lib/contentWorkflow.ts'
import { registerExistingVideoWith, type ExistingVideoInput } from '../../../src/lib/existingVideoRegistration.ts'
import { fetchAllRows } from '../_shared/paginatedRows.ts'

interface TrackingActor {
  profileId: string
  contextKind: string
  connection: { role: string }
  supabase: SupabaseClient
}

const FIELDS = new Set(['client_id', 'month', 'title', 'identity', 'filename', 'sha256', 'revision', 'editor_name',
  'media_url', 'source_device', 'source_path', 'evidence_url', 'evidence', 'evidence_kind', 'idempotency_key'])

// Historical tracking only. Uses the SAME registration/dedup/readback contract
// as the staff Pipeline. No guideline/run/slot, file copy or approval operation.
export async function registerExistingInternalVideo(staff: TrackingActor, input: Record<string, unknown>) {
  if (staff.contextKind !== 'company_admin' || !['admin', 'manager'].includes(staff.connection.role)) return { error: 'COMPANY_ADMIN_REQUIRED' }
  if (Object.keys(input).some(key => !FIELDS.has(key))) return { error: 'UNSUPPORTED_TRACKING_FIELD' }
  if (Object.entries(input).some(([, value]) => typeof value !== 'string' || value.length > 12000)) return { error: 'INVALID_TRACKING_INPUT' }
  if (!['private_edit', 'internal_delivery'].includes(String(input.evidence_kind))) return { error: 'INTERNAL_TRACKING_ONLY', message: 'Approval and client delivery require their existing explicit workflow.' }
  if (typeof input.client_id !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.client_id)) return { error: 'EXACT_ACTIVE_CLIENT_REQUIRED' }
  const clientId = input.client_id.toLowerCase()
  const { data: client, error } = await staff.supabase.from('clients').select('id,name,active').eq('id', clientId).eq('active', true).maybeSingle()
  if (error || !client) return { error: 'EXACT_ACTIVE_CLIENT_UNAVAILABLE' }
  const text = (key: string) => typeof input[key] === 'string' ? input[key] as string : ''
  const values: ExistingVideoInput = {
    clientId, clientName: client.name, month: text('month'), title: text('title'), identity: text('identity'),
    filename: text('filename'), sha256: text('sha256'), revision: text('revision'), editorName: text('editor_name'),
    mediaUrl: text('media_url'), sourceDevice: text('source_device'), sourcePath: text('source_path'),
    evidenceUrl: text('evidence_url'), evidence: text('evidence'), evidenceKind: input.evidence_kind as 'private_edit' | 'internal_delivery',
  }
  const result = await registerExistingVideoWith(values, staff.profileId, {
    listClient: async id => {
      const result = await fetchAllRows<ContentGuideIdea>((from, to) => staff.supabase.from('content_guide_ideas').select('*').eq('client_id', id).order('id').range(from, to))
      return { data: result.data, error: result.error?.message ?? null }
    },
    insert: async row => {
      const { data, error } = await staff.supabase.from('content_guide_ideas').insert(row).select('*').single()
      return { data: data as ContentGuideIdea | null, error: error?.message ?? null }
    },
    get: async id => {
      const { data, error } = await staff.supabase.from('content_guide_ideas').select('*').eq('id', id).eq('client_id', clientId).maybeSingle()
      return { data: data as ContentGuideIdea | null, error: error?.message ?? null }
    },
  })
  if (!result.data) return { error: 'VIDEO_REGISTRATION_NOT_CONFIRMED', message: result.error, existing_video_ids: result.matches.map(row => row.id) }
  return { id: result.data.id, client_id: result.data.client_id, month: result.data.month, canonical_name: result.data.canonical_name,
    production_status: result.data.production_status, editor_name: result.data.editor_name,
    media_filing: values.mediaUrl.trim() ? 'linked' : 'pending',
    pipeline_url: 'https://www.cgdynamics.co.za/admin/content?tab=pipeline',
    message: 'Existing internal film saved and re-read. No shoot, posting slot, approval or publication created.' }
}
