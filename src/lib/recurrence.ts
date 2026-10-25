import { supabase } from './supabase'
import type { PlannerTask } from './planner'
import { businessDateKey } from './businessTime'
import { fetchAllPages } from './paginatedQuery'
import { parseRecurrenceRule, type RecurrenceRule } from './recurrenceRule'
export { parseRecurrenceRule, type RecurrenceRule } from './recurrenceRule'

// ── Recurring planner tasks (foundation) ──────────────────────────────────────
//
// Safe on-view materialisation per docs/recurring-tasks-and-microsoft-import.md:
//   * Templates carry a small RRULE subset in recurrence_rule.
//   * Instances are created for a capped window (today → +14 days), never
//     backfilled, and are idempotent two ways: a deterministic import_hash
//     ('rec-<templateId>-<date>', unique in the DB) and the phase-13a partial
//     unique index on (recurrence_parent_id, due_date).
//   * Before phase-13a-recurring-tasks.sql is applied the columns do not
//     exist; every entry point no-ops gracefully and reports migrationNeeded.

export const MATERIALISE_WINDOW_DAYS = 14
const MATERIALISE_BATCH_SIZE = 200
const MAX_MATERIALISE_ROWS = 20000

function dateOrdinal(key: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null
  const value = Date.parse(`${key}T00:00:00Z`)
  return Number.isFinite(value) && new Date(value).toISOString().slice(0, 10) === key ? value / 86400000 : null
}

// Occurrence dates inside [from, from + windowDays], respecting `until`.
// Deterministic and bounded — at most windowDays+1 dates are ever returned.
export function occurrencesInWindow(
  rule: RecurrenceRule,
  from: Date,
  windowDays: number,
  until: string | null,
  anchorDate = businessDateKey(from),
): string[] {
  const out: string[] = []
  const start = dateOrdinal(businessDateKey(from)), anchor = dateOrdinal(anchorDate)
  if (start === null || anchor === null || !Number.isFinite(windowDays) || (until && dateOrdinal(until) === null)) return []
  const anchorDay = new Date(anchor * 86400000)
  const monday = (ordinal: number) => ordinal - (new Date(ordinal * 86400000).getUTCDay() + 6) % 7
  for (let offset = 0; offset <= Math.min(MATERIALISE_WINDOW_DAYS, Math.max(0, Math.floor(windowDays))); offset++) {
    const ordinal = start + offset, day = new Date(ordinal * 86400000)
    const dayIso = day.toISOString().slice(0, 10)
    if (ordinal < anchor) continue
    if (until && dayIso > until) break
    if (rule.freq === 'DAILY') {
      if ((ordinal - anchor) % rule.interval === 0 && (!rule.byDays.length || rule.byDays.includes(day.getUTCDay()))) out.push(dayIso)
    } else if (rule.freq === 'WEEKLY') {
      const days = rule.byDays.length > 0 ? rule.byDays : [1] // default Monday
      if (((monday(ordinal) - monday(anchor)) / 7) % rule.interval === 0 && days.includes(day.getUTCDay())) out.push(dayIso)
    } else {
      const target = rule.byMonthDay ?? 1
      const months = (day.getUTCFullYear() - anchorDay.getUTCFullYear()) * 12 + day.getUTCMonth() - anchorDay.getUTCMonth()
      if (months % rule.interval !== 0) continue
      if (rule.byOrdinalDay) {
        const { ordinal: position, day: weekday } = rule.byOrdinalDay
        if (day.getUTCDay() !== weekday) continue
        const daysInMonth = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)).getUTCDate()
        const occurrence = position > 0
          ? Math.floor((day.getUTCDate() - 1) / 7) + 1
          : -(Math.floor((daysInMonth - day.getUTCDate()) / 7) + 1)
        if (occurrence === position) out.push(dayIso)
      } else if (day.getUTCDate() === target) out.push(dayIso)
    }
  }
  return out
}

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42703') return true
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('recurrence_rule') && (msg.includes('does not exist') || msg.includes('schema cache'))
}

export interface MaterializeResult {
  created: number
  templates: number
  migrationNeeded: boolean
  error: string | null
}

