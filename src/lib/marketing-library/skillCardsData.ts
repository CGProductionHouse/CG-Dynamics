import { supabase } from '../supabase'
import type {
  ConfidenceLevel,
  EvidenceLabel,
  IndustryTag,
  KnowledgeLayer,
  RelevantAgent,
  SkillCardStatus,
  SourceType,
} from '../../types/skillCards'

// ── Marketing Library data access (AI Workforce foundation) ───────────────────
//
// Typed reads and admin CRUD over the phase-18a tables. Row shapes mirror the
// SQL columns (snake_case); the shared union types in ../../types/skillCards
// keep the enum values in one place. No UI, no Assistant wiring, no seed data.
//
// RLS does the real enforcement (admin manages all; staff read active shared
// cards; clients none). These helpers never bypass it — they use the standard
// anon/authenticated client. Before phase-18a is applied the tables do not
// exist; every call reports `migrationNeeded` instead of throwing.

export type SourceTrustTier =
  | 'tier_1_primary'
  | 'tier_2_trusted_professional'
  | 'tier_3_internal_learning'
  | 'tier_4_low_trust'
  | 'needs_review'

export type SkillCardReviewStatus =
  | 'needs_review'
  | 'approved'
  | 'changes_requested'
  | 'rejected'
  | 'deprecated'

export interface MarketingLibrarySource {
  id: string
  source_type: SourceType
  source_name: string
  author_or_organisation: string | null
  title: string | null
  publication_year: number | null
  chapter_or_section: string | null
  page_or_url: string | null
  notes: string | null
  trust_tier: SourceTrustTier
  created_at: string
  updated_at: string
}

export interface SkillCardRecord {
  id: string
  slug: string
  title: string
  category: string
  subcategory: string | null
  status: SkillCardStatus
  knowledge_layer: KnowledgeLayer
  source_id: string | null
  source_type: SourceType
  confidence_level: ConfidenceLevel
  evidence_label: EvidenceLabel
  principle: string
  summary: string
  why_it_matters: string | null
  how_to_apply: string[]
  examples: string[]
  mistakes_to_avoid: string[]
  agent_instructions: string[]
  relevant_industries: IndustryTag[]
  relevant_agents: RelevantAgent[]
  related_card_ids: string[]
  client_specific: boolean
  active_client_id: string | null
  notes: string | null
  owner: string | null
  last_reviewed: string | null
  created_at: string
  updated_at: string
}

export interface SkillCardReviewRecord {
  id: string
  skill_card_id: string
  reviewed_by: string | null
  review_status: SkillCardReviewStatus
  review_notes: string | null
  reviewed_at: string
}

// Insert shapes: the columns a caller must/ may provide. DB defaults cover the
// rest (status, jsonb arrays, timestamps).
export interface MarketingLibrarySourceInput {
  source_type: SourceType
  source_name: string
  author_or_organisation?: string | null
  title?: string | null
  publication_year?: number | null
  chapter_or_section?: string | null
  page_or_url?: string | null
  notes?: string | null
  trust_tier?: SourceTrustTier
}

export interface SkillCardInput {
  slug: string
  title: string
  category: string
  knowledge_layer: KnowledgeLayer
  source_type: SourceType
  principle: string
  summary: string
  subcategory?: string | null
  status?: SkillCardStatus
  source_id?: string | null
  confidence_level?: ConfidenceLevel
  evidence_label?: EvidenceLabel
  why_it_matters?: string | null
  how_to_apply?: string[]
  examples?: string[]
  mistakes_to_avoid?: string[]
  agent_instructions?: string[]
  relevant_industries?: IndustryTag[]
  relevant_agents?: RelevantAgent[]
  related_card_ids?: string[]
  client_specific?: boolean
  active_client_id?: string | null
  notes?: string | null
  owner?: string | null
  last_reviewed?: string | null
}

export interface SkillCardReviewInput {
  skill_card_id: string
  review_status: SkillCardReviewStatus
  reviewed_by?: string | null
  review_notes?: string | null
}

export interface QueryResult<T> {
  data: T
  error: string | null
  /** True when phase-18a has not been applied yet (tables absent). */
  migrationNeeded: boolean
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  // 42P01 = undefined_table. PostgREST also surfaces a schema-cache miss.
  if (error.code === '42P01') return true
  const message = (error.message ?? '').toLowerCase()
  return (
    (message.includes('marketing_library_sources') ||
      message.includes('skill_card') ||
      message.includes('skill_cards')) &&
    (message.includes('does not exist') || message.includes('schema cache') || message.includes('could not find'))
  )
}

function result<T>(data: T, error: { code?: string; message?: string } | null, fallback: T): QueryResult<T> {
  if (error) {
    if (isMissingTableError(error)) return { data: fallback, error: null, migrationNeeded: true }
    return { data: fallback, error: error.message ?? 'Marketing Library request failed.', migrationNeeded: false }
  }
  return { data, error: null, migrationNeeded: false }
}

