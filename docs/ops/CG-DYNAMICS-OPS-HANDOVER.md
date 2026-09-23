# CG Dynamics Ops Handover

Status: CURRENT authority for a fresh supervisor chat.

Updated: 23 September 2026 after package rollout completion, report recovery, CGPH TikTok recovery, TikTok native-management steer and #514 strategy-dossier merge.

## 1. Recovery order

A fresh chat must recover state in this order:

```text
AGENTS.md
-> this handover
-> Issue #381 latest comments
-> current main
-> active owning issues/PRs
-> live production/provider state when consequential
-> act
```

Do not ask CA to repeat project history. GitHub current truth and verified production state outrank stale chat summaries.

## 2. Current GitHub truth

Latest verified main when this handover was refreshed:

`6cfffa1a117663d9c9efd3b9bdc99054591b9a25`

Always refetch current `main` before consequential action.

Recent launch-critical work includes:
- #490 Meta integration crash fix.
- #495 truthful Jul/Aug/Sep report reconciliation.
- #497 package + gold-strategy authority.
- #502 active-client package evidence/review UX.
- #496 Instagram connection/review queue.
- #503 standalone Instagram credential route into canonical Meta reporting.
- #498 TikTok active-client connection queue.
- #506 immutable reviewed report-publication snapshot.
- #508 TikTok failed-refresh reconnect recovery.
- #512 unknown-preserving V2 package confirmation.
- #514 exact-client strategy grounding dossiers for all 56 active clients.

## 3. Active manual lanes

### CA MANUAL AGENT 01

Package lane is COMPLETE.

Production truth:
- 56 active clients.
- 56 confirmed package receipts.
- 0 unverified.
- 0 held.
- unknown fields remain null, never fake zero/false.
- flexible/on-request packages were preserved as flexible text scope.
- social-removal / website-only cases were recorded without hard-deleting clients.

Durable package authority:
- #504 comment `5796095876` = CA-reviewed full package batch.
- #504 comment `5796786851` = completed production execution.
- #511 comment `5796787633` = final completion record.

Special package cases:
- First Technology Central: no recurring social package; do not infer full client deletion.
- Kundedienste: once-off, no recurring socials.
- Local Deli: stale/no ongoing socials.
- Rusoord Farmstay: website-only.
- Red Oak, TBS Brokers, The Staffordshire and WiseRide retain flexible/on-request/shared scope exactly as recorded on #504.
- Econofoods: 5 supplied videos/month; CG does not manage socials.

#511 migration is production-live:
`20260923122616_preserve_unknown_package_confirmation.sql`

V2 receipts distinguish known / explicit_zero / unknown.
Strategy approval fails closed when enabled work depends on unknown capacity.

Agent 01 has no remaining package cleanup task.

### CA MANUAL AGENT 02 — Issue #505

Mission: ACTIVE-client social provider connection campaign.

#### TikTok current truth

CG Production House is COMPLETE:
- exact account: `CGPRODUCTIONHOUSE`
- persistent read-only scopes
- September sync: 4 videos
- access: connected
- coverage: complete
- completeness: complete
- freshness: fresh
- queue: 1 connected / 0 reconnect / 55 not connected
- no publishing scope/action.

Critical CA clarification:
- the approved local account source is explicitly structured with **CLIENT / INSTAGRAM / TIK TOK** columns;
- some ACTIVE clients have populated TikTok-specific entries;
- the previous Agent 02 conclusion that all 23 matching rows were merely generic was too conservative.

