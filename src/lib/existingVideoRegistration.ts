import type { ContentGuideIdea } from './contentWorkflow'
import { isSafeHttpUrl, sanitiseSegment } from './videoPipelineRules'

export const EXISTING_VIDEO_EVIDENCE = {
  private_edit: { label: 'Private edit — not sent', status: 'editing' },
  internal_delivery: { label: 'Sent for internal review', status: 'internal_review' },
  owner_approval: { label: 'Owner approved — ready for client', status: 'ready_for_client' },
  client_delivery: { label: 'Sent to client — approval pending', status: 'sent_to_client' },
  client_approval: { label: 'Client approved', status: 'client_approved' },
} as const

export interface ExistingVideoInput {
  clientId: string
  clientName: string
  month: string
  title: string
  // Stable actual film stem, excluding revision/FINAL/REVIEW and extension.
  identity: string
  filename: string
  sha256: string
  revision: string
  editorName: string
  mediaUrl: string
  evidenceUrl: string
  evidence: string
  evidenceKind: keyof typeof EXISTING_VIDEO_EVIDENCE
}

export function validateExistingVideo(input: ExistingVideoInput): string | null {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.clientId)) return 'Select an exact client.'
  if (!input.clientName.trim() || !input.title.trim()) return 'Client and film title are required.'
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)) return 'Enter the intended release month, not the source shoot month.'
  if (!/^[A-Z0-9]+(?:_[A-Z0-9]+)*$/.test(input.identity) || input.identity.length > 200) return 'Enter the actual stable film identity in uppercase, without extension or revision.'
  if (!input.identity.startsWith(input.month.replace('-', '_') + '_')) return 'The film identity must match its release month.'
  if (!/^\d{4}_\d{2}_[A-Z0-9_]+_VIDEO_\d{2,3}_[A-Z0-9_]+$/.test(input.identity) || Number(input.identity.match(/_VIDEO_(\d+)_/)?.[1]) < 1) return 'Use the established client code, video number and concept in the film identity.'
  if (/_(?:R\d+|REVISION_\d+|REVIEW|FINAL)$/.test(input.identity)) return 'Remove the revision, REVIEW or FINAL suffix from the stable identity.'
  if (!/\.mp4$/i.test(input.filename.trim()) || /[\\/\r\n]/.test(input.filename)) return 'Enter the exact MP4 filename, not a local path.'
  if (!input.filename.toUpperCase().startsWith(input.identity + '.') && !input.filename.toUpperCase().startsWith(input.identity + '_')) return 'The filename must belong to this film identity.'
  if (!/^[a-f0-9]{64}$/i.test(input.sha256)) return 'A complete SHA-256 identifies the exact revision.'
  if (!input.revision.trim() || !input.editorName.trim()) return 'Revision and responsible editor are required.'
  if (![input.mediaUrl, input.evidenceUrl].every(url => isSafeHttpUrl(url) && url.trim().startsWith('https://'))) return 'Add ordinary https links for the media and its handoff/approval evidence.'
  if (!Object.hasOwn(EXISTING_VIDEO_EVIDENCE, input.evidenceKind)) return 'Choose the state supported by the evidence.'
  if (input.evidence.trim().length < 30) return 'Describe the source, date, recipient/approval authority and what is actually proven.'
  return null
}

