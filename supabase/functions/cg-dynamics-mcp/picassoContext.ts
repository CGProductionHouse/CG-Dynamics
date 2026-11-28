import { PICASSO_VERSION, PICASSO_CHECKS, brandPackReadiness, designFingerprint } from '../_shared/picassoDesignSystem.ts'

// Structural subset used by both supabase-js and tests. Caller retains the
// authenticated staff client and exact-client resolution from get_client_context.
interface Query extends PromiseLike<{ data: unknown; error: unknown }> {
  select(columns: string): Query; eq(column: string, value: string): Query
  is(column: string, value: null): Query; or(filter: string): Query; maybeSingle(): Query
}
export interface PicassoReadClient { from(table: string): Query }
export async function loadPicassoContext(db: PicassoReadClient, clientId: string, scopeKey: string, now: string, briefEvidence: unknown = null) {
  const base = { system: 'PICASSO', version: PICASSO_VERSION, observedAt: now, checklist: PICASSO_CHECKS,
    instruction: 'Complete every applicable check with evidence before any internal send. Use the exact reviewed scope; no sibling fallback. Checklist completion is not human approval or send/publication authority.',
    normalChatGPTInvocationVerified: false }
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(clientId)) return { ...base, status: 'hold', reason: 'Exact client UUID required.' }
  const updates = (briefEvidence as { recordedUpdates?: { status?: string } } | null)?.recordedUpdates
  if (updates && updates.status !== 'available') return { ...base, status: 'hold', reason: 'Current recorded feedback unavailable. Do not treat unknown feedback as none.' }
  try {
    const [profile, rules] = await Promise.all([
      db.from('client_brand_profiles').select('client_id,design_pack,updated_at').eq('client_id', clientId).maybeSingle(),
      db.from('client_brand_rules').select('id,client_id,priority,category,rule,source,created_at,retired_at').is('retired_at', null).or(`client_id.eq.${clientId},client_id.is.null`),
    ])
    if (profile.error || rules.error) return { ...base, status: 'hold', reason: 'Exact-client Brand Pack/rules unavailable; no release or guessed fallback.' }
    const row = profile.data as { client_id?: string; design_pack?: unknown } | null
    if (row?.client_id !== clientId) return { ...base, status: 'hold', reason: 'Exact-client Brand Pack missing.' }
    const active = (Array.isArray(rules.data) ? rules.data : []).filter(r => r && (r.client_id === clientId || r.client_id === null) && r.retired_at === null).sort((a,b) => String(a.id).localeCompare(String(b.id)))
    const readiness = brandPackReadiness(row.design_pack, clientId, scopeKey, now)
    return { ...base, ...readiness, clientId, scopeKey, brandPack: row.design_pack, briefSha256: await designFingerprint(briefEvidence),
      packSha256: await designFingerprint(row.design_pack), rulesSha256: await designFingerprint(active), rules: active }
  } catch { return { ...base, status: 'hold', reason: 'Brand evidence read failed; retain the current work without delivery.' } }
}
