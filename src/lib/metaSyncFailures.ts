// Meta sync failure classification and grouping (issue #166).
//
// A finished batch is a list of CLIENT-MONTH items, not clients. Production
// showed "Clients succeeded: 67 of 74" next to "across 37 clients, 2 months" —
// 74 is month-items, 37 is clients. Everything here keeps those two units
// separate, groups failures by client, and turns raw provider text
// (AbortError, OAuthException, Graph URLs) into something a person can act on.
//
// The full original text is never discarded — it is carried through as
// `diagnostics` for the expandable admin detail.

export type MetaFailureCategory = 'transient' | 'permission' | 'stage'

export type MetaPlatformState = 'pending' | 'facts_pending' | 'complete' | 'failed' | 'not_applicable' | string

export interface MetaFailedItemInput {
  id: string
  clientId: string
  clientName: string
  month: string
  error: string | null
  warnings: string[]
  facebookState: MetaPlatformState
  instagramState: MetaPlatformState
  postsSynced: number
  attempts: number
}

export interface MetaFailureVerdict {
  category: MetaFailureCategory
  /** Which platform stage failed, when that is knowable. */
  stage: 'facebook' | 'instagram' | 'both' | 'unknown'
  /** Short, plain sentence. Never contains raw provider text. */
  headline: string
  /** What the admin should do. Empty when the answer is simply "retry". */
  action: string
  /** Only transient failures may be retried automatically. */
  retryable: boolean
  /** Every original string, preserved for the expandable detail. */
  diagnostics: string[]
}

const PLATFORM_LABEL: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram' }

// ── Signals ─────────────────────────────────────────────────────────────────
// Ordered permission-first: an OAuth permission error can also mention a page
// fetch, and misreading it as transient would retry forever against a wall.

/** Meta permission / configuration problems. A retry cannot fix these. */
const PERMISSION_SIGNALS = [
  /pages_read_user_content/i,
  /page public content access/i,
  /oauthexception/i,
  /\brequires the '[^']+' permission/i,
  /access token/i,
  /\b(401|403)\b/,
  /permission/i,
]

/** Temporary conditions. The same request later usually succeeds. */
const TRANSIENT_SIGNALS = [
  /aborterror/i,
  /signal has been aborted/i,
  /rate.?limit/i,
  /\bpaused (to preserve|before page)/i,
  /worker lease budget/i,
  /timeout|timed out/i,
  /\b(429|500|502|503|504)\b/,
  /temporarily unavailable/i,
]

function matches(patterns: RegExp[], haystack: string): boolean {
  return patterns.some(pattern => pattern.test(haystack))
}

function failedStage(fb: MetaPlatformState, ig: MetaPlatformState): MetaFailureVerdict['stage'] {
  const fbFailed = fb === 'failed'
  const igFailed = ig === 'failed'
  if (fbFailed && igFailed) return 'both'
  if (fbFailed) return 'facebook'
  if (igFailed) return 'instagram'
  return 'unknown'
}

function preservedNote(item: MetaFailedItemInput, stage: MetaFailureVerdict['stage']): string {
  // The other platform often completed. Saying so stops an admin assuming the
  // whole month is missing.
  const other = stage === 'facebook' ? item.instagramState : stage === 'instagram' ? item.facebookState : null
  if (other !== 'complete' || item.postsSynced <= 0) return ''
  const otherLabel = stage === 'facebook' ? 'Instagram' : 'Facebook'
  return ` ${otherLabel} data was collected and kept (${item.postsSynced} post${item.postsSynced === 1 ? '' : 's'}).`
}

/**
 * Classify one failed client-month item.
 *
 * Reads the item error AND its warnings: production stores the real cause in
 * `warnings` while `error` is often the generic rollup "One or more Meta
 * platform stages failed", which on its own says nothing useful.
 */
export function classifyMetaFailure(item: MetaFailedItemInput): MetaFailureVerdict {
  const diagnostics = [item.error, ...item.warnings].filter((v): v is string => Boolean(v && v.trim()))
  const haystack = diagnostics.join(' • ')
  const stage = failedStage(item.facebookState, item.instagramState)
  const stageLabel = stage === 'both' ? 'Facebook and Instagram' : PLATFORM_LABEL[stage] ?? ''

  if (matches(PERMISSION_SIGNALS, haystack)) {
    const needsPageContent = /pages_read_user_content|page public content access/i.test(haystack)
    return {
      category: 'permission',
      stage,
      headline: stageLabel
        ? `${stageLabel} access was refused by Meta.`
        : 'Meta refused access for this client.',
      action: needsPageContent
        ? "Reconnect this client's Facebook Page and grant the pages_read_user_content permission (or Page Public Content Access) to the CG Dynamics app, then sync this client again."
        : "Reconnect this client's Meta account and re-authorise the CG Dynamics app, then sync this client again.",
      // Never retried automatically: it would fail identically every time.
      retryable: false,
      diagnostics,
    }
  }

  if (matches(TRANSIENT_SIGNALS, haystack)) {
    return {
      category: 'transient',
      stage,
      headline: stageLabel
        ? `${stageLabel} did not finish — Meta was slow or rate-limiting.${preservedNote(item, stage)}`
        : `The sync did not finish — Meta was slow or rate-limiting.`,
      action: '',
      retryable: true,
      diagnostics,
    }
  }

  return {
    category: 'stage',
    stage,
    headline: stageLabel
      ? `The ${stageLabel} stage failed for a reason Meta did not explain.${preservedNote(item, stage)}`
      : 'A sync stage failed for a reason Meta did not explain.',
    action: stageLabel
      ? `Retry this client. If ${stageLabel} keeps failing, check the linked ${stageLabel} asset on the client.`
      : 'Retry this client. If it keeps failing, check the linked Meta assets on the client.',
    // Unexplained, but not proven permanent — a retry is allowed and is the
    // only way to learn whether it was a one-off.
    retryable: true,
    diagnostics,
  }
}

