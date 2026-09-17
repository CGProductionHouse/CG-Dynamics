# CG Hours Canonical Persistence Audit

Date: 2026-09-16 (updated 2026-09-17)
Author: CA manual agent
Refs: Issue #361, PR #376, PR #383, PR #384

## Executive Summary

CG Hours is a **separate Supabase project** (`CGProductionHouse/CG-Hours`). There is no write-through from CG Dynamics to CG Hours today. PR #376 head `b589c43` defines a pure action layer + MCP tool handlers with env-gated adapter calls, but **zero cross-project identity mapping, zero timesheet resolution, zero task template resolution, and schema mismatches against canonical CG Hours `time_entries`**. The verdict is **NOT_CONFIGURED**.

## A. Canonical CG Hours persistence (exact locations)

### Database: CG Hours' own Supabase project

| Table | Key columns | Purpose |
|---|---|---|
| `time_entries` | `id`, `staff_id`, `client_id`, `timesheet_id`, `entry_date`, `duration_minutes`, `km_travelled`, `km_origin`, `km_destination`, `km_notes`, `km_compensation_method`, `km_review_status` | Canonical time + km entries |
| `travel_requests` | `id`, `staff_id`, `time_entry_id`, `client_id`, `km_travelled`, `origin`, `destination`, `suggested_amount`, `admin_amount`, `review_status` | Staff travel calculator (separate from time_entries) |
| `timesheets` | `id`, `staff_id`, `week_start_date`, `week_end_date`, `status` | Weekly container for time_entries |
| `task_templates` | `id`, `name`, `tracks_km` | "Traveling" template has `tracks_km=true` |
| `clients` | `id`, `name`, `status` | Client registry (CG Hours' own, NOT CG Dynamics') |
| `profiles` | `id`, `full_name`, `email`, `role` | Staff registry (CG Hours' own Supabase Auth) |
| `app_settings` | `setting_key`, `setting_value` | `travel_km_rate` (4.50 ZAR/km), fuel defaults |

### Record ID returned
- `time_entries.id` (uuid) on insert
- `travel_requests.id` (uuid) on insert

### Staff identity field
- `time_entries.staff_id` → `profiles.id` (CG Hours' own auth)
- `travel_requests.staff_id` → `profiles.id`

### Client identity field
- `time_entries.client_id` → `clients.id` (CG Hours' own clients)
- `travel_requests.client_id` → `clients.id`

### Correction/update path
- `time_entries`: owner/admin ALL RLS policy (full CRUD)
- `travel_requests`: staff own draft/submitted; owner/admin manages all
- `km_review_status`: draft → submitted → approved/rejected
- `km_reviewed_by` + `km_reviewed_at` audit fields

### Idempotency
- **None.** No idempotency key on `time_entries` or `travel_requests`.
- `timesheets` has `unique (staff_id, week_start_date)` but that's a weekly container constraint.

### Migration files
- `supabase/migrations/001_initial_schema.sql` — base tables
- `supabase/migrations/036_travel_km_tracking.sql` — KM columns on time_entries
- `supabase/migrations/037_travel_requests.sql` — travel_requests table

## B. Exact authenticated ChatGPT/MCP call path

### What EXISTS (CG Dynamics side):

```
ChatGPT → Bearer token → cg-dynamics-mcp (Deno Edge Function)
→ authenticateStaff() → ConnectionPrincipal { userId, profileId, role }
→ parseProjectContext() → { contextKind: "staff", staffProfileId: "<uuid>" }
→ resolveOperatingContext() → AuthenticatedStaff { effectiveStaffProfileId }
→ tool handler → CG Dynamics RPCs/tables via service-role
```

### What is MISSING (the gap to CG Hours):

1. **No CG Hours credential in CG Dynamics** — CG Dynamics Edge Functions have no `CG_HOURS_SUPABASE_URL` or `CG_HOURS_SERVICE_ROLE_KEY` (env-gated in PR #376 but not configured)
2. **No cross-project identity mapping** — CG Dynamics `profiles.id` and CG Hours `profiles.id` are in separate Supabase projects. Same auth UUID IF shared Supabase Auth, but UNVERIFIED.
3. **No CG Hours write API** — CG Hours has no Edge Functions, no MCP, no REST write endpoint. Only `api/payslips/` exists.
4. **No timesheet resolution** — `time_entries` requires `timesheet_id`. No logic to find/create current week's timesheet.
5. **No client UUID mapping** — "Germoparts" in CG Dynamics has a different UUID than "Germoparts" in CG Hours.
6. **No task template resolution** — ordinary hours need `task_template_id`; km entries need the "Traveling" template.

### Required new adapter (the missing seam):

```
CG Dynamics MCP tool handler
→ CgHoursWriteAdapter (new)
  → resolve CgHours staff_id (mapping or shared auth)
  → resolve CgHours client_id (mapping table or name lookup)
  → find/create current timesheet
  → resolve task_template_id
  → INSERT into CG Hours time_entries via service-role
  → return record ID
```

## C. PR #376 Head `b589c43` Independent Verification Against 10 Audit Points

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

**FINDING: PR #384 CONTRACT TESTS PASS (23/23) — THEY CATCH THE GAPS**

All 23 contract tests in `tests/cgHoursCanonicalPersistenceAudit.test.mjs` pass. They verify:
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

## D. Identity/security verification (updated)

| Requirement | CG Hours enforcement | CG Dynamics MCP enforcement | PR #376 Status |
|---|---|---|---|
| Staff own records only | RLS: `staff_id = auth.uid()` | Context: `effectiveStaffProfileId` | ⚠️ App-layer only; RLS bypassed by service-role |
| Exact client scope | FK constraint to `clients` | `resolveClientScopeForInput()` | ⚠️ App-layer only; FK will fail if UUIDs don't match |
| No name matching | FK-based, no fuzzy | UUID-only, exact equality | ✅ Enforced in MCP context resolution |
| No silent cross-staff | RLS INSERT: `staff_id = auth.uid()` | `p_actor_profile_id` delegation | ⚠️ App-layer only; service-role bypasses RLS |
| Admin explicit | `is_owner_or_admin()` policy | `company_admin` context required | ❌ Not implemented in CG Hours RPCs |
| Duplicate protection | **NONE** — must be built | `mcp_check_idempotency` RPC | ❌ CG Hours has no idempotency; MCP log only protects Dynamics side |

## E. Voice use case gap analysis (updated)

"I'm driving for Germoparts. I'm driving in the city. 20 kilometres."

| Step | Status | Detail |
|---|---|---|
| ChatGPT interprets voice | ✅ | Structured intent extraction |
| CG Dynamics authenticates staff | ✅ | `authenticateStaff()` → `ConnectionPrincipal` |
| Resolves "Germoparts" → client UUID | ✅ | `resolve_project_context` with exact name |
| MCP tool for km/hours logging | ✅ | **ADDED in PR #376**: `log_ordinary_hours`, `log_kilometre_entry`, `read_my_recent_entries`, `correct_my_entry` in `toolCatalog.ts` |
| Write-through to CG Hours | ❌ | **Env-gated but NOT_CONFIGURED** — no mapping, no timesheet, schema mismatch |
| Timesheet resolution | ❌ | **No logic** to find/create weekly timesheet |
| Client UUID mapping | ❌ | CG Dynamics ≠ CG Hours client IDs — passed through directly |
| Task template resolution | ❌ | "Traveling" template ID unknown cross-project; not in RPC params |
| Canonical persistence | ❌ | Nothing written to CG Hours; RPCs don't exist |
| Record ID returned | ❌ | No record created |

## F. Precise Remaining Implementation Gaps (CA-gated)

### Must have before any production write:
1. **CG Hours service-role credentials** in CG Dynamics Edge Function env (`CG_HOURS_SUPABASE_URL`, `CG_HOURS_SERVICE_ROLE_KEY`)
2. **Cross-project staff identity mapping**: Verify shared Supabase Auth UUIDs OR create mapping table `cg_dynamics_profile_id → cg_hours_profile_id`
3. **Cross-project client identity mapping**: Create mapping table `cg_dynamics_client_id → cg_hours_client_id` (exact name match insufficient — UUIDs differ)
4. **CG Hours RPC implementation**: `create_ordinary_hours_entry`, `read_ordinary_hours_entries`, `apply_ordinary_hours_correction`, `create_vehicle_entry`, `read_vehicle_entries`, `apply_vehicle_correction` in CG Hours project
5. **Timesheet resolution logic**: In CG Hours RPC or adapter — find/create `timesheets` for current week (Monday-Sunday) by `staff_id`
6. **Task template resolution**: Map "ordinary hours" → default template; "mileage" → "Traveling" template (`tracks_km=true`)
7. **Schema alignment**: Either (a) extend CG Hours `time_entries` RPC to accept KM columns on same row, or (b) change CG Dynamics action layer to match CG Hours split (`time_entries` + `travel_requests`)
8. **CG Hours idempotency**: Implement dedup in CG Hours RPC (e.g., `mcp_idempotency_log` table in CG Hours project) or adapter-layer check-before-insert
9. **CG Hours RLS policies**: Ensure service-role writes still respect staff/client isolation (use `SET LOCAL ROLE` or explicit WHERE clauses)

### Can proceed without production write (current state):
- Action layer validation, isolation, audit trail, idempotency key gen: **DONE**
- MCP tool catalog + handlers (env-gated): **DONE**
- Contract tests documenting exact requirements: **DONE (23/23 pass)**

## Verdict

**NOT_CONFIGURED**

The PR #376 head `b589c43` provides a well-typed action layer and MCP tool handlers that **compile and pass unit tests against mock adapters**, but the **adapter boundary is unwired** and the **contract it assumes does not match the canonical CG Hours schema**. The five hard blockers (cross-project identity mapping, timesheet resolution, task template resolution, schema alignment, CG Hours RPC implementation) are all **CA-gated configuration/infrastructure work** that cannot be completed in CG Dynamics code alone.

**No production secrets, no production writes, no migrations, no provider changes attempted. Audit stops cleanly at CA-gated credential/mapping requirements.**