// Materialise upcoming instances for every active recurrence template.
// Idempotent and safe to call on page load: unique import_hash makes repeat
// inserts no-ops, the window is capped, and there is no backfill.
export async function materializeRecurringTasks(): Promise<MaterializeResult> {
  const seen = new Set<string>()
  const { data: templates, error } = await fetchAllPages<PlannerTask>(async (from, to) => {
    const result = await supabase.from('planner_tasks')
      .select('id, board_id, bucket_id, title, client_id, client_name, assigned_to_name, priority, notes, recurrence_rule, recurrence_until, start_date, created_at')
      .not('recurrence_rule', 'is', null).is('archived_at', null)
      .is('superseded_by_task_id', null).is('microsoft_source_removed_at', null)
      .order('id').range(from, to)
    if (result.error) return { data: null, error: result.error }
    if (!Array.isArray(result.data)) return { data: null, error: { message: 'Recurring template read is unavailable, not empty.' } }
    for (const row of result.data) {
      if (!row || typeof row.id !== 'string' || seen.has(row.id)) return { data: null, error: { message: 'Recurring template pagination repeated or invalidated a row.' } }
      seen.add(row.id)
    }
    return { data: result.data as PlannerTask[], error: null }
  })

  if (error) {
    if (isMissingColumnError(error)) {
      return { created: 0, templates: 0, migrationNeeded: true, error: null }
    }
    return { created: 0, templates: 0, migrationNeeded: false, error: error.message }
  }
  const templateRows = (templates ?? []) as Array<PlannerTask & { recurrence_rule: string; recurrence_until: string | null }>
  if (templateRows.length === 0) return { created: 0, templates: 0, migrationNeeded: false, error: null }

  const today = new Date()
  const rows: Record<string, unknown>[] = []
  for (const template of templateRows) {
    const rule = parseRecurrenceRule(template.recurrence_rule)
    if (!rule) return { created: 0, templates: templateRows.length, migrationNeeded: false, error: 'A recurring template has an unsupported rule. Review it before materialising work.' }
    if (template.recurrence_until !== null && (typeof template.recurrence_until !== 'string' || dateOrdinal(template.recurrence_until) === null)) {
      return { created: 0, templates: templateRows.length, migrationNeeded: false, error: 'A recurring template has an invalid end date. Review it before materialising work; no instances were written.' }
    }
    const anchor = template.start_date || businessDateKey(template.created_at)
    if (dateOrdinal(anchor) === null) return { created: 0, templates: templateRows.length, migrationNeeded: false, error: 'A recurring template has no verified start/creation date. No work was materialised.' }
    for (const dueDate of occurrencesInWindow(rule, today, MATERIALISE_WINDOW_DAYS, template.recurrence_until, anchor)) {
      rows.push({
        board_id: template.board_id,
        bucket_id: template.bucket_id,
        title: template.title,
        client_id: template.client_id,
        client_name: template.client_name,
        assigned_to_name: template.assigned_to_name,
        status: 'to_do',
        priority: template.priority,
        due_date: dueDate,
        notes: template.notes,
        source: 'recurring',
        // Deterministic key = the idempotency guard (import_hash is unique).
        import_hash: `rec-${template.id}-${dueDate}`,
        recurrence_parent_id: template.id,
      })
      if (rows.length > MAX_MATERIALISE_ROWS) return { created: 0, templates: templateRows.length, migrationNeeded: false, error: 'Recurring work exceeds the bounded creation pass. No instances were written; existing work remains available.' }
    }
  }
  if (rows.length === 0) return { created: 0, templates: templateRows.length, migrationNeeded: false, error: null }

  let created = 0
  const acknowledgedIds = new Set<string>()
  for (let offset = 0; offset < rows.length; offset += MATERIALISE_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + MATERIALISE_BATCH_SIZE)
    const { data: inserted, error: insertError } = await supabase.from('planner_tasks')
      .upsert(batch, { onConflict: 'import_hash', ignoreDuplicates: true }).select('id')
    if (insertError) {
      if (isMissingColumnError(insertError)) return { created, templates: templateRows.length, migrationNeeded: true, error: null }
      return { created, templates: templateRows.length, migrationNeeded: false, error: insertError.message }
    }
    if (!Array.isArray(inserted) || inserted.length > batch.length || inserted.some(row => typeof row?.id !== 'string' || !row.id.trim() || acknowledgedIds.has(row.id))
      || new Set(inserted.map(row => row.id)).size !== inserted.length) {
      return { created, templates: templateRows.length, migrationNeeded: false, error: 'A recurring batch save was not confirmed. Retry the same deterministic keys; do not claim missing receipts as zero work.' }
    }
    for (const row of inserted) acknowledgedIds.add(row.id)
    created += inserted.length
  }
  return { created, templates: templateRows.length, migrationNeeded: false, error: null }
}

// A template never appears in operational task lists; instances do.
export function isRecurringTemplate(task: Pick<PlannerTask, 'recurrence_rule'>): boolean {
  return Boolean(task.recurrence_rule)
}

export function isRecurringInstance(task: Pick<PlannerTask, 'recurrence_parent_id'>): boolean {
  return Boolean(task.recurrence_parent_id)
}
