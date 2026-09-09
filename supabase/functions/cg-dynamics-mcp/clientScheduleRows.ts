// clientScheduleRows.ts — canonical Client Schedule (`monthly_deliverables`) row shaping for
// the MCP connector (Issue #323). Pure and import-free so it is unit-tested without Deno.
//
// `public.monthly_deliverables` has `client_id` but NO `client_name` column. Selecting
// `client_name` directly is a schema error, which is what broke live `list_client_schedule`
// and silently emptied the deliverables list in `get_my_day`.
//
// The client name is read through the existing foreign key
// `monthly_deliverables_client_id_fkey` -> `public.clients(id)` and then flattened back to
// the `client_name` field the tool response contract already exposes, so callers see an
// unchanged shape.
//
// Client Schedule remains its own authority: this module only shapes columns. It changes no
// filter, date-range, ordering, limit, or client/staff isolation behaviour, and it never
// touches CG Calendar.

/** Embed the related client name via the exact FK, never a nonexistent flat column. */
export const MONTHLY_DELIVERABLE_CLIENT_RELATION =
  'client:clients!monthly_deliverables_client_id_fkey(name)'

/** Columns for `list_client_schedule`. */
export const CLIENT_SCHEDULE_SELECT = [
  'id',
  'client_id',
  'month',
  'deliverable_type',
  'title',
  'scheduled_date',
  'due_date',
  'production_status',
  'assigned_to_name',
  // #325 read-only audit provenance. Client Schedule write/approval rules are unchanged.
  'package_id',
  'template_id',
  'microsoft_source_type',
  'microsoft_plan_id',
  'microsoft_task_id',
  'microsoft_last_synced_at',
  'microsoft_source_removed_at',
  MONTHLY_DELIVERABLE_CLIENT_RELATION,
].join(', ')

/** Columns for the deliverables slice of `get_my_day`. */
export const MY_DAY_DELIVERABLE_SELECT = [
  'id',
  'title',
  'deliverable_type',
  'scheduled_date',
  'production_status',
  'assigned_to_name',
  MONTHLY_DELIVERABLE_CLIENT_RELATION,
].join(', ')

interface EmbeddedClient {
  name?: string | null
}

/**
 * Flatten the embedded client relation back to `client_name`, preserving the public tool
 * response shape. An unresolved relation yields `client_name: null` — never a fabricated
 * name, and never a silently dropped row.
 */
export function flattenDeliverableClient(
  rows: ReadonlyArray<Record<string, unknown>> | null | undefined,
): Array<Record<string, unknown>> {
  return (rows ?? []).map(row => {
    const { client, ...rest } = row as Record<string, unknown> & { client?: EmbeddedClient | EmbeddedClient[] | null }
    // Supabase returns an object for a many-to-one embed; tolerate an array defensively.
    const embedded = Array.isArray(client) ? client[0] : client
    return { ...rest, client_name: embedded?.name ?? null }
  })
}
