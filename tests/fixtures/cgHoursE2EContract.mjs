// Test-only contract fixture for #361. This is not a persistence implementation.
export const CG_HOURS_REQUIRED_ACTIONS = Object.freeze([
  'create_time_entry', 'create_trip_entry', 'list_my_entries', 'correct_my_entry',
])

export const CG_HOURS_NOT_CONFIGURED = Object.freeze({
  ok: false,
  code: 'CG_HOURS_NOT_CONFIGURED',
  message: 'Canonical CG Hours persistence is not configured.',
})

const WORKFORCE_ROLES = new Set(['staff', 'team'])
const failure = (code, message) => ({ ok: false, code, message })

export function requireDurableReceipt(result) {
  if (!result || result.ok !== true) return result ?? CG_HOURS_NOT_CONFIGURED
  if (typeof result.entry_id !== 'string' || !result.entry_id.trim() ||
      typeof result.receipt !== 'string' || !result.receipt.trim()) {
    return failure('CG_HOURS_MISSING_RECEIPT', 'CG Hours did not return a durable entry receipt.')
  }
  return result
}

function actorFrom(context) {
  if (!context || context.context_kind !== 'staff' || !context.staff_profile_id) {
    return failure('STAFF_CONTEXT_REQUIRED', 'An exact authenticated staff context is required.')
  }
  if (!WORKFORCE_ROLES.has(context.role)) {
    return failure('WORKFORCE_ROLE_REQUIRED', 'The staff context must have a workforce role.')
  }
  return { ok: true, staff_id: context.staff_profile_id }
}

function exactClient(clients, input) {
  const matches = clients.filter(client => client.active && client.name === input.client_name)
  if (matches.length !== 1) return failure('AMBIGUOUS_CLIENT', 'Supply one exact active canonical client.')
  const client = matches[0]
  if (input.client_id && input.client_id !== client.id) {
    return failure('CLIENT_SCOPE_MISMATCH', 'The supplied client ID does not match the exact client.')
  }
  return { ok: true, client }
}

function backendResult(result) {
  if (!result) return CG_HOURS_NOT_CONFIGURED
  if (result.error != null) return failure('CG_HOURS_SOURCE_ERROR', 'Canonical CG Hours persistence failed.')
  if (!result.data) return failure('CG_HOURS_SOURCE_ERROR', 'Canonical CG Hours returned no persistence result.')
  return requireDurableReceipt({ ok: true, ...result.data })
}

export function createCgHoursAcceptanceHarness({ backend, clients }) {
  async function createTrip(context, input) {
    if (!backend?.createEntry) return CG_HOURS_NOT_CONFIGURED
    const actor = actorFrom(context)
    if (!actor.ok) return actor
    if (input.staff_id && input.staff_id !== actor.staff_id) {
      return failure('STAFF_SCOPE_MISMATCH', 'A staff member cannot log as another staff member.')
    }
    const resolved = exactClient(clients, input)
    if (!resolved.ok) return resolved
    if (!Number.isFinite(input.distance_km) || input.distance_km <= 0 || input.distance_km > 2000) {
      return failure('INVALID_KILOMETRES', 'Distance must be possible and greater than zero.')
    }
    if (input.odometer_start != null || input.odometer_end != null) {
      if (!Number.isFinite(input.odometer_start) || !Number.isFinite(input.odometer_end) ||
          input.odometer_end <= input.odometer_start ||
          input.odometer_end - input.odometer_start !== input.distance_km) {
        return failure('INVALID_ODOMETER', 'Odometer evidence must be valid and equal the stated distance.')
      }
    }
    return backendResult(await backend.createEntry({
      kind: 'trip', staff_id: actor.staff_id, client_id: resolved.client.id,
      distance_km: input.distance_km, driving_context: input.driving_context,
      classification: input.classification, idempotency_key: input.idempotency_key,
      odometer_start: input.odometer_start, odometer_end: input.odometer_end,
    }))
  }

  async function createTime(context, input) {
    if (!backend?.createEntry) return CG_HOURS_NOT_CONFIGURED
    const actor = actorFrom(context)
    if (!actor.ok) return actor
    if (input.staff_id && input.staff_id !== actor.staff_id) {
      return failure('STAFF_SCOPE_MISMATCH', 'A staff member cannot log as another staff member.')
    }
    const resolved = exactClient(clients, input)
    if (!resolved.ok) return resolved
    if (!Number.isFinite(input.hours) || input.hours <= 0 || input.hours > 24) {
      return failure('INVALID_HOURS', 'Hours must be greater than zero and at most 24.')
    }
    return backendResult(await backend.createEntry({
      kind: 'time', staff_id: actor.staff_id, client_id: resolved.client.id,
      hours: input.hours, purpose: input.purpose, idempotency_key: input.idempotency_key,
    }))
  }

  async function listMine(context, input = {}) {
    if (!backend?.listEntries) return CG_HOURS_NOT_CONFIGURED
    const actor = actorFrom(context)
    if (!actor.ok) return actor
    if (input.staff_id && input.staff_id !== actor.staff_id) {
      return failure('STAFF_SCOPE_MISMATCH', 'A staff member cannot read another staff member.')
    }
    const result = await backend.listEntries({ staff_id: actor.staff_id, date: input.date })
    if (!result) return CG_HOURS_NOT_CONFIGURED
    if (result.error != null || !Array.isArray(result.data)) {
      return failure('CG_HOURS_SOURCE_ERROR', 'Canonical CG Hours persistence failed.')
    }
    return { ok: true, entries: result.data.filter(entry => entry.staff_id === actor.staff_id) }
  }

  async function correctMine(context, input) {
    if (!backend?.correctEntry) return CG_HOURS_NOT_CONFIGURED
    const actor = actorFrom(context)
    if (!actor.ok) return actor
    if (input.staff_id && input.staff_id !== actor.staff_id) {
      return failure('STAFF_SCOPE_MISMATCH', 'A staff member cannot correct another staff member.')
    }
    if (!input.reason?.trim()) return failure('CORRECTION_REASON_REQUIRED', 'A correction reason is required.')
    return backendResult(await backend.correctEntry({ ...input, staff_id: actor.staff_id }))
  }

  return { createTrip, createTime, listMine, correctMine }
}

// This fake exists only to verify the adapter contract. It is never production proof.
export function createContractFixtureBackend() {
  const entries = new Map()
  const idempotency = new Map()
  let sequence = 0
  return {
    entries,
    async createEntry(input) {
      const scopeKey = `${input.staff_id}:${input.kind}:${input.idempotency_key}`
      if (idempotency.has(scopeKey)) return { data: idempotency.get(scopeKey), error: null }
      const entry_id = `fixture-entry-${++sequence}`
      const entry = { ...input, entry_id, receipt: `fixture-receipt-${sequence}`, audit: [] }
      entries.set(entry_id, entry)
      idempotency.set(scopeKey, entry)
      return { data: entry, error: null }
    },
    async listEntries({ staff_id }) {
      return { data: [...entries.values()].filter(entry => entry.staff_id === staff_id), error: null }
    },
    async correctEntry({ entry_id, staff_id, reason, distance_km }) {
      const entry = entries.get(entry_id)
      if (!entry || entry.staff_id !== staff_id) return { data: null, error: { code: 'NOT_FOUND' } }
      const before = { distance_km: entry.distance_km }
      entry.audit.push({ staff_id, reason, before, after: { distance_km } })
      entry.distance_km = distance_km
      return { data: entry, error: null }
    },
  }
}
