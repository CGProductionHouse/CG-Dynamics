# Nolan Master evidence — source candidate, 16 November 2026

## Active-work snapshot follow-up

From PR990 `07bdcf7`, checked main `b524a9f` and separate PR995 `d5a02c0`.
Master defaults to **Active work** and offers explicit **Completed history** and
**All records** views. It reuses `taskLifecycle` completion authority: only done/
legacy completed leave active work. Approved, scheduled, blocked, waiting-client,
deferred and reopened tasks remain active; completion timestamps do not override
current lifecycle. No due-date/overdue claim uses the adapter's start-date fallback.

A compact visible-snapshot summary shows active, blocked, waiting-client,
unassigned-active and completed counts. Summary buttons open the corresponding
view/filter and reset search/page; changing work view retains search/ownership,
clears the old status filter and resets pagination. Search/filter still evaluates
the complete authorized snapshot within the chosen lifecycle, before 12-row paging.
Clear filters retains the chosen view. All records permits cross-history search.
Counts are before search/filter, account-visible only, not whole-business/fleet
coverage. Blocked/waiting/unassigned overlap active counts rather than adding up.

Failed/refreshing empty snapshots show Unknown counts; retained counts explicitly
say last-known. Missing directory evidence is Unknown, never fabricated unassigned
ownership; partially unavailable owners are separately disclosed. The successful
empty state means zero visible records, not no company work. Existing literal note
limits, source links, freshness, access checks and unknown execution/next-action
fields remain intact. No new source, DB, registry, provider, mutation or live claim.

Focused local checks: 34 passed, zero failed/skipped, including lifecycle/history,
filter/pagination, unavailable/stale/empty counts and prior large-note/access cases.
Scoped lint, diff and application build passed. Render/helper checks are not actual
signed-in browser/device acceptance; that existing approved-host gate remains open.

## Concise control-panel follow-up

From PR990 `1734724`, checked main `b524a9f` and PR995 `d5a02c0` before changes.
Master now renders **12 task cards per page**, filtering the complete authorized
snapshot before pagination. Search/status/ownership changes reset to page one;
shrinking results clamp the page. Counts and previous/next controls keep long
lists reachable without adding a second task source or dropping matching records.

Canonical workflow status/owner/source freshness remain visible. An always-visible
authoritative workspace link opens full source records. Notes show only a literal
**600-character excerpt** in a bounded-height disclosure, with explicit truncation
and full-notes navigation. Full notes remain unchanged in the source snapshot and
authoritative workspace; this is not a summary or inferred current state. Existing
lazy activity displays only the latest returned exact-task audit entry, never all
activities or an execution claim. No provider call, write, schema or grant change.

Verified `CommandCentreTask`/Planner activity contracts provide no typed verified
next action, execution agent or device; those fields remain explicitly Unknown.
Source timestamps are not heartbeat/action verification. The separately reported
982,812-character live note was not read; a larger synthetic log reproduces the
rendering risk without production access. Tests use 1,001 tasks and a near-megabyte
log to verify bounded DOM, all-page identity coverage, full-snapshot filtering,
source preservation, Unicode boundary, role exclusion, empty/stale/error semantics
and absence of inferred next actions. Existing view-state assertion was corrected
to require already-present account/profile refresh dependencies, not remove them.

Focused checks: 32 passed, zero failed/skipped; scoped ESLint/diff and local
TypeScript/Vite build passed (Vite 9.67s). Render/pure-function evidence only;
authenticated browser and physical-device acceptance remain unexecuted.

## Earlier source-backed slice (historical)

Continues existing draft #990 from `b6cae176bb9131f9eb0d8fad2fb08f2c0812b3d9`.
Remote main checked at `f89fefea70108bfe417953d00330476530aa9c4d`; no concurrent
changes on the workbook branch, no main merge/rebase or other lane edits.

The review finding was correct: MasterScope contained twelve static navigation
cards. The earlier native-workbook receipt explicitly described them as coverage
navigation, not live status. The owner's expanded requirement now has an actual
existing-record view: Master schedule lists canonical tasks with owner, workflow
status, source age, task identity, full notes and on-demand recorded activity.
Search by task/owner/client/ID; filter by recorded status or ownership state.
Completed history remains visible with its recorded status. The twelve coverage
links remain separately disclosed, without inferred task-to-responsibility joins.

