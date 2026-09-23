# CG Dynamics Ops Handover

## CURRENT OPERATIONS SNAPSHOT — 23 September 2026, 09:44 SAST

This is the current orientation snapshot and supersedes older dated lane
snapshots retained below as historical evidence. Refetch GitHub, Issue #381 and
the Control Centre before consequential action.

### GitHub and ownership truth

- Issue #494 is owned by CA MANUAL AGENT 01 from main
  `16c0056746eff964fedbbe36bfa8f6dc02e9d56f`. Its isolated implementation adds
  active-client-only package confirmation and fail-closed gold-standard monthly
  strategy authority. The migration remains unapplied; no client package is
  bulk-confirmed. #491/#238 provider work and #492 report publication remain
  separate owned lanes.

- Current runtime-code baseline: `e77d0ce29a5439b99ceaf39694e31a908265c820`, including
  #388 / PR #485 and website-reporting CORS PR #486 after #472 D02 / PR #484.
  Later `main` commits may be docs-only handover updates; always refetch GitHub
  before consequential action.
- #472 is complete and closed. PR #484 is merged; the component-level Meta
  engagement truth code is accepted. Migration
  `20260922154243_meta_post_engagement_truth.sql` remains unapplied and the
  post-#472 Meta functions remain undeployed.
- #388 is code-complete and closed. PR #485 merged at
  `26fa18f8d4c6155a03fead0ce339f9bcc398c631`; the verified
  `AbortError: The signal has been aborted` and narrow request-timeout
  equivalents now use the existing bounded retry/checkpoint path in GitHub.
  Production `meta-sync-worker` is still the pre-#485 deployed package, so the
  resumability fix is not production-live yet.
- #390 remains blocked until the #388 worker change is separately deployed and
  production-accepted. Do not graduate worker lanes before that gate.
- #217's four named stale Hub rows were traced read-only on 22 September. They
  are legacy `teams_import` rows already archived on 7 September and absent
  from `planner_tasks_canonical`; authenticated Hub/Work checks at 375, 390 and
  430px reproduced no overflow. No code PR was warranted. #217 remains open
  only for CA's explicit real production phone confirmation, because the
  durable issue requires that human-device sign-off rather than responsive
  browser emulation alone.
- #437 / PR #438 is code-accepted and Vercel-green at
  `5d7ced5f59d48321853130ee5f90b70eb253e9b8`. Merge remains held only for the
  explicitly required authenticated desktop/mobile staff-session acceptance.
- #377 / PR #380 and #374 / PR #375 remain parked/stalled at their existing
  heads. Do not count green historical previews as current product progress or
  dispatch duplicate writers.
- The Control Centre row that still marks #472 D02 active is stale. GitHub is
  ownership truth until the tracker is corrected.

### Merged code versus production-live behavior

- #450 / PR #455 and #451 / PR #454 are merged. Their approved migrations,
  system identities, independent worker secrets and required Edge functions
  were activated through the recorded protected rollout. The existing minute
  scheduler remains the only scheduler; its cadence and identity are unchanged.
- Microsoft job `40569507-7f78-4e1b-afe0-79b7b06edb4b` completed all six
  required sources with zero pending details, automatic retry count one and no
  automatic failure. No apply row exists and no Microsoft write occurred; the
  last verified mirror remained authoritative.
- Meta fleet checkpoint/freshness recovery is live through the #451 worker.
  Missing evidence remains non-PASS. Red Oak exact Page `117937152934535`
  remains blocked by exact-Page access/re-consent, not by a broad scope change.
- Monthly Strategy Autopilot is live and idempotent on the existing worker
  cycle. Its first daily job succeeded for 56 clients / 112 drafts with zero
  failures. All three Content Autopilot flags remain false and production has
  zero Content Autopilot jobs.
- #425 Meta M2 and #396 / PR #430 Brand Hub code are merged. Meta's later #451
  fleet worker deployment is live; Brand Hub production mapping/activation is
  still protected and incomplete.
- #426's first-pack Marketing Library bridge is merged and available for the
  canonical registration/review workflow. It does not activate sources or
  cards: eligible rows remain `needs_review` and metadata-reference-only.
