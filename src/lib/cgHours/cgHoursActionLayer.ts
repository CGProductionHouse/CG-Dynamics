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

// ──────────────────────────────────────────────────────────────────────────────
// Canonical CG Hours persistence adapter boundary
// ──────────────────────────────────────────────────────────────────────────────
// The canonical CG Hours backend (separate system) must implement this adapter.
// If the adapter is not provided, the action layer returns NOT_CONFIGURED with the
// exact contract required. No shadow ledger, no local fallback persistence.
export interface CgHoursTimeEntryRecord {
  id: string
  staff_id: string
  client_id: string | null
  date: string // YYYY-MM-DD
  type: 'time'
  hours: number
  task_description: string
  notes?: string | null
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
}

export interface CgHoursPersistenceReceipt {
  record_id: string
  idempotency_key: string
  created_at: string
}

export type CgHoursPersistenceResult<T> =
  | { ok: true; receipt: CgHoursPersistenceReceipt; record: T }
  | { ok: false; error: 'NOT_CONFIGURED'; contract: CgHoursPersistenceContract }
  | { ok: false; error: 'UNAUTHORIZED'; reason: string }
  | { ok: false; error: 'VALIDATION_ERROR'; details: string[] }
  | { ok: false; error: 'CONFLICT'; reason: string; existing_id?: string }
  | { ok: false; error: 'UPSTREAM_ERROR'; reason: string }

export interface CgHoursPersistenceContract {
  // The canonical CG Hours backend must expose these RPCs/endpoints:
  // 1. create_ordinary_hours_entry(p_staff_id, p_client_id, p_date, p_hours, p_task_description, p_notes, p_idempotency_key)
  //    -> returns { record_id, created_at }
  // 2. read_ordinary_hours_entries(p_staff_id, p_from_date, p_to_date, p_types?, p_client_id?)
  //    -> returns CgHoursTimeEntryRecord[]
  // 3. apply_ordinary_hours_correction(p_entry_id, p_staff_id, p_correction, p_reason, p_idempotency_key)
  //    -> returns { record_id, updated_at }
  // 4. All endpoints enforce RLS: staff can only access their own entries; client context is pinned.
  // Idempotency: p_idempotency_key must be a deterministic key derived from (staff_id, action, request_key)
  //              using the existing deriveMcpIdempotencyKey. Duplicate calls return the existing receipt.
  required_endpoints: string[]
  idempotency_strategy: string
  rls_enforcement: string
  staff_client_isolation: string
}

export interface CgHoursPersistenceAdapter {
  createOrdinaryHoursEntry(
    staffId: string,
    clientId: string | null,
    date: string,
    hours: number,
    taskDescription: string,
    notes: string | undefined,
    idempotencyKey: string
  ): Promise<CgHoursPersistenceResult<CgHoursTimeEntryRecord>>

  readOrdinaryHoursEntries(
    staffId: string,
    clientId: string | null,
    fromDate: string,
    toDate: string,
    types?: CgHoursEntryType[]
  ): Promise<CgHoursPersistenceResult<CgHoursTimeEntryRecord[]>>

  applyOrdinaryHoursCorrection(
    entryId: string,
    staffId: string,
    correction: {
      hours?: number
      task_description?: string
      notes?: string
    },
    reason: string,
    idempotencyKey: string
  ): Promise<CgHoursPersistenceResult<CgHoursTimeEntryRecord>>
}

export const CG_HOURS_PERSISTENCE_CONTRACT: CgHoursPersistenceContract = {
  required_endpoints: [
    'create_ordinary_hours_entry',
    'read_ordinary_hours_entries',
    'apply_ordinary_hours_correction',
    'create_vehicle_entry',
    'read_vehicle_entries',
    'apply_vehicle_correction',
  ],
  idempotency_strategy: 'deriveMcpIdempotencyKey(staff_id, action, request_key) -> uuid; duplicate key returns existing receipt',
  rls_enforcement: 'Row Level Security on canonical CG Hours tables: staff_id = current_staff_id; client_id pinned by effective client context',
  staff_client_isolation: 'Staff can only create/read/correct their own entries. Client-scoped context restricts to that client_id. Cross-staff/client access denied.',
}

