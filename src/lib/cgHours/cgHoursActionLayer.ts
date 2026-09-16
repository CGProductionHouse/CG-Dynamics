// CG Hours canonical action layer — pure helpers for the staff→CG Hours write/read/correction path.
// This is the typed seam that CG Assistant / MCP tools will call. No side effects, no external deps.
// Reuses existing CG Dynamics OAuth/MCP/project/staff context and the canonical CG Hours backend.

export type CgHoursEntryType = 'time' | 'mileage' | 'fuel' | 'vehicle_expense'

export interface CgHoursTimeEntryDraft {
  client_id: string | null
  date: string // YYYY-MM-DD
  type: 'time'
  hours: number
  task_description: string
  notes?: string
}

export interface CgHoursTimeEntry {
  id?: string
  staff_id: string
  client_id: string | null
  date: string
  type: 'time'
  hours: number
  task_description: string
  notes?: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
}

export interface CgHoursCorrectionDraft {
  entry_id: string
  staff_id: string // for audit: who is correcting
  correction: {
    hours?: number
    task_description?: string
    notes?: string
    distance_km?: number
    description?: string
  }
  reason: string // e.g., "mistyped hours", "wrong client"
}

export interface CgHoursCorrectionResult<T extends CgHoursTimeEntry | CgHoursVehicleEntry> {
  original: T
  corrected: T
  audit: {
    corrected_by: string
    corrected_at: string
    reason: string
  }
}

export interface CgHoursVehicleEntry {
  id?: string
  staff_id: string
  client_id: string | null
  date: string // YYYY-MM-DD
  type: 'mileage' | 'fuel' | 'vehicle_expense'
  distance_km?: number // Canonical kilometre seam — raw value only, no rate/reimbursement
  description?: string
  notes?: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
}

// Adapter boundary: external vehicle/reimbursement truth lives outside CG Hours canonical layer.
// Implementations provide this adapter; the canonical layer never invents rate/expense fields.
export interface VehicleReimbursementAdapter {
  // Resolve reimbursement fields for a given vehicle entry (e.g., from fleet system, payroll, policy)
  resolveReimbursement(entry: CgHoursVehicleEntry): Promise<VehicleReimbursementSnapshot | null>
  // Optional: validate that a raw kilometre value is within policy for the staff/client/date
  validateKilometres?(entry: CgHoursVehicleEntry): Promise<{ valid: boolean; reason?: string }>
}

export interface VehicleReimbursementSnapshot {
  // Computed/external fields — not stored in canonical CG Hours
  rate_per_km?: number
  litres?: number
  cost_per_litre?: number
  amount?: number
  receipt_url?: string
  policy_ref?: string
  computed_at: string
}

export interface CgHoursRecentEntriesQuery {
  staff_id: string
  from_date: string // YYYY-MM-DD
  to_date: string // YYYY-MM-DD
  types?: CgHoursEntryType[]
}

export function validateCgHoursTimeEntryDraft(draft: CgHoursTimeEntryDraft): string[] {
  const errors: string[] = []

  if (!draft.date || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
    errors.push('date must be YYYY-MM-DD')
  }

  if (draft.type !== 'time') {
    errors.push('type must be "time"')
    return errors
  }

  if (typeof draft.hours !== 'number' || !Number.isFinite(draft.hours) || draft.hours <= 0) {
    errors.push('hours must be a positive number')
  }

  if (draft.hours > 24) {
    errors.push('hours exceeds maximum daily limit (24)')
  }

  if (!draft.task_description || draft.task_description.trim().length === 0) {
    errors.push('task_description is required')
  }

  if (draft.task_description && draft.task_description.length > 500) {
    errors.push('task_description exceeds maximum length (500)')
  }

  return errors
}

export function isTimeDraftSubmittable(draft: CgHoursTimeEntryDraft): boolean {
  return validateCgHoursTimeEntryDraft(draft).length === 0
}

export function createTimeEntryFromDraft(
  draft: CgHoursTimeEntryDraft,
  staffId: string,
  nowIso = new Date().toISOString()
): CgHoursTimeEntry {
  const errors = validateCgHoursTimeEntryDraft(draft)
  if (errors.length > 0) {
    throw new Error(`Invalid time entry draft: ${errors.join('; ')}`)
  }

  return {
    staff_id: staffId,
    client_id: draft.client_id,
    date: draft.date,
    type: 'time',
    hours: draft.hours,
    task_description: draft.task_description.trim(),
    notes: draft.notes?.trim(),
    status: 'draft',
    created_at: nowIso,
    updated_at: nowIso,
  }
}

