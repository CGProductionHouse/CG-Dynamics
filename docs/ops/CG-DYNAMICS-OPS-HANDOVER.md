# CG Dynamics Ops Handover

Status: **CURRENT authority for a fresh supervisor chat**

Updated: **1 October 2026** after reconciliation of the #600 Instagram encryption reset, #595 callback rollout, #505 provider closure state, #513 strategy state, #377 MCP production acceptance and #573 Website Performance closure.

This file is intentionally current-state-first. Historical failed attempts are summarized only where they prevent repeated work.

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
