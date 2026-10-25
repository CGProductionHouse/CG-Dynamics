/* eslint-disable @typescript-eslint/no-explicit-any -- Existing structural Supabase query-builder boundary. */
import { matchClient, normaliseClientText } from '../../../src/lib/clientMatcher.ts'
import { containsRestrictedPlannerContent, deliverableIdentity } from '../../../src/lib/microsoftImportPreview.ts'
import { resolveMicrosoftPlanMapping } from '../../../src/lib/microsoftImportMap.ts'
import { isUuid } from './projectContext.ts'

type Db = { from: (table: string) => any; rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }
type Staff = { contextKind: string; profileId: string; role: string; connection: { userId: string; role: string }; supabase: Db }
const PAGE_SIZE = 50
const failure = () => ({ error: 'Captured schedule evidence is unavailable or changed. Re-read the exact source; no refresh, apply or fallback was attempted.', records: [], coverage: 'unknown', pagination: { has_more: null, next_offset: null } })
const text = (value: unknown, max = 512): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max
const date = (value: unknown) => value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value)

async function directoryRows(db: Db, table: 'clients' | 'client_aliases') {
  const seen = new Set<string>(), rows: Array<Record<string, any>> = []
  for (let offset = 0; offset < 100000; offset += 1000) {
    let query = db.from(table).select(table === 'clients' ? 'id,name,active' : 'id,client_id,alias')
    if (table === 'clients') query = query.eq('active', true)
    const result = await query.order('id').range(offset, offset + 999)
    if (result.error || !Array.isArray(result.data) || result.data.length > 1000) throw Error('Directory unavailable')
    for (const row of result.data) {
      if (!row || !isUuid(row.id) || seen.has(row.id)
        || (table === 'clients' ? row.active !== true || !text(row.name) : !isUuid(row.client_id) || !text(row.alias))) throw Error('Directory invalid')
      seen.add(row.id); rows.push(row)
    }
    if (result.data.length < 1000) return rows
  }
  throw Error('Directory read cap reached')
}

/** Existing captured evidence only. Never call job_result (which can stamp a job).
 * Global source coverage is NOT permission to create current work. Only full,
 * contiguous, revision-pinned pages can support a later human-reviewed audit. */
