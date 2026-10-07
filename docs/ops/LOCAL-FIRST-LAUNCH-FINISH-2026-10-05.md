# Finish Dynamics locally; release one verified artifact

CA instruction, 5 October 2026. Product owner: #668; release/budget owner: #679;
coordination: #381. This is the execution plan, not a launch-complete claim or
authorization to deploy. Current main checked: `116c280f80370753d8d45eb4119e0f109d3beafb`.
Read latest owning issues before execution: current GitHub supersedes this snapshot.

## Non-negotiable operating rules

- ZERO Vercel builds/deployments during development. Keep
  `git.deploymentEnabled=false`; GitHub push/merge does not authorize deployment.
- Use local Vite dev/production builds, deterministic fixtures and isolated local
  backend validation. No Vercel remote cache, cloud preview or retry to obtain green.
- Do not pause/rebuild/delete client production sites or alter their DNS, budgets,
  projects, deployments or data. They are not test environments for Dynamics.
- No secret copying, client impersonation, production writes, migration/Edge rollout,
  provider/OAuth action or strategy approval/publication without its separate gate.
- One coherent lane at a time. Continue existing PRs; no duplicate stores, shells,
  Marketing Library, strategy engine or calendar. Onboarding is not launch focus.
- Every CA correction maps to an issue and an executable acceptance assertion.
  Guardrails in source material are NOT a client strategy. Unknown is not zero.

## Ordered finish queue and concrete acceptance

| Order / owner | Work to finish locally | Completion evidence / remaining protected boundary |
| --- | --- | --- |
| 1 — #668 / same #674 | Full selected-client preview: Overview, Plan, Performance, Approvals, Brand Hub; exact scope transitions, load/error/empty states, scripts and package display | Admin/manager preview is read-only, client-safe and fenced across client/month changes. No draft exposure to clients or internal IDs. Local actual-component checks exist; genuine authenticated release acceptance and Brand Hub Edge scope rollout are still pending. |
| 2 — #668 calendar/content | Connect each scheduled post to its exact published portal asset through canonical server-safe identity; guideline events retain the one canonical ordered document | Current library-to-calendar month link is fixed. Reverse post-to-asset link is NOT done. Use durable IDs/server projection, never titles; mock exact-client denial, unpublished/foreign assets, stale transitions, missing assets. Prepare any backend change separately without deploying/applying it. CG Calendar stays operational; Client Schedule stays monthly_deliverables. |
| 3 — #433 / existing #677; #437/#224 | Content Guideline intelligence uses genuinely routed approved/active/unexpired knowledge plus exact client/month/strategy/deliverable | Verify citations survive save/reload, staff edits are preserved, unknowns explicit, research differs from staff draft context. No hardcoded doctrine, private research leak or auto-write. Current #677 is draft, not runtime accepted; do not duplicate its owner. |
| 4 — #513 strategy, #668 presentation | Real business game plan: objective, customer problem, opportunity, positioning, concrete content choices, timing, learning and measurement within exact confirmed scope | Mandatory We Ar Fuels/Daisy/Piek negative fixtures reject voice rules/contact footers/identity notes as strategy. Audit all 94 applicable Sep/Oct drafts semantically, not by prose length. Last receipt: 72 draft v3, 22 held v2, 20 excluded v1, 0 approved/published. Held rows need genuine evidence; no invented research, results or holidays. Refresh readiness artifact only; protected amendments/approval/publication remain separate. |
| 5 — #389/#668 | Premium service tabs + clean Overview + exact package/calendar | All Facebook/Instagram/TikTok/LinkedIn/Google/Website icons discoverable. Standard social connection gaps are not upsells. Optional benefits respect reviewed service entitlement; unknown scope is not excluded scope. Google Business differs from Ads; discussion CTA uses Amonique +27 79 115 2339 without sending. Overview shows relevant verified highlights, neutral coverage metadata, no setup noise. Video/posters/content planning and reviewed website-maintenance presentation use canonical scope, not new inferred quantities. |
| 6 — #567/#573/#405 existing owners | Website Performance presentation and safe data contracts | Exact host/published snapshot/coverage; unsupported facts null/unavailable, no invented Wix-style metrics or cross-client reuse. Premium CG-built site opportunity distinct from an existing managed site awaiting evidence. Existing publication receipts do not authorize another snapshot. Leave Website backend owner untouched. |
| 7 — #623/#451, #217 | Staff/admin daily journeys and health | Hub, Work/My Day, CG Calendar, Client Schedule, Clients, Reports/Preview, Integrations, Marketing, Assistant: current Johannesburg dates, no stale examples, completed tasks not active, no admin leakage. Fetch complete is not APPLY complete; genuine stale/partial/failed stays non-green. Provider/phone/protected gates are explicit, not reasons to stop unrelated local work. |

