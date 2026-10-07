const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const READ_ACTIONS = ['portal_library_load', 'portal_library_month', 'portal_library_access', 'portal_load', 'portal_download'] as const

/** Call only after server-side JWT/profile authentication. No write action is admitted. */
export function resolveLibraryReadScope(action: string, profile: { role: string; client_id: string | null }, requested: unknown) {
  const preview = action.startsWith('staff_preview_')
  const canonicalAction = preview ? action.slice('staff_preview_'.length) : action
  if (!READ_ACTIONS.some(item => item === canonicalAction)) return null
  if (preview) {
    if (!['admin', 'manager'].includes(profile.role) || typeof requested !== 'string' || !UUID.test(requested)) return null
    return { action: canonicalAction, clientId: requested }
  }
  if (profile.role !== 'client' || !profile.client_id) return null
  if (requested !== undefined && requested !== profile.client_id) return null
  return { action: canonicalAction, clientId: profile.client_id }
}
