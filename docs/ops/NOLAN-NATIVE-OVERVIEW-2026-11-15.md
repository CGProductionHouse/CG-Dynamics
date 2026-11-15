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

## Existing website reporting reused, not a new registry bridge

The Websites lane now offers explicit on-demand loading of actual active Clients,
matched only to the four existing reviewed `cgWebsiteFleet` UUID mappings. It labels
this as partial coverage, not a complete Builder inventory. Maintenance-only and
unmapped sites are not inferred. Existing `WebsitePerformancePanel` is reused with
saving disabled; client/month selection uses its existing authenticated reporting
and canonical enquiries readers. No token, endpoint, credential, role or backend
configuration changed. The optional source-generated timestamp is shown separately
from directory-read time. Parent refresh/focus remounts this lazy view, discarding
old reporting state; explicit retry/reset clears stale data and cancels old reads.
The full website fleet and authenticated reporting acceptance remain outstanding.

Website-reuse code commit `6ce0315`: exact build, focused lint and diff-check pass.
Normal full suite exits 0 in 184.2 seconds: 4,340 tests, 4,310 passed, 30 skipped,
zero failed/cancelled. Test fixtures use synthetic loopback configuration; this does
not verify actual production report access or rendered browser/device acceptance.

## 15 November continuation: schedule evidence disclosure

The package row disclosure now shows canonical scheduled date, recorded posted
timestamp, internal approval, sent-to-client and client approval timestamps
separately. Missing evidence stays `Not recorded`; invalid timestamps are labelled
as source gaps. Schedule/status values never synthesize posting or approval dates.
All displayed times use Africa/Johannesburg. This does not verify platform post
identity, final asset revision, reviewer provenance or historical paid entitlement.
The existing row and source workspace remain authoritative; no new query, provider
sync, write surface, credential, dependency or production change is introduced.
The liked layout and external pinned board remain unchanged.

Verification is local only: new rendered component contracts cover missing fields,
schedule-versus-post separation, SAST timestamp display, malformed inputs and
read-only integration. The initial broader test command used the wrong synthetic
environment variable name and failed existing Supabase initialization; corrected
VITE_SUPABASE_PUBLISHABLE_KEY rerun passes. Authenticated browser/role acceptance,
full current fleet/posted reconciliation and release gates remain open.

Final continuation receipt: TypeScript/Vite build, emitted app component/CSS,
scoped ESLint and diff check pass. Nolan focused suite: 22 passed, zero failures.
Full normal suite with the repository's synthetic `http://127.0.0.1:1`
configuration: 4,345 tests, 4,315 passed, 30 skipped, zero failed/cancelled;
exit 0 in 179.2 seconds. An earlier full run used port 54321 and hit one existing
client-library origin-expectation failure; correcting only the synthetic test
configuration produced the passing full run. No guard or production code was
weakened. Independent code review found no blocking issues. Browser/device/real
role tests were not run for this addition and remain explicit release gates.

### Source-only long-content and failure continuation

Added scoped min-width/wrapping for source titles, status labels, owner labels,
expanded details and errors, preserving the liked board without hiding content.
Four additional tests cover escaped long source strings, empty fields versus a valid
epoch timestamp, source CSS containment contracts, and rejecting partial package
results accompanied by a later-page error without stamping success. All 26 Nolan
tests pass; TypeScript/Vite build and diff check pass. The previous full-suite receipt
belongs to the prior schedule-evidence tree, not a new full-suite run of this CSS/test
follow-up. These are SSR/source contracts, not proof of visual/mobile rendering.

Candidate browser acceptance remains blocked: local Vite route returned HTTP 200
inside its execution workspace, while cloud browser access returned connection
refused. Other listed desktop environments were offline. No authenticated candidate
role sessions were available; no credentials forwarded, auth bypass, production
change or release performed. PR #990 comment 6894081825 records the attempt.

### Independent source receipts and exception isolation

Each task, video, schedule and client-label reader now settles independently. A
thrown reader no longer discards successful unrelated lanes. Native error payloads
and missing video schema still mark that source unavailable and suppress partial
rows. The coverage disclosure lists each reader's completion time and outcome,
explicitly not upstream-provider freshness, full coverage or delivery proof.

Six new tests cover independent success/failure, completion-time capture, preserved
native errors, opaque thrown values, source UI labels and empty Error messages.
Independent review caught empty thrown Error text potentially becoming a false
success for videos; normalized empty/whitespace errors and added regression coverage.
The pre-correction in-flight full run was stopped, not counted as a pass. Corrected
source passed build, scoped lint, diff check and the normal full suite: 4,355 tests,
4,325 passed, 30 skipped, no failures/cancellations, exit 0 in 179.79 seconds.