- #433's implementation-reality audit checkpoint is complete. Later research
  branches remain `needs_review` / `activation_allowed:false` and must reuse the
  existing Marketing Library, strategy and reporting authorities.
- #435's read-only `get_google_ads_audit` action is merged, and the currently
  deployed `cg-dynamics-mcp` contains that action. It remains company-admin
  only, exact-client/date-range scoped and provider-write-free. A documented
  authenticated live audit is still required before calling the production
  acceptance complete.
- Website reporting PR #486 is merged and the corrected
  `website-performance-report` Edge Function is production-live as version 5
  with `verify_jwt=true` and the standard Supabase `x-client-info` CORS header
  allowed. Red Oak still has zero website snapshots and no published report
  linkage. The next gate is an authenticated staff read-only Red Oak preview;
  do not save a snapshot or publish until that preview proves exact Website 7 /
  client identity and acceptable `available` or `partial` data quality.

### Merged but not production-activated

- #388 / PR #485 is merged at
  `26fa18f8d4c6155a03fead0ce339f9bcc398c631`, but production still runs the
  pre-#485 `meta-sync-worker`. Do NOT deploy the current-main worker by itself:
  current main also contains #472 D02 engagement-evidence ingestion, while the
  production `meta_sync_upsert_report_post` and client post projection are still
  the pre-D02 contracts that coerce missing engagement components to zero. The
  safe current-main activation unit is therefore the D02 migration
  `20260922154243_meta_post_engagement_truth.sql` first, then the updated
  `meta-sync-worker` and `meta-sync` functions with their shared dependencies,
  followed by bounded D02 + AbortError production acceptance. A #388-only
  deployment would require a separately reviewed backport onto the deployed
  pre-D02 worker baseline rather than deploying current main.
- TikTok #238 / PR #483 is merged at
  `93b09a89a71e9371b8ba53d704edc486b993aa85`. Its daily-freshness migration
  and functions were activated on 2026-09-23: background-worker v18,
  tiktok-sync v7 and tiktok-connection-status v5 are live. The first automatic
  job truthfully found the sole existing CG Production House token expired and
  unable to refresh, so provider OAuth reconnect remains required. The current
  #238 continuation owns only the active-client connection/reconnect queue and
  exact-account OAuth hardening; publishing stays out of scope.
- Standalone Instagram #471 / PR #473 and security correction #476 / PR #477
  are merged and closed. Issue #491 is the isolated active-client connection
  queue/review continuation. Production has the foundation and encrypted-token
  migrations applied and verified plaintext-free, but the provider app secrets,
  activation flag, functions, consent, exact-client mapping and standalone-token
  worker selection remain protected and inactive.
- Meta D02 migration `20260922154243_meta_post_engagement_truth.sql` is
  unapplied, and the related updated Meta persistence/projection functions are
  undeployed. This migration is now also a dependency for deploying the
  current-main #485 worker safely, because that worker emits the D02 evidence
  contract. Do not bulk rewrite legacy/import history.

### Exact remaining launch gates

1. Separate CA approval for the coordinated current-main Meta activation:
   apply `20260922154243_meta_post_engagement_truth.sql`, then deploy the updated
   `meta-sync-worker` and `meta-sync` functions with shared dependencies, then
   run bounded D02 + AbortError/request-timeout production acceptance. Do not
   deploy the current-main worker alone while the old D02 SQL contract is live.
2. Red Oak exact-Page access/re-consent and stable fleet evidence.
3. Only after those gates, a separate decision on enabling Content Autopilot
   alone. Keep AI generation and OneDrive flags off unless separately approved.
4. Authenticated desktop/mobile acceptance for #438.
5. CA real production phone confirmation for #217 before closing its durable
   launch-blocker issue.
6. Authenticated staff read-only Red Oak Website Performance preview after the
   production #486 CORS correction; no snapshot save or publication before it passes.
7. Separate CA approval for every unapplied migration/function/provider gate
   listed above. Do not infer activation from merged files.