## Exact sources and limits

- Reuses the parent's existing `commandCentre.listTasks()` snapshot. Canonical
  task authority/visibility, deduplication and pagination remain unchanged.
- Uses `id`, `native_id`, `data_origin`, `title`, `client_name`, `bucket`, `status`,
  raw `planner_status`, `notes` and `updated_at`. The shared
  `taskStatusDisplayLabel` retains approved/scheduled workflow distinctions.
- Ownership reuses `nolanTaskOwnership` / `taskOwnershipInput` and the existing
  profile directory: canonical assignee IDs and assignment-review state, not
  imported names or helpers. Missing directory evidence stays unknown; conflicts
  never become named owners.
- Native-task action disclosure calls the existing signed-in
  `planner.listPlannerActivity(exactTaskId)` only on request. That reader filters
  `planner_activity_log` by `entity_type=planner_task` and exact `entity_id`.
  The wrapper rejects non-manager roles before reading, validates native UUIDs,
  errors/null results, mismatched entities and incomplete/future-dated evidence.
  Backend authentication/RLS remain authoritative and unchanged.
- Displays latest **returned recorded** `action`, `created_at`, `actor_user_id`
  (current profile-directory name only when matched), and activity record `id`.
  The read receipt is separate. No metadata/actor-name free text is promoted to
  a verified execution identity. No complete audit-history claim is made.
- `updated_at` is a source-record timestamp, never a last-execution timestamp.
  Seven days is an explicitly labelled display review threshold, not an SLA,
  lifecycle transition or worker-heartbeat test. Missing/invalid/future dates
  remain unknown. Failed/refreshing reads label retained rows stale/last-known;
  absence of a successful read receipt cannot claim a completed read.
- Canonical task/activity schemas do not supply typed execution agent, device,
  independently verified execution action or verified next action. These fields
  explicitly say Unknown. Full source notes remain separately labelled unverified
  instructions. No arbitrary notes, audit metadata, creator or owner is parsed
  into invented agent/device assignments or execution proof.
- Existing manager/admin account scope fences the view. Activity disclosures
  reset on account/role/task refresh; cancelled requests cannot publish results.
  Master filters survive refresh. No new database, RPC, assignment model, write
  path, credential, cross-client grant or remote fleet adapter was introduced.

## Verification

Commands use only the synthetic environment:
`VITE_SUPABASE_URL=http://127.0.0.1:1 VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-test-key`.

- Initial Nolan selection: 94 tests, 91 pass, 3 opt-in DB/Auth skips, 0 fail.
- Final focused `node --test tests/nolanMasterEvidence.test.mjs tests/nolanAccessibleViews.test.mjs`:
  10 pass, 0 fail. Covers permission denial before reads, foreign-source identity,
  missing/error results, canonical/conflicting/unknown ownership, raw status,
  retained-source warnings, timestamp semantics and actual SSR component output.
- Final `node --test tests/*.test.mjs`: **4418 total, 4385 pass, 33 skip,
  0 fail**, 217.59 seconds. Skipped opt-in database/Auth tests are not counted
  as fresh backend acceptance.
- Local `npm run build` passes (445 modules, Vite 7.86 seconds); emitted MyWorkPage bundle contains Master task
  evidence and the activity-identity validation. No Vercel build/deployment.
- New modules/components/tests pass scoped eslint. NolanOverview retains a
  pre-existing `react-hooks/set-state-in-effect` finding in its source loader;
  lint with that single existing rule disabled passes. No lint configuration or
  existing loader was rewritten to hide the baseline finding.
- `git diff --check` passes. No SQL/DB/Auth execution is claimed by these tests.

The already-delivered synthetic Library artifact was not regenerated or uploaded.
Its test fixture gained only an unavailable activity-reader export so existing
bundle-contract tests continue to compile against the actual updated component.

## Remaining gates

Authenticated same-origin browser/device acceptance and release approval remain
separate. A reviewed structured task-linked agent/device/execution receipt source
is needed before those unknown fields can become factual. Existing recorded
notes and audit entries can be maintained through existing task workflows now;
no duplicate manual board is required. Production Needs You activation remains
false; `vercel.json` Git deployment remains false. No production mutation,
merge/deployment, sandbox bypass or denied PR-description retry occurred.
