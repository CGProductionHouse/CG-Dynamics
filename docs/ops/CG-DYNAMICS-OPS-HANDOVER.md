# CG Dynamics Ops Handover

Status: CURRENT authority for a fresh supervisor chat.

Updated: 23 September 2026 after #515 provider-eligibility production activation.

## 1. Recovery order

A fresh chat must recover state in this order:

```text
AGENTS.md
-> this handover
-> Issue #381 latest comments
-> refetch current main
-> active owning issues/PRs
-> live production/provider state when consequential
-> act
```

Do not ask CA to repeat project history. GitHub current truth and verified production state outrank stale chat summaries.

## 2. Current GitHub / production baseline

Latest verified runtime main:

`4db6be79570ce4265c80024ce150d4e144d34385` — PR #515 merged.

Always refetch current `main` before consequential action.

Launch-critical completed work includes:
- #490 Meta integration crash fix.
- #495 truthful Jul/Aug/Sep report reconciliation.
- #497 package + gold-strategy authority.
- #502 package evidence/review UX.
- #496 Instagram connection/review queue.
- #503 standalone Instagram credential route into canonical Meta reporting.
- #498 TikTok active-client connection queue.
- #506 immutable report-publication snapshot.
- #508 TikTok failed-refresh reconnect recovery.
- #512 unknown-preserving V2 package confirmation.
- #514 exact-client strategy dossiers.
- #515 social-provider rollout eligibility from confirmed package/service scope.

## 3. Active manual lanes

### CA MANUAL AGENT 01 — Issue #516

Package confirmation is COMPLETE:
- 56 active clients.
- 56 confirmed V2 package receipts.
- 0 unverified.
- unknown fields remain null, never fake zero/false.
- flexible/on-request scope preserved.
- no clients were hard-deleted/deactivated by the package rollout.

Durable package authority:
- #504 comment `5796095876` = CA-reviewed full batch.
- #504 comment `5796786851` = completed production execution.
- #511 comment `5796787633` = completion record.

PR #515 is merged and provider eligibility guards are production-live.

Exact live provider/service classification:
- **43 eligible social clients**
- **5 explicitly non-social/excluded**
- **8 unresolved/held**

Excluded 5:
- Econofoods
- First Technology Central
- Kundedienste
- Local Deli
- Rusoord Farmstay

Held 8:
- Agri-Secure
- Bat Hill Royale
- Bloem Vascular
- Ipopeng Office Supplies
- Mimosa Mall
- NCNA
- Vrystaat Kunstefees
- Zooz Lifestyle WFF

Issue #516 owns the held 8.
Agent 01 must use exact current evidence and return all eight together as:
- recurring social confirmed;
- explicitly non-social;
- still needs CA business decision.

Do not mutate provider mappings in #516.
Do not infer posting history as contractual scope.
If package/service note changes are needed, prepare them for one CA review first.

### CA MANUAL AGENT 02 — Issue #505

Mission: provider connection campaign for **eligible social clients only**.

#### TikTok current truth

CG Production House is COMPLETE:
- exact account: `CGPRODUCTIONHOUSE`
- persistent read-only scopes
- September sync: 4 videos
- access/coverage/completeness/freshness healthy
- no publishing scope/action.

PR #515 server-side eligibility guards are live.

Current deployed TikTok provider functions:
- `tiktok-connection-queue` v5
- `tiktok-connection-status` v11
- `tiktok-oauth-start` v10
- `tiktok-oauth-callback` v9
- `tiktok-sync` v11
- automatic freshness remains live.

Only the 43 eligible social clients may enter provider rollout.
Do not touch the 5 excluded clients.
Do not connect the 8 held clients until #516 resolves them.

CA clarified that the approved local account source is structured by **CLIENT / INSTAGRAM / TIK TOK**. Old/inactive rows are never authority.

For each eligible client:
1. use the exact TikTok-specific local record where present;
2. use an isolated provider session for that client;
3. authenticate only on TikTok's provider-owned surface;
4. verify TikTok's returned exact provider identity before canonical binding;
5. never reuse another client's session.

CA also explicitly approved a **same-sweep native TikTok management setup**:
- after exact account connection, add/request that same account in CG's TikTok Business Center account-management layer where supported;
- establish the minimum native team permission needed for content planning/scheduling/management;
- verify native Web Business Suite / content scheduler availability;
- keep Dynamics analytics OAuth read-only; do not enable Dynamics/TikTok API publishing;
- if Business Account conversion, QR owner approval, 2FA or provider permission is required, stop only that client and record the exact gate;
- do not silently convert account type.

#### Instagram current truth

PR #515 provider eligibility is also live on Instagram start/callback/confirm.

Current deployed standalone functions:
- `instagram-oauth-start` v4
- `instagram-oauth-callback` v4
- `instagram-connection-confirm` v4

Reporting runtime:
- `meta-sync-worker` v36
- `meta-sync` v49

Page-linked Instagram remains preferred.

Standalone provider gates:
- `INSTAGRAM_APP_SECRET` remains the secure provider secret gate.
- Meta App Review / advanced access and Live mode are required for real standalone client access.
- provider re-auth / 2FA may be required.
- never paste or return provider secret values.

### CA MANUAL AGENT 03 — Issue #513

Report publication is no longer the active mutation lane.