// ── Sources (admin only by RLS) ───────────────────────────────────────────────

export async function listMarketingLibrarySources(): Promise<QueryResult<MarketingLibrarySource[]>> {
  const { data, error } = await supabase
    .from('marketing_library_sources')
    .select('*')
    .order('created_at', { ascending: false })
  return result((data ?? []) as MarketingLibrarySource[], error, [])
}

export async function createMarketingLibrarySource(
  input: MarketingLibrarySourceInput,
): Promise<QueryResult<MarketingLibrarySource | null>> {
  const { data, error } = await supabase
    .from('marketing_library_sources')
    .insert(input)
    .select('*')
    .single()
  return result((data as MarketingLibrarySource) ?? null, error, null)
}

export async function updateMarketingLibrarySource(
  id: string,
  patch: Partial<MarketingLibrarySourceInput>,
): Promise<QueryResult<MarketingLibrarySource | null>> {
  const { data, error } = await supabase
    .from('marketing_library_sources')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  return result((data as MarketingLibrarySource) ?? null, error, null)
}

export async function deleteMarketingLibrarySource(id: string): Promise<QueryResult<boolean>> {
  const { error } = await supabase.from('marketing_library_sources').delete().eq('id', id)
  return result(!error, error, false)
}

// ── Skill Cards ───────────────────────────────────────────────────────────────

// Admin view: every card regardless of status or client scope (RLS admin policy).
export async function listSkillCards(): Promise<QueryResult<SkillCardRecord[]>> {
  const { data, error } = await supabase
    .from('skill_cards')
    .select('*')
    .order('updated_at', { ascending: false })
  return result((data ?? []) as SkillCardRecord[], error, [])
}

// Staff-safe view: active, non-client-specific cards only. Mirrors the staff
// RLS read policy so the same call is safe for any staff role. (Admins may also
// use it when they only want the shared, active set.)
export async function listActiveSharedSkillCards(): Promise<QueryResult<SkillCardRecord[]>> {
  const { data, error } = await supabase
    .from('skill_cards')
    .select('*')
    .eq('status', 'active')
    .eq('client_specific', false)
    .order('category', { ascending: true })
  return result((data ?? []) as SkillCardRecord[], error, [])
}

export async function createSkillCard(input: SkillCardInput): Promise<QueryResult<SkillCardRecord | null>> {
  const { data, error } = await supabase.from('skill_cards').insert(input).select('*').single()
  return result((data as SkillCardRecord) ?? null, error, null)
}

export async function updateSkillCard(
  id: string,
  patch: Partial<SkillCardInput>,
): Promise<QueryResult<SkillCardRecord | null>> {
  const { data, error } = await supabase.from('skill_cards').update(patch).eq('id', id).select('*').single()
  return result((data as SkillCardRecord) ?? null, error, null)
}

export async function deleteSkillCard(id: string): Promise<QueryResult<boolean>> {
  const { error } = await supabase.from('skill_cards').delete().eq('id', id)
  return result(!error, error, false)
}

// ── Reviews (admin only by RLS) ───────────────────────────────────────────────

export async function listSkillCardReviews(skillCardId: string): Promise<QueryResult<SkillCardReviewRecord[]>> {
  const { data, error } = await supabase
    .from('skill_card_reviews')
    .select('*')
    .eq('skill_card_id', skillCardId)
    .order('reviewed_at', { ascending: false })
  return result((data ?? []) as SkillCardReviewRecord[], error, [])
}

export async function createSkillCardReview(
  input: SkillCardReviewInput,
): Promise<QueryResult<SkillCardReviewRecord | null>> {
  const { data, error } = await supabase.from('skill_card_reviews').insert(input).select('*').single()
  return result((data as SkillCardReviewRecord) ?? null, error, null)
}

// ── Activation readiness + review lifecycle ───────────────────────────────────
//
// The database gate (phase-18c) is the real guard; these mirror it so the UI
// can show requirements and only offer Activate when they pass. Keeping the
// rule in one pure function keeps client and server in agreement.

export type SkillCardReviewAction = 'approve' | 'request_changes' | 'reject' | 'deprecate'

// Trust tiers that are NOT trusted enough to activate a card.
export const BLOCKED_ACTIVATION_TRUST_TIERS: SourceTrustTier[] = ['needs_review', 'tier_4_low_trust']

export interface SkillCardActivationReadiness {
  ready: boolean
  hasSource: boolean
  sourceTrustAcceptable: boolean
  hasApprovedReview: boolean
  lastReviewedSet: boolean
  /** Human-readable missing requirements, empty when ready. */
  missing: string[]
}

