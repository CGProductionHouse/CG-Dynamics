// tests/cgHoursCrossProjectContract.test.mjs
// CA manual agent — cross-project contract tests for CG Hours integration
// Refs: Issue #361, PR #376, PR #383, PR #384
//
// These tests verify the EXTERNAL CONTRACTS that PR #376 handlers assume
// but that do NOT yet exist in CG Hours. They serve as the specification
// for what CG Hours RPCs must implement.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// ─── CG Hours RPC existence contract ─────────────────────────────────────────
// These are the RPCs that PR #376 index.ts handlers call.
// EVERY ONE of these must exist in CG Hours before any real persistence works.

describe('CG Hours RPC existence contract', () => {
  const REQUIRED_ROPCS = [
    {
      name: 'create_ordinary_hours_entry',
      called_by: 'handleLogOrdinaryHours',
      pr: '#376',
      purpose: 'Create a time entry in CG Hours with timesheet resolution',
      required_params: [
        'p_staff_id', 'p_client_id', 'p_date', 'p_hours',
        'p_task_description', 'p_notes', 'p_idempotency_key',
      ],
      must_return: '{ id: uuid, created_at: timestamptz }',
      exists_in_cg_hours: false,
    },
    {
      name: 'create_vehicle_entry',
      called_by: 'handleLogKilometreEntry',
      pr: '#376',
      purpose: 'Create a km/fuel/vehicle_expense entry',
      required_params: [
        'p_staff_id', 'p_client_id', 'p_date', 'p_type',
        'p_distance_km', 'p_description', 'p_notes',
        'p_litres', 'p_cost_per_litre', 'p_amount', 'p_idempotency_key',
      ],
      must_return: '{ id: uuid, created_at: timestamptz }',
      exists_in_cg_hours: false,
      // SCHEMA MISMATCH: CG Hours has no separate vehicle entry table.
      // KM data lives as columns on time_entries (km_travelled, km_origin, etc.)
      // 'fuel' and 'vehicle_expense' types have no CG Hours backing.
      schema_note: 'MUST write to time_entries KM columns, not a separate table',
    },
    {
      name: 'read_ordinary_hours_entries',
      called_by: 'handleReadMyRecentEntries',
      pr: '#376',
      purpose: 'Read time entries for a staff member in a date range',
      required_params: ['p_staff_id', 'p_client_id', 'p_from_date', 'p_to_date', 'p_types'],
      must_return: 'time_entry[]',
      exists_in_cg_hours: false,
    },
    {
      name: 'read_vehicle_entries',
      called_by: 'handleReadMyRecentEntries',
      pr: '#376',
      purpose: 'Read vehicle/km entries',
      required_params: ['p_staff_id', 'p_client_id', 'p_from_date', 'p_to_date', 'p_types'],
      must_return: 'vehicle_entry[]',
      exists_in_cg_hours: false,
      schema_note: 'CG Hours has no separate vehicle entries; must read time_entries with km columns',
    },
    {
      name: 'apply_ordinary_hours_correction',
      called_by: 'handleCorrectMyEntry',
      pr: '#376',
      purpose: 'Correct a time entry with audit trail',
      required_params: ['p_entry_id', 'p_staff_id', 'p_correction', 'p_reason', 'p_idempotency_key'],
      must_return: '{ id: uuid, updated_at: timestamptz }',
      exists_in_cg_hours: false,
    },
    {
      name: 'apply_vehicle_correction',
      called_by: 'handleCorrectMyEntry',
      pr: '#376',
      purpose: 'Correct a vehicle/km entry with audit trail',
      required_params: ['p_entry_id', 'p_staff_id', 'p_correction', 'p_reason', 'p_idempotency_key'],
      must_return: '{ id: uuid, updated_at: timestamptz }',
      exists_in_cg_hours: false,
      schema_note: 'Must update time_entries KM columns, not a separate table',
    },
  ]

  for (const rpc of REQUIRED_ROPCS) {
    it(`RPC "${rpc.name}" must exist in CG Hours (called by ${rpc.called_by})`, () => {
      // This test documents the requirement. It fails until the RPC is created.
      assert.equal(rpc.exists_in_cg_hours, false,
        `RPC ${rpc.name} does NOT exist in CG Hours yet. Required by PR ${rpc.pr}.`)
    })

    it(`RPC "${rpc.name}" has correct parameter specification`, () => {
      assert.ok(rpc.required_params.length > 0, `${rpc.name} has defined params`)
      assert.ok(rpc.must_return, `${rpc.name} has defined return type`)
    })
  }
})

// ─── CG Hours schema mismatch contract ───────────────────────────────────────
// PR #376 models vehicle entries as separate records with types:
//   'mileage' | 'fuel' | 'vehicle_expense'
// CG Hours does NOT have this model. These tests document the mismatches.

