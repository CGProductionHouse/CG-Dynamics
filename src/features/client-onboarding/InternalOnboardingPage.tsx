import { useEffect, useMemo, useState } from 'react'
import { ActionButton } from '../../components/ui/Buttons'
import { EmptyState } from '../../components/ui/States'
import { listClients, type Client } from '../../lib/db/clients'
import { generateOnboardingLink, listStaffOnboarding, revokeOnboardingLink, updateStaffAccess } from './api'
import { OnboardingActivityFeed } from './OnboardingActivityFeed'
import { ONBOARDING_PLATFORMS, type OnboardingPlatform, type StaffOnboardingSummary } from './types'
import { PLATFORM_GUIDES } from './platformGuides'

type StatusFilter = 'all' | 'not_started' | 'in_progress' | 'completed' | 'revoked' | 'expired'

export default function InternalOnboardingPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [sessions, setSessions] = useState<StaffOnboardingSummary[]>([])
  const [clientId, setClientId] = useState('')
  const [platforms, setPlatforms] = useState<OnboardingPlatform[]>([])
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [clientsResult, sessionsResult] = await Promise.all([listClients(), listStaffOnboarding()])
    setClients(clientsResult.data.filter(client => client.active))
    setSessions(sessionsResult.data ?? [])
    setError(clientsResult.error?.message ?? sessionsResult.error)
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    void Promise.all([listClients(), listStaffOnboarding()]).then(([clientsResult, sessionsResult]) => {
      if (!active) return
      setClients(clientsResult.data.filter(client => client.active))
      setSessions(sessionsResult.data ?? [])
      setError(clientsResult.error?.message ?? sessionsResult.error)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const clientNames = useMemo(() => new Map(clients.map(client => [client.id, client.name])), [clients])

  async function generate() {
    if (!clientId) return
    setWorking(true)
    setGeneratedLink(null)
    const result = await generateOnboardingLink(clientId, platforms)
    if (result.data) {
      setGeneratedLink(`${window.location.origin}/welcome#${result.data.token}`)
      await load()
    } else setError(result.error)
    setWorking(false)
  }

  async function revoke(sessionId: string) {
    const result = await revokeOnboardingLink(sessionId)
    if (result.error) setError(result.error)
    else await load()
  }

  const filteredSessions = useMemo(() => {
    let list = sessions
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s => {
        const name = clientNames.get(s.clientId) ?? s.clientName
        return name.toLowerCase().includes(q)
      })
    }
    if (statusFilter !== 'all') {
      if (statusFilter === 'expired') {
        list = list.filter(s => s.expiresAt && new Date(s.expiresAt) < new Date() && !s.revokedAt)
      } else {
        list = list.filter(s => s.status === statusFilter)
      }
    }
    return list
  }, [sessions, search, statusFilter, clientNames])

  const statusCounts = useMemo(() => {
    const now = new Date()
    const counts: Record<StatusFilter, number> = { all: sessions.length, not_started: 0, in_progress: 0, completed: 0, revoked: 0, expired: 0 }
    for (const s of sessions) {
      if (s.revokedAt) counts.revoked++
      else if (s.expiresAt && new Date(s.expiresAt) < now) counts.expired++
      else counts[s.status as keyof typeof counts]++
    }
    return counts
  }, [sessions])

  return (
    <div className="w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-accent">Client Performance</p>
        <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-wide text-white sm:text-4xl">Client onboarding</h1>
        <p className="mt-2 max-w-2xl text-sm text-brand-primary/80">Generate Welcome to CG links and review exact-client setup state.</p>
      </header>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">{error}</p>}

      {/* Generate link */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
        <h2 className="text-lg font-bold text-white">Generate onboarding link</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="text-sm font-semibold text-brand-primary">Client
            <select value={clientId} onChange={event => setClientId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-brand-bg px-4 text-white">
              <option value="">Select a client</option>
              {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
          <ActionButton className="min-h-12" disabled loading={working} onClick={() => void generate()}>Generate secure link</ActionButton>
        </div>
        <p className="mt-3 text-sm text-[#e5b18d]">Link generation is disabled until the approved OneDrive upload adapter is connected. This prevents clients entering a setup they cannot complete.</p>
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-white">Platforms CG manages for this client</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {ONBOARDING_PLATFORMS.map(platform => (
              <label key={platform} className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 px-3 text-sm text-brand-primary">
                <input type="checkbox" checked={platforms.includes(platform)} onChange={event => setPlatforms(current => event.target.checked ? [...current, platform] : current.filter(item => item !== platform))} className="h-5 w-5 accent-[#c17a49]" />
                {PLATFORM_GUIDES[platform].label}
              </label>
            ))}
          </div>
        </fieldset>
        {generatedLink && (
          <div className="mt-5 rounded-xl border border-brand-teal/25 bg-brand-teal/[0.06] p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-teal">Copy now. The plaintext token is not stored.</p>
            <p className="mt-2 break-all text-sm text-white">{generatedLink}</p>
            <div className="mt-3 flex gap-2">
              <ActionButton variant="secondary" onClick={() => void navigator.clipboard.writeText(generatedLink)}>Copy link</ActionButton>
            </div>
          </div>
        )}
      </section>

      {/* Onboarding status */}
      <section className="mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-white">Onboarding status</h2>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search clients..."
              className="min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white placeholder:text-report-faint sm:w-56"
            />
            <StatusPill label="All" count={statusCounts.all} active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            <StatusPill label="Active" count={statusCounts.in_progress} active={statusFilter === 'in_progress'} onClick={() => setStatusFilter('in_progress')} tone="accent" />
            <StatusPill label="Done" count={statusCounts.completed} active={statusFilter === 'completed'} onClick={() => setStatusFilter('completed')} tone="teal" />
            <StatusPill label="Expired" count={statusCounts.expired} active={statusFilter === 'expired'} onClick={() => setStatusFilter('expired')} />
            <StatusPill label="Revoked" count={statusCounts.revoked} active={statusFilter === 'revoked'} onClick={() => setStatusFilter('revoked')} />
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-brand-primary">Loading onboarding status...</p>
        ) : filteredSessions.length === 0 ? (
          <EmptyState className="mt-4" title="No onboarding sessions" message={sessions.length === 0 ? 'Generate a client-specific link to get started.' : 'No sessions match your filters.'} />
        ) : (
          <div className="mt-4 space-y-4">
            {filteredSessions.map(session => {
              const isExpanded = expandedId === session.sessionId
              return (
                <article key={session.sessionId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => setExpandedId(isExpanded ? null : session.sessionId)} className="text-left">
                        <h3 className="font-bold text-white hover:text-brand-teal transition-colors">{clientNames.get(session.clientId) ?? session.clientName}</h3>
                      </button>
                      <p className="mt-1 text-xs text-brand-primary/70">
                        Started {formatDate(session.startedAt)} · Completed {formatDate(session.completedAt)} · Last activity {formatDate(session.lastActivityAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <SessionStatusBadge status={session.status} expiresAt={session.expiresAt} revokedAt={session.revokedAt} />
                      {!session.revokedAt && session.status !== 'completed' && (
                        <ActionButton variant="secondary" className="min-h-9 text-xs" onClick={() => void revoke(session.sessionId)}>Revoke</ActionButton>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <ProgressStrip session={session} />
                  </div>

                  {/* Quick status */}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <StatusLine label="Logo" value={session.uploads.some(u => u.category === 'logo' && u.uploadStatus === 'received') ? 'Received' : 'Not received'} received={session.uploads.some(u => u.category === 'logo' && u.uploadStatus === 'received')} />
                    <StatusLine label="Services" value={session.typedDescription || session.serviceItems.length || session.uploads.some(u => u.category === 'services' && u.uploadStatus === 'received') ? 'Received' : 'Not received'} received={!!(session.typedDescription || session.serviceItems.length || session.uploads.some(u => u.category === 'services' && u.uploadStatus === 'received'))} />
                  </div>

                  {/* Expanded drill-down */}
                  {isExpanded && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      {/* Platform access */}
                      {session.platformAccess.length > 0 && (
                        <div className="divide-y divide-white/10">
                          {session.platformAccess.map(access => (
                            <div key={access.platform} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                              <span className="font-semibold text-white">{PLATFORM_GUIDES[access.platform].label}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-brand-primary/70">{access.clientChoice ?? 'no choice'} · {access.connectionState.replaceAll('_', ' ')}</span>
                                {access.clientChoice === 'connect_now' && !access.verifiedAt && (
                                  <>
                                    <button type="button" className="min-h-9 rounded-lg border border-brand-teal/30 px-3 text-xs font-bold text-brand-teal" onClick={() => void updateStaffAccess(session.sessionId, access.platform, 'verified').then(load)}>Verify</button>
                                    <button type="button" className="min-h-9 rounded-lg border border-red-400/25 px-3 text-xs font-bold text-red-300" onClick={() => void updateStaffAccess(session.sessionId, access.platform, 'failed').then(load)}>Needs follow-up</button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Activity feed */}
                      <OnboardingActivityFeed session={session} />

                      {/* Additional notes */}
                      {session.additionalNotes && (
                        <div className="mt-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-report-faint">Additional notes</p>
                          <p className="mt-2 text-sm text-report-muted whitespace-pre-wrap">{session.additionalNotes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function StatusPill({ label, count, active, onClick, tone }: { label: string; count: number; active: boolean; onClick: () => void; tone?: 'teal' | 'accent' }) {
  const activeClass = tone === 'teal' ? 'bg-brand-teal/20 text-brand-teal border-brand-teal/30'
    : tone === 'accent' ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/30'
    : active ? 'bg-white/[0.1] text-white border-white/20' : ''
  return (
    <button type="button" onClick={onClick} className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors ${active ? activeClass : 'border-white/10 text-brand-primary/60 hover:border-white/20 hover:text-white'}`}>
      {label} <span className="ml-1 opacity-60">{count}</span>
    </button>
  )
}

function SessionStatusBadge({ status, expiresAt, revokedAt }: { status: string; expiresAt: string | null; revokedAt: string | null }) {
  let label = status.replace('_', ' ')
  let classes = 'bg-white/[0.06] text-brand-primary'
  if (revokedAt) { label = 'revoked'; classes = 'bg-red-400/10 text-red-300' }
  else if (status === 'completed') { classes = 'bg-brand-teal/10 text-brand-teal' }
  else if (status === 'in_progress') { classes = 'bg-brand-accent/10 text-brand-accent' }
  else if (expiresAt && new Date(expiresAt) < new Date()) { label = 'expired'; classes = 'bg-yellow-400/10 text-yellow-300' }
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classes}`}>{label}</span>
}

function ProgressStrip({ session }: { session: StaffOnboardingSummary }) {
  const steps = [
    { label: 'Logo', done: session.uploads.some(u => u.category === 'logo' && u.uploadStatus === 'received') },
    { label: 'Services', done: !!(session.typedDescription || session.serviceItems.length || session.uploads.some(u => u.category === 'services' && u.uploadStatus === 'received')) },
    { label: 'Access', done: session.platformAccess.every(a => a.clientChoice !== 'connect_now' || a.verifiedAt) },
    { label: 'Complete', done: session.status === 'completed' },
  ]
  const done = steps.filter(s => s.done).length
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-teal to-brand-accent transition-all duration-500" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <span className="text-xs text-report-faint">{done}/{steps.length}</span>
    </div>
  )
}

function StatusLine({ label, value, received }: { label: string; value: string; received: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${received ? 'border-brand-teal/20 bg-brand-teal/[0.04]' : 'border-white/8 bg-black/10'}`}>
      <p className="text-xs text-brand-primary/60">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${received ? 'text-brand-teal' : 'text-white'}`}>{value}</p>
    </div>
  )
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'not yet'
}