// Pure activation-readiness check. Mirrors phase-18c exactly:
// linked source + trusted tier + an approved review + a last_reviewed date.
export function evaluateSkillCardActivation(
  card: Pick<SkillCardRecord, 'source_id' | 'last_reviewed'>,
  source: Pick<MarketingLibrarySource, 'trust_tier'> | null,
  reviews: Array<Pick<SkillCardReviewRecord, 'review_status'>>,
): SkillCardActivationReadiness {
  const hasSource = Boolean(card.source_id)
  const sourceTrustAcceptable = hasSource && source != null && !BLOCKED_ACTIVATION_TRUST_TIERS.includes(source.trust_tier)
  const hasApprovedReview = reviews.some(review => review.review_status === 'approved')
  const lastReviewedSet = Boolean(card.last_reviewed)

  const missing: string[] = []
  if (!hasSource) missing.push('Link a source')
  else if (source == null) missing.push('Linked source could not be loaded to verify its trust tier')
  else if (!sourceTrustAcceptable) missing.push('Source trust tier must not be "needs review" or "tier 4 low trust"')
  if (!hasApprovedReview) missing.push('At least one approved review')
  if (!lastReviewedSet) missing.push('Last reviewed date must be set')

  return {
    ready: hasSource && sourceTrustAcceptable && hasApprovedReview && lastReviewedSet,
    hasSource,
    sourceTrustAcceptable,
    hasApprovedReview,
    lastReviewedSet,
    missing,
  }
}

// Load the card, its linked source and its reviews, then evaluate readiness.
export async function checkSkillCardActivationReadiness(
  cardId: string,
): Promise<QueryResult<SkillCardActivationReadiness | null>> {
  const { data: card, error: cardError } = await supabase
    .from('skill_cards')
    .select('source_id, last_reviewed')
    .eq('id', cardId)
    .single()
  if (cardError) return result(null, cardError, null)
  const cardRow = card as Pick<SkillCardRecord, 'source_id' | 'last_reviewed'>

  let source: Pick<MarketingLibrarySource, 'trust_tier'> | null = null
  if (cardRow.source_id) {
    const { data: sourceRow, error: sourceError } = await supabase
      .from('marketing_library_sources')
      .select('trust_tier')
      .eq('id', cardRow.source_id)
      .single()
    if (sourceError) return result(null, sourceError, null)
    source = (sourceRow as { trust_tier: SourceTrustTier } | null) ?? null
  }

  const { data: reviews, error: reviewError } = await supabase
    .from('skill_card_reviews')
    .select('review_status')
    .eq('skill_card_id', cardId)
  if (reviewError) return result(null, reviewError, null)

  const readiness = evaluateSkillCardActivation(cardRow, source, (reviews ?? []) as Array<Pick<SkillCardReviewRecord, 'review_status'>>)
  return { data: readiness, error: null, migrationNeeded: false }
}

// Maps each review action to the review row it logs and the card status it sets.
const REVIEW_ACTION_MAP: Record<SkillCardReviewAction, { review: SkillCardReviewStatus; card: SkillCardStatus; setLastReviewed: boolean }> = {
  approve: { review: 'approved', card: 'reviewed', setLastReviewed: true },
  request_changes: { review: 'changes_requested', card: 'needs_review', setLastReviewed: false },
  reject: { review: 'rejected', card: 'draft', setLastReviewed: false },
  deprecate: { review: 'deprecated', card: 'deprecated', setLastReviewed: false },
}

// Record a review action: log the review (note required), then move the card to
// the matching status. Never activates — activation is a separate gated step.
export async function submitSkillCardReviewAction(params: {
  skillCardId: string
  action: SkillCardReviewAction
  note: string
  reviewedBy?: string | null
}): Promise<QueryResult<SkillCardRecord | null>> {
  const note = params.note.trim()
  if (!note) return { data: null, error: 'A short review note is required.', migrationNeeded: false }

  const mapping = REVIEW_ACTION_MAP[params.action]
  const reviewResponse = await createSkillCardReview({
    skill_card_id: params.skillCardId,
    review_status: mapping.review,
    reviewed_by: params.reviewedBy ?? null,
    review_notes: note,
  })
  if (reviewResponse.error || reviewResponse.migrationNeeded) {
    return { data: null, error: reviewResponse.error, migrationNeeded: reviewResponse.migrationNeeded }
  }

  const patch: Partial<SkillCardInput> = { status: mapping.card }
  if (mapping.setLastReviewed) patch.last_reviewed = new Date().toISOString().slice(0, 10)
  return updateSkillCard(params.skillCardId, patch)
}

// Activate a card only after readiness passes. The phase-18c trigger is the
// authoritative backstop; this pre-check gives a clear message without a write.
export async function activateSkillCard(cardId: string): Promise<QueryResult<SkillCardRecord | null>> {
  const readiness = await checkSkillCardActivationReadiness(cardId)
  if (readiness.error || readiness.migrationNeeded) {
    return { data: null, error: readiness.error, migrationNeeded: readiness.migrationNeeded }
  }
  if (!readiness.data || !readiness.data.ready) {
    return { data: null, error: `Cannot activate: ${readiness.data?.missing.join('; ') ?? 'requirements not met'}.`, migrationNeeded: false }
  }
  return updateSkillCard(cardId, { status: 'active' })
}