Required #505 continuation:
1. ACTIVE clients only. Dynamics `active=true` is the client-list authority.
2. Ignore every old/inactive row in the local source even if it contains TikTok details.
3. Re-audit the remaining active clients using the dedicated TikTok field.
4. Where the exact active client has a populated TikTok-specific record, use an isolated provider session for that client.
5. Authenticate only on TikTok's provider-owned surface.
6. Verify TikTok's returned exact provider identity before canonical binding.
7. In the same client session, set up native TikTok management: add/request the exact account in CG's TikTok Business Center where supported and verify Web Business Suite / Scheduler availability.
8. Do not silently convert account type; if TikTok requires Business Account conversion, mark `ACCOUNT_TYPE_ACTION_REQUIRED` for separate decision.
9. If the TikTok-specific field is blank/missing or returned identity mismatches, mark only that client unresolved and continue.
10. Never reuse the CGPH session across clients or expose credential values. No publishing beyond the separately approved native-management/scheduling setup.

Durable correction:
- #505 comment `5796930571`
- #381 comment `5796933605`

#### Instagram current truth

- 56 active clients reviewed.
- 25 Page-linked Instagram clients.
- 0 standalone Instagram clients connected at last verified checkpoint.
- 6 verified standalone candidates:
  - Bouwer & Coetzee Attorneys
  - Emmanuel Funerals
  - Novus Steel
  - Piek Group
  - Red Oak
  - We Ar Fuels
- 25 additional clients still require exact account identity confirmation.
- production OAuth callback saved in Meta.
- 6/7 standalone config names were securely configured.
- `INSTAGRAM_APP_SECRET` remains the only missing production secret.
- standalone activation remains fail-closed.
- Meta App Review / advanced access + Live mode still required.
- provider re-auth / 2FA may be required.

Production Instagram plumbing already live:
- review-binding migration applied.
- `instagram-oauth-start`, `instagram-oauth-callback`, `instagram-connection-confirm` deployed.
- `meta-sync-worker` v36 and `meta-sync` v49 support exact reviewed standalone encrypted credentials.
- Page-linked Instagram remains preferred.

Never request or paste provider secret values into chat.

### CA MANUAL AGENT 03 — Issue #513

Report publication lane #501 is no longer the active mutation lane.

Report truth:
- original GO SNAPSHOT applied successfully.
- recovery 5 applied successfully.
- total live verified reports from rollout: **112**.
- July/Aug/Sep client-visible truth verified.
- remaining withheld: **56**
  - 47 `MISSING_CANONICAL_REPORT`
  - 9 `NO_IN_MONTH_POST_EVIDENCE`
- fresh read-only discovery found no further truthful recovery batch.
- do not fabricate around withheld evidence gaps.

Agent 03 owns **#513 Gold strategy rollout**.

PR #514 is merged at `6cfffa1a117663d9c9efd3b9bdc99054591b9a25`.

Current strategy truth:
- 56/56 exact-client dossiers generated.
- 56/56 package receipts confirmed in production.
- existing 56 September + 56 October strategy rows remain draft and untouched.
- 27 dossiers were locally ready from repository evidence.
- 28 dossiers were blocked only because their latest production guide content had not yet been retrieved.
- Kundedienste is non-recurring/once-off and must not receive filler strategy merely to force 56/56 social strategy output.

Important production discovery after #514 review:
- `public.client_guides` currently has 52 rows with `runtime_readiness='ready'` and non-empty `guide_markdown`.
- therefore the 28 runtime-guide blockers are resolvable with exact-client read-only retrieval; they are not an external access blocker.

Next #513 phase:
1. retrieve each blocked client's latest ready production guide from `client_guides` and enrich only that exact dossier;
2. recompute dossier hashes/readiness;
3. use all confirmed package receipts and actual report/content history;
4. produce a deterministic Sep/Oct strategy mutation dry-run only;
5. return ready-for-mutation vs non-applicable vs blocked clients/reasons;
6. do not mutate/approve/publish strategy rows yet.

No provider mapping, package write or report-publication work in #513.

## 4. Production authorities

### Meta / Instagram reporting

- D02 engagement truth migration live.
- `meta-sync-worker` v36.
- `meta-sync` v49.
- missing evidence remains unavailable/partial, never fake zero.
- exact platform failures remain isolated.

