// Read the real PostgREST RETURNS TABLE shape. Never treat a failed/unknown receipt as permission to write.
export function parseIdempotencyRead(data: unknown, error: unknown): { duplicate: boolean; result?: unknown } {
  if (error) throw new Error('Write receipt lookup failed. No action was attempted; retry the same key.')
  const row = Array.isArray(data) && data.length === 1 ? data[0] : !Array.isArray(data) ? data : null
  if (!row || typeof row !== 'object' || typeof row.already_executed !== 'boolean'
    || (row.already_executed && (!row.existing_result || typeof row.existing_result !== 'object' || Array.isArray(row.existing_result)))) {
    throw new Error('Write receipt lookup returned an invalid result. No action was attempted.')
  }
  return row.already_executed ? { duplicate: true, result: row.existing_result } : { duplicate: false }
}

export function ownsOperationalReceipt(tool: string, result: unknown, scope?: { actorId: string; key: string }): boolean {
  if (!['create_task', 'create_recurring_task', 'update_task', 'upsert_calendar_event'].includes(tool) || !result || typeof result !== 'object') return false
  const value = result as Record<string, unknown>
  const receipt = value.receipt as Record<string, unknown> | undefined
  const entity = (tool === 'upsert_calendar_event' ? value.event : tool === 'create_recurring_task' ? value.template : value.task) as Record<string, unknown> | undefined
  return receipt?.contract === 'mcp_operational_atomic_v1' && typeof receipt.idempotency_key === 'string'
    && typeof receipt.entity_id === 'string' && entity?.id === receipt.entity_id
    && (!scope || (receipt.actor_profile_id === scope.actorId && receipt.idempotency_key === scope.key && receipt.tool_name === tool))
}

export async function commitOperationalWrite(
  staff: { profileId: string; contextKind: string; connection: { userId: string }; supabase: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> } },
  tool: 'create_task' | 'create_recurring_task' | 'update_task' | 'upsert_calendar_event', input: Record<string, unknown>, payload: Record<string, unknown>, inputHash: string,
): Promise<Record<string, unknown>> {
  for (const field of ['due_date', 'recurrence_until']) {
    const date = payload[field]
    if (date == null) continue
    const parsed = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T00:00:00Z`) : NaN
    if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== date) return { error: `Use an exact YYYY-MM-DD ${field}, or omit/clear it explicitly. No action was attempted.` }
  }
  const { data, error } = await staff.supabase.rpc('mcp_commit_operational_write', {
    p_actor_profile_id: staff.profileId, p_connection_principal_user_id: staff.connection.userId,
    p_context_kind: staff.contextKind, p_tool_name: tool, p_idempotency_key: input.idempotency_key,
    p_input_hash: inputHash, p_payload: payload,
  })
  const value = data as Record<string, unknown> | null
  const receipt = value?.receipt as Record<string, unknown> | undefined
  const task = value?.task as Record<string, unknown> | undefined
  const event = value?.event as Record<string, unknown> | undefined
  if (error || !ownsOperationalReceipt(tool, data) || receipt?.idempotency_key !== input.idempotency_key
    || receipt?.actor_profile_id !== staff.profileId || receipt?.tool_name !== tool
    || (tool === 'update_task' && task?.id !== input.task_id)
    || (tool === 'upsert_calendar_event' && typeof payload.event_id === 'string' && event?.id !== payload.event_id)) return {
    verdict: 'FAIL',
    error: 'Operational save/receipt was not confirmed. Re-read and retry with the SAME idempotency key; no fallback create was attempted. The atomic-receipt migration must be available before this connector is released.',
  }
  return data as Record<string, unknown>
}
