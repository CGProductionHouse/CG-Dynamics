# CG Dynamics Ops Handover

Status: **CURRENT authority for a fresh supervisor chat**

Updated: **2 October 2026, after Agent 01 freshness rollout-readiness acceptance and Agent 02 Batch 3 assignment**

Current accepted main before this handover-only docs update: **`d8d9691cd068f7faaffc579237c8e665fe7d28ca`**. Latest freshness runtime-code merge remains **`2c27e74fe0d798fdffff877d358a0fa13f355292`**; #643 changes offline strategy review tooling/artifacts only. The handover edit itself advances `main`; **always refetch current main on takeover and before every merge**.

This file is the supervisor takeover authority. Read this section FIRST before touching GitHub, Codex agents, Supabase, Meta, Microsoft, Website/#405, strategy or production. Historical receipts follow below and are retained so completed work is not repeated.

---

## READ THIS FIRST — SUPERVISOR OPERATING CONTRACT

The user expects the new chat to take over as **active CG Dynamics supervisor**, not as a passive summariser.

### What the supervisor must do

- Independently inspect every agent result/PR against GitHub truth before accepting it.
- If a PR is safe, correct and unprotected, **merge it automatically**. Do not ask the user whether it should be merged.
- After every agent result, do NOT stop at a summary. Always determine the next useful mission and give the user the exact next Codex prompt unless that lane is genuinely blocked.
- Never leave an agent idle when there is safe useful work available.
- If the agent result is wrong/incomplete, give one precise correction mission on the same PR/lane.
- Keep #381 as the consolidated supervisor state board and update the owning issue as durable truth after meaningful changes.
- The supervisor owns this master handover file. Manual agents must not edit it unless specifically assigned.
- Re-fetch current `main` before merges because parallel lanes may have advanced it.
- Preserve lane isolation. Do not let one agent casually “help” another lane and create collisions.
- Use connected private GitHub tooling for repo truth. Do not rely on public web search for private-repo state.
- When a protected action is genuinely required, do not manufacture approval theatre. Record the exact blocker, keep other safe work moving, and wait for a direct user instruction covering that exact protected scope.

### The reply behaviour the user expects

This is important. The user gets frustrated when the supervisor merely says “looks good” and stops.

When the user pastes an Agent 01 or Agent 02 result:

1. Reply briefly that you are independently reviewing it.
2. Inspect PR/commit/diff/checks/current main + latest owning issue comments.
3. Check collisions and protected-action boundaries.
4. Merge automatically if safe.
5. Update durable GitHub truth (#381 + owning issue).
6. **Immediately give the NEXT mission/prompt for that same agent.**
7. The prompt itself must visibly say **AGENT 01** or **AGENT 02** at the top so the user instantly knows which Codex window gets it.
8. Do not ask “want me to continue?” or “do you want the next prompt?” Continue automatically.

If the lane is genuinely blocked, say exactly what blocks it and reassign the agent to another safe launch-critical task instead of repeatedly re-auditing the same blocker.

### Manual Codex prompt contract

The user manually controls the Codex agents. Keep prompts compact but complete. GitHub is the long-form authority.

Every prompt MUST start with the actual agent number and lane, for example:

```text
AGENT 01 — MICROSOFT / META FRESHNESS

Read AGENTS.md + latest #451/#623/#381. GitHub is the full brief.
Continue ONLY the assigned lane.
<one bounded objective>
Do not touch <explicit exclusions>.
Verify and update GitHub. Return completed / verification / blocker.
```

or

```text
AGENT 02 — STRATEGY QUALITY BATCH 2

Read AGENTS.md + latest #513/#381. GitHub is the full brief.
Continue ONLY #513.
<one bounded objective>
No production strategy writes / approval / publication.
Update #513/#381 and return head/artifacts/tests/blockers.
```

Do not send vague prompts like “continue please”. The prompt should state:
- agent number;
- lane;
- owning issue(s);
- exact next objective;
- exclusions;
- protected-write boundary;
- expected verification/return.

### No approval theatre

Durable rule remains:
- #505 comment `5951902435`
- #381 comment `5951903122`

Safe/unprotected launch actions continue automatically.

Do **not** ask the user to type “approve X” for routine mechanics. If a protected action is required, durable truth should say:

`BLOCKED: needs CA instruction — <exact protected scope>`

Then continue another safe useful lane.

Never infer protected authority from silence, old unrelated approvals, or “continue”. A direct user instruction only authorises its exact stated scope.

### Protected actions

Do not execute without direct current user instruction:
- production DB/schema/data writes or migration application;
- Edge/function deployment;
- secrets/config/env changes;
- Meta/TikTok/provider permission, verification, App Review, Live/activation changes;
- OAuth/client consent;
- strategy amendment/approval/publication;
- external client/business communication or publication/spend;
- destructive OneDrive/data actions;
- credential rotation/recovery/guessing;
- account binding/unbinding/rebinding;
- production reconciliation/sync trigger where it writes live truth.

Safe read-only production inspection, local/disposable tests, docs, GitHub comments, code/PR work and unprotected merges continue automatically.

### External communication rule

Client/business communication is **draft only** unless the user explicitly says to send it. Do not email/message clients or providers merely because a draft packet exists.

---

## CURRENT TWO-AGENT BOARD

### AGENT 01 — FRESHNESS / PRODUCTION ROLLOUT READINESS

Owning issues: **#451 + #623**, consolidated in **#381**.

Latest accepted merges:
- #639 Microsoft CPU/runtime repair → `7ff12f492003c89ad164da42b2c92495560bd4ce`
- #642 Meta terminal-bootstrap churn repair → `2c27e74fe0d798fdffff877d358a0fa13f355292`

Accepted zero-write rollout preflight:
- exact manifest: #451 comment **`5957561266`**
- supervisor acceptance/gate: #451 comment **`5957656853`**
- #381 state: comment **`5957657374`**
- #623 receipt: comment **`5957659578`**
- preflight was pinned to main `93bad42ef97fe975efc680a5ba44d0dd48e9685f`; later unrelated Website/#405 changes require only a source/config drift recheck immediately before any authorized deploy.

Accepted protected future rollout order:
1. `microsoft-transition-sync` — current-main closure; preserve JWT=true + captured root import map; rollback source/config = production v39.
2. `background-worker` — current-main closure; preserve JWT=false; rollback source/config = production v27.
3. `meta-connection-status` — current-main closure; preserve JWT=false; rollback source/config = production v33.

Accepted readiness findings:
- all three production bundles are behind accepted main;
- full import/runtime/type closures resolve and Edge checks pass;
- required live schema/RPC/grants/cron and secret **names** exist;
- no migration, cron, secret/env-value, provider-permission/mapping or flag change is required;
- rollback means restore exact captured SOURCE/CONFIG, not DB data;
- no manual reconciliation/sync trigger is included.

**BLOCKED: needs CA instruction — deploy exactly those three Edge functions in the accepted order with captured JWT/import-map settings and allow their existing automatic cron/queue/mirror/diagnostic behavior during acceptance.**

That protected authorization would NOT include:
- explicit manual Microsoft reconciliation/sync trigger;
- Meta manual sync trigger;
- migration/SQL/data repair;
- cron/cadence change;
- secret/config/env mutation;
- provider/access/OAuth/mapping change;
- permission broadening.

Production freshness remains unrepaired until protected rollout + live acceptance completes.

**CURRENT Agent 01 safe mission = read-only rollout acceptance observer/harness.**
Build one bounded offline/read-only ops collector for #451/#623 that can capture comparable pre/post rollout evidence without invoking write-capable function handlers or mutating production. It should collect/pin:
- Microsoft job/run/source coverage, terminal apply state, 546/CPU errors, July manual run identity, protected Client Schedule/monthly_deliverables fingerprints and exact completed/cancelled mirror truth;
- Meta batch/item/checkpoint/fact-age/cooldown evidence, dynamic mapped fleet, consecutive scheduler-tick batch creation, blocked-vs-healthy independence and empty-batch detection;
- canonical status evidence sufficient to compare UI later without calling the diagnostic endpoint;
- before/after hashes/receipts that prove protected rows and unrelated lanes did not change.

The harness must default to read-only, fail closed on missing access/schema, expose no secret values, have no deploy/sync/apply mode and no write-capable function invocation. Add deterministic tests and a short runbook. No Website/#405, #505, #513, #389 or master-handover edits by Agent 01.

**NEXT SUPERVISOR ACTION when Agent 01 returns:** independently review the observer/harness PR, merge if safe, update #451/#623/#381, then keep Agent 01 on another safe task unless CA has explicitly authorized the protected rollout.

### AGENT 02 — #513 STRATEGY QUALITY

Owning issue: **#513**, consolidated in **#381**.

Accepted:
- #638 zero-write compiler/quality plan → `cbf21ca5cbcb699bd09fb2d8341f7127b4415caa`
- #640 Batch 1 → `2ce29344a78bcef5d4a96fd27a87a7a2699fb2ee`
- #643 Batch 2 → `d8d9691cd068f7faaffc579237c8e665fe7d28ca`

Batch 2 supervisor receipt:
- #513 comment **`5957232525`**
- #381 comment **`5957233655`**
- exact-head Vercel was SUCCESS before merge;
- human copy/evidence pass accepted 9 clients / 18 Sep+Oct rows;
- **Zooz Lifestyle WFF remains blocked for both months** because the exact runtime guide/current programme-product-event evidence is absent; no substitute was used.

Current ZERO-WRITE fleet state:
- 94 reviewed v2 rows
- **42 amendment-needed**
- **52 blocked**
- 20 non-applicable untouched
- 0 approved
- 0 published
- 0 production strategy writes
- plan hash `336979000c9074496bfbcead8f55653349a2fd84e902b23aa3dfebcadd7bb518`
- Batch 2 packet hash `e30210b55ba1d328bfd69b55daa10944cb1faebd03088f2c0b57ea8b5b9f648a`

Accepted Batch 2 clients:
1. The Staffordshire
2. Delta Gas
3. CG Production House
4. RC-Polypipe
5. Peyper Bonds
6. Loraclox
7. Tobich Optics
8. AV Event Life
9. Braize

**CURRENT Agent 02 mission = Batch 3** using the same deterministic evidence ranking, exact next set:
1. C&L Innovations
2. Central Canvas
3. Bouwer & Coetzee Attorneys
4. We Ar Fuels
5. Novus Steel
6. Watch Addict
7. PSG Bloemfontein
8. Daisy & Co
9. Supa Quick BFN
10. Supa Quick Centurion

For any Batch 3 client that fails exact evidence sufficiency, stop that client truthfully and document the gap; **do not silently substitute another client**.

Hard strategy rules remain:
- zero-write review until direct protected strategy amendment instruction;
- no amendment RPC / approval / publication;
- no generic renameable copy;
- September and October materially distinct;
- package quantities never inferred from historical posting;
- no repo/evidence/UUID/internal workflow jargon client-side;
- no invented offers/prices/stock/ROI/legal/medical/financial/event claims;
- preserve Piek/Neshora + Batch 1 + Batch 2 accepted rows byte-stable unless a real drift guard stops them;
- preserve staff notes, provenance, live row/revision/package guards and all 20 non-applicable fingerprints;
- Zooz remains blocked until approved exact-client evidence exists;
- no #505, #389, Website/#405 or external communication;
- master handover remains supervisor-owned.

**NEXT SUPERVISOR ACTION when Agent 02 returns:** independently inspect the Batch 3 PR, copy/evidence, tests and exact-head Vercel. Merge automatically if safe, update #513/#381, then give the next Agent 02 mission in the same turn.

---

## #505 PROVIDER / INSTAGRAM-TIKTOK STATE — PARKED BEHIND HUMAN/PROVIDER RECEIPTS

Do NOT send Agent 01 back into generic identity hunting or broken-browser retry loops.

Current Instagram truth:
- 57 active clients
- 47 recurring-social eligible
- 10 excluded
- **22 canonical/Page-linked**
- **25 unmapped**
- **0 standalone**
- standalone connections/tokens/OAuth states/callback receipts: **0/0/0/0**

The 25-row first-party Meta audit and owner-action packets are complete for current evidence.

Important first-wave Instagram evidence:
- strongest visible Page + IG identity routes: Central Canvas, Ehrlich Park Butchery, Tobich Optics Otjiwarongo, We Ar Fuels;
- Neshora exact unsaved Page: `1340961499097681`;
- WiseRide exact unsaved Page: `727048853820569`;
- Red Oak canonical saved Page recovery remains separate; do not substitute the rugby-club Page;
- Piek canonical saved Page recovery remains separate; do not substitute the visible Engen Page.

Owner-action packets are complete for:
Instagram:
- Central Canvas
- Ehrlich Park Butchery
- Tobich Optics Otji
- We Ar Fuels
- Neshora Oxygen
- WiseRide
- Red Oak
- Piek Group

TikTok:
- Emmanuel Funerals
- Emoya Estate Driving Range
- Piek Group
- We Ar Fuels
- Bat Hill Royale
- WiseRide

Do not ask owners for passwords or 2FA codes. Owner remains in control of login/approval.

#505 is blocked on real first-party/human/provider evidence:
- Meta exact Page↔Instagram relationship and owner authority;
- Neshora/WiseRide exact Instagram identity;
- Red Oak/Piek canonical Page recovery;
- six concrete TikTok owner identity/access corrections;
- Meta Business Verification;
- Access Verification;
- genuine owner-authorised review fixture;
- App Review;
- later Live/activation/OAuth/mapping/sync.

Do not repeat #598/#600/#595 completed work.

---

## #389 CLIENT PORTAL EXPANSION STATE

Code lane is complete on main:
- #635 merged `df1b36b471b4b4ee09c1abacd6877b18b28a81ee`
- #637 merged `820d1bd98a4b6576500da779a0ba2e496fb86b10`

Built:
- separate `client_service_entitlements` authority;
- secure exact-client expansion request seam into canonical Operations CLIENT REQUESTS;
- client UI four-state logic;
- fail-closed client UI for missing RPC/schema/read failure/all-unknown;
- admin Entitlement Resolution Queue;
- explicit one-service verification; no bulk “mark all not included”.

Latest evidence matrix:
- 57 active clients × 7 services = 399 cells;
- 3 explicit evidence-ready included rows;
- 396 unresolved;
- 0 evidence-backed `not_included` rows yet;
- therefore no client upgrade CTA should be fabricated yet.

Both entitlement migrations remain unapplied in production. Do not apply/seed without direct protected instruction.

---

## WEBSITE/#405 LANE OWNERSHIP

**Website/#405 is a separate Claude lane. Codex Agent 01 and Agent 02 must not touch it.**

This correction is durable in:
- #623 comment `5952486427`
- #381 operating board history.

Do not hand Website work to Agent 01/02 unless the user explicitly changes lane ownership.

Historical Website production receipts remain below in this document.

---

## CRITICAL “DON'T MAKE THE USER REPEAT THIS” LIST

- Always put **AGENT 01** or **AGENT 02** visibly in the prompt itself.
- After an agent result, **review → merge/fix → durable GitHub update → NEXT PROMPT** in the same supervisor turn.
- Do not merely summarise and wait.
- Do not ask the user whether to merge safe PRs.
- Do not ask for routine “approval” language.
- Do not send agents into repeated browser retries after a browser/transport blocker is already proven.
- Do not restart completed #505 Instagram identity research.
- Do not redo #598 legal/callback/app-secret packet.
- Do not redo #600 crypto repair.
- Do not invent Instagram mappings from handles/public search.
- Do not confuse “unmapped” with “must use standalone OAuth”: Page-linked Meta route is preferred where exact Page/IG relationship can be established.
- Do not call cron HTTP 200 “freshness success”.
- Do not turn genuine PARTIAL/STALE into green UI.
- Do not hand-edit Microsoft’s 18 stale task statuses; the canonical reconciliation path must repair them after protected rollout.
- Do not let Red Oak’s alternate rugby Page replace the canonical Page.
- Do not let Piek’s Engen Page replace the canonical Page.
- Do not infer missing provider mapping = service not included.
- Do not infer historical posting volume = package entitlement.
- Do not approve/publish strategies just because zero-write reviewed proposals exist.
- Never expose secrets, keys, passwords or 2FA codes.
- Never send external client/provider communication without explicit send instruction.
- Keep answers operational and concise; GitHub carries the long-form detail.

---

## IMMEDIATE NEW-CHAT STARTUP

On takeover, do this without asking the user to repeat context:

1. Read `AGENTS.md`.
2. Read this handover top section.
3. Read latest #381.
4. Read latest #451/#623 for Agent 01.
5. Read latest #513 + PR #643 for Agent 02.
6. Re-fetch current main.
7. Determine whether either manual agent has returned new work.
8. If an agent result is provided, supervise it immediately.
9. If no new agent result is provided, continue safe supervisor work from the current board; do not invent protected authority.
10. Keep Website/#405 outside the Codex two-agent board.

Historical detailed receipts follow below. When an old receipt conflicts with this top current-state block, **this top block wins**.

### #505 current verification/review draft — 2 October, read-only

Fresh info@cgproductionhouse.com Chrome: Development; Business Unverified / eligible;
Access Verification disabled until Business Verified; Review Not submitted / empty.
Both exact reporting scopes Standard / Ready to use (0) / no review requested;
Insights advanced request disabled. Saved legal/product callback/redirect values
remain correct. #598 is COMPLETE; do not repeat saves or #600 crypto work.

Official verification/document guides read authenticated: exact legal entity match,
portfolio full control, conditional registration/incorporation/tax/bank evidence;
utility bill supports address/phone only, not legal-name proof. Actual CG wizard
fields, document limits/channel and Access Verification questionnaire are not yet
observable without protected execution; do not invent them.

SELECT-only active package/mapping evidence is unchanged: 57 active / 47 eligible /
10 excluded / 22 eligible canonical / 25 unmapped; standalone 0/0/0/0 at 12:19:54 UTC.
Three safe identity improvements: managed inventory plus matching public profiles
corroborate Central Canvas `central_canvas`, Ehrlich Park `ehrlichparkbutchery`, and
exact Tobich Otjiwarongo `tobich_optics_otjiwarongo`. No canonical matches; portfolio
connected-assets tabs show none, not proof of global Page unlinking/professional
type/consent. Eight reviewed queue handles unchanged; 14 remaining identity holds.
No new handle promoted in runtime code. 0 CONNECTABLE / 0 proven review fixtures.

Complete offline text/checklist/storyboard and ranked eight-handle suitability:
`INSTAGRAM-505-VERIFICATION-REVIEW-PACKET-2026-10-02.md`. Emoya Driving Range and
Toyota Bloemfontein are strongest structural candidates, not authorized fixtures;
CG own canonical/Page-linked account rejected. Real consent videos/reviewer access
remain absent. **BLOCKED: needs CA instruction** for Business/Access Verification,
fixture/tester/reviewer/demo/OAuth, request addition/submission, later Live/activation.
No approval prompt requested. No Meta save, secrets/config, provider/OAuth/sync/map,
DB write, migration/deploy, Website/Piek/TikTok work or production UI change.

Docs-only verification: 136 focused tests, 120 PASS / 16 disposable-DB skips /
0 failures; initial missing local public Vite env resolved with fake test-only env,
not production credentials. TypeScript/Vite build, scoped lint, diff check PASS;
existing bundle advisory. Browser evidence is provider/identity read-only, not a
successful standalone connection or new product/mobile acceptance.

### #598 bounded protected packet — COMPLETE, 2 October

Supersedes the owner-auth STOP receipt below. Under CA authorization #598 comment 5950879579 / #505 comment 5950880151 and CA's subsequent private reauthentication, completed exactly seven approved changes in `info@cgproductionhouse.com` Chrome:

- Correct Instagram-product app secret securely provisioned as `INSTAGRAM_APP_SECRET`; private digest-to-source comparison PASS. Product is CG Dynamics-IG `1383360116973315`, parent CG Dynamics `976168728361566`. Parent-app secret was not used. No secret/digest was exposed, copied to clipboard, logged or stored in repository; temporary private value cleared and Meta field remasked.
- `APP_PUBLIC_URL=https://www.cgdynamics.co.za`, private readback PASS. Before/after config inventory proves **only** `APP_PUBLIC_URL` and `INSTAGRAM_APP_SECRET` changed; all unrelated entries unchanged, none removed. Activation remains literal `false`; existing app ID/redirect/Graph/encryption config unchanged.
- Meta Basic Privacy `https://www.cgdynamics.co.za/privacy-policy`, Terms `https://www.cgdynamics.co.za/terms-of-service`, deletion instructions `https://www.cgdynamics.co.za/privacy-policy` saved and reload-readback PASS. Instructions-URL mode preserved.
- Instagram business-login Deauthorize `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-deauthorize` and Data deletion request `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-data-deletion` saved, reloaded/reopened and readback PASS. Exact existing OAuth redirect `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-oauth-callback` preserved.

Acceptance: deployed OAuth-start helper retains exactly `instagram_business_basic` + `instagram_business_manage_insights`; Meta's extra-scope generated Embed URL was not used. No-code/state OAuth callback returns 302 to canonical origin with `instagram=activation_blocked`; malformed unsigned deauthorize/deletion requests return 400 (not missing-secret 503), unknown receipt 404. No valid signed callbacks or OAuth start invoked. Standalone connections/tokens/states/callback receipts remain **0/0/0/0** after checks. Three deployed callback source trees parity-match accepted main and retain `verify_jwt=false`. Secret saves advanced callback revisions to v9/v4/v4; this is config propagation, **not an Edge deployment**. Development mode and Business Unverified/access-verification gate remain.

Non-secret browser evidence: `C:/Users/chris/.codex/artifacts/issue-598/2026-10-02-meta-legal-readback.jpg` and `2026-10-02-meta-callback-readback.jpg`. No Review submission, business/access verification change, tester addition, permission expansion, Live switch, OAuth/consent, client mapping, sync, migration, Edge deploy or DB/client/report data write. #598 packet has no remaining execution blocker; #505 remains OPEN at separately authorized Business/Access Verification, genuine owner-authorized standalone fixture, Review/Live and later one-client controlled activation/consent. Do not repeat #600 or these seven completed saves.

### #598 authorized packet — STOPPED at owner reauthentication, 2 October

CA explicitly authorized only the app-secret/public-origin/five-URL packet in #598 comment 5950879579 and #505 comment 5950880151. No production save/write occurred. In the requested `info@cgproductionhouse.com` Chrome profile, Meta Developers shows the exact CG Dynamics parent app `976168728361566`, Instagram business-login product CG Dynamics-IG `1383360116973315`, Development mode and the unchanged exact OAuth redirect. The generated Meta Embed URL still has extra scopes and was not used; canonical runtime code retains only `instagram_business_basic` + `instagram_business_manage_insights`.

Fresh names/digest-to-known-public-value checks: production app ID/redirect match; activation matches literal `false`; app secret absent; public origin still old Vercel origin. SELECT-only standalone connections/tokens/states/callback receipts remain 0/0/0/0. The product-specific Show action presented **Please re-enter your password** for Christie-Ann Groenewald. Secret was not retrieved, emitted or copied. No password was entered; dialog left open for CA private reauthentication. Do not use the parent-app secret, bypass reauthentication, search unrelated credentials or send a password/secret to chat.

Exact next action: CA completes only this Meta owner reauthentication directly in the open product-secret dialog, then agent resumes the already-authorized bounded #598 saves/readbacks. No App Review, verification changes, testers, Live, OAuth, mappings, sync, unrelated config or data writes are authorized. The seven approved changes remain pending; no partial origin/URL saves were attempted. #600 crypto remains satisfied and must not be repeated. Non-secret screenshot: `C:/Users/chris/.codex/artifacts/issue-598/2026-10-02-owner-reauthentication.jpg`.

Docs-only receipt verification: 52 local login/callback/encryption fixture tests passed, TypeScript/Vite build PASS (existing bundle advisory), scoped login/OAuth lint and diff check PASS. These are local regressions, not another production crypto validation. No runtime source changed.

### #505 Instagram-only executable queue — 2 October

Read-only current-main baseline `2e6d14484319b4b48d3180b676e29032e4c77ab3` and #505 supervisor comment 5949760923. Production: 57 active / 47 recurring-social eligible / 10 excluded / 0 scope-held; 22 canonical Instagram / 25 unmapped; standalone connections/tokens/states/callback receipts 0/0/0/0. Authenticated staff Chrome Page-first discovery exposes no Instagram option for the 25: 15 saved Pages loaded without an IG option, Red Oak's saved Page absent, nine no saved Page. This is not complete provider inventory (discovery limit/access boundaries), nor proof an account does not exist. Suggestions for Neshora/WiseRide are not mappings.

All eight reviewed handles preserved; remaining 17 exact identity holds investigated: nine populated supporting local Instagram records, eight blank/no matching record, no new verified public identity or guessed handle. Credentials were neither emitted nor used. **Zero presently CONNECTABLE**: owner professional-account/consent proof and shared provider/config gates remain. Full 25-client evidence/actions: `INSTAGRAM-505-ROLLOUT-MATRIX-2026-10-02.md`.

Verification: 91 focused passes / 16 disposable-DB skips / 0 failures; 25-name/eight-handle canonical manifest assertion, TypeScript/Vite build, scoped lint and diff check PASS. Docs only; no runtime changes or new production UI deployment required.

OAuth start/callback/confirm ACTIVE v6/v7/v6; deauthorize/deletion v2/v2; Meta sync/worker v53/v40. Completed #595/#600 and credential-expiry deployment are satisfied; do not replay. App secret absent, activation literal false, APP_PUBLIC_URL still old Vercel origin (names/structural checks only). Next protected packet is #598 secret + canonical public origin + five legal/callback saves/readbacks with activation OFF, not a bulk connection approval. Meta dashboard deliberately untouched; Oct 1 provider review state needs fresh CA readback. No Website/TikTok/provider/config/OAuth/sync/mapping/data/deployment action; #505 stays OPEN.

### #405 Website enquiries — PIEK STORED-LEAD PILOT COMPLETE (2 October, 13:53 SAST)

**Production receipt (supersedes the step list below; keep it as history).**
- Piek Vercel env: `CG_ENQUIRY_INTAKE_URL`, `CG_ENQUIRY_INTAKE_KEY` — **Production only** (Sensitive); none for Preview/Development; key piped from production, never printed.
- Piek PR #17 merged `c45e275dc898202eb3c5a6a1a439dd58f3ca581c` (head `e145a39`); production deployment `dpl_FAkrcKhFDJJMAEgjrvtf2ardoGZW` READY, aliased `www.piekgroup.co.za` / `piekgroup.co.za`. Live assets contain no intake key, Dynamics URL, env names or preview URL.
- First live submit (10:49 UTC) was rejected by intake v3 `server_to_server_only` (Node/undici fetch sends `sec-fetch-mode: cors`); nothing stored. Fixed by #628 merged `e08d51d9f46606d8753722d7e07df1d22fab36c7`; `website-enquiry-intake` redeployed **v4**, `verify_jwt=false`, from that commit.
- Controlled live-form submission (11:51 UTC): receipt `4bf9fcc9-7bfd-4de1-a376-bfda97bc7610` (site reference `4BF9FCC9`), enquiry `8a7ec21d-4c64-40f3-9b81-120f05f8c87c` — Piek Group / Website 1 / production / `www.piekgroup.co.za` / `contact_form` v1. Exactly 1 enquiry, 1 `generate_lead` (non-synthetic), 1 contact, 1 delivery job `pending` (0 attempts, no provider). Identical replay through the live route returned the same reference; counts unchanged. Intake logs: `accepted/201`, `replayed/200` only.
- Piek client identity (RPC as `authenticated`, rolled back): Lead Inbox lists exactly this lead. Delta Gas client identity: own inbox 0; read Piek inbox/metrics → `42501 Not authorized for this client`; mutate → `42501 Not authorized for this lead`; direct table read → `42501`.
- CG admin marked Good → `qualified/good`; Piek-view Website Performance (Oct, Africa/Johannesburg): total 1, qualified 1, qualification rate 1.0.
- Final pilot state: `closed_lost` / `poor` / `other`, note `pilot test`; audit `new→qualified/good`, `qualified→closed_lost/poor` (staff). Nothing deleted.
- **No email sent.** Delivery worker/webhook undeployed, provider OFF, 0 provider events.

**Pilot delivery job suppressed (2 Oct, 14:38 SAST, CA-approved #631 packet).** #631 merged `b405b5ca50710f0b69a2c59409461ba4aa866cf7`; migration `20261002140000_website_enquiry_delivery_suppression` applied ledger-exact (ledger 152, MD5 `fe8981ff…` matches GitHub). As CG admin: preflight listed exactly the Piek pilot job (recipient `admin@piekgroup.co.za`); `suppress_website_enquiry_delivery` → job `74112f4d-8021-43f0-aaa1-f0cff3038abe` `pending → suppressed` (`acceptance_test`, note `Piek #405 production pilot - DO NOT ACTION`). Preflight now empty; 0 sendable jobs; 0 provider events; enquiry/event/lead evidence unchanged. No provider/worker/webhook/schedule/DNS/secret touched.

**Next (separate, CA-gated):** outbound email activation only — provider approval, CG sending domain/DNS, six delivery secrets, worker/webhook deploy (`verify_jwt=false`), webhook registration, schedule, delivered/bounced acceptance. Precondition: `website_enquiry_delivery_preflight()` shows no acceptance/test job (currently satisfied).

### #405 Website enquiries — activation history (2 October, 11:58 SAST)

CA has assigned the supervisor to run the Website/#405 rollout to completion and expects the next concrete action to be stated and executed whenever safe. Do not hand routine mechanics back to CA.

**Current GitHub / code truth**
- current main at handover refresh: `f6d4fae42bd2e2921a54f10d3ec9424337fa1ac1` (latest commit is unrelated Instagram rollout docs; Website runtime code below remains on main);
- #614 merged `2b72c0553f2c00f9d43e9a09ba76417b17981162` — canonical website enquiry transaction;
- #620 merged `9185585874225305142d80eb50b17e95e9bafaef` — exact-client Lead Inbox/lifecycle + Website Performance lead outcomes;
- #621 merged `fd4f86bf3d3b13cc4b253f458b126540bdbc5d2c` — provider-neutral delivery runtime + durable provider-event inbox, still operationally disabled;
- #625 merged `2e6d14484319b4b48d3180b676e29032e4c77ab3` — server-to-server `website-enquiry-intake` + bounded admission guard;
- #624 closed completed;
- Piek `CGProductionHouse/PiekGroup-Website` Issue #16 / PR #17 remains OPEN, current verified head `e145a39cca8428094792ed25bfb672cb89d5557d`, exact-head Vercel green. It keeps the current contact visual and adds the durable contact form below it. Do not merge it until its Production-only backend env binding is present.

**Production schema — COMPLETE**
Project: `ehtjfntukiwbgptqgbzy`.

All four numbered repo migrations were applied in the exact required order and ledgered under their real repo versions:
1. `20261001181932 website_enquiry_transaction`
2. `20261002085355 website_enquiry_intake_guard`
3. `20261002090000 website_lead_lifecycle`
4. `20261002110000 website_enquiry_delivery_runtime`

Production ledger moved 147 -> 151 rows. The stored migration statements were verified byte-equivalent to the GitHub files. Do **not** use blanket `supabase db push` on this project: many older migrations were historically ledgered under different timestamps and the CLI sees a large false-unapplied set. Preserve the exact numbered ledger history.

Post-apply verification:
- 12 Website-enquiry tables;
- RLS enabled + forced;
- no anon/authenticated direct table grants;
- pipeline RPCs service-role only;
- authenticated access only through the intended exact-client Lead Inbox/lifecycle/metrics RPCs;
- no synthetic enquiries created during migration.

**Production Edge runtime — STEP 2 COMPLETE**
- `website-enquiry-intake` deployed ACTIVE **v1**;
- `verify_jwt=false` is deliberate because authority is the opaque per-endpoint `x-cg-intake-key`; browser-origin requests are refused by the handler;
- deployed source was fetched back and matches merged #625/current-main intake implementation;
- only platform-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are used internally;
- delivery worker + webhook remain undeployed / inactive for the first stored-lead pilot; outbound email is not required for the pilot.

**Piek Website 1 production binding — STEP 3 COMPLETE**
Exact production binding now exists:
- endpoint id `9287592d-c860-4e70-aeb1-f7e14643feba`;
- Website Editor ID `1`;
- Dynamics client `ed7aa1ae-de21-4151-a8f9-54796b234c1f` (Piek Group);
- environment `production`;
- canonical host `www.piekgroup.co.za`;
- endpoint enabled;
- `contact_form` schema v1 ACTIVE;
- recipient config v1 APPROVED;
- route `piek_head_office` -> existing public site contact `admin@piekgroup.co.za`;
- endpoint intake key generated by Postgres and intentionally **not** written to GitHub/chat/docs.

The recipient choice is grounded in Piek main's current public site source of truth (`src/data/site.ts`), not guessed from memory. A later client-confirmed routing change should create/update the canonical recipient configuration rather than rewriting history.

**Important secret rule**
Never print, paste, comment, log, hash, or otherwise expose the Piek intake key. If setting Vercel env, read it directly from production and pipe/set it without surfacing the value.

**IMMEDIATE NEXT SUPERVISOR ACTIONS — continue in this order**
1. Set Piek Vercel **Production only** server env:
   - `CG_ENQUIRY_INTAKE_URL` = canonical deployed `website-enquiry-intake` URL;
   - `CG_ENQUIRY_INTAKE_KEY` = Piek endpoint capability read directly from production without printing it.
   Confirm both names exist for Production only; do not expose values.
2. Re-read Piek PR #17 exact head/checks and current main. If still clean, merge #17 only after env is present.
3. Wait for the Piek production deployment to be READY on the merged head and confirm `www.piekgroup.co.za` serves that deployment.
4. Run **one controlled real Piek enquiry** through the live form. Use clearly synthetic supervisor acceptance data, not a real person's information.
5. Verify end-to-end:
   - safe receipt returned;
   - exactly one canonical enquiry row created for Piek Website 1;
   - exactly one lead-state row / exact-client Lead Inbox visibility;
   - no cross-client visibility;
   - mark the acceptance lead through Good -> Qualified (or Poor -> Closed-Lost if testing the other path);
   - Website Performance lead metrics update truthfully for the Johannesburg reporting month;
   - idempotent retry with the same submission key does not duplicate;
   - intake logs contain outcome/status only, no PII/key/body.
6. Mark the acceptance enquiry as test/synthetic according to the canonical packet so it does not pollute business reporting.
7. Update #405, Piek #16/#17 and this handover with the exact production receipt.

**Email is a separate later activation**
Do not block stored-lead / Lead Inbox acceptance on outbound email.
Still outstanding before email can go live:
- approved transactional provider (Resend is only the current candidate, not yet activated by this Website lane);
- verified CG sending domain / DNS;
- `WEBSITE_ENQUIRY_EMAIL_ENABLED`
- `WEBSITE_ENQUIRY_EMAIL_PROVIDER`
- `WEBSITE_ENQUIRY_EMAIL_FROM`
- `WEBSITE_ENQUIRY_RESEND_API_KEY`
- `WEBSITE_ENQUIRY_WORKER_SECRET`
- `WEBSITE_ENQUIRY_RESEND_WEBHOOK_SECRET`
- delivery worker/webhook deployment, provider webhook registration and worker schedule;
- real accepted/delivered/bounced/reconcile acceptance.

Until then, enquiries may be stored and worked in Dynamics normally; delivery jobs remain pending/inert and no blind resend is allowed.

**Website fleet context**
Red Oak remains the accepted end-to-end Website Performance reference. Published September Website snapshots also exist for Piek Group, Emmanuel Funerals and All Around PVC. Get Together, CG ARCC and JFJ remain future fleet reporting/contact rollout targets. Imbewu and Raadzaal are web-only clients and explicitly last. Do not confuse Website Operations enablement (9 verified CG-built sites) with full Dynamics reporting/enquiry activation.

**Commercial/product direction already locked**
Issue #389 is the premium client-portal / expansion authority: the client experience should show substantial current value and truthful optional upgrades (new CG website, LinkedIn, Google Ads, etc.) with clear request-to-CG/Amonique actions, without fake ROI/dark patterns. This is not the immediate blocker; finish the Piek real lead pilot first.

### #611 overnight safe lane — 1 October

- Baseline main: `04fe827ad2f724fcfe5af211541f776a67dfa85c`. No merge, deploy, config/provider/OAuth or production data/schema writes are authorized in this lane.
- Read-only production recount: 57 active / 57 confirmed packages; Sep/Oct strategies remain 94 amended v2 drafts + 20 unamended v1 drafts; standalone connections/tokens/OAuth states/callback receipts remain 0/0/0/0. No strategy approval/publication occurred.
- Closed stale PRs #569 and #577–#581. #569's TikTok behavior is superseded by merged #570/#567; the other five repeat stale artifact generation that would downgrade Neshora's reviewed evidence hash/source references. None contained missing launch code.
- Reproduced the source of the repeated artifact noise: strategy generator tests wrote into the frozen #513 directory. Generator tests now use isolated temporary copies; an executable recursive byte-hash regression proves all four generators leave reviewed evidence unchanged. Generator CLI defaults remain unchanged; no strategy content is changed.
- Authenticated production Chrome access is available as CG Production House Admin in a separate Dynamics tab. CA's Meta/Instagram tabs are untouched. Desktop Hub/Content render without observed console errors; further responsive acceptance and #437/#405 work continue under #611.

### #611 / #405 inert current-main recovery

Closed #422 M2A is absent from main. A new, unapplied transaction migration is proposed; no public adapter, recipient, sender or live data is activated. Existing marketing `client_contacts` and internal CG `business_development_leads` are not incoming client enquiries. Disposable six-session PostgreSQL tests cover tenant idempotency, rollback and browser privilege denial. Recovery closes missing-type, approved-route reassignment and default-service-grant gaps. See `WEBSITE-ENQUIRY-M2A-405-CURRENT.md`. Supervisor review and later CA production approval remain required; no overnight merge/deploy.

### #619 deterministic Meta boundary fixture — 2 October

Current-main baseline `2b72c0553f2c00f9d43e9a09ba76417b17981162`. Reproduced the obsolete wall-clock assertion in `metaFleetFreshnessBehavioral.test.mjs`; isolated correction uses test-scoped Node Date mocks only. At `2026-10-02T06:59:59Z` (Oct 1 Pacific), October bounds are null; at `07:00:00Z` (Oct 2 Pacific), they are Oct 1–Oct 1. Both now execute the real unchanged helper and eligibility predicate. Boundary fixtures pass under UTC and Johannesburg host timezones; 236 focused Meta/freshness tests pass, full suite 3340 passed / 16 skipped / 0 failed. Runtime defaults, America/Los_Angeles, provider/worker/config/data/Edge state remain unchanged. Exact verification/head recorded on #619 and its tiny PR; #613/#615/#616 branches are untouched and their legitimate preview-auth gates remain separate. No merge or production action in this lane.

2 Oct 2026: #614 merged (`2b72c05`). #405 PRs: #620 M2B Lead Inbox/lifecycle + Website Performance lead metrics, deterministic Good→Qualified / Poor→Closed-Lost, Johannesburg month (`20261002090000`, unapplied); #621 delivery runtime (`20261002110000`, unapplied), inert Resend adapter, durable provider-event inbox, worker `verify_jwt=false` + x-worker-secret — provider not approved, no secrets/emails. First pilot packet (Piek Group, Website 1; M2C intake adapter missing): `WEBSITE-ENQUIRY-PILOT-PACKET-405.md`.

## 1. Fresh supervisor recovery order

### #623 ordered finish — 2 October, no agent merge/production action

- Baseline `fd4f86bf3d3b13cc4b253f458b126540bdbc5d2c`: supervisor independently merged corrected #620 (`9185585`) then #621 (`fd4f86b`). All Website migrations remain unapplied. Independently verified 25 Website tests, three disposable PostgreSQL suites and actual Deno worker/webhook checks.
- Existing UI PRs reconciled sequentially, feature code unchanged, every additive receipt preserved: #613 `a763d5ff393518747491720d6d3a7bea242c0fab` (129 focused, full 3367 passed/16 skipped), #615 `747e30affb9ba95aede81aed5390a6d0e90bc28e` (189 focused, full 3361/16), #616 `23e0dc2e877c8e3f58f3fb2a828c10cfa390ff5b` (97 focused, full 3362/16). All build/scoped lint/diff and exact-head Vercel PASS. Changed-preview auth is an environmental gate; post-merge production smoke is not claimed in this user-prohibited-merge lane.
- Parallel M2C authority is existing #624/PR #625 plus Piek #16/PR #17. Overlapping #626 was closed unmerged; candidate commit `30c668fbc81c8a34780648eb3d0a6af66299e52c` preserved, unpublished site draft stashed. Do not activate that alternative API. Same-PR #625 hardening preserves canonical `x-cg-intake-key` / schema / receipt/Piek contracts, adding bounded persistent admission, body timeout/error handling and verified receipt shape. See `WEBSITE-ENQUIRY-INTAKE-624.md` for the new unapplied admission migration and exact protected sequence.
- Piek form was not mounted on current main; PR #17 requires CA/client form-placement approval. No Piek duplicate PR or provider/runtime/config action by this lane. Instagram/TikTok/strategy authority is untouched.
- Same-PR #625 hardening verification: 35 Website tests; full 3383 total / 3367 passed / 16 skipped / 0 failed with canonical placeholder env; build/scoped lint/diff and actual Deno intake check PASS. Real disposable PG17 intake→canonical enquiry/outbox→exact-client Inbox, 20-session admission, hourly exhaustion, monotonic bucket and RLS/grants PASS. Browser retry encountered creation timeout followed by `Debugger unattached`; the existing changed-preview tab remains at `/login`. No authenticated changed-code acceptance is claimed and no credentials/tokens were copied.
- Existing Piek #17 additionally hardened in the same PR at `e145a39cca8428094792ed25bfb672cb89d5557d`: approved exact upstream URL + no credential redirects, bounded body/error handling, valid receipt/time, frozen entire ambiguous retry payload and same-tick duplicate guard, truthful receipt-versus-email/honeypot copy. 11 tests/typecheck/build/scoped ESLint (existing Dynamics tool, no new site dependency)/diff PASS; client bundle scan finds no capability/config/function strings. Local production-build desktop 1280 and 375/390/430px synthetic fail-closed acceptance passed, no overflow or console warn/error; screenshot evidence retained under `C:/Users/chris/.codex/artifacts/issue-623/`. No real submission, email or authenticated production pilot. CA/client must approve the newly mounted form and privacy/recipient scope before rollout. The canonical server-only env names remain `CG_ENQUIRY_INTAKE_URL` and `CG_ENQUIRY_INTAKE_KEY`, Production only.
- Control Centre write-back could not be grounded: connected Drive searches for `CG Dynamics Control Centre` and `Control Centre` returned no accessible spreadsheet; mandatory current docs contain no exact tracker URL. No guessed/replacement sheet or cell writes. GitHub owning issues/#381 and this handover contain the durable current receipts; restore exact tracker access/reference separately if it remains an active coordination authority.

A new supervisor must recover in this order:

```text
AGENTS.md
-> this handover
-> latest Issue #381 comments
-> refetch current main
-> current #505 / #513 / #377 / #217 state
-> live Supabase / Vercel / Meta state only when consequential
-> act
```

GitHub + verified production state outrank old chat summaries.

Do not ask CA to repeat project history.

Before code, merge or production action, refetch `main`.

## 2. Supervisor operating rules

CA expects the supervisor to run the project rather than hand routine work back to her.

- Use one clear next action and give CA an exact copy/paste Codex prompt when a manual agent is needed.
- Routine safe docs/code/test/merge work may proceed after verification.
- Explicit CA authorization is still required for protected gates: production migrations/data mutation, secrets/config writes, provider settings/submissions, OAuth/consent, App Mode/Live changes, external publishing/spend, destructive actions, strategy approval/publication and equivalent consequential writes.
- Do not touch CA's active Instagram/Meta browser session unless the task is explicitly assigned to that browser lane.
- Do not guess social identities, client mappings, provider ownership or package truth.
- Never expose provider passwords, secret values, encryption keys, tokens, digests or ciphertext in GitHub/chat/logs/screenshots.
- Existing non-recoverable secrets must not be rotated merely to make an audit easier.
- Instagram Page-linked route remains preferred; standalone Instagram is fallback only for an exact professional account unavailable through the Page route.
- Strategy approval/publication remains a human protected gate.
- The communal company OAuth model does not cryptographically prove which physical human is using a ChatGPT Project. Do not claim #377 solved that stronger identity problem.

## 3. Current verified production / GitHub baseline

The latest runtime-affecting Instagram action is the completed bounded #598
app-secret/public-origin packet recorded above; no source deployment or schema
change accompanied it. Earlier separately CA-authorized #600 encryption-pair
reset was performed after PR #607 merged at:

`1584604de26d9d678225f447e8a895738563c044`

The reset receipt is carried by PR #608. Always refetch main rather than assuming the SHA above is current after this handover merges.

Important completed runtime gates:

- #588 report-selection clock/publication regression fixed in PR #589; full suite passed **3299/3299**.
- #593 provider callback code merged in PR #594.
- #595 callback production rollout completed:
  - approved callback migration applied as live ledger **20261001142241 / instagram_provider_callbacks**;
  - `instagram-oauth-callback` deployed;
  - `instagram-deauthorize` deployed;
  - `instagram-data-deletion` deployed;
  - external callback functions preserve `verify_jwt=false`;
  - activation remained OFF.
- #600 encryption pair is now known-good under explicit CA authorization:
  - canonical RFC4648 base64 PASS;
  - decoded key length **32 bytes**;
  - runtime version-format PASS;
  - existing AES-256-GCM helper in-memory encrypt/decrypt round-trip PASS;
  - only `INSTAGRAM_TOKEN_ENCRYPTION_KEY_B64` and `INSTAGRAM_TOKEN_ENCRYPTION_KEY_VERSION` were overwritten;
  - no plaintext/digest/key material is stored in repo/docs.
- The Supabase config update advanced all 42 Edge Function revision numbers by one, but source bundles/JWT contracts stayed unchanged. OAuth callback is therefore currently reported as v7 and deauthorize/data-deletion as v2 without source drift.
- Standalone Instagram connections/tokens/OAuth states/callback receipts were **0 / 0 / 0 / 0** around the reset.
- Activation remains literal **OFF**.

Do not replay #595 or repeat #600 crypto-validation attempts.

## 4. #505 provider closure — PRIMARY launch lane, still OPEN

### Instagram exact current state

Fleet truth:

- recurring-social eligible: **47**
- eligible canonical Instagram mappings: **22**
- Instagram-unmapped recurring-social clients: **25**
- explicitly excluded: **10**
- held: **0**
- standalone connections: **0**
- standalone encrypted token rows: **0**
- pending standalone reviews: **0**

Eight reviewed handle identities are preserved as evidence only:

- Bouwer & Coetzee Attorneys — `@bouwer_coetzee_attorneys`
- Emmanuel Funerals — `@emmanuelfunerals`
- Emoya Estate Driving Range — `@emoyadrivingrange`
- Novus Steel — `@novus_steel`
- Piek Group — `@piekgroup`
- Red Oak — `@official.redoak`
- Toyota Bloemfontein — `@cfaomobilitytoyotabloemfontein`
- We Ar Fuels — `@we_ar_fuels`

These handles do **not** prove owner access, professional account type or standalone eligibility.

Current Meta/App Review truth from authenticated provider inspection:

- CG Dynamics Meta app: `976168728361566`
- Instagram business-login product/app: `1383360116973315`
- App Mode: **Development**
- review request: **empty / not submitted**
- `instagram_business_basic`: Standard access
- `instagram_business_manage_insights`: Standard access
- Insights Advanced Access remains blocked behind verification/review requirements
- CG business portfolio is **Unverified**
- access verification is blocked until business verification completes
- existing saved Instagram OAuth redirect is correct and must be preserved

Current config/provider blockers:

- #598 app-secret and public-origin gates are **COMPLETE**; correct Instagram-product secret readback passed and `APP_PUBLIC_URL=https://www.cgdynamics.co.za`.
- standalone activation remains OFF
- All five locked Meta legal/callback fields are saved and reload-readback verified; see the completion receipt above. Remaining provider gates are Business/Access Verification, authorized fixture, Review/Live and later consent, not missing URL/config prerequisites.

Reviewed public values to use only under explicit provider-save authority:

- Privacy: `https://www.cgdynamics.co.za/privacy-policy`
- Terms: `https://www.cgdynamics.co.za/terms-of-service`
- App Basic deletion instructions URL: reviewed public privacy/deletion instructions route per #598 pack
- Instagram Deauthorize callback:
  `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-deauthorize`
- Instagram Data deletion callback:
  `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-data-deletion`

Preserve the OAuth redirect exactly:
`https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-oauth-callback`

### Demo / owner fixture blocker

The only proven CG-owned professional account inspected, `@cg_production.house`, is already Page-linked/canonical and must not be unbound or rebound merely to manufacture a standalone demo.

No proven eligible unmapped CG-owned professional standalone fixture currently exists.

Client-branded portfolio assets are not a consent-free test pool.

### Remaining protected Instagram order

The next supervisor should treat this as the current sequence:

Steps 1–4 below are completed by the 2 October authorized #598 receipt above.
Do not re-provision or replay saves. Step 5 is also already satisfied. The next
protected decision is step 6 Business Verification; not authorized by #598.

1. Re-read #598 save pack and current live config/provider state.
2. Obtain exact CA authorization for only:
   - secure provisioning of the correct Instagram-product `INSTAGRAM_APP_SECRET`;
   - `APP_PUBLIC_URL=https://www.cgdynamics.co.za`;
   - the five reviewed Meta legal/callback field saves.
3. Save/read back only those approved values while activation remains OFF.
4. Reverify callback health and exact app-secret/app-ID pairing without exposing the secret.
5. The accepted #586 shared credential-expiry correction is now **production-live and accepted** under CA's explicit authorization:
   - `meta-sync` ACTIVE v53;
   - `meta-sync-worker` ACTIVE v40;
   - both preserve `verify_jwt=false`;
   - both deployed copies parity-match the authorized current-main `instagramReportingCredential.ts` helper;
   - standalone connections/token rows/OAuth states/callback receipts/pending reviews remained 0/0/0/0/0;
   - no secret/config/provider/OAuth/migration/data/cron change occurred and activation remains OFF.
   Do not redeploy this gate unless later code materially changes it.
6. Complete Meta Business Verification with CA's actual company documents/private verification channel.
7. Complete Access Verification.
8. Establish an owner-authorized, genuine standalone professional demo fixture/tester path; do not borrow an unauthorised client account.
9. Record genuine provider OAuth/demo evidence.
10. Request only:
    - `instagram_business_basic`
    - `instagram_business_manage_insights`
11. Submit App Review / Advanced Access only under explicit authority.
12. After provider approval, move to required Live state under explicit authority.
13. Only then enable `INSTAGRAM_STANDALONE_LIVE_ACTIVATION_ENABLED=true` under explicit authority.
14. Run one exact-client Page-first controlled OAuth:
    - exact provider account ID/username;
    - Business/Creator type;
    - both scopes;
    - encrypted persistence;
    - pending review;
    - separate admin confirmation;
    - exact-client isolation;
    - canonical reporting/freshness.
15. Roll out remaining clients individually. Unresolved identities remain owner/client-evidence gated.

Do not close #505 merely because code/runtime prerequisites are ready. Provider verification, review, exact-owner consent and first real standalone acceptance still matter.

### TikTok current state

TikTok safe evidence work is exhausted:

- connected: **10**
- needs reauth: **0**
- unconnected: **37**
- 4 `CLIENT_HELP_REQUIRED`: Emmanuel Funerals, Emoya Estate Driving Range, Piek Group, We Ar Fuels
- 2 exact provider-rejected local records:
  - Bat Hill Royale: account does not exist
  - WiseRide: credentials rejected
- 31 exact identity/login evidence gaps

Do not guess or repeatedly retry TikTok credentials. Remaining work requires exact owner/client evidence.

Durable ledger:
`docs/ops/TIKTOK-505-EXACT-IDENTITY-BLOCKERS-2026-10-01.md`

## 5. #513 strategy — runtime draft work complete, approval/publication protected

Current production Sep/Oct strategy truth:

- **114** canonical rows total
- **94** reviewed staff-amended v2 rows across 47 exact clients
- **20** non-applicable unamended v1 rows
- **0 approved**
- **0 published**

The protected #513 amendment migration/RPC was applied and verified. Neshora Sep/Oct rows were amended in place; no duplicate rows were created.

Launch acceptance manifest from PR #560 says **94/94** reviewed rows are ready for human approval review, but approval and publication are separate protected transitions.

Important quality caution:
- client-facing strategy projection is published-only;
- staff may preview safe reviewed drafts;
- unsafe/internal strategy text must fail closed;
- do not approve/publish merely because the old manifest says ready if current row content has drifted. Re-read current production before transition.

Next #513 action requires explicit CA approval for the exact approval/publication scope.

## 6. Reporting / packages / portals

Current durable truth:

- **57/57** active-client package receipts confirmed
- service scope: **47 recurring-social / 10 non-social-or-not-currently-social / 0 held**
- **119** truthful reports currently published across 40 active clients
- remaining **56** report rows are genuine evidence gaps:
  - 47 `MISSING_CANONICAL_REPORT`
  - 9 `NO_IN_MONTH_POST_EVIDENCE`
- never fabricate missing report/provider facts
- Portal rollout: **46/46** enabled exact mappings across 46 clients/auth users
- no second portal architecture should be created

#588 fixed monthly report selection so one supplied clock governs month completion and client-facing selection is explicit published-only.

## 7. Website Performance — #573 COMPLETE

#573 is closed and authenticated UI accepted.

Exact active CG-managed sites:

- Piek Group — `www.piekgroup.co.za`
- Emmanuel Funerals — `emmanuelfunerals.com`
- Red Oak — `www.redoakgroup.co.za`
- All Around PVC — `www.allaroundpvc.co.za`

September guarded Website snapshots are already live/published. Do not create another September snapshot or republish merely to refresh age.

Authenticated desktop + 375px acceptance passed with no cross-client leakage/internal identifiers.

## 8. #377 MCP reliability — operational subset COMPLETE, issue intentionally still OPEN

Production `cg-dynamics-mcp`:

- ACTIVE v24
- `verify_jwt=false`
- canonical task ownership uses `planner_task_assignees`
- Christie-Ann acceptance: 19 tasks / 19 exact assignment links
- `error: null` is correctly treated as success
- cross-profile task read was refused

The stronger physical-human identity/delegation problem remains unsolved because company OAuth is intentionally communal. That conceptual limitation is why #377 remains open. Do not reopen stale #380 delegation code or pretend Project UUID context proves the person at the keyboard.

## 9. #217 mobile/stale-task lane — only optional physical-phone signoff remains

The four historical stale tasks are archived and absent from canonical active task reads.

Authenticated responsive checks passed at 375/390/430px with no Hub/Work horizontal overflow.

No current code/data defect reproduces.

Keep #217 open only for optional real physical-phone human signoff unless a new reproducible defect appears.

## 10. Historical Instagram crypto issues — DO NOT REPEAT

#600 is **closed** because the known-good encryption pair was explicitly reset and validated.

#602 / #604 / #606 are historical failed access/auth attempts. Their failures do not imply crypto failure and are superseded by the #600 known-good reset.

Do not:
- redeploy temporary validators/bridges;
- chase the non-recoverable old `WORKER_INTERNAL_TOKEN`;
- weaken auth;
- rotate worker credentials for audit convenience.

Any temporary validator functions were removed; original function inventory remained intact.

## 11. Other current / post-launch lanes

Do not let stale open issues outrank current launch authority.

Primary current launch blockers:
1. #505 protected Instagram provider/config/review/real-consent sequence.
2. #513 protected strategy approval/publication if CA wants client-visible strategy live.
3. #217 optional physical-phone signoff only.

Operationally accepted with explicit limitation:
- #377 MCP subset is live; only stronger human identity concept remains.

Post-launch / next milestone candidates, re-read live issue before acting:
- #493 LinkedIn provider connection
- #361 CG Hours remaining own-hours/travel-km activation work
- #405 Client Lead Inbox + lead-quality feedback loop
- #433 continuous research integration
- #437 research-backed Content Guideline intelligence
- #335 Google Ads + GA4 attribution
- #374 Email Marketing
- #220 Canva/publishing
- #396 Client Portal Library/Brand Hub
- #404 CG Hours client bridge

Do not start one of these merely because it is open if #505/#513 launch closure is still the priority.

## 12. Exact next supervisor action

On a fresh chat:

1. Refetch `main`, #381, #505 and this handover.
2. Confirm PR #608 / this handover is merged and Vercel green.
3. Confirm #600 closed; treat #602/#604/#606 as historical/superseded.
4. Re-read `docs/ops/INSTAGRAM-CONFIG-META-SAVE-PREFLIGHT-598.md` and `docs/ops/INSTAGRAM-STANDALONE-PROVIDER-ACTIVATION.md`.
5. Read-only recheck the exact live Instagram config names/provider fields if consequential.
6. The #598 app-secret/public-origin/five-URL packet is COMPLETE with activation OFF. Next separate protected #505 session is Meta Business Verification with CA's exact company documents, then Access Verification and a genuine owner-authorized review fixture. Review/Live/activation/OAuth remain separately protected.
7. Do not cross those further protected gates without CA's explicit authorization.
8. After each consequential action, update #505, #381 and this handover.

The supervisor should keep CA out of routine mechanics and bring her in only for the exact protected decisions, provider verification/2FA/document steps or human review gates that truly require her.
