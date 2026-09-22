# CG Dynamics Ops Handover

## ISSUE #463 CODE LANE — 22 September 2026

- Monthly Strategy Autopilot is accepted and merged through PR #464 at main
  `b93f3086a3e46c272c294f7037c4679b3d907e94`.
- The merged scope is code-only: current/next-month canonical #391 draft preparation
  plus read-only #450 Content Guideline alignment. Existing strategies are never
  overwritten and client visibility remains publish-only.
- Supervisor correction review verified Johannesburg-date Marketing Library expiry,
  reviewed/active-only industry routing, exact-client card scoping before limits,
  and truthful withheld alignment when the canonical strategy read fails.
- Agent 01 retains the shared worker/sync/launch lane. #463 did not modify the
  background worker, scheduler, Microsoft/Meta sync, production configuration or
  live data. Final worker ordering remains a small documented handoff after review.
- Merge does not authorise production activation. The isolated Edge Function must
  not be deployed or wired into the live cycle without the normal protected gate.

## PRODUCTION ACTIVATION TRUTH — 22 September 2026

This section supersedes the pre-merge #450/#451 lane snapshots below. Exact evidence and the ordered
protected runbook are in `docs/ops/P0-PRODUCTION-ACTIVATION-2026-09-22.md`.

- GitHub/Vercel code truth is `main` `0d170e5be2e87dd7c9d602fe0ea2a7860762283a`.
  Activation corrections for stale-preview takeover, automatic date range, Edge dependency
  resolution and bounded Microsoft detail units are merged and production-green.
- Production now has the explicitly approved Client Portal foundation plus the four #450/#451
  migrations (`20260918113000`, `20260921090000`, `20260921120000`, `20260921140000`,
  `20260922120000`) applied and object/grant verified. The separate Photography policy migration
  `20260919100000` remains unapplied as instructed.
- Both system identities are the auth-backed `CG Production House Admin` profile. Independent
  `DAILY_FRESHNESS_WORKER_SECRET` and `WORKER_INTERNAL_TOKEN` values are configured. All three
  Content Autopilot flags remain false and no `content_autopilot` job has been created.
- The originally listed five dependency functions are deployed from accepted main with their intended gateway modes;
  `background-worker` was deployed last. The existing cron has since exposed its implicit pg_net
  five-second timeout: live calls time out at the scheduler while longer worker work continues.
  Do not create a second scheduler. Changing the existing cron command/timeout remains a protected
  mutation requiring CA approval.
- Live Meta truth at 10:48 UTC: 37 linked assets, 57 mapped platforms and 45 checkpoint rows (42
  successful, three failed). Missing evidence remains missing and zero PASS is preserved. The
  deployed `meta-sync-worker` is older than #451 and skips current-month incremental items, causing
  the same assets to be rescheduled; current accepted `meta-sync-worker` is a newly proven protected
  deployment dependency. Red Oak also has a truthful provider permission failure for
  `pages_read_engagement` on its historical read.
- Live Microsoft truth: provider configuration and transition are active, but the production cycle
  first selected the 18 September staff preview because the chosen actor is also the historical
  admin actor. That takeover defect is merged and deployed. Its first direct cycle then failed
  before job creation because the automatic `-31`/`+370` range totalled 401 days against the
  existing 370-day guard. `codex/451-activation-range-fix` makes the range a tested 369 days. No
  Microsoft write occurred.
- Content/OneDrive truth: Econofoods already has the upcoming run, guideline and three ideas, but no
  short code or durable folder mappings. Across production there are zero configured short codes,
  zero OneDrive mappings and zero delegated OAuth tokens.
- Remaining gates: accept/deploy current `meta-sync-worker`; approve and update the existing cron's
  pg_net timeout (not its cadence); observe a bounded Microsoft terminal result and stable Meta
  checkpoints; resolve the Red Oak provider-permission gate if complete fleet evidence is required;
  only then enable Content Autopilot alone. AI and OneDrive remain off.

## SUPERVISOR CONTINUATION — 21 September 2026, 11:55 SAST

**This section supersedes the 11:36 P0 lane-state snapshot below. Refetch live GitHub before consequential action.**

### Live P0 state

- Live `main` before this handover write: `95952cc5f9a0b74dda056b81306efe1405cc0f2b`.
- **CA MANUAL 02 — #450 / PR #455** remains on `feat/450-content-production-autopilot`, head `9ebe22c28bd3ae88df8e0928517057437bf4a6f0`. Vercel is green and GitHub reports the PR mergeable, but supervisor code review found functional/truth blockers. State is now **CORRECTION PASS REQUIRED**; do not merge this SHA.
- **CA MANUAL 01 — #451 / PR #454** remains on `feat/451-daily-dynamics-freshness`, head `10d6a986e2dc5f9da5e6268b0cc198b15f6abc2d`. State remains **CORRECTION PASS REQUIRED** and Vercel remains red.
- **#452** audit support is complete/closed.
- **#453** audit support is now complete/closed. It independently confirmed all five #454 blockers and additionally found that a crashed Microsoft apply left at `status='applying'` has no automatic resume path.
- #442 remains paused. No protected production gate has been crossed.

### #450 / PR #455 — seven supervisor blockers

1. The exact Microsoft-owned Outlook/CG Calendar event -> Content Run auto-ensure path is still not executable. The background pass begins from existing `content_runs`; the Econofoods missing-run failure class is not actually exercised end-to-end.
2. The normal background cycle does not execute draft AI generation; generation exists only as an explicit MCP action. Add the safe latent automatic path/feature gate while keeping activation CA-gated.
3. Per-video OneDrive folder auto-ensure is not executable. Mapping schema/readiness planning exists, but no create-only Graph/OneDrive create+durable-map path calls the new mapping authority.
4. The autopilot pass does not automatically link exact, unambiguous same-client future `monthly_deliverables`; it only reports unallocated videos. The Client Schedule rows themselves remain read-only.
5. Browser Content Operations queries `content_guide_video_onedrive_folders` directly even though the migration revokes authenticated access and exposes its helper only to service role. Add a least-privilege staff-safe projection/RPC so real mappings do not appear unreadable.
6. Browser final-output truth never reads `client_portal_assets`, so a real final output can be shown as not published.
7. `NO_FUTURE_CONTENT_RUN` truth is incomplete: browser discovery only includes clients already present in upcoming runs, while the background pass globally limits to 25 runs and can misclassify unprocessed/preparation-failed clients as having no future run.

