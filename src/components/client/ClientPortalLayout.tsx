import { Suspense, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getClient, type Client } from '../../lib/db/clients'
import { ClientPortalContext } from './ClientPortalContext'
import { ClientPortalShell } from './ClientPortalShell'
import { ClientPortalErrorState, ClientPortalLoadingState } from './ClientPortalStates'

export function ClientPortalLayout() {
  const { profile } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  }, [profile?.client_id])

  const portalContext = useMemo(() => ({ client }), [client])

  useEffect(() => {
    if (loading || error) return
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
  }, [error, loading])

  return (
    <ClientPortalContext.Provider value={portalContext}>
      <ClientPortalShell client={client}>
        {loading ? (
          <ClientPortalContentLoading />
        ) : error ? (
          <ClientPortalContextError />
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

function ClientPortalContextError() {
  return <ClientPortalErrorState title="Your client workspace could not be loaded" />
}
