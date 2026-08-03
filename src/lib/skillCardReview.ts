import { supabase } from './supabase'

// Skill Card admin review.
//
// All reads and writes go through admin-gated SECURITY DEFINER RPCs. The
// activation trigger in the database remains the only thing that can actually
// let a card into production — nothing here re-implements or relaxes it, and
// there is deliberately no bulk-activation call.

export type ReviewDecision = 'approved' | 'changes_requested' | 'rejected' | 'deprecated' | 'needs_review'

export interface SkillCardReviewRow {
  id: string
  slug: string
  title: string
  category: string | null
  subcategory: string | null
  status: 'draft' | 'needs_review' | 'reviewed' | 'active' | 'deprecated'
  knowledge_layer: string | null
  principle: string | null
  summary: string | null
  why_it_matters: string | null
  how_to_apply: string | null
  agent_instructions: string | null
  safe_claim: string | null
  prohibited_overclaim: string | null
  jurisdiction: string | null
  evidence_label: string | null
  confidence_level: string | null
  source_reference: string | null
  reference_state: string | null
  relevant_agents: string[] | null
  resolved_agents: string[]
  unrecognised_agents: string[]
  relevant_industries: string[] | null
  client_specific: boolean
  active_client_id: string | null
  active_client_name: string | null
  active_client_is_active: boolean | null
  source_id: string | null
  source_name: string | null
  source_trust_tier: string | null
  last_reviewed: string | null
  review_expires_at: string | null
  review_count: number
  approved_review_count: number
  latest_review_status: string | null
  latest_review_by: string | null
  latest_review_notes: string | null
  latest_reviewed_at: string | null
  blockers: string[]
  ready_to_activate: boolean
  priority_group: 1 | 2 | 3 | 4
}

/** The agreed first-review order. Group 4 is deliberately left for later. */
export const PRIORITY_GROUPS: Record<number, { label: string; hint: string }> = {
  1: { label: 'Music & platform-rights safety', hint: 'Review first — these prevent real legal and platform risk.' },
  2: { label: 'Universal marketing principles', hint: 'Evidence, specificity, offer and customer clarity.' },
  3: { label: 'Client-specific claim safety', hint: 'Verified product limits and claim safety. Needs an exact active client.' },
  4: { label: 'Leave for later', hint: 'Broad agriculture observations and unsupported historical claims — not for this pass.' },
}

/** Fields a reviewer may soften before approving. Nothing structural. */
export const EDITABLE_FIELDS = [
  'principle', 'summary', 'why_it_matters', 'how_to_apply', 'agent_instructions',
  'safe_claim', 'prohibited_overclaim', 'jurisdiction',
] as const
export type EditableField = typeof EDITABLE_FIELDS[number]

export interface ReadinessSummary {
  total: number
  active: number
  needsReview: number
  readyToActivate: number
  blockedMissingSource: number
  blockedMissingApprovedReview: number
  blockedMissingLastReviewed: number
  blockedUnsafeTrust: number
}

export async function loadSkillCardReviewQueue() {
  return supabase.rpc('skill_card_review_queue')
}

/** Compact readiness counts, derived from the server-computed blockers. */
export function summariseReadiness(rows: SkillCardReviewRow[]): ReadinessSummary {
  const has = (r: SkillCardReviewRow, needle: string) => r.blockers.some(b => b.includes(needle))
  return {
    total: rows.length,
    active: rows.filter(r => r.status === 'active').length,
    needsReview: rows.filter(r => r.status === 'needs_review').length,
    readyToActivate: rows.filter(r => r.ready_to_activate).length,
    blockedMissingSource: rows.filter(r => has(r, 'No linked source')).length,
    blockedMissingApprovedReview: rows.filter(r => has(r, 'No approved review')).length,
    blockedMissingLastReviewed: rows.filter(r => has(r, 'No last-reviewed date')).length,
    blockedUnsafeTrust: rows.filter(r => has(r, 'not trusted enough')).length,
  }
}