Also: PR #455 is behind current main and must be reconciled after fixes. Strengthen the Econofoods acceptance fixture so it executes Microsoft event -> run -> guideline, rather than starting from a pre-supplied run. Fresh focused/full verification and a fresh green Vercel are required on the corrected SHA.

### #451 / PR #454 — correction requirements remain

The existing five blockers remain authoritative:
1. fix the TypeScript/Vercel build failure;
2. do not broaden global `public.is_admin()` to service role; scope automatic Microsoft authority narrowly with the required explicit grant;
3. add bounded automatic failed-source retry/cooldown/exhaustion and truthful degraded/failed terminal state;
4. remove the 100-asset Meta inventory truncation and prove >100;
5. expose durable Meta failed/retrying/recovery truth rather than hard-coded `retrying: false`.

Add the #453 audit finding to the same correction pass: a crashed automatic apply left in `applying` must have a safe resume/recovery path. Reconcile the shared `background-worker/index.ts` only after #455's corrected code is accepted/merged, unless the supervisor explicitly coordinates an earlier rebase.

### Exact next supervisor sequence

1. **CA MANUAL 02** fixes all seven #455 blockers on the existing branch/PR, reconciles current main, reruns required verification and stops on a new pushed SHA with fresh Vercel evidence.
2. Supervisor refetches/reviews that exact #455 SHA. Merge routine code only if clean; do not cross migration/deploy/scheduler/OneDrive/provider/data gates.
3. Reconcile **CA MANUAL 01** / #454 against the accepted #455 shared background-worker state and current main; fix the five existing blockers plus the crashed-`applying` resume gap; require fresh green Vercel.
4. Supervisor reviews the exact new #454 SHA.
5. Only after both code lanes are accepted, present CA the protected production activation sequence. First live acceptance must prove Econofoods readiness + exact Microsoft reconciliation + truthful Meta fleet freshness, not merely successful deployment.

Full technical reviews are durable on PR #455, Issue #450, Issue #451/#453 and supervisor Issue #381. CA should receive only the short manual-agent continuation prompts.


## NEW CHAT BOOTSTRAP — 21 September 2026, 11:36 SAST

**This is the canonical starting point for the next CG Dynamics supervisor chat. Refetch live GitHub before consequential action.**

### P0 today

CA's P0 is:
1. **#450 Content Production Autopilot** — guidelines already prepared for upcoming runs/months, staff primarily review/change through ChatGPT/Dynamics, exact per-video OneDrive working/final mappings, raw-upload truth and edit readiness.
2. **#451 Daily Dynamics Freshness** — Microsoft/Teams/Planner/Outlook + Meta fresh automatically before staff work, with truthful PASS/PARTIAL/STALE/FAILED/UNAVAILABLE and bounded recovery.

### Manual ownership

**CA MANUAL 02 — #450 / PR #455**
- branch: `feat/450-content-production-autopilot`
- head at checkpoint: `9ebe22c28bd3ae88df8e0928517057437bf4a6f0`
- state: **IMPLEMENTATION COMPLETE / AWAITING SUPERVISOR CODE REVIEW**
- open/mergeable at checkpoint.
- Review the actual PR diff before accepting the agent report.
- Reported scope: auto-ensure run/guideline, rolling drafts, eight audited MCP guideline actions, configured short-code-only folder naming, per-video production + portal identity, raw/edit-readiness derivation, Content Operations readiness, background `content_autopilot` job, Econofoods fixture.
- Autonomous audit #452 is complete and should be read during review. It identified the Microsoft-owned event ensure gap, existing-authority reuse, #454 background-worker overlap, #438 Content Guideline UI overlap, and protected OneDrive/calendar identity gates.
- Protected activation after code acceptance remains CA-only: migration `20260921090000_content_production_autopilot.sql`, `cg-dynamics-mcp` deploy + connector refresh, `background-worker` deploy/job enablement, automatic AI-generation decision, OneDrive production rollout/tokens/writes, Econofoods exact short-code + mapping live acceptance.

**CA MANUAL 01 — #451 / PR #454**
- branch: `feat/451-daily-dynamics-freshness`
- head at checkpoint: `10d6a986e2dc5f9da5e6268b0cc198b15f6abc2d`
- state: **SUPERVISOR REVIEW / CORRECTION PASS REQUIRED**
- same branch/PR only.
- Latest supervisor review on #451/PR #454 is authoritative.
- Five blockers:
  1. Vercel preview RED: deployment `dpl_HQN9J7rKupJ3P2zGrPnx4srZY1de`, `lint_or_type_error`, `npm run build` exit 2.
  2. Migration `20260921120000_daily_dynamics_service_reconciliation.sql` must NOT redefine global `public.is_admin()` for service role; scope service authority only to Microsoft automatic apply + explicit required EXECUTE grant.
  3. System Microsoft job can loop forever after a failed required source; add bounded auto retry/cooldown/exhaustion and truthful degraded/failed terminal state.
  4. Meta fleet discovery is hard-capped at 100 assets; fully page inventory and test >100.
  5. Meta retry/failure truth is incomplete: `retrying: false` is hard-coded and failed count is omitted; derive from durable batch/checkpoint state.
- After fixes: reconcile current main, rerun suites/build/lint/diff and require fresh green Vercel.
- Authenticated desktop/mobile UI acceptance remains outstanding.
- No migration/deploy/secret/cron/live reconciliation/provider change is authorised yet.

### Autonomous support

- **#452** audit support for #450: COMPLETE. Read its concrete audit comment; no code/branch/production action.
- **#453** audit support for #451: first Poolside route failed by request-limit; rerouted to `/oc /nvidia`. Action run `35583400106` was IN_PROGRESS at 11:36 SAST. Audit-only; must not modify code.
- Scheduled OpenCode free-primary route has demonstrated provider health, but recent scheduled runs often produced no product SHA. Do not equate workflow success with product progress.

### Completed / paused

