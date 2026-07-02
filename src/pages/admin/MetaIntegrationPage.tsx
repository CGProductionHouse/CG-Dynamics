import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { listClients, type Client } from '../../lib/db/clients'
import { PremiumCard, PremiumCardHeader } from '../../components/ui/PremiumCard'
import { StatusBadge } from '../../components/ui/Badges'
import { ActionButton } from '../../components/ui/Buttons'

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

type MatchConfidence = 'high' | 'medium' | 'low' | 'none'

interface AssetMatch<T> {
  asset: T | null
  score: number
  reason: string
}

interface ClientAssetSuggestion {
  client: Client
  page: AssetMatch<FbPage>
  instagram: AssetMatch<IgAccount>
  adAccount: AssetMatch<AdAccount>
  confidence: MatchConfidence
  reason: string
  currentLink: LinkedAsset | null
  alreadyLinkedDifferently: boolean
  alreadyLinkedSame: boolean
}

interface ConnectionInfo {
  lastConnectedAt: string | null
  metaBusinessName: string | null
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

function normalizeMatchName(value: string | null | undefined): string {
  const suffixes = new Set([
    'pty', 'ltd', 'limited', 'restaurant', 'restaurants', 'bar', 'grill', 'cafe', 'coffee',
    'the', 'official', 'sa', 'south', 'africa', 'group', 'company', 'co', 'inc', 'llc',
  ])
  return (value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => !suffixes.has(token))
    .join(' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length
  const prev = Array.from({ length: b.length + 1 }, (_, index) => index)
  const curr = Array.from({ length: b.length + 1 }, () => 0)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]
  }
  return prev[b.length]
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const shorter = a.length <= b.length ? a : b
  const longer = a.length > b.length ? a : b
  if (shorter.length >= 5 && longer.includes(shorter)) return 0.96
  const distance = levenshtein(a, b)
  const editScore = 1 - distance / Math.max(a.length, b.length)
  const aTokens = new Set(a.split(' ').filter(Boolean))
  const bTokens = new Set(b.split(' ').filter(Boolean))
  const shared = [...aTokens].filter(token => bTokens.has(token)).length
  const tokenScore = shared / Math.max(aTokens.size, bTokens.size, 1)
  return Math.max(editScore, tokenScore)
}

function confidenceFromScore(score: number): MatchConfidence {
  if (score >= 0.9) return 'high'
  if (score >= 0.75) return 'medium'
  if (score >= 0.55) return 'low'
  return 'none'
}

