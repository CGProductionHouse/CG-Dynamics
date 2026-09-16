export const CG_HOURS_REQUIRED_ACTIONS = Object.freeze([
  'create_time_entry',
  'create_trip_entry',
  'list_my_entries',
  'correct_my_entry',
])

export const CG_HOURS_NOT_CONFIGURED = Object.freeze({
  ok: false,
  code: 'CG_HOURS_NOT_CONFIGURED',
  message: 'Canonical CG Hours persistence is not configured.',
})

export function requireDurableReceipt(result) {
  if (!result || result.ok !== true) return result ?? CG_HOURS_NOT_CONFIGURED
  if (typeof result.entry_id !== 'string' || result.entry_id.trim() === '') {
    return {
      ok: false,
      code: 'CG_HOURS_MISSING_RECEIPT',
      message: 'CG Hours did not return a durable entry receipt.',
    }
  }
  return result
}
