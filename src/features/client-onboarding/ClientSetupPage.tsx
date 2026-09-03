import { useEffect, useState } from 'react'
import { ClientPortalShell } from '../../components/client/ClientPortalShell'
import { useAuth } from '../../contexts/AuthContext'
import { getClient, type Client } from '../../lib/db/clients'
import { loadPortalSetup } from './api'
import { SetupSummary } from './SetupSummary'
import { OnboardingProgress } from './OnboardingProgress'
import { BrandAssetLibrary } from './BrandAssetLibrary'
import { OnboardingTimeline } from './OnboardingTimeline'
import type { ClientOnboardingState } from './types'

export default function ClientSetupPage() {
  const { profile } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [state, setState] = useState<ClientOnboardingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      if (!profile?.client_id) return
      const [clientResult, setupResult] = await Promise.all([getClient(profile.client_id), loadPortalSetup()])
      if (!active) return
      setClient(clientResult.data)
      setState(setupResult.data)
      setError(clientResult.error?.message ?? setupResult.error)
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [profile?.client_id])

  return (
    <ClientPortalShell client={client}>
      {loading ? <p className="text-sm text-report-muted">Loading setup...</p> : error || !state ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6"><h1 className="text-2xl font-black text-white">Setup is not available yet</h1><p className="mt-3 text-sm text-report-muted">Your CG team will make this available when your welcome link is prepared.</p></div>
      ) : (
        <div className="space-y-5">
          <OnboardingProgress state={state} />
          <SetupSummary state={state} />
          <BrandAssetLibrary state={state} />
          <OnboardingTimeline state={state} />
        </div>
      )}
    </ClientPortalShell>
  )
}