// ──────────────────────────────────────────────────────────────────────────────
// Cross-project identity resolution contract (PR #384 requirement)
// ──────────────────────────────────────────────────────────────────────────────
// CG Hours is a separate Supabase project with its own `profiles` and `clients`
// tables. CG Dynamics staff/client UUIDs MUST NOT be passed through directly.
// Typed resolution must happen before any persistence call; unresolved or
// ambiguous mappings fail closed as NOT_CONFIGURED.
//
// Backing storage (NOT created in this PR — mapping apply is a CA-gated step):
//   cg_hours_staff_mapping  (dynamics_staff_id uuid PK, hours_staff_id uuid NOT NULL)
//   cg_hours_client_mapping (dynamics_client_id uuid PK, hours_client_id uuid NOT NULL)
export type CgHoursMappingKind = 'staff' | 'client'

export type CgHoursMappingResolution =
  | { ok: true; cgHoursId: string }
  | {
      ok: false
      error: 'NOT_CONFIGURED'
      mapping: CgHoursMappingKind
      /** The Dynamics-side identifier that could not be resolved. */
      identifier: string
      /** e.g. 'no mapping row', 'ambiguous: multiple CG Hours matches' */
      reason: string
    }

export interface CgHoursIdentityResolver {
  resolveStaff(dynamicsStaffId: string): Promise<CgHoursMappingResolution> | CgHoursMappingResolution
  resolveClient(dynamicsClientId: string): Promise<CgHoursMappingResolution> | CgHoursMappingResolution
}

export const CG_HOURS_MAPPING_CONTRACT = {
  staff_mapping_table: 'cg_hours_staff_mapping(dynamics_staff_id uuid PK -> hours_staff_id uuid NOT NULL UNIQUE)',
  client_mapping_table: 'cg_hours_client_mapping(dynamics_client_id uuid PK -> hours_client_id uuid NOT NULL UNIQUE)',
  resolution_rule: 'Exact UUID lookup only. Never fuzzy/name matching. Unresolved or ambiguous mapping fails closed as CG_HOURS_NOT_CONFIGURED before any persistence call.',
} as const

/**
 * Resolve Dynamics staff/client identities into canonical CG Hours UUIDs.
 * Fails closed: any unresolved or ambiguous mapping returns NOT_CONFIGURED
 * before persistence. Never passes Dynamics UUIDs through to CG Hours.
 */
export async function resolveCgHoursIdentity(
  resolver: CgHoursIdentityResolver,
  dynamicsStaffId: string,
  dynamicsClientId: string | null
): Promise<
  | { ok: true; cgHoursStaffId: string; cgHoursClientId: string | null }
  | { ok: false; error: 'NOT_CONFIGURED'; mapping: CgHoursMappingKind; identifier: string; reason: string }
