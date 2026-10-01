# CG Dynamics Ops Handover

Status: **CURRENT authority for a fresh supervisor chat**

Updated: **1 October 2026** after reconciliation of the #600 Instagram encryption reset, #595 callback rollout, #505 provider closure state, #513 strategy state, #377 MCP production acceptance and #573 Website Performance closure.

This file is intentionally current-state-first. Historical failed attempts are summarized only where they prevent repeated work.

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
### #611 overnight acceptance — 2 October handoff

Baseline remained `04fe827ad2f724fcfe5af211541f776a67dfa85c`. Five independent current-main PRs await supervisor review; none merged/deployed overnight:

- #612 `a9014bd40ab845566c570985a45a19a37b1d23ac`: sandbox test generators so verification cannot rewrite frozen #513 artifacts; 24 focused, full 3332 passed / 16 skipped.
- #613 `1cb8d9e1d84a0b40c90e1de3dc5c21e187293d49`: recovered #437 guidance-only Creative Intelligence, existing specialist routing, exact client/month/provenance and explicit unknowns; 135 focused. Authenticated preview sign-in remains required; production session does not authenticate preview.
- #614 `e5e6527cb62747cfcc71fe0d7742382a31b819d2`: #405 inert M2A transaction foundation; 136 focused, full 3339 passed / 16 skipped, real disposable PostgreSQL 17 acceptance and GitHub CI green. Migration `20261001181932_website_enquiry_transaction.sql` is UNAPPLIED; no public intake/mail sender/provider path. Requires supervisor security review then separate protected preflight/CA apply.
- #615 `2c85c9e393a3acd338992bad74349b7a9bf6d1fc`: proven Integrations TikTok fleet false-disconnected summary; uses existing canonical manager queue, preserves unavailable states; 146 focused, full 3335 passed / 16 skipped.
- #611 onboarding follow-up: production has 57 active confirmed clients but zero sessions; empty session list wrongly said no active clients. Separate inventory/session empty-state projection also suppresses false-empty claims on loading/read errors. 97 onboarding tests; full 3336 passed / 16 skipped. Link generation remains disabled behind OneDrive adapter gate.

All five builds/scoped lint/diff checks passed; existing bundle-size warning remains. #612–#615 Vercel green at listed heads. Their additive handover notes must all survive supervisor merge reconciliation.

Closed stale #569 (current-main superseded TikTok reporting) and #577–#581 (older generated Neshora artifacts would overwrite reviewed 79-asset evidence; #578 also had unused fake test env). No unique accepted runtime work discarded.

Read-only production: original #513 accepted manifest fingerprints still match 92/92 full rows + 2/2 Neshora selected-field rows, all 94 amended v2 drafts, zero approved/published. This is NOT quality approval: newer #567 quality proposals remain unapplied, with Piek's old draft still needing canonical quality amendment before human approval/publication. No strategy writes performed.

Authenticated CG Production House Admin Chrome acceptance: Hub, Work, Content, Integrations, TikTok queue, Performance, Clients/package queue, Reports, Client Preview/Piek Website and mobile Assistant open/close. Work, Integrations, Performance, Clients and Piek Website measured 375/390/430 with no horizontal body overflow; Content and TikTok queue checked at 375. October defaults and published September selection remained truthful. Piek website retains exact host, 1 visitor / 1 pageview, partial-from-27-Sep note, stale snapshot and unavailable actions/enquiries. No captured console warnings/errors. Actual client-role/physical phone and authenticated changed-preview acceptance were NOT performed; do not equate admin preview/emulation with those checks.

Fleet readback: Instagram 47 eligible / 22 canonical / 25 unmapped / 10 excluded / 0 held / 0 standalone; TikTok 10 connected / 37 outstanding (4 owner-help, 2 provider rejection, 31 identity gaps). Meta summary FAILED (1 failed, 17 stale, 47 partial), Microsoft STALE (6 sources, last full success 19 August), not false PASS. MCP ACTIVE v26 includes canonical Google Ads audit action; no new MCP defect reproduced. #493 remains explicitly timing-held; #441 is already merged, not missing product work.

No production migrations/data writes, Edge deploys, secret/config/provider/OAuth changes, strategy approval/publication, messages/publishing, Microsoft or OneDrive writes. #600 crypto work and CA provider tabs untouched. Morning priority: review #612 first to stop verification modifying reviewed evidence, then review the four other bounded PRs with legitimate preview auth before UI merge. #598 protected provider activation, strategy quality amendment/approval, freshness reconciliation, owner consent and optional physical-phone signoff remain separate gates.

### #611 reconciliation — 2 October current follow-up

