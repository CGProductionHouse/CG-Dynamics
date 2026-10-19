import { Suspense, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getClient, type Client } from '../../lib/db/clients'
import { exactClientForProfile } from '../../lib/clientPortalScope'
import { ClientPortalContext } from './ClientPortalContext'
import { ClientPortalShell } from './ClientPortalShell'
import { ClientPortalErrorState, ClientPortalLoadingState } from './ClientPortalStates'

export function ClientPortalLayout() {
  const { profile } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [readRevision, setReadRevision] = useState(0)

  useEffect(() => {
    let active = true

    async function loadClient() {
      if (!profile?.client_id) {
        setClient(null)
        setLoading(false)
        return
      }

      setClient(null)
      setLoading(true)
      setError(null)
      try {
        const result = await getClient(profile.client_id)
        if (!active) return
        if (result.data && result.data.id !== profile.client_id) throw new Error('Client identity mismatch')
        setClient(result.data)
        setError(result.error?.message ?? null)
      } catch {
        if (active) setError('Your client workspace could not be loaded safely.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadClient()
    return () => { active = false }
  }, [profile?.client_id, readRevision])

  const scopedClient = exactClientForProfile(profile?.client_id, client)
  const scopeChanging = client !== null && scopedClient === null
  const portalContext = useMemo(() => ({ client: scopedClient }), [scopedClient])

  useEffect(() => {
    if (loading || error || !scopedClient) return
    const preload = () => {
      void Promise.allSettled([
        import('../../pages/client/ClientPortalHome'),
        import('../../pages/client/ClientPlanPage'),
        import('../../pages/client/Dashboard'),
        import('../../pages/admin/ContentReviewsPage'),
        import('../../features/client-onboarding/ClientSetupPage'),
      ])
    }
    const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void) => number }
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(preload)
      return () => window.cancelIdleCallback?.(handle)
    }
    const timer = window.setTimeout(preload, 250)
    return () => window.clearTimeout(timer)
  }, [error, loading, scopedClient])

  return (
    <ClientPortalContext.Provider value={portalContext}>
      <ClientPortalShell client={scopedClient}>
        {loading || scopeChanging ? (
          <ClientPortalContentLoading />
        ) : error || !scopedClient ? (
          <ClientPortalErrorState title="Your client workspace could not be loaded"
            onRetry={profile?.client_id ? () => setReadRevision(value => value + 1) : undefined} />
        ) : (
          <Suspense fallback={<ClientPortalContentLoading />}>
            <Outlet />
          </Suspense>
        )}
      </ClientPortalShell>
    </ClientPortalContext.Provider>
  )
}

export function ClientPortalContentLoading() {
  return <ClientPortalLoadingState />
}
