import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { loadPortalSetup } from './api'
import { loadClientPortalLibrary } from '../client-portal-library/api'
import { ClientPortalLibrary } from '../client-portal-library/ClientPortalLibrary'
import type { ClientPortalLibraryState } from '../client-portal-library/types'
import { SetupSummary } from './SetupSummary'
import { OnboardingProgress } from './OnboardingProgress'
import { BrandAssetLibrary } from './BrandAssetLibrary'
import { OnboardingTimeline } from './OnboardingTimeline'
import type { ClientOnboardingState } from './types'
import { ClientPortalErrorState, ClientPortalLoadingState } from '../../components/client/ClientPortalStates'

export default function ClientSetupPage() {
  const { profile } = useAuth()
  const [state, setState] = useState<ClientOnboardingState | null>(null)
  const [library, setLibrary] = useState<ClientPortalLibraryState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      if (!profile?.client_id) {
        setLoading(false)
        return
      }
      const [libraryResult, setupResult] = await Promise.all([
        loadClientPortalLibrary(),
        loadPortalSetup(),
      ])
      if (!active) return
      setState(setupResult.data)
      setLibrary(libraryResult.data)
      setError(libraryResult.error)
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [profile?.client_id])

  if (loading) return <ClientPortalLoadingState />
  if (error || !library) {
    return <ClientPortalErrorState title="Brand Hub is not available yet" message="Your CG team will make this space available once your client-safe library is ready." />
  }
  return <ClientBrandHub library={library} state={state} />
}

export function ClientSetupContent({ state, audience = 'staff' }: { state: ClientOnboardingState; audience?: 'client' | 'staff' }) {
  return (
    <div className="space-y-5">
      <OnboardingProgress state={state} />
      <SetupSummary state={state} audience={audience} />
      <BrandAssetLibrary state={state} audience={audience} />
      <OnboardingTimeline state={state} />
    </div>
  )
}

function ClientBrandHub({ library, state }: { library: ClientPortalLibraryState; state: ClientOnboardingState | null }) {
  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[radial-gradient(circle_at_12%_5%,rgba(45,212,191,0.18),transparent_34%),radial-gradient(circle_at_92%_18%,rgba(249,115,22,0.12),transparent_28%),linear-gradient(145deg,rgba(10,27,24,0.96),rgba(5,12,11,0.94))] px-6 py-9 shadow-[0_34px_100px_-55px_rgba(0,0,0,0.95)] sm:px-9 sm:py-11">
        <div className="relative max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-[#2dd4bf]">Your brand library</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl">Brand Hub</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            Approved brand files and final client-ready content, kept together in one clear space.
          </p>
        </div>
      </section>

      <ClientPortalLibrary library={library} />

      {state && <div className="grid gap-5 lg:grid-cols-5">
        <section className="rounded-[2rem] border border-white/[0.08] bg-white/[0.035] p-6 sm:p-8 lg:col-span-3">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2dd4bf]">Brand foundation</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white">What CG has on file</h2>
          <div className="mt-6"><SetupSummary state={state} audience="client" compact /></div>
        </section>
        <section className="rounded-[2rem] border border-[#f97316]/15 bg-[linear-gradient(155deg,rgba(249,115,22,0.10),rgba(255,255,255,0.03))] p-6 sm:p-8 lg:col-span-2">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f59e0b]">Workspace status</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white">Your setup journey</h2>
          <div className="mt-6 space-y-5">
            <OnboardingProgress state={state} />
            <OnboardingTimeline state={state} />
          </div>
        </section>
      </div>}
    </div>
  )
}