> {
  const staff = await resolver.resolveStaff(dynamicsStaffId)
  if (!staff.ok) {
    return { ok: false, error: 'NOT_CONFIGURED', mapping: 'staff', identifier: dynamicsStaffId, reason: staff.reason }
  }
  if (dynamicsClientId === null) {
    return { ok: true, cgHoursStaffId: staff.cgHoursId, cgHoursClientId: null }
  }
  const client = await resolver.resolveClient(dynamicsClientId)
  if (!client.ok) {
    return { ok: false, error: 'NOT_CONFIGURED', mapping: 'client', identifier: dynamicsClientId, reason: client.reason }
  }
  return { ok: true, cgHoursStaffId: staff.cgHoursId, cgHoursClientId: client.cgHoursId }
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
  /**
   * Optional cross-project identity resolver (PR #384 contract). When present,
   * Dynamics staff/client IDs are resolved to canonical CG Hours UUIDs before
   * persistence; unresolved/ambiguous mappings fail closed as NOT_CONFIGURED.
   * When absent, context IDs pass through unchanged (preserves current MCP
   * behavior; real deployments MUST supply a resolver per the mapping contract).
   */
  identityResolver?: CgHoursIdentityResolver
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
  const { staffId } = context
  return {
    staff_id: staffId,
    from_date: fromDate,
    to_date: toDate,
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

  if (entry.client_id !== context.clientId && context.clientId !== null) {
    throw new Error(`Client isolation violation: entry.client_id=${entry.client_id} differs from context.clientId=${context.clientId}`)
  }

  const errors = validateCorrectionDraft(correction)
  if (errors.length > 0) {
    throw new Error(`Invalid correction: ${errors.join('; ')}`)
  }

  return applyCorrectionToTimeEntry(entry, correction, nowIso)
}

// ──────────────────────────────────────────────────────────────────────────────
// Vehicle/Kilometre entry types and validation
// ──────────────────────────────────────────────────────────────────────────────

export interface CgHoursVehicleEntryDraft {
  client_id: string | null
  date: string // YYYY-MM-DD
  type: 'mileage' | 'fuel' | 'vehicle_expense'
  distance_km?: number
  description?: string
  notes?: string
  litres?: number
  cost_per_litre?: number
  amount?: number
}

export interface CgHoursVehicleEntryRecord {
  id: string
  staff_id: string
  client_id: string | null
  date: string
  type: 'mileage' | 'fuel' | 'vehicle_expense'
  distance_km?: number | null
  description?: string | null
  notes?: string | null
  litres?: number | null
  cost_per_litre?: number | null
  amount?: number | null
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
}

export function validateCgHoursVehicleEntryDraft(draft: CgHoursVehicleEntryDraft): string[] {
  const errors: string[] = []

  if (!draft.date || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
    errors.push('date must be YYYY-MM-DD')
  }

  if (!['mileage', 'fuel', 'vehicle_expense'].includes(draft.type)) {
    errors.push('type must be "mileage", "fuel", or "vehicle_expense"')
    return errors
  }

  if (draft.type === 'mileage') {
    if (typeof draft.distance_km !== 'number' || !Number.isFinite(draft.distance_km) || draft.distance_km < 0) {
      errors.push('mileage requires non-negative distance_km')
    }
    if (draft.distance_km && draft.distance_km > 2000) {
      errors.push('distance_km exceeds reasonable daily maximum (2000)')
    }
  }

  if (draft.type === 'fuel') {
    if (typeof draft.litres !== 'number' || !Number.isFinite(draft.litres) || draft.litres <= 0) {
      errors.push('fuel requires positive litres')
    }
    if (draft.litres && draft.litres > 200) {
      errors.push('litres exceeds reasonable single-fill maximum (200)')
    }
    if (typeof draft.cost_per_litre !== 'number' || !Number.isFinite(draft.cost_per_litre) || draft.cost_per_litre <= 0) {
      errors.push('fuel requires positive cost_per_litre')
    }
  }

  if (draft.type === 'vehicle_expense') {
    if (!draft.description || draft.description.trim().length === 0) {
      errors.push('vehicle_expense requires description')
    }
    if (typeof draft.amount !== 'number' || !Number.isFinite(draft.amount) || draft.amount <= 0) {
      errors.push('vehicle_expense requires positive amount')
    }
  }

  if (draft.notes && draft.notes.length > 1000) {
    errors.push('notes exceeds maximum length (1000)')
  }

  return errors
}

export function isVehicleDraftSubmittable(draft: CgHoursVehicleEntryDraft): boolean {
  return validateCgHoursVehicleEntryDraft(draft).length === 0
}

export function createVehicleEntryFromDraft(
  draft: CgHoursVehicleEntryDraft,
  staffId: string,
  nowIso = new Date().toISOString()
): CgHoursVehicleEntry {
  const errors = validateCgHoursVehicleEntryDraft(draft)
  if (errors.length > 0) {
    throw new Error(`Invalid vehicle entry draft: ${errors.join('; ')}`)
  }

  return {
    staff_id: staffId,
    client_id: draft.client_id,
    date: draft.date,
    type: draft.type,
    distance_km: draft.distance_km,
    description: draft.description?.trim(),
    notes: draft.notes?.trim(),
    status: 'draft',
    created_at: nowIso,
    updated_at: nowIso,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Extended persistence adapter for vehicle entries
// ──────────────────────────────────────────────────────────────────────────────

export interface CgHoursPersistenceAdapter {
  createOrdinaryHoursEntry(
    staffId: string,
    clientId: string | null,
    date: string,
    hours: number,
    taskDescription: string,
    notes: string | undefined,
    idempotencyKey: string
  ): Promise<CgHoursPersistenceResult<CgHoursTimeEntryRecord>>

  readOrdinaryHoursEntries(
    staffId: string,
    clientId: string | null,
    fromDate: string,
    toDate: string,
    types?: CgHoursEntryType[]
  ): Promise<CgHoursPersistenceResult<CgHoursTimeEntryRecord[]>>

  applyOrdinaryHoursCorrection(
    entryId: string,
    staffId: string,
    correction: {
      hours?: number
      task_description?: string
      notes?: string
    },
    reason: string,
    idempotencyKey: string
  ): Promise<CgHoursPersistenceResult<CgHoursTimeEntryRecord>>

  // Vehicle/kilometre entries
  createVehicleEntry(
    staffId: string,
    clientId: string | null,
    date: string,
    type: 'mileage' | 'fuel' | 'vehicle_expense',
    distanceKm: number | undefined,
    description: string | undefined,
    notes: string | undefined,
    litres: number | undefined,
    costPerLitre: number | undefined,
    amount: number | undefined,
    idempotencyKey: string
  ): Promise<CgHoursPersistenceResult<CgHoursVehicleEntryRecord>>

  readVehicleEntries(
    staffId: string,
    clientId: string | null,
    fromDate: string,
    toDate: string,
    types?: ('mileage' | 'fuel' | 'vehicle_expense')[]
  ): Promise<CgHoursPersistenceResult<CgHoursVehicleEntryRecord[]>>

  applyVehicleCorrection(
    entryId: string,
    staffId: string,
    correction: {
      distance_km?: number
      description?: string
      notes?: string
      litres?: number
      cost_per_litre?: number
      amount?: number
    },
    reason: string,
    idempotencyKey: string
  ): Promise<CgHoursPersistenceResult<CgHoursVehicleEntryRecord>>
}

// ──────────────────────────────────────────────────────────────────────────────
// Authenticated canonical CG Hours action — wired to the existing CG Dynamics
// OAuth/MCP/project/staff context and the canonical CG Hours backend.
// ──────────────────────────────────────────────────────────────────────────────

export type OrdinaryHoursAction =
  | { type: 'create'; draft: CgHoursTimeEntryDraft }
  | { type: 'read'; fromDate: string; toDate: string; types?: CgHoursEntryType[] }
  | { type: 'correct'; entryId: string; correction: CgHoursCorrectionDraft }
  | { type: 'create_vehicle'; draft: CgHoursVehicleEntryDraft }
  | { type: 'read_vehicle'; fromDate: string; toDate: string; types?: ('mileage' | 'fuel' | 'vehicle_expense')[] }

export interface ExecuteOrdinaryHoursActionResult {
  action: OrdinaryHoursAction['type']
  result: CgHoursPersistenceResult<CgHoursTimeEntryRecord | CgHoursTimeEntryRecord[] | CgHoursVehicleEntryRecord | CgHoursVehicleEntryRecord[]>
}

/**
 * Execute one ordinary-hours action from the authenticated effective staff/client
 * context through the canonical CG Hours persistence adapter.
 *
 * If no adapter is provided (i.e., the canonical CG Hours backend is not configured
 * in this repo), returns a typed NOT_CONFIGURED result with the exact adapter
 * contract required. No shadow ledger, no local fallback persistence.
 *
 * Staff/client isolation, idempotency, and duplicate-retry safety are enforced
 * by the adapter contract; this function only validates context and delegates.
 */
export async function executeOrdinaryHoursAction(
  context: CgHoursOrdinaryHoursActionContext,
  action: OrdinaryHoursAction,
  adapter?: CgHoursPersistenceAdapter
): Promise<ExecuteOrdinaryHoursActionResult> {
  const { staffId: staffIdRaw, clientId: clientIdRaw, idempotencyKey: keyFn, identityResolver } = context

  if (!adapter) {
    return {
      action: action.type,
      result: {
        ok: false,
        error: 'NOT_CONFIGURED',
        contract: CG_HOURS_PERSISTENCE_CONTRACT,
      },
    }
  }

  // Cross-project identity resolution (PR #384): when a resolver is supplied,
  // Dynamics staff/client IDs are mapped to canonical CG Hours UUIDs before any
  // persistence call. Unresolved/ambiguous mappings fail closed as NOT_CONFIGURED;
  // Dynamics UUIDs are never passed through when a resolver is present.
  let staffId = staffIdRaw
  let clientId = clientIdRaw
  if (identityResolver) {
    const resolved = await resolveCgHoursIdentity(identityResolver, staffIdRaw, clientIdRaw)
    if (!resolved.ok) {
      return {
        action: action.type,
        result: {
          ok: false,
          error: 'NOT_CONFIGURED',
          contract: {
            ...CG_HOURS_PERSISTENCE_CONTRACT,
            mapping_failure: `${resolved.mapping}:${resolved.identifier}:${resolved.reason}`,
          } as CgHoursPersistenceContract,
        },
      }
    }
    staffId = resolved.cgHoursStaffId
    clientId = resolved.cgHoursClientId
  }

  const makeIdempotencyKey = (actionName: string, requestKey: string): string =>
    keyFn ? keyFn(actionName, requestKey) : generateIdempotencyKey(staffId, actionName, requestKey)

  switch (action.type) {
    case 'create': {
      const { draft } = action
      if (draft.client_id !== undefined && clientId !== null && draft.client_id !== clientId) {
        return {
          action: 'create',
          result: { ok: false, error: 'UNAUTHORIZED', reason: `Client isolation violation: draft.client_id=${draft.client_id} differs from context.clientId=${clientId}` },
        }
      }
      const effectiveClientId = clientId !== null ? clientId : draft.client_id
      const errors = validateCgHoursTimeEntryDraft({ ...draft, client_id: effectiveClientId })
      if (errors.length > 0) {
        return { action: 'create', result: { ok: false, error: 'VALIDATION_ERROR', details: errors } }
      }
      const idempotencyKey = makeIdempotencyKey('create_ordinary_hours_entry', `${staffId}|${effectiveClientId}|${draft.date}`)
      const result = await adapter.createOrdinaryHoursEntry(
        staffId,
        effectiveClientId,
        draft.date,
        draft.hours,
        draft.task_description,
        draft.notes,
        idempotencyKey
      )
      return { action: 'create', result }
    }

    case 'read': {
      const { fromDate, toDate, types } = action
      makeIdempotencyKey('read_ordinary_hours_entries', `${staffId}|${clientId ?? 'none'}|${fromDate}|${toDate}`)
      const result = await adapter.readOrdinaryHoursEntries(staffId, clientId, fromDate, toDate, types)
      return { action: 'read', result }
    }

    case 'correct': {
      const { entryId, correction } = action
      if (correction.staff_id !== staffId) {
        return {
          action: 'correct',
          result: { ok: false, error: 'UNAUTHORIZED', reason: `Staff isolation violation: correction.staff_id=${correction.staff_id} differs from context.staffId=${staffId}` },
        }
      }
      const errors = validateCorrectionDraft(correction)
      if (errors.length > 0) {
        return { action: 'correct', result: { ok: false, error: 'VALIDATION_ERROR', details: errors } }
      }
      const idempotencyKey = makeIdempotencyKey('apply_ordinary_hours_correction', `${staffId}|${entryId}`)
      const result = await adapter.applyOrdinaryHoursCorrection(
        entryId,
        staffId,
        { hours: correction.correction.hours, task_description: correction.correction.task_description, notes: correction.correction.notes },
        correction.reason,
        idempotencyKey
      )
      return { action: 'correct', result }
    }

    case 'create_vehicle': {
      const { draft } = action
      if (draft.client_id !== undefined && clientId !== null && draft.client_id !== clientId) {
        return {
          action: 'create_vehicle',
          result: { ok: false, error: 'UNAUTHORIZED', reason: `Client isolation violation: draft.client_id=${draft.client_id} differs from context.clientId=${clientId}` },
        }
      }
      const effectiveClientId = clientId !== null ? clientId : draft.client_id
      const errors = validateCgHoursVehicleEntryDraft({ ...draft, client_id: effectiveClientId })
      if (errors.length > 0) {
        return { action: 'create_vehicle', result: { ok: false, error: 'VALIDATION_ERROR', details: errors } }
      }
      const idempotencyKey = makeIdempotencyKey('create_vehicle_entry', `${staffId}|${effectiveClientId}|${draft.date}|${draft.type}`)
      const result = await adapter.createVehicleEntry(
        staffId,
        effectiveClientId,
        draft.date,
        draft.type,
        draft.distance_km,
        draft.description,
        draft.notes,
        draft.litres,
        draft.cost_per_litre,
        draft.amount,
        idempotencyKey
      )
      return { action: 'create_vehicle', result }
    }

    case 'read_vehicle': {
      const { fromDate, toDate, types } = action
      makeIdempotencyKey('read_vehicle_entries', `${staffId}|${clientId ?? 'none'}|${fromDate}|${toDate}`)
      const result = await adapter.readVehicleEntries(staffId, clientId, fromDate, toDate, types)
      return { action: 'read_vehicle', result }
    }
  }
}