No production SQL/data mutation, provider permission/config change, deploy,
Microsoft write, OneDrive action or Content Autopilot enablement is authorised
by this documentation snapshot.

## ISSUE #476 CODE LANE — 22 September 2026

- Issue #476 is closed and its isolated standalone Instagram token-at-rest
  encryption foundation is merged through PR #477 at
  `a92928abb109258766f10892824c1665b722d08c`.
- The code-only correction adds Edge-runtime AES-256-GCM with a strictly
  decoded 32-byte server key, fresh 96-bit IV, versioned key/contract metadata
  and AAD bound to exact client + Instagram account identity.
- Correction migration `20260922144059_standalone_instagram_token_encryption.sql`
  aborts if plaintext rows exist, removes the plaintext column/raw-token RPC,
  and retains service-role-only atomic `pending_review` persistence.
- Production now has the foundation/correction migrations applied and verified
  plaintext-free. Encryption-secret/app configuration, function deployment,
  provider consent, client mapping and worker/reporting integration remain
  separate protected gates.
- No background-worker, Microsoft, Meta sync worker, legacy Facebook token,
  cron, Content Autopilot flag, OneDrive, production secret/config/data or live
  provider state is owned by #476.

## ISSUE #491 CODE LANE — 23 September 2026

- Agent 02 owns the isolated active-client Instagram connection queue from main
  `16c0056746eff964fedbbe36bfa8f6dc02e9d56f`.
- The code checkpoint replaces the compile-time activation constant with an
  exact server flag that fails closed, keeps Page-linked Meta first, exposes the
  reviewed 17-client matrix in the staff Integrations UI and preserves OAuth
  completion as encrypted `pending_review`.
- A new explicit admin/manager confirmation action rechecks exact client,
  provider account ID, username, professional type, scopes and encrypted-token
  presence in one transaction before binding the identity to the existing
  `meta_client_assets` authority. It does not create a reporting/facts store.
- Migration `20260923120000_instagram_connection_review_binding.sql`, the three
  Instagram Edge Functions, provider secrets, activation flag and any consent
  or mappings remain unapplied/undeployed. The shared Meta worker is unchanged;
  standalone credential selection remains a protected shared-worker gate before
  autonomous standalone reporting can be enabled.

## ISSUE #471 CODE LANE — 22 September 2026

- Issue #471 is closed and its Instagram Login fallback foundation is merged
  through PR #473 at `250d83a1290cd96648f47f969cff29d15ee0d0b9`.
- The 17-client missing-Instagram audit is recorded in
  `docs/ops/INSTAGRAM-FLEET-AUDIT-2026-09-22.md`. Six exact first-party/current
  handles are verified, but all 17 remain access/ownership/linkage unknown until
  Meta or the client proves professional type and exact access. No handle was
  guessed and absence was not converted into “no Instagram account”.
- Phase-1 code adds an isolated Instagram Login foundation only: exact-client
  one-time OAuth intent, Business/Creator identity verification, server-only
  atomic token persistence and `pending_review`. It deliberately does not write
  `meta_client_assets`, run sync, create reporting facts/checkpoints or publish.
- The two foundation migrations are now production-applied; functions, provider
  app setup, secrets, consent, token/mapping writes and canonical worker token
  selection remain undeployed/unconfigured.
  The shared background worker, activation and Microsoft files are untouched.
- The merged #476 correction makes the production persistence contract
  ciphertext-only. Provider configuration, the encryption key and functions
  remain undeployed; provider consent therefore remains blocked.
- Existing Facebook/Page-linked Meta remains the first route. Standalone Login is
  only for an exact professional account proven unable/unsuitable to use that
  route. Activation requires a separate CA gate and shared Meta worker review.

## ISSUE #463 CODE LANE — 22 September 2026

- Monthly Strategy Autopilot is accepted and merged through PR #464 at main
  `b93f3086a3e46c272c294f7037c4679b3d907e94`.
- The merged scope is code-only: current/next-month canonical #391 draft preparation
  plus read-only #450 Content Guideline alignment. Existing strategies are never
  overwritten and client visibility remains publish-only.
