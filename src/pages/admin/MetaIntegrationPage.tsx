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

type ReadinessFilter = 'none' | 'active' | 'linked' | 'missingFacebook' | 'missingInstagram' | 'missingAdAccount'

type TableFilter = 'needs' | 'linked' | 'all'

const SYNC_RANGE_OPTIONS = [
  { value: 1, label: '1 completed month' },
  { value: 3, label: '3 completed months' },
  { value: 6, label: '6 completed months' },
  { value: 12, label: '12 completed months' },
] as const

const CLIENT_ALIASES: Record<string, string> = {
  staffy: 'staffordshire',
  staffies: 'staffordshire',
  ronni: 'ronnie',
  ronnies: 'ronnie',
  micky: 'mickey',
  mickys: 'mickey',
  bobby: 'bob',
  bobbie: 'bob',
  tommys: 'tommy',
  tommy: 'tommy',
  jimmys: 'jimmy',
  jimmy: 'jimmy',
  charlies: 'charlie',
  charley: 'charlie',
  da: 'the',
  o: 'of',
  n: 'and',
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

function applyAliases(value: string): string {
  const tokens = value.split(/\s+/).filter(Boolean)
  return tokens.map(token => CLIENT_ALIASES[token] ?? token).join(' ')
}

function normalizeMatchName(value: string | null | undefined): string {
  const suffixes = new Set([
    'pty', 'ltd', 'limited', 'restaurant', 'restaurants', 'bar', 'grill', 'cafe', 'coffee',
    'the', 'official', 'sa', 'south', 'africa', 'group', 'company', 'co', 'inc', 'llc',
  ])
  const normalized = (value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => !suffixes.has(token))
    .join(' ')
    .trim()
  return applyAliases(normalized)
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
  if (shorter.length >= 4 && longer.includes(shorter)) return 0.96
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
          ? `Strong match: normalized "${clientKey}" matches "${assetKey}".`
          : clientKey === assetKey
            ? `Exact match after aliases and normalisation.`
            : `Similarity ${(score * 100).toFixed(0)}%.`
        best = { asset, score, reason }
      }
    }
  }
  return best.score >= 0.55 ? best : { asset: null, score: 0, reason: 'No safe name match found.' }
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