- #448 / PR #449 research-source governance: COMPLETE / MERGED at `d9143930933a8647f7d1bddca84a61ca1b59331e`.
- #442 baseline reconciliation: PAUSED; preserve `fix/442-main-suite-baseline`.
- #437 / PR #438 Creative Intelligence: code accepted previously, but authenticated UI acceptance + current-main reconciliation remain. It overlaps the Content Guideline surface, so coordinate carefully with #450.
- #435 Google Ads code merged; production activation remains separately protected.
- Client Portal / Brand Hub production migration/mapping/enablement remains separately protected.

### Locked authorities

- `monthly_deliverables` is canonical Client Schedule truth.
- one canonical Content Guideline per real Content Run.
- a real Content Run may cover several future months.
- never fabricate a run when no future real run exists.
- use configured client short code only; never infer from display name.
- canonical production path:
  `Clients/<Client>/Videos/<YYYY>/<YYYY_MM_MON>/<YYYY_MM_<SHORT_CODE>_VIDEO_<XX>>`
- client portal boundary:
  `Clients/<Client>/A_ClientPortal_<ClientSlug>/Brand Identity|Graphic Design|Video`
- raw internal production storage is never client-visible.
- live Microsoft remains freshness authority for Microsoft-backed work during coexistence.
- no second Content system, Client Schedule, sync authority, Marketing Library or file tracker.

### Exact next supervisor sequence

1. Refetch `main`, PR #455, PR #454, #453.
2. **Review PR #455 first**; it is CA's highest operational priority.
3. If #455 is clean, merge routine code only; do not cross its protected production gates.
4. Reconcile #454's shared `background-worker/index.ts` carefully after #455 merge, or require Manual 01 to rebase during its correction pass.
5. Review the next #454 SHA only after all five blockers are fixed, branch is current and Vercel is green.
6. Incorporate #453 autonomous audit findings when they land.
7. Then present CA the exact protected activation sequence needed to make the P0 genuinely live today.
8. First controlled live acceptance must prove Econofoods content readiness + Microsoft exact reconciliation + Meta freshness truth, not merely deployment success.

### Communication

Full coding specs/reviews go into GitHub first. CA receives only tiny prompts naming **CA MANUAL AGENT 01** or **CA MANUAL AGENT 02**. Never accept an agent's prose report without refetching GitHub/diff/checks.


## CURRENT OVERRIDE — 21 September 2026, P0 TODAY

This section supersedes the older manual-lane snapshot below. Refetch live GitHub + #381 + Control Centre before consequential action.

### CA P0 priority: Content Production Autopilot + daily freshness

CA has explicitly reprioritised today around getting the content-production operating chain dependable and automatically fresh.

- **CA MANUAL 02 owns Issue #450 / `feat/450-content-production-autopilot`.** This is the highest-priority content lane: exact Outlook/CG Calendar -> Content Run identity, automatic canonical draft Content Guideline creation, review-ready multi-month AI content, same-client schedule linkage, canonical internal per-video production folders, Client Portal Video final-output mapping, raw-upload verification, edit-readiness state, and narrow audited Assistant/MCP actions so staff can review/change through ChatGPT instead of backend fallbacks.
- **CA MANUAL 01 owns Issue #451 / `feat/451-daily-dynamics-freshness`.** This lane makes Microsoft/Teams/Planner/Outlook and Meta fresh automatically in the normal operating cycle, with durable success/failure evidence, bounded recovery, exact-ID reconciliation and no fake-zero/stale-as-current behavior.
- **Issue #448 / PR #449 is COMPLETE / MERGED** at `d9143930933a8647f7d1bddca84a61ca1b59331e`. Research-source freshness/governance is now on `main`; no protected gate was crossed. Manual 02 remains fully assigned to #450.
- **Issue #442 is PAUSED.** Preserve `fix/442-main-suite-baseline` for later. Manual 01 capacity is released from it until #451 clears.
- Shared MCP ownership while both P0 lanes run: #450 owns `supabase/functions/cg-dynamics-mcp/index.ts`, `toolCatalog.ts` and content Assistant skill/action files. #451 must not edit those concurrently; any tiny MCP follow-up is deferred for supervisor reconciliation after #450 lands.
- Existing authorities remain locked: `monthly_deliverables` is Client Schedule truth; one canonical Content Guideline per real Content Run; Content Runs may cover multiple future months; canonical OneDrive naming uses configured client short code only; raw internal production storage is never exposed to clients; live Microsoft remains freshness authority for Microsoft-backed work during coexistence.
- #325 + #327 remain umbrella authorities. #450 and #451 are execution lanes, not replacements.
- Routine green code-only merges may proceed under supervisor review. Production migrations/data reconciliation, Edge Function deploys, scheduler/cron activation, secrets/permissions, provider configuration, OneDrive write rollout and other protected production actions still require CA approval at the exact gate.

### Today acceptance target

Before calling this P0 closed:
1. upcoming real Content Runs already have review-ready draft guidelines rather than blank/manual setup;
2. staff can review/change guideline content through governed ChatGPT/Dynamics actions;
3. each video resolves a canonical internal production folder plus client-safe final-output destination when mappings are complete;
4. raw-upload state truthfully drives edit readiness;
5. Microsoft/Teams/Outlook and Meta freshness run automatically and expose PASS/PARTIAL/STALE/FAILED rather than relying on a human Sync click;
6. Econofoods 23 Sep failure class is covered by deterministic acceptance and then used as the first controlled live acceptance case after code review;
7. no Client Schedule rewrite, cross-client guessing, fake run, fake zero, or destructive OneDrive cleanup is introduced.

## CURRENT OVERRIDE — 20 September 2026, morning SAST

This section supersedes older lane snapshots below. Refetch live GitHub + #381 before consequential action.

### Marketing Intelligence / manual coding state