Known provider exceptions should be rechecked before claims:
- Red Oak Facebook access/re-consent remains an external Meta issue.
- AV Event Life Facebook has had provider permission/Page-access issues.

### TikTok runtime

Live:
- active-client-only queue.
- exact provider-account uniqueness.
- OAuth start/callback/status.
- `tiktok-sync` v11.
- `tiktok-connection-queue` v3.
- automatic freshness.
- publishing disabled/out of scope.

### Package authority

`clients.package_settings` remains canonical.
No shadow package store.

Rules:
- active clients only.
- blank != zero.
- unknown remains null.
- explicit zero only when directly confirmed.
- direct edits invalidate confirmation.
- confirmation is auditable.
- 56/56 active clients confirmed.

### Strategy authority

`monthly_client_strategies` remains canonical.

Gold-standard requirements:
- exact confirmed package.
- actual previous content/performance.
- exact client intelligence.
- real commercial priorities.
- audience/location/brand constraints.
- useful local/seasonal/category research where sourced.
- governed Marketing Library.
- previous strategy + actual execution.
- concrete content pillars/hooks/tests/actions.
- no generic filler.
- no out-of-package plan.

### Microsoft

Microsoft collection/reconciliation remains automated.
It is not blind Microsoft writeback.

Always distinguish:
- collected source truth;
- verified canonical mirror;
- actual apply/write.

If Dynamics mirror freshness is uncertain, use live Microsoft-first evidence.

### Content Autopilot

Keep Content Autopilot OFF unless separately approved.
Do not silently enable AI generation or OneDrive automation.

## 5. Next milestones

After current #505/#513 launch work:
- #493 LinkedIn client provider connection + truthful analytics.
- #361 / Dynamics PR #376 + CG-Hours PR #3: company ChatGPT own-hours + travel-km logging. Code exists, production activation/mappings/secrets/first controlled write remain incomplete.
- #217 durable real-phone acceptance if still open.
- #437 / PR #438 creative intelligence reconciliation/authenticated acceptance if still relevant.

## 6. Security

Never expose:
- provider passwords;
- OAuth tokens;
- app secrets;
- encryption keys;
- staff logger secrets.

Approved local account sources may be used only by the local execution agent and only to authenticate on the actual provider-owned login surface.

Old/inactive client records in those sources are never authority for connection work.

## 7. Prompt discipline — HARD

GitHub is the brief.

For CA manual-agent prompts:
- target 4–7 short nonblank lines;
- hard cap 10 nonblank lines / ~140 words;
- put all substantial detail in GitHub first;
- do not restate architecture/history/acceptance lists already present;
- do not resend stale prompts;
- after an agent result, supervisor acts first and then sends only the tiny remaining prompt.

Canonical contract:
`docs/ai-workforce/CA-CODING-PROMPT-CONTRACT.md`

Preferred format:

```text
CA MANUAL AGENT

Read AGENTS.md + latest <issue/PR>. GitHub is the full brief.
Continue <lane>. Next action: <one objective>.
Do not touch <only necessary exclusion>.
Verify and update GitHub. Return completed / verification / blocker.
```

## 8. Fresh-chat priority

When CA starts a fresh CG Dynamics chat:
1. read this handover + latest #381;
2. refetch current main;
3. reconcile latest agent results before issuing prompts;
4. continue safe actions automatically.

Priority:
1. #505 active-client TikTok Dynamics + native Business Center/Scheduler one-sweep setup, plus Instagram provider gates.
2. #513 retrieve runtime guides, finish dossiers and produce Sep/Oct mutation dry-run.
3. #501 only when new truthful report evidence appears.
4. current launch acceptance gaps.
5. #493 LinkedIn and #361 CG Hours.

## 9. Durable-control rule

Every material state change must update:
- owning issue/PR;
- #381 when cross-lane state changes;
- this handover when operating state materially changes.

Do not leave stale statements like “awaiting approval” after CA already approved or completed the action.
