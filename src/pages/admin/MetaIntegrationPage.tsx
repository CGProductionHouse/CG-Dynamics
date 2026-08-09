import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { listClients, type Client } from '../../lib/db/clients'
import { PremiumCard, PremiumCardHeader } from '../../components/ui/PremiumCard'
import { StatusBadge } from '../../components/ui/Badges'
import { ActionButton } from '../../components/ui/Buttons'
import {
  groupMetaFailuresByClient,
  summariseMetaTerminalResult,
  type MetaFailureGroup,
} from '../../lib/metaSyncFailures'

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
  instagram_not_applicable: boolean
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
  instagramNotApplicable: boolean
}

interface ConnectionInfo {
  lastConnectedAt: string | null
  metaBusinessName: string | null
  grantedScopes: string[]
  schemaReady: boolean
  tokenEncryptedAtRest: boolean
  lastVerifiedInsight: {
    platform: string
    periodMonth: string
    healthState: string
    finishedAt: string | null
  } | null
}

type ReadinessFilter = 'none' | 'active' | 'linked' | 'missingFacebook' | 'missingInstagram' | 'missingAdAccount' | 'noInstagram'

type TableFilter = 'needs' | 'missingFacebook' | 'missingInstagram' | 'facebookOnly' | 'instagramOnly' | 'both' | 'noInstagram' | 'linked' | 'all'

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
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Row-level selections for inline editing
  const [rowSelections, setRowSelections] = useState<Record<string, { facebookPageId: string; instagramAccountId: string; adAccountId: string; instagramNotApplicable: boolean }>>({})
  const [linkingRows, setLinkingRows] = useState<Set<string>>(new Set())

  // Readiness drilldown
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>('none')

  // Table filter tabs
  const [tableFilter, setTableFilter] = useState<TableFilter>('needs')
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
    // Client-month rows vs unique clients — kept separate on purpose.
    itemsAttempted?: number
    itemsSucceeded?: number
    itemsFailed?: number
    /** Failures grouped by client, classified, with raw text kept for detail. */
    failureGroups?: MetaFailureGroup[]
    /** The batch these failures belong to, so retry targets it directly. */
    batchId?: string
    steps?: string[]
    diagnostics?: unknown[]
    details?: unknown[]
    debug?: string
    reportId?: string
  } | null>(null)

  const [retryingFailed, setRetryingFailed] = useState(false)

  // Background sync (queue-based). Counts are derived live from the child
  // meta_sync_batch_items rows so progress moves even while the parent batch
  // counters are only recalculated between worker chunks.
  const [batch, setBatch] = useState<{
    id: string
    status: string
    total_items: number
    completed_items: number
    failed_items: number
    running_items: number
    queued_items: number
  } | null>(null)
  const [batchStalled, setBatchStalled] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stallRef = useRef(0)
  const retryWorkerRef = useRef(false)
  // Signature of the last observed child-item state — ANY movement resets stall.
  const lastProgressSigRef = useRef('')

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

  // Legacy blocking sync fallback (used when queue tables do not exist)
  async function handleSyncLegacy() {
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
          clientsAttempted: 0, clientsSucceeded: 0, clientsSynced: 0, clientsFailed: 0,
          monthsAttempted: 0, reportsCreated: 0, reportsReused: 0, postsSynced: 0, warnings: [], steps: [],
        })
        return
      }

      const targets = getCompletedMonths(syncMonthCount)
      const totals = { clientsAttempted: syncableAssets.length, clientsSucceeded: 0, clientsFailed: 0, reportsCreated: 0, reportsReused: 0, reportsUpdated: 0, postsSynced: 0 }
      const warnings: string[] = []
      const failedClients: { name: string; error: string }[] = []
      const succeededClients: { name: string; postsSynced: number }[] = []
      const steps: string[] = []
      const diagnostics: unknown[] = []
      const details: unknown[] = []
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
          warnings.push(`${month} for ${clientName}: ${error}`)
          return
        }
        totals.reportsCreated += Number(data.reportsCreated ?? 0)
        totals.reportsReused += Number(data.reportsReused ?? data.reportsUpdated ?? 0)
        totals.reportsUpdated += Number(data.reportsUpdated ?? data.reportsReused ?? 0)
        totals.postsSynced += Number(data.postsSynced ?? 0)
        if (Array.isArray(data.warnings)) warnings.push(...data.warnings.map(String))
        if (Array.isArray(data.steps)) steps.push(...data.steps.map(String))
        if (Array.isArray(data.details)) details.push(...data.details)
        totals.clientsSucceeded += Number(data.clientsSucceeded ?? data.clientsSynced ?? 0)
        totals.clientsFailed += Number(data.clientsFailed ?? 0)
        if (Array.isArray(data.failedClients)) failedClients.push(...data.failedClients.map(item => {
          const row = item as { name?: unknown; error?: unknown }
          return { name: String(row.name ?? clientName), error: String(row.error ?? 'Unknown error') }
        }))
        if (Array.isArray(data.succeededClients)) succeededClients.push(...data.succeededClients.map(item => {
          const row = item as { name?: unknown; postsSynced?: unknown }
          return { name: String(row.name ?? clientName), postsSynced: Number(row.postsSynced ?? 0) }
        }))
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
        status, monthsAttempted: targets.length, syncEngineVersion,
        message: status === 'success'
          ? `Synced ${syncableAssets.length} client${syncableAssets.length !== 1 ? 's' : ''} × ${targets.length} month${targets.length !== 1 ? 's' : ''} (${syncableAssets.length * targets.length} item${syncableAssets.length * targets.length !== 1 ? 's' : ''}).`
          : status === 'partial'
            ? `Sync completed with ${totals.clientsSucceeded} succeeded and ${totals.clientsFailed} failed across ${syncableAssets.length} client${syncableAssets.length !== 1 ? 's' : ''}, ${targets.length} month${targets.length !== 1 ? 's' : ''}.`
            : `Sync failed for all ${syncableAssets.length * targets.length} item${syncableAssets.length * targets.length !== 1 ? 's' : ''}.`,
        clientsAttempted: totals.clientsAttempted, clientsSucceeded: totals.clientsSucceeded, clientsSynced: totals.clientsSucceeded, clientsFailed: totals.clientsFailed,
        reportsCreated: totals.reportsCreated, reportsReused: totals.reportsReused, reportsUpdated: totals.reportsUpdated, postsSynced: totals.postsSynced,
        warnings, failedClients, succeededClients, steps, diagnostics, details,
        debug: safeStringify({ syncEngineVersion, monthsAttempted: targets.length, diagnostics, warnings, failedClients }),
      })
    } catch (e) {
      setSyncResult({ status: 'failed', message: redactForDisplay(e instanceof Error ? e.message : String(e)), phase: 'unknown', debug: safeStringify({ error: redactForDisplay(e instanceof Error ? e.message : String(e)) }) })
    } finally {
      setSyncProgress(null)
      setSyncing(false)
    }
  }

  // Retry only the failed items that a retry can actually fix, on the EXISTING
  // batch. The RPC enforces the same rule server-side: it requeues failed
  // retryable rows, resets only the platform stage that failed (so collected
  // posts are kept and not re-fetched), never touches successful items, and
  // never creates a batch. The per-minute reaper then drains it.
  async function retryFailedItems(batchIdValue: string, itemIds: string[]) {
    if (retryingFailed) return
    setRetryingFailed(true)
    try {
      const { data, error } = await supabase.rpc('meta_sync_retry_failed_items', {
        p_batch_id: batchIdValue,
        p_item_ids: itemIds.length > 0 ? itemIds : null,
      })
      if (error || !data?.ok) {
        setSyncResult(current => current ? {
          ...current,
          message: (data?.error as string) ?? error?.message ?? 'Could not retry the failed items.',
        } : current)
        return
      }
      // Re-adopt the reopened batch so progress is visible again, and let the
      // existing completion path recalculate every counter from the items.
      localStorage.setItem('cg_meta_active_sync_batch_id', batchIdValue)
      setSyncResult(null)
      setSyncing(true)
      setSyncProgress(`Retrying ${data.requeued} failed item${data.requeued === 1 ? '' : 's'}...`)
      setBatchStalled(false)
      stallRef.current = 0
      lastProgressSigRef.current = ''
      startPolling(batchIdValue)
    } finally {
      setRetryingFailed(false)
    }
  }

  async function handleBatchComplete(batchIdValue: string) {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
    setBatch(null)
    setBatchStalled(false)
    localStorage.removeItem('cg_meta_active_sync_batch_id')

    const { data: items } = await supabase
      .from('meta_sync_batch_items')
      .select('id, client_id, status, client_name, month, posts_synced, reports_created, reports_reused, error, warnings, attempts, facebook_sync_state, instagram_sync_state')
      .eq('batch_id', batchIdValue)
    const itemList = (items ?? []) as Array<{ id: string; client_id: string; status: string; client_name: string; month: string; posts_synced: number; reports_created: number; reports_reused: number; error?: string | null; warnings?: unknown; attempts?: number; facebook_sync_state?: string; instagram_sync_state?: string }>

    const uniqueClientNames = new Set(itemList.map(it => it.client_name))
    const uniqueMonths = new Set(itemList.map(it => it.month))
    const uniqueClients = uniqueClientNames.size
    const monthCount = uniqueMonths.size
    const totalItems = itemList.length

    // Items and clients are DIFFERENT units. Production showed
    // "Clients succeeded: 67 of 74" beside "across 37 clients" — 74 is
    // client-month rows, 37 is clients. summariseMetaTerminalResult keeps them
    // apart and counts a client as failed if any of its months failed.
    const terminal = summariseMetaTerminalResult(itemList.map(it => ({
      clientId: it.client_id, clientName: it.client_name, month: it.month, status: it.status,
      postsSynced: it.posts_synced, reportsCreated: it.reports_created, reportsReused: it.reports_reused,
    })))
    const totals = {
      clientsSucceeded: terminal.clientsSucceeded,
      clientsFailed: terminal.clientsFailed,
      postsSynced: terminal.postsSynced,
      reportsCreated: terminal.reportsCreated,
      reportsReused: terminal.reportsReused,
    }
    const succeededClients: { name: string; postsSynced: number }[] = itemList
      .filter(it => it.status === 'completed' || it.status === 'warning')
      .map(it => ({ name: it.client_name, postsSynced: it.posts_synced ?? 0 }))
    // Grouped by client with affected months, classified, raw text kept for the
    // expandable detail rather than shown inline.
    const failureGroups = groupMetaFailuresByClient(itemList
      .filter(it => it.status === 'failed')
      .map(it => ({
        id: it.id, clientId: it.client_id, clientName: it.client_name, month: it.month,
        error: it.error ?? null, warnings: Array.isArray(it.warnings) ? it.warnings.filter((w): w is string => typeof w === 'string') : [],
        facebookState: it.facebook_sync_state ?? 'pending', instagramState: it.instagram_sync_state ?? 'pending',
        postsSynced: it.posts_synced ?? 0, attempts: it.attempts ?? 0,
      })))
    const failedClients = failureGroups.map(group => ({ name: group.clientName, error: group.headline }))
    const status = terminal.itemsSucceeded > 0 && terminal.itemsFailed === 0 ? 'success' : terminal.itemsSucceeded > 0 ? 'partial' : 'failed'

    let message: string
    if (status === 'success') {
      message = uniqueClients > 1 || monthCount > 1
        ? `Synced ${uniqueClients} client${uniqueClients !== 1 ? 's' : ''} × ${monthCount} month${monthCount !== 1 ? 's' : ''} (${totalItems} item${totalItems !== 1 ? 's' : ''}).`
        : `Synced 1 item.`
    } else if (status === 'partial') {
      message = `${terminal.itemsSucceeded} of ${terminal.itemsAttempted} client-month items synced. ${terminal.clientsFailed} of ${terminal.clientsAttempted} client${terminal.clientsAttempted !== 1 ? 's' : ''} need attention across ${monthCount} month${monthCount !== 1 ? 's' : ''}.`
    } else {
      message = `Sync failed for all ${totalItems} item${totalItems !== 1 ? 's' : ''}.`
    }

    setSyncResult({
      status,
      monthsAttempted: terminal.monthsCovered,
      itemsAttempted: terminal.itemsAttempted,
      itemsSucceeded: terminal.itemsSucceeded,
      itemsFailed: terminal.itemsFailed,
      clientsAttempted: terminal.clientsAttempted,
      clientsSucceeded: totals.clientsSucceeded, clientsSynced: totals.clientsSucceeded,
      clientsFailed: totals.clientsFailed,
      failureGroups,
      batchId: batchIdValue,
      reportsCreated: totals.reportsCreated, reportsReused: totals.reportsReused,
      postsSynced: totals.postsSynced,
      message,
      warnings: itemList.filter(it => it.status === 'warning').map(it => `${it.month} for ${it.client_name}: completed with warnings`),
      succeededClients, failedClients,
    })
    await loadLinkedAssets()
    setSyncing(false)
    setSyncProgress(null)
  }

  async function startPolling(batchIdValue: string) {
    const timer = setInterval(async () => {
      // Child items are the live source of truth: the worker updates each item
      // as it finishes, while the parent counters may lag a chunk behind.
      const [{ data: batchData }, { data: itemRows }] = await Promise.all([
        supabase
          .from('meta_sync_batches')
          .select('id, status, total_items, completed_items, failed_items')
          .eq('id', batchIdValue)
          .single(),
        supabase
          .from('meta_sync_batch_items')
          .select('status, started_at')
          .eq('batch_id', batchIdValue),
      ])

      const rows = (itemRows ?? []) as Array<{ status: string; started_at: string | null }>
      const doneCount = rows.filter(r => r.status === 'completed' || r.status === 'warning' || r.status === 'skipped').length
      const failedCount = rows.filter(r => r.status === 'failed').length
      const runningCount = rows.filter(r => r.status === 'running').length
      const queuedCount = rows.filter(r => r.status === 'queued').length
      const staleBefore = Date.now() - 5 * 60 * 1000
      const staleRunningCount = rows.filter(row =>
        row.status === 'running'
        && !!row.started_at
        && new Date(row.started_at).getTime() < staleBefore
      ).length
      const totalCount = rows.length > 0 ? rows.length : Number(batchData?.total_items ?? 0)

      setBatch({
        id: batchIdValue,
        status: String(batchData?.status ?? 'running'),
        total_items: totalCount,
        completed_items: rows.length > 0 ? doneCount : Number(batchData?.completed_items ?? 0),
        failed_items: rows.length > 0 ? failedCount : Number(batchData?.failed_items ?? 0),
        running_items: runningCount,
        queued_items: queuedCount,
      })

      // Restoration is finished the moment we have real counts — replace the
      // "Restoring sync progress..." placeholder with live status. It used to
      // be set once and never cleared, so an interrupted batch appeared to be
      // restoring forever even while it was plainly progressing (or dead).
      if (batchData) {
        setSyncProgress(
          totalCount > 0
            ? `Syncing ${doneCount + failedCount} of ${totalCount} — ${runningCount} running, ${queuedCount} queued.`
            : 'Syncing...',
        )
      }

      // Stall detection: ANY child movement (done/failed/running/queued shifts)
      // counts as progress. "Stuck" only shows after ~25s with zero movement
      // AND nothing actively running.
      const progressSig = `${doneCount}|${failedCount}|${runningCount}|${queuedCount}`
      if (progressSig !== lastProgressSigRef.current) {
        lastProgressSigRef.current = progressSig
        stallRef.current = 0
        setBatchStalled(false)
      } else if (batchData?.status === 'queued' || batchData?.status === 'running') {
        stallRef.current++
        if (
          stallRef.current >= 10
          && (runningCount === 0 || staleRunningCount === runningCount)
        ) setBatchStalled(true)
      }

      const parentFinished = batchData?.status === 'completed' || batchData?.status === 'failed'
      // Self-heal: if every child is terminal but the parent recalc was missed,
      // finish anyway instead of appearing stuck at 100%.
      const childrenFinished = rows.length > 0 && queuedCount === 0 && runningCount === 0
      if (parentFinished || childrenFinished) {
        await handleBatchComplete(batchIdValue)
      }
    }, 2500)
    pollRef.current = timer
  }

  async function handleRetryWorker() {
    if (!batch?.id || retryWorkerRef.current) return
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      setSyncResult({ status: 'failed', message: 'Missing Supabase frontend environment variables.', phase: 'config', debug: safeStringify({}) })
      return
    }

    retryWorkerRef.current = true
    setBatchStalled(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setSyncResult({ status: 'failed', message: 'Authentication required. Please sign in again before retrying the worker.', phase: 'auth' })
        return
      }
      const response = await fetch(`${SUPABASE_URL}/functions/v1/meta-sync-worker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          apikey: SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ batchId: batch.id }),
      })

      const text = await response.text()
      let data: SyncResponse | null = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = null
      }

      if (!response.ok || data?.ok === false) {
        const detail = typeof data?.error === 'string'
          ? data.error
          : typeof data?.message === 'string'
            ? data.message
            : text ? redactForDisplay(text).slice(0, 500) : 'No response body from worker.'
        setSyncResult({
          status: 'failed',
          message: `Worker restart failed: ${detail}`,
          phase: 'worker',
          debug: safeStringify({ httpStatus: response.status, body: data ?? redactForDisplay(text).slice(0, 500) }),
        })
        return
      }

      // Confirm a worker ACTUALLY ran. A 200 alone is not proof: the worker
      // returns 200 when it claims nothing, which is exactly what a "restart"
      // that silently did nothing looks like. Report honestly either way.
      const workerRan = data?.workerRan === true || Number(data?.chunksProcessed ?? 0) > 0
      const workRemaining = data?.workRemaining === true
      if (!workerRan) {
        setSyncResult({
          status: workRemaining ? 'failed' : 'success',
          message: workRemaining
            ? (data?.claimFailed === true
                ? 'Restart could not claim any work — the queue lock is unavailable. The recovery worker retries automatically every minute; if this persists, check the Meta connection.'
                : 'Restart reached the worker but it claimed no items. Items are still queued, so the automatic recovery worker will retry within a minute.')
            : 'Nothing left to process — this batch has no remaining work.',
          phase: 'worker',
          debug: safeStringify({ chunksProcessed: data?.chunksProcessed ?? 0, workRemaining, claimFailed: data?.claimFailed ?? null }),
        })
        return
      }

      setSyncResult({
        status: 'success',
        message: `Worker restarted: processed ${data?.processed ?? 0} item(s)${data?.handedOff === true ? ' and handed off to the next worker' : ''}${workRemaining ? '. Remaining items continue automatically.' : '.'}`,
        phase: 'worker',
      })
      stallRef.current = 0
      setBatchStalled(false)
    } catch (e) {
      setSyncResult({
        status: 'failed',
        message: `Worker restart failed: ${redactForDisplay(e instanceof Error ? e.message : String(e))}`,
        phase: 'network',
        debug: safeStringify({ error: redactForDisplay(e instanceof Error ? e.message : String(e)) }),
      })
    } finally {
      retryWorkerRef.current = false
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    setSyncProgress(null)
    setBatch(null)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session?.access_token) {
        setSyncResult({ status: 'failed', message: 'Authentication required. Please sign in again before syncing.', phase: 'auth', debug: safeStringify({ error: sessionError?.message ?? 'No active session' }) })
        setSyncing(false)
        return
      }

      const syncableAssets = linkedAssets
        .filter(asset => asset.facebook_page_id || asset.instagram_account_id)
        .filter(asset => syncMode !== 'selected' || asset.client_id === selectedSyncClientId)
      if (syncableAssets.length === 0) {
        setSyncResult({ status: 'skipped', message: 'No linked clients with a Facebook Page or Instagram account were found to sync.', clientsAttempted: 0, clientsSucceeded: 0, clientsSynced: 0, clientsFailed: 0, monthsAttempted: 0, reportsCreated: 0, reportsReused: 0, postsSynced: 0, warnings: [], steps: [] })
        setSyncing(false)
        return
      }

      const months = getCompletedMonths(syncMonthCount)
      const items = syncableAssets.map(a => ({ clientId: a.client_id, clientName: clientNameForAsset(a) }))

      const { data, error } = await supabase.functions.invoke('meta-sync-enqueue', {
        method: 'POST',
        body: { mode: syncMode === 'all' ? 'all' : 'selected', months, items, syncRangeMonths: syncMonthCount },
      })

      if (error || !data?.ok) {
        // Queue table likely does not exist — fall back to legacy blocking sync
        console.warn('meta-sync-enqueue failed, falling back to legacy sync:', data?.error ?? error?.message)
        await handleSyncLegacy()
        return
      }

      setSyncProgress(`Queued sync: ${items.length} client(s) × ${months.length} month(s) = ${data.totalItems} item(s)`)
      localStorage.setItem('cg_meta_active_sync_batch_id', data.batchId)
      await startPolling(data.batchId)
    } catch (e) {
      setSyncResult({ status: 'failed', message: redactForDisplay(e instanceof Error ? e.message : String(e)), phase: 'unknown', debug: safeStringify({ error: redactForDisplay(e instanceof Error ? e.message : String(e)) }) })
      setSyncing(false)
    }
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
          grantedScopes: Array.isArray(data.connection?.grantedScopes) ? data.connection.grantedScopes : [],
          schemaReady: data.schemaReady === true,
          tokenEncryptedAtRest: data.tokenSecurity?.encryptedAtRest === true,
          lastVerifiedInsight: data.connection?.lastVerifiedInsight ?? null,
        })
        setConnectMsg(null)
      } else {
        setConnectState('idle')
        setConnectionInfo(null)
        setConnectMsg(data?.message ?? 'Meta needs to be connected before report data can sync.')
      }
    } catch {
      setConnectState('idle')
      setConnectionInfo(null)
      setConnectMsg('Could not verify the Meta connection. Try again or ask an admin to check the Edge Function.')
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

  // OAuth result from URL query params.
  useEffect(() => {
    const meta = searchParams.get('meta')
    if (meta === 'connected') {
      setConnectMsg('Meta connected. Next step: link assets to clients.')
      checkConnection()
      window.history.replaceState(null, '', window.location.pathname)
    } else if (meta === 'error') {
      setConnectMsg('Meta connection failed. Please try again.')
      window.history.replaceState(null, '', window.location.pathname)
    } else if (meta === 'permissions_missing') {
      setConnectMsg('Meta connected, but one or more reporting permissions were not granted. Reconnect Meta and approve all requested permissions.')
      checkConnection()
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [searchParams, checkConnection])

  // Deep link from the Clients page (?client=<id>): preselect that client for a
  // selected-client sync once its linked assets are known.
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

  // Cleanup poll interval on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  // Restore active batch on mount (rehydration across page navigation)
  useEffect(() => {
    const savedBatchId = localStorage.getItem('cg_meta_active_sync_batch_id')

    async function restore() {
      if (savedBatchId) {
        const { data } = await supabase
          .from('meta_sync_batches')
          .select('id, status, total_items, completed_items, failed_items')
          .eq('id', savedBatchId)
          .single()

        if (data && (data.status === 'queued' || data.status === 'running')) {
          setBatch({ ...(data as { id: string; status: string; total_items: number; completed_items: number; failed_items: number }), running_items: 0, queued_items: 0 })
          setSyncing(true)
          setSyncProgress('Restoring sync progress...')
          startPolling(data.id)
          return
        }
        if (data) {
          localStorage.removeItem('cg_meta_active_sync_batch_id')
          handleBatchComplete(data.id)
          return
        }
        localStorage.removeItem('cg_meta_active_sync_batch_id')
      }

      const { data: activeBatches } = await supabase
        .from('meta_sync_batches')
        .select('id, status, total_items, completed_items, failed_items')
        .in('status', ['queued', 'running'])
        .order('created_at', { ascending: false })
        .limit(1)

      if (activeBatches && activeBatches.length > 0) {
        const active = activeBatches[0]
        localStorage.setItem('cg_meta_active_sync_batch_id', active.id)
        setBatch({ ...(active as { id: string; status: string; total_items: number; completed_items: number; failed_items: number }), running_items: 0, queued_items: 0 })
        setSyncing(true)
        setSyncProgress('Restoring sync progress...')
        startPolling(active.id)
      }
    }

    restore()
  }, [])

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
      setAdAccountsDiagnostic(data.adAccountsDiagnostic ?? null)
      setPagesDiagnostic(data.pagesDiagnostic ?? null)
      setAssetsLoaded(true)
    } catch {
      setAssetError('Could not load Meta assets.')
    } finally {
      setLoadingAssets(false)
    }
  }

  // Merge Meta pages with fallback entries from linked assets.
  const pagePickerOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: { value: string; label: string }[] = []
    for (const p of pages) {
      if (!seen.has(p.id)) {
        seen.add(p.id)
        options.push({ value: p.id, label: p.category ? `${p.name} (${p.category})` : p.name })
      }
    }
    for (const link of linkedAssets) {
      if (link.facebook_page_id && !seen.has(link.facebook_page_id)) {
        seen.add(link.facebook_page_id)
        options.push({ value: link.facebook_page_id, label: `${link.facebook_page_name || link.facebook_page_id} (existing linked page)` })
      }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label))
  }, [pages, linkedAssets])

  // Merge IG options with fallback from linked assets.
  const igPickerOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: { value: string; label: string }[] = []
    for (const a of igAccounts) {
      if (!seen.has(a.id)) {
        seen.add(a.id)
        options.push({ value: a.id, label: a.name || a.username || a.id })
      }
    }
    for (const link of linkedAssets) {
      if (link.instagram_account_id && !seen.has(link.instagram_account_id)) {
        seen.add(link.instagram_account_id)
        options.push({ value: link.instagram_account_id, label: `${link.instagram_username || link.instagram_account_id} (existing linked account)` })
      }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label))
  }, [igAccounts, linkedAssets])

  // Merge Ad Account options with fallback from linked assets.
  const adPickerOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: { value: string; label: string }[] = []
    for (const a of adAccounts) {
      if (!seen.has(a.id)) {
        seen.add(a.id)
        options.push({ value: a.id, label: a.name })
      }
    }
    for (const link of linkedAssets) {
      if (link.ad_account_id && !seen.has(link.ad_account_id)) {
        seen.add(link.ad_account_id)
        options.push({ value: link.ad_account_id, label: `${link.ad_account_name || link.ad_account_id} (existing linked account)` })
      }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label))
  }, [adAccounts, linkedAssets])

  const sortedClientOptions = useMemo(
    () => clients.map(c => ({ value: c.id, label: c.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [clients],
  )
  // Per-page IG options for inline row pickers.
  function igOptionsForPage(pageId: string | null | undefined) {
    const filtered = pageId ? igAccounts.filter(a => a.facebookPageId === pageId) : igAccounts
    let options = filtered
      .map(a => ({ value: a.id, label: a.name || a.username || a.id }))
    // Also add any linked IG entry for this page from linked assets.
    for (const link of linkedAssets) {
      if (link.instagram_account_id && !options.some(o => o.value === link.instagram_account_id)) {
        options.push({ value: link.instagram_account_id, label: `${link.instagram_username || link.instagram_account_id} (existing)` })
      }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label))
  }

  function pageAssetForId(id: string): FbPage | null {
    if (!id) return null
    const page = pages.find(p => p.id === id)
    if (page) return page
    const link = linkedAssets.find(asset => asset.facebook_page_id === id)
    if (!link) return null
    return {
      id,
      name: link.facebook_page_name ?? id,
      category: null,
      instagramAccount: null,
    }
  }

  function instagramAssetForId(id: string): IgAccount | null {
    if (!id) return null
    const account = igAccounts.find(a => a.id === id)
    if (account) return account
    const link = linkedAssets.find(asset => asset.instagram_account_id === id)
    if (!link) return null
    return {
      id,
      username: link.instagram_username,
      name: link.instagram_username,
      profilePictureUrl: null,
      facebookPageId: link.facebook_page_id ?? '',
      facebookPageName: link.facebook_page_name ?? '',
    }
  }

  function adAccountForId(id: string): AdAccount | null {
    if (!id) return null
    const account = adAccounts.find(a => a.id === id)
    if (account) return account
    const link = linkedAssets.find(asset => asset.ad_account_id === id)
    if (!link) return null
    return {
      id,
      name: link.ad_account_name ?? id,
      accountStatus: null,
    }
  }

  const selectedPage = pageAssetForId(selectedPageId)
  const selectedIg = instagramAssetForId(selectedIgId)
  const selectedAd = adAccountForId(selectedAdId)

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
      missingInstagram: clients.filter(client => !linkedByClient.get(client.id)?.instagram_account_id && !linkedByClient.get(client.id)?.instagram_not_applicable).length,
      missingAdAccount: clients.filter(client => !linkedByClient.get(client.id)?.ad_account_id).length,
      noInstagram: clients.filter(client => linkedByClient.get(client.id)?.instagram_not_applicable === true).length,
    }
  }, [clients, linkedAssets, linkedByClient])

  const filteredClientsForDrilldown = useMemo(() => {
    if (readinessFilter === 'none') return null
    if (readinessFilter === 'active') return clients.map(c => ({ client: c, reason: '' }))
    if (readinessFilter === 'linked') {
      return clients
        .filter(c => linkedByClient.has(c.id))
        .map(c => ({ client: c, reason: '' }))
    }
    if (readinessFilter === 'missingFacebook') {
      return clients
        .filter(c => !linkedByClient.get(c.id)?.facebook_page_id)
        .map(c => ({ client: c, reason: 'Link a Facebook Page to enable content sync.' }))
    }
    if (readinessFilter === 'missingInstagram') {
      return clients
        .filter(c => !linkedByClient.get(c.id)?.instagram_account_id && !linkedByClient.get(c.id)?.instagram_not_applicable)
        .map(c => ({ client: c, reason: 'Link an Instagram account to enable content sync.' }))
    }
    if (readinessFilter === 'noInstagram') {
      return clients
        .filter(c => linkedByClient.get(c.id)?.instagram_not_applicable === true)
        .map(c => ({ client: c, reason: 'Instagram marked as not applicable.' }))
    }
    if (readinessFilter === 'missingAdAccount') {
      return clients
        .filter(c => !linkedByClient.get(c.id)?.ad_account_id)
        .map(c => ({ client: c, reason: 'Ad accounts are needed for paid/boosted reporting later.' }))
    }
    return null
  }, [readinessFilter, clients, linkedByClient])

  // Build suggestions for the match table.
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
            reason: igCandidates[0] ? `Instagram of suggested Page "${page.asset.name}".` : 'Suggested Page has no Instagram account.',
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
        instagramNotApplicable: Boolean(currentLink?.instagram_not_applicable),
      }
    })
  }, [adAccounts, clients, igAccounts, linkedByClient, pages])

  function isFullyLinked(suggestion: ClientAssetSuggestion) {
    return Boolean(
      suggestion.currentLink?.facebook_page_id &&
      (suggestion.currentLink?.instagram_account_id || suggestion.currentLink?.instagram_not_applicable)
    )
  }

  function linkActionLabel(suggestion: ClientAssetSuggestion) {
    if (isFullyLinked(suggestion)) return 'Linked'
    if (!suggestion.currentLink?.facebook_page_id) return 'Needs Facebook'
    if (suggestion.currentLink?.instagram_not_applicable) return 'Has FB, IG N/A'
    if (!suggestion.currentLink?.instagram_account_id) return 'Needs Instagram'
    return 'Needs link'
  }

  function suggestionLabel(match: AssetMatch<unknown>) {
    return match.asset ? 'Suggested match' : 'No suggestion'
  }

  // Filtered suggestions based on workflow tab.
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter(s => {
      const link = s.currentLink
      switch (tableFilter) {
        case 'all':
          return true
        case 'linked':
          return isFullyLinked(s)
        case 'needs':
          return !isFullyLinked(s)
        case 'missingFacebook':
          return !link?.facebook_page_id
        case 'missingInstagram':
          return !link?.instagram_account_id && !link?.instagram_not_applicable
        case 'facebookOnly':
          return Boolean(link?.facebook_page_id && !link?.instagram_account_id && !link?.instagram_not_applicable)
        case 'instagramOnly':
          return Boolean(link?.instagram_account_id && !link?.facebook_page_id)
        case 'both':
          return Boolean(link?.facebook_page_id && link?.instagram_account_id)
        case 'noInstagram':
          return link?.instagram_not_applicable === true
        default:
          return true
      }
    })
  }, [suggestions, tableFilter])

  // Initialise row selections from suggestions when assets are loaded.
  useEffect(() => {
    if (!assetsLoaded) return
    const initial: Record<string, { facebookPageId: string; instagramAccountId: string; adAccountId: string; instagramNotApplicable: boolean }> = {}
    for (const s of suggestions) {
      initial[s.client.id] = {
        facebookPageId: s.page.score >= 0.9 && !s.alreadyLinkedDifferently && !s.alreadyLinkedSame
          ? (s.page.asset?.id ?? '')
          : (s.currentLink?.facebook_page_id ?? ''),
        instagramAccountId: s.instagram.score >= 0.9 && !s.alreadyLinkedDifferently && !s.alreadyLinkedSame
          ? (s.instagram.asset?.id ?? '')
          : (s.currentLink?.instagram_account_id ?? ''),
        adAccountId: s.currentLink?.ad_account_id ?? '',
        instagramNotApplicable: Boolean(s.currentLink?.instagram_not_applicable),
      }
    }
    setRowSelections(initial)
  }, [assetsLoaded, suggestions])

  function updateRowSelection(clientId: string, field: 'facebookPageId' | 'instagramAccountId' | 'adAccountId' | 'instagramNotApplicable', value: string | boolean) {
    setRowSelections(prev => {
      const current = prev[clientId] ?? { facebookPageId: '', instagramAccountId: '', adAccountId: '', instagramNotApplicable: false }
      if (field === 'instagramNotApplicable') {
        return {
          ...prev,
          [clientId]: {
            ...current,
            instagramNotApplicable: value as boolean,
            instagramAccountId: value ? '' : current.instagramAccountId,
          },
        }
      }
      return {
        ...prev,
        [clientId]: {
          ...current,
          [field]: value as string,
          ...(field === 'facebookPageId' ? { instagramAccountId: '' } : {}),
        },
      }
    })
  }

  function buildLinkPayload(input: {
    clientId: string
    page: FbPage | null
    instagram: IgAccount | null
    adAccount: AdAccount | null
    allowOverwrite?: boolean
    instagramNotApplicable?: boolean
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
      instagramNotApplicable: input.instagramNotApplicable === true,
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
      setLinkMsg({ ok: true, text: `${clientName} linked successfully.` })
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

  async function handleRowLink(clientId: string) {
    const sel = rowSelections[clientId]
    if (!sel || (!sel.facebookPageId && !sel.instagramAccountId && !sel.adAccountId && !sel.instagramNotApplicable)) return
    setLinkingRows(prev => new Set(prev).add(clientId))
    setLinkMsg(null)

    const clientName = clients.find(c => c.id === clientId)?.name ?? 'Client'
    const existing = linkedByClient.get(clientId)
    const overwriteNeeded = Boolean(existing && (
      (existing.facebook_page_id ?? '') !== (sel.facebookPageId || '') ||
      (!sel.instagramNotApplicable && (existing.instagram_account_id ?? '') !== (sel.instagramAccountId || '')) ||
      (existing.ad_account_id ?? '') !== (sel.adAccountId || '')
    ))
    const allowOverwrite = overwriteNeeded
      ? window.confirm(`${clientName} already has a different active Meta link. Replace it with the selected assets?`)
      : false

    if (overwriteNeeded && !allowOverwrite) {
      setLinkingRows(prev => { const next = new Set(prev); next.delete(clientId); return next })
      setLinkMsg({ ok: false, text: `${clientName}: existing link was not changed.` })
      return
    }

    try {
      await saveAssetLinks({
        action: 'upsert',
        link: buildLinkPayload({
          clientId,
          page: pageAssetForId(sel.facebookPageId),
          instagram: sel.instagramNotApplicable ? null : instagramAssetForId(sel.instagramAccountId),
          adAccount: adAccountForId(sel.adAccountId),
          allowOverwrite,
          instagramNotApplicable: sel.instagramNotApplicable,
        }),
      })
      setLinkMsg({ ok: true, text: `${clientName} linked successfully.` })
      await loadLinkedAssets()
    } catch {
      setLinkMsg({ ok: false, text: `${clientName}: failed to save link.` })
    } finally {
      setLinkingRows(prev => { const next = new Set(prev); next.delete(clientId); return next })
    }
  }

  function linkFromSelections(clientId: string): { pageId: string; igId: string; adId: string; instagramNotApplicable: boolean } {
    const sel = rowSelections[clientId] ?? { facebookPageId: '', instagramAccountId: '', adAccountId: '', instagramNotApplicable: false }
    return { pageId: sel.facebookPageId, igId: sel.instagramAccountId, adId: sel.adAccountId, instagramNotApplicable: sel.instagramNotApplicable }
  }

  const computedCounts = useMemo(() => ({
    needs: suggestions.filter(s => !isFullyLinked(s)).length,
    missingFacebook: suggestions.filter(s => !s.currentLink?.facebook_page_id).length,
    missingInstagram: suggestions.filter(s => !s.currentLink?.instagram_account_id && !s.currentLink?.instagram_not_applicable).length,
    facebookOnly: suggestions.filter(s => Boolean(s.currentLink?.facebook_page_id && !s.currentLink?.instagram_account_id && !s.currentLink?.instagram_not_applicable)).length,
    instagramOnly: suggestions.filter(s => Boolean(s.currentLink?.instagram_account_id && !s.currentLink?.facebook_page_id)).length,
    both: suggestions.filter(s => Boolean(s.currentLink?.facebook_page_id && s.currentLink?.instagram_account_id)).length,
    noInstagram: suggestions.filter(s => s.currentLink?.instagram_not_applicable === true).length,
    linked: suggestions.filter(isFullyLinked).length,
  }), [suggestions])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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

      {/* Readiness cards */}
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
          <HealthTile
            label="Active clients"
            value={readiness.activeClients}
            active={readinessFilter === 'active'}
            onClick={() => setReadinessFilter(readinessFilter === 'active' ? 'none' : 'active')}
          />
          <HealthTile
            label="Linked to Meta"
            value={readiness.linkedAny}
            active={readinessFilter === 'linked'}
            onClick={() => setReadinessFilter(readinessFilter === 'linked' ? 'none' : 'linked')}
          />
          <HealthTile
            label="Missing Facebook Page"
            value={readiness.missingFacebook}
            tone={readiness.missingFacebook > 0 ? 'warn' : 'ok'}
            active={readinessFilter === 'missingFacebook'}
            onClick={() => setReadinessFilter(readinessFilter === 'missingFacebook' ? 'none' : 'missingFacebook')}
          />
          <HealthTile
            label="Missing Instagram"
            value={readiness.missingInstagram}
            tone={readiness.missingInstagram > 0 ? 'warn' : 'ok'}
            active={readinessFilter === 'missingInstagram'}
            onClick={() => setReadinessFilter(readinessFilter === 'missingInstagram' ? 'none' : 'missingInstagram')}
          />
          <HealthTile
            label="No Instagram account"
            value={readiness.noInstagram}
            tone={readiness.noInstagram > 0 ? 'neutral' : 'ok'}
            active={readinessFilter === 'noInstagram'}
            onClick={() => setReadinessFilter(readinessFilter === 'noInstagram' ? 'none' : 'noInstagram')}
          />
          <HealthTile
            label="Missing Ad Account"
            value={readiness.missingAdAccount}
            tone={readiness.missingAdAccount > 0 ? 'warn' : 'ok'}
            active={readinessFilter === 'missingAdAccount'}
            onClick={() => setReadinessFilter(readinessFilter === 'missingAdAccount' ? 'none' : 'missingAdAccount')}
          />
          <HealthTile label="Last connected" value={formatDateTime(connectionInfo?.lastConnectedAt)} />
          <HealthTile
            label="OAuth permissions"
            value={connectionInfo?.grantedScopes.includes('read_insights') ? 'Reporting access granted' : 'Reauthorization required'}
            tone={connectionInfo?.grantedScopes.includes('read_insights') ? 'ok' : 'warn'}
          />
          <HealthTile
            label="OAuth schema"
            value={connectionInfo?.schemaReady ? 'Ready' : 'Migration required'}
            tone={connectionInfo?.schemaReady ? 'ok' : 'warn'}
          />
          <HealthTile
            label="Token storage"
            value={connectionInfo?.tokenEncryptedAtRest ? 'Encrypted at rest' : 'Server-only; encryption hardening required'}
            tone={connectionInfo?.tokenEncryptedAtRest ? 'ok' : 'warn'}
          />
          <HealthTile
            label="Last verified insight"
            value={connectionInfo?.lastVerifiedInsight?.finishedAt
              ? `${formatDateTime(connectionInfo.lastVerifiedInsight.finishedAt)} · ${connectionInfo.lastVerifiedInsight.platform}`
              : 'No verified insight yet'}
            tone={connectionInfo?.lastVerifiedInsight ? 'ok' : 'neutral'}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-brand-primary/70">
          Connection, permissions and schema readiness are checked server-side. Meta tokens never reach the browser. Token storage remains server-only but is not yet encrypted at rest, so encryption hardening is still required before broader production rollout.
        </p>
      </PremiumCard>

      {/* Readiness drilldown */}
      {filteredClientsForDrilldown && (
        <PremiumCard className="mt-4 max-w-4xl" padding="md">
          <PremiumCardHeader
            eyebrow="Drilldown"
            title={`${readinessFilter === 'active' ? 'All active clients' : readinessFilter === 'linked' ? 'Linked clients' : readinessFilter === 'missingFacebook' ? 'Clients missing Facebook Page' : readinessFilter === 'missingInstagram' ? 'Clients missing Instagram' : readinessFilter === 'noInstagram' ? 'Clients with no Instagram account' : 'Clients missing Ad Account'}`}
            action={
              <button
                type="button"
                onClick={() => setReadinessFilter('none')}
                className="text-xs text-brand-accent hover:underline"
              >
                Clear filter
              </button>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-brand-primary/55">
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Facebook Page</th>
                  <th className="px-3 py-2">Instagram</th>
                  <th className="px-3 py-2">Ad Account</th>
                  <th className="px-3 py-2">Next action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {filteredClientsForDrilldown.map(({ client, reason }) => {
                  const link = linkedByClient.get(client.id)
                  return (
                    <tr key={client.id} className="align-top">
                      <td className="px-3 py-3 font-semibold text-white">{client.name}</td>
                      <td className="px-3 py-3 text-brand-primary/75">
                        {link?.facebook_page_name ? (
                          <span className="text-brand-teal">{link.facebook_page_name}</span>
                        ) : (
                          <span className="text-amber-300">Not linked</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-brand-primary/75">
                        {link?.instagram_username ? (
                          <span className="text-brand-teal">@{link.instagram_username}</span>
                        ) : (
                          <span className="text-amber-300">Not linked</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-brand-primary/75">
                        {link?.ad_account_name ? (
                          <span className="text-brand-teal">{link.ad_account_name}</span>
                        ) : (
                          <span className="text-amber-300">Not linked</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-brand-primary/60">{reason || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </PremiumCard>
      )}

      {/* Step cards - Steps 1, 3, 4 constrained, Step 2 is full-width workspace */}
      <div className="mt-6 space-y-4">
        {/* Step 1 — Connect Meta */}
        <PremiumCard className="max-w-2xl">
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

        {/* Step 2 — Link assets to clients (full-width workspace) */}
        <PremiumCard className="w-full">
          <PremiumCardHeader
            title={<span className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">2</span> Link assets to clients</span>}
            action={
              <StatusBadge
                label={connectionLoading ? 'Checking connection...' : connectState === 'connected' ? (assetsLoaded ? 'Meta assets loaded' : 'Ready') : 'Waiting for Meta connection'}
                variant={connectState === 'connected' ? (assetsLoaded ? 'published' : 'ready-to-publish') : 'internal-draft'}
              />
            }
          />

          {connectState === 'connected' && !assetsLoaded && (
            <>
              <p className="text-sm leading-relaxed text-brand-primary">
                Load your Meta assets, then review suggested matches for each active client. Correct any wrong suggestions inline, then link approved rows.
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
              {/* Warning banner when Meta returned 0 pages */}
              {pages.length === 0 && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4">
                  <p className="text-sm font-semibold text-amber-300">Meta returned 0 Facebook Pages</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
                    Existing linked assets are still shown, but new page matching needs Meta Page access. Possible causes:
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-amber-200/70 space-y-0.5">
                    <li>The connected Meta user does not manage any Facebook Pages.</li>
                    <li>Missing or expired <code className="bg-amber-400/10 px-1 rounded">pages_show_list</code> permission.</li>
                    <li>The Meta access token needs reconnection.</li>
                    <li>Meta app review / permission issue.</li>
                  </ul>
                  {pagesDiagnostic && typeof pagesDiagnostic.status === 'string' ? (
                    <p className="mt-2 text-xs text-amber-200/50">Meta API response: {pagesDiagnostic.status}</p>
                  ) : null}
                  <div className="mt-3">
                    <ActionButton variant="outline" size="sm" onClick={handleConnect}>
                      Reconnect Meta
                    </ActionButton>
                  </div>
                </div>
              )}

              {/* IG empty explanation */}
              {igAccounts.length === 0 && pages.length > 0 && (
                <div className="rounded-xl border border-brand-muted bg-brand-bg/40 p-3">
                  <p className="text-xs text-brand-primary/70">
                    No Instagram Business accounts found. Instagram accounts must be linked to a Facebook Page as a Business account. Verify each Page has an Instagram Business account connected in Meta Business Suite.
                  </p>
                </div>
              )}

              {adPickerOptions.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-sm font-semibold text-white">Ad accounts unavailable</p>
                  <p className="mt-1 text-xs leading-relaxed text-brand-primary/70">
                    Facebook and Instagram organic reporting can still sync without ad accounts. Ad accounts are only needed for paid or boosted reporting.
                  </p>
                  <p className="mt-1 text-xs text-brand-primary/55">
                    {adAccountsError || 'Meta returned no ad accounts. Check ad account permissions in Meta Business Suite if paid reporting is needed.'}
                  </p>
                  {adAccountsDiagnostic?.status !== undefined && adAccountsDiagnostic?.status !== null && (
                    <p className="mt-1 text-xs text-brand-primary/40">Meta API response: {String(adAccountsDiagnostic.status)}</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setTableFilter('needs')}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${tableFilter === 'needs' ? 'border-brand-accent/40 bg-brand-accent/15 text-brand-accent' : 'border-white/10 bg-white/[0.035] text-brand-primary hover:text-white'}`}>
                  Needs linking ({computedCounts.needs})
                </button>
                <button type="button" onClick={() => setTableFilter('missingFacebook')}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${tableFilter === 'missingFacebook' ? 'border-brand-accent/40 bg-brand-accent/15 text-brand-accent' : 'border-white/10 bg-white/[0.035] text-brand-primary hover:text-white'}`}>
                  Missing FB ({computedCounts.missingFacebook})
                </button>
                <button type="button" onClick={() => setTableFilter('missingInstagram')}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${tableFilter === 'missingInstagram' ? 'border-brand-accent/40 bg-brand-accent/15 text-brand-accent' : 'border-white/10 bg-white/[0.035] text-brand-primary hover:text-white'}`}>
                  Missing IG ({computedCounts.missingInstagram})
                </button>
                <button type="button" onClick={() => setTableFilter('facebookOnly')}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${tableFilter === 'facebookOnly' ? 'border-brand-accent/40 bg-brand-accent/15 text-brand-accent' : 'border-white/10 bg-white/[0.035] text-brand-primary hover:text-white'}`}>
                  FB only ({computedCounts.facebookOnly})
                </button>
                <button type="button" onClick={() => setTableFilter('instagramOnly')}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${tableFilter === 'instagramOnly' ? 'border-brand-accent/40 bg-brand-accent/15 text-brand-accent' : 'border-white/10 bg-white/[0.035] text-brand-primary hover:text-white'}`}>
                  IG only ({computedCounts.instagramOnly})
                </button>
                <button type="button" onClick={() => setTableFilter('both')}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${tableFilter === 'both' ? 'border-brand-accent/40 bg-brand-accent/15 text-brand-accent' : 'border-white/10 bg-white/[0.035] text-brand-primary hover:text-white'}`}>
                  FB + IG ({computedCounts.both})
                </button>
                <button type="button" onClick={() => setTableFilter('noInstagram')}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${tableFilter === 'noInstagram' ? 'border-brand-accent/40 bg-brand-accent/15 text-brand-accent' : 'border-white/10 bg-white/[0.035] text-brand-primary hover:text-white'}`}>
                  No IG account ({computedCounts.noInstagram})
                </button>
                <button type="button" onClick={() => setTableFilter('linked')}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${tableFilter === 'linked' ? 'border-brand-accent/40 bg-brand-accent/15 text-brand-accent' : 'border-white/10 bg-white/[0.035] text-brand-primary hover:text-white'}`}>
                  Linked ({computedCounts.linked})
                </button>
                <button type="button" onClick={() => setTableFilter('all')}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${tableFilter === 'all' ? 'border-brand-accent/40 bg-brand-accent/15 text-brand-accent' : 'border-white/10 bg-white/[0.035] text-brand-primary hover:text-white'}`}>
                  All ({suggestions.length})
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#071311]/80 p-4 shadow-[0_24px_80px_-54px_rgba(0,0,0,0.95)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-accent">Clients needing Meta links</p>
                    <h3 className="mt-1 text-xl font-semibold text-white">
                      {tableFilter === 'needs' && 'Clients needing Meta links'}
                      {tableFilter === 'missingFacebook' && 'Clients missing Facebook Page'}
                      {tableFilter === 'missingInstagram' && 'Clients missing Instagram'}
                      {tableFilter === 'facebookOnly' && 'Clients with Facebook only'}
                      {tableFilter === 'instagramOnly' && 'Clients with Instagram only'}
                      {tableFilter === 'both' && 'Clients with both linked'}
                      {tableFilter === 'noInstagram' && 'Clients with no Instagram account'}
                      {tableFilter === 'linked' && 'Already linked clients'}
                      {tableFilter === 'all' && 'All active clients'}
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm leading-relaxed text-brand-primary/75">
                      Choose the correct Facebook Page and Instagram account for each client, then save. Strong matches are preselected when the app is confident.
                    </p>
                  </div>
                </div>

                {filteredSuggestions.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-10 text-center">
                    <p className="text-sm font-semibold text-white">
                      {tableFilter === 'needs' && 'All active clients are linked or no review items are available.'}
                      {tableFilter === 'missingFacebook' && 'All active clients have a Facebook Page linked.'}
                      {tableFilter === 'missingInstagram' && 'No clients missing Instagram (excluding those marked as not having one).'}
                      {tableFilter === 'facebookOnly' && 'No clients with Facebook only.'}
                      {tableFilter === 'instagramOnly' && 'No clients with Instagram only.'}
                      {tableFilter === 'both' && 'No clients with both Facebook and Instagram linked.'}
                      {tableFilter === 'noInstagram' && 'No clients marked as not having an Instagram account.'}
                      {tableFilter === 'linked' && 'No complete active Meta links yet.'}
                      {tableFilter === 'all' && 'No active clients to display.'}
                    </p>
                    <p className="mt-2 text-sm text-brand-primary/60">
                      Load Meta assets or switch views to continue linking clients.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {filteredSuggestions.map(suggestion => {
                      const clientId = suggestion.client.id
                      const sel = linkFromSelections(clientId)
                      const hasCoreSelection = Boolean(sel.pageId || sel.igId || sel.instagramNotApplicable)
                      const pageOptions = pagePickerOptions
                      const instagramOptions = igOptionsForPage(sel.pageId || suggestion.currentLink?.facebook_page_id)
                      const fbSuggestion = suggestionLabel(suggestion.page)
                      const igSuggestion = suggestionLabel(suggestion.instagram)
                      return (
                        <div key={clientId} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[220px_minmax(220px,1fr)_minmax(220px,1fr)_auto] xl:items-start">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-base font-semibold text-white">{suggestion.client.name}</h4>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] ${
                                  isFullyLinked(suggestion)
                                    ? 'border-brand-teal/30 bg-brand-teal/10 text-[#66d0c3]'
                                    : 'border-amber-300/25 bg-amber-300/10 text-amber-200'
                                }`}>
                                  {linkActionLabel(suggestion)}
                                </span>
                              </div>
                              {suggestion.currentLink && (
                                <div className="mt-2 space-y-1 text-xs text-brand-primary/55">
                                  <p>Current Facebook: {suggestion.currentLink.facebook_page_name || 'Not linked'}</p>
                                  <p>Current Instagram: {suggestion.currentLink.instagram_username ? `@${suggestion.currentLink.instagram_username}` : 'Not linked'}</p>
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-brand-primary/55">Facebook Page</label>
                              <SearchablePicker
                                value={sel.pageId}
                                onChange={v => updateRowSelection(clientId, 'facebookPageId', v)}
                                options={pageOptions}
                                placeholder={pageOptions.length === 0 ? 'No Facebook Pages available' : 'Select Facebook Page'}
                                emptyLabel={pageOptions.length === 0 ? 'No Facebook Pages available from Meta. Reconnect Meta or check Page access.' : 'No matching Facebook Pages'}
                              />
                              <p className="mt-1.5 text-xs text-brand-primary/50">
                                {sel.pageId ? fbSuggestion : 'No suggestion'}
                              </p>
                            </div>

                            <div className="min-w-0">
                              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-brand-primary/55">Instagram account</label>
                              <SearchablePicker
                                value={sel.igId}
                                onChange={v => updateRowSelection(clientId, 'instagramAccountId', v)}
                                options={instagramOptions}
                                placeholder={instagramOptions.length === 0 ? 'No Instagram accounts available' : 'Select Instagram account'}
                                emptyLabel={sel.pageId ? 'No Instagram account linked to this Facebook Page.' : 'Select a Facebook Page first, or choose from existing linked Instagram fallbacks.'}
                                disabled={sel.instagramNotApplicable}
                              />
                              <p className="mt-1.5 text-xs text-brand-primary/50">
                                {sel.igId ? igSuggestion : 'No suggestion'}
                              </p>
                              <label className="mt-2 flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={sel.instagramNotApplicable}
                                  onChange={e => updateRowSelection(clientId, 'instagramNotApplicable', e.target.checked)}
                                  className="h-4 w-4 rounded border-brand-muted bg-brand-bg text-brand-accent focus:ring-brand-accent"
                                />
                                <span className="text-xs text-brand-primary/70">This client does not have an Instagram account</span>
                              </label>
                            </div>

                            <div className="flex flex-col gap-2 xl:min-w-[150px]">
                              <ActionButton
                                variant="secondary"
                                onClick={() => handleRowLink(clientId)}
                                disabled={!hasCoreSelection || isFullyLinked(suggestion) || linkingRows.has(clientId)}
                                loading={linkingRows.has(clientId)}
                              >
                                {isFullyLinked(suggestion) ? 'Linked' : 'Save link'}
                              </ActionButton>
                              {suggestion.alreadyLinkedDifferently && (
                                <p className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
                                  Replacing an existing link will ask for confirmation.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Manual override (demoted fallback) */}
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
                      options={pagePickerOptions}
                      placeholder="Select a page..."
                      emptyLabel="No pages found"
                    />
                  </div>

                  <div className="grid gap-1 md:grid-cols-[150px_minmax(0,1fr)] md:items-center md:gap-4">
                    <span className="text-sm text-brand-primary">Instagram Account</span>
                    <SearchablePicker
                      value={selectedIgId}
                      onChange={setSelectedIgId}
                      options={
                        selectedPageId
                          ? igAccounts.filter(a => a.facebookPageId === selectedPageId)
                              .map(a => ({ value: a.id, label: a.name || a.username || a.id }))
                              .sort((a, b) => a.label.localeCompare(b.label))
                          : igPickerOptions
                      }
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
                        options={adPickerOptions}
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
        <PremiumCard className="max-w-2xl">
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
              <p>Sync completed months from linked Meta assets. Reports are saved as internal drafts.</p>
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

          {batch && (
            <div className="mt-3 rounded-xl border border-brand-accent/20 bg-brand-accent/10 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-brand-accent">
                  {batchStalled ? 'Sync is not moving' : 'Syncing in background...'}
                </p>
                <span className="text-xs text-brand-primary/60">
                  {(batch.completed_items ?? 0) + (batch.failed_items ?? 0)} / {batch.total_items ?? 0}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-brand-bg">
                <div
                  className="h-full rounded-full bg-brand-accent transition-all duration-500"
                  style={{ width: `${batch.total_items > 0 ? (((batch.completed_items ?? 0) + (batch.failed_items ?? 0)) / batch.total_items) * 100 : 0}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-primary/60">
                <span className="text-brand-teal">Completed: {batch.completed_items ?? 0}</span>
                <span className={batch.failed_items > 0 ? 'text-amber-300' : ''}>Failed: {batch.failed_items ?? 0}</span>
                <span>Running: {batch.running_items ?? 0}</span>
                <span>Queued: {batch.queued_items ?? 0}</span>
                <span className="ml-auto">{batch.total_items > 0 ? Math.round((((batch.completed_items ?? 0) + (batch.failed_items ?? 0)) / batch.total_items) * 100) : 0}%</span>
              </div>
              {/* A restart is safe when nothing is running or every running item
                  has exceeded the worker lease. The claim RPC requeues stale rows
                  atomically before locking the next item. */}
              {batchStalled && (
                <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2">
                  <p className="text-xs font-medium text-amber-200">
                    No items have completed for a while. Restarting safely retries expired worker leases without creating another batch.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ActionButton variant="secondary" size="sm" onClick={handleRetryWorker}>
                      Restart worker
                    </ActionButton>
                  </div>
                </div>
              )}
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
                  {syncResult.itemsAttempted !== undefined
                    ? <li>Client-month items synced: {syncResult.itemsSucceeded ?? 0} of {syncResult.itemsAttempted}</li>
                    : <li>Months attempted: {syncResult.monthsAttempted ?? 0}</li>}
                  <li>Clients fully synced: {syncResult.clientsSucceeded ?? syncResult.clientsSynced ?? 0}{syncResult.clientsAttempted !== undefined ? ` of ${syncResult.clientsAttempted}` : ''}</li>
                  {syncResult.clientsFailed !== undefined && syncResult.clientsFailed > 0 && (
                    <li className="text-amber-400">Clients needing attention: {syncResult.clientsFailed}</li>
                  )}
                  <li>Reports created: {syncResult.reportsCreated ?? 0}</li>
                  <li>Reports reused: {syncResult.reportsReused ?? syncResult.reportsUpdated ?? 0}</li>
                  <li>Posts synced: {syncResult.postsSynced ?? 0}</li>
                  {syncResult.warnings && syncResult.warnings.length > 0 && (
                    <li className="text-amber-400">Warnings: {syncResult.warnings.length}</li>
                  )}
                </ul>
              )}
              {/* Failures: one row per CLIENT with its affected months, a plain
                  explanation, and the raw provider text tucked into an
                  expandable detail instead of dumped on screen. */}
              {syncResult.failureGroups && syncResult.failureGroups.length > 0 && (() => {
                const groups = syncResult.failureGroups
                const retryable = groups.filter(g => g.retryable)
                const retryableItemIds = retryable.flatMap(g => g.itemIds)
                return (
                  <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/5 p-3" data-testid="failure-groups">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-300">
                        {groups.length} client{groups.length !== 1 ? 's' : ''} need attention
                      </p>
                      {retryableItemIds.length > 0 && syncResult.batchId && (
                        <ActionButton
                          variant="secondary"
                          size="sm"
                          disabled={retryingFailed}
                          onClick={() => void retryFailedItems(syncResult.batchId!, retryableItemIds)}
                        >
                          {retryingFailed ? 'Retrying...' : `Retry ${retryableItemIds.length} failed item${retryableItemIds.length !== 1 ? 's' : ''}`}
                        </ActionButton>
                      )}
                    </div>
                    <ul className="mt-2 space-y-2">
                      {groups.map(group => (
                        <li key={group.clientId || group.clientName} className="rounded-lg border border-white/10 bg-black/20 p-2.5" data-testid="failure-group">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white">{group.clientName}</p>
                              <p className="mt-0.5 text-[11px] text-brand-primary/60">
                                {group.months.length} month{group.months.length !== 1 ? 's' : ''}: {group.months.join(', ')}
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                              group.category === 'permission'
                                ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
                                : group.category === 'transient'
                                  ? 'border-sky-400/30 bg-sky-400/10 text-sky-200'
                                  : 'border-red-400/30 bg-red-400/10 text-red-200'
                            }`}>
                              {group.category === 'permission' ? 'Needs permission' : group.category === 'transient' ? 'Retryable' : 'Stage failed'}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs leading-relaxed text-brand-primary">{group.headline}</p>
                          {group.action && (
                            <p className="mt-1.5 rounded border border-amber-400/20 bg-amber-400/[0.06] px-2 py-1.5 text-[11px] leading-relaxed text-amber-100">
                              {group.action}
                            </p>
                          )}
                          {group.diagnostics.length > 0 && (
                            <details className="mt-1.5">
                              <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-brand-primary/50 hover:text-brand-primary">
                                Technical detail
                              </summary>
                              <ul className="mt-1.5 space-y-1">
                                {group.diagnostics.map((line, index) => (
                                  <li key={index} className="break-words rounded bg-black/40 px-2 py-1 font-mono text-[10px] leading-relaxed text-brand-primary/70">{line}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                    {retryable.length === 0 && (
                      <p className="mt-2 text-[11px] text-amber-200/80">
                        None of these can be fixed by retrying — each needs the action above first.
                      </p>
                    )}
                  </div>
                )
              })()}

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
                        monthsAttempted: syncResult.monthsAttempted,
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

              {/* Sync range dropdown */}
              <div className="max-w-xs">
                <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-brand-primary/70 mb-1.5">
                  Completed months to sync
                </label>
                <select
                  value={syncMonthCount}
                  onChange={e => setSyncMonthCount(Number(e.target.value))}
                  className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
                >
                  {SYNC_RANGE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-brand-primary/50">
                  Syncing 3 completed months (default) provides history for month-over-month growth comparisons.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <ActionButton
                  variant="outline"
                  onClick={handleSync}
                  disabled={
                    syncing ||
                    batch !== null ||
                    linkedAssets.length === 0 ||
                    (syncMode === 'selected' && !selectedSyncClientId)
                  }
                  loading={syncing}
                >
                  {syncing
                    ? 'Syncing...'
                    : syncMode === 'selected'
                      ? `Sync selected client (${syncMonthCount} month${syncMonthCount > 1 ? 's' : ''})`
                      : `Sync all linked clients (${syncMonthCount} month${syncMonthCount > 1 ? 's' : ''})`}
                </ActionButton>
                {batch !== null && !syncing && (
                  <span className="text-xs text-brand-primary/60">A sync batch is already running.</span>
                )}
              </div>
            </div>
          )}
        </PremiumCard>

        {/* Step 4 — Review draft */}
        <PremiumCard className="max-w-2xl">
          <PremiumCardHeader title={<span className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">4</span> Review monthly draft</span>} />
          <p className="text-sm leading-relaxed text-brand-primary">
            After sync, CG Dynamics will create or update monthly report drafts. Staff can add strategy, preview as client, and publish.
          </p>
        </PremiumCard>
      </div>

      {/* Linked clients section */}
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
                    <p className="text-brand-primary">{asset.instagram_username ? `@${asset.instagram_username}` : asset.instagram_not_applicable ? 'Instagram not applicable' : 'No Instagram account linked'}</p>
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

function HealthTile({ label, value, tone = 'neutral', active = false, onClick }: {
  label: string
  value: string | number
  tone?: 'neutral' | 'ok' | 'warn'
  active?: boolean
  onClick?: () => void
}) {
  const toneClass = {
    neutral: 'border-white/8 bg-white/[0.03] text-white',
    ok: 'border-brand-teal/20 bg-brand-teal/[0.06] text-[#66d0c3]',
    warn: 'border-amber-300/20 bg-amber-300/[0.06] text-amber-200',
  }[tone]
  const activeClass = active ? 'ring-2 ring-brand-accent' : ''
  const clickableClass = onClick ? 'cursor-pointer hover:bg-white/[0.06] transition-colors' : ''
  return (
    <div
      className={`rounded-xl border p-3 ${toneClass} ${activeClass} ${clickableClass}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-brand-primary/55">{label}</p>
      <p className="mt-2 text-sm font-bold">{value}</p>
    </div>
  )
}
