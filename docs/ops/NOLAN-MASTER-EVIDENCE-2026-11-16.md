# Nolan Master evidence — source candidate, 16 November 2026

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