// ── Grouping ────────────────────────────────────────────────────────────────

export interface MetaFailureGroup {
  clientId: string
  clientName: string
  /** Every affected month for this client, ascending. */
  months: string[]
  itemIds: string[]
  category: MetaFailureCategory
  stage: MetaFailureVerdict['stage']
  headline: string
  action: string
  retryable: boolean
  diagnostics: string[]
}

const CATEGORY_RANK: Record<MetaFailureCategory, number> = { permission: 0, stage: 1, transient: 2 }

/**
 * One row per client, not per client-month. Production listed AV Event Life
 * twice because two of its months failed; that reads as two broken clients.
 *
 * A client whose months failed for different reasons takes the most serious
 * category, so a permission problem is never hidden behind a retryable one —
 * and the group is only offered for retry when EVERY month in it is retryable.
 */
export function groupMetaFailuresByClient(items: MetaFailedItemInput[]): MetaFailureGroup[] {
  const groups = new Map<string, MetaFailureGroup>()

  for (const item of items) {
    const verdict = classifyMetaFailure(item)
    const key = item.clientId || item.clientName
    const existing = groups.get(key)

    if (!existing) {
      groups.set(key, {
        clientId: item.clientId,
        clientName: item.clientName,
        months: [item.month],
        itemIds: [item.id],
        category: verdict.category,
        stage: verdict.stage,
        headline: verdict.headline,
        action: verdict.action,
        retryable: verdict.retryable,
        diagnostics: [...verdict.diagnostics],
      })
      continue
    }

    if (!existing.months.includes(item.month)) existing.months.push(item.month)
    existing.itemIds.push(item.id)
    for (const line of verdict.diagnostics) {
      if (!existing.diagnostics.includes(line)) existing.diagnostics.push(line)
    }
    // Worst category wins, and one non-retryable month blocks the whole group.
    if (CATEGORY_RANK[verdict.category] < CATEGORY_RANK[existing.category]) {
      existing.category = verdict.category
      existing.stage = verdict.stage
      existing.headline = verdict.headline
      existing.action = verdict.action
    }
    existing.retryable = existing.retryable && verdict.retryable
  }

  for (const group of groups.values()) group.months.sort()

  return [...groups.values()].sort(
    (a, b) => CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] || a.clientName.localeCompare(b.clientName),
  )
}

// ── Truthful terminal counters ──────────────────────────────────────────────

export interface MetaTerminalTotals {
  /** Client-month rows attempted. */
  itemsAttempted: number
  itemsSucceeded: number
  itemsFailed: number
  /** Distinct clients — always <= itemsAttempted. */
  clientsAttempted: number
  clientsSucceeded: number
  clientsFailed: number
  monthsCovered: number
  postsSynced: number
  reportsCreated: number
  reportsReused: number
}

export interface MetaTerminalItem {
  clientId: string
  clientName: string
  month: string
  status: string
  postsSynced?: number | null
  reportsCreated?: number | null
  reportsReused?: number | null
}

/**
 * Counts items and clients separately.
 *
 * A client counts as failed if ANY of its months failed, and as succeeded only
 * if none did — so the two numbers always add up to the client total.
 */
export function summariseMetaTerminalResult(items: MetaTerminalItem[]): MetaTerminalTotals {
  const clientsWithFailure = new Set<string>()
  const allClients = new Set<string>()
  const months = new Set<string>()
  const totals: MetaTerminalTotals = {
    itemsAttempted: items.length,
    itemsSucceeded: 0,
    itemsFailed: 0,
    clientsAttempted: 0,
    clientsSucceeded: 0,
    clientsFailed: 0,
    monthsCovered: 0,
    postsSynced: 0,
    reportsCreated: 0,
    reportsReused: 0,
  }

  for (const item of items) {
    const key = item.clientId || item.clientName
    allClients.add(key)
    months.add(item.month)
    totals.postsSynced += item.postsSynced ?? 0
    totals.reportsCreated += item.reportsCreated ?? 0
    totals.reportsReused += item.reportsReused ?? 0
    if (item.status === 'completed' || item.status === 'warning') totals.itemsSucceeded++
    else if (item.status === 'failed') { totals.itemsFailed++; clientsWithFailure.add(key) }
  }

  totals.clientsAttempted = allClients.size
  totals.clientsFailed = clientsWithFailure.size
  totals.clientsSucceeded = allClients.size - clientsWithFailure.size
  totals.monthsCovered = months.size
  return totals
}
