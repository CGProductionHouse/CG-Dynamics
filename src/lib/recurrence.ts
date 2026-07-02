import { supabase } from './supabase'
import type { PlannerTask } from './planner'

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

export interface RecurrenceRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  interval: number
  /** 0=Sunday … 6=Saturday (JS getDay convention). */
  byDays: number[]
  /** 1–28 (clamped so every month has the day). */
  byMonthDay: number | null
}

const DAY_TOKENS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

export function parseRecurrenceRule(raw: string | null | undefined): RecurrenceRule | null {
  if (!raw) return null
  const parts = new Map<string, string>()
  for (const piece of raw.split(';')) {
    const [key, value] = piece.split('=')
    if (key && value) parts.set(key.trim().toUpperCase(), value.trim().toUpperCase())
  }
  const freq = parts.get('FREQ')
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY') return null
  const interval = Math.max(1, Math.min(12, Number(parts.get('INTERVAL') ?? '1') || 1))
  const byDays = (parts.get('BYDAY') ?? '')
    .split(',')
    .map(token => DAY_TOKENS[token.trim()])
    .filter((d): d is number => typeof d === 'number')
  const rawMonthDay = Number(parts.get('BYMONTHDAY') ?? '')
  const byMonthDay = Number.isFinite(rawMonthDay) && rawMonthDay >= 1 ? Math.min(rawMonthDay, 28) : null
  return { freq, interval, byDays, byMonthDay }
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Occurrence dates inside [from, from + windowDays], respecting `until`.
// Deterministic and bounded — at most windowDays+1 dates are ever returned.
export function occurrencesInWindow(
  rule: RecurrenceRule,
  from: Date,
  windowDays: number,
  until: string | null,
): string[] {
  const out: string[] = []
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  for (let offset = 0; offset <= windowDays; offset++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset)
    const dayIso = isoDate(day)
    if (until && dayIso > until) break
    if (rule.freq === 'DAILY') {
      if (offset % rule.interval === 0) out.push(dayIso)
    } else if (rule.freq === 'WEEKLY') {
      const days = rule.byDays.length > 0 ? rule.byDays : [1] // default Monday
      if (days.includes(day.getDay())) out.push(dayIso)
    } else {
      const target = rule.byMonthDay ?? 1
      if (day.getDate() === target) out.push(dayIso)
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
  const { data: templates, error } = await supabase
    .from('planner_tasks')
    .select('id, board_id, bucket_id, title, client_id, client_name, assigned_to_name, priority, notes, recurrence_rule, recurrence_until')
    .not('recurrence_rule', 'is', null)
    .is('archived_at', null)

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
    if (!rule) continue
    for (const dueDate of occurrencesInWindow(rule, today, MATERIALISE_WINDOW_DAYS, template.recurrence_until)) {
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
    }
  }
  if (rows.length === 0) return { created: 0, templates: templateRows.length, migrationNeeded: false, error: null }

  const { data: inserted, error: insertError } = await supabase
    .from('planner_tasks')
    .upsert(rows, { onConflict: 'import_hash', ignoreDuplicates: true })
    .select('id')

  if (insertError) {
    if (isMissingColumnError(insertError)) {
      return { created: 0, templates: templateRows.length, migrationNeeded: true, error: null }
    }
    return { created: 0, templates: templateRows.length, migrationNeeded: false, error: insertError.message }
  }
  return { created: inserted?.length ?? 0, templates: templateRows.length, migrationNeeded: false, error: null }
}

// A template never appears in operational task lists; instances do.
export function isRecurringTemplate(task: Pick<PlannerTask, 'recurrence_rule'>): boolean {
  return Boolean(task.recurrence_rule)
}

export function isRecurringInstance(task: Pick<PlannerTask, 'recurrence_parent_id'>): boolean {
  return Boolean(task.recurrence_parent_id)
}