- `main` includes merged PR #439 at `cdef879b9252dd0808da742debb8e4ba4cba644b`: first-pack audience-lifecycle Marketing Library bridge complete, 9 eligible / 3 excluded, fail-closed source eligibility, all entries still `needs_review` + metadata-reference-only. No Library activation or production mutation occurred.
- PR #438 / Issue #437 is code-accepted at `b346e8390c4d0c26fb664e1f6078fa119edce9ff`; merge is gated only on authenticated desktop/mobile staff-session UI acceptance. CA MANUAL 01 was released from #437 and now owns #435.
- Issue #435 Phase 1 is code-complete and merged via PR #440 at `d1f1c7cf744f03425c7c86f4864177c24e4ca864`. `get_google_ads_audit` is company-admin-only/read-only with pre-query exact-client scoping. Edge deployment + authenticated live audit remain protected gates requiring explicit CA approval. CA MANUAL 01 now owns Issue #442 / `fix/442-main-suite-baseline` for three bounded non-Marketing test-baseline failures.
- Issue #441 is complete and merged via PR #443 at `87aee71be7e86ddd837c53b2f93edd29405f808c`; Issue #444 is complete via PR #445 at `1f130e637ce8a79efc4aa570a4b290a248f286cd`; Issue #446 is complete via PR #447 at `ba486eb56d8f4cf6154f763df50149111180073a`, giving one read-only unified admin Registration preview over the seed manifest + #426/#441/#444 bridges with exact-id conflict handling and classifier-derived registration readiness. No Library activation occurred. CA MANUAL 02 now owns overnight Issue #448 / `feat/448-research-source-governance` for source freshness metadata, conflict variants, governance queues/UI, real-data audit and hardening; still no writes or protected actions.
- #426 remains the research/integration umbrella. Later v0.2-v0.8 research must reuse the existing Marketing Library registration/review authority; no second Library or direct activation path.
- Private Mission Control / R1m strategy remains outside CG Dynamics product knowledge.


## CURRENT OVERRIDE — 18 September 2026, 16:35 SAST

This section supersedes conflicting current-state snapshots later in this file. Preserve the stable operating rules below, but refetch #381 and live GitHub before acting.

### Website Growth / owned-system doctrine

CA's standing business objective is to own as much of the CG website/client operating system as practical and avoid recreating Wix-style recurring per-client subscription economics.

Approved recurring foundations:
- shared Vercel Pro team, base subscription only;
- existing Supabase Pro organisation;
- unavoidable normal domain/email costs.

Verified Vercel state on 18 Sep 2026:
- team `cg-dynamics-projects` / `team_SK5vvWv1AIXFkPNV8JFYL205` is Pro;
- current invoice target is the single $20 Pro base subscription;
- metered infrastructure shown so far is covered by included Pro usage credit;
- automatic private-repository committer paid Developer seats are OFF/manual approval;
- no routine Vercel top-up, premium add-on or additional recurring SaaS is authorised.

Default architecture rule:
- build/reuse CG-owned capability inside Dynamics, Website Editor, current Postgres/Supabase, GitHub and client-site code;
- prefer already-paid capability and suitable open source;
- any new recurring service requires a proven production gap, build-vs-buy/ops comparison and CA's explicit approval;
- target marginal software cost per client trending downward as the fleet grows.

Do not promise that taxes, explicitly purchased domains/add-ons/seats or unbounded overage can never bill. Prevent those by configuration and approval gates rather than by assumption.

### Website Growth authority and order

Primary umbrella: `CGProductionHouse/cg-website-editor#27`.
Engineering authority: Website Editor PR #28 plus its Website Growth docs.
Website Builder master continuation: Website Editor Issue #22, CURRENT OVERRIDE section.

Core sequence:
1. exact identity/contracts;
2. genuine reporting;
3. durable enquiry + client mail;
4. performance/content freshness;
5. organic discovery;
6. quality feedback;
7. repeatability/recovery/fleet.

Do not duplicate reporting, lead, CRM, queue or website-registry authorities.

### M1 Website Performance — current production state

Completed under CA's explicit approval:
- Website Editor PR #18 merged/deployed.
- Dynamics PR #356 merged/deployed.
- exact Red Oak production mapping verified:
  - Website ID `7`
  - Dynamics client `cdb11a82-339e-4b46-9b09-bde1a23efeaf`
  - repo `CGProductionHouse/redoak-website`
  - Vercel project `prj_KrJjrXLqyO3Y3kHTh1qSwYBvFbe6`
  - team `team_SK5vvWv1AIXFkPNV8JFYL205`
  - canonical host `www.redoakgroup.co.za`
- production migration `website_report_snapshots` applied; Supabase records version `20260918130449`.
- Edge Function `website-performance-report` ACTIVE v1 with JWT verification enabled.
- Red Oak reporting PR #3 reconciled and merged at `489c1202fb2cd1d1311713172c01c2a4c249f8bc`.
- production deployment `dpl_BhuNPtULJNDb7ig8iWtPi5yFLSxr` READY.
- canonical Red Oak host returned HTTP 200 from that deployment.
- immediate runtime scan was clean.
- truthful production analytics start is **2026-09-18**. Never backdate from preview evidence.

Current blocker:
- Codex verified the locally authenticated Vercel CLI credential can manage the projects;
- Vercel Web Analytics rejects that credential with HTTP 403 `invalidToken`;
- therefore it cannot be used as `WEBSITE_REPORTING_VERCEL_TOKEN`;
- Codex stopped correctly and changed **no production configuration**.

Next M1 gate:
1. obtain a supported Vercel Web Analytics/API token through Vercel's supported token flow;
2. configure the exact server-only Website Editor reporting env + Dynamics Edge Function secrets;
3. do not expose secret values in GitHub/chat;
4. redeploy Website Editor if the environment change requires it;
5. prove provider access;
6. use a truthful closed production period only;
7. staff preview -> save -> review -> publish -> exact-client portal isolation using the same snapshot/revision.

M1 is not production-accepted until that proof closes. Do not invent historic traffic or weaken the adapter to work around the token blocker.

### M2 contract still locked

Issue #405 owns canonical enquiries/email/quality. Website Editor #19 owns first-party contact actions.

Rules:
- contact action != enquiry;
- a contact may create multiple legitimate enquiries;
- browser never chooses client, recipient, environment, role or synthetic authority;
- versioned stable form keys;
- one Dynamics-owned PostgreSQL transaction commits enquiry + approved notification jobs + one canonical reporting event;
- durable outbox/retry/reconciliation;
- provider delivery status is not proof of inbox/read;
- no blind provider failover;
- exact tenant/RLS/idempotency/concurrency/crash-recovery proof;
- client email is mandatory, portal optional, client owns sales follow-up.