export async function existingVideoId(clientId: string, identity: string): Promise<string> {
  // Same film/revision retry from two devices uses the existing PK as the atomic
  // collision guard. No upsert or update of an existing film is permitted here.
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`cg-existing-video-v1\n${clientId.toLowerCase()}\n${identity}`)))
  bytes[6] = (bytes[6] & 15) | 128
  bytes[8] = (bytes[8] & 63) | 128
  const hex = [...bytes.slice(0, 16)].map(value => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export type ExistingVideoRow = Pick<ContentGuideIdea, 'id' | 'client_id' | 'month' | 'title' | 'canonical_name' | 'notes' | 'status'>

export function existingVideoMatches(input: ExistingVideoInput, rows: ExistingVideoRow[], id: string): ExistingVideoRow[] {
  return rows.filter(row => row.client_id === input.clientId && (
    row.id === id || row.canonical_name?.toUpperCase() === input.identity ||
    // Legacy rows often have no canonical name. Stop for human reconciliation
    // rather than silently creating a second film under a different spelling.
    ((row.month ?? '').slice(0, 7) === input.month && sanitiseSegment(row.title) === sanitiseSegment(input.title)) ||
    (row.notes ?? '').toLowerCase().includes(input.sha256.toLowerCase())
  ))
}

interface Result<T> { data: T; error: string | null }
export interface ExistingVideoRepository {
  listClient: (clientId: string) => Promise<Result<ContentGuideIdea[]>>
  insert: (row: Partial<ContentGuideIdea> & { id: string; title: string }) => Promise<Result<ContentGuideIdea | null>>
  get: (id: string) => Promise<Result<ContentGuideIdea | null>>
}

export async function registerExistingVideoWith(
  input: ExistingVideoInput,
  actorId: string,
  repo: ExistingVideoRepository,
): Promise<{ data: ContentGuideIdea | null; matches: ExistingVideoRow[]; error: string | null }> {
  const error = validateExistingVideo(input)
  if (error) return { data: null, matches: [], error }
  if (!actorId) return { data: null, matches: [], error: 'Sign in before registering a film.' }
  const id = await existingVideoId(input.clientId, input.identity)
  const current = await repo.listClient(input.clientId)
  if (current.error) return { data: null, matches: [], error: current.error }
  const matches = existingVideoMatches(input, current.data, id)
  if (matches.length) return { data: null, matches, error: 'Matching history exists. Open and reconcile that record; nothing was inserted or overwritten.' }
  const state = EXISTING_VIDEO_EVIDENCE[input.evidenceKind].status
  const nameParts = /^\d{4}_\d{2}_([A-Z0-9_]+)_VIDEO_(\d{2,3})_/.exec(input.identity)!
  const row = {
    id, client_id: input.clientId, client_name: input.clientName, month: input.month + '-01',
    title: input.title.trim(), canonical_name: input.identity, format: 'video', status: 'in_production' as const,
    folder_client_code: nameParts[1], video_number: Number(nameParts[2]),
    content_guideline_id: null, deliverable_id: null, proposed_post_date: null,
    editor_user_id: null, editor_name: input.editorName.trim(), created_by: actorId,
    production_status: state, production_status_updated_at: new Date().toISOString(),
    onedrive_internal_review_url: input.mediaUrl.trim(),
    onedrive_client_approval_url: ['client_delivery', 'client_approval'].includes(input.evidenceKind) ? input.evidenceUrl.trim() : null,
    production_note: `${input.revision.trim()} | ${EXISTING_VIDEO_EVIDENCE[input.evidenceKind].label}`,
    notes: `EXISTING_VIDEO_V1\n${JSON.stringify({ identity: input.identity, filename: input.filename.trim(), sha256: input.sha256.toLowerCase(), revision: input.revision.trim(), evidence_kind: input.evidenceKind, evidence_url: input.evidenceUrl.trim(), evidence: input.evidence.trim() }, null, 2)}\nHistorical registration, not a new assignment, shoot or posting allocation. Recorded now; source dates and approval authority remain in evidence. No public posting inferred.`,
  }
  const inserted = await repo.insert(row)
  if (inserted.error) {
    // Includes a race or a network timeout after an accepted insert. Read only;
    // never blind-retry a write or replace a newer revision/status.
    const recovered = await repo.get(id)
    if (!recovered.error && recovered.data?.client_id === input.clientId && recovered.data.canonical_name === input.identity) {
      return { data: null, matches: [recovered.data], error: 'This film already exists. Open its saved record before making changes.' }
    }
    return { data: null, matches: [], error: inserted.error }
  }
  const saved = await repo.get(id)
  if (saved.error || !saved.data || saved.data.client_id !== input.clientId || saved.data.canonical_name !== input.identity || saved.data.notes !== row.notes || saved.data.production_status !== state || saved.data.editor_name !== row.editor_name || saved.data.content_guideline_id !== null || saved.data.deliverable_id !== null) {
    return { data: null, matches: [], error: 'The insert may have succeeded, but readback could not verify it. Reload the pipeline before retrying.' }
  }
  return { data: saved.data, matches: [], error: null }
}

export function selectedEditorPatch(selection: string, staff: Array<{ id: string; full_name: string | null }>): Partial<ContentGuideIdea> {
  if (selection === '__keep__') return {} // Preserve even a name-only or inactive editor.
  if (!selection) return { editor_user_id: null, editor_name: null }
  const person = staff.find(row => row.id === selection && row.full_name)
  if (!person) throw new Error('Select a listed editor or keep the current editor.')
  return { editor_user_id: person.id, editor_name: person.full_name }
}

export function matchesVideoEditor(filter: string, video: Pick<ContentGuideIdea, 'editor_user_id' | 'editor_name'>): boolean {
  if (!filter) return true
  return filter.startsWith('name:') ? !video.editor_user_id && video.editor_name === filter.slice(5) : video.editor_user_id === filter
}

export function canonicalForVideoEdit(
  idea: Pick<ContentGuideIdea, 'title' | 'folder_client_code' | 'video_number' | 'canonical_name'>,
  form: { title: string; folder_client_code: string; video_number: string },
  generated: string,
  defaultNumber: number | null,
): string | null {
  const initialNumber = idea.video_number ?? defaultNumber
  const changed = form.title.trim() !== idea.title.trim() || form.folder_client_code.trim() !== (idea.folder_client_code ?? '') || form.video_number.trim() !== (initialNumber == null ? '' : String(initialNumber))
  // Editing notes/links/editor must not silently rename an old film whose actual
  // code/title differs from today's generic name derivation.
  return changed ? generated || null : idea.canonical_name
}
