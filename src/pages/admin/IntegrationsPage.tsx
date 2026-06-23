import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type MetaState = 'loading' | 'connected' | 'disconnected'

interface StaticPlatform {
  id: string
  initial: string
  accent: string
  title: string
  status: string
  statusClass: string
  description: string
  buttonLabel: string
  to: string | null
  disabled: boolean
}

const comingSoon: StaticPlatform[] = [
  {
    id: 'tiktok',
    initial: 'T',
    accent: 'bg-brand-muted text-brand-primary',
    title: 'TikTok',
    status: 'Planned',
    statusClass: 'text-brand-primary',
    description: 'TikTok reporting sync will be added later.',
    buttonLabel: 'Coming later',
    to: null,
    disabled: true,
  },
  {
    id: 'google',
    initial: 'G',
    accent: 'bg-brand-muted text-brand-primary',
    title: 'Google Ads',
    status: 'Planned',
    statusClass: 'text-brand-primary',
    description: 'Google Ads and campaign reporting will be added later.',
    buttonLabel: 'Coming later',
    to: null,
    disabled: true,
  },
]

export default function IntegrationsPage() {
  const navigate = useNavigate()
  const [metaState, setMetaState] = useState<MetaState>('loading')
  const [linkedClients, setLinkedClients] = useState<number | null>(null)

  useEffect(() => {
    let active = true

    // Connection status from the server (reliable source of truth).
    supabase.functions
      .invoke('meta-connection-status', { method: 'POST' })
      .then(({ data }) => {
        if (!active) return
        setMetaState(data?.ok && data?.connected ? 'connected' : 'disconnected')
      })
      .catch(() => {
        if (active) setMetaState('disconnected')
      })

    // Linked client/asset count (best-effort; staff can read via RLS).
    supabase
      .from('meta_client_assets')
      .select('client_id')
      .eq('is_active', true)
      .then(({ data }) => {
        if (!active || !data) return
        setLinkedClients(new Set(data.map(r => r.client_id as string)).size)
      })

    return () => {
      active = false
    }
  }, [])

  const metaConnected = metaState === 'connected'
  const metaStatus =
    metaState === 'loading' ? 'Checking…' : metaConnected ? 'Connected' : 'Not connected'
  const metaStatusClass =
    metaState === 'loading' ? 'text-brand-primary' : metaConnected ? 'text-brand-accent' : 'text-amber-400'
  const metaDescription = metaConnected
    ? linkedClients && linkedClients > 0
      ? `Facebook and Instagram are connected. ${linkedClients} client${linkedClients === 1 ? '' : 's'} linked for monthly sync.`
      : 'Facebook and Instagram are connected. Link clients to start syncing monthly reports.'
    : 'Connect Facebook Pages and Instagram accounts to create monthly report drafts automatically.'
  const metaButtonLabel = metaConnected ? 'Manage Meta' : 'Set up Meta'

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.22em] text-brand-primary">Integrations</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Integrations</h1>
        <p className="mt-1 text-sm text-brand-primary">
          Sync platforms to build monthly reports without manual CSV exports.
        </p>
      </div>

      <div className="mt-6 max-w-3xl rounded-xl border border-brand-muted bg-gradient-to-r from-brand-surface to-brand-bg p-5">
        <p className="text-sm leading-relaxed text-brand-primary">
          <span className="font-medium text-white">Meta is the main workflow.</span> Facebook and
          Instagram sync creates monthly report drafts automatically. CSV import remains available as a
          fallback when a platform can't be synced.
        </p>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Meta — live status */}
        <div className="group relative flex flex-col rounded-xl border border-brand-muted bg-brand-surface">
          <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl bg-gradient-to-r from-brand-accent to-sky-400" />
          <div className="flex flex-1 flex-col p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sm font-bold text-sky-300">
                M
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-white">Meta Business</h2>
                  <span className={`shrink-0 text-xs font-medium ${metaStatusClass}`}>{metaStatus}</span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-brand-primary">{metaDescription}</p>
              </div>
            </div>
            <div className="mt-auto pt-5">
              <button
                type="button"
                onClick={() => navigate('/admin/integrations/meta')}
                className="w-full rounded-lg border border-brand-accent bg-brand-accent/10 px-4 py-2.5 text-sm font-semibold text-brand-accent transition-all hover:bg-brand-accent/20 hover:shadow-[0_0_12px_-4px] hover:shadow-brand-accent/30"
              >
                {metaButtonLabel}
              </button>
            </div>
          </div>
        </div>

        {/* Planned platforms */}
        {comingSoon.map(p => (
          <div
            key={p.id}
            className="group relative flex flex-col rounded-xl border border-brand-muted bg-brand-surface"
          >
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${p.accent}`}>
                  {p.initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-white">{p.title}</h2>
                    <span className={`shrink-0 text-xs font-medium ${p.statusClass}`}>{p.status}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-brand-primary">{p.description}</p>
                </div>
              </div>
              <div className="mt-auto pt-5">
                <button
                  type="button"
                  disabled
                  className="w-full cursor-not-allowed rounded-lg border border-brand-muted bg-brand-muted/20 px-4 py-2.5 text-sm font-semibold text-brand-primary"
                >
                  {p.buttonLabel}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
