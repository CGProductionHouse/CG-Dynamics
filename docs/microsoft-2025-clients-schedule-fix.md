# Fix — 2025 CLIENTS SCHEDULE was not imported

Last updated: 2026-07-26

## Symptom

Active clients (e.g. The Staffy / THE STAFFORDHIRE PUB) showed empty Client
Schedule calendars even though the Planner plan **`2025 CLIENTS SCHEDULE`**
contained their real deliverables.

## Root cause

The production Microsoft import fetched **only** the plans hand-listed in the
`MICROSOFT_SYNC_SOURCES_JSON` Edge secret (the "five configured sources").
`2025 CLIENTS SCHEDULE` was not in that list, so its tasks/buckets were never
fetched. The reconciliation code was already correct:

- `resolveMicrosoftPlanMapping('2025 CLIENTS SCHEDULE')` → **client_schedule**,
  monthly (`EXACT_PLAN_MAPPINGS`).
- `THE STAFFORDHIRE PUB` → **The Staffy** (`CLIENT_SCHEDULE_ALIASES`, explicit,
  no guessing).
- The deliverable parser handles the real titles, including the no-dash
  `DP4 STAFFY`.

So the only failure was that the plan was not in the fetched source set.

## Fix (durable, admin-managed, read-only toward Microsoft)

1. **`microsoft_sync_plan_sources` registry** (phase-27a) — admin-managed table
   (staff-read / admin-manage RLS) of Planner plans to fetch, so a plan can be
   added **without editing the secret**. Seeded with the real plan id
   **`1ZjZPTY4W02yLFfq1V7cYmUAAitG`** (`2025 CLIENTS SCHEDULE`), verified from the
   official export `docs/planner-exports/2025 CLIENTS SCHEDULE.xlsx`.
2. **`microsoft-transition-sync` merge** (v18, deployed) — merges active registry
   plans into the env manifest (dedup by plan id; env wins; try/catch fallback).
   The function stays **read-only toward Microsoft** (fetch only).

## Verified against the real export

From `2025 CLIENTS SCHEDULE.xlsx` (bucket `FHoVtUr_NUykl_V_0wmaaGUAIUc9` = THE
STAFFORDHIRE PUB), The Staffy's **12 real July deliverables** parse correctly:

| Code | Type | Due |
|---|---|---|
| F1–F4 | photo | 2026-07-01 / 08 / 15 / 22 |
| Video 1–4 | video | 2026-07-02 / 09 / 16 / 23 |
| DP1–DP3, DP4 (no dash) | dp | 2026-07-06 / 13 / 20 / 27 |

Covered by `tests/microsoftStaffySchedule.test.mjs` (6 tests): plan
classification, bucket→client alias (with spacing/casing tolerance), all 12
deliverable identities, the no-dash `DP4 STAFFY`, and the registry + merge wiring.
Existing reconciliation guarantees still apply: real due dates, package/template
rules, no duplicate deliverables, no overwriting newer CG-owned edits, admin
resolution of unmatched clients / missing templates / unsupported deliverables.

## Remaining step — needs an authenticated CG admin (credential boundary)

The final **live** step could not be executed from this environment because it
requires the Microsoft Graph **application credentials** (`MICROSOFT_TENANT_ID` /
`CLIENT_ID` / `CLIENT_SECRET`) to be exercised via an **authenticated admin**
call — secrets this agent must not handle and cannot invoke.

To complete end-to-end (all code + data + deploy are already in place):

1. As a CG **admin**, open Client Schedule → Microsoft transition sync.
2. Run **Preview** for the July–August range. `2025 CLIENTS SCHEDULE` now appears
   as a fetched source (via the registry), and THE STAFFORDHIRE PUB resolves to
   The Staffy.
3. Review the preview (resolve any surfaced conflicts), then **Apply**.
4. Confirm The Staffy's July/August deliverables appear in Client Schedule and
   the client-ready calendar.

No Microsoft data is ever written back. Confirmed bucket→client mappings persist
in code (`CLIENT_SCHEDULE_ALIASES`) and are reused on every future sync; new plans
persist in `microsoft_sync_plan_sources`.
