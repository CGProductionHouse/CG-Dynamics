# CG Dynamics Ops Handover

Status: CURRENT authority for a fresh supervisor chat.

Updated: 23 September 2026 after PR #508 production activation.

## 1. Recovery order

A fresh chat must recover state in this order:

```text
AGENTS.md
-> this handover
-> Issue #381 latest comments
-> current main
-> active owning issues/PRs
-> live Supabase/Vercel/provider state when consequential
-> act
```

Do not ask CA to repeat project history. GitHub `main`, the newest owning issue comments and verified production state outrank stale chat summaries.

## 2. Current GitHub truth

Latest verified **runtime-code baseline** before docs-only handover commits:

`66f3b1ea45d5ede618f666a46bf4c3ac2019e4cc` (#508 merged)

Always refetch current `main` before consequential action because docs-only handover commits may be newer than the runtime baseline.

Recent launch-critical merges:

- #490 Meta integration crash fix.
- #495 truthful Jul/Aug/Sep report reconciliation tooling.
- #497 active-client package authority + gold-standard strategy gate.
- #502 active-client package evidence/review UX.
- #496 active-client Instagram connection/review queue.
- #503 standalone Instagram credential route into canonical Meta reporting.
- #498 active-client TikTok connection/reconnect queue.
- #506 immutable reviewed report-publication snapshot.
- #508 TikTok failed-refresh -> canonical reconnect recovery.

## 3. Active manual lanes

### CA MANUAL AGENT 01 — Issues #504 / #511

Mission: active-client package confirmation campaign.

#511 code is now merged through PR #512 at `b894f1acc0d7ceed119ae93343da096a737ddd2f`.
The production migration/RPC activation is still unapplied and remains a protected gate.

Production package authority is live.

Latest verified queue:
- 56 active clients.
- 0 confirmed package receipts.
- 37 direct-evidence-ready.
- 0 conflicts.
- 19 unknown-heavy.

CA has now reviewed the complete 56-active-client package list in one batch.

Durable batch authority:
- Issue #504 comment `5796095876`.
- every unmentioned client/package is approved unchanged from the reviewed Teams-derived list;
- CA corrections in that comment override Teams/template evidence;
- AV Event Life = 4 design posters + 4 photo posts + social media management/caption generation;
- unknowns remain unknown/null, never zero;
- First Technology Central, Kundedienste and Local Deli are removed from recurring social-management scope;
- Rusoord Farmstay is website-only;
- Red Oak, TBS Brokers, The Staffordshire and WiseRide contain flexible/on-request/shared scope that must be stored as notes/other agreed deliverables rather than fake fixed quantities.

No package confirmation receipts have been written from this batch yet because the #511 migration/RPC replacement is not production-applied.

Agent 01 has already prepared the next ten direct-evidence-ready clients on #504:
Bloem Action Sports; Bloem Marble & Granite; Bohemia Quick Stop; Bouwer & Coetzee Attorneys; C&L Innovations; Cape Lumber; Central Canvas; Daisy & Co; Delta Gas; Dulux Paint & Paper Bloemfontein.

Do not bulk-confirm packages. Confirmation must use the existing #494 audited RPC after CA/admin approves the exact client scope.

### CA MANUAL AGENT 02 — Issues #505 / #507

#507 code is complete and production-live.

PR #508 merged at:
`66f3b1ea45d5ede618f666a46bf4c3ac2019e4cc`

Production:
- `tiktok-sync` v11 ACTIVE.
- `tiktok-connection-queue` v3 ACTIVE.
- existing TikTok OAuth start/callback/status and daily freshness remain live.
- failed provider refresh can now mark the exact connection `needs_reauth` / `reconnect_required`.
- transport/config failures remain retryable.

#505 has now verified CG Production House transitions correctly to `reconnect_required`.
The canonical exact-client TikTok OAuth reconnect is available.

CA has explicitly authorized the persistent read-only TikTok OAuth reconnect for the exact CG Production House account.

Next action: execute the canonical `Reconnect with TikTok` provider OAuth flow, verify exact account identity/freshness, then continue other ACTIVE clients. No TikTok publishing. Do not ask CA for this same consent again unless TikTok presents a new scope/permission change.

Instagram campaign state:
- 56 active clients reviewed.
- 25 Page-linked Instagram clients.
- 0 standalone Instagram clients connected.
- 6 verified standalone candidates: Bouwer & Coetzee Attorneys; Emmanuel Funerals; Novus Steel; Piek Group; Red Oak; We Ar Fuels.
- 25 additional active clients still require exact owner-controlled Instagram identity confirmation.
- 6 of 7 standalone production config names are securely present.
- only `INSTAGRAM_APP_SECRET` remains absent.
- standalone activation remains fail-closed.
- Meta provider redirect configuration still needs saving.
- Meta App Review / advanced access and Live mode are required before real standalone client data access.
- provider re-auth/2FA may be required.
- never paste or return secrets; client passwords may only be used locally on provider-owned login pages.

Production Instagram plumbing already live:
- review-binding migration applied.
- `instagram-oauth-start`, `instagram-oauth-callback`, `instagram-connection-confirm` deployed.
- `meta-sync-worker` v36 and `meta-sync` v49 can consume exact reviewed standalone encrypted credentials.
- Page-linked Instagram remains preferred.

### CA MANUAL AGENT 03 — Issue #501

The original GO SNAPSHOT publication is COMPLETE.

Approved snapshot:
- artifact: `artifacts/report-truth/issue-501-reviewed-plan-snapshot.json`
- cutoff: `2026-09-23T11:24:00.897Z`
- hash: `d7448dcd7306deb752191aec9676da28ce228c731dde5c5626cd8a8813c79abe`

Production receipt:
- applied at `2026-09-23T12:07:17.358Z`
- 107 applied / 0 already satisfied
- 107 reports verified live
- 1,647 frozen post identities verified
- July/August/September = 37 / 35 / 35
- truth, period, September MTD, reflection, strategy and cross-client violations = 0

First withheld-recovery snapshot is frozen and merged through PR #510 at `87d9a9d140ece76c4bd94fa1058e763596cd6031`.

Recovery pass 1 is COMPLETE.
- recovery hash: `af696f0a33ac36fe1a7dc7b6b6c01d23929658187f1a614e6a65f69233a17f35`
- applied at `2026-09-23T14:06:16.053Z`
- 5 newly applied / 107 prior rows already satisfied
- 84/84 frozen posts verified
- 5/5 reflections present
- 3/3 September rows explicitly MTD
- zero truth/identity/period/cross-client violations

Total live verified reports from #501 rollout: 112.

Remaining withheld: 56.
- 47 `MISSING_CANONICAL_REPORT`
- 9 `NO_IN_MONTH_POST_EVIDENCE`

Fresh read-only discovery found no additional qualifying rows, so #501 is now a truthful withheld ledger rather than an active mutation lane. Agent 03 is released from report recovery until new evidence appears.

## 4. Production authorities already live

### Meta / Instagram

Meta engagement D02 migration is applied.

Current canonical Meta reporting runtime includes:
- `meta-sync-worker` v36.
- `meta-sync` v49.
- missing engagement remains unavailable/partial, never fake zero.
- component evidence/provenance is preserved.

Known external Meta exceptions should be rechecked before claims:
- Red Oak Facebook exact Page access/re-consent remains an external provider recovery item.
- AV Event Life Facebook has had provider permission/Page access issues.
- individual provider failures must remain exact-client/platform scoped.

### TikTok

Automatic freshness scheduling is live.

Current production connection layer includes:
- exact TikTok provider-account identity uniqueness.
- active-client-only queue.
- OAuth start/callback/status.
- `tiktok-sync` v11.
- `tiktok-connection-queue` v3.
- publishing remains disabled/out of scope.

CG Production House TikTok is now canonically recovered and fresh: exact account `CGPRODUCTIONHOUSE`, persistent read-only scopes, September sync 4 videos, queue 1 connected / 0 reconnect / 55 not connected. Remaining 55 active clients require exact owner-controlled identity discovery and client-by-client provider login before OAuth; do not reuse the CGPH session across clients.

### Active-client package authority

Migration `20260923110000_active_client_package_strategy_authority.sql` is production-live.

The existing `clients.package_settings` remains canonical. No shadow package store.

Package rules:
- active clients only.
- blank != zero.
- explicit zero is authoritative only when directly confirmed.
- direct package edits invalidate prior verification.
- confirmation is auditable.
- strategy approval/publication fails closed without current confirmed package truth and exact-client evidence.

### Strategy quality

`monthly_client_strategies` remains canonical strategy authority.

Gold-standard requirement:
- exact confirmed package.
- actual previous content/performance.
- exact client intelligence/guide.
- products/services/offers and commercial priority.
- audience/location/brand constraints.
- current/local context where relevant.
- governed Marketing Library methods.
- previous strategy + what actually happened.
- concrete content pillars/hooks/tests/actions.
- no generic filler transferable by changing the client name.
- no out-of-package plan.

September/October strategy rows exist, but client strategy publication must wait for exact package truth and the current approval/publish gate.

### Microsoft

Microsoft collection/reconciliation remains automatic on the existing background worker.

It is not a blind daily Microsoft writeback.

Always distinguish:
- source collection complete/current;
- canonical verified mirror;
- actual apply/write.

Never infer a Microsoft write merely because collection completed.

### Content Autopilot

Keep Content Autopilot off unless separately approved.

Do not silently enable AI generation or OneDrive automation.

## 4A. Gold strategy rollout — Issue #513

Agent 03 now owns #513.

Current strategy state:
- 56 September strategy rows, all draft.
- 56 October strategy rows, all draft.

Phase 1:
- build an exact-client research/grounding dossier for all 56 active clients using verified client intelligence, actual report/content history, business/site positioning, audience/brand constraints, Marketing Library methods and sourced category/local context;
- clearly separate fact, constraint, research observation and recommendation;
- no cross-client evidence and no generic filler.

Phase 2:
- as #504 package receipts become confirmed, upgrade the existing canonical September/October strategy rows for that exact client;
- quantify only known package capacity;
- preserve flexible/on-request package logic;
- do not approve/publish until exact package receipt + dossier + gold-standard gate all pass.

Do not touch provider mappings, package confirmation writes or report publication in this lane.

## 5. Important next milestones after current launch lanes

- Issue #493: LinkedIn client provider connection + truthful analytics, after current Instagram/TikTok/report/package milestone.
- Issue #361 / Dynamics PR #376 + CG-Hours PR #3: company ChatGPT staff logging for own daily hours + travel km. Code exists but production activation/mapping/secrets/first controlled live write remain incomplete. Franco cannot be called production-ready for this until those gates are completed.
- #217: real-phone human confirmation remains for the durable mobile signoff.
- #437 / PR #438: previously code-accepted creative intelligence UI still requires current-main reconciliation/authenticated staff acceptance before eventual merge if not superseded.

## 6. Security / protected actions

Never expose:
- client/provider passwords;
- OAuth access/refresh tokens;
- app secrets;
- encryption keys;
- staff logger secrets.

Provider passwords may be read from CA's approved local password PDF only by the local agent and only when typing into the actual provider-owned login page. Never transcribe them into GitHub/chat/terminal/logs.

Protected actions requiring explicit CA authorization when not already specifically authorized:
- production schema/data migration;
- production reconciliation/data apply;
- provider consent/App Review submission/permission change;
- secrets/credentials;
- payments/spend;
- external publishing/sends;
- destructive data/OneDrive actions;
- first real CG Hours live draft write.

Routine verified code merge/deploy remains delegated to the supervisor unless a protected action is bundled into it.

## 6A. Package confirmation blocker — Issue #511

Issue #511 is a launch-safety correction, not a redesign.

Required:
- keep `clients.package_settings` canonical;
- known package fields may be explicit values;
- unproven fields must remain unknown/null, never coerced to zero/false;
- receipt must distinguish known / explicit zero / unknown;
- UI must render unknown clearly;
- strategy/package-capacity checks must fail closed when a needed entitlement is unknown;
- direct edits still invalidate verification;
- backward compatibility for existing confirmed rows;
- after review, production RPC/schema activation remains a protected gate.

Agent 01 has prepared the bounded #511 correction: v2 confirmation receipts retain
per-field `known` / `explicit_zero` / `unknown` state, unknown values remain JSON
`null`, and enabled strategy work with unknown capacity fails closed. The additive
`20260923122616_preserve_unknown_package_confirmation.sql` migration is not applied;
no first package confirmation write may proceed until supervisor review and separate
CA approval for that protected production migration/RPC activation.

## 7. Prompt discipline — HARD

CA has repeatedly required tiny coding-agent prompts.

The repo/GitHub issue is the brief.

For any CA manual agent:
- update GitHub first;
- prompt only points to the owning issue/PR and next action;
- normal prompt target is 4-7 short lines;
- hard cap is 10 nonblank lines / ~140 words;
- if more detail is needed, put it in GitHub first;
- do not paste architecture/history/acceptance lists already in the issue;
- do not resend an already-sent prompt unless a redirect is genuinely needed;
- after an agent result, supervisor acts first, then automatically gives only the tiny remaining prompt.

Canonical contract:
`docs/ai-workforce/CA-CODING-PROMPT-CONTRACT.md`

Preferred prompt:

```text
CA MANUAL AGENT

Read AGENTS.md + latest <issue/PR>. GitHub is the full brief.
Continue <lane>. Next action: <one objective>.
Do not touch <only necessary exclusion>.
Verify and update GitHub. Return completed / verification / blocker.
```

## 8. New-chat behavior

When CA opens a fresh chat and says continue CG Dynamics:

- do not ask what was happening;
- read this handover + #381;
- refetch main and active issues;
- reconcile any agent results;
- continue safe work automatically;
- send CA only material state + genuine gate;
- keep prompts tiny.

The fresh chat should prioritize, in order:
1. #504 package confirmation rollout using the CA-reviewed full batch.
2. #505 remaining active-client provider campaign + standalone Instagram provider gates.
3. #513 exact-client research dossiers + Sep/Oct gold strategy rollout.
4. #501 only when new truthful report evidence appears; 112 reports are already live and 56 are genuinely withheld.
5. #493 LinkedIn and #361 CG Hours once the current client-launch milestone is stable.

## 9. Durable control-plane rule

Every material state change must update:
- owning issue/PR;
- #381 if cross-lane state changed;
- this handover when the current operating state materially changes.

Do not leave stale statements such as “awaiting approval” after CA has already approved the exact action.

Historical detail remains available in Git history and owning issue comments. This file is intentionally current-state-first rather than a growing archive.