- Supervisor correction review verified Johannesburg-date Marketing Library expiry,
  reviewed/active-only industry routing, exact-client card scoping before limits,
  and truthful withheld alignment when the canonical strategy read fails.
- The merged isolated follow-up from `main`
  `250d83a1290cd96648f47f969cff29d15ee0d0b9` wires one durable Johannesburg-day
  strategy job into the existing worker before daily Content Autopilot. Content is
  withheld until the same-day strategy job succeeds. No second scheduler, schema,
  Microsoft/Meta behavior or production configuration is added.
- The separate deployment gate was completed from main
  `6d58eb5eb9be879e8cbc5722d1f12f1cedbe412f`:
  `monthly-strategy-autopilot` v1 is active with gateway JWT verification and
  `background-worker` v16 is active on the unchanged minute cron. Live readback found the production
  queue constraint still admits only `meta_sync` and `report_prep`, leaving zero strategy/content
  Autopilot jobs. The code-only follow-up migration
  `20260922142000_extend_background_jobs_allowed_type_for_autopilots.sql` preserves those existing
  types, restores canonical system-owned `web_push_delivery`, and adds exactly
  `monthly_strategy_autopilot` and `content_autopilot`. After PR #475 merged at main
  `8bacfd39478d082a4d7ae2371788d0dbf66beb9c`, CA separately approved and Agent 01 applied only that
  migration. Production verification shows the exact five-value `NOT VALID` constraint and the
  recorded `20260922142000` migration receipt. The authenticated enqueue RPC remains restricted to
  `meta_sync` and `report_prep`; cron, RLS, grants, functions, secrets and flags were unchanged.
- The unchanged minute worker admitted exactly one Johannesburg-day strategy job,
  `3a8e1aa5-70aa-4ebb-9971-429ac7a8b36b`, and completed it on its first attempt. It prepared 112
  version-1 drafts for 56 active clients across September and October 2026, reported 71 truthful
  `PACKAGE_UNVERIFIED` blockers and zero failures. No existing strategy was encountered or
  overwritten. The next scheduler tick reused the same succeeded daily job. All three Content
  Autopilot flags remain false and production still has zero `content_autopilot` jobs.

## PRODUCTION ACTIVATION TRUTH — 22 September 2026

This section supersedes the pre-merge #450/#451 lane snapshots below. Exact evidence and the ordered
protected runbook are in `docs/ops/P0-PRODUCTION-ACTIVATION-2026-09-22.md`.

- The activation baseline was `main` `6d58eb5eb9be879e8cbc5722d1f12f1cedbe412f`;
  the current GitHub main is recorded in the latest snapshot at the top of this file.
  Activation corrections for stale-preview takeover, automatic date range, Edge dependency
  resolution and bounded Microsoft detail units are merged and production-green.
- Production now has the explicitly approved Client Portal foundation plus the four #450/#451
  migrations (`20260918113000`, `20260921090000`, `20260921120000`, `20260921140000`,
  `20260922120000`) applied and object/grant verified. The separate Photography policy migration
  `20260919100000` remains unapplied as instructed.
- Both system identities are the auth-backed `CG Production House Admin` profile. Independent
  `DAILY_FRESHNESS_WORKER_SECRET` and `WORKER_INTERNAL_TOKEN` values are configured. All three
  Content Autopilot flags remain false and no `content_autopilot` job has been created.
- Current `meta-sync-worker` v31 is deployed with its worker-secret contract and `verify_jwt=false`.
  The existing `cg-background-worker` cron was changed only to a 30-second pg_net timeout; job ID,
  minute cadence, PostgreSQL identity and endpoint are unchanged. Subsequent responses are HTTP 200
  without timeout. Do not create a second scheduler.
- Live Meta truth at 11:18 UTC: 37 linked assets, 57 mapped platforms and 51 checkpoint rows (49
  successful, two failed). Missing evidence remains missing and zero PASS is preserved. Current
  month incremental work now completes. Red Oak exact Page `117937152934535` remains blocked by
  Graph code 10 even though the user token lists `pages_read_engagement`; the narrow remaining action
  is exact-Page access/re-consent, not a broad provider-scope change.
