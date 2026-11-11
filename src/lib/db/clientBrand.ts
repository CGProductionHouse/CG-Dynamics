import { supabase } from '../supabase'
import type { BrandColour, BrandRuleCategory, BrandRulePriority, ClientBrandRule } from '../brandRules'

// Staff-only client brand profiles and brand rules for video editors.
// Tables come from supabase/migrations/20261111090000_client_brand_profiles_and_rules.sql.
// Until that migration is applied every read reports `tableMissing` and the
// UI explains it instead of failing.

const PROFILE_TABLE = 'client_brand_profiles'
const RULE_TABLE = 'client_brand_rules'

export interface ClientBrandProfile {
  client_id: string
  canva_brand_kit_id: string | null
  colours: BrandColour[]
  fonts: string[]
  tone_voice: string | null
  visual_direction: string | null
  logo_notes: string | null
  source: 'manual' | 'canva'
  source_synced_at: string | null
  updated_at: string
}

export type ClientBrandProfilePatch = Pick<
  ClientBrandProfile,
  'canva_brand_kit_id' | 'colours' | 'fonts' | 'tone_voice' | 'visual_direction' | 'logo_notes'
>

interface Result<T> {
  data: T
  error: string | null
  tableMissing: boolean
}

function isTableMissing(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === '42P01' || code === 'PGRST205'
}

function message(error: unknown, fallback: string): string {
  const text = (error as { message?: string } | null)?.message
  if ((error as { code?: string } | null)?.code === '42501') return 'You do not have permission to change brand rules. Ask a manager.'
  return text || fallback
}

export async function getBrandProfile(clientId: string): Promise<Result<ClientBrandProfile | null>> {
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select('client_id, canva_brand_kit_id, colours, fonts, tone_voice, visual_direction, logo_notes, source, source_synced_at, updated_at')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error && isTableMissing(error)) return { data: null, error: null, tableMissing: true }
  if (error) return { data: null, error: message(error, 'Could not load the brand profile'), tableMissing: false }
  return { data: data as ClientBrandProfile | null, error: null, tableMissing: false }
}

// Managers only (enforced by RLS). Written on an explicit save, never inferred.
export async function saveBrandProfile(clientId: string, patch: ClientBrandProfilePatch): Promise<Result<ClientBrandProfile | null>> {
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .upsert({ ...patch, client_id: clientId, source: 'manual' }, { onConflict: 'client_id' })
    .select('client_id, canva_brand_kit_id, colours, fonts, tone_voice, visual_direction, logo_notes, source, source_synced_at, updated_at')
    .single()
  if (error && isTableMissing(error)) return { data: null, error: null, tableMissing: true }
  if (error) return { data: null, error: message(error, 'Could not save the brand profile'), tableMissing: false }
  return { data: data as ClientBrandProfile, error: null, tableMissing: false }
}

// Active rules for one client plus active house rules (client_id is null).
export async function listActiveBrandRules(clientId: string): Promise<Result<ClientBrandRule[]>> {
  // The id is interpolated into a PostgREST filter, so accept only a UUID.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
    return { data: [], error: 'Unknown client', tableMissing: false }
  }
  const { data, error } = await supabase
    .from(RULE_TABLE)
    .select('id, client_id, priority, category, rule, source, created_at, retired_at')
    .is('retired_at', null)
    .or(`client_id.eq.${clientId},client_id.is.null`)
    .order('created_at', { ascending: true })
  if (error && isTableMissing(error)) return { data: [], error: null, tableMissing: true }
  if (error) return { data: [], error: message(error, 'Could not load brand rules'), tableMissing: false }
  return { data: (data ?? []) as ClientBrandRule[], error: null, tableMissing: false }
}

export async function addBrandRule(input: {
  clientId: string | null
  priority: BrandRulePriority
  category: BrandRuleCategory
  rule: string
  source: string | null
}): Promise<{ error: string | null }> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return { error: 'Sign in again to add a rule' }
  const { error } = await supabase.from(RULE_TABLE).insert({
    client_id: input.clientId,
    priority: input.priority,
    category: input.category,
    rule: input.rule.trim(),
    source: input.source?.trim() || null,
    created_by: userId,
  })
  return { error: error ? message(error, 'Could not add the rule') : null }
}

// Managers only. Retiring keeps the rule in history; rules are never edited.
export async function retireBrandRule(ruleId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(RULE_TABLE)
    .update({ retired_at: new Date().toISOString() })
    .eq('id', ruleId)
    .is('retired_at', null)
  return { error: error ? message(error, 'Could not retire the rule') : null }
}