### Coding-agent workflow reminder

GitHub must contain the real brief before CA receives a coding prompt.

Use:
```text
CA MANUAL AGENT

Read AGENTS.md and current GitHub truth first.
Continue <existing issue/PR/phase>.

Next mission: <one scoped objective>.
Do not touch <held lane if relevant>.

Verify, commit and push only if green.
Return: completed / verification / commit / blockers.
```

Do not paste project history into prompts when GitHub already contains it. One owner per issue/file set. Continue existing branches/PRs. Routine green code-only release flow may continue; production migrations, secrets/credentials, provider permission changes, purchases/spend, DNS, destructive actions, external sends and Commerce/payment/stock remain protected gates unless CA explicitly approves that exact action.

Last updated: 18 September 2026 SAST  
Status: CURRENT operating handover for ChatGPT coordinators, supervisors and coding agents  
Repository: `CGProductionHouse/CG-Dynamics`

## Purpose

This is the durable handover for continuing CG Dynamics operations without depending on private chat history.

A fresh ChatGPT/Codex/OpenCode session should be able to continue from GitHub + the shared Control Centre without asking CA to repeat project history, agent ownership, model routing, protected gates or current product state.

The minimum human prompt should be:

```text
Continue CG Dynamics ops from current GitHub truth.
```

That is enough only if the agent follows the bootstrap below.

## Continuous continuity maintenance — mandatory

This handover is a **living operational file**, not a one-time checkpoint.

Every future ChatGPT coordinator/new chat that materially changes CG Dynamics state must keep this file current as part of the same operating cycle.

Material changes include:

- a manual or autonomous owner starts/stops;
- a queued lane becomes active;
- a PR is created, materially advances, merges or is abandoned;
- production deployment state changes;
- a protected gate is crossed or newly introduced;
- a product/data authority changes;
- model/provider routing changes materially;
- a major rollout completes;
- a new integration lane becomes part of normal operations;
- the current lane snapshot becomes materially misleading.

Required write-back sequence after a material change:

1. update the owning issue/PR;
2. update Issue #381 if cross-lane state changed;
3. update the Google Control Centre / Dispatch Queue;
4. update this handover when its operating rules or current lane snapshot changed;
5. only then consider the handoff complete.

Do **not** wait for CA to remind the coordinator to update continuity.

Before a long chat ends, context becomes crowded, a new chat is likely, or CA says to continue in another chat:

1. refetch #381 + the Control Centre + current GitHub;
2. reconcile active/queued/completed ownership;
3. update this handover with any material drift;
4. leave a durable GitHub handoff;
5. ensure the next chat can continue from the one-line prompt without reconstructing history from conversation memory.

The hourly Supervisor must also check for **handover drift**. If the handover's operating rules or current-lane snapshot are materially stale, it should update them as routine docs-only ops when safe, or leave an explicit #381 handover-update requirement. It should not rewrite the file every hour when nothing material changed.

Keep this file concise and operational. Do not turn it into a chat transcript or append every minor event. Preserve stable rules; refresh the current-state sections.

Never put passwords, secrets, tokens, private credentials or generated credential lists in this handover.

## 1. Fresh-chat bootstrap, mandatory before acting

Do these in order:

1. Identify the exact repo: `CGProductionHouse/CG-Dynamics`.
2. Read `AGENTS.md`.
3. Read this file.
4. Read `docs/ai-workforce/MASTER-AI-TOOLS-AND-WORKFLOW.md`.
5. Read `docs/ai-workforce/AUTONOMOUS-CODING-ORCHESTRATION.md`.
6. Read GitHub Issue #381, **CG Systems Supervisor live report**, including the newest comments.
7. Read the Google Sheet **CG AI Model and Agent Control Centre**.
8. Refetch current GitHub `main`, open PRs, relevant issues, latest comments and GitHub Actions runs.
9. Reconcile GitHub state against the Control Centre before dispatching, coding, merging or reporting.
10. Only then choose the next action.

Do not ask CA to repeat information that can be recovered from these sources.

Do not use a chat summary, stale prompt or historical SHA as current truth when live GitHub/tracker state is available.

## 2. Control plane

### GitHub

GitHub is the durable source of truth for:

- committed code on `main`;
- active branch/PR ownership;
- issue scope and product decisions;
- implementation evidence;
- tests/checks;
- blockers;
- production rollout evidence;
- durable handoffs.

Primary supervisor thread:

- Issue #381: `CG Systems Supervisor live report`

The supervisor issue is not a replacement for owning issues/PRs. It is the cross-lane control-plane ledger.

### Google Control Centre

Spreadsheet:

- Name: **CG AI Model and Agent Control Centre**
- Spreadsheet ID: `1TC0qBhVoNQLSmd_jXHWT444Kl7s9qkhNv_2dG_zBvIg`

Important tabs:

- Dashboard
- Models
- Provider Accounts
- Projects
- Dispatch Queue
- Run Log
- Routing Rules

Interpretation:

- GitHub = code/product truth.
- Control Centre = worker ownership, capacity, routing and dispatch truth.

Both must agree.

If they disagree, refetch GitHub and reconcile the tracker. Never dispatch from stale tracker state.

## 3. Supervisor

Active automation:

- Title: **CG Dynamics Supervisor**
- Schedule: hourly
- Timezone: `Africa/Johannesburg`
- Automation ID: `6a9ef983c0548191be8a210d4cd73e56`

Every run must:

1. read Issue #381;
2. read Dashboard, Dispatch Queue, Run Log and Routing Rules;
3. refetch current main, relevant issues/PRs/comments and current workflow runs;
4. reconcile tracker vs GitHub;
5. register any CA manual coding agent that appeared since the prior run;
6. reserve that issue/file set from autonomous workers;
7. update completed/failed lanes with durable PR/SHA/run evidence;
8. release freed capacity correctly;
9. route safe unowned work to available approved capacity;
10. update #381 when owner, SHA, run, blocker, gate, production state or material direction changes.