- Live Microsoft truth: provider configuration and transition are active, but the production cycle
  first selected the 18 September staff preview because the chosen actor is also the historical
  admin actor. That takeover defect is merged and deployed. Its first direct cycle then failed
  before job creation because the automatic `-31`/`+370` range totalled 401 days against the
  existing 370-day guard. `codex/451-activation-range-fix` makes the range a tested 369 days. No
  Microsoft write occurred.
- Content/OneDrive truth: Econofoods already has the upcoming run, guideline and three ideas, but no
  short code or durable folder mappings. Across production there are zero configured short codes,
  zero OneDrive mappings and zero delegated OAuth tokens.
- Microsoft job `40569507-7f78-4e1b-afe0-79b7b06edb4b` is complete with all six required sources
  complete, zero pending detail units, automatic retry count one and no automatic failure. No
  `microsoft_sync_runs` apply row exists; the last verified mirror remained authoritative throughout.
- Remaining gates: complete Red Oak exact-Page access/re-consent and stable Meta evidence; only then
  separately consider enabling Content Autopilot alone. AI generation and OneDrive remain off.
  No Microsoft write occurred.

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

Issue #327 remains the Morning Ops health/reconciliation authority, with #451
owning the automatic daily freshness implementation.

Current verified production evidence:

- job `40569507-7f78-4e1b-afe0-79b7b06edb4b` is complete;
- all six required sources are complete;
- zero detail units remain pending;
- automatic recovery count is one, with no automatic failure;
- no `microsoft_sync_runs` apply row exists;
- no Microsoft write occurred.

The completed collection cycle proves current source completeness, but it did
not apply a new mirror. The last verified mirror therefore remained
authoritative throughout. Staff Assistant coexistence still cross-references
live Microsoft plus Dynamics-native work; it must expose truthful stale,
failed, unavailable or pending states whenever the stored evidence says so.
Never infer an apply merely from a completed collection job.

## 11. Current lane snapshot

This section is an orientation snapshot only. Refetch GitHub + tracker before acting.

### Active manual coding

- #436 is this docs-only handover refresh lane. It owns only this file and must
  not change runtime, schema, provider or production state.
- #217 has no active code writer because its exact rows are already archived
  and current responsive acceptance passed. It remains open only for CA's real
  production phone confirmation.

### Awaiting supervisor or acceptance

- #388 / PR #485: code is merged; protected Meta worker deployment and bounded
  production acceptance remain.
- #437 / PR #438: code accepted; authenticated desktop/mobile staff-session UI
  acceptance is the only stated merge gate.
- #238: daily freshness is live; the active-client OAuth connection/reconnect
  queue is the current code-review lane. Provider consent is a later CA action.

### Protected activation gates

- Red Oak exact-Page access/re-consent and stable Meta evidence.
- Content Autopilot enablement remains a separate decision after #388 and Red
  Oak evidence. AI generation and OneDrive stay off.
- Meta D02 migration/function deployment; TikTok connection-queue deployment;
  standalone Instagram migrations/secret/functions/consent/mapping; Brand Hub
  mapping/activation; Google Ads authenticated live audit; and #438 UI
  acceptance are all separate gates.
- Website reporting, Client Portal Library, CG Hours registry/logger and
  OneDrive activation gates described in their owning runbooks remain
  protected. Do not infer production state from merged code.

### Recently completed production rollout

- #451 Microsoft/Meta daily freshness activation is live on the single existing
  scheduler, with the completed Microsoft collection and truthful Meta fleet
  evidence recorded above.
- #463 Monthly Strategy Autopilot is live and idempotent. Content Autopilot
  remains disabled.
- #472 D01/D03/D04 and D02 code are merged; production D02 activation remains
  protected.

### Parked future

- #377 / PR #380 and #374 / PR #375 are parked/stalled; do not duplicate them.
- #390 waits on #388 merge/deploy/acceptance.
- #400 Client Billing Hub remains future work and must not block current launch
  activation.

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
