# Nolan native overview: local implementation candidate

Owner request, 15 November 2026: use Dynamics as the single shared source rather
than maintaining another app/database or manually copied report. Keep the pinned
external workboard until a native replacement is verified.

## Implemented locally, not released

Proposed stable entry: `/admin/work?tab=nolan`. Existing Work shell and manager/admin
visibility guard; no new auth, roles, RLS, tables, RPCs, permissions or dependencies.
This is a compact read-only overview, not another write surface. Existing agents
and staff update canonical records through their current authorized routes.

- Active work: `commandCentre.listTasks`, which joins existing native/Planner work.
- Video pipeline: `contentWorkflow.listPipelineVideos`, current-main paginated reader.
- Client schedule: `planner.listMonthlyDeliverablesByMonth`, existing monthly authority.
- Client display names: `commandCentre.listActiveClients`.
- Search and expandable rows; source status, owner, notes and updated time.
- Read on open, refetch on browser focus and explicit Refresh. No websocket or
  background automatic-sync claim. Superseded in-flight reads are ignored.
- Errors and missing video schema are explicit; no false healthy/empty success.
- Canonical record/workspace deep links. Existing source screens own all writes.

## Visual reuse correction

CA later directed preserving the liked existing board. The local candidate now
ports its actual stylesheet (scoped under `.nolan-board`, with native-host containment),
brand/sidebar, situation header, scan-first rows and disclosure style into React.
No iframe, cross-service credential bridge or edits to the pinned Site.
The four initial source sections do not yet reproduce every custom Site section.

## Still open

Full website registry and app milestone adapters are not implemented. UI explicitly
says not connected. Paid entitlement reconciliation, posted proof and revision
identity remain separate work; a monthly schedule count is not a paid-package audit.
Task/client reader coverage is inherited, not certified company-wide completeness.
No unverified performance/health counters. Manager visibility is conservative;
other users/agents retain existing authorized tools, not new blanket access.
Existing video and schedule workspace links are not individual-record selection.
Source data read from application state is not independent delivery/approval proof.

## Acceptance before release

Local TypeScript/Vite build, focused lint and source-contract/regression tests.
These are not authenticated runtime/visual acceptance. Still verify real signed-in
manager/staff/client behavior, current production source coverage, slow/failed reads,
mobile keyboard layout and exact edit/readback appearance before claiming live.
Follow existing #679 budgeted release gates. No deployment, push, migration,
permission change or redirect of the pinned external URL is included.

## Continued implementation and review corrections

- Apps and CG Web Editor now have separate views over existing Dynamics task
  evidence with exact GitHub repository-link classification. Ambiguous/missing
  links remain in Active work; this is NOT a full external issue inventory.
- Clear prior snapshot during refresh/month change. Last-attempt timestamp is
  not presented as a successful source check; errors remain explicit.
- Added status filter and native container-aware layout. Notes are source notes,
  not inferred verified next actions.
- Existing task/client/alias/monthly-deliverable readers now use stable paginated
  reads. Pagination failure returns failure, never a partial successful inventory.
- Builder current-main Websites collection is the full website authority with
  operations/reporting/launchDiscovery metadata. Dynamics currently has only a
  per-client website-report bridge using an explicit server-held mapping. Full
  registry browsing requires a manager-authenticated field-allowlisted backend
  adapter, reviewed identity/credential contract and normal release safeguards.
  No connector credential may be embedded in the browser. Existing four mappings
  and the earlier ten enabled-operation records are not a complete inventory.
- Still no authenticated production/runtime or visual acceptance, deployment,
  redirect, GitHub publication, schema change or permission expansion.

## Master views / acceptance continuation

Added Master schedule (12 grouped responsibility/source navigation rows), Needs you
(exact signed-in user assignment), Special tasks/campaigns (existing Once-off/CG
Socials buckets), and Completed (shared operational completion helper). All-task
read now includes history for Completed; active views filter with that same helper.
The master navigation rows do not manufacture task records or claim status coverage.
A rendered React master-view test exercises accessible headings and source anchors;
this is server-rendered component acceptance, not authenticated browser acceptance.

Optional client-alias failure was restored to its previous graceful behavior after
review: valid client identities remain available; aliases are not needed for board
labels. Full website backend requirement is captured separately in
`NOLAN-WEBSITE-REGISTRY-ADAPTER-CONTRACT.md` rather than silently broadening a token.

## Package authority and acceptance preparation

Package tab now lazily reads the existing `loadActiveClientPackageEvidenceMatrix`
through the canonical paginated active-client directory. It exposes recorded
confirmation, field conflicts and unknown allowances without equating templates,
current settings, schedules or invoices with paid historical entitlement. Existing
matrix source orderings now include stable ID tie-breaks. It does not reconcile
actually posted media/revisions/crossposts or authorize billing/rescheduling.

Master view no longer shows a misleading zero-record count or ineffective filters.
Personal queue renamed Assigned to you to avoid implying the old manual Needs-you
(CA decisions) semantics have been automatically reconstructed. Authenticated
acceptance matrix is in `NOLAN-AUTHENTICATED-ACCEPTANCE.md`; all live-browser gates
are still explicitly untested.

## Core-only independent review fixes

Package evidence now follows the parent refresh/focus generation and month changes,
provides explicit retry/refresh, clears old results during new reads, and records its
own successful source-read timestamp. Superseded results are ignored. Reader tests
exercise failure then successful retry and client-failure short circuit; UI wiring
checks cover cancellation and refresh dependencies. These are not browser acceptance.
The completion-authority regression test now examines the complete function boundary
instead of a brittle 300-character prefix; canonical completion behavior is unchanged.

### Independent exact-core verification

Core fix commit `407d743` builds successfully; focused lint and diff-check pass.
The focused Nolan/completion suite has 49 passes and no failures. Initial full-suite
attempt hit the reviewer's 180-second cap, not a verified full-suite pass.
Investigation found the unchanged SES test harness invokes real 20-second waits in
`scripts/ops/ses-af-south-1-setup.sh` while AWS/Supabase themselves are stubbed.
The SES script, fixture and test files have no diff against base `4af4130`.
An isolated SES run with a temporary test-process-only no-op sleep executable passes
12/12; no repository script, production delay or safety guard was changed. A normal
full-suite run with the real sleeps and a 360-second bound is being checked separately.

The normal full suite subsequently completed naturally in 178.8 seconds: 4,337 tests,
4,306 passed, 30 skipped, one stale navigation source-contract assertion failed.
That assertion is updated to require the grouped Workload/Nolan manager guard and
Nolan render guard; all eight navigation tests pass. No role behavior was weakened.
The prior 180-second timeout was therefore an insufficient test budget, not a product
hang. A final full-suite receipt is required before claiming the suite passes.

Final normal full-suite receipt on code/test commit `6327a63`: exit 0 in 177.2 seconds;
4,337 tests, 4,307 passed, 30 skipped, zero failed/cancelled. This used synthetic
loopback Supabase configuration and the original real SES delays, without production
credentials or provider calls. Exact code build, focused lint and diff-check pass.
Authenticated UI/role/readback and budgeted production release remain unverified.
