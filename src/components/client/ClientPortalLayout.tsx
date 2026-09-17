import { Suspense, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getClient, type Client } from '../../lib/db/clients'
import { ClientPortalContext } from './ClientPortalContext'
import { ClientPortalShell } from './ClientPortalShell'

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
  return (
    <div role="status" aria-live="polite" aria-label="Loading your workspace" className="animate-pulse space-y-5 motion-reduce:animate-none">
      <span className="sr-only">Loading your workspace…</span>
      <div className="h-48 rounded-[2rem] border border-white/[0.08] bg-white/[0.035] sm:h-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-32 rounded-3xl border border-white/[0.08] bg-white/[0.025]" />
        <div className="h-32 rounded-3xl border border-white/[0.08] bg-white/[0.025]" />
        <div className="h-32 rounded-3xl border border-white/[0.08] bg-white/[0.025] sm:col-span-2 lg:col-span-1" />
      </div>
    </div>
  )
}

function ClientPortalContextError() {
  return (
    <div role="alert" className="rounded-3xl border border-[#f97316]/20 bg-[#f97316]/[0.06] px-6 py-8 text-sm text-[#f6a15f] shadow-2xl">
      Your client workspace could not be loaded safely. Please try again shortly.
    </div>
  )
}
