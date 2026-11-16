# Staff AI phased containment — review candidate, NOT LIVE

Base main: `206f4df9cc845a1b818f96fa4ab43ef1922b7772`. This is a narrow extraction
within the existing #995 task, not another agent lane. PR995 parity candidate
`d5a02c0ce69c97e3c454c6500538f3abe1daf242` remains separate and unchanged.
No publication, merge or deployment authority is implied by these local artifacts.

## Phase A: frontend containment, zero backend/schema changes

Remove AssistantPage, GlobalAssistantComposer and DailyAssistantCapture; remove the
composer mount and its fullscreen-shell state; replace `/admin/assistant` with an
authenticated replace-redirect to `/admin/my-assistant` (old prompt query discarded).
Remove Marketing new-request, routing, generate/regenerate and handoff controls.
Keep saved artifacts/versions/compare/human review and client selection. Retain
My Assistant Today/Leads/external setup, profiles, Library/Client Guides/Review/
Sources/Registration and existing route/role boundaries. Copy describes removal
from the workspace, not a claim that server execution has stopped.

Eight frontend files only: src/App.tsx; src/pages/admin/{AdminLayout,
AssistantPage,MarketingAiDepartmentPage,MarketingWorkspacePage,MyAssistantPage}.tsx;
src/components/assistant/{DailyAssistantCapture,GlobalAssistantComposer}.tsx.
Tests and this release documentation are the only other changes. All backend
functions, shared consumers, providers, credentials, schema, src/lib helpers,
package lock and plugin files remain byte-identical to base. The existing 59 MCP
tools and four plugin skills retain their current contracts. No five-tool addition,
new generic skill retrieval or artifact-write parity is claimed in this phase.

Residual risk: cached old bundles and direct authenticated HTTP requests can still
invoke the old model handlers. UI containment removes staff entry points only.
Unused legacy invocation helpers remain deliberately untouched. Fresh loads receive
the new UI after release; forcing browser data deletion is not part of this patch.

## Phase B: optional narrow server retirement, also no migrations

Separate eight-line patch to cg-assistant-chat/index.ts and
marketing-workflow/index.ts returns STAFF_AI_RETIRED HTTP410 for normalized
chat/default/unknown and Marketing run, after existing method/JWT/profile/role gates
and before provider invocation or artifact writes. Authentication, diagnostic/status/
routing actions, imports, shared ai-router/skilledAgents/directorKnowledge consumers,
all MCP code and schema remain unchanged. No function directory deletion.
This closes those direct/cached execution paths; it does not disable every shared
AI consumer globally. It can accompany A or follow it without waiting for parity.
The isolated real-Auth/native-Deno tests already exercised these exact handler
changes in #995; focused handler tests must pass for this separated patch too.
Local extraction is not proof of the deployed closure or JWT configuration.

## Practical release sequence and exact gates

1. Review/freeze A, or A+B. Do not merge all of #995 to obtain containment. Reconcile
   current main and workbook at release; workbook source/guards remain separately owned.
2. Apply #679: explicit CA authorization for exact SHA/project/team/environment,
   operator/window/stop condition, fresh cycle usage/headroom, approved incremental
   spend ceiling (currently no added spend), serving/storage reserve, affected-domain
   uptime baseline and exact rollback deployment. No emergency exemption exists.
3. For A, use the existing project production-target local prebuilt -> one upload
   with domain assignment skipped -> legitimate authenticated changed-route acceptance
   -> promotion of that SAME artifact. This is the documented release method; a
   newly provisioned staging database/project is NOT required for frontend containment.
   The candidate uses unchanged production backend contracts. Production settings,
   legitimate existing sessions and read-only acceptance require release authorization;
   do not copy sessions, guess identities or bypass authentication. Never deploy the
   synthetic local test dist. A missing session stops promotion, not local preparation.
4. If choosing B, backend owner captures exact current closure/verify_jwt/settings,
   reviews the eight-line delta, and deploys only the two entry-point closures under
   explicit authorization. Then check 401/403/410 using legitimate identities and no
   provider-generating request. Preserve shared consumers and history. Deploy B before
   promoting A when one coordinated window is approved, reducing cached-client risk.
5. Accept old assistant links, no composer/Marketing generation controls, retained
   Today/Leads/history/review and client exclusion on desktop/mobile widths. Existing
   supported connector read workflows should remain usable. The five new tools,
   their migrations and installed new-tool acceptance are NOT gates for A or B.