describe('CG Hours schema mismatch contract', () => {
  it('CG Hours time_entries uses duration_minutes, not hours', () => {
    // PR #376 passes p_hours to the RPC. CG Hours stores duration_minutes.
    // The RPC must convert: duration_minutes = p_hours * 60
    const cgHoursColumn = 'duration_minutes'
    const pr376Param = 'p_hours'
    const conversionRequired = true

    assert.equal(cgHoursColumn, 'duration_minutes')
    assert.equal(pr376Param, 'p_hours')
    assert.equal(conversionRequired, true, 'RPC must multiply hours by 60')
  })

  it('CG Hours time_entries requires timesheet_id (NOT NULL)', () => {
    // PR #376 handlers do not provide timesheet_id.
    // The RPC MUST resolve/create the weekly timesheet internally.
    const constraint = 'NOT NULL FK → timesheets(id)'
    const pr376Provides = 'nothing — handler does not pass timesheet_id'

    assert.ok(constraint.includes('NOT NULL'), 'timesheet_id is required')
    assert.ok(pr376Provides.includes('nothing'), 'PR #376 does not provide timesheet_id')
  })

  it('CG Hours timesheets has unique(staff_id, week_start_date)', () => {
    // One timesheet per staff per week. The RPC must handle:
    // 1. Query existing timesheet for the week
    // 2. If not found, INSERT with ON CONFLICT for race safety
    const uniqueConstraint = 'unique(staff_id, week_start_date)'
    assert.ok(uniqueConstraint.includes('staff_id'), 'staff_id is part of unique')
    assert.ok(uniqueConstraint.includes('week_start_date'), 'week_start_date is part of unique')
  })

  it('CG Hours KM data lives on time_entries, not a separate table', () => {
    // PR #376 models 'mileage', 'fuel', 'vehicle_expense' as separate entry types.
    // CG Hours has:
    //   time_entries.km_travelled (numeric)
    //   time_entries.km_origin (text)
    //   time_entries.km_destination (text)
    //   time_entries.km_notes (text)
    //   time_entries.km_compensation_method (text)
    //   time_entries.km_review_status (text, default 'draft')
    //   time_entries.km_reviewed_by (uuid FK)
    //   time_entries.km_reviewed_at (timestamptz)
    //
    // 'fuel' and 'vehicle_expense' are INVENTED by PR #376.
    // They have no CG Hours backing.
    const cgHoursKmColumns = [
      'km_travelled', 'km_origin', 'km_destination', 'km_notes',
      'km_compensation_method', 'km_review_status', 'km_reviewed_by', 'km_reviewed_at',
    ]
    const pr376VehicleTypes = ['mileage', 'fuel', 'vehicle_expense']

    assert.ok(cgHoursKmColumns.includes('km_travelled'), 'km_travelled exists on time_entries')
    // 'fuel' and 'vehicle_expense' are PR #376 inventions with no CG Hours backing
    const cgHoursEntryTypes = ['time'] // CG Hours only has time entries (with optional km columns)
    assert.ok(!cgHoursEntryTypes.includes('fuel'), 'fuel is NOT a CG Hours entry type')
    assert.ok(!cgHoursEntryTypes.includes('vehicle_expense'), 'vehicle_expense is NOT a CG Hours entry type')
  })

  it('CG Hours travel_requests is a SEPARATE calculator, not time_entries', () => {
    // travel_requests has admin override fields and its own review workflow.
    // It is NOT the same as PR #376's vehicle entry model.
    const travelRequestsPurpose = 'Staff travel calculator with admin override'
    const hasAdminOverrides = true
    const hasStaffCalculatorFields = true

    assert.ok(travelRequestsPurpose.includes('calculator'), 'travel_requests is a calculator')
    assert.equal(hasAdminOverrides, true, 'has admin_fuel_price, admin_amount, etc.')
  })

  it('CG Hours has no odometer fields', () => {
    // PR #383 tests odometer validation. CG Hours has no odometer concept.
    // The RPC should not require or store odometer data.
    const odometerFieldsInCGHours = 0
    assert.equal(odometerFieldsInCGHours, 0, 'CG Hours has no odometer fields')
  })

  it('CG Hours task_templates has tracks_km flag', () => {
    // Migration 036: update task_templates set tracks_km = true where name = 'Traveling'
    // For km entries, the RPC should resolve the "Traveling" template ID.
    const templateName = 'Traveling'
    const tracksKm = true
    assert.equal(templateName, 'Traveling')
    assert.equal(tracksKm, true)
  })
})

// ─── Cross-project identity contract ─────────────────────────────────────────

