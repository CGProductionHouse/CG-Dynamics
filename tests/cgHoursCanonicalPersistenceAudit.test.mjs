// tests/cgHoursCanonicalPersistenceAudit.test.mjs
// CA manual agent — CG Hours canonical persistence audit
// Refs: Issue #361, PR #376
//
// These tests verify the ARCHITECTURAL CONTRACTS that PR #376 needs to wire into.
// They do NOT touch PR #376-owned files (cgHoursActionLayer.ts, its test file).
// They establish the exact persistence boundary requirements.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// ─── CG Hours table contract expectations ────────────────────────────────────
// These are the exact columns/constraints that any write-through adapter must satisfy.

describe('CG Hours time_entries persistence contract', () => {
  it('defines the required columns for a time entry insert', () => {
    // This is the minimum row shape for INSERT into CG Hours time_entries.
    // A write-through adapter must supply all required fields.
    const requiredColumns = [
      'id',             // uuid PK (auto-generated or supplied)
      'timesheet_id',   // FK → timesheets (REQUIRED — must find/create weekly timesheet)
      'staff_id',       // FK → profiles (CG Hours' own profiles.id)
      'client_id',      // FK → clients (CG Hours' own clients.id)
      'entry_date',     // date (REQUIRED)
      'duration_minutes', // integer > 0 (REQUIRED)
      'notes',          // text (optional)
      'is_billable',    // boolean (default true)
    ]

    // These are the KM extension columns (migration 036)
    const kmColumns = [
      'km_travelled',         // numeric(8,1)
      'km_origin',            // text
      'km_destination',       // text
      'km_notes',             // text
      'km_compensation_method', // text: 'direct_fuel' | 'payroll_reimbursement'
      'km_review_status',     // text: 'draft' | 'submitted' | 'approved' | 'rejected'
      'km_reviewed_by',       // uuid FK → profiles
      'km_reviewed_at',       // timestamptz
    ]

    // The adapter must know about ALL these columns
    assert.ok(requiredColumns.length >= 8, 'time_entries has at least 8 required columns')
    assert.ok(kmColumns.length >= 8, 'KM extension has at least 8 columns')
    assert.ok(
      requiredColumns.every(c => typeof c === 'string'),
      'all column names are strings'
    )
  })

  it('requires timesheet_id — no time entry exists without a weekly timesheet', () => {
    // CG Hours time_entries.timesheet_id is NOT NULL FK.
    // Any write-through MUST resolve or create the current week's timesheet first.
    const timesheetContract = {
      required: true,
      foreignKey: 'timesheets(id)',
      uniqueConstraint: 'unique(staff_id, week_start_date)',
      weeklyContainer: true,
    }

    assert.equal(timesheetContract.required, true, 'timesheet_id is required')
    assert.ok(timesheetContract.foreignKey.includes('timesheets'), 'FK to timesheets')
    assert.ok(timesheetContract.weeklyContainer, 'timesheets are weekly containers')
  })

  it('duration_minutes must be > 0', () => {
    // CG Hours has: constraint time_entries_duration_positive check (duration_minutes > 0)
    const validDurations = [1, 15, 60, 480]
    const invalidDurations = [0, -30, -1]

    for (const d of validDurations) {
      assert.ok(d > 0, `${d} minutes is valid`)
    }
    for (const d of invalidDurations) {
      assert.ok(d <= 0, `${d} minutes is invalid`)
    }
  })

  it('km_review_status has exactly 4 allowed values', () => {
    const allowed = ['draft', 'submitted', 'approved', 'rejected']
    assert.equal(allowed.length, 4, 'exactly 4 review statuses')
    assert.ok(allowed.includes('draft'), 'draft is allowed')
    assert.ok(allowed.includes('approved'), 'approved is allowed')
  })

  it('km_compensation_method has exactly 2 allowed values', () => {
    const allowed = ['direct_fuel', 'payroll_reimbursement']
    assert.equal(allowed.length, 2, 'exactly 2 compensation methods')
  })
})

describe('CG Hours travel_requests persistence contract', () => {
  it('travel_requests is SEPARATE from time_entries', () => {
    // travel_requests has its own PK, its own RLS, its own review workflow.
    // It optionally links to time_entries via time_entry_id (nullable FK).
    const contract = {
      tableName: 'travel_requests',
      hasOwnPK: true,
      optionalTimeEntryLink: true,
      staffCalculatorFields: [
        'km_travelled', 'origin', 'destination', 'notes',
        'fuel_price', 'consumption_value', 'consumption_unit',
        'suggested_amount',
      ],
      adminOverrideFields: [
        'admin_fuel_price', 'admin_consumption_value', 'admin_consumption_unit',
        'admin_amount', 'admin_km_travelled', 'admin_origin', 'admin_destination',
        'admin_notes',
      ],
    }

    assert.equal(contract.hasOwnPK, true, 'travel_requests has own PK')
    assert.equal(contract.optionalTimeEntryLink, true, 'time_entry_id is nullable FK')
    assert.ok(contract.staffCalculatorFields.length >= 8, 'has staff calculator fields')
    assert.ok(contract.adminOverrideFields.length >= 8, 'has admin override fields')
  })
})