6. Promote only after accepted changed paths; verify live assets/login/deep links,
   uptime and budget. No automatic retries. Keep git.deploymentEnabled=false.

No-spend feasibility: local preparation/tests use existing resources. A prebuilt
upload avoids remote build CPU but upload/storage/serving may still incur costs.
No guaranteed free release is established. Release owner must prove existing
headroom/reserve and authorize the operation within the no-additional-spend limit;
otherwise stop. Do not purchase resources or alter caps to proceed.

Rollback A to the captured prior frontend is data-preserving but re-exposes old UI.
If B was applied, keep 410 handlers in place during frontend rollback. Prefer a
bounded forward UI fix. Restoring model execution requires a separate owner decision;
never delete historical artifacts, profiles, credentials or providers. Capture prior
Edge closures for investigation; do not blindly restore generation as rollback.

## Evidence and remaining acceptance

Focused connector/UI tests, canonical receipt SQL test, TypeScript/Vite build and
lint results are reported with the exact local commit in the task handoff. Existing
#995 source/real-Auth evidence is reused only where byte-identical. No browser or
hosted acceptance is claimed. Current cloud normal-browser sandbox is documented
blocked; use legitimate read-only staged release acceptance on a supported browser.
No full-parity staging setup, schema application or installed new-tool acceptance
is necessary to authorize this small containment release.

Local phase-A verification: selected UI/catalog/MCP suite 268 passed, zero failed,
one optional PostgreSQL test initially skipped; that receipt test file rerun with
cached PGlite passed all 18 tests with zero skips. Production tsc/Vite build passed
(16.50s Vite); full lint zero errors/17 existing warnings; diff check passed.
Byte comparison confirms the entire supabase tree, chatgpt-plugin, src/lib,
package files and vercel.json are unchanged from the exact base. The original
parity worktree remains untouched. These are local results, not browser acceptance.

Phase B separated verification: 12 handler tests passed (chat/default/unknown and
Marketing run across five staff roles; client/inactive/unauthenticated/method gates),
zero failures/skips. Scoped ESLint and native Deno check of both complete entry graphs
passed using #995's explicit validation-only npm map/sloppy imports/browser env types.
As-authored hosted esm.sh resolution remains unverified. Frontend build is reused
from byte-identical phase A. Exact eight-line backend delta matches the previously
real-Auth-tested #995 handlers; no new real-Auth run is claimed for this local split.

## Durable review branch and authorization boundary

The owner explicitly authorized this removal implementation and preservation push.
Ordinary isolated edits, tests, commits and this review-branch push need no repeated
permission. The same request explicitly prohibits deployment and spending; moreover
#679 requires an exact approved release window/packet. These are the actual remaining
authorization boundaries, not a universal rule that every deployment needs a fresh
confirmation. Once a suitable release packet is approved, execute its covered steps
without asking again unless scope/conditions change or a stop gate is reached.

Before this preservation push: vercel.json retains git.deploymentEnabled=false; all
repository workflow triggers were inspected and none executes on push. No workflow
contains an automatic release path for this branch. No PR/comment/dispatch is created.
Thus this push has no configured deployment trigger and does not authorize a manual
CLI/dashboard deployment. No GitHub PR description publication is retried.

Phase A commit066b1a159eb1b4f6fbaf753006ca753e7a35134e and phase B
edb0f97aa7d7b74c1803190742a3bac05894b2fe remain unchanged ancestors of the
codex/draft-staff-ai-containment-20261116 branch. The final evidence-only commit
does not change tested runtime code. Patches/receipts are under
[staff-ai-containment-artifacts](staff-ai-containment-artifacts/receipt.json).

Handler review: both gates occur after method/config checks, real auth.getUser, exact
user profile active/role checks and JSON parsing. Chat normalizes unknown/default
actions to chat before 410 and stops before requestId/provider/audit work. Marketing
run stops before route execution/artifact/provider work. Existing specialist_status,
diagnostics and test_provider code remains unchanged with its original permissions;
provider diagnostic testing can still invoke providers and is NOT part of acceptance.
This is retirement of staff chat/Marketing-run paths, not a global provider kill switch.

## Test-contract correction after independent review