function getCompletedMonths(count: number): string[] {
  const now = new Date()
  const months: string[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
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
  const [adAccountsDiagnostic, setAdAccountsDiagnostic] = useState<Record<string, unknown> | null>(null)
  const [pagesDiagnostic, setPagesDiagnostic] = useState<Record<string, unknown> | null>(null)
  const [assetError, setAssetError] = useState<string | null>(null)

  // Linking form (manual fallback)
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedPageId, setSelectedPageId] = useState('')
  const [selectedIgId, setSelectedIgId] = useState('')
  const [selectedAdId, setSelectedAdId] = useState('')
  const [saving, setSaving] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Row-level selections
  const [rowSelections, setRowSelections] = useState<Record<string, { facebookPageId: string; instagramAccountId: string; adAccountId: string }>>({})
  const [linkingRows, setLinkingRows] = useState<Set<string>>(new Set())

  // Readiness drilldown
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>('none')

  // Table filter tabs
  const [tableFilter, setTableFilter] = useState<TableFilter>('needs')

  // Expanded detail panel
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null)

  // Linked assets list
  const [linkedAssets, setLinkedAssets] = useState<LinkedAsset[]>([])
  const [loadingLinked, setLoadingLinked] = useState(false)

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<string | null>(null)
  const [syncMode, setSyncMode] = useState<'all' | 'selected'>('all')
  const [selectedSyncClientId, setSelectedSyncClientId] = useState('')
  const [syncMonthCount, setSyncMonthCount] = useState(3)
  const [syncResult, setSyncResult] = useState<{
    status: string
    message: string
    phase?: string
    syncEngineVersion?: string
    clientsAttempted?: number
    clientsSucceeded?: number
    clientsSynced?: number
    clientsFailed?: number
    monthsAttempted?: number
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

  const checkConnection = useCallback(async () => {
    setConnectionLoading(true)
    try {
      const { data } = await supabase.functions.invoke('meta-connection-status', { method: 'POST' })
      if (data?.ok && data?.connected) {
        setConnectState('connected')
        setConnectionInfo({ lastConnectedAt: data.connection?.lastConnectedAt ?? null, metaBusinessName: data.connection?.metaBusinessName ?? null })
        setConnectMsg(null)
      } else {
        setConnectState('idle'); setConnectionInfo(null)
      }
    } catch {
      setConnectState('idle'); setConnectionInfo(null)
    } finally { setConnectionLoading(false) }
  }, [])

  useEffect(() => {
    checkConnection()
    listClients('active').then(res => { if (res.data) setClients(res.data) })
    loadLinkedAssets()
  }, [checkConnection])

  useEffect(() => {
    const meta = searchParams.get('meta')
    if (meta === 'connected') {
      setConnectMsg('Meta connected. Next step: link assets to clients.')
      checkConnection()
      window.history.replaceState(null, '', window.location.pathname)
    } else if (meta === 'error') {
      setConnectMsg('Meta connection failed. Please try again.')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [searchParams, checkConnection])

  const appliedClientParam = useRef(false)
  useEffect(() => {
    if (appliedClientParam.current) return
    const clientParam = searchParams.get('client')
    if (!clientParam) return
    if (linkedAssets.some(asset => asset.client_id === clientParam)) {
      setSyncMode('selected'); setSelectedSyncClientId(clientParam); appliedClientParam.current = true
    }
  }, [searchParams, linkedAssets])

  const loadLinkedAssets = useCallback(async () => {
    setLoadingLinked(true)
    const { data } = await supabase
      .from('meta_client_assets').select('*').eq('is_active', true).order('created_at', { ascending: false })
    if (data) setLinkedAssets(data as LinkedAsset[])
    setLoadingLinked(false)
  }, [])

  async function handleConnect() {
    setConnectState('idle'); setConnectMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('meta-oauth-start', { method: 'POST' })
      if (error) { setConnectState('error'); setConnectMsg('Could not reach the connection service. Check Supabase Edge Function deployment.'); return }
      if (!data?.ok || !data?.url) { setConnectState('error'); setConnectMsg(data?.error || 'Failed to start Meta connection.'); return }
      window.location.href = data.url
    } catch { setConnectState('error'); setConnectMsg('Could not reach the connection service.') }
  }

  async function loadAssets() {
    setLoadingAssets(true); setAssetError(null); setAssetsLoaded(false)
    try {
      const { data, error } = await supabase.functions.invoke('meta-list-assets', { method: 'POST' })
      if (error) { setAssetError('Could not load Meta assets. Check Supabase Edge Function deployment.'); return }
      if (!data?.ok) { setAssetError(data?.message || data?.error || 'Failed to load Meta assets.'); return }
      setPages(data.pages ?? []); setIgAccounts(data.instagramAccounts ?? []); setAdAccounts(data.adAccounts ?? [])
      setAdAccountsError(data.adAccountsError ?? null); setAdAccountsDiagnostic(data.adAccountsDiagnostic ?? null)
      setPagesDiagnostic(data.pagesDiagnostic ?? null); setAssetsLoaded(true)
    } catch { setAssetError('Could not load Meta assets.')
    } finally { setLoadingAssets(false) }
  }

  const pagePickerOptions = useMemo(() => {
    const seen = new Set<string>(); const options: { value: string; label: string }[] = []
    for (const p of pages) { if (!seen.has(p.id)) { seen.add(p.id); options.push({ value: p.id, label: p.category ? `${p.name} (${p.category})` : p.name }) } }
    for (const link of linkedAssets) {
      if (link.facebook_page_id && !seen.has(link.facebook_page_id)) { seen.add(link.facebook_page_id); options.push({ value: link.facebook_page_id, label: `${link.facebook_page_name || link.facebook_page_id} (existing linked page)` }) }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label))
  }, [pages, linkedAssets])

  const adPickerOptions = useMemo(() => {
    const seen = new Set<string>(); const options: { value: string; label: string }[] = []
    for (const a of adAccounts) { if (!seen.has(a.id)) { seen.add(a.id); options.push({ value: a.id, label: a.name }) } }
    for (const link of linkedAssets) {
      if (link.ad_account_id && !seen.has(link.ad_account_id)) { seen.add(link.ad_account_id); options.push({ value: link.ad_account_id, label: `${link.ad_account_name || link.ad_account_id} (existing linked account)` }) }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label))
  }, [adAccounts, linkedAssets])

  const sortedClientOptions = useMemo(
    () => clients.map(c => ({ value: c.id, label: c.name })).sort((a, b) => a.label.localeCompare(b.label)), [clients],
  )

  function igOptionsForPage(pageId: string | null | undefined) {
    const filtered = pageId ? igAccounts.filter(a => a.facebookPageId === pageId) : igAccounts
    let options = filtered.map(a => ({ value: a.id, label: a.name || a.username || a.id }))
    for (const link of linkedAssets) {
      if (link.instagram_account_id && !options.some(o => o.value === link.instagram_account_id)) {
        options.push({ value: link.instagram_account_id, label: `${link.instagram_username || link.instagram_account_id} (existing)` })
      }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label))
  }

  const selectedPage = pages.find(p => p.id === selectedPageId)
  const selectedIg = igAccounts.find(a => a.id === selectedIgId)
  const selectedAd = adAccounts.find(a => a.id === selectedAdId)

  const linkedByClient = useMemo(() => new Map(linkedAssets.map(asset => [asset.client_id, asset])), [linkedAssets])

  const readiness = useMemo(() => {
    const activeClients = clients.length
    const linkedClientIds = new Set(linkedAssets.map(asset => asset.client_id))
    return {
      activeClients, linkedAny: linkedClientIds.size,
      missingFacebook: clients.filter(client => !linkedByClient.get(client.id)?.facebook_page_id).length,
      missingInstagram: clients.filter(client => !linkedByClient.get(client.id)?.instagram_account_id).length,
      missingAdAccount: clients.filter(client => !linkedByClient.get(client.id)?.ad_account_id).length,
    }
  }, [clients, linkedAssets, linkedByClient])

  const filteredClientsForDrilldown = useMemo(() => {
    if (readinessFilter === 'none') return null
    if (readinessFilter === 'active') return clients.map(c => ({ client: c, reason: '' }))
    if (readinessFilter === 'linked') return clients.filter(c => linkedByClient.has(c.id)).map(c => ({ client: c, reason: '' }))
    if (readinessFilter === 'missingFacebook') return clients.filter(c => !linkedByClient.get(c.id)?.facebook_page_id).map(c => ({ client: c, reason: 'Link a Facebook Page to enable content sync.' }))
    if (readinessFilter === 'missingInstagram') return clients.filter(c => !linkedByClient.get(c.id)?.instagram_account_id).map(c => ({ client: c, reason: 'Link an Instagram account to enable content sync.' }))
    if (readinessFilter === 'missingAdAccount') return clients.filter(c => !linkedByClient.get(c.id)?.ad_account_id).map(c => ({ client: c, reason: 'Ad accounts are needed for paid/boosted reporting later.' }))
    return null
  }, [readinessFilter, clients, linkedByClient])

  const suggestions = useMemo<ClientAssetSuggestion[]>(() => {
    return clients.map(client => {
      const page = bestMatch(client.name, pages, asset => [asset.name])
      const igCandidates = page.asset?.instagramAccount?.id ? igAccounts.filter(account => account.id === page.asset?.instagramAccount?.id) : igAccounts
      const instagram = page.asset?.instagramAccount
        ? { asset: igCandidates[0] ?? null, score: page.score, reason: igCandidates[0] ? `Instagram of suggested Page "${page.asset.name}".` : 'Suggested Page has no Instagram account.' }
        : bestMatch(client.name, igCandidates, asset => [asset.name, asset.username])
      const adAccount = bestMatch(client.name, adAccounts, asset => [asset.name])
      const bestScore = Math.max(page.score, instagram.score, adAccount.score)
      const confidence = confidenceFromScore(bestScore)
      const currentLink = linkedByClient.get(client.id) ?? null
      const suggested = { facebookPageId: page.asset?.id ?? null, instagramAccountId: instagram.asset?.id ?? null, adAccountId: adAccount.asset?.id ?? null }
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
      const reasons = [page.reason, instagram.reason, adAccount.reason].filter(r => !r.startsWith('No safe'))
      return { client, page, instagram, adAccount, confidence, reason: reasons[0] ?? 'No safe match found.', currentLink, alreadyLinkedDifferently, alreadyLinkedSame }
    })
  }, [adAccounts, clients, igAccounts, linkedByClient, pages])

  const filteredSuggestions = useMemo(() => {
    return suggestions.filter(s => {
      if (tableFilter === 'all') return true
      if (tableFilter === 'linked') return s.alreadyLinkedSame && !s.alreadyLinkedDifferently
      return !s.alreadyLinkedSame || s.alreadyLinkedDifferently ||
        !s.currentLink?.facebook_page_id || !s.currentLink?.instagram_account_id ||
        (adAccounts.length > 0 && !s.currentLink?.ad_account_id) ||
        s.confidence === 'low' || s.confidence === 'medium' || s.confidence === 'none'
    })
  }, [suggestions, tableFilter, adAccounts.length])

  useEffect(() => {
    if (!assetsLoaded) return
    const initial: Record<string, { facebookPageId: string; instagramAccountId: string; adAccountId: string }> = {}
    for (const s of suggestions) {
      initial[s.client.id] = {
        facebookPageId: s.page.score >= 0.9 && !s.alreadyLinkedDifferently && !s.alreadyLinkedSame ? (s.page.asset?.id ?? '') : (s.currentLink?.facebook_page_id ?? ''),
        instagramAccountId: s.instagram.score >= 0.9 && !s.alreadyLinkedDifferently && !s.alreadyLinkedSame ? (s.instagram.asset?.id ?? '') : (s.currentLink?.instagram_account_id ?? ''),
        adAccountId: s.adAccount.score >= 0.9 && !s.alreadyLinkedDifferently && !s.alreadyLinkedSame ? (s.adAccount.asset?.id ?? '') : (s.currentLink?.ad_account_id ?? ''),
      }
    }
    setRowSelections(initial)
  }, [assetsLoaded, suggestions])

  function updateRowSelection(clientId: string, field: 'facebookPageId' | 'instagramAccountId' | 'adAccountId', value: string) {
    setRowSelections(prev => ({ ...prev, [clientId]: { ...prev[clientId], [field]: value, ...(field === 'facebookPageId' ? { instagramAccountId: '' } : {}) } }))
  }

  function buildLinkPayload(input: { clientId: string; page: FbPage | null; instagram: IgAccount | null; adAccount: AdAccount | null; allowOverwrite?: boolean }) {
    return {
      clientId: input.clientId, facebookPageId: input.page?.id ?? null, facebookPageName: input.page?.name ?? null,
      instagramAccountId: input.instagram?.id ?? null, instagramUsername: input.instagram?.username ?? input.instagram?.name ?? null,
      adAccountId: input.adAccount?.id ?? null, adAccountName: input.adAccount?.name ?? null, allowOverwrite: input.allowOverwrite === true,
    }
  }

  async function saveAssetLinks(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke('meta-link-assets', { method: 'POST', body })
    if (error) throw new Error(error.message)
    if (!data?.ok) throw new Error(data?.error || 'Could not save Meta asset links.')
    return data as { linked?: number; skipped?: number; failed?: number; results?: Array<{ status: string; message: string }> }
  }

  async function handleSaveLink() {
    if (!selectedClientId) return
    if (!selectedPageId && !selectedIgId && !selectedAdId) { setLinkMsg({ ok: false, text: 'Select at least one Meta asset before saving a manual link.' }); return }
    setSaving(true); setLinkMsg(null)
    const clientName = clients.find(c => c.id === selectedClientId)?.name ?? 'Client'
    const existing = linkedByClient.get(selectedClientId)
    const overwriteNeeded = Boolean(existing && ((existing.facebook_page_id ?? '') !== (selectedPageId || '') || (existing.instagram_account_id ?? '') !== (selectedIgId || '') || (existing.ad_account_id ?? '') !== (selectedAdId || '')))
    const allowOverwrite = overwriteNeeded ? window.confirm(`${clientName} already has a different active Meta link. Replace it with the selected assets?`) : false
    if (overwriteNeeded && !allowOverwrite) { setSaving(false); setLinkMsg({ ok: false, text: 'Existing link was not changed.' }); return }
    try {
      await saveAssetLinks({ action: 'upsert', link: buildLinkPayload({ clientId: selectedClientId, page: selectedPage ?? null, instagram: selectedIg ?? null, adAccount: selectedAd ?? null, allowOverwrite }) })
      setLinkMsg({ ok: true, text: `${clientName} linked successfully.` })
      setSelectedClientId(''); setSelectedPageId(''); setSelectedIgId(''); setSelectedAdId('')
      await loadLinkedAssets()
    } catch { setLinkMsg({ ok: false, text: 'Failed to save link. Please try again.' })
    } finally { setSaving(false) }
  }

  async function handleDeactivate(asset: LinkedAsset) {
    await saveAssetLinks({ action: 'deactivate', assetId: asset.id })
    await loadLinkedAssets()
  }

  async function handleRowLink(clientId: string) {
    const sel = rowSelections[clientId]
    if (!sel || (!sel.facebookPageId && !sel.instagramAccountId && !sel.adAccountId)) return
    setLinkingRows(prev => new Set(prev).add(clientId)); setLinkMsg(null)
    const clientName = clients.find(c => c.id === clientId)?.name ?? 'Client'
    const existing = linkedByClient.get(clientId)
    const overwriteNeeded = Boolean(existing && ((existing.facebook_page_id ?? '') !== (sel.facebookPageId || '') || (existing.instagram_account_id ?? '') !== (sel.instagramAccountId || '') || (existing.ad_account_id ?? '') !== (sel.adAccountId || '')))
    const allowOverwrite = overwriteNeeded ? window.confirm(`${clientName} already has a different active Meta link. Replace it with the selected assets?`) : false
    if (overwriteNeeded && !allowOverwrite) { setLinkingRows(prev => { const n = new Set(prev); n.delete(clientId); return n }); setLinkMsg({ ok: false, text: `${clientName}: existing link was not changed.` }); return }
    try {
      await saveAssetLinks({ action: 'upsert', link: buildLinkPayload({ clientId, page: pages.find(p => p.id === sel.facebookPageId) ?? null, instagram: igAccounts.find(a => a.id === sel.instagramAccountId) ?? null, adAccount: adAccounts.find(a => a.id === sel.adAccountId) ?? null, allowOverwrite }) })
      setLinkMsg({ ok: true, text: `${clientName} linked successfully.` })
      setExpandedClientId(null); await loadLinkedAssets()
    } catch { setLinkMsg({ ok: false, text: `${clientName}: failed to save link.` })
    } finally { setLinkingRows(prev => { const n = new Set(prev); n.delete(clientId); return n }) }
  }

  async function handleBulkLinkApproved() {
    const entries = Object.entries(rowSelections).filter(([clientId, sel]) => {
      if (!sel.facebookPageId && !sel.instagramAccountId && !sel.adAccountId) return false
      const s = suggestions.find(s => s.client.id === clientId)
      if (!s) return true
      if (s.alreadyLinkedDifferently) return false
      if (s.alreadyLinkedSame) return false
      return true
    })
    if (entries.length === 0) { setLinkMsg({ ok: false, text: 'No rows with new selections to link.' }); return }
    const confirmed = window.confirm(`Link ${entries.length} client(s) with the selected assets? Existing different links will not be overwritten.`)
    if (!confirmed) return
    setBulkSaving(true); setLinkMsg(null)
    try {
      let linked = 0; let skipped = 0; let failed = 0
      for (const [clientId, sel] of entries) {
        const existing = linkedByClient.get(clientId)
        const overwriteNeeded = Boolean(existing && ((existing.facebook_page_id ?? '') !== (sel.facebookPageId || '') || (existing.instagram_account_id ?? '') !== (sel.instagramAccountId || '') || (existing.ad_account_id ?? '') !== (sel.adAccountId || '')))
        if (overwriteNeeded) { skipped++; continue }
        try {
          await saveAssetLinks({ action: 'upsert', link: buildLinkPayload({ clientId, page: pages.find(p => p.id === sel.facebookPageId) ?? null, instagram: igAccounts.find(a => a.id === sel.instagramAccountId) ?? null, adAccount: adAccounts.find(a => a.id === sel.adAccountId) ?? null }) })
          linked++
        } catch { failed++ }
      }
      setLinkMsg({ ok: true, text: `Bulk linking complete: ${linked} linked, ${skipped} skipped, ${failed} failed.` })
      await loadLinkedAssets()
    } catch { setLinkMsg({ ok: false, text: 'Bulk linking failed.' })
    } finally { setBulkSaving(false) }
  }

  function linkFromSelections(clientId: string): { pageId: string; igId: string; adId: string } {
    const sel = rowSelections[clientId] ?? { facebookPageId: '', instagramAccountId: '', adAccountId: '' }
    return { pageId: sel.facebookPageId, igId: sel.instagramAccountId, adId: sel.adAccountId }
  }

  const approvedCount = useMemo(() => {
    return Object.entries(rowSelections).filter(([clientId, sel]) => {
      if (!sel.facebookPageId && !sel.instagramAccountId && !sel.adAccountId) return false
      const s = suggestions.find(s => s.client.id === clientId)
      if (!s) return true
      if (s.alreadyLinkedDifferently) return false
      if (s.alreadyLinkedSame) return false
      return true
    }).length
  }, [rowSelections, suggestions])

  const needsCount = useMemo(() => suggestions.filter(s =>
    !s.alreadyLinkedSame || s.alreadyLinkedDifferently ||
    !s.currentLink?.facebook_page_id || !s.currentLink?.instagram_account_id ||
    (adAccounts.length > 0 && !s.currentLink?.ad_account_id) ||
    s.confidence === 'low' || s.confidence === 'medium' || s.confidence === 'none'
  ).length, [suggestions, adAccounts.length])

  const linkedCount = useMemo(() => suggestions.filter(s => s.alreadyLinkedSame && !s.alreadyLinkedDifferently).length, [suggestions])

  async function handleSync() {
    setSyncing(true); setSyncResult(null); setSyncProgress(null)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session?.access_token) {
        setSyncResult({ status: 'failed', message: 'Authentication required. Please sign in again before syncing.', phase: 'auth', debug: safeStringify({ error: sessionError?.message ?? 'No active session' }) }); return
      }
      const syncableAssets = linkedAssets.filter(a => a.facebook_page_id || a.instagram_account_id).filter(a => syncMode !== 'selected' || a.client_id === selectedSyncClientId)
      if (syncableAssets.length === 0) {
        setSyncResult({ status: 'skipped', message: 'No linked clients with a Facebook Page or Instagram account were found to sync.', clientsAttempted: 0, clientsSucceeded: 0, clientsSynced: 0, clientsFailed: 0, monthsAttempted: 0, reportsCreated: 0, reportsReused: 0, postsSynced: 0, warnings: [], steps: [] }); return
      }
      const targets = getCompletedMonths(syncMonthCount)
      const totals = { clientsAttempted: syncableAssets.length, clientsSucceeded: 0, clientsFailed: 0, reportsCreated: 0, reportsReused: 0, reportsUpdated: 0, postsSynced: 0 }
      const warnings: string[] = []; const failedClients: { name: string; error: string }[] = []; const succeededClients: { name: string; postsSynced: number }[] = []
      const steps: string[] = []; const diagnostics: unknown[] = []; const details: unknown[] = []
      let syncEngineVersion: string | undefined
      const accessToken = sessionData.session.access_token

      async function processAsset(asset: LinkedAsset, month: string) {
        const clientName = clientNameForAsset(asset)
        const reqBody: Record<string, unknown> = { mode: 'previous_completed_month', clientId: asset.client_id, month }
        const { response, data, text } = await invokeMetaSync(accessToken, reqBody)
        syncEngineVersion = typeof data?.syncEngineVersion === 'string' ? data.syncEngineVersion : syncEngineVersion
        diagnostics.push({ clientName, month, httpStatus: response.status, body: data ?? redactForDisplay(text).slice(0, 500) })
        if (!response.ok || !data?.ok) {
          const safeText = data ? null : redactForDisplay(text || 'No response body from sync service.').slice(0, 500)
          const phase = typeof data?.phase === 'string' ? data.phase : undefined
          const error = [phase ? `Phase: ${phase}.` : null, typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : safeText || 'Sync failed.', !response.ok ? `(HTTP ${response.status})` : null].filter(Boolean).join(' ')
          warnings.push(`${month} for ${clientName}: ${error}`); return
        }
        totals.reportsCreated += Number(data.reportsCreated ?? 0); totals.reportsReused += Number(data.reportsReused ?? data.reportsUpdated ?? 0)
        totals.reportsUpdated += Number(data.reportsUpdated ?? data.reportsReused ?? 0); totals.postsSynced += Number(data.postsSynced ?? 0)
        if (Array.isArray(data.warnings)) warnings.push(...data.warnings.map(String))
        if (Array.isArray(data.steps)) steps.push(...data.steps.map(String))
        if (Array.isArray(data.details)) details.push(...data.details)
        totals.clientsSucceeded += Number(data.clientsSucceeded ?? data.clientsSynced ?? 0); totals.clientsFailed += Number(data.clientsFailed ?? 0)
        if (Array.isArray(data.failedClients)) failedClients.push(...data.failedClients.map(item => { const r = item as { name?: unknown; error?: unknown }; return { name: String(r.name ?? clientName), error: String(r.error ?? 'Unknown error') } }))
        if (Array.isArray(data.succeededClients)) succeededClients.push(...data.succeededClients.map(item => { const r = item as { name?: unknown; postsSynced?: unknown }; return { name: String(r.name ?? clientName), postsSynced: Number(r.postsSynced ?? 0) } }))
      }

      let monthIdx = 0
      for (const month of targets) {
        monthIdx++
        for (let clientIdx = 0; clientIdx < syncableAssets.length; clientIdx++) {
          const asset = syncableAssets[clientIdx]
          setSyncProgress(`Syncing month ${monthIdx} of ${targets.length}, client ${clientIdx + 1} of ${syncableAssets.length}: ${clientNameForAsset(asset)}`)
          await processAsset(asset, month)
        }
      }
      await loadLinkedAssets()
      const status = totals.clientsSucceeded > 0 && totals.clientsFailed === 0 ? 'success' : totals.clientsSucceeded > 0 ? 'partial' : 'failed'
      setSyncResult({
        status, message: status === 'success' ? `Synced ${targets.length} month(s) for ${totals.clientsSucceeded} client(s).` : status === 'partial' ? `Sync completed with ${totals.clientsSucceeded} succeeded and ${totals.clientsFailed} failed across ${targets.length} month(s).` : `Sync failed for all ${totals.clientsAttempted} client(s).`,
        syncEngineVersion, monthsAttempted: targets.length, clientsAttempted: totals.clientsAttempted, clientsSucceeded: totals.clientsSucceeded, clientsSynced: totals.clientsSucceeded, clientsFailed: totals.clientsFailed,
        reportsCreated: totals.reportsCreated, reportsReused: totals.reportsReused, reportsUpdated: totals.reportsUpdated, postsSynced: totals.postsSynced, warnings, failedClients, succeededClients, steps, diagnostics, details,
        debug: safeStringify({ syncEngineVersion, monthsAttempted: targets.length, diagnostics, warnings, failedClients }),
      })
    } catch (e) {
      setSyncResult({ status: 'failed', message: redactForDisplay(e instanceof Error ? e.message : String(e)), phase: 'unknown', debug: safeStringify({ error: redactForDisplay(e instanceof Error ? e.message : String(e)) }) })
    } finally { setSyncProgress(null); setSyncing(false) }
  }

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.22em] text-brand-primary">Integrations</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Meta Business Sync</h1>
        <p className="mt-1 text-sm text-brand-primary">
          Connect Facebook and Instagram assets so reports can be built without CSV exports.
        </p>
      </div>

      {connectMsg && (
        <div className={`mt-6 max-w-2xl rounded-xl border p-5 ${connectState === 'connected' ? 'border-brand-accent/20 bg-brand-accent/10' : 'border-red-400/20 bg-red-400/10'}`}>
          <p className={`text-sm font-medium ${connectState === 'connected' ? 'text-brand-accent' : 'text-red-400'}`}>{connectMsg}</p>
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

      {/* Connection health */}
      <PremiumCard className="mt-6 max-w-4xl" padding="md">
        <PremiumCardHeader
          eyebrow="Readiness"
          title="Meta connection health"
          action={<StatusBadge label={connectionLoading ? 'Checking...' : connectState === 'connected' ? 'Connected' : 'Not connected'} variant={connectState === 'connected' ? 'published' : 'needs-strategy'} />}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <HealthTile label="Active clients" value={readiness.activeClients} active={readinessFilter === 'active'} onClick={() => setReadinessFilter(readinessFilter === 'active' ? 'none' : 'active')} />
          <HealthTile label="Linked to Meta" value={readiness.linkedAny} active={readinessFilter === 'linked'} onClick={() => setReadinessFilter(readinessFilter === 'linked' ? 'none' : 'linked')} />
          <HealthTile label="Missing Facebook" value={readiness.missingFacebook} tone={readiness.missingFacebook > 0 ? 'warn' : 'ok'} active={readinessFilter === 'missingFacebook'} onClick={() => setReadinessFilter(readinessFilter === 'missingFacebook' ? 'none' : 'missingFacebook')} />
          <HealthTile label="Missing Instagram" value={readiness.missingInstagram} tone={readiness.missingInstagram > 0 ? 'warn' : 'ok'} active={readinessFilter === 'missingInstagram'} onClick={() => setReadinessFilter(readinessFilter === 'missingInstagram' ? 'none' : 'missingInstagram')} />
          <HealthTile label="Missing Ad Account" value={readiness.missingAdAccount} tone={readiness.missingAdAccount > 0 ? 'warn' : 'ok'} active={readinessFilter === 'missingAdAccount'} onClick={() => setReadinessFilter(readinessFilter === 'missingAdAccount' ? 'none' : 'missingAdAccount')} />
          <HealthTile label="Last connected" value={formatDateTime(connectionInfo?.lastConnectedAt)} />
          <HealthTile label="OAuth state" value="Review: Confirm phase-4b SQL is applied in Supabase" tone={connectState === 'connected' ? 'neutral' : 'warn'} />
          <HealthTile label="Token encryption" value="Not production-ready" tone="warn" />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-brand-primary/70">
          OAuth state security is implemented in code. Confirm the prepared `phase-4b` SQL has been applied in the Supabase SQL editor. Tokens still live in a server-only table, but raw token storage remains a production-readiness risk until encryption is added.
        </p>
      </PremiumCard>

      {/* Readiness drilldown */}
      {filteredClientsForDrilldown && (
        <PremiumCard className="mt-4 max-w-4xl" padding="md">
          <PremiumCardHeader
            eyebrow="Drilldown"
            title={readinessFilter === 'active' ? 'All active clients' : readinessFilter === 'linked' ? 'Linked clients' : readinessFilter === 'missingFacebook' ? 'Clients missing Facebook Page' : readinessFilter === 'missingInstagram' ? 'Clients missing Instagram' : 'Clients missing Ad Account'}
            action={<button type="button" onClick={() => setReadinessFilter('none')} className="text-xs text-brand-accent hover:underline">Clear filter</button>}
          />
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-brand-primary/55">
              <tr className="border-b border-white/10"><th className="px-3 py-2">Client</th><th className="px-3 py-2">Facebook Page</th><th className="px-3 py-2">Instagram</th><th className="px-3 py-2">Ad Account</th><th className="px-3 py-2">Next action</th></tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {filteredClientsForDrilldown.map(({ client, reason }) => {
                const link = linkedByClient.get(client.id)
                return (
                  <tr key={client.id} className="align-top">
                    <td className="px-3 py-3 font-semibold text-white">{client.name}</td>
                    <td className="px-3 py-3 text-brand-primary/75">{link?.facebook_page_name ? <span className="text-brand-teal">{link.facebook_page_name}</span> : <span className="text-amber-300">Not linked</span>}</td>
                    <td className="px-3 py-3 text-brand-primary/75">{link?.instagram_username ? <span className="text-brand-teal">@{link.instagram_username}</span> : <span className="text-amber-300">Not linked</span>}</td>
                    <td className="px-3 py-3 text-brand-primary/75">{link?.ad_account_name ? <span className="text-brand-teal">{link.ad_account_name}</span> : <span className="text-amber-300">Not linked</span>}</td>
                    <td className="px-3 py-3 text-xs text-brand-primary/60">{reason || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </PremiumCard>
      )}

      {/* ── Steps 1–4 ── */}
      <div className="mt-6 space-y-4">

        {/* Step 1 */}
        <PremiumCard className="max-w-2xl">
          <PremiumCardHeader
            title={<span className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">1</span> Connect Meta</span>}
            action={<StatusBadge label={connectionLoading ? 'Checking...' : connectState === 'connected' ? 'Connected' : 'Not connected'} variant={connectState === 'connected' ? 'published' : 'needs-strategy'} />}
          />
          <p className="text-sm leading-relaxed text-brand-primary">Authorise CG Dynamics to access your Facebook Business assets.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ActionButton variant="outline" onClick={handleConnect}>{connectState === 'connected' ? 'Reconnect Meta' : 'Connect Meta'}</ActionButton>
          </div>
        </PremiumCard>

        {/* Step 2 — Link assets workspace (full width) */}
        <PremiumCard className="w-full">
          <PremiumCardHeader
            title={<span className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">2</span> Link assets to clients</span>}
            action={<StatusBadge label={connectionLoading ? 'Checking connection...' : connectState === 'connected' ? (assetsLoaded ? 'Meta assets loaded' : 'Ready') : 'Waiting for Meta connection'} variant={connectState === 'connected' ? (assetsLoaded ? 'published' : 'ready-to-publish') : 'internal-draft'} />}
          />

          {connectState === 'connected' && !assetsLoaded && (
            <>
              <p className="text-sm leading-relaxed text-brand-primary">Load Meta assets, review suggested matches, correct inline, and link approved clients.</p>
              <div className="mt-4"><ActionButton variant="outline" onClick={loadAssets} loading={loadingAssets}>{loadingAssets ? 'Loading...' : 'Load Meta assets'}</ActionButton></div>
            </>
          )}

          {assetError && <p className="mt-3 text-sm text-red-400">{assetError}</p>}
          {linkMsg && (
            <div className={`mt-4 rounded-xl border p-4 ${linkMsg.ok ? 'border-brand-accent/20 bg-brand-accent/10' : 'border-red-400/20 bg-red-400/10'}`}>
              <p className={`text-sm font-medium ${linkMsg.ok ? 'text-brand-accent' : 'text-red-400'}`}>{linkMsg.text}</p>
            </div>
          )}

          {assetsLoaded && (
            <div className="mt-4 space-y-4">

              {/* ── Alert banners (once, not per row) ── */}

              {pages.length === 0 && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4">
                  <p className="text-sm font-semibold text-amber-300">Meta returned 0 Facebook Pages</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-200/80">Existing linked assets are still shown, but new page matching needs Meta Page access. Possible causes:</p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-amber-200/70 space-y-0.5">
                    <li>The connected Meta user does not manage any Facebook Pages.</li>
                    <li>Missing or expired <code className="bg-amber-400/10 px-1 rounded">pages_show_list</code> permission.</li>
                    <li>The Meta access token needs reconnection.</li>
                    <li>Meta app review / permission issue.</li>
                  </ul>
                  {pagesDiagnostic && typeof pagesDiagnostic.status === 'string' && <p className="mt-2 text-xs text-amber-200/50">Meta API response: {pagesDiagnostic.status}</p>}
                  <div className="mt-3"><ActionButton variant="outline" size="sm" onClick={handleConnect}>Reconnect Meta</ActionButton></div>
                </div>
              )}

              {igAccounts.length === 0 && pages.length > 0 && (
                <div className="rounded-xl border border-brand-muted bg-brand-bg/40 p-3">
                  <p className="text-xs text-brand-primary/70">No Instagram Business accounts found. Instagram accounts must be linked to a Facebook Page as a Business account. Verify each Page has an Instagram Business account connected in Meta Business Suite.</p>
                </div>
              )}

              {adAccounts.length === 0 && (
                <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.04] p-3">
                  <p className="text-xs leading-relaxed text-brand-primary/70">
                    <span className="font-semibold text-amber-200/90">Ad accounts not loaded.</span> Facebook and Instagram sync can still work without ad accounts. Ad accounts are mainly needed for paid/boosted reporting later. The connected Meta user may lack Business Manager or ad account permissions.
                    {adAccountsDiagnostic && typeof adAccountsDiagnostic.status === 'string' && <span className="block mt-1 text-brand-primary/40">Meta response: {adAccountsDiagnostic.status}</span>}
                  </p>
                </div>
              )}

              {/* ── Filter tabs ── */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1 rounded-lg border border-brand-muted bg-brand-bg p-0.5">
                  <ActionButton variant={tableFilter === 'needs' ? 'primary' : 'ghost'} size="sm" onClick={() => setTableFilter('needs')}>Needs linking / review ({needsCount})</ActionButton>
                  <ActionButton variant={tableFilter === 'linked' ? 'primary' : 'ghost'} size="sm" onClick={() => setTableFilter('linked')}>Already linked ({linkedCount})</ActionButton>
                  <ActionButton variant={tableFilter === 'all' ? 'primary' : 'ghost'} size="sm" onClick={() => setTableFilter('all')}>All active clients ({suggestions.length})</ActionButton>
                </div>
                <ActionButton variant="primary" onClick={handleBulkLinkApproved} disabled={approvedCount === 0 || bulkSaving || tableFilter === 'linked'} loading={bulkSaving}>
                  Link approved rows ({approvedCount})
                </ActionButton>
              </div>

              {/* ── Client queue (compact list + expandable detail) ── */}
              <div className="space-y-2">
                {filteredSuggestions.length === 0 ? (
                  <div className="rounded-xl border border-brand-muted bg-brand-bg/30 p-8 text-center text-sm text-brand-primary/50">
                    {tableFilter === 'needs' && 'All clients are linked. No items need review.'}
                    {tableFilter === 'linked' && 'No clients with complete active Meta links yet.'}
                    {tableFilter === 'all' && 'No active clients to display.'}
                  </div>
                ) : (
                  filteredSuggestions.map(suggestion => {
                    const clientId = suggestion.client.id
                    const sel = linkFromSelections(clientId)
                    const hasAny = Boolean(sel.pageId || sel.igId || sel.adId)
                    const isExpanded = expandedClientId === clientId

                    return (
                      <div key={clientId} className="rounded-xl border border-brand-muted bg-brand-bg/40 overflow-hidden">
                        {/* ── Compact row (always visible) ── */}
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                          onClick={() => setExpandedClientId(isExpanded ? null : clientId)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpandedClientId(isExpanded ? null : clientId) }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{suggestion.client.name}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                              <span className="text-xs text-brand-primary/60">{suggestion.alreadyLinkedSame ? 'Linked' : 'Not linked'}</span>
                              {suggestion.currentLink?.facebook_page_name && <span className="text-xs text-brand-primary/50">FB: {suggestion.currentLink.facebook_page_name}</span>}
                              {suggestion.currentLink?.instagram_username && <span className="text-xs text-brand-primary/50">IG: @{suggestion.currentLink.instagram_username}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <ConfidencePill confidence={suggestion.confidence} />
                            {suggestion.alreadyLinkedDifferently && <span className="text-[10px] font-bold uppercase tracking-wide text-amber-400">Differs</span>}
                            <svg className={`w-4 h-4 text-brand-primary/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </div>

                        {/* ── Expanded detail panel ── */}
                        {isExpanded && (
                          <div className="border-t border-white/10 px-4 py-4 space-y-4 bg-white/[0.02]">
                            <div className="grid gap-4 sm:grid-cols-3">
                              {/* Facebook Page picker */}
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-brand-primary/60 mb-1">Facebook Page</label>
                                <SearchablePicker
                                  value={sel.pageId}
                                  onChange={v => updateRowSelection(clientId, 'facebookPageId', v)}
                                  options={pagePickerOptions}
                                  placeholder={pagePickerOptions.length === 0 ? 'No pages' : 'Select page...'}
                                  emptyLabel={pagePickerOptions.length === 0 ? 'No pages available' : 'No matching pages'}
                                />
                              </div>

                              {/* Instagram picker */}
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-brand-primary/60 mb-1">Instagram Account</label>
                                <SearchablePicker
                                  value={sel.igId}
                                  onChange={v => updateRowSelection(clientId, 'instagramAccountId', v)}
                                  options={igOptionsForPage(sel.pageId || suggestion.currentLink?.facebook_page_id)}
                                  placeholder={igAccounts.length === 0 ? 'No IG accounts' : 'Select Instagram...'}
                                  emptyLabel={sel.pageId ? 'No IG for this page' : 'Select a page first'}
                                />
                              </div>

                              {/* Ad Account picker */}
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-brand-primary/60 mb-1">Ad Account</label>
                                {adPickerOptions.length > 0 ? (
                                  <SearchablePicker
                                    value={sel.adId}
                                    onChange={v => updateRowSelection(clientId, 'adAccountId', v)}
                                    options={adPickerOptions}
                                    placeholder="Select ad account..."
                                    emptyLabel="No ad accounts"
                                  />
                                ) : (
                                  <p className="text-xs text-brand-primary/50 leading-relaxed pt-1">Ad accounts not available. Facebook &amp; Instagram sync can still work without them.</p>
                                )}
                              </div>
                            </div>

                            {/* Match info + Current link + Action */}
                            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                              <div className="min-w-0 flex-1 space-y-1">
                                <p className="text-xs text-brand-primary/70">
                                  <span className="font-semibold text-white">Match:</span> {suggestion.reason}
                                </p>
                                {suggestion.currentLink ? (
                                  <div className="text-xs text-brand-primary/60">
                                    <span className="font-semibold text-white">Current link:</span>
                                    <span className="ml-1">{suggestion.currentLink.facebook_page_name || 'No FB Page'}{suggestion.currentLink.instagram_username ? `, @${suggestion.currentLink.instagram_username}` : ''}{suggestion.currentLink.ad_account_name ? `, ${suggestion.currentLink.ad_account_name}` : ''}</span>
                                    {suggestion.alreadyLinkedDifferently && <span className="block mt-0.5 text-amber-400">This differs from the suggested match. Overwrite if confirmed.</span>}
                                  </div>
                                ) : <p className="text-xs text-brand-primary/60">Not linked yet</p>}
                              </div>
                              <ActionButton
                                variant="primary"
                                size="sm"
                                onClick={() => handleRowLink(clientId)}
                                disabled={!hasAny || suggestion.alreadyLinkedSame || linkingRows.has(clientId)}
                                loading={linkingRows.has(clientId)}
                              >
                                {suggestion.alreadyLinkedSame ? 'Already linked' : 'Link this client'}
                              </ActionButton>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Manual override (demoted fallback) */}
              <details className="rounded-xl border border-brand-muted bg-brand-bg/35 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-white">Manual override for edge cases</summary>
                <div className="mt-4 space-y-4 max-w-lg">
                  <div className="grid gap-1 md:grid-cols-[140px_minmax(0,1fr)] md:items-center md:gap-3">
                    <span className="text-sm text-brand-primary">CG Client</span>
                    <SearchablePicker value={selectedClientId} onChange={setSelectedClientId} options={sortedClientOptions} placeholder="Select a client..." />
                  </div>
                  <div className="grid gap-1 md:grid-cols-[140px_minmax(0,1fr)] md:items-center md:gap-3">
                    <span className="text-sm text-brand-primary">Facebook Page</span>
                    <SearchablePicker value={selectedPageId} onChange={v => { setSelectedPageId(v); setSelectedIgId('') }} options={pagePickerOptions} placeholder="Select a page..." emptyLabel="No pages found" />
                  </div>
                  <div className="grid gap-1 md:grid-cols-[140px_minmax(0,1fr)] md:items-center md:gap-3">
                    <span className="text-sm text-brand-primary">Instagram</span>
                    <SearchablePicker value={selectedIgId} onChange={setSelectedIgId} options={igOptionsForPage(selectedPageId)} placeholder={igAccounts.length === 0 ? 'No Instagram accounts found' : 'Select an account...'} emptyLabel={selectedPageId ? 'No Instagram linked to this page' : 'Select a Facebook Page first'} />
                  </div>
                  <div className="grid gap-1 md:grid-cols-[140px_minmax(0,1fr)] md:items-center md:gap-3">
                    <span className="text-sm text-brand-primary">Ad Account</span>
                    {adPickerOptions.length > 0 ? <SearchablePicker value={selectedAdId} onChange={setSelectedAdId} options={adPickerOptions} placeholder="Select an ad account (optional)..." /> : <p className="text-sm text-brand-primary/60">{adAccountsError || 'No ad accounts available.'}</p>}
                  </div>
                  <div className="pt-1"><ActionButton variant="secondary" onClick={handleSaveLink} disabled={saving || !selectedClientId || (!selectedPageId && !selectedIgId && !selectedAdId)} loading={saving}>{saving ? 'Saving...' : 'Save manual link'}</ActionButton></div>
                </div>
              </details>
            </div>
          )}
        </PremiumCard>

        {/* Step 3 — Sync */}
        <PremiumCard className="max-w-2xl">
          <PremiumCardHeader
            title={<span className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">3</span> Sync report data</span>}
            action={<StatusBadge label={linkedAssets.length > 0 ? 'Ready' : 'Waiting for linked assets'} variant={linkedAssets.length > 0 ? 'ready-to-publish' : 'internal-draft'} />}
          />
          {!syncResult && (
            <div className="space-y-2 text-sm leading-relaxed text-brand-primary">
              <p>Sync completed months from linked Meta assets. Reports are saved as internal drafts.</p>
              <div className="rounded-lg border border-brand-muted bg-brand-bg/60 px-3 py-2.5">
                <p className="text-xs text-brand-primary"><span className="font-semibold text-white">Selected client</span> for quick updates between campaigns.</p>
                <p className="mt-1 text-xs text-brand-primary"><span className="font-semibold text-white">All linked clients</span> for month-end reporting across every client.</p>
              </div>
            </div>
          )}
          {syncProgress && <p className="mt-3 rounded-lg border border-brand-accent/20 bg-brand-accent/10 px-3 py-2 text-sm font-medium text-brand-accent">{syncProgress}</p>}
          {syncResult && (
            <div className={`mt-3 rounded-xl border p-4 ${syncResult.status === 'failed' ? 'border-red-400/20 bg-red-400/10' : 'border-brand-accent/20 bg-brand-accent/10'}`}>
              <p className={`text-sm font-medium ${syncResult.status === 'failed' ? 'text-red-400' : 'text-brand-accent'}`}>{syncResult.message}</p>
              {syncResult.status !== 'skipped' && (
                <ul className="mt-2 space-y-1 text-sm text-brand-primary">
                  {syncResult.phase && <li>Failed phase: {syncResult.phase}</li>}
                  {syncResult.syncEngineVersion && <li>Sync engine: {syncResult.syncEngineVersion}</li>}
                  <li>Months attempted: {syncResult.monthsAttempted ?? 0}</li>
                  <li>Clients succeeded: {syncResult.clientsSucceeded ?? syncResult.clientsSynced ?? 0}{syncResult.clientsAttempted !== undefined ? ` of ${syncResult.clientsAttempted}` : ''}</li>
                  {syncResult.clientsFailed !== undefined && syncResult.clientsFailed > 0 && <li className="text-amber-400">Clients failed: {syncResult.clientsFailed}</li>}
                  <li>Reports created: {syncResult.reportsCreated ?? 0}</li>
                  <li>Reports reused: {syncResult.reportsReused ?? syncResult.reportsUpdated ?? 0}</li>
                  <li>Posts synced: {syncResult.postsSynced ?? 0}</li>
                  {syncResult.warnings && syncResult.warnings.length > 0 && <li className="text-amber-400">Warnings: {syncResult.warnings.length}</li>}
                </ul>
              )}
              {syncResult.failedClients && syncResult.failedClients.length > 0 && (
                <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-300">Failed clients</p>
                  <ul className="mt-2 space-y-1.5 text-xs text-brand-primary">
                    {syncResult.failedClients.map(fc => <li key={fc.name}><span className="font-medium text-white">{fc.name}:</span> <span className="text-red-300">{fc.error}</span></li>)}
                  </ul>
                </div>
              )}
              {(syncResult.debug || (syncResult.steps && syncResult.steps.length > 0)) && (
                <details className="mt-3 rounded-lg border border-brand-muted bg-brand-bg/50 p-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-brand-primary">Diagnostics (staff only)</summary>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <CopyButton getPayload={() => ({ syncEngineVersion: syncResult.syncEngineVersion, status: syncResult.status, message: syncResult.message, monthsAttempted: syncResult.monthsAttempted, clientsAttempted: syncResult.clientsAttempted, clientsSucceeded: syncResult.clientsSucceeded, clientsFailed: syncResult.clientsFailed, reportsCreated: syncResult.reportsCreated, reportsReused: syncResult.reportsReused, reportsUpdated: syncResult.reportsUpdated, postsSynced: syncResult.postsSynced, warnings: syncResult.warnings, failedClients: syncResult.failedClients, succeededClients: syncResult.succeededClients, steps: syncResult.steps, diagnostics: syncResult.diagnostics, details: syncResult.details })} />
                  </div>
                  {syncResult.steps && syncResult.steps.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-brand-primary/70">Steps</p>
                      <ol className="mt-1 space-y-0.5 text-xs text-brand-primary">{syncResult.steps.map((s, i) => <li key={i}>{i + 1}. {s}</li>)}</ol>
                    </div>
                  )}
                  {syncResult.debug && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-2 text-[11px] leading-relaxed text-brand-primary">{syncResult.debug}</pre>}
                </details>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {syncResult.status !== 'failed' && <ActionButton variant="primary" onClick={() => window.location.href = '/admin/client-dashboard'}>Open Client Dashboard</ActionButton>}
                <ActionButton variant="secondary" onClick={() => setSyncResult(null)}>Dismiss</ActionButton>
              </div>
            </div>
          )}
          {!syncResult && (
            <div className="mt-4 space-y-4">
              <div className="flex gap-1 rounded-lg border border-brand-muted bg-brand-bg p-0.5 w-fit">
                <ActionButton variant={syncMode === 'all' ? 'primary' : 'ghost'} size="sm" onClick={() => setSyncMode('all')}>All linked clients</ActionButton>
                <ActionButton variant={syncMode === 'selected' ? 'primary' : 'ghost'} size="sm" onClick={() => setSyncMode('selected')}>Selected client</ActionButton>
              </div>
              {syncMode === 'selected' && (
                <div className="max-w-xs">
                  <SearchablePicker value={selectedSyncClientId} onChange={setSelectedSyncClientId} options={linkedAssets.filter(a => a.facebook_page_id || a.instagram_account_id).map(a => ({ value: a.client_id, label: clientNameForAsset(a) })).sort((a, b) => a.label.localeCompare(b.label))} placeholder="Search and select a client..." emptyLabel="No linked clients with sync-ready assets" />
                </div>
              )}
              <div className="max-w-xs">
                <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-brand-primary/70 mb-1.5">Completed months to sync</label>
                <select value={syncMonthCount} onChange={e => setSyncMonthCount(Number(e.target.value))} className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent">
                  {SYNC_RANGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <p className="mt-1 text-xs text-brand-primary/50">Syncing 3 completed months (default) provides history for month-over-month growth comparisons.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ActionButton variant="outline" onClick={handleSync} disabled={syncing || linkedAssets.length === 0 || (syncMode === 'selected' && !selectedSyncClientId)} loading={syncing}>
                  {syncing ? 'Syncing...' : syncMode === 'selected' ? `Sync selected client (${syncMonthCount} month${syncMonthCount > 1 ? 's' : ''})` : `Sync all linked clients (${syncMonthCount} month${syncMonthCount > 1 ? 's' : ''})`}
                </ActionButton>
              </div>
            </div>
          )}
        </PremiumCard>

        {/* Step 4 */}
        <PremiumCard className="max-w-2xl">
          <PremiumCardHeader title={<span className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">4</span> Review monthly draft</span>} />
          <p className="text-sm leading-relaxed text-brand-primary">After sync, CG Dynamics will create or update monthly report drafts. Staff can add strategy, preview as client, and publish.</p>
        </PremiumCard>
      </div>

      {/* Linked clients section */}
      <PremiumCard className="mt-8" padding="md">
        <PremiumCardHeader title="Linked clients" />
        {loadingLinked ? <p className="text-sm text-brand-primary">Loading linked clients...</p> : linkedAssets.length === 0 ? <p className="text-sm text-brand-primary">No clients linked yet. Load Meta assets above and save a link.</p> : (
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
                  <ActionButton variant="danger" size="sm" onClick={() => handleDeactivate(asset)}>Deactivate</ActionButton>
                </div>
              )
            })}
          </div>
        )}
      </PremiumCard>

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
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.12em] ${styles[confidence]}`}>{label}</span>
}

function HealthTile({ label, value, tone = 'neutral', active = false, onClick }: {
  label: string; value: string | number; tone?: 'neutral' | 'ok' | 'warn'; active?: boolean; onClick?: () => void
}) {
  const toneClass = { neutral: 'border-white/8 bg-white/[0.03] text-white', ok: 'border-brand-teal/20 bg-brand-teal/[0.06] text-[#66d0c3]', warn: 'border-amber-300/20 bg-amber-300/[0.06] text-amber-200' }[tone]
  const activeClass = active ? 'ring-2 ring-brand-accent' : ''
  const clickableClass = onClick ? 'cursor-pointer hover:bg-white/[0.06] transition-colors' : ''
  return (
    <div className={`rounded-xl border p-3 ${toneClass} ${activeClass} ${clickableClass}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}>
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-brand-primary/55">{label}</p>
      <p className="mt-2 text-sm font-bold">{value}</p>
    </div>
  )
}
