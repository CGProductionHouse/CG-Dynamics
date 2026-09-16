# CG Hours Canonical Persistence Audit

Date: 2026-09-16
Author: CA manual agent
Refs: Issue #361, PR #376

## Executive Summary

CG Hours is a **separate Supabase project** (`CGProductionHouse/CG-Hours`). There is no write-through from CG Dynamics to CG Hours today. PR #376 defines a pure action layer with no real persistence. The verdict is **NOT_CONFIGURED**.

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

1. **No CG Hours credential in CG Dynamics** — CG Dynamics Edge Functions have no `CG_HOURS_SUPABASE_URL` or `CG_HOURS_SERVICE_ROLE_KEY`
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

## C. Can PR #376 wire in RIGHT NOW?

**NOT_CONFIGURED**

PR #376 (`src/lib/cgHours/cgHoursActionLayer.ts`) defines:
- Time entry validation and creation (pure in-memory objects)
- Vehicle/km entry structure
- Audit-safe correction (original + corrected + audit trail)
- Idempotency key generation

It has ZERO calls to any real backend. The `VehicleReimbursementAdapter` is a type, not a wired implementation. There is no Supabase client, no Edge Function call, no RPC invocation.

## D. Identity/security verification

| Requirement | CG Hours enforcement | CG Dynamics MCP enforcement |
|---|---|---|
| Staff own records only | RLS: `staff_id = auth.uid()` | Context: `effectiveStaffProfileId` |
| Exact client scope | FK constraint to `clients` | `resolveClientScopeForInput()` |
| No name matching | FK-based, no fuzzy | UUID-only, exact equality |
| No silent cross-staff | RLS INSERT: `staff_id = auth.uid()` | `p_actor_profile_id` delegation |
| Admin explicit | `is_owner_or_admin()` policy | `company_admin` context required |
| Duplicate protection | **NONE** — must be built | `mcp_check_idempotency` RPC |

## E. Voice use case gap analysis

"I'm driving for Germoparts. I'm driving in the city. 20 kilometres."

| Step | Status | Detail |
|---|---|---|
| ChatGPT interprets voice | ✅ | Structured intent extraction |
| CG Dynamics authenticates staff | ✅ | `authenticateStaff()` → `ConnectionPrincipal` |
| Resolves "Germoparts" → client UUID | ✅ | `resolve_project_context` with exact name |
| MCP tool for km/hours logging | ❌ | **Does not exist** in `toolCatalog.ts` |
| Write-through to CG Hours | ❌ | **No adapter, no credential, no API** |
| Timesheet resolution | ❌ | **No logic** to find/create weekly timesheet |
| Client UUID mapping | ❌ | CG Dynamics ≠ CG Hours client IDs |
| Task template resolution | ❌ | "Traveling" template ID unknown cross-project |
| Canonical persistence | ❌ | Nothing written to CG Hours |
| Record ID returned | ❌ | No record created |

## Recommended implementation path

### Phase 1: Establish the cross-project contract
1. Add CG Hours service-role credential to CG Dynamics Edge Function env
2. Create client UUID mapping table (CG Dynamics client → CG Hours client)
3. Create staff UUID mapping table (or verify shared auth UUIDs)
4. Create `CgHoursWriteAdapter` in `supabase/functions/cg-dynamics-mcp/`

### Phase 2: Add MCP tools
5. Add `log_time_entry` tool to `toolCatalog.ts`
6. Add `log_km_entry` tool (or extend `log_time_entry`)
7. Add `read_recent_entries` tool
8. Add `correct_entry` tool

### Phase 3: Wire and test
9. Wire adapter to real CG Hours writes
10. Add idempotency (client-side key → dedup before insert)
11. Add acceptance tests for all #361 scenarios
12. Test cross-project identity isolation