The initial containment extraction missed legacy tests that eagerly read deleted
UI files. Reproduced the reported ENOENT failures, then audited all references.
24 test files now remove only deleted-UI assertions, preserve independent backend,
RLS, role, notification, lifecycle and shared helper assertions (including mixed
tests/loops), and cover retirement redirects, retained Today/Leads/setup, mobile
navigation/accessibility/safe-area layout and removal of Marketing controls.
No blanket skips or suppression of unrelated failures were added. Exact files,
commands and hashes: [correction receipt](staff-ai-containment-artifacts/test-correction-receipt.json).

Final affected selection: 430 PASS/0 FAIL/0 SKIP. Requested two files:17 PASS.
Full suite:4268 total,4243 PASS,2 FAIL,23 SKIP,0 cancelled (421.915s). Both failures
in untouched commandCentreNavigation.test.mjs reproduce independently on base
206f4df9 (11 PASS/2 FAIL); they remain unresolved, not hidden. Full lint:0 errors/
17 existing warnings; changed-test lint clean. Optional environment-gated skips
are not verified passes. No ENOENT remains. Runtime and dependency files are
byte-identical to the prior built candidate, so no redundant build was performed.

Main advanced to8bb8d455 (#1001 report platform-winner fix) during this run; its
separate runtime/test/docs delta is not merged/tested here. Workbook41bda9a9 remains
separately owned. Original A/B commits and full parity PR995 remain unchanged.
The current candidate includes the correction; original standalone A/B patches
need the additional phase-c-retirement-test-contracts.patch for current tests.

## Current main reconciliation and executable release boundary

Main8bb8d455 is now integrated in cca33931; reportStats and its winner test are
byte-identical to main. Only the handover conflicted; its complete main content
and containment entries are preserved. The handler test now compiles the real
normalizeAction declaration: undefined/null/empty/unknown/malformed actions become
chat; diagnostics/test_provider/specialist_status retain their real names. The
real handler runs with that normalizer and fail-fast provider/write dependencies.
No production handler behavior changed.

27 affected checks pass: real normalization/handler gates, main report-winner test,
and PR990's unchanged navigation repair temporarily tested against this runtime.
The latter remains owned by workbook41bda9a9, not copied into this branch. Its
smallest correct repair replaces obsolete renderNav(false,closeMobile) assumptions
with actual mobileNavigationGroups role checks and the retained Work-to-Import link.
No navigation runtime change is needed. Coordinate its owner-held landing/extraction;
do not claim the retained baseline tests are green. Build passes, changed lint clean.
No redundant full suite was rerun. [Exact evidence](staff-ai-containment-artifacts/main-reconciliation-receipt.json).

Read-only metadata reconfirms project prj_jHVsExoStNjI7ikqlJyXZx26Ahuu / team
team_SK5vvWv1AIXFkPNV8JFYL205. Deployment dpl_GwQE8n9fRXGdr13L4Gbjj8VV2iM5 is
READY/production-target, URL cg-dynamics-n70blq59q-cg-dynamics-projects.vercel.app,
but returned aliases are empty; project live=false/domains=[] does not establish
serving status. This is a candidate inventory ID, NOT a certified rollback or outage.
Require actual serving domain/aliases and known-good rollback confirmation, plus
the two current Edge closure/JWT inventories, before release. No production app
or database request was used for this metadata investigation.

Billing Nov1-Nov16 exceeded the connector 4MiB limit; the prescribed one-day
Nov15-Nov16 range succeeded with1588 records. Partial data cannot establish the
actual billing cycle/headroom/reserve, so no partial cost total is advertised.
Use a complete current-cycle export or bounded complete adjacent windows after
confirming the cycle boundary; refresh at release. A prebuilt upload still has
storage/delivery costs: zero incremental spend is unproven until the release owner
confirms sufficient already-paid allowance and an explicit serving/storage reserve.
No cap increase, resource purchase or deployment is implied.

The owner's removal request covers ordinary implementation, reconciliation, tests
and preservation pushes. This turn expressly forbids deployment; #679 additionally
requires the exact release packet/window/operator and budget/rollback evidence.
Once that packet authorizes A+B, proceed through its covered ordinary steps without
repeated permission: capture rollback -> two handler closures/401-403-410 checks ->
one production-configured prebuilt upload without domain assignment -> legitimate
read-only staff/admin/client and desktop/mobile changed-route acceptance -> promote
the same accepted artifact -> uptime/usage checks. Missing session or failed
acceptance stops promotion. No new staging database, five-tool migrations or full
plugin-parity rollout is required. PR995 remains separately pending and not live.
