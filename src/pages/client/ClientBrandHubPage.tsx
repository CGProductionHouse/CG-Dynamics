import { ClientPortalShell } from '../../components/client/ClientPortalShell'
import { useAuth } from '../../contexts/AuthContext'
import { getClient } from '../../lib/db/clients'
import { useEffect, useState } from 'react'
import type { Client } from '../../lib/db/clients'

export default function ClientBrandHubPage() {
  const { profile } = useAuth()
  const [client, setClient] = useState<Client | null>(null)

  useEffect(() => {
    if (!profile?.client_id) return
    void getClient(profile.client_id).then(r => setClient(r.data))
  }, [profile?.client_id])

  return (
    <ClientPortalShell client={client}>
      <section className="max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-report-accent">Brand Hub</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">
          Your Brand Assets
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-report-muted">
          Brand files, onboarding progress and setup details for your account.
        </p>
        <div className="mt-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-5 py-6">
          <p className="text-sm leading-6 text-report-muted">
            This page is part of Pass 4 of the client experience redesign. Brand file management, onboarding status and account setup will be refined here.
          </p>
        </div>
      </section>
    </ClientPortalShell>
  )
}