The supervisor is an execution coordinator, not a reporting-only bot.

## 4. Ownership and anti-collision rules

One implementation owner per issue/file set.

Manual CA ownership always wins.

When CA launches a manual Codex/coding agent:

- immediately register it in Dispatch Queue;
- record issue/PR/branch ownership;
- reserve overlapping files from autonomous workers;
- do not dispatch a second agent into the same lane;
- when it finishes, record the PR/SHA/result and release capacity.

Continue an existing branch/PR when it already owns the work.

Do not create:

- duplicate PRs for the same mission;
- shadow implementations;
- parallel redesigns;
- a second data authority;
- a second client/task/calendar/strategy/store system when canonical truth already exists.

An old open PR is not automatically an active worker lane. Tracker + newest issue/PR comments decide whether it is active, parked, stale or superseded.

## 5. Model and worker routing

Always inspect current provider/model availability before relying on a hard-coded model.

Current preferred autonomous pattern:

1. OpenCode free primary, normally `opencode/nemotron-3-ultra-free`.
2. NVIDIA free/independent fallback, normally the current Nemotron Lightning route.
3. The separate CA-key NVIDIA bucket may run a second non-overlapping lane when healthy.

Hard rules:

- never spend OpenCode Zen credits for routine autonomous CG Dynamics work;
- do not use OpenCode Go unless CA explicitly chooses it;
- do not repeatedly hammer a rate-limited or broken lane;
- on provider/quota failure, reroute once to another approved independent free lane or stop cleanly;
- durable GitHub state is the memory between model attempts.

Manual Codex/ChatGPT agents may work in parallel with autonomous workers only on non-overlapping ownership.

## 6. Coding-agent prompt standard

GitHub should contain the real brief.

Manual prompts should be short.

Preferred pattern:

```text
CA MANUAL AGENT

Repo: CGProductionHouse/CG-Dynamics

Read AGENTS.md, the owning issue and current PR/main. GitHub is the full brief.

Own <issue/PR> only. Continue the existing lane. Verify, commit and push only if green.

Return completed / verification / commit / blockers.
```

Do not paste the entire project history into coding prompts when GitHub already contains it.

If the coordinator discovers a new requirement, update the owning GitHub issue first, update the Control Centre ownership/state, then give CA the short prompt.

## 7. Durable delivery standard

Do not call workflow green "progress" by itself.

A meaningful implementation checkpoint should normally include:

- pushed commit;
- owning PR or durable issue handoff;
- focused tests;
- build;
- changed-file lint where relevant;
- diff review;
- browser/role/device acceptance for user-facing work;
- exact production evidence if deployed.

Long-running agents should push an early durable checkpoint.

If an agent loops for roughly 15 to 20 minutes without durable output, narrow it to one small checkpoint instead of burning capacity.

## 8. Routine ops authority vs protected gates

CA delegated routine green ops merge/deploy authority to the coordinator on 18 September 2026.

Therefore routine, verified, non-protected code lanes do not need to stop only to ask CA "may I merge?".

Routine coordinator authority includes:

- mark ready;
- merge a clean reviewed PR;
- allow normal Vercel production deploy;
- verify production;
- update issues/tracker;
- fix a bounded regression if normal code-only scope and verification stay clean.

Still stop for protected gates unless CA separately and explicitly approved that exact action:

- production SQL/schema/data migrations;
- production reconciliation apply that mutates canonical business data;
- secrets/credentials;
- auth/provider permission changes;
- provider consent/submission;
- spend/purchases;
- payments/debit orders;
- DNS/domain ownership changes;
- external email/messages/publishing/sends;
- destructive data operations;
- destructive OneDrive actions;
- broad permission changes;
- CG Hours production setup/identity mapping/secrets;
- first real CG Hours live draft write.

Important distinction: a migration file in Git is not permission to apply it.

## Vercel infrastructure truth

As of 18 September 2026, Vercel team `cg-dynamics-projects` is on **Pro**.

The prior Hobby commercial-plan concern and the >100 daily deployment preview quota blocker are no longer current blockers.

Do not auto-upgrade or change spend/config further without a separate need. Provider credentials, DNS, migrations and other protected gates remain independent from the Vercel plan.

## 9. Current product authorities that must not drift

### Client Schedule

`monthly_deliverables` is canonical Client Schedule truth.

Do not replace it with:

- Planner;
- a second calendar;
- a strategy-specific schedule;
- OneDrive folder names.

Client Portal Plan/Calendar must reuse this truth.

### Monthly client strategy

Issue #391 established the canonical client+month strategy backend.

Client-visible strategy should be:

- exact client;
- exact selected month;
- published client-safe projection only.

Staff workflow is:

- meaningful baseline seed;
- staff review/amend;
- approve;
- explicit publish.

Never auto-publish.

### OneDrive naming

Canonical production folder authority:

```text
Clients/<Client>/Videos/<YYYY>/<YYYY_MM_MON>/<YYYY_MM_CLIENT_VIDEO_XX>
```

Use configured client short code and canonical helpers.

Never guess:

- short code;
- month label;
- sequence;
- separator/casing;
- a near-match folder.

If required naming context is missing, stop and surface the missing value.

Authority:

- `docs/onedrive-naming-authority.md`
- `src/lib/onedriveCanonical.ts`
- Issue #224 naming correction.

### Client Portal Library

Issue #396 owns the client-safe OneDrive library.

Canonical boundary:

```text
Clients/<Client>/A_ClientPortal_<ClientSlug>
```

Client-safe inner categories currently locked:

- Brand Identity
- Graphic Design
- Video
- Photography where relevant

Internal working/source/raw/admin folders stay outside the client-safe boundary.

Client access target is read/view/download only.

No anonymous public share by default.

### Staff Assistant runtime policy

Production Staff Assistant policy is currently:

`2026.09.18-coexistence-naming-3`

It includes the canonical OneDrive naming rule and stop-rather-than-guess behaviour.

Do not trust stale Project Instructions over live `get_my_assistant_bootstrap`.

## 10. Microsoft freshness rule

Issue #327 owns Morning Ops health/reconciliation.

As of 18 September 2026:

- company_admin context/bootstrap is healthy;
- CG Dynamics connector session failure was proven transient;
- Microsoft reconciliation remains stale/degraded;
- a reconciliation preview fetched 6,765 records but `2025 CLIENTS SCHEDULE` hit the 5,000-record safety cap;
- the latest successfully applied reconciliation remains 19 August 2026.

Until a successful reconciliation is applied:

- Microsoft/Planner/Outlook live data is freshness authority for Microsoft-backed work;
- Dynamics mirrors must be treated as stale;
- Dynamics-native work remains valid and must still be read;
- Staff Assistants should flag `SYNC STALE / SYNC FAILED` where relevant.

Do not hide the stale state.

## 11. Current lane snapshot

This section is an orientation snapshot only. Refetch GitHub + tracker before acting.

### Active manual coding

**Website Editor #19 first-party contact actions**

- Owner: CA manual coding agent 1.
- Current Website Editor `main` includes merged reporting PR #18.
- Own only privacy-minimised first-party contact actions: WhatsApp, phone, email, directions, booking and other explicitly allowlisted CTA interactions.
- Confirmed enquiry count remains canonical Dynamics #405 truth; never count browser form clicks/submits as accepted enquiries.
- Exact Website identity only; no fuzzy IDs, no browser-held Builder/reporting secret, no arbitrary referrer query data or lead PII.
- Add strict validation/rate limiting, half-open date-range reads, preview/synthetic exclusion and normalized V1 report integration.
- No real client-site configuration, production schema apply, Commerce/Yoco or #405 overlap.

**#405 Website Growth M2A canonical lead transaction**

- Owner: CA manual coding agent 2.
- Dynamics backend only.
- Read Issue #405 latest comments plus Website Editor #27 and PR #28 engineering authority before coding.
- Own the canonical enquiry vs contact identity, versioned form schema/stable field contract, tenant-scoped submission key and one PostgreSQL transaction that commits enquiry + approved-recipient delivery jobs + one canonical reporting event.
- Exact Website/client/environment/recipient identity must resolve server-side; browser input is never authority.
- Identical replay returns the same receipt; changed payload with the same key conflicts; no cross-client dedupe by email and no partial acknowledged state.
- Prove RLS/isolation/idempotency/concurrency/crash-recovery semantics.
- A migration/schema implementation may be authored and tested but must not be applied to production.
- Do not touch Website Editor #19 files, live transactional provider/email send, provider secrets/config, production recipient setup, #374 or #335/#336.

### Recently completed production release

**#395 / PR #398 Client Plan + canonical monthly strategy**

- No active coding owner.
- Vercel Pro removed the previous daily deployment quota blocker.
- Final reconciled preview head `7e14bd267c7dee5933135f52b9c4220098944e86` passed on deployment `dpl_LaWzKorAm9JGdHme5NA5TRnpbxHT`.
- PR #398 merged at `7d9c88b2b37ec7a9fb7c3c5024642ed74aecfaf1`.
- Production deployment `dpl_43ZZewHxKiP1hbqLHJtYecguCQKM` is READY on CG Dynamics production aliases.
- Immediate runtime error scan was clean.
- Current-month Plan state + canonical #391 monthly strategy review/approve/publish workflow is production live.
- #395 is closed complete.
- No migration, production strategy seed/publish or provider/config action occurred during release.

### Protected activation gates

**#396 Client Portal Library**

- No active coding owner. Manual agent 1 capacity is released.
- PR #410 merged at `2ec39b4719f7a1fbd77a8ef780f16f4ba6c6bfa8`; production deployment `dpl_6ouWTaweBLu5YVAxSN1ydn4qwoGv` READY.
- Production code includes metadata-first Category -> Year -> Month -> Files browsing, lazy/on-demand month data, viewport-lazy thumbnails, opaque short-lived Dynamics access grants, bounded HTTP Range/206 streaming and Dynamics-native MP4 playback.
- Exact-client/library/drive/category/date checks remain mandatory on every access; OneDrive/Graph origins and durable provider IDs remain hidden from clients.
- #396 remains open only for protected production activation/mapping.
- Reuse the exact `A_ClientPortal_<ClientSlug>` boundary and durable OneDrive item IDs; never fuzzy filename identity.
- Still NOT executed: production migration, exact production library mapping, library enablement, real OneDrive share/permission, file move/copy/rename, folder discovery or first-client activation.
- Do not dispatch further implementation here unless activation exposes a reproducible defect.

**Website Growth #27 M1 reporting activation**

- No active coding owner.
- Website Editor PR #18 merged at `59f720998fdec117172ea01bc2f2b2e486e5c5f2`; production deployment `dpl_GcRQV3yZxZd1tN2E8ffTaYrKkzZb` READY.
- Dynamics PR #356 merged at `23b436f23c2b19db334063045557a80a82999d63`; production deployment `dpl_DTQjJE25FWqMv1JbsMrYhzLvpwZm` READY.
- Immediate runtime-error scans are clean in both projects.
- Code is production-deployed but reporting remains intentionally unconfigured/fail-closed.
- Still NOT executed: exact production Website ID + canonical host verification, Dynamics website-snapshot migration apply, `website-performance-report` Edge Function deployment, one-to-one mapping/tokens, real staff preview-save-review-publish acceptance and exact-client portal proof.
- Do not call M1 production-accepted until those protected gates pass.

**#404 + CG-Hours #7 Client Registry Bridge**

- No active coding owner. Manual agent 2 capacity is released.
- Dynamics PR #411 merged at `a2c0cacf4b06775eff9c47dfea919ab9106386a2`; production deployment `dpl_8h5ZbCV2tUoYhMEUQ9teP4M1Adqw` READY.
- CG-Hours PR #8 merged at `58553f5170d68a8fbfae0ac3ae6e725ca91923a9`.
- CG-Hours hotfix PR #9 merged at `84a1dbcf30aa6f45aff1345008ed6028dde16cdc`; production deployment `dpl_HYVzaxLXr7xHvfy7LtmpGkxZEd7S` READY.
- Immediate runtime-error scans are clean in both projects.
- Bridge code is on production main but remains intentionally OFF/inert. Disabled production does not query the missing outbox table, show registry UI, or run bridge work.
- #404 and CG-Hours #7 remain open only as protected activation/runbook authorities.
- Exact ordered activation and kill-switch procedure: `docs/ops/CG-HOURS-CLIENT-REGISTRY-BRIDGE-ACTIVATION.md`.
- Still NOT executed: Dynamics migration, bridge function deployment/secret, CG-Hours migration, Hours server config/enable flag, production sync or JFJ Electrical / Neshora Oxygen / VCS Cleaning Solutions backfill.
- Do not dispatch further implementation here unless activation exposes a reproducible defect.