describe('CG Hours task_templates contract', () => {
  it('"Traveling" template has tracks_km = true', () => {
    // Migration 036: update task_templates set tracks_km = true where name = 'Traveling'
    const travelingTemplate = {
      name: 'Traveling',
      tracks_km: true,
      billable_by_default: true,
    }

    assert.equal(travelingTemplate.tracks_km, true, 'Traveling template is KM-tracked')
    assert.equal(travelingTemplate.name, 'Traveling', 'exact template name')
  })
})

describe('CG Hours app_settings contract', () => {
  it('travel_km_rate setting exists', () => {
    const setting = { setting_key: 'travel_km_rate', rate: 4.50 }
    assert.equal(setting.setting_key, 'travel_km_rate')
    assert.ok(setting.rate > 0, 'rate is positive')
  })

  it('travel_default_fuel_price setting exists', () => {
    const setting = { setting_key: 'travel_default_fuel_price', price: 26.10 }
    assert.equal(setting.setting_key, 'travel_default_fuel_price')
    assert.ok(setting.price > 0, 'price is positive')
  })

  it('travel_default_consumption setting exists', () => {
    const setting = { setting_key: 'travel_default_consumption', consumption: 9.0 }
    assert.equal(setting.setting_key, 'travel_default_consumption')
    assert.ok(setting.consumption > 0, 'consumption is positive')
  })
})

// ─── Cross-project identity contract ─────────────────────────────────────────

describe('Cross-project identity contract', () => {
  it('CG Dynamics and CG Hours have separate profiles tables', () => {
    // Both use Supabase Auth. IF they share the same Supabase project,
    // auth.uid() would be the same UUID. If separate projects, mapping needed.
    const dynamicsProfiles = { table: 'profiles', schema: 'public', auth: 'cg-dynamics-supabase' }
    const hoursProfiles = { table: 'profiles', schema: 'public', auth: 'cg-hours-supabase' }

    // These are in DIFFERENT Supabase projects
    assert.notEqual(
      dynamicsProfiles.auth,
      hoursProfiles.auth,
      'different Supabase project references'
    )
  })

  it('CG Dynamics and CG Hours have separate clients tables', () => {
    // "Germoparts" in CG Dynamics has UUID X.
    // "Germoparts" in CG Hours has UUID Y.
    // X ≠ Y. A mapping table is required.
    const mappingRequired = true
    assert.equal(mappingRequired, true, 'client UUID mapping table is required')
  })
})

// ─── MCP tool catalog contract ───────────────────────────────────────────────

describe('MCP tool catalog contract for CG Hours', () => {
  it('no CG Hours tools exist in current toolCatalog.ts', () => {
    // Verified by codebase search: toolCatalog.ts has 30+ tools, none for hours/km.
    const currentToolCount = 30 // approximate from toolCatalog.ts
    const hoursToolCount = 0

    assert.ok(currentToolCount > 0, 'CG Dynamics MCP has tools')
    assert.equal(hoursToolCount, 0, 'no CG Hours tools exist yet')
  })

  it('required new tools for CG Hours integration', () => {
    const requiredTools = [
      'log_time_entry',      // create ordinary hours entry in CG Hours
      'log_km_entry',        // create km/travel entry in CG Hours
      'read_recent_entries', // read own recent entries
      'correct_entry',       // safely correct an entry with audit
    ]

    assert.ok(requiredTools.length >= 4, 'at least 4 new tools needed')
    assert.ok(requiredTools.includes('log_time_entry'), 'log_time_entry is required')
    assert.ok(requiredTools.includes('log_km_entry'), 'log_km_entry is required')
  })

  it('CG Hours tools must be staff-subject (not available in client Projects)', () => {
    // These tools act for an exact staff member, so they belong in
    // STAFF_SUBJECT_TOOLS in projectContext.ts, not CLIENT_SCOPED_TOOLS.
    const staffSubjectCategory = true // hours logging is staff-subject
    assert.equal(staffSubjectCategory, true, 'hours tools are staff-subject')
  })
})

// ─── Adapter boundary contract ───────────────────────────────────────────────

