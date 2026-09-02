import { useEffect, useMemo, useState } from 'react'
import { ActionButton } from '../../components/ui/Buttons'
import { EmptyState } from '../../components/ui/States'
import { listClients, type Client } from '../../lib/db/clients'
import { generateOnboardingLink, listStaffOnboarding, updateStaffAccess } from './api'
import { ONBOARDING_PLATFORMS, type OnboardingPlatform, type StaffOnboardingSummary } from './types'
import { PLATFORM_GUIDES } from './platformGuides'

export default function InternalOnboardingPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [sessions, setSessions] = useState<StaffOnboardingSummary[]>([])
  const [clientId, setClientId] = useState('')
  const [platforms, setPlatforms] = useState<OnboardingPlatform[]>([])
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <header><p className="text-xs font-black uppercase tracking-[0.2em] text-brand-accent">Client Performance</p><h1 className="mt-2 font-display text-3xl font-black uppercase tracking-wide text-white sm:text-4xl">Client onboarding</h1><p className="mt-2 max-w-2xl text-sm text-brand-primary/80">Generate Welcome to CG links and review exact-client setup state.</p></header>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">{error}</p>}

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
        <h2 className="text-lg font-bold text-white">Generate onboarding link</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="text-sm font-semibold text-brand-primary">Client<select value={clientId} onChange={event => setClientId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-brand-bg px-4 text-white"><option value="">Select a client</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
          <ActionButton className="min-h-12" disabled loading={working} onClick={() => void generate()}>Generate secure link</ActionButton>
        </div>
        <p className="mt-3 text-sm text-[#e5b18d]">Link generation is disabled until the approved OneDrive upload adapter is connected. This prevents clients entering a setup they cannot complete.</p>
        <fieldset className="mt-5"><legend className="text-sm font-semibold text-white">Platforms CG manages for this client</legend><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{ONBOARDING_PLATFORMS.map(platform => <label key={platform} className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 px-3 text-sm text-brand-primary"><input type="checkbox" checked={platforms.includes(platform)} onChange={event => setPlatforms(current => event.target.checked ? [...current, platform] : current.filter(item => item !== platform))} className="h-5 w-5 accent-[#c17a49]" />{PLATFORM_GUIDES[platform].label}</label>)}</div></fieldset>
        {generatedLink && <div className="mt-5 rounded-xl border border-brand-teal/25 bg-brand-teal/[0.06] p-4"><p className="text-xs font-bold uppercase tracking-wide text-brand-teal">Copy now. The plaintext token is not stored.</p><p className="mt-2 break-all text-sm text-white">{generatedLink}</p><ActionButton variant="secondary" className="mt-3" onClick={() => void navigator.clipboard.writeText(generatedLink)}>Copy link</ActionButton></div>}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold text-white">Onboarding status</h2>
        {loading ? <p className="mt-4 text-sm text-brand-primary">Loading onboarding status...</p> : sessions.length === 0 ? <EmptyState className="mt-4" title="No onboarding sessions" message="Generate a client-specific link to get started." /> : <div className="mt-4 space-y-4">{sessions.map(session => <article key={session.sessionId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-white">{clientNames.get(session.clientId) ?? session.clientName}</h3><p className="mt-1 text-xs text-brand-primary/70">Started {formatDate(session.startedAt)} · Completed {formatDate(session.completedAt)} · Last activity {formatDate(session.lastActivityAt)}</p></div><span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-brand-primary">{session.status.replace('_', ' ')}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><StatusLine label="Logo" value={session.uploads.some(upload => upload.category === 'logo' && upload.uploadStatus === 'received') ? 'Received' : 'Not received'} /><StatusLine label="Services" value={session.typedDescription || session.serviceItems.length || session.uploads.some(upload => upload.category === 'services' && upload.uploadStatus === 'received') ? 'Received' : 'Not received'} /></div>{session.platformAccess.length > 0 && <div className="mt-4 divide-y divide-white/10 border-t border-white/10">{session.platformAccess.map(access => <div key={access.platform} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span className="font-semibold text-white">{PLATFORM_GUIDES[access.platform].label}</span><div className="flex items-center gap-2"><span className="text-brand-primary/70">{access.clientChoice ?? 'no choice'} · {access.connectionState.replaceAll('_', ' ')}</span>{access.clientChoice === 'connect_now' && !access.verifiedAt && <><button type="button" className="min-h-10 rounded-lg border border-brand-teal/30 px-3 text-xs font-bold text-brand-teal" onClick={() => void updateStaffAccess(session.sessionId, access.platform, 'verified').then(load)}>Verify</button><button type="button" className="min-h-10 rounded-lg border border-red-400/25 px-3 text-xs font-bold text-red-300" onClick={() => void updateStaffAccess(session.sessionId, access.platform, 'failed').then(load)}>Needs follow-up</button></>}</div></div>)}</div>}</article>)}</div>}
      </section>
    </div>
  )
}

function StatusLine({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-xs text-brand-primary/60">{label}</p><p className="mt-1 text-sm font-semibold text-white">{value}</p></div> }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'not yet' }
