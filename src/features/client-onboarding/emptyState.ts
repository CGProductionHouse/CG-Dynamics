/** Client inventory and onboarding session evidence are separate authorities. */
export function onboardingEmptyState({ activeClients, sessions, filteredSessions, loading, error }: {
  activeClients: number
  sessions: number
  filteredSessions: number
  loading: boolean
  error: string | null
}): { title: string; message: string } | null {
  if (loading || error || filteredSessions > 0) return null
  if (activeClients === 0) return { title: 'No active clients', message: 'No active clients available.' }
  if (sessions === 0) return { title: 'No onboarding sessions yet', message: 'Active clients are available, but no onboarding sessions have been created.' }
  return { title: 'No sessions found', message: 'No sessions match your filters.' }
}
