export type OnboardingLinkReadiness = {
  canGenerate: boolean
  state: 'ready' | 'admin_required' | 'activation_off' | 'unconfigured' | 'unavailable' | 'client_unavailable'
}

export function hasCompleteClientUploadMappings(clientId: string, rows: ReadonlyArray<{
  client_id: string
  upload_category: string
  drive_id: string
  folder_item_id: string
}>): boolean {
  return Boolean(clientId) && ['logo', 'services', 'optional'].every(category =>
    rows.some(row => row.client_id === clientId && row.upload_category === category &&
      typeof row.drive_id === 'string' && row.drive_id.trim() &&
      typeof row.folder_item_id === 'string' && row.folder_item_id.trim()))
}

/** Read-only capability, not proof of a successful live upload. Never refresh tokens. */
export async function onboardingLinkReadiness(input: {
  role: string
  uploadsEnabled: boolean
  adapterConfigured: boolean
  hasStoredConsent: () => Promise<boolean>
  hasClientUploadMappings: () => Promise<boolean>
}): Promise<OnboardingLinkReadiness> {
  if (input.role !== 'admin') return { canGenerate: false, state: 'admin_required' }
  if (!input.uploadsEnabled) return { canGenerate: false, state: 'activation_off' }
  if (!input.adapterConfigured) return { canGenerate: false, state: 'unconfigured' }
  try {
    if (!(await input.hasStoredConsent())) return { canGenerate: false, state: 'unavailable' }
    if (!(await input.hasClientUploadMappings())) return { canGenerate: false, state: 'client_unavailable' }
    return { canGenerate: true, state: 'ready' }
  } catch {
    // Missing/unreadable/decryption-failed consent is never a ready capability.
  }
  return { canGenerate: false, state: 'unavailable' }
}
