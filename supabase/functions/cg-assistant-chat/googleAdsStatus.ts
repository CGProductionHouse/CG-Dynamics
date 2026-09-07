export interface GoogleAdsSavedStatus {
  accountCount: number | null
  lastSyncedAt: string | null
}

export function describeGoogleAdsStatus(state: GoogleAdsSavedStatus | null): string {
  if (!state || state.accountCount === null) return 'Google Ads reporting is available in Performance, but its saved integration status could not be checked.'
  if (state.accountCount === 0) return 'Google Ads reporting is available in Performance; no active accounts are saved yet.'
  const lastSync = state.lastSyncedAt && Number.isFinite(Date.parse(state.lastSyncedAt))
    ? new Date(state.lastSyncedAt).toISOString().slice(0, 10) : null
  return `Google Ads has ${state.accountCount} active saved account${state.accountCount === 1 ? '' : 's'}${lastSync ? `; the last successful sync was ${lastSync}` : '; no successful sync is recorded'}; this does not verify the current provider connection.`
}