export function validateCorrectionDraft(draft: CgHoursCorrectionDraft): string[] {
  const errors: string[] = []

  if (!draft.entry_id || draft.entry_id.trim().length === 0) {
    errors.push('entry_id is required')
  }

  if (!draft.staff_id || draft.staff_id.trim().length === 0) {
    errors.push('staff_id is required for audit')
  }

  if (!draft.reason || draft.reason.trim().length === 0) {
    errors.push('reason is required for audit trail')
  }

  if (draft.correction.hours !== undefined && (typeof draft.correction.hours !== 'number' || draft.correction.hours <= 0 || draft.correction.hours > 24)) {
    errors.push('hours must be a positive number up to 24')
  }

  if (draft.correction.distance_km !== undefined && (typeof draft.correction.distance_km !== 'number' || draft.correction.distance_km < 0)) {
    errors.push('distance_km must be a non-negative number')
  }

  return errors
}

export function applyCorrectionToTimeEntry(
  original: CgHoursTimeEntry,
  correction: CgHoursCorrectionDraft,
  nowIso = new Date().toISOString()
): CgHoursCorrectionResult<CgHoursTimeEntry> {
  const errors = validateCorrectionDraft(correction)
  if (errors.length > 0) {
    throw new Error(`Invalid correction: ${errors.join('; ')}`)
  }

  const corrected: CgHoursTimeEntry = {
    ...original,
    hours: correction.correction.hours ?? original.hours,
    task_description: correction.correction.task_description ?? original.task_description,
    notes: correction.correction.notes ?? original.notes,
    updated_at: nowIso,
  }

  return {
    original,
    corrected,
    audit: {
      corrected_by: correction.staff_id,
      corrected_at: nowIso,
      reason: correction.reason.trim(),
    },
  }
}

export function applyCorrectionToVehicleEntry(
  original: CgHoursVehicleEntry,
  correction: CgHoursCorrectionDraft,
  nowIso = new Date().toISOString()
): CgHoursCorrectionResult<CgHoursVehicleEntry> {
  const errors = validateCorrectionDraft(correction)
  if (errors.length > 0) {
    throw new Error(`Invalid correction: ${errors.join('; ')}`)
  }

  const corrected: CgHoursVehicleEntry = {
    ...original,
    distance_km: correction.correction.distance_km ?? original.distance_km,
    description: correction.correction.description ?? original.description,
    notes: correction.correction.notes ?? original.notes,
    updated_at: nowIso,
  }

  return {
    original,
    corrected,
    audit: {
      corrected_by: correction.staff_id,
      corrected_at: nowIso,
      reason: correction.reason.trim(),
    },
  }
}

export function generateIdempotencyKey(staffId: string, action: string, key: string): string {
  // Simple deterministic key: staffId|action|key
  // In production this would be hashed to UUID via the existing deriveMcpIdempotencyKey
  return `${staffId}|${action}|${key}`
}

export interface CgHoursOrdinaryHoursActionContext {
  staffId: string
  clientId: string | null
  idempotencyKey?: (action: string, requestKey: string) => string
}

export function createOrdinaryHoursEntry(
  context: CgHoursOrdinaryHoursActionContext,
  draft: CgHoursTimeEntryDraft,
  nowIso = new Date().toISOString()
): { entry: CgHoursTimeEntry; idempotencyKey: string } {
  const { staffId, clientId, idempotencyKey: keyFn } = context

  if (draft.client_id !== undefined && clientId !== null && draft.client_id !== clientId) {
    throw new Error(`Client isolation violation: draft.client_id=${draft.client_id} differs from context.clientId=${clientId}`)
  }

  const effectiveClientId = clientId !== null ? clientId : draft.client_id

  const draftWithClient = {
    ...draft,
    client_id: effectiveClientId,
  }

  const errors = validateCgHoursTimeEntryDraft(draftWithClient)
  if (errors.length > 0) {
    throw new Error(`Invalid time entry draft: ${errors.join('; ')}`)
  }

  const entry = createTimeEntryFromDraft(draftWithClient, staffId, nowIso)

  const key = keyFn ? keyFn('create_ordinary_hours_entry', `${staffId}|${effectiveClientId}|${draft.date}`) : generateIdempotencyKey(staffId, 'create_ordinary_hours_entry', `${staffId}|${effectiveClientId}|${draft.date}`)

  return { entry, idempotencyKey: key }
}

export function readOrdinaryHoursEntries(
  context: CgHoursOrdinaryHoursActionContext,
  fromDate: string,
  toDate: string,
  types?: CgHoursEntryType[]
): CgHoursRecentEntriesQuery {
  const { staffId, clientId } = context
  return {
    staff_id: staffId,
    from_date: from_date,
    to_date: to_date,
    types,
  }
}

export function applyOrdinaryHoursCorrection(
  context: CgHoursOrdinaryHoursActionContext,
  entry: CgHoursTimeEntry,
  correction: CgHoursCorrectionDraft,
  nowIso = new Date().toISOString()
): CgHoursCorrectionResult<CgHoursTimeEntry> {
  if (entry.staff_id !== context.staffId) {
    throw new Error(`Staff isolation violation: correcting staff ${entry.staff_id} differs from context staff ${context.staffId}`)
  }

  const errors = validateCorrectionDraft(correction)
  if (errors.length > 0) {
    throw new Error(`Invalid correction: ${errors.join('; ')}`)
  }

  return applyCorrectionToTimeEntry(entry, correction, nowIso)
}