Browser acceptance remains unavailable: both CDP and separate native Chromium
loopback navigation refused the synthetic local endpoint; direct file access showed
an explicit organization block and was not bypassed. Temporary native window/server
were closed and original tabs preserved. No visual/mobile/authenticated acceptance,
production release, provider retry or credentials movement occurred.

### Exact record navigation and date provenance

Monthly schedule rows now open the existing Client Schedule drawer using encoded
record ID, client and month with all-status mode, rather than a generic workspace
that could hide historical/completed targets. No destination screen or access rule
changed. Disclosures expose canonical source/record IDs; search accepts those IDs
and video canonical names. Video links remain workspace-level because that screen
has no verified exact-video query contract.

Recorded dates are labelled by actual source semantics: native and monthly due dates
remain due dates; Planner adapter dates explicitly say due/start fallback. Independent
review caught that distinction before release; corrected it without altering shared
adapter semantics and added an SSR regression. Video proposed-post dates are not
invented as deadlines. Identity/source dates remain tracking, not delivery proof.

Six additional tests cover historical source context, URL encoding, escaped identity,
existing destination drawer support, searchable identities and due/start provenance.
Corrected source: 38 focused Nolan tests pass; build, scoped lint and diff pass.
Full normal suite: 4,361 tests, 4,331 passed, 30 skipped, zero failures/cancellations,
exit 0 in 179.73 seconds. The pre-review-correction in-flight run was stopped, not
counted as a pass. Independent re-review found no further issues. Browser/mobile/
authenticated acceptance remains open; no merge, deployment or production writes.

### Daily ownership review using existing authority

Added an open-task Ownership review lane without creating/reassigning any task.
Workbook task ownership now uses shared `resolveOwnership`/`taskOwnershipInput` and
`isVerifiedOwner`, plus the existing staff-profile reader as an independently
reported source. Assigned to you no longer treats raw IDs in conflicting/unresolved
records as verified assignment. Displayed owners come from canonical profile names;
helpers and imported names remain explicitly separate audit evidence in disclosure.

Unavailable/partially missing canonical profiles return an evidence gap, not an
unassigned or partially verified conclusion. Such rows remain in Active work with
an explicit owner-evidence label, not silently promoted into Ownership review.
Search includes canonical displayed owner labels and source IDs while keeping
imported text searchable solely as evidence. No staff reader, shared ownership
rule, assignment permission or scheduler was changed.

Seven new tests cover canonical versus imported owners, helpers, conflicts,
unresolved names, missing/partial directory coverage, completed exclusion, escaped
SSR disclosure and canonical-owner search. Independent review confirmed the final
search correction and no remaining blockers. Final 45 focused Nolan tests, build,
scoped lint and diff pass. Normal full suite: 4,368 tests; 4,338 passed, 30 skipped,
zero failed/cancelled, exit 0 in 179.87 seconds. Actual browser/authenticated role
acceptance remains open; this candidate is not deployed.

### Video handoff evidence in workbook disclosures

Video rows expose the existing footage, internal-review, client-review and final
asset link fields separately, with linked monthly-deliverable ID and recorded
production-status timestamp. They remain explicitly unverified source evidence:
a review URL is not approval, a final URL is not the approved final revision, and
neither establishes client correctness, access or delivery. No destination was
fetched, no pipeline/editor changed and no publishing or sharing action added.

Recorded links reuse the existing URL guard plus parsed HTTP(S)/no-credentials
checks; malformed/unsafe values are labelled without rendering their raw contents.
Links use noopener/noreferrer. React escapes source IDs and timestamps. Six tests
cover missing evidence, link separation, rejected URLs, exact identity/timestamp,
and read-only wiring. Independent review found no blockers. All 51 focused Nolan
tests pass; build, scoped lint, diff and full normal suite pass: 4,374 tests,
4,344 passed, 30 skipped, zero failures/cancellations, exit 0 in 179.26 seconds.
Browser, destination accessibility and actual asset/approval provenance remain
unverified. No merge, deployment or production mutation occurred.

### Website source boundary and mapping-coverage continuation

Rechecked production operations list, all ten exact records and current Builder
source contract. The connector exposes enabled/authorized operations only and no
Dynamics UUID bindings, with a source cap of 200 and no total/cursor. Full registry
and additional exact joins remain blocked rather than guessed. Exact receipt and
source SHA are in `NOLAN-WEBSITE-REGISTRY-ADAPTER-CONTRACT.md`.