## Local verification matrix — no cloud dependency

7 October source reconciliation: #674 full preview/post-asset contract, #677 W1,
#685 saved-brief/CTA correction and #686 offline task packet are merged. This
supersedes their old draft/code-gap statuses above, not their production rollout
or human semantic acceptance. #687 additionally closes the reproduced historical
Skill Card review-binding defect locally; its migration is UNAPPLIED. The final
supported suite is 3,700 total /3,683 PASS /17 intentional skips /0 failures,
with disposable SQL and no production access. Both review UIs pass synthetic
1440/375/390/430 acceptance; five changed Edge closures type-check. See the
owning review-revision runbook for coordinated schema/frontend/Edge release gates.
Do not call this “only Vercel push left”: authentic role acceptance, individual
knowledge review, substantive held strategy evidence and publication remain
separate human/protected gates.

For each changed lane: reproduce first; regression fails on old code; smallest fix;
focused tests; scoped lint; diff check; then full supported suite and production
build for the integrated candidate. Use the lockfile/runtime already approved.
Record exact SHA, commands, counts, skips, emitted app bundle and screenshots.
Never call a skipped/unavailable check passed.

7 October continuation on the same #674: the reverse Calendar-post -> exact
published-asset code contract is now implemented and tested locally (see
`CLIENT-PLAN-LOCAL-ACCEPTANCE.md`), superseding the CODE-gap wording in row 2 only.
Its additive `20261007100000_client_portal_post_assets.sql` is unapplied; deployment
and actual published assets are still protected prerequisites, not “only Vercel
push left.” Fresh read-only production SELECTs: 61 active clients; targeted Sep/Oct
72 v3 drafts + 22 v2 drafts, zero frozen published strategy snapshots; zero active
published portal assets. Historical v1 drafts remain outside that 94-row target.
Do not infer strategy semantic quality, client-visible approval or complete content
files from a successful local build. No data/config/Edge/provider/Vercel writes.

Browser acceptance at desktop 1440/1536 and 375/390/430: every portal surface,
keyboard/focus/disclosure/navigation, no body overflow, loading/error/empty,
current-month boundaries, two-client switch while reads are held, published-only
data, no internal source/drive IDs or credential fields. Exercise the real components
with deterministic synthetic reads; use legitimate local/test role sessions when
available. Synthetic tests are NOT authenticated production acceptance. No borrowing
tokens or production cookies to bypass preview authentication.

Read-only production acceptance may inspect existing legitimate sessions without
triggering sync/apply/publish/approval/download-side mutations. Missing session is a
named acceptance gap, not a guessed pass. Record the exact route/role/scope and time.

Final checkpoint must include client Overview/Plan/Performance/Approvals/Brand Hub,
staff/admin journeys, reporting null/zero truth, package authority, strategy semantic
audit, approved knowledge governance, content workflow, schedule/portal isolation,
Microsoft/Meta freshness and Assistant security/regression suites. Do not certify
all client information from code tests alone: freshness and missing evidence remain
business/data gates, distinct from display defects.

## Release candidate — build once, stage, then promote

This is a FUTURE CA-authorized sequence. Do not execute Vercel commands now.
Use the existing project/team and production domains; no new project or DNS change.

1. Freeze one integrated reviewed main SHA after local acceptance. Pin lockfile,
   runtime, test receipts and exact backend compatibility/migration/deployment ledger.
   No unresolved launch-critical code or placeholder strategy may be labelled done.
2. Read fresh billing-cycle usage/reset/headroom at release time; do not reuse the
   historical $1.02 or infer the reset date from chat. Obtain CA's explicit spend
   ceiling and reserve for **all client sites' serving/storage**, exact release SHA,
   project/team and stop condition. Finite shared cap with Pause ON still risks
   production: safe development cannot guarantee uptime. #679 hosting isolation
   remains separately protected; no unapproved cap increase or unlimited spending.
3. Capture the exact current known-good production deployment ID/URL, domain aliases,
   backend versions and rollback compatibility. Never delete that rollback artifact.