Supervisor merged #612 as current main `4d291f85bf20c7e95918fab0c01bf6d43053212f`. The overnight receipts above are retained as historical evidence, not current PR heads. #613, #614, #615 and #616 are being sequentially rebased onto that exact main; no merge or protected production action is authorized in this follow-up. Accepted feature/schema/test files are unchanged; every base and original lane handover receipt is preserved verbatim.

Reverified/pushed heads: #613 `c6063eb2a3593311eabdf1bf552cc13b04a7920f` (124 focused, full 3342 passed / 16 skipped); #614 `280d483fcbdbfcf46e62198f069330fe053f8e7a` (96 nearest regressions, full 3340 passed / 16 skipped, disposable PostgreSQL acceptance + CI green); #615 `112dec7006dc1625de6b0e175e8bb3ad8451ce41` (189 focused, full 3336 passed / 16 skipped). All three builds/scoped lint/diff checks passed; #612 prevents frozen strategy artifact modifications. #616's final head/results and all final Vercel states are recorded on the existing PRs and #611 after verification.

Changed-preview desktop/mobile acceptance is not yet proven. Initial Chrome connection/preview-open timeouts were recovered through the documented exact-profile tab API. All three current green previews (#613/#615/#616) redirect to `/login` and visibly show Dynamics **Sign in**; no legitimate authenticated preview session is available. Local sign-in screenshots are in `C:/Users/chris/.codex/visualizations/611-reconciliation-2026-10-02`. No credentials/tokens were copied or guessed and no provider tab was used. #613/#615/#616 retain their legitimate preview-auth acceptance gate; current production acceptance is not a substitute. #614 changes no UI and its production migration remains UNAPPLIED/protected. Continue safe PR verification when an auth lane is blocked; do not merge, deploy or cross any production/provider/OAuth/data/strategy transition.

#616 final docs-only rerun: 97 focused passed; full suite 3336 passed / 16 skipped / 1 failed after Pacific midnight. The unchanged current-main fixture `tests/metaFleetFreshnessBehavioral.test.mjs:358` assumes October has no completed day, but the real clock now correctly yields 1 October. Earlier #616 full run passed before that boundary. This is a pre-existing calendar-dependent test blocker, not an onboarding runtime regression; no Meta runtime/test scope was altered. Final build/lint/diff and exact pushed head are recorded on #616/#611. Legitimate authenticated preview acceptance remains separately blocked.
### #623 current reconciliation — 2 October

The historical #616 calendar-fixture failure above is superseded by merged #619/#622 on current main `de57480e11367d448a0056c34f7ff14f1aa8f0ec`. #613/#615/#616 are reconciled sequentially onto this main, preserving complete additive receipts and unchanged accepted feature scopes. Latest CA instruction prohibits merges even though #623's issue text permits them; therefore changed production smoke remains dependent on a separately authorized merge, not a claimed acceptance. Exact current heads/full verification are recorded on the existing PRs and #623. Continue safe #405 code work rather than treating unavailable preview auth as a runtime defect; no token copying/auth weakening or protected production action.

2 Oct 2026: #614 merged (`2b72c05`). #405 PRs: #620 M2B Lead Inbox/lifecycle + Website Performance lead metrics, deterministic Good→Qualified / Poor→Closed-Lost, Johannesburg month (`20261002090000`, unapplied); #621 delivery runtime (`20261002110000`, unapplied), inert Resend adapter, durable provider-event inbox, worker `verify_jwt=false` + x-worker-secret — provider not approved, no secrets/emails. First pilot packet (Piek Group, Website 1; M2C intake adapter missing): `WEBSITE-ENQUIRY-PILOT-PACKET-405.md`.

## 1. Fresh supervisor recovery order

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

The last runtime-affecting Instagram action was the separately CA-authorized #600 encryption-pair reset performed after PR #607 merged at:

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

- `INSTAGRAM_APP_SECRET` is **absent**
- `APP_PUBLIC_URL` still points to the old Vercel origin and must be corrected to:
  `https://www.cgdynamics.co.za`
- standalone activation remains OFF
- Meta Privacy URL remains unsaved/incorrect in provider settings
- Meta Terms URL remains incorrect
- App Basic deletion instructions URL remains incorrect
- Instagram Deauthorize callback URL remains unsaved
- Instagram Data deletion request URL remains unsaved

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
6. The next separate protected #505 session is:
   - `INSTAGRAM_APP_SECRET`;
   - canonical `APP_PUBLIC_URL`;
   - five Meta legal/callback saves;
   while activation remains OFF.
7. Do not cross that protected write gate without CA's explicit authorization.
8. After each consequential action, update #505, #381 and this handover.

The supervisor should keep CA out of routine mechanics and bring her in only for the exact protected decisions, provider verification/2FA/document steps or human review gates that truly require her.