Website UI now discloses unique active client identities read, number with reviewed
mappings, and identities without those mappings. Those are client coverage counts,
not a website denominator or an outage. Exact mapped client ID/presentation host is
visible in row details, with server reporting validation still required. No mapping,
backend, credential or source authority changed. Three new tests guard unique
counts, refusal to infer new joins, and truthful coverage/health wording.

Mapping-coverage verification: six targeted website tests, build, scoped lint and
diff pass. Independent review found no blockers. Normal full suite: 4,377 tests,
4,347 passed, 30 skipped, zero failures/cancellations, exit 0 in 181.74 seconds.
No browser/authenticated reporting acceptance, live map change, merge or deployment.

### Package provenance continuation

Workbook package details now retain exact Dynamics client identity and per-field
recorded evidence class, confidence, note and source references. Named conflicts
and unknown fields are visible rather than just totals. Direct references remain
separate from supporting context; reference strings are escaped audit text, not
clickable destinations. This reuses the existing package authority without new
reads, writes, mappings or historical/paid entitlement assumptions. Empty results
explicitly do not establish company-wide coverage. Zero, false and unknown remain
distinct. No billing, rescheduling or publishing capability was added.

Independent review found no blockers. All 59 focused Nolan tests pass, scoped
lint/diff and TypeScript/Vite build pass. Normal full suite: 4,382 tests, 4,352
passed, 30 skipped, zero failures/cancellations, exit 0 in 186.18 seconds.
Browser/authenticated acceptance, actual source/reference verification and paid
package reconciliation remain open. No merge, deploy or production mutation.

### Return-to-work workflow continuation

Native Nolan lane, selected schedule month, search and status filters now live in
namespaced route parameters. Opening an authoritative record and returning with
browser Back restores the prior working context instead of resetting Active work.
The URL can also be bookmarked; it does not grant access or change underlying
records. Search typing replaces history rather than adding a Back step for each
keystroke. Lane/month/status navigation pushes a history entry. Clear filters
retains lane/month. Existing filters with no current matches remain visible for
recovery rather than disappearing from the status selector.

Route parsing validates month/lane and bounds filter text; existing parent tab
and manager access checks remain untouched. Filtering does not cause new reader
calls; only the existing month/refresh dependencies do. No persistent second store,
background scheduler, writes or mappings were added. Parent tab-button navigation
still starts a fresh tab URL; this is Back/bookmark restoration, not persistence
across every navigation path. URLs include filter text, so users should avoid
putting secrets in search and review a URL before sharing it.

Independent review found no blockers; all 64 focused Nolan tests, build, scoped
lint and diff pass. Browser Back/mobile/authenticated runtime acceptance remains
open; route roundtrip/source contracts are not a browser acceptance claim.
Full regression on this source: 4,387 tests, 4,357 passed, 30 skipped, zero
failures/cancellations, exit 0 in 180.60 seconds. No merge or deployment.


### Verified isolated component browser acceptance

On 15 November 2026, exact candidate 294b0508088843aeb8f8f93facc0ab07dce26a8f
(tree504757c164c94d81b49cd3dabaf967f19d42c1b9) received an isolated component
browser pass on CA-MSICyborg15 Edge. Synthetic HTML used actual scoped CSS and
SSR MasterScope, package-record evidence, video handoff and record-identity
components with invented records and a representative sidebar/main shell.
Fixture26864bytes SHA256856f5610ee14cac3ccf1b50924ad3fe49b5b3d9d7261253b3dfbf05f33f3746d
was transferred programmatically and hash-verified before memory-only loopback
serving. No local files, real data, credentials or sessions were transferred.

Screenshots and DOM inspection at360x800,768x900,1024x900: document client/scroll
widths345/345,753/753,1009/1009; no main descendant beyond viewport right. Long
IDs/references wrap; missing/invalid evidence readable. Native allowance summary
collapsed on click and reopened with Enter, with visible keyboard focus. Desktop
master descriptions intentionally clamp; full source-description visibility is
not claimed. Viewport reset and own tab closed, original Edge tab preserved;
transient server stopped with intentional Ctrl-C. No WhatsApp interaction.

This closes only these synthetic component layout/disclosure checks. Fixture
navigation was inert and scripts/network blocked. Actual application routing,
search/refresh/races, authenticated role boundaries, live source records and
edit/readback remain UNTESTED. No production deployment, merge or auth bypass.
