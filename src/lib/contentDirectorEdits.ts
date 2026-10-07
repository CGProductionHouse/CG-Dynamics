/** No model authority or writes here. Accept only fields requested against a saved revision. */
export const EDIT_FIELDS = {
  script: 'script', shotBreakdown: 'shot_breakdown', requirements: 'requirements',
  visualNotes: 'visual_notes', cta: 'cta',
} as const
export type DirectorEditField = keyof typeof EDIT_FIELDS

export function validSavedRevision(value: unknown): value is string {
  // Preserve PostgreSQL microseconds verbatim; Date round-tripping would lose the CAS token.
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value))
}

export function developmentPatch(
  video: { id: string; updated_at: string; [key: string]: unknown },
  proposal: { videoId: string; baseUpdatedAt?: string | null; targetFields?: DirectorEditField[]; [key: string]: unknown },
  mode: 'fill' | 'replace',
): { patch: Record<string, string>; error: string | null } {
  const fail = (error: string) => ({ patch: {}, error })
  if (proposal.videoId !== video.id || !validSavedRevision(proposal.baseUpdatedAt)
    || proposal.baseUpdatedAt !== video.updated_at) return fail('This video changed or its saved revision is unavailable. Reload and request a new proposal.')
  const fields = proposal.targetFields ?? Object.keys(EDIT_FIELDS) as DirectorEditField[]
  if (!fields.length || new Set(fields).size !== fields.length || fields.some(field => !Object.hasOwn(EDIT_FIELDS, field))) {
    return fail('Invalid requested fields. Nothing was changed.')
  }
  const patch: Record<string, string> = {}
  for (const field of fields) {
    const value = typeof proposal[field] === 'string' ? proposal[field].trim() : ''
    const column = EDIT_FIELDS[field]
    const existing = typeof video[column] === 'string' ? video[column].trim() : ''
    if (value && (!existing || mode === 'replace')) patch[column] = value
  }
  return Object.keys(patch).length ? { patch, error: null } : fail('No empty requested field to fill. Explicitly accept a replacement or discard the proposal.')
}
