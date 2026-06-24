import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { listClients, type Client } from '../../lib/db/clients'

const STEP_LABELS = ['Connect Meta', 'Link assets', 'Sync data', 'Review draft']
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

type ConnectState = 'idle' | 'loading' | 'connected' | 'error'

interface FbPage {
  id: string
  name: string
  category: string | null
  instagramAccount: {
    id: string
    username: string | null
    name: string | null
    profilePictureUrl: string | null
  } | null
}

interface IgAccount {
  id: string
  username: string | null
  name: string | null
  profilePictureUrl: string | null
  facebookPageId: string
  facebookPageName: string
}

interface AdAccount {
  id: string
  name: string
  accountStatus: number | null
}

interface LinkedAsset {
  id: string
  client_id: string
  facebook_page_id: string | null
  facebook_page_name: string | null
  instagram_account_id: string | null
  instagram_username: string | null
  ad_account_id: string | null
  ad_account_name: string | null
  is_active: boolean
}

/* ---------- SearchablePicker ---------- */
interface SearchablePickerProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder: string
  emptyLabel?: string
  disabled?: boolean
}

function SearchablePicker({ value, onChange, options, placeholder, emptyLabel, disabled }: SearchablePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  const selectedLabel = options.find(o => o.value === value)?.label ?? ''

  const filtered = useMemo(() => {
    if (!query) return options
    const q = query.toLowerCase()
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={open ? query : selectedLabel}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setOpen(true); setQuery('') }}
        onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white placeholder:text-brand-primary/40 focus:outline-none focus:ring-1 focus:ring-brand-accent disabled:cursor-not-allowed disabled:opacity-60"
      />
      {value && (
        <button
          type="button"
          onClick={() => { onChange(''); setQuery('') }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-primary/50 hover:text-white"
        >
          ✕
        </button>
      )}
      {open && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-lg border border-brand-muted bg-brand-bg py-1 shadow-xl">
          {filtered.length === 0
            ? <li className="px-3 py-2 text-sm text-brand-primary/60">{emptyLabel || 'No options'}</li>
            : filtered.map(o => (
                <li
                  key={o.value}
                  onClick={() => { onChange(o.value); setOpen(false); setQuery('') }}
                  className={`cursor-pointer px-3 py-2 text-sm transition-colors hover:bg-brand-accent/15 ${
                    o.value === value ? 'text-brand-accent' : 'text-white'
                  }`}
                >
                  {o.label}
                </li>
              ))}
        </ul>
      )}
    </div>
  )
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function redactForDisplay(text: string): string {
  return text
    .replace(/access_token=[^&\s"']+/gi, 'access_token=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9._~+/=-]{20,}/g, '[redacted]')
}

export default function MetaIntegrationPage() {
  const [searchParams] = useSearchParams()
  const [connectState, setConnectState] = useState<ConnectState>('idle')
  const [connectMsg, setConnectMsg] = useState<string | null>(null)
  const [connectionLoading, setConnectionLoading] = useState(true)

  // Assets
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [assetsLoaded, setAssetsLoaded] = useState(false)
  const [pages, setPages] = useState<FbPage[]>([])
  const [igAccounts, setIgAccounts] = useState<IgAccount[]>([])
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [adAccountsError, setAdAccountsError] = useState<string | null>(null)
  const [assetError, setAssetError] = useState<string | null>(null)

  // Linking form
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedPageId, setSelectedPageId] = useState('')
  const [selectedIgId, setSelectedIgId] = useState('')
  const [selectedAdId, setSelectedAdId] = useState('')
  const [saving, setSaving] = useState(false)
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Linked assets list
  const [linkedAssets, setLinkedAssets] = useState<LinkedAsset[]>([])
  const [loadingLinked, setLoadingLinked] = useState(false)

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{
    status: string
    message: string
    phase?: string
    syncEngineVersion?: string
    clientsAttempted?: number
    clientsSucceeded?: number
    clientsSynced?: number
    clientsFailed?: number
    reportsCreated?: number
    reportsReused?: number
    reportsUpdated?: number
    postsSynced?: number
    warnings?: string[]
    failedClients?: { name: string; error: string }[]
    succeededClients?: { name: string; postsSynced: number }[]
    steps?: string[]
    debug?: string
    reportId?: string
  } | null>(null)

  // Load connection status from the server on mount (reliable source of truth).
  const checkConnection = useCallback(async () => {
    setConnectionLoading(true)
    try {
      const { data } = await supabase.functions.invoke('meta-connection-status', {
        method: 'POST',
      })
      if (data?.ok && data?.connected) {
        setConnectState('connected')
        setConnectMsg(null)
      } else {
        setConnectState('idle')
      }
    } catch {
      setConnectState('idle')
    } finally {
      setConnectionLoading(false)
    }
  }, [])

  // On mount: load connection status, clients, and linked assets.
  useEffect(() => {
    checkConnection()
    listClients('active').then(res => {
      if (res.data) setClients(res.data)
    })
    loadLinkedAssets()
  }, [checkConnection])

  // OAuth result from URL query params – shows a success/error banner
  // but does not override the server-driven connection state.
  useEffect(() => {
    const meta = searchParams.get('meta')
    if (meta === 'connected') {
      setConnectMsg('Meta connected. Next step: link assets to clients.')
      // Re-check server state to pick up the newly saved connection.
      checkConnection()
      window.history.replaceState(null, '', window.location.pathname)
    } else if (meta === 'error') {
      setConnectMsg('Meta connection failed. Please try again.')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [searchParams, checkConnection])

  const loadLinkedAssets = useCallback(async () => {
    setLoadingLinked(true)
    const { data } = await supabase
      .from('meta_client_assets')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (data) setLinkedAssets(data as LinkedAsset[])
    setLoadingLinked(false)
  }, [])

  async function handleConnect() {
    setConnectState('idle')
    setConnectMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('meta-oauth-start', {
        method: 'POST',
      })
      if (error) {
        setConnectState('error')
        setConnectMsg('Could not reach the connection service. Check Supabase Edge Function deployment.')
        return
      }
      if (!data?.ok || !data?.url) {
        setConnectState('error')
        setConnectMsg(data?.error || 'Failed to start Meta connection.')
        return
      }
      window.location.href = data.url
    } catch {
      setConnectState('error')
      setConnectMsg('Could not reach the connection service.')
    }
  }

  async function loadAssets() {
    setLoadingAssets(true)
    setAssetError(null)
    setAssetsLoaded(false)
    try {
      const { data, error } = await supabase.functions.invoke('meta-list-assets', {
        method: 'POST',
      })
      if (error) {
        setAssetError('Could not load Meta assets. Check Supabase Edge Function deployment.')
        return
      }
      if (!data?.ok) {
        setAssetError(data?.message || data?.error || 'Failed to load Meta assets.')
        return
      }
      setPages(data.pages ?? [])
      setIgAccounts(data.instagramAccounts ?? [])
      setAdAccounts(data.adAccounts ?? [])
      setAdAccountsError(data.adAccountsError ?? null)
      setAssetsLoaded(true)
    } catch {
      setAssetError('Could not load Meta assets.')
    } finally {
      setLoadingAssets(false)
    }
  }

  // Sorted and derived options.
  const sortedClientOptions = useMemo(
    () => clients.map(c => ({ value: c.id, label: c.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [clients],
  )
  const sortedPageOptions = useMemo(
    () => pages.map(p => ({ value: p.id, label: p.category ? `${p.name} (${p.category})` : p.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [pages],
  )
  const filteredIgAccounts = selectedPageId
    ? igAccounts.filter(a => a.facebookPageId === selectedPageId)
    : igAccounts
  const sortedIgOptions = useMemo(
    () =>
      filteredIgAccounts
        .map(a => ({ value: a.id, label: a.name || a.username || a.id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [filteredIgAccounts],
  )
  const sortedAdOptions = useMemo(
    () => adAccounts.map(a => ({ value: a.id, label: a.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [adAccounts],
  )

  // Auto-select Instagram when a Facebook Page is chosen and only one IG option.
  useEffect(() => {
    if (sortedIgOptions.length === 1 && (selectedIgId === '' || !selectedPageId)) {
      setSelectedIgId(sortedIgOptions[0].value)
    }
  }, [sortedIgOptions, selectedIgId, selectedPageId])

  // Map selected IDs to display names for saving.
  const selectedPage = pages.find(p => p.id === selectedPageId)
  const selectedIg = igAccounts.find(a => a.id === selectedIgId)
  const selectedAd = adAccounts.find(a => a.id === selectedAdId)

  async function handleSaveLink() {
    if (!selectedClientId) return
    setSaving(true)
    setLinkMsg(null)

    const clientName = clients.find(c => c.id === selectedClientId)?.name ?? 'Client'

    // Check for existing active mapping for this client.
    const { data: existing } = await supabase
      .from('meta_client_assets')
      .select('id')
      .eq('client_id', selectedClientId)
      .eq('is_active', true)
      .limit(1)

    const payload = {
      client_id: selectedClientId,
      facebook_page_id: selectedPageId || null,
      facebook_page_name: selectedPage?.name ?? null,
      instagram_account_id: selectedIgId || null,
      instagram_username: selectedIg?.username ?? null,
      ad_account_id: selectedAdId || null,
      ad_account_name: selectedAd?.name ?? null,
      is_active: true,
    }

    let result: { error?: unknown }
    if (existing && existing.length > 0) {
      result = await supabase
        .from('meta_client_assets')
        .update(payload)
        .eq('id', existing[0].id)
    } else {
      result = await supabase
        .from('meta_client_assets')
        .insert(payload)
    }

    setSaving(false)
    if (result.error) {
      setLinkMsg({ ok: false, text: 'Failed to save link. Please try again.' })
    } else {
      setLinkMsg({ ok: true, text: `${clientName} linked successfully. You can now link another client.` })
      // Clear form for next link.
      setSelectedClientId('')
      setSelectedPageId('')
      setSelectedIgId('')
      setSelectedAdId('')
      await loadLinkedAssets()
    }
  }

  async function handleDeactivate(asset: LinkedAsset) {
    await supabase
      .from('meta_client_assets')
      .update({ is_active: false })
      .eq('id', asset.id)
    await loadLinkedAssets()
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
        throw new Error('Missing Supabase frontend environment variables.')
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session?.access_token) {
        setSyncResult({
          status: 'failed',
          message: 'Authentication required. Please sign in again before syncing.',
          phase: 'auth',
          debug: safeStringify({ error: sessionError?.message ?? 'No active session' }),
        })
        return
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/meta-sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          apikey: SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: 'previous_completed_month' }),
      })

      const responseText = await response.text()
      let data: Record<string, any> | null = null
      try {
        data = responseText ? JSON.parse(responseText) : null
      } catch {
        data = null
      }

      if (!response.ok || !data?.ok) {
        const safeText = data
          ? null
          : redactForDisplay(responseText || 'No response body from sync service.').slice(0, 500)
        const phase = typeof data?.phase === 'string' ? data.phase : undefined
        const message = [
          phase ? `Phase: ${phase}.` : null,
          data?.error || data?.message || safeText || 'Sync failed.',
          !response.ok ? `(HTTP ${response.status})` : null,
        ].filter(Boolean).join(' ')
        setSyncResult({
          status: 'failed',
          message,
          phase,
          syncEngineVersion: typeof data?.syncEngineVersion === 'string' ? data.syncEngineVersion : undefined,
          clientsAttempted: data?.clientsAttempted,
          clientsSucceeded: data?.clientsSucceeded ?? data?.clientsSynced,
          clientsSynced: data?.clientsSynced,
          clientsFailed: data?.clientsFailed,
          reportsCreated: data?.reportsCreated,
          reportsReused: data?.reportsReused,
          reportsUpdated: data?.reportsUpdated,
          postsSynced: data?.postsSynced,
          warnings: data?.warnings,
          failedClients: data?.failedClients,
          succeededClients: data?.succeededClients,
          steps: data?.steps,
          debug: safeStringify({
            httpStatus: response.status,
            phase,
            syncEngineVersion: data?.syncEngineVersion,
            body: data ?? safeText,
          }),
        })
        return
      }

      await loadLinkedAssets()
      setSyncResult({
        status: data.status,
        message: data.message,
        phase: typeof data.phase === 'string' ? data.phase : undefined,
        syncEngineVersion: typeof data.syncEngineVersion === 'string' ? data.syncEngineVersion : undefined,
        clientsAttempted: data.clientsAttempted,
        clientsSucceeded: data.clientsSucceeded ?? data.clientsSynced,
        clientsSynced: data.clientsSynced,
        clientsFailed: data.clientsFailed,
        reportsCreated: data.reportsCreated,
        reportsReused: data.reportsReused,
        reportsUpdated: data.reportsUpdated,
        postsSynced: data.postsSynced,
        warnings: data.warnings,
        failedClients: data.failedClients,
        succeededClients: data.succeededClients,
        steps: data.steps,
        debug: safeStringify({
          status: data.status,
          syncEngineVersion: data.syncEngineVersion,
          steps: data.steps,
          warnings: data.warnings,
          failedClients: data.failedClients,
        }),
      })
    } catch (e) {
      setSyncResult({
        status: 'failed',
        message: redactForDisplay(e instanceof Error ? e.message : String(e)),
        phase: 'unknown',
        debug: safeStringify({ error: redactForDisplay(e instanceof Error ? e.message : String(e)) }),
      })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.22em] text-brand-primary">Integrations</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Meta Business Sync</h1>
        <p className="mt-1 text-sm text-brand-primary">
          Connect Facebook and Instagram assets so reports can be built without CSV exports.
        </p>
      </div>

      {/* Connection status banner */}
      {connectMsg && (
        <div className={`mt-6 max-w-2xl rounded-xl border p-5 ${connectState === 'connected' ? 'border-brand-accent/20 bg-brand-accent/10' : 'border-red-400/20 bg-red-400/10'}`}>
          <p className={`text-sm font-medium ${connectState === 'connected' ? 'text-brand-accent' : 'text-red-400'}`}>
            {connectMsg}
          </p>
        </div>
      )}

      {/* Step indicator */}
      <div className="mt-6 inline-flex items-center overflow-hidden rounded-xl border border-brand-muted bg-brand-surface">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className={`flex items-center gap-2 px-4 py-3 ${i < STEP_LABELS.length - 1 ? 'border-r border-brand-muted' : ''}`}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">{i + 1}</span>
            <span className="whitespace-nowrap text-sm text-white">{label}</span>
          </div>
        ))}
      </div>

      {/* Step cards */}
      <div className="mt-6 space-y-4 max-w-2xl">
        {/* Step 1 — Connect Meta */}
        <div className="rounded-xl border border-brand-muted bg-brand-surface">
          <div className="p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">1</span>
                <h2 className="text-sm font-semibold text-white">Connect Meta</h2>
              </div>
              <span className={`shrink-0 text-xs font-medium ${connectionLoading ? 'text-brand-primary/60' : connectState === 'connected' ? 'text-brand-accent' : 'text-amber-400'}`}>
                {connectionLoading ? 'Checking…' : connectState === 'connected' ? 'Connected' : 'Not connected'}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-brand-primary">
              Authorise CG Dynamics to access your Facebook Business assets.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleConnect}
                className={`rounded-lg border px-5 py-2.5 text-sm font-semibold transition-all ${
                  connectState === 'connected'
                    ? 'border-brand-accent/50 bg-brand-accent/10 text-brand-accent'
                    : 'border-brand-accent bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20'
                }`}
              >
                {connectState === 'connected' ? 'Reconnect Meta' : 'Connect Meta'}
              </button>
            </div>
          </div>
        </div>

        {/* Step 2 — Link assets to clients */}
        <div className="rounded-xl border border-brand-muted bg-brand-surface">
          <div className="p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">2</span>
                <h2 className="text-sm font-semibold text-white">Link assets to clients</h2>
              </div>
              <span className="shrink-0 text-xs font-medium text-brand-primary">
                {connectionLoading ? 'Checking connection…' : connectState === 'connected' ? (assetsLoaded ? 'Assets loaded' : 'Ready') : 'Waiting for Meta connection'}
              </span>
            </div>

            {connectState === 'connected' && !assetsLoaded && (
              <>
                <p className="mt-3 text-sm leading-relaxed text-brand-primary">
                  Load your Meta assets, then choose which Facebook Page, Instagram account and ad account belong to each CG client.
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={loadAssets}
                    disabled={loadingAssets}
                    className="rounded-lg border border-brand-accent bg-brand-accent/10 px-5 py-2.5 text-sm font-semibold text-brand-accent hover:bg-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingAssets ? 'Loading…' : 'Load Meta assets'}
                  </button>
                </div>
              </>
            )}

            {assetError && (
              <p className="mt-3 text-sm text-red-400">{assetError}</p>
            )}

            {linkMsg && (
              <div className={`mt-4 rounded-xl border p-4 ${linkMsg.ok ? 'border-brand-accent/20 bg-brand-accent/10' : 'border-red-400/20 bg-red-400/10'}`}>
                <p className={`text-sm font-medium ${linkMsg.ok ? 'text-brand-accent' : 'text-red-400'}`}>
                  {linkMsg.text}
                </p>
              </div>
            )}

            {assetsLoaded && (
              <div className="mt-4 space-y-4">
                {/* Client picker */}
                <div className="grid gap-1 md:grid-cols-[150px_minmax(0,1fr)] md:items-center md:gap-4">
                  <span className="text-sm text-brand-primary">CG Client</span>
                  <SearchablePicker
                    value={selectedClientId}
                    onChange={setSelectedClientId}
                    options={sortedClientOptions}
                    placeholder="Select a client…"
                  />
                </div>

                {/* Facebook Page picker */}
                <div className="grid gap-1 md:grid-cols-[150px_minmax(0,1fr)] md:items-center md:gap-4">
                  <span className="text-sm text-brand-primary">Facebook Page</span>
                  <SearchablePicker
                    value={selectedPageId}
                    onChange={v => { setSelectedPageId(v); setSelectedIgId('') }}
                    options={sortedPageOptions}
                    placeholder="Select a page…"
                    emptyLabel="No pages found"
                  />
                </div>

                {/* Instagram Account picker */}
                <div className="grid gap-1 md:grid-cols-[150px_minmax(0,1fr)] md:items-center md:gap-4">
                  <span className="text-sm text-brand-primary">Instagram Account</span>
                  <SearchablePicker
                    value={selectedIgId}
                    onChange={setSelectedIgId}
                    options={sortedIgOptions}
                    placeholder={igAccounts.length === 0 ? 'No Instagram accounts found' : 'Select an account…'}
                    emptyLabel={selectedPageId ? 'No Instagram linked to this page' : 'Select a Facebook Page first'}
                  />
                </div>

                {/* Ad Account picker */}
                <div className="grid gap-1 md:grid-cols-[150px_minmax(0,1fr)] md:items-center md:gap-4">
                  <span className="text-sm text-brand-primary">Ad Account</span>
                  {adAccounts.length > 0 ? (
                    <SearchablePicker
                      value={selectedAdId}
                      onChange={setSelectedAdId}
                      options={sortedAdOptions}
                      placeholder="Select an ad account (optional)…"
                    />
                  ) : (
                    <p className="text-sm text-brand-primary/60">
                      {adAccountsError || 'No ad accounts available.'}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveLink}
                    disabled={saving || !selectedClientId}
                    className="rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-brand-bg hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Save link'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 3 — Sync report data */}
        <div className="rounded-xl border border-brand-muted bg-brand-surface">
          <div className="p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">3</span>
                <h2 className="text-sm font-semibold text-white">Sync report data</h2>
              </div>
              <span className="shrink-0 text-xs font-medium text-brand-primary">
                {linkedAssets.length > 0 ? 'Ready' : 'Waiting for linked assets'}
              </span>
            </div>

            {!syncResult && (
              <p className="mt-3 text-sm leading-relaxed text-brand-primary">
                Sync the previous completed month from linked Meta assets. Reports will be saved as internal drafts.
              </p>
            )}

            {syncResult && (
              <div className={`mt-3 rounded-xl border p-4 ${syncResult.status === 'failed' ? 'border-red-400/20 bg-red-400/10' : 'border-brand-accent/20 bg-brand-accent/10'}`}>
                <p className={`text-sm font-medium ${syncResult.status === 'failed' ? 'text-red-400' : 'text-brand-accent'}`}>
                  {syncResult.message}
                </p>
                {syncResult.status !== 'skipped' && (
                  <ul className="mt-2 space-y-1 text-sm text-brand-primary">
                    {syncResult.phase && <li>Failed phase: {syncResult.phase}</li>}
                    {syncResult.syncEngineVersion && <li>Sync engine: {syncResult.syncEngineVersion}</li>}
                    <li>Clients succeeded: {syncResult.clientsSucceeded ?? syncResult.clientsSynced ?? 0}{syncResult.clientsAttempted !== undefined ? ` of ${syncResult.clientsAttempted}` : ''}</li>
                    {syncResult.clientsFailed !== undefined && syncResult.clientsFailed > 0 && (
                      <li className="text-amber-400">Clients failed: {syncResult.clientsFailed}</li>
                    )}
                    <li>Reports created: {syncResult.reportsCreated ?? 0}</li>
                    <li>Reports reused: {syncResult.reportsReused ?? syncResult.reportsUpdated ?? 0}</li>
                    <li>Posts synced: {syncResult.postsSynced ?? 0}</li>
                    {syncResult.warnings && syncResult.warnings.length > 0 && (
                      <li className="text-amber-400">Warnings: {syncResult.warnings.length}</li>
                    )}
                  </ul>
                )}
                {syncResult.failedClients && syncResult.failedClients.length > 0 && (
                  <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-300">Failed clients</p>
                    <ul className="mt-2 space-y-1.5 text-xs text-brand-primary">
                      {syncResult.failedClients.map(fc => (
                        <li key={fc.name}>
                          <span className="font-medium text-white">{fc.name}:</span> <span className="text-red-300">{fc.error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Staff-only diagnostics (this page is admin/team only by route). */}
                {(syncResult.debug || (syncResult.steps && syncResult.steps.length > 0)) && (
                  <details className="mt-3 rounded-lg border border-brand-muted bg-brand-bg/50 p-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-brand-primary">
                      Diagnostics (staff only)
                    </summary>
                    {syncResult.steps && syncResult.steps.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-brand-primary/70">Steps</p>
                        <ol className="mt-1 space-y-0.5 text-xs text-brand-primary">
                          {syncResult.steps.map((s, i) => (
                            <li key={i}>{i + 1}. {s}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {syncResult.debug && (
                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-2 text-[11px] leading-relaxed text-brand-primary">
                        {syncResult.debug}
                      </pre>
                    )}
                  </details>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {syncResult.status !== 'failed' && (
                    <a
                      href="/admin/reports"
                      className="rounded-lg bg-brand-accent px-4 py-2 text-xs font-semibold text-brand-bg hover:brightness-110"
                    >
                      Go to reports
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setSyncResult(null)}
                    className="rounded-lg border border-brand-muted px-4 py-2 text-xs text-brand-primary hover:text-white"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {!syncResult && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncing || linkedAssets.length === 0}
                  className="rounded-lg border border-brand-accent bg-brand-accent/10 px-5 py-2.5 text-sm font-semibold text-brand-accent hover:bg-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {syncing ? 'Syncing…' : 'Sync previous completed month'}
                </button>
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-lg border border-brand-muted bg-brand-muted/20 px-5 py-2.5 text-sm font-semibold text-brand-primary"
                >
                  Sync current month as internal draft
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Step 4 — Review draft */}
        <div className="rounded-xl border border-brand-muted bg-brand-surface">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">4</span>
              <h2 className="text-sm font-semibold text-white">Review monthly draft</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-brand-primary">
              After sync, CG Dynamics will create or update a monthly report draft. Staff can add strategy, preview as client, and publish.
            </p>
          </div>
        </div>
      </div>

      {/* Linked clients section — always visible, independent of connection status */}
      <div className="mt-8 max-w-2xl">
        <h3 className="text-sm font-semibold text-white">Linked clients</h3>
          {loadingLinked ? (
            <p className="mt-2 text-sm text-brand-primary">Loading linked clients…</p>
          ) : linkedAssets.length === 0 ? (
            <p className="mt-2 text-sm text-brand-primary">No clients linked yet. Load Meta assets above and save a link.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {linkedAssets.map(asset => {
                const client = clients.find(c => c.id === asset.client_id)
                return (
                  <div key={asset.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-muted bg-brand-surface p-4">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-white">{client?.name ?? asset.client_id}</p>
                      <p className="text-brand-primary">{asset.facebook_page_name || 'No Facebook Page linked'}</p>
                      <p className="text-brand-primary">{asset.instagram_username ? `@${asset.instagram_username}` : 'No Instagram account linked'}</p>
                      <p className="text-brand-primary">{asset.ad_account_name || 'No ad account linked'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeactivate(asset)}
                      className="rounded-lg border border-red-400/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-400/10"
                    >
                      Deactivate
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      {/* Architecture note */}
      <div className="mt-10 max-w-2xl rounded-xl border border-brand-muted bg-brand-surface/30 p-5">
        <h3 className="text-xs uppercase tracking-[0.15em] text-brand-primary/60">Planned safe setup</h3>
        <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-brand-primary/70">
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">Meta tokens will never be stored in the frontend.</li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">OAuth and API calls will run through Supabase Edge Functions.</li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">Synced data will create or update draft reports only.</li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">Reports will never auto-publish.</li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">Current month data stays as internal draft until month-end.</li>
        </ul>
      </div>
    </div>
  )
}
