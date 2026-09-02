import type { ClientOnboardingState } from './types'

interface Milestone {
  id: string
  label: string
  timestamp: string | null
  completed: boolean
}

export function OnboardingTimeline({ state }: { state: ClientOnboardingState }) {
  const milestones = deriveMilestones(state)

  if (milestones.every(m => !m.completed && !m.timestamp)) return null

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
      <h2 className="text-lg font-bold text-white">Timeline</h2>
      <div className="mt-4 space-y-0">
        {milestones.map((milestone, index) => (
          <div key={milestone.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                milestone.completed
                  ? 'bg-brand-teal/20 text-brand-teal'
                  : 'bg-white/[0.06] text-report-faint'
              }`}>
                {milestone.completed ? (
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <div className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </div>
              {index < milestones.length - 1 && (
                <div className={`w-px flex-1 ${milestone.completed ? 'bg-brand-teal/20' : 'bg-white/[0.08]'}`} />
              )}
            </div>
            <div className="pb-4">
              <p className={`text-sm font-semibold ${milestone.completed ? 'text-white' : 'text-report-muted'}`}>
                {milestone.label}
              </p>
              {milestone.timestamp && (
                <p className="mt-0.5 text-xs text-report-faint">{formatTimestamp(milestone.timestamp)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function deriveMilestones(state: ClientOnboardingState): Milestone[] {
  const milestones: Milestone[] = []

  if (state.startedAt) {
    milestones.push({ id: 'started', label: 'Onboarding started', timestamp: state.startedAt, completed: true })
  }

  const hasLogo = state.uploads.some(u => u.category === 'logo' && u.uploadStatus === 'received')
  if (hasLogo) {
    milestones.push({ id: 'logo', label: 'Brand files received', timestamp: state.lastActivityAt, completed: true })
  }

  const hasServices = !!state.typedDescription || state.serviceItems.length > 0 || state.uploads.some(u => u.category === 'services' && u.uploadStatus === 'received')
  if (hasServices) {
    milestones.push({ id: 'services', label: 'Services information received', timestamp: state.lastActivityAt, completed: true })
  }

  const verifiedAccess = state.platformAccess.filter(a => a.connectionState === 'verified')
  if (verifiedAccess.length > 0) {
    milestones.push({ id: 'access', label: `Account access verified (${verifiedAccess.length} platform${verifiedAccess.length > 1 ? 's' : ''})`, timestamp: verifiedAccess[0].verifiedAt, completed: true })
  }

  if (state.status === 'completed') {
    milestones.push({ id: 'completed', label: 'Onboarding complete', timestamp: state.completedAt, completed: true })
  }

  return milestones
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts)
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ts
  }
}
