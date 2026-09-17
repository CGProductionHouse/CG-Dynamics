# CG Hours Canonical Persistence Audit

Date: 2026-09-16 (v1) | Updated: 2026-09-17 (v2 — PR #376 code review)
Author: CA manual agent
Refs: Issue #361, PR #376, PR #383, PR #384

## Executive Summary

CG Hours is a **separate Supabase project** (`CGProductionHouse/CG-Hours`, project ref `qcafdqwhwqaxjhdcugcs`). PR #376 now defines 4 MCP tools + handlers that call 6 RPCs on CG Hours — but **none of those 6 RPCs exist in CG Hours**. The verdict is **CONTRACT_GAP**.

PR #376 has advanced from pure action layer (v1) to MCP-wired handlers with typed NOT_CONFIGURED fallback. The architecture is directionally correct but has critical schema mismatches and missing backend RPCs that prevent any real persistence.

## A. Canonical CG Hours persistence (exact locations)

### Database: CG Hours' own Supabase project (qcafdqwhwqaxjhdcugcs)

| Table | Key columns | Purpose |
|---|---|---|
| `time_entries` | `id`, `timesheet_id` (NOT NULL FK), `staff_id`, `client_id`, `project_id`, `task_template_id`, `entry_date`, `duration_minutes` (>0), `notes`, `description`, `is_billable`, `km_travelled`, `km_origin`, `km_destination`, `km_notes`, `km_compensation_method`, `km_review_status`, `km_reviewed_by`, `km_reviewed_at` | Canonical time + km entries |
| `travel_requests` | `id`, `staff_id`, `time_entry_id` (nullable FK), `client_id`, `entry_date`, `km_travelled`, `origin`, `destination`, `notes`, `fuel_price`, `consumption_value`, `consumption_unit`, `suggested_amount`, `admin_*` overrides, `review_status`, `compensation_method`, `client_billable` | Staff travel calculator with admin override |
| `timesheets` | `id`, `staff_id`, `week_start_date`, `week_end_date`, `status` | Weekly container; `unique(staff_id, week_start_date)` |
| `task_templates` | `id`, `name`, `tracks_km` | "Traveling" has `tracks_km=true` |
| `clients` | `id`, `name`, `status` | Client registry (CG Hours' own) |
| `profiles` | `id` (FK → auth.users), `full_name`, `email`, `role` | Staff registry (CG Hours' own Supabase Auth) |

### Key schema constraints (verified from migrations 001, 002, 036, 037):

- `time_entries.timesheet_id` is **NOT NULL** — every time entry MUST belong to a timesheet
- `time_entries.duration_minutes` has `CHECK (duration_minutes > 0)`
- `timesheets` has `unique (staff_id, week_start_date)` — one timesheet per staff per week
- `time_entries` RLS INSERT requires: `staff_id = auth.uid()` AND the referenced timesheet must belong to the same staff and be in `('draft', 'rejected')` status
- `km_review_status` defaults to `'draft'` with CHECK constraint
- `km_compensation_method` CHECK: `'direct_fuel'` or `'payroll_reimbursement'`

### RPCs that exist in CG Hours (complete list from all 43+ migrations):

**None related to time_entries, vehicle entries, or corrections.** CG Hours time entry management is done via direct table access with RLS. The only RPCs are for payroll, finance, leave, part-time work, and payslip artifacts.

### RPCs that PR #376 calls (NONE EXIST):

| RPC called by PR #376 | Exists in CG Hours? | Notes |
|---|---|---|
| `create_ordinary_hours_entry` | **NO** | No such function in any migration |
| `create_vehicle_entry` | **NO** | No such function; no separate vehicle entry table |
| `read_ordinary_hours_entries` | **NO** | No such function |
| `read_vehicle_entries` | **NO** | No such function |
| `apply_ordinary_hours_correction` | **NO** | No such function |
| `apply_vehicle_correction` | **NO** | No such function |

## B. Exact authenticated ChatGPT/MCP call path (as implemented in PR #376)

```
ChatGPT → Bearer token → cg-dynamics-mcp (Deno Edge Function)
→ authenticateStaff() → ConnectionPrincipal { userId, profileId, role }
→ parseProjectContext() → { contextKind: "staff", staffProfileId: "<uuid>" }
→ resolveOperatingContext() → AuthenticatedStaff { effectiveStaffProfileId }
→ tool router → handleLogOrdinaryHours / handleLogKilometreEntry / etc.
→ isCgHoursConfigured() check (CG_HOURS_SUPABASE_URL + CG_HOURS_SERVICE_ROLE_KEY)
→ createCgHoursClient() → Supabase client pointing to CG Hours project
→ cgHours.rpc('create_ordinary_hours_entry', { p_staff_id, p_client_id, ... })
→ ❌ RPC DOES NOT EXIST → error returned
```

### Handler details (from PR #376 `index.ts`):

1. **`handleLogOrdinaryHours`**: Calls `create_ordinary_hours_entry` RPC with `p_staff_id`, `p_client_id`, `p_date`, `p_hours`, `p_task_description`, `p_notes`, `p_idempotency_key`
2. **`handleLogKilometreEntry`**: Calls `create_vehicle_entry` RPC with `p_staff_id`, `p_client_id`, `p_date`, `p_type` (mileage/fuel/vehicle_expense), `p_distance_km`, `p_description`, `p_notes`, `p_litres`, `p_cost_per_litre`, `p_amount`, `p_idempotency_key`
3. **`handleReadMyRecentEntries`**: Calls `read_ordinary_hours_entries` + optionally `read_vehicle_entries` RPCs
4. **`handleCorrectMyEntry`**: Calls `apply_ordinary_hours_correction` or `apply_vehicle_correction` RPCs

## C. PR #376 vs real CG Hours schema — critical mismatches

### C1. Vehicle/km/fuel/vehicle_expense ARE NOT canonical CG Hours concepts

PR #376 models three vehicle entry types: `mileage`, `fuel`, `vehicle_expense`. These do NOT exist in CG Hours.

**What CG Hours actually has for km/travel:**

1. **`time_entries` KM columns** (migration 036): km_travelled, km_origin, km_destination, km_notes, km_compensation_method, km_review_status, km_reviewed_by, km_reviewed_at — these are COLUMNS ON TIME_ENTRIES, not separate records
2. **`travel_requests`** (migration 037): A separate staff travel calculator with admin overrides — not a time entry

**What PR #376 assumes:** Separate vehicle entry records with types `mileage` | `fuel` | `vehicle_expense` stored in a separate table or via a separate RPC.

**Verdict:** The `fuel` and `vehicle_expense` types are **invented**. They have no canonical CG Hours backing. The `mileage` type roughly maps to km columns on `time_entries`, but the data model is fundamentally different.

### C2. Timesheet_id is REQUIRED but not provided

CG Hours `time_entries.timesheet_id` is NOT NULL. PR #376 handlers do not provide or resolve a `timesheet_id`. Every CG Hours time entry must belong to a weekly timesheet with `unique(staff_id, week_start_date)`.

The handler would need to:
1. Calculate the ISO week start date for the entry date
2. Query `timesheets` for existing: `SELECT id FROM timesheets WHERE staff_id = X AND week_start_date = Y`
3. If not found, create: `INSERT INTO timesheets (staff_id, week_start_date, week_end_date) VALUES (X, Y, Y+6)`
4. Use the resulting `timesheet_id` in the time_entries INSERT

### C3. Duration is in minutes, not hours

CG Hours uses `duration_minutes` (integer, >0). PR #376 passes `p_hours` (number). The RPC would need to multiply by 60.

### C4. No task_template_id resolution

CG Hours `time_entries.task_template_id` is a nullable FK. PR #376 handlers don't resolve task templates. For km entries, the "Traveling" template (with `tracks_km=true`) should be used.

### C5. Client UUID mismatch

CG Hours has its own `clients` table. "Germoparts" in CG Dynamics has a different UUID than "Germoparts" in CG Hours. PR #376 passes `p_client_id` from the CG Dynamics context, which will not match any CG Hours client.

### C6. Staff UUID may not match

CG Hours has its own `profiles` table under its own Supabase Auth project (ref `qcafdqwhwqaxjhdcugcs`). CG Dynamics uses a different Supabase project. The `p_staff_id` from CG Dynamics may not exist in CG Hours' `profiles` table.

## D. Cross-project staff identity

**Status: UNVERIFIED — likely MAPPING_REQUIRED**

CG Hours Supabase project ref: `qcafdqwhwqaxjhdcugcs`
CG Dynamics uses a different Supabase project (env-based, not committed to repo).

These are separate Supabase projects with separate auth. Even if both use Supabase Auth, the `profiles.id` values are independent. A staff member who exists in both systems may have:
- Same auth UUID IF they signed up through the same Supabase Auth instance (unlikely — separate projects)
- Different UUIDs IF each project has its own auth

**Minimum mapping contract needed:**
```sql
CREATE TABLE cg_hours_staff_mapping (
  dynamics_profile_id uuid PRIMARY KEY REFERENCES profiles(id),
  hours_profile_id uuid NOT NULL,
  hours_staff_email text, -- for verification
  verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

## E. Client mapping

**Status: MAPPING_REQUIRED**

CG Hours has its own `clients` table. No cross-system identifier exists.

**Minimum mapping contract needed:**
```sql
CREATE TABLE cg_hours_client_mapping (
  dynamics_client_id uuid PRIMARY KEY REFERENCES clients(id),
  hours_client_id uuid NOT NULL,
  hours_client_name text, -- for verification
  verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

## F. Timesheet resolution

**Status: NOT IMPLEMENTED in PR #376**

CG Hours expects:
- `timesheets` table with `unique(staff_id, week_start_date)`
- Week boundary: Monday–Sunday (standard ISO week)
- `time_entries.timesheet_id` NOT NULL FK
- RLS INSERT on `time_entries` requires the referenced timesheet to exist and be in `('draft', 'rejected')` status for that staff member
- Race condition: two concurrent requests for the same week could both try to create the timesheet. The `unique` constraint prevents duplicates, but the second INSERT would fail. Need `ON CONFLICT` handling.

**Required RPC logic (must exist in CG Hours):**
```sql
-- Inside create_ordinary_hours_entry RPC:
v_week_start := date_trunc('week', p_date::date)::date;
SELECT id INTO v_timesheet_id
FROM timesheets
WHERE staff_id = p_staff_id AND week_start_date = v_week_start;

IF v_timesheet_id IS NULL THEN
  INSERT INTO timesheets (staff_id, week_start_date, week_end_date)
  VALUES (p_staff_id, v_week_start, v_week_start + 6)
  ON CONFLICT (staff_id, week_start_date) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_timesheet_id;
END IF;
```

## G. Task template resolution

**Status: NOT IMPLEMENTED in PR #376**

For ordinary hours: `task_template_id` can be NULL or resolved from task description.
For km entries: the "Traveling" template (with `tracks_km=true`) should be used.

The CG Hours MCP handlers don't resolve task templates at all.

## H. Cross-project idempotency

**Status: GAP — crash boundary not safe**

PR #376 uses MCP-level idempotency (`mcp_check_idempotency` / `mcp_record_idempotency`). The crash scenario:

1. MCP handler calls `cgHours.rpc('create_ordinary_hours_entry', {...})`
2. CG Hours insert succeeds → time_entry row created
3. Network response is lost (timeout, connection reset)
4. MCP idempotency record is NOT committed (the response never arrived)
5. Request retries → MCP idempotency check finds no prior record
6. CG Hours insert runs again → SECOND duplicate entry created

**This is NOT fully idempotent.** The MCP idempotency layer operates in CG Dynamics; the actual persistence happens in CG Hours. A crash between steps 2 and 4 creates duplicates.

**Minimum safe contract:**
- The CG Hours RPC itself must enforce idempotency (check `p_idempotency_key` before insert)
- OR: CG Hours must have a unique constraint that prevents duplicates (e.g., `unique(staff_id, client_id, entry_date, task_template_id, idempotency_key)`)
- The MCP idempotency layer is a useful front door but cannot be the sole dedup mechanism

## I. Corrections

**Status: INCORRECTLY MODELED**

PR #376 calls `apply_ordinary_hours_correction` and `apply_vehicle_correction` RPCs that don't exist.

CG Hours correction model:
- Time entries: update the row directly (owner/admin RLS)
- KM entries: update `km_travelled`, `km_origin`, `km_destination`, `km_notes` columns on `time_entries`
- KM review workflow: `km_review_status` (draft → submitted → approved/rejected), `km_reviewed_by`, `km_reviewed_at`
- No built-in before/after audit trail in the schema (the `audit_log` table exists but isn't automatically triggered for time_entries)

PR #376's `CgHoursCorrectionResult` with `original` + `corrected` + `audit` is a client-side pattern, not a CG Hours native feature.

## J. Receipt truth

**Status: UNRELIABLE**

PR #376 handlers return:
```typescript
return { logged: true, record: data, receipt: { record_id: data?.id, idempotency_key, created_at: new Date().toISOString() } }
```

Issues:
- `created_at` is client-side `new Date().toISOString()`, not the CG Hours server timestamp
- `data?.id` depends on the RPC returning the inserted row — but the RPCs don't exist
- If the RPC returns null/error, `data?.id` is undefined but the handler returns `{ error: error.message }` (correct)

A trustworthy receipt must include:
- Actual CG Hours `time_entries.id` from the INSERT
- Server-side `created_at` from CG Hours
- The idempotency key used

## K. First controlled live test checklist

### CODE REQUIRED (must be built before any live test):

1. **6 RPCs in CG Hours** — `create_ordinary_hours_entry`, `create_vehicle_entry` (or equivalent), `read_ordinary_hours_entries`, `read_vehicle_entries`, `apply_ordinary_hours_correction`, `apply_vehicle_correction`
   - These must handle timesheet resolution internally
   - These must enforce RLS via `auth.uid()` or service-role with `p_staff_id` validation
   - The km entry RPC must write to `time_entries` KM columns, not a separate table

2. **Staff identity mapping** — `cg_hours_staff_mapping` table or verified shared auth UUID
3. **Client mapping** — `cg_hours_client_mapping` table
4. **Task template resolution** — resolve "Traveling" template ID for km entries

### CONFIG REQUIRED (environment variables):

| Variable | Where | Purpose |
|---|---|---|
| `CG_HOURS_SUPABASE_URL` | CG Dynamics Edge Function env | CG Hours Supabase project URL |
| `CG_HOURS_SERVICE_ROLE_KEY` | CG Dynamics Edge Function env | CG Hours service role key |

### CA APPROVAL REQUIRED:

- First production write (one controlled staff entry)
- Staff/client mapping approval
- CG Hours RPC deployment approval

### First test sequence:

1. Authenticated test staff → exact approved client → small ordinary time entry (30 min)
2. Verify directly in CG Hours UI/database
3. Retry same request → prove same receipt / no duplicate
4. Correct the entry → verify audit state
5. Read it back through ChatGPT
6. Log 20 km for same client → verify km columns on time_entries
7. Verify km_review_status is 'draft'

## L. PR #383 acceptance matrix cross-check

PR #383 defines 13 acceptance tests using a **test-only fixture backend** (`createContractFixtureBackend`). These tests verify the contract/harness logic, NOT real CG Hours persistence.

| PR #383 test | What it proves | What it doesn't prove |
|---|---|---|
| 1. Franku trip creates record | Harness logic works | That CG Hours gets the write |
| 2. Retry returns original ID | Fixture idempotency works | That CG Hours idempotency works |
| 3. Sydney ≠ Franku | Fixture staff isolation | That CG Hours RLS enforces this |
| 4. Cross-staff denial | Fixture scope check | That CG Hours prevents cross-staff |
| 5. Wrong client denial | Fixture client scope | That CG Hours FK enforcement works |
| 6. Ordinary hours persists | Harness time entry logic | Real CG Hours time_entries write |
| 7. Correction audit | Fixture audit trail | Real CG Hours correction semantics |
| 8. Read-only own entries | Fixture read isolation | Real CG Hours RLS read isolation |
| 9. Backend unavailable | Fixture NOT_CONFIGURED | Real CG Hours error handling |
| 10. error:null success | Fixture success check | Real CG Hours response format |
| 11. Invalid km values | Fixture validation | Real CG Hours constraints |
| 12. Receipt required | Fixture receipt check | Real CG Hours receipt format |
| 13. Odometer validation | Fixture validation | N/A (CG Hours has no odometer) |

**PR #383 is a valuable contract specification but is fixture-only.** Real persistence proof requires the 6 RPCs to exist in CG Hours and the handlers to call them successfully.

## M. PR #376 Head `b589c43` Independent Verification Against 10 Audit Points

### 1. Does the code really map CG Dynamics staff/client IDs to CG Hours IDs, or does it only pass Dynamics IDs through?

**FINDING: PASSES THROUGH DYNAMICS IDs ONLY — NO MAPPING**

- `src/lib/cgHours/cgHoursActionLayer.ts` (action layer): Pure TypeScript types/interfaces. The `CgHoursPersistenceAdapter` interface expects `staffId: string` and `clientId: string | null` but documents no mapping. The caller must supply already-resolved CG Hours IDs.
- `supabase/functions/cg-dynamics-mcp/index.ts` (MCP handlers): `handleLogOrdinaryHours`, `handleLogKilometreEntry`, `handleReadMyRecentEntries`, `handleCorrectMyEntry` all pass `staff.effectiveStaffProfileId ?? staff.profileId` (CG Dynamics profile UUID) directly as `p_staff_id` to CG Hours RPCs, and `effectiveClientId` (CG Dynamics client UUID) directly as `p_client_id`.
- **No mapping table, no lookup, no verification that these UUIDs exist in CG Hours.** If CG Hours uses different UUIDs (separate Supabase project), the FK constraints will fail or create orphaned references.

### 2. Does it really resolve/create the required weekly `timesheet_id`?

**FINDING: NO — TIMESHEET_ID COMPLETELY ABSENT**

- Canonical CG Hours `time_entries.timesheet_id` is **NOT NULL FK** to `timesheets(id)`.
- PR #376 action layer `CgHoursTimeEntryRecord` interface: **no `timesheet_id` field**.
- PR #376 `CG_HOURS_PERSISTENCE_CONTRACT` required_endpoints lists `create_ordinary_hours_entry(p_staff_id, p_client_id, p_date, p_hours, p_task_description, p_notes, p_idempotency_key)` — **no `p_timesheet_id` parameter**.
- MCP handlers call `create_ordinary_hours_entry` RPC with the same parameter list — **no timesheet resolution**.
- The contract assumes the CG Hours RPC handles timesheet internally, but CG Hours has no such RPC and the schema requires the column.

### 3. Does it really resolve the correct `task_template_id`, including `Traveling` with `tracks_km=true`?

**FINDING: NO — TASK_TEMPLATE_ID COMPLETELY ABSENT**

- Canonical CG Hours `time_entries` requires `task_template_id` (FK to `task_templates`).
- "Traveling" template has `tracks_km=true` (migration 036).
- PR #376 action layer: `CgHoursTimeEntryRecord` and `CgHoursVehicleEntryRecord` interfaces have **no `task_template_id` field**.
- PR #376 `CG_HOURS_PERSISTENCE_CONTRACT` RPC signatures don't include `task_template_id`.
- Vehicle/km entries in action layer go to separate `CgHoursVehicleEntryRecord` type, but canonical CG Hours puts KM columns **on `time_entries`** (migration 036), not a separate table.

### 4. Does the write path actually target canonical CG Hours `time_entries`, with the real column names/types (`entry_date`, `duration_minutes`, km fields), or only expose an abstract/stub contract?

**FINDING: SCHEMA MISMATCH — ABSTRACT CONTRACT ONLY**

| Canonical CG Hours `time_entries` | PR #376 Action Layer Types |
|---|---|
| `entry_date` (date) | `date` (string) |
| `duration_minutes` (int > 0) | `hours` (number) |
| `km_travelled` (numeric) | **Absent from time entry** — in separate `CgHoursVehicleEntryRecord.distance_km` |
| `km_origin` (text) | **Absent** |
| `km_destination` (text) | **Absent** |
| `km_notes` (text) | **Absent** |
| `km_compensation_method` | **Absent** |
| `km_review_status` | **Absent** |
| `task_template_id` (FK) | **Absent** |
| `timesheet_id` (FK, NOT NULL) | **Absent** |

- The action layer splits "time" and "vehicle" into separate record types (`CgHoursTimeEntryRecord` vs `CgHoursVehicleEntryRecord`), but canonical CG Hours stores KM columns **on the same `time_entries` row**.
- `travel_requests` is a separate table in CG Hours for the staff travel calculator; PR #376's vehicle entry type doesn't map to it either.

### 5. Do ordinary time, km, caller-only reads and correction all return truthful typed results, durable record ID + receipt, and fail closed when the backend/config/mapping is absent?

**FINDING: PARTIAL — FAILS CLOSED ON CONFIG, NOT ON MAPPING**

- ✅ Action layer `executeOrdinaryHoursAction` returns `NOT_CONFIGURED` with full contract when `adapter` is undefined.
- ✅ MCP handlers return `CG_HOURS_NOT_CONFIGURED` when `CG_HOURS_SUPABASE_URL`/`CG_HOURS_SERVICE_ROLE_KEY` env vars missing.
- ✅ Mock adapter tests show typed results with `receipt.record_id` and `receipt.idempotency_key`.
- ❌ **Fails open on mapping**: When env vars present, code passes CG Dynamics UUIDs directly to CG Hours RPCs. If those UUIDs don't exist in CG Hours, the RPC will fail with FK violation (not a typed `NOT_CONFIGURED` or `MAPPING_MISSING` error).
- ❌ **No validation** that `staff_id` exists in CG Hours `profiles` or `client_id` exists in CG Hours `clients` before write.

### 6. Does existing MCP idempotency prevent duplicate canonical CG Hours rows on retry without requiring a fake idempotency column in CG Hours?

**FINDING: CONTRACT ASSUMES BACKEND IDEMPOTENCY THAT DOESN'T EXIST**

- CG Dynamics has `deriveMcpIdempotencyKey` + `mcp_idempotency_log` table — works for CG Dynamics RPCs.
- PR #376 contract: `p_idempotency_key` passed to CG Hours RPCs; "duplicate key returns existing receipt".
- **CG Hours has no idempotency column, no RPC, no mechanism.** The contract assumes the CG Hours backend implements this.
- Without a CG Hours-side dedup (e.g., a shadow idempotency log in CG Hours, or the adapter checking before insert), retries **will create duplicate rows** in CG Hours.
- The MCP idempotency log in CG Dynamics only protects the CG Dynamics call — if the CG Hours RPC succeeds twice (network retry), two rows are inserted.

### 7. Are staff/team, cross-staff and cross-client boundaries preserved end to end?

**FINDING: APPLICATION-LAYER ONLY — RLS BYPASSED BY SERVICE-ROLE**

- ✅ Action layer pure functions: throw on staff/client isolation violation (`createOrdinaryHoursEntry`, `applyOrdinaryHoursCorrection`).
- ✅ Action layer `executeOrdinaryHoursAction`: returns `UNAUTHORIZED` for cross-staff/client attempts before calling adapter.
- ✅ MCP handlers: pin `staff_id` from authenticated context, pin `client_id` from context (client Project) or input (staff Project).
- ❌ **CG Hours RLS is bypassed**: MCP handlers use `CG_HOURS_SERVICE_ROLE_KEY` (service role) which **bypasses RLS entirely**. The only enforcement is application-layer in CG Dynamics.
- ❌ If CG Hours RPCs are called directly (bypassing CG Dynamics MCP), no protection exists.
- ❌ No `company_admin` cross-staff read path implemented in CG Hours RPCs.

### 8. Re-run/extend the PR #384 contract tests so they catch false-positive adapters that compile but cannot satisfy the real CG Hours schema.

**FINDING: PR #384 CONTRACT TESTS PASS (51/51) — THEY CATCH THE GAPS**

All 51 contract tests pass (23 in `cgHoursCanonicalPersistenceAudit.test.mjs` + 28 in `cgHoursCrossProjectContract.test.mjs`). They verify:
- `time_entries` requires `timesheet_id` (test: "requires timesheet_id — no time entry exists without a weekly timesheet")
- `duration_minutes` > 0 constraint (test: "duration_minutes must be > 0")
- `km_review_status` 4 values, `km_compensation_method` 2 values
- `travel_requests` is separate table with own PK
- "Traveling" template has `tracks_km=true`
- `app_settings` has `travel_km_rate`, `travel_default_fuel_price`, `travel_default_consumption`
- Cross-project identity: separate profiles/clients tables, mapping required
- MCP tool catalog: no CG Hours tools exist yet, 4 new tools needed, must be staff-subject
- Adapter boundary: must resolve staff_id, client_id, find/create timesheet, return record ID, support idempotency
- Voice use case: all required fields documented
- RPC existence contract: 6 RPCs that must exist
- Schema mismatch: duration_minutes, timesheet_id NOT NULL, KM columns on time_entries
- Idempotency crash boundary: MCP-level idempotency is NOT sufficient
- Receipt truth: mock fixture IDs do not count as persistence proof

**These tests would FAIL for any adapter that compiles but doesn't supply `timesheet_id`, `task_template_id`, uses wrong column names (`date` vs `entry_date`, `hours` vs `duration_minutes`), or doesn't map to the unified `time_entries` table with KM columns.**

### 9. Reconcile the latest PR #376 diff against current main and flag any unrelated/stale workflow regression.

**FINDING: WORKFLOW FILE IDENTICAL — NO REGRESSION**

- Compared `.github/workflows/opencode-on-demand.yml` at `main` (746b979) vs PR #376 head (b589c43): **byte-for-byte identical**.
- The worker claim "workflow was restored" is **correct** — no stale/unrelated changes in the workflow file.
- PR #376 diff shows only 6 files changed: action layer, MCP index, projectContext, toolCatalog, test file, and workflow (no-op restore).

### 10. Compare against PR #383's 13-case E2E matrix and state exactly which cases are now code-ready vs still NOT_CONFIGURED.

**PR #383 E2E Acceptance Matrix (`tests/cgHoursE2EAcceptance.test.mjs`):**

| # | Test Case | Status | Evidence |
|---|---|---|---|
| 1 | Franku trip creates one exact business record with durable receipt | **NOT_CONFIGURED** | No backend, no mapping, no timesheet, schema mismatch |
| 2 | Exact retry returns original durable ID and no duplicate | **NOT_CONFIGURED** | Depends on CG Hours backend idempotency (doesn't exist) |
| 3 | Sydney team-role request is Sydney, never Franku | **CODE-READY** | Action layer `createOrdinaryHoursEntry` throws on staff mismatch |
| 4 | Prompt attempt to log as Franku from Sydney context is denied | **CODE-READY** | `executeOrdinaryHoursAction` returns `UNAUTHORIZED` for `correction.staff_id !== context.staffId` |
| 5 | Wrong client injection denied, ambiguous exact names fail closed | **CODE-READY** | Action layer throws on `draft.client_id !== context.clientId`; MCP handlers pin client from context |
| 6 | Ordinary hours persists exact staff/client/hours/purpose with receipt | **NOT_CONFIGURED** | No backend; schema mismatch (missing `timesheet_id`, `task_template_id`, `duration_minutes`) |
| 7 | Correction retains before/after audit evidence | **CODE-READY** | `applyCorrectionToTimeEntry`/`VehicleEntry` return `{original, corrected, audit}` |
| 8 | Today read is caller-only, cross-staff read/correct denied | **CODE-READY** | Action layer enforces `staffId` from context; MCP handlers use authenticated staff only |
| 9 | Backend unavailable/failing is typed, never empty success | **CODE-READY** | Returns `CG_HOURS_NOT_CONFIGURED` / `CG_HOURS_SOURCE_ERROR` typed objects |
| 10 | Successful canonical result containing error:null remains success | **NOT_CONFIGURED** | No backend to return success |
| 11 | Impossible kilometre/odometer values fail closed before persistence | **CODE-READY** | `validateCgHoursVehicleEntryDraft` rejects negative/excessive km, invalid odometer |
| 12 | Success without both durable ID and receipt is rejected | **CODE-READY** | `requireDurableReceipt` in contract fixture rejects missing `entry_id` or `receipt` |
| 13 | (Implicit) Cross-client isolation in client Project context | **CODE-READY** | MCP `resolveClientScopeForInput` pins client from Project context |

**Summary: 8/13 cases CODE-READY (pure validation/isolation logic), 5/13 NOT_CONFIGURED (require real CG Hours backend, mapping, timesheet, schema alignment).**

## N. Identity/security verification (updated)

| Requirement | CG Hours enforcement | CG Dynamics MCP enforcement | PR #376 Status |
|---|---|---|---|
| Staff own records only | RLS: `staff_id = auth.uid()` | Context: `effectiveStaffProfileId` | ⚠️ App-layer only; RLS bypassed by service-role |
| Exact client scope | FK constraint to `clients` | `resolveClientScopeForInput()` | ⚠️ App-layer only; FK will fail if UUIDs don't match |
| No name matching | FK-based, no fuzzy | UUID-only, exact equality | ✅ Enforced in MCP context resolution |
| No silent cross-staff | RLS INSERT: `staff_id = auth.uid()` | `p_actor_profile_id` delegation | ⚠️ App-layer only; service-role bypasses RLS |
| Admin explicit | `is_owner_or_admin()` policy | `company_admin` context required | ❌ Not implemented in CG Hours RPCs |
| Duplicate protection | **NONE** — must be built | `mcp_check_idempotency` RPC | ❌ CG Hours has no idempotency; MCP log only protects Dynamics side |

## O. Recommended implementation path (updated)

### Phase 1: Build CG Hours RPCs (in CG Hours repo)
1. `create_ordinary_hours_entry` — handles timesheet resolution, task_template_id, idempotency
2. `create_km_entry` — writes to time_entries KM columns with Traveling template
3. `read_entries` — reads time_entries for a staff member in date range
4. `correct_entry` — updates entry with audit fields

### Phase 2: Establish cross-project identity
5. Deploy `cg_hours_staff_mapping` table (or verify shared auth)
6. Deploy `cg_hours_client_mapping` table
7. Populate initial mappings

### Phase 3: Wire PR #376 handlers
8. Fix handler to call the real RPCs with correct parameters
9. Add timesheet resolution logic (or let RPC handle it)
10. Fix km entry to use time_entries KM columns, not separate vehicle entries
11. Add idempotency inside the CG Hours RPCs
12. Return server-side timestamps in receipts

### Phase 4: Acceptance test against real backend
13. Run PR #383 acceptance matrix against real CG Hours
14. Verify all 13 scenarios pass with real persistence