/**
 * Record a review decision. Optionally applies reviewer wording edits first so
 * overconfident or absolute phrasing can be softened before approval. This
 * never activates a card.
 */
export async function recordSkillCardReview(input: {
  cardId: string
  decision: ReviewDecision
  note?: string
  edits?: Partial<Record<EditableField, string>>
}) {
  return supabase.rpc('skill_card_record_review', {
    p_card_id: input.cardId,
    p_decision: input.decision,
    p_note: input.note ?? null,
    p_edits: input.edits && Object.keys(input.edits).length > 0 ? input.edits : null,
  })
}

/** Activate exactly one card. The database gate decides; there is no bulk path. */
export async function activateSkillCard(cardId: string) {
  return supabase.rpc('skill_card_activate', { p_card_id: cardId })
}

// ── Filters ─────────────────────────────────────────────────────────────────

export type StatusFilter =
  | 'all' | 'needs_review' | 'activation_blocked' | 'ready_to_activate' | 'active' | 'client_specific'

export interface QueueFilters {
  status: StatusFilter
  specialist: string   // '' = any
  trust: string        // '' = any
  expiry: string       // '' any | 'expired' | 'expiring_90' | 'none'
  search: string
}

export const EMPTY_FILTERS: QueueFilters = {
  status: 'all', specialist: '', trust: '', expiry: '', search: '',
}

export function applyQueueFilters(rows: SkillCardReviewRow[], f: QueueFilters): SkillCardReviewRow[] {
  const now = Date.now()
  return rows.filter(r => {
    if (f.status === 'needs_review' && r.status !== 'needs_review') return false
    if (f.status === 'active' && r.status !== 'active') return false
    if (f.status === 'client_specific' && !r.client_specific) return false
    if (f.status === 'ready_to_activate' && !r.ready_to_activate) return false
    if (f.status === 'activation_blocked' && (r.status === 'active' || r.blockers.length === 0)) return false

    if (f.specialist && !r.resolved_agents.includes(f.specialist)) return false
    if (f.trust && (r.source_trust_tier ?? '(none)') !== f.trust) return false

    if (f.expiry === 'expired') {
      if (!r.review_expires_at || new Date(r.review_expires_at).getTime() >= now) return false
    } else if (f.expiry === 'expiring_90') {
      if (!r.review_expires_at) return false
      const t = new Date(r.review_expires_at).getTime()
      if (t < now || t > now + 90 * 86_400_000) return false
    } else if (f.expiry === 'none') {
      if (r.review_expires_at) return false
    }

    if (f.search) {
      const q = f.search.toLowerCase()
      const hay = [r.title, r.principle, r.summary, r.category, r.safe_claim].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

/**
 * The recommended first-review queue: the highest-priority cards that are not
 * active yet, in the agreed order. Nothing is auto-approved — this only decides
 * what to look at first.
 */
export function recommendedQueue(rows: SkillCardReviewRow[], limit = 12): SkillCardReviewRow[] {
  return rows
    .filter(r => r.status !== 'active' && r.status !== 'deprecated' && r.priority_group <= 3)
    .sort((a, b) => {
      if (a.priority_group !== b.priority_group) return a.priority_group - b.priority_group
      // Within a group, the closest to activation first.
      if (a.blockers.length !== b.blockers.length) return a.blockers.length - b.blockers.length
      return (a.title ?? '').localeCompare(b.title ?? '')
    })
    .slice(0, limit)
}

export function groupBy<K extends string>(rows: SkillCardReviewRow[], key: (r: SkillCardReviewRow) => K) {
  const out = new Map<K, SkillCardReviewRow[]>()
  for (const r of rows) {
    const k = key(r)
    const list = out.get(k)
    if (list) list.push(r)
    else out.set(k, [r])
  }
  return out
}