Goal:

```text
CG Hours client create
-> durable outbox/retry
-> authenticated Dynamics ensure-client action
-> exact UUID mapping
```

Rules:

- no fuzzy name matching;
- no guessed Dynamics short_code;
- Dynamics becomes canonical identity/name authority after mapping;
- initial controlled backfill: JFJ Electrical, Neshora Oxygen, VCS Cleaning Solutions;
- production migration/data backfill remains CA-gated.

### Additional active autonomous lane

**Website Editor PR #28 engineering-authority reconcile**

- Owner: CA's validated OpenCode free agent.
- Existing PR #28 only; docs-only current-main reconcile.
- Preserve the four accepted Website Growth engineering authority documents.
- Update stale Hobby/daily-quota wording to current verified Vercel Pro truth while preserving the no-unapproved-recurring-SaaS cost doctrine.
- No application code, schema, runtime config, provider setup, DNS or production behaviour changes.

### Queued / ready to dispatch

Do not dispatch overlapping work into Website Editor #19, Dynamics #405 M2A or Website Editor PR #28 while those owners remain active. Re-read the Control Centre for any other safe unowned work.

### Recently completed production rollout

**#402 Client profile rollout**

- issue closed complete;
- 37 active portal mappings;
- final continuation created 35 accounts;
- 0 skipped;
- 0 failed;
- 0 remaining;
- 12 pre-existing users/accounts preserved, including Red Oak, AV Event Life, Braize and staff/admin accounts;
- exact-client isolation remained intact;
- no credentials were exposed or collected;
- no further code/migration/deploy was required for the final batch.

### Parked future

**#400 Client Billing Hub**

Future:

- Xero account/invoice projection;
- payment method;
- debit order;
- stronger user-specific client auth;
- audited admin support access.

Do not let #400 block current client portal rollout.

## 12. Client access rollout rules

Phase 1 client access is intentionally simple.

Current foundation:

- username or email login;
- supported server-side provisioning;
- exact client profile mapping;
- admin Client Access workspace;
- predictable Phase 1 starter credential convention approved by CA;
- no plaintext credential persistence.

Do not expose the starter password in automated browser inspection.

Provision/reset responses no longer return the password.

The admin UI can deliberately derive/copy login details only when a human/admin explicitly clicks the copy action.

Do not publish credential lists to GitHub, tracker or logs.

## 13. CG Hours integration rules

CG Hours ChatGPT logging remains draft-only.

Allowed after full production setup:

- authenticated staff member reads own allowed context;
- creates own draft hours;
- creates own draft travel/km;
- corrects/removes own draft records;
- success only after a durable CG Hours record ID/receipt.

Never allow ChatGPT to:

- submit a week;
- approve;
- reopen submitted work;
- run payroll;
- act as another staff member.

CG Hours production migration, mapping, secrets/config and first real live draft write remain protected gates unless CA explicitly approves them.

Do not let the new client-registry bridge overlap the Staff Logger PR/files.

## 14. Merge/deploy procedure for a routine green lane

Before merge:

1. refetch PR;
2. verify correct owner/scope;
3. verify current head;
4. verify mergeability;
5. inspect relevant checks/build/preview;
6. ensure no protected gate;
7. ensure no active overlapping writer.

Then:

1. mark ready if appropriate;
2. merge;
3. verify production deployment;
4. check runtime errors;
5. smoke the relevant production route;
6. update owning issue;
7. update Issue #381;
8. update Dispatch Queue with production evidence;
9. release capacity.

If the preview fails, fix it before merge. Do not wave through a red preview.

## 15. How to use free model capacity well

The supervisor should keep useful capacity moving, but only on safe unowned work.

Preferred sequence:

1. finish an existing owned PR if ownership is still active;
2. pick the highest-value queued safe lane;
3. reserve it in tracker before dispatch;
4. dispatch one owner;
5. require early durable evidence;
6. if failed with no checkpoint, diagnose before retry;
7. release or retain ownership explicitly.

Do not burn model capacity on:

- healthy status checks;
- a lane waiting for CA/provider permissions;
- a protected migration gate;
- a stale duplicate task;
- redesigning something already approved;
- broad retries after repeated no-output failure.

## 16. New-chat response standard

When CA says something like:

```text
Continue CG Dynamics ops.
```

the coordinator should not ask "what were we working on?"

It should:

1. recover current state using this handover;
2. read #381 + tracker;
3. inspect current active/manual lanes;
4. inspect freed capacity;
5. report only material current truth;
6. continue routine safe work automatically;
7. ask CA only for a genuine protected/manual decision.

CA-facing updates should stay compact.

Recommended structure:

```text
CG Dynamics - MASTER STATE
Active:
Moved:
Reliability:
Next:
CA gate:
```

Omit empty sections.

## 17. Control-plane hygiene

Every material handoff must leave durable evidence.

When state changes:

- update owning issue/PR;
- update #381 when cross-lane state changed;
- update Dispatch Queue;
- update this handover whenever its durable rules or current-state snapshot changed;
- include PR/SHA/run/deployment evidence;
- release/retain capacity honestly.

Do not leave a manual agent marked active after it completed.

Do not leave a failed autonomous lane looking healthy.

Do not leave a merged lane queued.

Do not treat old issue comments as current when a newer durable handoff exists.

## 18. Fast recovery checklist

If a future chat feels lost, do not rebuild context from CA's messages.

Run this recovery:

```text
repo -> AGENTS.md -> this handover -> #381 -> Control Centre
-> current main -> open PRs/issues -> current runs -> reconcile -> act
```

That is the CG Dynamics operating system.

A future chat is not finished with a material CG Dynamics handoff until the durable control plane **and this handover** are current.
