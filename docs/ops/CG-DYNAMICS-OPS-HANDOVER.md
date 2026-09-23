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

Mission: active-client package confirmation campaign, with #511 now blocking the first truthful receipt.

Production package authority is live.

Latest verified queue:
- 56 active clients.
- 0 confirmed package receipts.
- 37 direct-evidence-ready.
- 0 conflicts.
- 19 unknown-heavy.

AV Event Life is the first CA-confirmed package truth:
- CA explicitly confirmed 4 design posters + 4 photo posts + social media management/caption generation.
- all other package fields remain unknown, not zero.

Important blocker discovered before write:
- the live #494 confirmation RPC currently requires explicit values for every numeric field and an explicit campaign boolean;
- using it now would silently turn unknowns into false zeros;
- no AV package write has occurred;
- Issue #511 owns the bounded authority correction so confirmed receipts can preserve unknown/null fields while strategy capacity checks fail closed.
- after #511 code review and separately approved migration/RPC activation, AV Event Life should be the first confirmed receipt using the exact CA-approved truth.

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

Resume #505 with CG Production House first:
1. retry the stored refresh once through the canonical production flow;
2. if provider rejects it, verify queue becomes reconnect_required;
3. use existing TikTok OAuth reconnect;
4. verify exact account identity and freshness;
5. continue other ACTIVE clients. No TikTok publishing.

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

Recovery snapshot:
- artifact: `artifacts/report-truth/issue-501-recovery-pass-1-snapshot.json`
- cutoff: `2026-09-23T12:15:42.531Z`
- hash: `af696f0a33ac36fe1a7dc7b6b6c01d23929658187f1a614e6a65f69233a17f35`
- 107 already satisfied
- 5 new mutation targets
- 56 remaining withheld
- 47 `MISSING_CANONICAL_REPORT`
- 9 `NO_IN_MONTH_POST_EVIDENCE`

Five new targets:
- All Around PVC — September
- Bat Hill Royale — August
- Bat Hill Royale — September
- Vrystaat Kunstefees — August
- Vrystaat Kunstefees — September

The recovery hash is NOT publication-authorized yet. PR #510 merge stored the artifact only and did not publish these five rows.

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

At last read, only CG Production House had a TikTok connection; it was stale pending the #508 recovery path.

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

Agent 01 should handle #511 before any first package confirmation write.

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
1. #505 TikTok CGPH recovery + provider campaign; standalone Instagram provider setup.
2. #511 unknown-preserving package authority, then #504 package confirmation rollout.
3. #501 recovery snapshot review/publication only when separately authorized.
4. current launch acceptance gaps.
5. #493 LinkedIn and #361 CG Hours once the current client-launch milestone is stable.

## 9. Durable control-plane rule

Every material state change must update:
- owning issue/PR;
- #381 if cross-lane state changed;
- this handover when the current operating state materially changes.

Do not leave stale statements such as “awaiting approval” after CA has already approved the exact action.

Historical detail remains available in Git history and owning issue comments. This file is intentionally current-state-first rather than a growing archive.