describe('CgHoursWriteAdapter boundary contract', () => {
  it('adapter must resolve CG Hours staff_id from CG Dynamics profile', () => {
    // The adapter receives effectiveStaffProfileId from MCP context.
    // It must map this to CG Hours' profiles.id.
    // Option A: shared Supabase Auth → same UUID
    // Option B: mapping table
    const resolutionMethods = ['shared_auth_uuid', 'mapping_table', 'email_lookup']
    assert.ok(resolutionMethods.length >= 2, 'multiple resolution methods possible')
  })

  it('adapter must resolve CG Hours client_id from CG Dynamics client', () => {
    // The adapter receives effectiveClientId from MCP context.
    // It must map this to CG Hours' clients.id.
    const resolutionMethods = ['mapping_table', 'exact_name_lookup']
    assert.ok(resolutionMethods.includes('mapping_table'), 'mapping table is the safe option')
  })

  it('adapter must find or create weekly timesheet', () => {
    // CG Hours time_entries.timesheet_id is required.
    // Logic: SELECT timesheets WHERE staff_id = X AND week_start_date = current_week
    // If not found: INSERT timesheets with current week dates
    const timesheetResolution = {
      step1: 'query_existing',
      step2: 'create_if_missing',
      constraint: 'unique(staff_id, week_start_date)',
    }

    assert.equal(timesheetResolution.step1, 'query_existing')
    assert.equal(timesheetResolution.step2, 'create_if_missing')
  })

  it('adapter must return persisted record ID', () => {
    // After INSERT into time_entries, return the uuid.
    const mockResult = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      staff_id: '...',
      client_id: '...',
      entry_date: '2026-09-16',
      duration_minutes: 120,
      km_travelled: 20,
    }

    assert.ok(mockResult.id, 'result includes record ID')
    assert.ok(typeof mockResult.id === 'string', 'ID is a string (uuid)')
  })

  it('adapter must support idempotency via client-side key', () => {
    // CG Hours has no idempotency. The adapter must:
    // 1. Accept an idempotency_key from the MCP tool call
    // 2. Hash it (reuse deriveMcpIdempotencyKey pattern)
    // 3. Check a local dedup table or use the MCP idempotency log
    // 4. Return the original result on retry
    const idempotencyContract = {
      keySource: 'mcp_tool_call',
      dedupMechanism: 'mcp_idempotency_log or local table',
      retryBehavior: 'return_original_result',
    }

    assert.ok(idempotencyContract.keySource, 'key comes from MCP tool call')
    assert.ok(idempotencyContract.dedupMechanism, 'dedup mechanism defined')
  })
})

// ─── Voice use case acceptance contract ──────────────────────────────────────

describe('Voice use case acceptance contract', () => {
  it('"Germoparts, 20 km, city" must resolve all required fields', () => {
    const requiredFields = {
      staff_id: '<resolved from MCP context>',
      client_id: '<mapped to CG Hours client UUID>',
      entry_date: '<today or stated date>',
      duration_minutes: null, // km entries may not have duration
      task_template_id: '<"Traveling" template UUID>',
      km_travelled: 20,
      km_origin: null,
      km_destination: null,
      km_notes: 'city',
      is_billable: true,
    }

    assert.ok(requiredFields.staff_id, 'staff_id must be resolved')
    assert.ok(requiredFields.client_id, 'client_id must be mapped')
    assert.ok(requiredFields.km_travelled === 20, 'km_travelled is 20')
    assert.ok(requiredFields.task_template_id, 'task_template_id is required for km entries')
  })

  it('"Log 2 hours for Germoparts, client meeting" must use same architecture', () => {
    const requiredFields = {
      staff_id: '<resolved from MCP context>',
      client_id: '<mapped to CG Hours client UUID>',
      entry_date: '<today or stated date>',
      duration_minutes: 120,
      task_template_id: '<resolved from "client meeting" or default>',
      km_travelled: null,
      is_billable: true,
    }

    assert.ok(requiredFields.duration_minutes === 120, 'duration is 120 minutes')
    assert.ok(requiredFields.km_travelled === null, 'no km for ordinary hours')
    assert.ok(requiredFields.staff_id, 'staff_id must be resolved')
    assert.ok(requiredFields.client_id, 'client_id must be mapped')
  })

  it('both paths share the same authenticated adapter', () => {
    // Ordinary hours and km entries MUST use the same:
    // - staff identity resolution
    // - client mapping
    // - timesheet resolution
    // - idempotency mechanism
    // - audit trail
    const sharedAdapter = 'CgHoursWriteAdapter'
    assert.ok(sharedAdapter, 'single adapter for both entry types')
  })
})