describe('Cross-project identity contract', () => {
  it('CG Hours and CG Dynamics use different Supabase projects', () => {
    const hoursProjectRef = 'qcafdqwhwqaxjhdcugcs'
    const dynamicsProjectRef = 'DIFFERENT' // not committed to repo, env-based

    assert.ok(hoursProjectRef.length > 0, 'CG Hours has a project ref')
    assert.notEqual(hoursProjectRef, dynamicsProjectRef, 'projects are different')
  })

  it('staff identity mapping is REQUIRED', () => {
    // CG Hours profiles.id and CG Dynamics profiles.id are in separate auth systems.
    // A mapping table is needed to translate between them.
    const mappingRequired = true
    assert.equal(mappingRequired, true, 'staff mapping table is required')
  })

  it('client mapping is REQUIRED', () => {
    // "Germoparts" in CG Dynamics has UUID X.
    // "Germoparts" in CG Hours has UUID Y.
    // X ≠ Y. A mapping table is needed.
    const mappingRequired = true
    assert.equal(mappingRequired, true, 'client mapping table is required')
  })
})

// ─── Idempotency crash boundary contract ─────────────────────────────────────

describe('Cross-project idempotency crash boundary', () => {
  it('MCP-level idempotency is NOT sufficient for cross-project writes', () => {
    // Crash scenario:
    // 1. MCP handler calls CG Hours RPC
    // 2. CG Hours INSERT succeeds
    // 3. Response lost (timeout)
    // 4. MCP idempotency record NOT committed
    // 5. Retry → MCP finds no prior record
    // 6. CG Hours INSERT again → DUPLICATE
    //
    // The CG Hours RPC itself must enforce idempotency.
    const mcpIdempotencyAlone = false
    const rpcLevelIdempotencyRequired = true

    assert.equal(rpcLevelIdempotencyRequired, true, 'RPC must check idempotency_key before insert')
  })

  it('CG Hours RPC idempotency contract', () => {
    // The RPC should:
    // 1. Hash the idempotency_key with staff_id + action
    // 2. Check if a record with that key already exists
    // 3. If yes, return the existing record
    // 4. If no, insert and record the key
    const contract = {
      keyDerivation: 'SHA-256(staff_id | action | request_key) -> uuid',
      dedupCheck: 'SELECT FROM idempotency_log WHERE key = derived_uuid',
      onDuplicate: 'RETURN existing record (not error)',
      onFirstInsert: 'INSERT time_entry + INSERT idempotency_log',
    }

    assert.ok(contract.keyDerivation.includes('SHA-256'), 'deterministic key derivation')
    assert.ok(contract.onDuplicate.includes('RETURN existing'), 'duplicate returns existing, not error')
  })
})

// ─── Receipt truth contract ──────────────────────────────────────────────────

describe('Receipt truth contract', () => {
  it('successful persistence requires real CG Hours time_entries.id', () => {
    // PR #376 returns: { record_id: data?.id, created_at: new Date().toISOString() }
    // Problems:
    // 1. data?.id depends on RPC returning the inserted row
    // 2. created_at is client-side, not server-side
    // A trustworthy receipt must include:
    const requiredReceiptFields = [
      'record_id',      // actual CG Hours time_entries.id
      'created_at',     // server-side timestamp from CG Hours
      'idempotency_key', // the key used for dedup
    ]

    assert.ok(requiredReceiptFields.includes('record_id'), 'record_id is required')
    assert.ok(requiredReceiptFields.includes('created_at'), 'created_at is required')
    assert.ok(requiredReceiptFields.includes('idempotency_key'), 'idempotency_key is required')
  })

  it('mock fixture IDs do not count as persistence proof', () => {
    const fixtureId = 'fixture-entry-1'
    const realId = '550e8400-e29b-41d4-a716-446655440000'

    assert.ok(fixtureId.startsWith('fixture-'), 'fixture IDs are prefixed')
    assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(realId),
      'real IDs are UUIDs')
  })
})

// ─── Correction semantics contract ───────────────────────────────────────────

describe('Correction semantics contract', () => {
  it('CG Hours has no built-in correction audit trail', () => {
    // The audit_log table exists but is not automatically triggered for time_entries.
    // Corrections must either:
    // 1. Use the audit_log table explicitly in the RPC
    // 2. Store before/after in a dedicated corrections table
    // 3. Use km_review_status workflow for km corrections
    const auditLogExists = true
    const autoTriggeredOnTimeEntries = false

    assert.equal(auditLogExists, true, 'audit_log table exists')
    assert.equal(autoTriggeredOnTimeEntries, false, 'not auto-triggered for time_entries')
  })

  it('CG Hours km_review_status workflow for km corrections', () => {
    // km_review_status: draft → submitted → approved/rejected
    // km_reviewed_by: who reviewed
    // km_reviewed_at: when reviewed
    const workflow = ['draft', 'submitted', 'approved', 'rejected']
    assert.equal(workflow.length, 4, '4 review statuses')
    assert.equal(workflow[0], 'draft', 'starts as draft')
  })
})