4. In the approved release window only, use a pinned compatible CLI; verify existing
   project link, production public configuration and SPA rewrites. Prepare a
   **production-target local Build Output API artifact** (`vercel build --prod`),
   with existing production settings obtained privately through the approved flow.
   Ordinary `npm run build` dist is not automatically `.vercel/output`.
   This step may contact Vercel for settings; it is not allowed during today's freeze.
5. Hash the emitted artifact and inspect it for app code, deep-link rewrites, asset
   completeness and secrets/source leakage. Vite embeds its public configuration
   at build time: wrong project URL cannot be corrected merely by promotion. If
   required system env values or framework behavior make prebuilt incompatible,
   STOP and request one budgeted standard cloud-build alternative, not both paths.
6. Preferred single upload: `vercel deploy --prebuilt --prod --skip-domain`, using
   the exact production-built artifact. This stages production configuration without
   moving live domains. No separate preview build followed by another production
   build. One staged upload; no automatic retries, `--force` or per-PR previews.
7. On the staged URL perform legitimate authenticated changed-code read-only role/
   client acceptance (desktop/mobile), deep-link/asset/console checks and backend
   contract/read checks. If auth is unavailable, stop promotion; do not bypass auth.
   Keep the existing live deployment serving. No writes to obtain demo evidence.
8. Only after acceptance and CA's release gate, promote **that same deployment**
   (`vercel promote <verified-deployment>`). Production-target staging/promotion
   avoids a rebuild. Keep automatic Git deployment OFF afterward.
9. Verify live custom domain/login/deep links, role/client isolation, scripts/assets,
   coverage/null truth and unchanged client-site availability. Record deployment ID,
   SHA/artifact hash/time and initial usage; observe delayed billing. No synthetic
   production traffic load test. Any additional attempt needs fresh authorization.

If prebuilt is incompatible, the bounded fallback is one authorized production-
target staged cloud build with domain assignment skipped, test it, then promote
the same deployment. It is an alternative, not an extra build. Upload, stored
deployments, network delivery and serving can still cost money even with no remote
build CPU. Do not quote a guaranteed zero cost or an unverified dollar forecast.

## Stops and rollback

Stop before upload on wrong SHA/project/team/env, missing budget/rollback/contract,
secret exposure, failed tests or unresolved backend prerequisites. Stop before
promotion on unavailable role acceptance, cross-client leakage, bad dates/scope,
missing assets, runtime errors, false freshness/zero or degraded client websites.
Use only the captured compatible known-good deployment for an explicitly authorized
instant rollback; no rebuild as incident response. Frontend rollback does not undo
database migrations, approvals or provider writes, hence these remain separate gates.

At 50% approved extra budget reassess; at 75% stop discretionary cloud work; at
reserve/cap no builds. Do not repeatedly raise spend to compensate for churn.

Official guidance checked 5 October 2026:
- https://vercel.com/docs/cli/build
- https://vercel.com/docs/cli/deploy (prebuilt and skip-domain)
- https://vercel.com/docs/deployments/promoting-a-deployment (production-target staging)
- https://vercel.com/docs/pricing/manage-and-optimize-usage (builds, deployment storage, delivery)

## Local disk discipline

Keep one canonical checkout and only necessary active worktrees/dependency installs.
Before deleting a checkout: verify exact remote backup/commit reachability, no
unpushed branch/dirty/tracked/untracked or ignored-only material, no active owner/
process, no sole credential/assets/evidence, and no accounting scope. GitHub does
not back up `.env`, local media, browser profiles or untracked evidence by default.
Use managed recoverable archive where supported; never blanket-delete project roots.

Generated dependency/build folders can be recreated from verified lockfiles/source,
but only delete exact validated ignored/untracked targets, never active environments.
5 October audit identified 70 inactive Dynamics generated folders, 5,310,555,604
logical bytes (about 4.95 GiB); exact workstation inventory is local, not secret-bearing
GitHub content. Execution safety blocked deletion before it ran: **zero folders
removed**. Source, credentials, unpushed work and accounting are untouched.
Subsequent explicit CA instruction authorized recoverable staging instead of deletion.
All 70 folders were revalidated and moved to `C:\CG-Cleanup-Review-2026-10-05`,
with original/staged paths in a local manifest and all 70 moves verified. Current
working dependencies remain present. Zero folders deleted; no disk space saving
yet. CA can manually delete the staging folder and empty its Recycle Bin items.
