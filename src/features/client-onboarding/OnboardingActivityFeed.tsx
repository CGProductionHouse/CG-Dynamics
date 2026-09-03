import type { StaffOnboardingSummary } from './types'
import { PLATFORM_GUIDES } from './platformGuides'

interface ActivityEvent {
  id: string
  label: string
  timestamp: string
  tone: 'done' | 'current' | 'pending'
}

function deriveActivityEvents(session: StaffOnboardingSummary): ActivityEvent[] {
  const events: ActivityEvent[] = []

  if (session.revokedAt) {
    events.push({ id: 'revoked', label: 'Link revoked', timestamp: session.revokedAt, tone: 'pending' })
  }

  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    events.push({ id: 'expired', label: 'Link expired', timestamp: session.expiresAt, tone: 'pending' })
  }

  if (session.startedAt) {
    events.push({ id: 'started', label: 'Onboarding started', timestamp: session.startedAt, tone: 'done' })
  }

  const logoReceived = session.uploads.some(u => u.category === 'logo' && u.uploadStatus === 'received')
  if (logoReceived) {
    const logoUpload = session.uploads.find(u => u.category === 'logo' && u.uploadStatus === 'received')
    events.push({ id: 'logo', label: 'Logo uploaded', timestamp: logoUpload?.uploadedAt ?? session.lastActivityAt, tone: 'done' })
  }

  const servicesReceived = session.typedDescription || session.serviceItems.length > 0 || session.uploads.some(u => u.category === 'services' && u.uploadStatus === 'received')
  if (servicesReceived) {
    const svcUpload = session.uploads.find(u => u.category === 'services' && u.uploadStatus === 'received')
    events.push({ id: 'services', label: 'Services information received', timestamp: svcUpload?.uploadedAt ?? session.lastActivityAt, tone: 'done' })
  }

  for (const access of session.platformAccess) {
    if (access.verifiedAt) {
      events.push({
        id: `access-verified-${access.platform}`,
        label: `${PLATFORM_GUIDES[access.platform]?.label ?? access.platform} verified`,
        timestamp: access.verifiedAt,
        tone: 'done',
      })
    } else if (access.submittedAt && access.clientChoice === 'connect_now') {
      events.push({
        id: `access-pending-${access.platform}`,
        label: `${PLATFORM_GUIDES[access.platform]?.label ?? access.platform} awaiting verification`,
        timestamp: access.submittedAt,
        tone: 'current',
      })
    }
  }

  if (session.status === 'completed' && session.completedAt) {
    events.push({ id: 'completed', label: 'Onboarding complete', timestamp: session.completedAt, tone: 'done' })
  } else if (!session.revokedAt && session.startedAt) {
    events.push({ id: 'current', label: 'In progress', timestamp: session.lastActivityAt, tone: 'current' })
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return events
}

export function OnboardingActivityFeed({ session }: { session: StaffOnboardingSummary }) {
  const events = deriveActivityEvents(session)
  if (events.length === 0) return null

  const toneClass = {
    done: 'bg-brand-teal/20 text-brand-teal',
    current: 'bg-brand-accent/20 text-brand-accent',
    pending: 'bg-white/[0.06] text-report-faint',
  }

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-report-faint">Activity</p>
      <div className="mt-3 space-y-2">
        {events.map(event => (
          <div key={event.id} className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${toneClass[event.tone]}`}>
              {event.tone === 'done' ? (
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              ) : event.tone === 'current' ? (
                <div className="h-1.5 w-1.5 rounded-full bg-current" />
              ) : (
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white">{event.label}</p>
              <p className="text-xs text-report-faint">{formatActivityTime(event.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatActivityTime(ts: string): string {
  try {
    const date = new Date(ts)
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ts
  }
}
