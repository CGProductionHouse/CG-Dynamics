import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { listClients, type Client } from '../../lib/db/clients'

const STEP_LABELS = ['Connect Meta', 'Link assets', 'Sync data', 'Review draft']

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

export default function MetaIntegrationPage() {
  const [searchParams] = useSearchParams()
  const [connectState, setConnectState] = useState<ConnectState>('idle')
  const [connectMsg, setConnectMsg] = useState<string | null>(null)

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

  // Test state
  const [testState, setTestState] = useState<{
    action: string | null
    loading: boolean
    msg: string | null
    isError: boolean
    detail: string | null
  }>({ action: null, loading: false, msg: null, isError: false, detail: null })

  // Read OAuth result from URL query params after callback redirect.
  useEffect(() => {
    const meta = searchParams.get('meta')
    if (meta === 'connected') {
      setConnectState('connected')
      setConnectMsg('Meta connected. Next step: link assets to clients.')
      window.history.replaceState(null, '', window.location.pathname)
    } else if (meta === 'error') {
      setConnectState('error')
      setConnectMsg('Meta connection failed. Please try again.')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [searchParams])

  // Load clients when connected.
  useEffect(() => {
    if (connectState === 'connected') {
      listClients('active').then(res => {
        if (res.data) setClients(res.data)
      })
      loadLinkedAssets()
    }
  }, [connectState])

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

  // Derive filtered Instagram options from selected page.
  const filteredIgOptions = selectedPageId
    ? igAccounts.filter(a => a.facebookPageId === selectedPageId)
    : igAccounts

  // Map selected IDs to display names for saving.
  const selectedPage = pages.find(p => p.id === selectedPageId)
  const selectedIg = igAccounts.find(a => a.id === selectedIgId)
  const selectedAd = adAccounts.find(a => a.id === selectedAdId)

  async function handleSaveLink() {
    if (!selectedClientId) return
    setSaving(true)
    setLinkMsg(null)

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
      setLinkMsg({ ok: true, text: 'Asset link saved.' })
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

  async function testService(endpoint: string, body?: Record<string, unknown>) {
    setTestState({ action: endpoint, loading: true, msg: null, isError: false, detail: null })
    try {
      const { data, error } = await supabase.functions.invoke(endpoint, {
        method: 'POST',
        body: body ?? {},
      })
      if (error) {
        setTestState({ action: endpoint, loading: false, msg: 'Could not reach the Meta service. Check Supabase Edge Function deployment.', isError: true, detail: error.message })
        return
      }
      const ok = data?.ok !== false
      setTestState({ action: endpoint, loading: false, msg: ok ? 'Service is reachable and responding correctly.' : `Unexpected response from ${endpoint}.`, isError: !ok, detail: JSON.stringify(data, null, 2) })
    } catch (err) {
      setTestState({ action: endpoint, loading: false, msg: 'Could not reach the Meta service. Check Supabase Edge Function deployment.', isError: true, detail: err instanceof Error ? err.message : String(err) })
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
              <span className={`shrink-0 text-xs font-medium ${connectState === 'connected' ? 'text-brand-accent' : 'text-amber-400'}`}>
                {connectState === 'connected' ? 'Connected' : 'Not connected'}
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
              {connectState !== 'connected' && (
                <button
                  type="button"
                  onClick={() => testService('meta-oauth-start')}
                  disabled={testState.loading}
                  className="rounded-lg border border-brand-muted px-3 py-2 text-xs font-medium text-brand-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Test service
                </button>
              )}
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
                {connectState === 'connected' ? (assetsLoaded ? 'Assets loaded' : 'Ready') : 'Waiting for Meta connection'}
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

            {assetsLoaded && (
              <div className="mt-4 space-y-4">
                {/* Client dropdown */}
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                  <span className="w-32 text-sm text-brand-primary">CG Client</span>
                  <select
                    value={selectedClientId}
                    onChange={e => setSelectedClientId(e.target.value)}
                    className="flex-1 rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
                  >
                    <option value="">Select a client…</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Facebook Page dropdown */}
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                  <span className="w-32 text-sm text-brand-primary">Facebook Page</span>
                  <select
                    value={selectedPageId}
                    onChange={e => { setSelectedPageId(e.target.value); setSelectedIgId('') }}
                    className="flex-1 rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
                  >
                    <option value="">Select a page…</option>
                    {pages.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.category ? ` (${p.category})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Instagram Account dropdown */}
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                  <span className="w-32 text-sm text-brand-primary">Instagram Account</span>
                  <select
                    value={selectedIgId}
                    onChange={e => setSelectedIgId(e.target.value)}
                    className="flex-1 rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
                  >
                    <option value="">
                      {filteredIgOptions.length === 0 && selectedPageId
                        ? 'No Instagram account linked to this page'
                        : igAccounts.length === 0
                          ? 'No Instagram accounts found'
                          : 'Select an account…'}
                    </option>
                    {filteredIgOptions.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name || a.username || a.id}{a.facebookPageName ? ` — ${a.facebookPageName}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ad Account dropdown */}
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                  <span className="w-32 text-sm text-brand-primary">Ad Account</span>
                  {adAccounts.length > 0 ? (
                    <select
                      value={selectedAdId}
                      onChange={e => setSelectedAdId(e.target.value)}
                      className="flex-1 rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
                    >
                      <option value="">Select an ad account (optional)…</option>
                      {adAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
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
                  {linkMsg && (
                    <span className={`text-sm ${linkMsg.ok ? 'text-brand-accent' : 'text-red-400'}`}>
                      {linkMsg.text}
                    </span>
                  )}
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
                {linkedAssets.length > 0 ? 'Ready for sync setup' : 'Waiting for linked assets'}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-brand-primary">
              Sync will be enabled after assets are linked.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-lg border border-brand-muted bg-brand-muted/20 px-5 py-2.5 text-sm font-semibold text-brand-primary"
              >
                Sync previous completed month
              </button>
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-lg border border-brand-muted bg-brand-muted/20 px-5 py-2.5 text-sm font-semibold text-brand-primary"
              >
                Sync current month as internal draft
              </button>
              <button
                type="button"
                onClick={() => testService('meta-sync', { clientId: null, syncType: 'previous_completed_month', periodStart: null, periodEnd: null })}
                disabled={testState.loading}
                className="rounded-lg border border-brand-muted px-3 py-2 text-xs font-medium text-brand-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Test service
              </button>
            </div>
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

      {/* Linked clients section */}
      {connectState === 'connected' && (
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
                      {asset.facebook_page_name && <p className="text-brand-primary">{asset.facebook_page_name}</p>}
                      {asset.instagram_username && <p className="text-brand-primary">@{asset.instagram_username}</p>}
                      {asset.ad_account_name && <p className="text-brand-primary">{asset.ad_account_name}</p>}
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
      )}

      {/* Test result */}
      {testState.msg && (
        <div className={`mt-6 max-w-2xl rounded-xl border p-5 ${testState.isError ? 'border-red-400/20 bg-red-400/10' : 'border-brand-accent/20 bg-brand-accent/10'}`}>
          <p className={`text-sm font-medium ${testState.isError ? 'text-red-400' : 'text-brand-accent'}`}>
            {testState.msg}
          </p>
          {testState.detail && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-brand-primary/60 hover:text-brand-primary">Response detail</summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-brand-bg/50 p-3 text-xs text-brand-primary">{testState.detail}</pre>
            </details>
          )}
        </div>
      )}

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
