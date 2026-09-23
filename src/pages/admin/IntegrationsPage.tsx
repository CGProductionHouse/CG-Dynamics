import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PremiumCard } from '../../components/ui/PremiumCard'
import { ActionButton } from '../../components/ui/Buttons'
import { StatusBadge, Pill } from '../../components/ui/Badges'
import { getGoogleAdsWorkspace } from '../../lib/googleAds'
import { getTiktokConnectionStatus } from '../../lib/tiktok'
import { useAuth } from '../../contexts/AuthContext'
import { isAdminRole, isManagerRole } from '../../lib/roles'
import { getMicrosoftConnectionStatus } from '../../lib/microsoftImportData'
import { PageContainer, PageHeader } from '../../components/layout/PageShell'
import { metaFleetFreshnessEvidence, microsoftFreshnessEvidence, type FreshnessVerdict, type MetaCheckpointInput, type MetaInventoryInput } from '../../lib/dailyDynamicsFreshness'

type MetaState = 'loading' | 'connected' | 'disconnected'

export default function IntegrationsPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const canManageGoogleAds = isManagerRole(profile?.role)
  const canManageMicrosoft = isAdminRole(profile?.role)
  const [metaState, setMetaState] = useState<MetaState>('loading')
  const [linkedClients, setLinkedClients] = useState<number | null>(null)
  const [googleState, setGoogleState] = useState<MetaState>('loading')
  const [googleLinkedClients, setGoogleLinkedClients] = useState<number | null>(null)
  const [tiktokState, setTiktokState] = useState<MetaState>('loading')
  const [microsoftState, setMicrosoftState] = useState<MetaState>('loading')
  const [microsoftSourceCount, setMicrosoftSourceCount] = useState(0)
  const [microsoftFreshness, setMicrosoftFreshness] = useState<ReturnType<typeof microsoftFreshnessEvidence> | null>(null)
  const [metaCheckpoints, setMetaCheckpoints] = useState<MetaCheckpointInput[] | null>(null)
  const [metaCheckpointEvidenceAvailable, setMetaCheckpointEvidenceAvailable] = useState(false)
  const [metaInventory, setMetaInventory] = useState<MetaInventoryInput[] | null>(null)

  useEffect(() => {
    let active = true

    // Connection status from the server (reliable source of truth).
    supabase.functions
      .invoke('meta-connection-status', { method: 'POST' })
      .then(({ data }) => {
        if (!active) return
        setMetaState(data?.ok && data?.connected ? 'connected' : 'disconnected')
        const checkpoints: MetaCheckpointInput[] = (data?.assetHealth ?? []).flatMap((asset: Record<string, unknown>) => {
          const rows: MetaCheckpointInput[] = []
          for (const platform of ['facebook', 'instagram'] as const) {
            const mapped = Boolean(asset[`${platform}Mapped`])
            if (!mapped) continue
            const run = asset[platform] as Record<string, unknown> | null
            rows.push({
              clientId: String(asset.clientId), assetId: String(asset.assetId), platform, mapped,
              lastAttemptedAt: (run?.created_at as string | null) ?? null,
              lastSuccessfulAt: (run?.last_successful_at as string | null) ?? (run?.status === 'success' ? (run.finished_at as string | null) ?? null : null),
              lastSuccessfulMonth: (run?.period_month as string | null) ?? null,
              highWatermarkAt: (run?.high_watermark_at as string | null) ?? null,
              nextDueAt: (run?.next_due_at as string | null) ?? null,
              status: (run?.status as string | null) ?? null,
              healthState: (run?.health_state as string | null) ?? null,
              errorCode: (run?.last_error_code as string | null) ?? null,
              retrying: Boolean(run?.retrying),
            })
          }
          return rows
        })
        setMetaCheckpoints(checkpoints)
        setMetaCheckpointEvidenceAvailable(Array.isArray(data?.assetHealth))
      })
      .catch(() => {
        if (active) setMetaState('disconnected')
      })

    // Linked client/asset count (best-effort; staff can read via RLS).
    supabase
      .from('meta_client_assets')
      .select('id, client_id, facebook_page_id, instagram_account_id')
      .eq('is_active', true)
      .then(({ data }) => {
        if (!active || !data) return
        setLinkedClients(new Set(data.map(r => r.client_id as string)).size)
        setMetaInventory(data.map(row => ({
          clientId: String(row.client_id),
          assetId: String(row.id),
          facebookMapped: Boolean(row.facebook_page_id),
          instagramMapped: Boolean(row.instagram_account_id),
        })))
      })

    // TikTok connection status
    getTiktokConnectionStatus()
      .then(data => {
        if (!active) return
        setTiktokState(data?.connected ? 'connected' : 'disconnected')
      })
      .catch(() => {
        if (active) setTiktokState('disconnected')
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
    if (canManageMicrosoft) {
      getMicrosoftConnectionStatus()
        .then(result => {
          if (!active) return
          setMicrosoftState(result.data?.connected ? 'connected' : 'disconnected')
          setMicrosoftSourceCount(result.data?.sources.length ?? 0)
          const freshness = result.data?.freshness
          setMicrosoftFreshness(result.data && freshness ? microsoftFreshnessEvidence({
            now: new Date().toISOString(), connected: result.data.connected,
            lastJobStartedAt: freshness.lastJobStartedAt,
            lastJobCompletedAt: freshness.lastJobCompletedAt,
            lastSuccessfulReconciliationAt: freshness.lastSuccessfulReconciliationAt,
            requiredSources: freshness.sourceCoverage,
            applyStatus: freshness.latestApplyStatus,
            recoveryInProgress: freshness.recoveryInProgress,
            blocker: freshness.latestApplyError,
            staleAfterMinutes: freshness.staleAfterMinutes,
          }) : null)
        })
        .catch(() => {
          if (active) setMicrosoftState('disconnected')
        })
    }

    return () => {
      active = false
    }
  }, [canManageGoogleAds, canManageMicrosoft])

  const metaFreshness = useMemo(() => metaState === 'connected' && metaCheckpoints && metaInventory
    ? metaFleetFreshnessEvidence(metaCheckpoints, new Date().toISOString(), metaInventory, metaCheckpointEvidenceAvailable)
    : null, [metaCheckpointEvidenceAvailable, metaCheckpoints, metaInventory, metaState])

  const metaConnected = metaState === 'connected'
  const metaStatus =
    metaState === 'loading' ? 'Checking...' : metaConnected ? 'Connected' : 'Not connected'
  const metaDescription = metaConnected
    ? linkedClients && linkedClients > 0
      ? `Facebook and Instagram are connected. ${linkedClients} client${linkedClients === 1 ? '' : 's'} linked for monthly sync.`
      : 'Facebook and Instagram are connected. Link clients to start syncing monthly reports.'
    : 'Connect Facebook Pages and Instagram accounts to create monthly report drafts automatically.'
  const metaButtonLabel = metaConnected ? 'Manage Meta' : 'Set up Meta'
  const tiktokConnected = tiktokState === 'connected'
  const tiktokStatus = tiktokState === 'loading' ? 'Checking...' : tiktokConnected ? 'Connected' : 'Not connected'
  const tiktokDescription = tiktokConnected
    ? 'TikTok is connected. Sync organic analytics or publish content.'
    : 'Connect TikTok for organic analytics sync and content publishing.'
  const tiktokButtonLabel = tiktokConnected ? 'Manage TikTok' : 'Set up TikTok'
  const googleConnected = googleState === 'connected'
  const googleStatus = !canManageGoogleAds ? 'Manager access' : googleState === 'loading' ? 'Checking…' : googleConnected ? 'Connected' : 'Not connected'
  const googleDescription = !canManageGoogleAds
    ? 'Google Ads account setup and sync controls are available to managers and admins.'
    : googleConnected
    ? googleLinkedClients && googleLinkedClients > 0
      ? `${googleLinkedClients} client${googleLinkedClients === 1 ? '' : 's'} linked for Google Ads data sync.`
      : 'Google Ads is connected. Link a client account to begin monthly sync.'
    : 'Connect and map Google Ads accounts for monthly data sync.'
  const freshnessTone = (verdict: FreshnessVerdict | undefined) => verdict === 'PASS' ? 'published' : verdict ? 'internal-draft' : 'default'

  return (
    <PageContainer width="wide" className="pb-16">
      <PageHeader
        eyebrow="Integrations"
        title="Integrations"
        description="Provider sync and connection setup in one place — Meta, Google Ads, Microsoft and imports."
      />

      <div className="max-w-3xl rounded-xl border border-brand-muted bg-gradient-to-r from-brand-surface to-brand-bg p-4 sm:p-5">
        <p className="text-sm leading-relaxed text-brand-primary">
          <span className="font-medium text-white">Meta is the main workflow.</span> Facebook and
          Instagram sync creates monthly report drafts automatically. CSV import remains available as a
          fallback when a platform can't be synced.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-5">
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
                {metaFreshness && <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/65">
                  <div className="flex items-center justify-between gap-2"><span>Fleet freshness</span><StatusBadge label={metaFreshness.verdict} variant={freshnessTone(metaFreshness.verdict)} size="sm" /></div>
                  <p className="mt-2">{metaFreshness.mappedClients} clients · {metaFreshness.mappedAssets} assets · {metaFreshness.platforms.length} mapped platforms</p>
                  {metaFreshness.verdict === 'UNAVAILABLE' && <p className="mt-1 text-amber-200">Checkpoint freshness is unavailable and has not been verified.</p>}
                  {(metaFreshness.stale > 0 || metaFreshness.partial > 0 || metaFreshness.failed > 0 || metaFreshness.unavailable > 0) && <p className="mt-1 text-amber-200">{metaFreshness.failed} failed · {metaFreshness.stale} stale · {metaFreshness.partial} partial · {metaFreshness.unavailable} unavailable</p>}
                  {metaFreshness.recoveryInProgress && <p className="mt-1 text-sky-200">Recovery in progress</p>}
                </div>}
              </div>
            </div>
            <div className="mt-auto pt-5">
              <ActionButton variant="outline" onClick={() => navigate('/admin/integrations/meta')} fullWidth>
                {metaButtonLabel}
              </ActionButton>
            </div>
          </div>
        </PremiumCard>

        {/* TikTok — live status */}
        <PremiumCard padding="md" className="relative">
          <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-pink-500 to-red-500" />
          <div className="flex flex-col">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pink-500/20 text-sm font-bold text-pink-300">
                T
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-white">TikTok</h2>
                  <StatusBadge
                    label={tiktokStatus}
                    variant={tiktokConnected ? 'published' : tiktokState === 'loading' ? 'default' : 'internal-draft'}
                    size="sm"
                  />
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-brand-primary">{tiktokDescription}</p>
              </div>
            </div>
            <div className="mt-auto pt-5">
              <ActionButton variant="outline" onClick={() => navigate('/admin/integrations/tiktok')} fullWidth>
                {tiktokButtonLabel}
              </ActionButton>
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
        {canManageMicrosoft && (
          <PremiumCard padding="md" className="relative">
            <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-sky-400 to-brand-teal" />
            <div className="flex flex-col">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-400/15 text-sm font-bold text-sky-200">MS</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-white">Microsoft 365</h2>
                    <StatusBadge label={microsoftState === 'loading' ? 'Checking...' : microsoftState === 'connected' ? 'Connected' : 'Not connected'} variant={microsoftState === 'connected' ? 'published' : microsoftState === 'loading' ? 'default' : 'internal-draft'} size="sm" />
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-brand-primary">
                    {microsoftState === 'connected' ? `${microsoftSourceCount} Planner and Outlook source${microsoftSourceCount === 1 ? '' : 's'} available for controlled reconciliation.` : 'Connect Planner and Outlook for reviewed operations imports.'}
                  </p>
                  {microsoftFreshness && <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/65">
                    <div className="flex items-center justify-between gap-2"><span>Reconciliation freshness</span><StatusBadge label={microsoftFreshness.verdict} variant={freshnessTone(microsoftFreshness.verdict)} size="sm" /></div>
                    <p className="mt-2">Last full success: {microsoftFreshness.lastSuccessfulAt ? new Date(microsoftFreshness.lastSuccessfulAt).toLocaleString() : 'Never'}</p>
                    {microsoftFreshness.recoveryInProgress && <p className="mt-1 text-sky-200">Recovery in progress</p>}
                    {microsoftFreshness.incomplete.length > 0 && <p className="mt-1 text-amber-200">Incomplete: {microsoftFreshness.incomplete.join(', ')}</p>}
                    {microsoftFreshness.blocker && <p className="mt-1 text-amber-200">{microsoftFreshness.blocker}</p>}
                  </div>}
                </div>
              </div>
              <div className="mt-auto pt-5">
                <ActionButton variant="outline" onClick={() => navigate('/admin/microsoft-import')} fullWidth>Manage Microsoft Sync</ActionButton>
              </div>
            </div>
          </PremiumCard>
        )}
        {canManageGoogleAds && (
          <PremiumCard padding="md">
            <div className="flex flex-col">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-teal/15 text-sm font-bold text-brand-teal">PI</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-white">Planner Import</h2>
                    <Pill tone="neutral">Import</Pill>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-brand-primary">
                    Import a morning task list or Planner export into the operations board.
                  </p>
                </div>
              </div>
              <div className="mt-auto pt-5">
                <ActionButton variant="outline" onClick={() => navigate('/admin/planner-import')} fullWidth>Open Planner Import</ActionButton>
              </div>
            </div>
          </PremiumCard>
        )}
      </div>
    </PageContainer>
  )
}
