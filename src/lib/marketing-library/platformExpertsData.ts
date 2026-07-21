import { supabase } from '../supabase'
import type { ConfidenceLevel } from '../../types/skillCards'

// ── Platform Experts data access (AI Workforce foundation) ────────────────────
//
// Typed reads and admin CRUD over the phase-18b tables (experts, surfaces,
// knowledge items). All access uses the normal Supabase client and respects
// RLS (admin manages all; staff read active platforms/surfaces and only
// current, non-expired knowledge; clients none). Before phase-18b is applied
// the tables do not exist; every call reports `migrationNeeded` instead of
// throwing. No Assistant retrieval, no research automation, no deletes.

export type PlatformKnowledgeState =
  | 'verified_current'
  | 'observed_current'
  | 'experimental'
  | 'disputed'
  | 'stale'
  | 'retired'

export interface PlatformExpert {
  id: string
  name: string
  slug: string
  active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PlatformSurface {
  id: string
  platform_expert_id: string
  surface_key: string
  name: string
  user_intent: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface PlatformKnowledgeItem {
  id: string
  platform_expert_id: string
  surface_id: string | null
  source_id: string | null
  title: string
  principle: string
  application: string | null
  limitations: string | null
  knowledge_state: PlatformKnowledgeState
  confidence: ConfidenceLevel
  territory: string | null
  researched_at: string | null
  last_verified_at: string | null
  expires_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PlatformExpertInput {
  name: string
  slug: string
  active?: boolean
  notes?: string | null
}

export interface PlatformSurfaceInput {
  platform_expert_id: string
  surface_key: string
  name: string
  user_intent?: string | null
  active?: boolean
}

export interface PlatformKnowledgeItemInput {
  platform_expert_id: string
  title: string
  principle: string
  surface_id?: string | null
  source_id?: string | null
  application?: string | null
  limitations?: string | null
  knowledge_state?: PlatformKnowledgeState
  confidence?: ConfidenceLevel
  territory?: string | null
  researched_at?: string | null
  last_verified_at?: string | null
  expires_at?: string | null
  notes?: string | null
}

export interface QueryResult<T> {
  data: T
  error: string | null
  /** True when phase-18b has not been applied yet (tables absent). */
  migrationNeeded: boolean
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  // 42P01 = undefined_table. PostgREST also surfaces a schema-cache miss.
  if (error.code === '42P01') return true
  const message = (error.message ?? '').toLowerCase()
  return message.includes('platform_') && (message.includes('does not exist') || message.includes('schema cache') || message.includes('could not find'))
}

function result<T>(data: T, error: { code?: string; message?: string } | null, fallback: T): QueryResult<T> {
  if (error) {
    if (isMissingTableError(error)) return { data: fallback, error: null, migrationNeeded: true }
    return { data: fallback, error: error.message ?? 'Platform Expert request failed.', migrationNeeded: false }
  }
  return { data, error: null, migrationNeeded: false }
}

// ── Platforms ─────────────────────────────────────────────────────────────────

export async function listPlatformExperts(): Promise<QueryResult<PlatformExpert[]>> {
  const { data, error } = await supabase.from('platform_experts').select('*').order('name', { ascending: true })
  return result((data ?? []) as PlatformExpert[], error, [])
}

export async function createPlatformExpert(input: PlatformExpertInput): Promise<QueryResult<PlatformExpert | null>> {
  const { data, error } = await supabase.from('platform_experts').insert(input).select('*').single()
  return result((data as PlatformExpert) ?? null, error, null)
}

export async function updatePlatformExpert(
  id: string,
  patch: Partial<PlatformExpertInput>,
): Promise<QueryResult<PlatformExpert | null>> {
  const { data, error } = await supabase.from('platform_experts').update(patch).eq('id', id).select('*').single()
  return result((data as PlatformExpert) ?? null, error, null)
}

// ── Surfaces ──────────────────────────────────────────────────────────────────

export async function listPlatformSurfaces(platformExpertId?: string): Promise<QueryResult<PlatformSurface[]>> {
  let query = supabase.from('platform_surfaces').select('*').order('name', { ascending: true })
  if (platformExpertId) query = query.eq('platform_expert_id', platformExpertId)
  const { data, error } = await query
  return result((data ?? []) as PlatformSurface[], error, [])
}

export async function createPlatformSurface(input: PlatformSurfaceInput): Promise<QueryResult<PlatformSurface | null>> {
  const { data, error } = await supabase.from('platform_surfaces').insert(input).select('*').single()
  return result((data as PlatformSurface) ?? null, error, null)
}

export async function updatePlatformSurface(
  id: string,
  patch: Partial<PlatformSurfaceInput>,
): Promise<QueryResult<PlatformSurface | null>> {
  const { data, error } = await supabase.from('platform_surfaces').update(patch).eq('id', id).select('*').single()
  return result((data as PlatformSurface) ?? null, error, null)
}

// ── Knowledge items ───────────────────────────────────────────────────────────

export async function listPlatformKnowledgeItems(platformExpertId?: string): Promise<QueryResult<PlatformKnowledgeItem[]>> {
  let query = supabase.from('platform_knowledge_items').select('*').order('updated_at', { ascending: false })
  if (platformExpertId) query = query.eq('platform_expert_id', platformExpertId)
  const { data, error } = await query
  return result((data ?? []) as PlatformKnowledgeItem[], error, [])
}

// Staff-safe view: mirrors the RLS read policy — current, non-expired knowledge
// only. Admins may also use it to see what staff/agents would actually get.
export async function listCurrentStaffSafeKnowledge(platformExpertId?: string): Promise<QueryResult<PlatformKnowledgeItem[]>> {
  const today = new Date().toISOString().slice(0, 10)
  let query = supabase
    .from('platform_knowledge_items')
    .select('*')
    .in('knowledge_state', ['verified_current', 'observed_current'])
    .or(`expires_at.is.null,expires_at.gte.${today}`)
    .order('updated_at', { ascending: false })
  if (platformExpertId) query = query.eq('platform_expert_id', platformExpertId)
  const { data, error } = await query
  return result((data ?? []) as PlatformKnowledgeItem[], error, [])
}

export async function createPlatformKnowledgeItem(
  input: PlatformKnowledgeItemInput,
): Promise<QueryResult<PlatformKnowledgeItem | null>> {
  const { data, error } = await supabase.from('platform_knowledge_items').insert(input).select('*').single()
  return result((data as PlatformKnowledgeItem) ?? null, error, null)
}

export async function updatePlatformKnowledgeItem(
  id: string,
  patch: Partial<PlatformKnowledgeItemInput>,
): Promise<QueryResult<PlatformKnowledgeItem | null>> {
  const { data, error } = await supabase.from('platform_knowledge_items').update(patch).eq('id', id).select('*').single()
  return result((data as PlatformKnowledgeItem) ?? null, error, null)
}

// ── Small display helpers (pure) ──────────────────────────────────────────────

export function isKnowledgeExpired(item: Pick<PlatformKnowledgeItem, 'expires_at'>, today = new Date()): boolean {
  if (!item.expires_at) return false
  return item.expires_at < today.toISOString().slice(0, 10)
}

// "Effectively stale" = explicitly stale/retired, or past its expiry date.
export function isKnowledgeStale(item: Pick<PlatformKnowledgeItem, 'knowledge_state' | 'expires_at'>, today = new Date()): boolean {
  if (item.knowledge_state === 'stale' || item.knowledge_state === 'retired') return true
  return isKnowledgeExpired(item, today)
}
