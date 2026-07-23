import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PremiumCard } from '../../components/ui/PremiumCard'
import { ActionButton } from '../../components/ui/Buttons'
import { StatusBadge, Pill } from '../../components/ui/Badges'
import { getGoogleAdsWorkspace } from '../../lib/googleAds'
import { useAuth } from '../../contexts/AuthContext'
import { isManagerRole } from '../../lib/roles'

type MetaState = 'loading' | 'connected' | 'disconnected'

export default function IntegrationsPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const canManageGoogleAds = isManagerRole(profile?.role)
  const [metaState, setMetaState] = useState<MetaState>('loading')
  const [linkedClients, setLinkedClients] = useState<number | null>(null)
  const [googleState, setGoogleState] = useState<MetaState>('loading')
  const [googleLinkedClients, setGoogleLinkedClients] = useState<number | null>(null)

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

    if (canManageGoogleAds) {
      getGoogleAdsWorkspace()
        .then(workspace => {
          if (!active) return
          setGoogleState(workspace.accounts.length > 0 ? 'connected' : 'disconnected')
          const linkedClientIds = [
            ...workspace.accountLinks.filter(link => link.active).map(link => link.clientId),
            ...workspace.campaignLinks.filter(link => link.active).map(link => link.clientId),
          ]
          setGoogleLinkedClients(new Set(linkedClientIds).size)
        })
        .catch(() => {
          if (active) setGoogleState('disconnected')
        })
    }

    return () => {
      active = false
    }
  }, [canManageGoogleAds])

  const metaConnected = metaState === 'connected'
  const metaStatus =
    metaState === 'loading' ? 'Checking…' : metaConnected ? 'Connected' : 'Not connected'
  const metaDescription = metaConnected
    ? linkedClients && linkedClients > 0
      ? `Facebook and Instagram are connected. ${linkedClients} client${linkedClients === 1 ? '' : 's'} linked for monthly sync.`
      : 'Facebook and Instagram are connected. Link clients to start syncing monthly reports.'
    : 'Connect Facebook Pages and Instagram accounts to create monthly report drafts automatically.'
  const metaButtonLabel = metaConnected ? 'Manage Meta' : 'Set up Meta'
  const googleConnected = googleState === 'connected'
  const googleStatus = !canManageGoogleAds ? 'Manager access' : googleState === 'loading' ? 'Checking…' : googleConnected ? 'Connected' : 'Not connected'
  const googleDescription = !canManageGoogleAds
    ? 'Google Ads account setup and sync controls are available to managers and admins.'
    : googleConnected
    ? googleLinkedClients && googleLinkedClients > 0
      ? `${googleLinkedClients} client${googleLinkedClients === 1 ? '' : 's'} linked for Google Ads reporting.`
      : 'Google Ads is connected. Link a client account to begin reporting.'
    : 'Connect and map Google Ads accounts for internal campaign reporting.'

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
        <PremiumCard padding="md" className="relative">
          <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-brand-accent to-sky-400" />
          <div className="flex flex-col pt-1">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sm font-bold text-sky-300">
                M
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-white">Meta Business</h2>
                  <StatusBadge
                    label={metaStatus}
                    variant={metaConnected ? 'published' : metaState === 'loading' ? 'default' : 'internal-draft'}
                    size="sm"
                  />
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-brand-primary">{metaDescription}</p>
              </div>
            </div>
            <div className="mt-auto pt-5">
              <ActionButton variant="outline" onClick={() => navigate('/admin/integrations/meta')} fullWidth>
                {metaButtonLabel}
              </ActionButton>
            </div>
          </div>
        </PremiumCard>

        {/* TikTok — planned */}
        <PremiumCard padding="md">
          <div className="flex flex-col">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-sm font-bold text-brand-primary">
                T
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-white">TikTok</h2>
                  <Pill tone="neutral">Planned</Pill>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-brand-primary">
                  TikTok reporting sync will be added later.
                </p>
              </div>
            </div>
            <div className="mt-auto pt-5">
              <button
                type="button"
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-brand-muted bg-brand-muted/20 px-4 py-2.5 text-sm font-semibold text-brand-primary"
              >
                Coming later
              </button>
            </div>
          </div>
        </PremiumCard>

        {/* Google Ads — live manager workspace */}
        <PremiumCard padding="md" className="relative">
          <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-amber-300 via-emerald-400 to-sky-400" />
          <div className="flex flex-col">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-300/15 text-sm font-bold text-amber-200">
                G
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-white">Google Ads</h2>
                  <StatusBadge label={googleStatus} variant={googleConnected ? 'published' : googleState === 'loading' ? 'default' : 'internal-draft'} size="sm" />
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-brand-primary">
                  {googleDescription}
                </p>
              </div>
            </div>
            <div className="mt-auto pt-5">
              <ActionButton variant="outline" disabled={!canManageGoogleAds} onClick={() => navigate('/admin/integrations/google-ads')} fullWidth>
                {!canManageGoogleAds ? 'Manager only' : googleConnected ? 'Manage Google Ads' : 'Set up Google Ads'}
              </ActionButton>
            </div>
          </div>
        </PremiumCard>
      </div>
    </div>
  )
}
