import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { loadPortalSetup } from './api'
import { SetupSummary } from './SetupSummary'
import { OnboardingProgress } from './OnboardingProgress'
import { BrandAssetLibrary } from './BrandAssetLibrary'
import { OnboardingTimeline } from './OnboardingTimeline'
import type { ClientOnboardingState } from './types'

export default function ClientSetupPage() {
  const { profile } = useAuth()
  const [state, setState] = useState<ClientOnboardingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      if (!profile?.client_id) return
      const setupResult = await loadPortalSetup()
      if (!active) return
      setState(setupResult.data)
      setError(setupResult.error)
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [profile?.client_id])

  return loading ? <p role="status" className="text-sm text-report-muted">Loading your workspace…</p> : error || !state ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6"><h1 className="text-2xl font-black text-white">Setup is not available yet</h1><p className="mt-3 text-sm text-report-muted">Your CG team will make this available when your welcome link is prepared.</p></div>
      ) : (
        <ClientSetupContent state={state} />
      )
}

export function ClientSetupContent({ state, audience = 'client' }: { state: ClientOnboardingState; audience?: 'client' | 'staff' }) {
  return (
    <div className="space-y-5">
      <OnboardingProgress state={state} />
      <SetupSummary state={state} audience={audience} />
      <BrandAssetLibrary state={state} audience={audience} />
      <OnboardingTimeline state={state} />
    </div>
  )
}