function bestMatch<T>(clientName: string, assets: T[], getNames: (asset: T) => Array<string | null | undefined>): AssetMatch<T> {
  const clientKey = normalizeMatchName(clientName)
  let best: AssetMatch<T> = { asset: null, score: 0, reason: 'No candidate match.' }
  for (const asset of assets) {
    for (const name of getNames(asset)) {
      const assetKey = normalizeMatchName(name)
      if (!assetKey) continue
      const score = similarity(clientKey, assetKey)
      if (score > best.score) {
        const reason = score >= 0.96 && clientKey !== assetKey
          ? `Contained match: "${clientKey}" vs "${assetKey}".`
          : clientKey === assetKey
            ? `Exact normalized match: "${clientKey}".`
            : `Name similarity ${(score * 100).toFixed(0)}%.`
        best = { asset, score, reason }
      }
    }
  }
  return best.score >= 0.55 ? best : { asset: null, score: 0, reason: 'No safe name match.' }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

// Calendar month before the given YYYY-MM, as YYYY-MM (used for baseline sync).
function priorMonth(month: string): string {
  const year = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7)) // 1-12
  const d = new Date(Date.UTC(year, m - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function CopyButton({ getPayload }: { getPayload: () => Record<string, unknown> }) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  async function handleCopy() {
    setCopyError(null)
    try {
      const payload = getPayload()
      const text = JSON.stringify(payload, null, 2)
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError('Could not copy to clipboard.')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-lg border border-brand-accent bg-brand-accent/10 px-3 py-1.5 text-xs font-semibold text-brand-accent hover:bg-brand-accent/20"
      >
        {copied ? 'Copied' : 'Copy diagnostics'}
      </button>
      {copyError && <span className="text-xs text-red-300">{copyError}</span>}
    </div>
  )
}

export default function MetaIntegrationPage() {
  const [searchParams] = useSearchParams()
  const [connectState, setConnectState] = useState<ConnectState>('idle')
  const [connectMsg, setConnectMsg] = useState<string | null>(null)
  const [connectionLoading, setConnectionLoading] = useState(true)
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null)

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
  const [bulkSaving, setBulkSaving] = useState(false)
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Linked assets list
  const [linkedAssets, setLinkedAssets] = useState<LinkedAsset[]>([])
  const [loadingLinked, setLoadingLinked] = useState(false)

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<string | null>(null)
  const [syncMode, setSyncMode] = useState<'all' | 'selected'>('all')
  const [selectedSyncClientId, setSelectedSyncClientId] = useState('')
  // When on, the sync also pulls the previous calendar month so the report can
  // show month-over-month growth.
  const [syncBaseline, setSyncBaseline] = useState(false)
  const [syncResult, setSyncResult] = useState<{
    status: string
    message: string
    period?: { periodStart: string; periodEnd: string; month: string }
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
    diagnostics?: unknown[]
    details?: unknown[]
    debug?: string
    reportId?: string
  } | null>(null)

  type SyncResponse = Record<string, unknown>

  async function invokeMetaSync(accessToken: string, body: Record<string, unknown>): Promise<{ response: Response; data: SyncResponse | null; text: string }> {
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error('Missing Supabase frontend environment variables.')
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/meta-sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const text = await response.text()
    let data: SyncResponse | null = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }

    return { response, data, text }
  }

  function clientNameForAsset(asset: LinkedAsset): string {
    return clients.find(c => c.id === asset.client_id)?.name ?? asset.facebook_page_name ?? asset.instagram_username ?? asset.client_id
  }

  // Load connection status from the server on mount (reliable source of truth).
  const checkConnection = useCallback(async () => {
    setConnectionLoading(true)
    try {
      const { data } = await supabase.functions.invoke('meta-connection-status', {
        method: 'POST',
      })
      if (data?.ok && data?.connected) {
        setConnectState('connected')
        setConnectionInfo({
          lastConnectedAt: data.connection?.lastConnectedAt ?? null,
          metaBusinessName: data.connection?.metaBusinessName ?? null,
        })
        setConnectMsg(null)
      } else {
        setConnectState('idle')
        setConnectionInfo(null)
      }
    } catch {
      setConnectState('idle')
      setConnectionInfo(null)
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

  // Deep link from the Clients page (?client=<id>): preselect that client for a
  // selected-client sync once its linked assets are known. One-shot so it never
  // fights a later manual change.
  const appliedClientParam = useRef(false)
  useEffect(() => {
    if (appliedClientParam.current) return
    const clientParam = searchParams.get('client')
    if (!clientParam) return
    if (linkedAssets.some(asset => asset.client_id === clientParam)) {
      setSyncMode('selected')
      setSelectedSyncClientId(clientParam)
      appliedClientParam.current = true
    }
  }, [searchParams, linkedAssets])

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

  const linkedByClient = useMemo(() => {
    return new Map(linkedAssets.map(asset => [asset.client_id, asset]))
  }, [linkedAssets])

  const readiness = useMemo(() => {
    const activeClients = clients.length
    const linkedClientIds = new Set(linkedAssets.map(asset => asset.client_id))
    return {
      activeClients,
      linkedAny: linkedClientIds.size,
      missingFacebook: clients.filter(client => !linkedByClient.get(client.id)?.facebook_page_id).length,
      missingInstagram: clients.filter(client => !linkedByClient.get(client.id)?.instagram_account_id).length,
      missingAdAccount: clients.filter(client => !linkedByClient.get(client.id)?.ad_account_id).length,
    }
  }, [clients, linkedAssets, linkedByClient])

  const suggestions = useMemo<ClientAssetSuggestion[]>(() => {
    return clients.map(client => {
      const page = bestMatch(client.name, pages, asset => [asset.name])
      const igCandidates = page.asset?.instagramAccount?.id
        ? igAccounts.filter(account => account.id === page.asset?.instagramAccount?.id)
        : igAccounts
      const instagram = page.asset?.instagramAccount
        ? {
            asset: igCandidates[0] ?? null,
            score: page.score,
            reason: igCandidates[0] ? `Instagram account linked to suggested Page "${page.asset.name}".` : 'Suggested Page has no Instagram account.',
          }
        : bestMatch(client.name, igCandidates, asset => [asset.name, asset.username])
      const adAccount = bestMatch(client.name, adAccounts, asset => [asset.name])
      const bestScore = Math.max(page.score, instagram.score, adAccount.score)
      const confidence = confidenceFromScore(bestScore)
      const currentLink = linkedByClient.get(client.id) ?? null
      const suggested = {
        facebookPageId: page.asset?.id ?? null,
        instagramAccountId: instagram.asset?.id ?? null,
        adAccountId: adAccount.asset?.id ?? null,
      }
      const alreadyLinkedDifferently = Boolean(currentLink && (
        (suggested.facebookPageId && currentLink.facebook_page_id !== suggested.facebookPageId) ||
        (suggested.instagramAccountId && currentLink.instagram_account_id !== suggested.instagramAccountId) ||
        (suggested.adAccountId && currentLink.ad_account_id !== suggested.adAccountId)
      ))
      const alreadyLinkedSame = Boolean(currentLink && (
        (!suggested.facebookPageId || currentLink.facebook_page_id === suggested.facebookPageId) &&
        (!suggested.instagramAccountId || currentLink.instagram_account_id === suggested.instagramAccountId) &&
        (!suggested.adAccountId || currentLink.ad_account_id === suggested.adAccountId)
      ))
      const reasons = [page.reason, instagram.reason, adAccount.reason].filter(reason => !reason.startsWith('No safe'))
      return {
        client,
        page,
        instagram,
        adAccount,
        confidence,
        reason: reasons[0] ?? 'No safe match found.',
        currentLink,
        alreadyLinkedDifferently,
        alreadyLinkedSame,
      }
    })
  }, [adAccounts, clients, igAccounts, linkedByClient, pages])

  const safeHighConfidenceSuggestions = useMemo(() => {
    return suggestions.filter(suggestion =>
      (suggestion.page.score >= 0.9 || suggestion.instagram.score >= 0.9 || suggestion.adAccount.score >= 0.9) &&
      !suggestion.alreadyLinkedDifferently &&
      !suggestion.alreadyLinkedSame &&
      ((suggestion.page.score >= 0.9 && suggestion.page.asset) ||
        (suggestion.instagram.score >= 0.9 && suggestion.instagram.asset) ||
        (suggestion.adAccount.score >= 0.9 && suggestion.adAccount.asset))
    )
  }, [suggestions])

  function buildLinkPayload(input: {
    clientId: string
    page: FbPage | null
    instagram: IgAccount | null
    adAccount: AdAccount | null
    allowOverwrite?: boolean
  }) {
    return {
      clientId: input.clientId,
      facebookPageId: input.page?.id ?? null,
      facebookPageName: input.page?.name ?? null,
      instagramAccountId: input.instagram?.id ?? null,
      instagramUsername: input.instagram?.username ?? input.instagram?.name ?? null,
      adAccountId: input.adAccount?.id ?? null,
      adAccountName: input.adAccount?.name ?? null,
      allowOverwrite: input.allowOverwrite === true,
    }
  }

  async function saveAssetLinks(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke('meta-link-assets', {
      method: 'POST',
      body,
    })
    if (error) throw new Error(error.message)
    if (!data?.ok) throw new Error(data?.error || 'Could not save Meta asset links.')
    return data as { linked?: number; skipped?: number; failed?: number; results?: Array<{ status: string; message: string }> }
  }

  async function handleSaveLink() {
    if (!selectedClientId) return
    if (!selectedPageId && !selectedIgId && !selectedAdId) {
      setLinkMsg({ ok: false, text: 'Select at least one Meta asset before saving a manual link.' })
      return
    }
    setSaving(true)
    setLinkMsg(null)

    const clientName = clients.find(c => c.id === selectedClientId)?.name ?? 'Client'

    const existing = linkedByClient.get(selectedClientId)
    const overwriteNeeded = Boolean(existing && (
      (existing.facebook_page_id ?? '') !== (selectedPageId || '') ||
      (existing.instagram_account_id ?? '') !== (selectedIgId || '') ||
      (existing.ad_account_id ?? '') !== (selectedAdId || '')
    ))
    const allowOverwrite = overwriteNeeded
      ? window.confirm(`${clientName} already has a different active Meta link. Replace it with the selected assets?`)
      : false

    if (overwriteNeeded && !allowOverwrite) {
      setSaving(false)
      setLinkMsg({ ok: false, text: 'Existing link was not changed.' })
      return
    }

    try {
      await saveAssetLinks({
        action: 'upsert',
        link: buildLinkPayload({
          clientId: selectedClientId,
          page: selectedPage ?? null,
          instagram: selectedIg ?? null,
          adAccount: selectedAd ?? null,
          allowOverwrite,
        }),
      })
      setLinkMsg({ ok: true, text: `${clientName} linked successfully. You can now link another client.` })
      setSelectedClientId('')
      setSelectedPageId('')
      setSelectedIgId('')
      setSelectedAdId('')
      await loadLinkedAssets()
    } catch {
      setLinkMsg({ ok: false, text: 'Failed to save link. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(asset: LinkedAsset) {
    await saveAssetLinks({ action: 'deactivate', assetId: asset.id })
    await loadLinkedAssets()
  }

  async function handleBulkLinkHighConfidence() {
    if (safeHighConfidenceSuggestions.length === 0) return
    const confirmed = window.confirm(`Link ${safeHighConfidenceSuggestions.length} high-confidence Meta asset match(es)? Existing different links will not be overwritten.`)
    if (!confirmed) return

    setBulkSaving(true)
    setLinkMsg(null)
    try {
      const result = await saveAssetLinks({
        action: 'upsertMany',
        links: safeHighConfidenceSuggestions.map(suggestion => buildLinkPayload({
          clientId: suggestion.client.id,
          page: suggestion.page.score >= 0.9 ? suggestion.page.asset : null,
          instagram: suggestion.instagram.score >= 0.9 ? suggestion.instagram.asset : null,
          adAccount: suggestion.adAccount.score >= 0.9 ? suggestion.adAccount.asset : null,
        })),
      })
      setLinkMsg({ ok: true, text: `Bulk linking complete: ${result.linked ?? 0} linked, ${result.skipped ?? 0} skipped.` })
      await loadLinkedAssets()
    } catch {
      setLinkMsg({ ok: false, text: 'Bulk linking failed. Review matches and try again.' })
    } finally {
      setBulkSaving(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    setSyncProgress(null)
    try {
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

      const syncableAssets = linkedAssets
        .filter(asset => asset.facebook_page_id || asset.instagram_account_id)
        .filter(asset => syncMode !== 'selected' || asset.client_id === selectedSyncClientId)
      if (syncableAssets.length === 0) {
        setSyncResult({
          status: 'skipped',
          message: 'No linked clients with a Facebook Page or Instagram account were found to sync.',
          clientsAttempted: 0,
          clientsSucceeded: 0,
          clientsSynced: 0,
          clientsFailed: 0,
          reportsCreated: 0,
          reportsReused: 0,
          postsSynced: 0,
          warnings: [],
          steps: [],
        })
        return
      }

      const totals = {
        clientsAttempted: syncableAssets.length,
        clientsSucceeded: 0,
        clientsFailed: 0,
        reportsCreated: 0,
        reportsReused: 0,
        reportsUpdated: 0,
        postsSynced: 0,
      }
      const warnings: string[] = []
      const failedClients: { name: string; error: string }[] = []
      const succeededClients: { name: string; postsSynced: number }[] = []
      const steps: string[] = []
      const diagnostics: unknown[] = []
      const details: unknown[] = []
      let syncEngineVersion: string | undefined
      let syncResultPeriod: { periodStart: string; periodEnd: string; month: string } | null = null
      // The primary (target) month as YYYY-MM — used to derive the baseline.
      let targetMonth = ''

      const accessToken = sessionData.session.access_token

      // Sync one asset for a given month. `isBaseline` keeps the previous-month
      // pass from affecting the primary success/failure status — its data folds
      // in (reports/posts) and any problem becomes a warning, not a failure.
      async function processAsset(asset: LinkedAsset, monthParam: string | undefined, isBaseline: boolean) {
        const clientName = clientNameForAsset(asset)
        const reqBody: Record<string, unknown> = { mode: 'previous_completed_month', clientId: asset.client_id }
        if (monthParam) reqBody.month = monthParam
        const { response, data, text } = await invokeMetaSync(accessToken, reqBody)

        syncEngineVersion = typeof data?.syncEngineVersion === 'string' ? data.syncEngineVersion : syncEngineVersion
        diagnostics.push({ clientName, month: monthParam ?? 'previous_completed', baseline: isBaseline, httpStatus: response.status, body: data ?? redactForDisplay(text).slice(0, 500) })
        const respPeriod = data?.period as { periodStart?: string; periodEnd?: string; month?: string } | undefined
        if (respPeriod && !syncResultPeriod && typeof respPeriod.month === 'string') {
          syncResultPeriod = { periodStart: respPeriod.periodStart ?? '', periodEnd: respPeriod.periodEnd ?? '', month: respPeriod.month }
          if (!isBaseline) targetMonth = respPeriod.month
        }

        if (!response.ok || !data?.ok) {
          const safeText = data ? null : redactForDisplay(text || 'No response body from sync service.').slice(0, 500)
          const phase = typeof data?.phase === 'string' ? data.phase : undefined
          const error = [
            phase ? `Phase: ${phase}.` : null,
            typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : safeText || 'Sync failed.',
            !response.ok ? `(HTTP ${response.status})` : null,
          ].filter(Boolean).join(' ')
          if (isBaseline) {
            warnings.push(`Baseline ${monthParam ?? ''} for ${clientName}: ${error}`)
          } else {
            totals.clientsFailed++
            failedClients.push({ name: clientName, error })
            if (Array.isArray(data?.warnings)) warnings.push(...data.warnings.map(String))
            if (Array.isArray(data?.steps)) steps.push(...data.steps.map(String))
            if (Array.isArray(data?.details)) details.push(...data.details)
          }
          return
        }

        // Report/post counts fold in for both passes.
        totals.reportsCreated += Number(data.reportsCreated ?? 0)
        totals.reportsReused += Number(data.reportsReused ?? data.reportsUpdated ?? 0)
        totals.reportsUpdated += Number(data.reportsUpdated ?? data.reportsReused ?? 0)
        totals.postsSynced += Number(data.postsSynced ?? 0)
        if (Array.isArray(data.warnings)) warnings.push(...data.warnings.map(String))
        if (Array.isArray(data.steps)) steps.push(...data.steps.map(String))
        if (Array.isArray(data.details)) details.push(...data.details)

        if (isBaseline) return

        totals.clientsSucceeded += Number(data.clientsSucceeded ?? data.clientsSynced ?? 0)
        totals.clientsFailed += Number(data.clientsFailed ?? 0)
        if (Array.isArray(data.failedClients)) {
          failedClients.push(...data.failedClients.map(item => {
            const row = item as { name?: unknown; error?: unknown }
            return { name: String(row.name ?? clientName), error: String(row.error ?? 'Unknown error') }
          }))
        }
        if (Array.isArray(data.succeededClients)) {
          succeededClients.push(...data.succeededClients.map(item => {
            const row = item as { name?: unknown; postsSynced?: unknown }
            return { name: String(row.name ?? clientName), postsSynced: Number(row.postsSynced ?? 0) }
          }))
        }
      }

      // Pass 1 — the target (previous completed) month.
      for (let index = 0; index < syncableAssets.length; index++) {
        setSyncProgress(`Syncing ${index + 1} of ${syncableAssets.length}: ${clientNameForAsset(syncableAssets[index])}`)
        await processAsset(syncableAssets[index], undefined, false)
      }

      // Pass 2 (optional) — the previous-month baseline for growth comparison.
      let baselineMonth: string | null = null
      if (syncBaseline && targetMonth) {
        baselineMonth = priorMonth(targetMonth)
        for (let index = 0; index < syncableAssets.length; index++) {
          setSyncProgress(`Syncing baseline ${index + 1} of ${syncableAssets.length}: ${clientNameForAsset(syncableAssets[index])}`)
          await processAsset(syncableAssets[index], baselineMonth, true)
        }
      }

      await loadLinkedAssets()
      const status = totals.clientsSucceeded > 0 && totals.clientsFailed === 0
        ? 'success'
        : totals.clientsSucceeded > 0
          ? 'partial'
          : 'failed'

      setSyncResult({
        status,
        message: status === 'success'
          ? `Synced previous completed month for ${totals.clientsSucceeded} client(s)${baselineMonth ? ' (incl. previous-month baseline)' : ''}.`
          : status === 'partial'
            ? `Sync completed with ${totals.clientsSucceeded} succeeded and ${totals.clientsFailed} failed${baselineMonth ? ' (previous-month baseline also attempted)' : ''}.`
            : `Sync failed for all ${totals.clientsAttempted} client(s).`,
        period: syncResultPeriod ?? undefined,
        syncEngineVersion,
        clientsAttempted: totals.clientsAttempted,
        clientsSucceeded: totals.clientsSucceeded,
        clientsSynced: totals.clientsSucceeded,
        clientsFailed: totals.clientsFailed,
        reportsCreated: totals.reportsCreated,
        reportsReused: totals.reportsReused,
        reportsUpdated: totals.reportsUpdated,
        postsSynced: totals.postsSynced,
        warnings,
        failedClients,
        succeededClients,
        steps,
        diagnostics,
        details,
        debug: safeStringify({ syncEngineVersion, diagnostics, warnings, failedClients }),
      })
    } catch (e) {
      setSyncResult({
        status: 'failed',
        message: redactForDisplay(e instanceof Error ? e.message : String(e)),
        phase: 'unknown',
        debug: safeStringify({ error: redactForDisplay(e instanceof Error ? e.message : String(e)) }),
      })
    } finally {
      setSyncProgress(null)
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

      <PremiumCard className="mt-6 max-w-4xl" padding="md">
        <PremiumCardHeader
          eyebrow="Readiness"
          title="Meta connection health"
          action={
            <StatusBadge
              label={connectionLoading ? 'Checking...' : connectState === 'connected' ? 'Connected' : 'Not connected'}
              variant={connectState === 'connected' ? 'published' : 'needs-strategy'}
            />
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <HealthTile label="Active clients" value={readiness.activeClients} />
          <HealthTile label="Linked to Meta" value={readiness.linkedAny} />
          <HealthTile label="Missing Facebook Page" value={readiness.missingFacebook} tone={readiness.missingFacebook > 0 ? 'warn' : 'ok'} />
          <HealthTile label="Missing Instagram" value={readiness.missingInstagram} tone={readiness.missingInstagram > 0 ? 'warn' : 'ok'} />
          <HealthTile label="Missing Ad Account" value={readiness.missingAdAccount} tone={readiness.missingAdAccount > 0 ? 'warn' : 'ok'} />
          <HealthTile label="Last connected" value={formatDateTime(connectionInfo?.lastConnectedAt)} />
          <HealthTile label="OAuth state" value="Prepared SQL required" tone="warn" />
          <HealthTile label="Token encryption" value="Not production-ready" tone="warn" />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-brand-primary/70">
          OAuth state verification is implemented in Edge Functions but requires the prepared `phase-4b` SQL to be applied. Tokens still live in a server-only table, but raw token storage remains a production-readiness risk until encryption is added.
        </p>
      </PremiumCard>

      {/* Step cards */}
      <div className="mt-6 space-y-4 max-w-2xl">
        {/* Step 1 — Connect Meta */}
        <PremiumCard>
          <PremiumCardHeader
            title={<span className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">1</span> Connect Meta</span>}
            action={
              <StatusBadge
                label={connectionLoading ? 'Checking...' : connectState === 'connected' ? 'Connected' : 'Not connected'}
                variant={connectState === 'connected' ? 'published' : 'needs-strategy'}
              />
            }
          />
          <p className="text-sm leading-relaxed text-brand-primary">
            Authorise CG Dynamics to access your Facebook Business assets.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ActionButton variant="outline" onClick={handleConnect}>
              {connectState === 'connected' ? 'Reconnect Meta' : 'Connect Meta'}
            </ActionButton>
          </div>
        </PremiumCard>

        {/* Step 2 — Link assets to clients */}
        <PremiumCard>
          <PremiumCardHeader
            title={<span className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">2</span> Link assets to clients</span>}
            action={
              <StatusBadge
                label={connectionLoading ? 'Checking connection...' : connectState === 'connected' ? (assetsLoaded ? 'Assets loaded' : 'Ready') : 'Waiting for Meta connection'}
                variant={connectState === 'connected' ? (assetsLoaded ? 'published' : 'ready-to-publish') : 'internal-draft'}
              />
            }
          />

          {connectState === 'connected' && !assetsLoaded && (
            <>
              <p className="text-sm leading-relaxed text-brand-primary">
                Load your Meta assets, then choose which Facebook Page, Instagram account and ad account belong to each CG client.
              </p>
              <div className="mt-4">
                <ActionButton variant="outline" onClick={loadAssets} loading={loadingAssets}>
                  {loadingAssets ? 'Loading...' : 'Load Meta assets'}
                </ActionButton>
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
              <div className="rounded-xl border border-brand-muted bg-brand-bg/55 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-accent">Bulk matching</p>
                    <h3 className="mt-1 text-base font-semibold text-white">Review suggested matches for active clients</h3>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-brand-primary/75">
                      Suggestions are generated from normalized names. High-confidence matches can be linked safely; medium and low matches stay manual review only.
                    </p>
                  </div>
                  <ActionButton
                    variant="primary"
                    onClick={handleBulkLinkHighConfidence}
                    disabled={safeHighConfidenceSuggestions.length === 0 || bulkSaving}
                    loading={bulkSaving}
                  >
                    Link high-confidence matches ({safeHighConfidenceSuggestions.length})
                  </ActionButton>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-[980px] w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-[0.12em] text-brand-primary/55">
                      <tr className="border-b border-white/10">
                        <th className="px-3 py-2">Active CG client</th>
                        <th className="px-3 py-2">Facebook Page</th>
                        <th className="px-3 py-2">Instagram</th>
                        <th className="px-3 py-2">Ad Account</th>
                        <th className="px-3 py-2">Confidence</th>
                        <th className="px-3 py-2">Current / warning</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/8">
                      {suggestions.map(suggestion => (
                        <tr key={suggestion.client.id} className="align-top">
                          <td className="px-3 py-3 font-semibold text-white">{suggestion.client.name}</td>
                          <SuggestedAssetCell label={suggestion.page.asset?.name ?? null} reason={suggestion.page.reason} />
                          <SuggestedAssetCell
                            label={suggestion.instagram.asset ? suggestion.instagram.asset.name || suggestion.instagram.asset.username || suggestion.instagram.asset.id : null}
                            reason={suggestion.instagram.reason}
                          />
                          <SuggestedAssetCell label={suggestion.adAccount.asset?.name ?? null} reason={suggestion.adAccount.reason} />
                          <td className="px-3 py-3">
                            <ConfidencePill confidence={suggestion.confidence} />
                            <p className="mt-1 text-xs text-brand-primary/60">{suggestion.reason}</p>
                          </td>
                          <td className="px-3 py-3 text-xs text-brand-primary/75">
                            {suggestion.currentLink ? (
                              <>
                                <p className="font-semibold text-white">Currently linked</p>
                                <p>{suggestion.currentLink.facebook_page_name || 'No Facebook Page'}</p>
                                <p>{suggestion.currentLink.instagram_username ? `@${suggestion.currentLink.instagram_username}` : 'No Instagram'}</p>
                                <p>{suggestion.currentLink.ad_account_name || 'No ad account'}</p>
                              </>
                            ) : (
                              <p>Not linked yet</p>
                            )}
                            {suggestion.alreadyLinkedDifferently && (
                              <p className="mt-2 rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-amber-300">
                                Existing active link differs. Bulk action will not overwrite it.
                              </p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <details className="rounded-xl border border-brand-muted bg-brand-bg/35 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-white">Manual override for edge cases</summary>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-1 md:grid-cols-[150px_minmax(0,1fr)] md:items-center md:gap-4">
                    <span className="text-sm text-brand-primary">CG Client</span>
                    <SearchablePicker
                      value={selectedClientId}
                      onChange={setSelectedClientId}
                      options={sortedClientOptions}
                      placeholder="Select a client..."
                    />
                  </div>

                  <div className="grid gap-1 md:grid-cols-[150px_minmax(0,1fr)] md:items-center md:gap-4">
                    <span className="text-sm text-brand-primary">Facebook Page</span>
                    <SearchablePicker
                      value={selectedPageId}
                      onChange={v => { setSelectedPageId(v); setSelectedIgId('') }}
                      options={sortedPageOptions}
                      placeholder="Select a page..."
                      emptyLabel="No pages found"
                    />
                  </div>

                  <div className="grid gap-1 md:grid-cols-[150px_minmax(0,1fr)] md:items-center md:gap-4">
                    <span className="text-sm text-brand-primary">Instagram Account</span>
                    <SearchablePicker
                      value={selectedIgId}
                      onChange={setSelectedIgId}
                      options={sortedIgOptions}
                      placeholder={igAccounts.length === 0 ? 'No Instagram accounts found' : 'Select an account...'}
                      emptyLabel={selectedPageId ? 'No Instagram linked to this page' : 'Select a Facebook Page first'}
                    />
                  </div>

                  <div className="grid gap-1 md:grid-cols-[150px_minmax(0,1fr)] md:items-center md:gap-4">
                    <span className="text-sm text-brand-primary">Ad Account</span>
                    {adAccounts.length > 0 ? (
                      <SearchablePicker
                        value={selectedAdId}
                        onChange={setSelectedAdId}
                        options={sortedAdOptions}
                        placeholder="Select an ad account (optional)..."
                      />
                    ) : (
                      <p className="text-sm text-brand-primary/60">
                        {adAccountsError || 'No ad accounts available.'}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <ActionButton variant="secondary" onClick={handleSaveLink} disabled={saving || !selectedClientId || (!selectedPageId && !selectedIgId && !selectedAdId)} loading={saving}>
                      {saving ? 'Saving...' : 'Save manual link'}
                    </ActionButton>
                  </div>
                </div>
              </details>
            </div>
          )}
        </PremiumCard>

        {/* Step 3 — Sync report data */}
        <PremiumCard>
          <PremiumCardHeader
            title={<span className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">3</span> Sync report data</span>}
            action={
              <StatusBadge
                label={linkedAssets.length > 0 ? 'Ready' : 'Waiting for linked assets'}
                variant={linkedAssets.length > 0 ? 'ready-to-publish' : 'internal-draft'}
              />
            }
          />

          {!syncResult && (
            <div className="space-y-2 text-sm leading-relaxed text-brand-primary">
              <p>Sync the previous completed month from linked Meta assets. Reports are saved as internal drafts.</p>
              <div className="rounded-lg border border-brand-muted bg-brand-bg/60 px-3 py-2.5">
                <p className="text-xs text-brand-primary">
                  <span className="font-semibold text-white">Selected client</span> for quick updates between campaigns.
                </p>
                <p className="mt-1 text-xs text-brand-primary">
                  <span className="font-semibold text-white">All linked clients</span> for month-end reporting across every client.
                </p>
              </div>
            </div>
          )}

          {syncProgress && (
            <p className="mt-3 rounded-lg border border-brand-accent/20 bg-brand-accent/10 px-3 py-2 text-sm font-medium text-brand-accent">
              {syncProgress}
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

              {/* Staff-only diagnostics */}
              {(syncResult.debug || (syncResult.steps && syncResult.steps.length > 0)) && (
                <details className="mt-3 rounded-lg border border-brand-muted bg-brand-bg/50 p-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-brand-primary">
                    Diagnostics (staff only)
                  </summary>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <CopyButton
                      getPayload={() => ({
                        syncEngineVersion: syncResult.syncEngineVersion,
                        status: syncResult.status,
                        message: syncResult.message,
                        period: syncResult.period,
                        clientsAttempted: syncResult.clientsAttempted,
                        clientsSucceeded: syncResult.clientsSucceeded,
                        clientsFailed: syncResult.clientsFailed,
                        reportsCreated: syncResult.reportsCreated,
                        reportsReused: syncResult.reportsReused,
                        reportsUpdated: syncResult.reportsUpdated,
                        postsSynced: syncResult.postsSynced,
                        warnings: syncResult.warnings,
                        failedClients: syncResult.failedClients,
                        succeededClients: syncResult.succeededClients,
                        steps: syncResult.steps,
                        diagnostics: syncResult.diagnostics,
                        details: syncResult.details,
                      })}
                    />
                  </div>
                  {syncResult.period && (
                    <div className="mt-2">
                      <p className="text-[11px] text-brand-primary/70">
                        Current sync: <strong className="text-white">{syncResult.period.month}</strong> (<strong className="text-brand-primary/90">{syncResult.period.periodStart}</strong> to <strong className="text-brand-primary/90">{syncResult.period.periodEnd}</strong>)
                      </p>
                      <p className="text-[11px] text-brand-primary/70 mt-0.5">
                        Compare these numbers against the same date range in Meta Business Suite.
                      </p>
                    </div>
                  )}
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
                  <ActionButton variant="primary" onClick={() => window.location.href = '/admin/client-dashboard'}>
                    Open Client Dashboard
                  </ActionButton>
                )}
                <ActionButton variant="secondary" onClick={() => setSyncResult(null)}>
                  Dismiss
                </ActionButton>
              </div>
            </div>
          )}

          {!syncResult && (
            <div className="mt-4 space-y-4">
              <div className="flex gap-1 rounded-lg border border-brand-muted bg-brand-bg p-0.5 w-fit">
                <ActionButton
                  variant={syncMode === 'all' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSyncMode('all')}
                >
                  All linked clients
                </ActionButton>
                <ActionButton
                  variant={syncMode === 'selected' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSyncMode('selected')}
                >
                  Selected client
                </ActionButton>
              </div>

              {syncMode === 'selected' && (
                <div className="max-w-xs">
                  <SearchablePicker
                    value={selectedSyncClientId}
                    onChange={setSelectedSyncClientId}
                    options={linkedAssets
                      .filter(a => a.facebook_page_id || a.instagram_account_id)
                      .map(a => ({ value: a.client_id, label: clientNameForAsset(a) }))
                      .sort((a, b) => a.label.localeCompare(b.label))}
                    placeholder="Search and select a client..."
                    emptyLabel="No linked clients with sync-ready assets"
                  />
                </div>
              )}

              <label className="flex max-w-md cursor-pointer items-start gap-2.5 rounded-lg border border-brand-muted bg-brand-bg/60 px-3.5 py-2.5">
                <input
                  type="checkbox"
                  checked={syncBaseline}
                  onChange={e => setSyncBaseline(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-brand-accent"
                />
                <span className="text-xs leading-relaxed text-brand-primary">
                  <span className="font-semibold text-white">Also sync the previous month</span> as a baseline so the
                  report can show month-over-month growth. Existing reports are reused, not duplicated.
                </span>
              </label>

              {syncBaseline && (
                <div className="max-w-md rounded-lg border border-brand-muted bg-brand-bg/40 px-3.5 py-2 text-xs text-brand-primary">
                  Current sync: <span className="text-white">last completed month</span>
                  <br />
                  Baseline: <span className="text-white">previous month for growth comparison</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <ActionButton
                  variant="outline"
                  onClick={handleSync}
                  disabled={
                    syncing ||
                    linkedAssets.length === 0 ||
                    (syncMode === 'selected' && !selectedSyncClientId)
                  }
                  loading={syncing}
                >
                  {syncing
                    ? 'Syncing...'
                    : syncMode === 'selected'
                      ? syncBaseline ? 'Sync selected client + baseline' : 'Sync selected client'
                      : syncBaseline ? 'Sync all linked clients + baseline' : 'Sync all linked clients'}
                </ActionButton>
                <ActionButton variant="secondary" disabled>
                  Sync current month as internal draft
                </ActionButton>
              </div>
            </div>
          )}
        </PremiumCard>

        {/* Step 4 — Review draft */}
        <PremiumCard>
          <PremiumCardHeader title={<span className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">4</span> Review monthly draft</span>} />
          <p className="text-sm leading-relaxed text-brand-primary">
            After sync, CG Dynamics will create or update a monthly report draft. Staff can add strategy, preview as client, and publish.
          </p>
        </PremiumCard>
      </div>

      {/* Linked clients section — always visible, independent of connection status */}
      <PremiumCard className="mt-8" padding="md">
        <PremiumCardHeader title="Linked clients" />
        {loadingLinked ? (
          <p className="text-sm text-brand-primary">Loading linked clients...</p>
        ) : linkedAssets.length === 0 ? (
          <p className="text-sm text-brand-primary">No clients linked yet. Load Meta assets above and save a link.</p>
        ) : (
          <div className="space-y-2">
            {linkedAssets.map(asset => {
              const client = clients.find(c => c.id === asset.client_id)
              return (
                <div key={asset.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-muted bg-brand-bg/50 p-4">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium text-white">{client?.name ?? asset.client_id}</p>
                    <p className="text-brand-primary">{asset.facebook_page_name || 'No Facebook Page linked'}</p>
                    <p className="text-brand-primary">{asset.instagram_username ? `@${asset.instagram_username}` : 'No Instagram account linked'}</p>
                    <p className="text-brand-primary">{asset.ad_account_name || 'No ad account linked'}</p>
                  </div>
                  <ActionButton variant="danger" size="sm" onClick={() => handleDeactivate(asset)}>
                    Deactivate
                  </ActionButton>
                </div>
              )
            })}
          </div>
        )}
      </PremiumCard>

      {/* Architecture note */}
      <PremiumCard className="mt-6" padding="md" border>
        <PremiumCardHeader eyebrow="Planned safe setup" title="" />
        <ul className="space-y-1.5 text-sm leading-relaxed text-brand-primary/70">
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">Meta tokens will never be stored in the frontend.</li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">OAuth and API calls will run through Supabase Edge Functions.</li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">Synced data will create or update draft reports only.</li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">Reports will never auto-publish.</li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">Current month data stays as internal draft until month-end.</li>
        </ul>
      </PremiumCard>
    </div>
  )
}

function ConfidencePill({ confidence }: { confidence: MatchConfidence }) {
  const styles: Record<MatchConfidence, string> = {
    high: 'border-brand-teal/30 bg-brand-teal/10 text-[#66d0c3]',
    medium: 'border-amber-300/30 bg-amber-300/10 text-amber-200',
    low: 'border-white/10 bg-white/[0.04] text-brand-primary',
    none: 'border-white/8 bg-white/[0.02] text-brand-primary/45',
  }
  const label = confidence === 'none' ? 'No match' : confidence
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.12em] ${styles[confidence]}`}>
      {label}
    </span>
  )
}

function SuggestedAssetCell({ label, reason }: { label: string | null; reason: string }) {
  return (
    <td className="px-3 py-3">
      <p className={label ? 'font-semibold text-white' : 'text-brand-primary/45'}>{label ?? 'No safe suggestion'}</p>
      <p className="mt-1 text-xs leading-relaxed text-brand-primary/60">{reason}</p>
    </td>
  )
}

function HealthTile({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'neutral' | 'ok' | 'warn' }) {
  const toneClass = {
    neutral: 'border-white/8 bg-white/[0.03] text-white',
    ok: 'border-brand-teal/20 bg-brand-teal/[0.06] text-[#66d0c3]',
    warn: 'border-amber-300/20 bg-amber-300/[0.06] text-amber-200',
  }[tone]
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-brand-primary/55">{label}</p>
      <p className="mt-2 text-sm font-bold">{value}</p>
    </div>
  )
}