export async function readMicrosoftScheduleSource(staff: Staff, input: Record<string, unknown>) {
  if (staff.contextKind !== 'company_admin' || staff.role !== 'admin' || staff.connection.role !== 'admin'
    || staff.profileId !== staff.connection.userId) return failure()
  const offset = input.offset ?? 0
  if (!isUuid(input.run_id) || !text(input.source_id) || typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0 || offset > 100000
    || (offset > 0 && (!text(input.source_revision) || !text(input.directory_revision)))
    || (input.source_revision !== undefined && (typeof input.source_revision !== 'string' || !/^[a-f0-9]{32}$/.test(input.source_revision)))
    || (input.directory_revision !== undefined && (typeof input.directory_revision !== 'string' || !/^[a-f0-9]{64}$/.test(input.directory_revision)))) return failure()
  try {
    const result = await staff.supabase.rpc('read_mcp_schedule_source_page', {
      p_actor_profile_id: staff.profileId, p_run_id: input.run_id, p_source_id: input.source_id,
      p_offset: offset, p_expected_revision: input.source_revision ?? null,
    })
    if (result.error || !result.data || Array.isArray(result.data) || typeof result.data !== 'object') return failure()
    const page = result.data as Record<string, any>
    const total = page.record_count
    if (page.contract !== 'microsoft_schedule_source_page_v1' || page.run_id !== input.run_id || !isUuid(page.job_id)
      || page.source_id !== input.source_id || !text(page.source_name) || resolveMicrosoftPlanMapping(page.source_name).target !== 'client_schedule'
      || page.offset !== offset || page.source_complete !== true || !Number.isInteger(total) || total < offset || total > 100000
      || typeof page.source_revision !== 'string' || !/^[a-f0-9]{32}$/.test(page.source_revision) || (input.source_revision && page.source_revision !== input.source_revision)
      || typeof page.captured_at !== 'string' || !/T.*(Z|[+-]\d{2}:\d{2})$/.test(page.captured_at) || !Number.isFinite(Date.parse(page.captured_at))
      || !Array.isArray(page.records) || page.records.length !== Math.min(PAGE_SIZE, total - offset)) return failure()
    const ids = new Set<string>()
    for (const row of page.records) {
      if (!row || row.sourceType !== 'planner_task' || row.sourcePlanId !== page.source_id || row.sourcePlanName !== page.source_name
        || !text(row.sourceTaskId) || ids.has(row.sourceTaskId) || !text(row.sourceBucketId) || !text(row.sourceBucketName)
        || !text(row.title) || (row.description !== null && (typeof row.description !== 'string' || row.description.length > 32768))
        || !date(row.startDate) || !date(row.dueDate) || !date(row.completedDate)
        || (row.percentComplete !== null && ![0, 50, 100].includes(row.percentComplete))) return failure()
      ids.add(row.sourceTaskId)
    }
    const [clients, aliases] = await Promise.all([directoryRows(staff.supabase, 'clients'), directoryRows(staff.supabase, 'client_aliases')])
    const active = new Set(clients.map(row => row.id))
    const activeAliases = aliases.filter(row => active.has(row.client_id))
    // Pin identity authority too: a client/alias change between pages requires a restart.
    const encoded = new TextEncoder().encode(JSON.stringify({ clients, aliases: activeAliases }))
    const hash = await crypto.subtle.digest('SHA-256', encoded)
    const directoryRevision = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
    if (input.directory_revision && input.directory_revision !== directoryRevision) return failure()
    const directory = clients.map(row => ({ id: row.id as string, name: row.name as string, active: true, aliases: activeAliases.filter(a => a.client_id === row.id).map(a => a.alias as string) }))
    const records = page.records.map((row: Record<string, any>) => {
      const restricted = containsRestrictedPlannerContent({ title: row.title, description: row.description })
      const bucket = normaliseClientText(row.sourceBucketName)
      const eligible = directory.filter(client => [client.name, ...client.aliases].some(label => normaliseClientText(label) === bucket))
      const match = restricted ? null : matchClient(row.sourceBucketName, eligible)
      // Only explicit full-name/approved-alias phrases can contradict the bucket.
      // A DP instance number must not become a distinctive client-name token.
      const title = ` ${normaliseClientText(row.title)} `
      const named = directory.filter(client => [client.name, ...client.aliases].some(label => title.includes(` ${normaliseClientText(label)} `)))
      const titleMatch = restricted ? null : matchClient(row.title, named)
      const exact = match && ['exact', 'alias'].includes(match.confidence)
        && (!titleMatch?.clientId || titleMatch.clientId === match.clientId) && !titleMatch?.ambiguousBetween.length
      const slot = !restricted && exact ? deliverableIdentity(row.title) : null
      const numbered = slot?.code && Number.isSafeInteger(slot.instance_number) && (slot.instance_number ?? 0) > 0
      return {
        source_plan_id: page.source_id, source_bucket_id: row.sourceBucketId, source_task_id: row.sourceTaskId,
        client_id: exact ? match.clientId : null, client_name: exact ? match.clientName : null,
        // No raw title, bucket label, description, assignment or extra provider fields.
        code: numbered ? slot.code : null, deliverable_type: numbered ? slot.deliverable_type : null,
        instance_number: numbered ? slot.instance_number : null,
        start_date: !restricted && exact ? row.startDate : null, due_date: !restricted && exact ? row.dueDate : null,
        completed_date: !restricted && exact ? row.completedDate : null, percent_complete: !restricted && exact ? row.percentComplete : null,
        evidence_state: restricted ? 'private_review_held' : !exact ? 'identity_review_held' : !numbered ? 'slot_review_held' : 'numbered_source_reference_only',
      }
    })
    const next = offset + records.length
    return { run_id: page.run_id, job_id: page.job_id, source_id: page.source_id, source_name: page.source_name,
      source_revision: page.source_revision, directory_revision: directoryRevision, captured_at: page.captured_at,
      source_complete: true, source_record_count: total, coverage: 'page_only', records,
      pagination: { offset, returned: records.length, limit: PAGE_SIZE, has_more: next < total, next_offset: next < total ? next : null },
      scope_note: 'Historical captured source references, not verified package quantities, current work, posting dates or publication. Read every contiguous page with BOTH revisions before a later reviewed audit. No source fetch, job stamp, sync or apply.' }
  } catch { return failure() }
}