Report truth:
- original publication + Recovery 5 complete.
- **112 live verified reports**.
- remaining withheld: 56
  - 47 `MISSING_CANONICAL_REPORT`
  - 9 `NO_IN_MONTH_POST_EVIDENCE`
- fresh read-only recovery found nothing else safe.
- do not fabricate around withheld evidence gaps.

Agent 03 owns **#513 Gold strategy rollout**.

PR #514 is merged at:
`6cfffa1a117663d9c9efd3b9bdc99054591b9a25`

Current dossier/strategy truth:
- 56/56 exact-client dossiers exist.
- 56/56 package receipts confirmed.
- 56 September + 56 October canonical strategy rows remain draft and untouched.
- 28 dossiers are blocked only on retrieval/review of runtime production guides.
- production `client_guides` contains ready guide content, so those blockers are retrievable read-only.
- Kundedienste is explicitly non-social/once-off and no recurring social strategy should be fabricated for it.

Strategy scope must now follow #515 service truth:
- 43 eligible social clients -> eligible for monthly social strategy once dossier/gates pass.
- 5 non-social clients -> no fabricated recurring social strategy.
- 8 held clients -> wait for #516 service decision.

Next #513 phase:
1. retrieve each blocked client's latest ready production guide read-only;
2. enrich only that exact client's dossier;
3. recompute dossier hash/readiness;
4. produce a deterministic Sep/Oct **strategy mutation dry-run only** for eligible clients;
5. return ready / non-applicable / held / blocked with exact reasons;
6. do not mutate, approve or publish strategies yet.

No provider mapping, package write or report publication in #513.

## 4. Production authorities

### Package authority

`clients.package_settings` is canonical.
No shadow store.

V2 unknown-preserving confirmation migration is live.

Rules:
- blank != zero.
- unknown stays null.
- explicit zero only when directly confirmed.
- direct edits invalidate confirmation.
- 56/56 active clients are confirmed.

### Social-provider eligibility

Confirmed package/service scope is canonical rollout authority.

Live:
- 43 eligible.
- 5 excluded.
- 8 held.

OAuth start/callback/status/confirmation re-check eligibility server-side.
Active client status alone is no longer enough.

### Meta / Instagram reporting

- D02 engagement truth migration live.
- `meta-sync-worker` v36.
- `meta-sync` v49.
- missing evidence remains unavailable/partial, never fake zero.
- exact platform failures stay isolated.

Known provider exceptions should be rechecked before claims:
- Red Oak Facebook access/re-consent remains external.
- AV Event Life Facebook has had provider permission/Page-access issues.

### TikTok

Automatic freshness is live.
Analytics OAuth remains read-only.
TikTok publishing remains disabled/out of scope.

### Strategy authority

`monthly_client_strategies` remains canonical.

Gold-standard strategy requires:
- exact confirmed package/service scope;
- exact client dossier/intelligence;
- actual previous content/performance;
- commercial priorities;
- audience/location/brand constraints;
- useful sourced local/seasonal/category research;
- governed Marketing Library methods;
- previous strategy + actual execution;
- concrete pillars/hooks/tests/actions;
- no generic filler;
- no out-of-package work.

### Microsoft

Microsoft collection/reconciliation remains automatic.
It is not blind Microsoft writeback.

Always distinguish:
- collected source truth;
- canonical verified mirror;
- actual apply/write.

### Content Autopilot

Keep Content Autopilot OFF unless separately approved.
Do not silently enable AI generation or OneDrive automation.

## 5. Next milestones

After current #505/#513/#516 work:
- #493 LinkedIn client provider connection + truthful analytics.
- #361 / Dynamics PR #376 + CG-Hours PR #3: company ChatGPT own-hours + travel-km logging.
- #217 durable real-phone acceptance if still open.
- #437 / PR #438 creative-intelligence reconciliation/authenticated acceptance if still relevant.

## 6. Security

Never expose provider passwords, OAuth tokens, app secrets, encryption keys or staff logger secrets.

Approved local account sources may be used only by the local execution agent and only on the actual provider-owned login surface.

Old/inactive client rows in local account sources are never authority.

## 7. Prompt discipline — HARD

GitHub is the brief.

Manual-agent prompt rules:
- target 4–7 short nonblank lines;
- hard cap 10 nonblank lines / ~140 words;
- put substantial detail in GitHub first;
- do not restate history/architecture/acceptance lists;
- do not resend stale prompts;
- supervisor acts first, then sends only the tiny remaining prompt.

Canonical contract:
`docs/ai-workforce/CA-CODING-PROMPT-CONTRACT.md`

## 8. Fresh-chat priority

On a fresh CG Dynamics chat:
1. read this handover + latest #381;
2. refetch current main;
3. reconcile latest agent results;
4. continue safe actions automatically.

Priority:
1. #505 eligible-client TikTok Dynamics + TikTok Business Center native-management/scheduler sweep; Instagram provider gates.
2. #516 resolve the 8 held service scopes.
3. #513 retrieve runtime guides and produce Sep/Oct gold-strategy mutation dry-run.
4. #501 only if new truthful report evidence appears.
5. #493 LinkedIn and #361 CG Hours.

## 9. Durable control rule

Every material state change must update:
- owning issue/PR;
- #381 for cross-lane changes;
- this handover for operating-state changes.

Do not leave stale statements such as “awaiting approval” after an action is complete.
