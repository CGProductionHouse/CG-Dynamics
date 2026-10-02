# #505 executable Instagram rollout matrix — 2 October 2026

**Later Oct 2 superseding receipt:** #598 config/legal packet is COMPLETE, not the
pending gate recorded below. Current provider state, three newly corroborated
identity candidates (not promoted queue handles), verification checklist and
draft review packet: [current receipt](INSTAGRAM-505-VERIFICATION-REVIEW-PACKET-2026-10-02.md).
Historical Page-first results/eight reviewed handles remain intact; no binding authority.

Baseline: `2e6d14484319b4b48d3180b676e29032e4c77ab3`. Instagram only.
Authority: #505 supervisor comment 5949760923 and current production, not old
campaign counts or generic `active=true`. No Website or TikTok execution.

## Live evidence and boundaries

- SELECT-only production recount: 57 active, 47 recurring-social eligible,
  10 excluded, 0 service-scope held; 22 eligible canonical Instagram mappings,
  **25 unmapped**. The package receipt classifier is the existing canonical
  `classifySocialProviderEligibility`, not a new eligibility rule.
- At 2026-10-02 10:13:52.287647 UTC, standalone connections, tokens, OAuth states
  and provider callback receipts remain **0 / 0 / 0 / 0**.
- Authenticated CG Production House Admin Chrome, canonical production
  `/admin/integrations/meta`: read-only **Load Page-linked assets** returned
  HTTP 200. No queue row exposed a Page-linked Instagram account. Fifteen saved
  Pages appeared without an Instagram option; Red Oak's sixteenth saved Page
  was absent from discovery and rendered the existing-linked-page fallback.
  Nine clients have no saved Page. Neshora and WiseRide Page-picker suggestions
  are not saved exact-client mappings and were not promoted to identity proof.
- This is an **observed discovery result**, not proof no Instagram account exists.
  The current discovery implementation requests up to 100 Pages without following
  pagination and may have per-Page access limitations. Do not call this complete
  provider inventory. The response body could not be retrieved from browser CDP;
  the HTTP status and rendered exact-client queue are the acceptance evidence.
- Eight reviewed handles are preserved unchanged. No new public identity was
  sufficiently proven for the remaining 17. A populated private login record is
  not proof of current public username, account type, access or consent.
- The approved local source's Instagram column was privately checked: nine of
  the 17 have populated matching/supporting records, none contains an explicit
  public Instagram profile URL. The other eight have blank/no matching records.
  No usernames, passwords or credential values were emitted, used or persisted.
- **0 CONNECTABLE now**: global provider/config gates remain closed. Eight have
  reviewed identity evidence; 17 require exact identity confirmation. None of
  the eight is newly claimed to be an owner-authorized professional account.

## Ordered exact-client matrix

`Saved Page` below is existing production authority; `none` is null, not a
permission to infer a Page. Every row remains blocked by the global gates below
as well as its one explicit client-specific next evidence action.

| # | Exact active client | Saved Page | Preserved reviewed handle | Exact next human/provider blocker and evidence |
| --- | --- | --- | --- | --- |
| 1 | Bloem Action Sports | none | unknown | Owner must attest the exact current professional profile. Local p1 BLOEM ACTION SPORTS is populated but not a public identity; official [contact](https://bloemactionsports.co.za/contact) supplies Facebook, not a verified Instagram identity. |
| 2 | Bohemia Quick Stop | 587553944449915 | unknown | Exact owner Instagram identity needed; local p1 BOHEMIA QUICK STOP Instagram cell is blank. Existing Quick Shop name alias is not account proof. |
| 3 | Bouwer & Coetzee Attorneys | 1018449168019990 | @bouwer_coetzee_attorneys | Owner must verify this exact account is Business/Creator and authorize consent. Aug 6 reviewed source; Oct 2 [first-party site](https://cgprdocuctionhouse.wixstudio.com/bouwer) still links this handle. Reject the site's unrelated Wix-company Instagram link. |
| 4 | Central Canvas | 726910070765312 | unknown | Exact owner Instagram identity needed. Local p1 CANTRAL CANVAS cell blank; Oct 2 [official site](https://centralcanvas.co.za) exposed no verified Instagram URL. Historical spelling does not prove identity. |
| 5 | Daisy & Co | 110734930536373 | unknown | Owner must confirm current public profile from the populated local p1 DAISY&CO record. [Preller Square listing](https://psquare.co.za/project/daisy-co/) proves the Bloemfontein business, not an Instagram account; reject overseas same-name businesses. |
| 6 | Ehrlich Park Butchery | 111031294270801 | unknown | Owner must confirm current exact public profile; supporting local p2 EHP SLAGHUIS record populated. Oct 2 [official site](https://www.ehpbutchery.co.za) yielded no verified Instagram URL. |
| 7 | Emmanuel Funerals | 146184502187077 | @emmanuelfunerals | Owner must verify professional type and authorize exact-account consent. Oct 2 [official site](https://emmanuelfunerals.com) links the preserved handle. |
| 8 | Emoya Estate Driving Range | none | @emoyadrivingrange | Owner must verify professional type and authorize exact driving-range account consent; Aug 7 reviewed profile screenshot, not a fresh provider verification. Never substitute the estate account. |
| 9 | Forklift Trucks | none | unknown | Owner must attest that the supporting populated local p2 FORKLIFT record belongs to this exact client and supply current professional-profile evidence. Generic industry/name matches rejected. |
| 10 | Hino Trucks | none | unknown | Owner must identify the exact Bloemfontein/Oranje dealer account; [official dealer page](https://www.cfaomobility.co.za/find-a-dealer/hino-bloemfontein-oranje) links national @cfaomobility, which is not evidence for this client. No matching local record. |
| 11 | HMHI | 166306336713110 | unknown | Owner must confirm the current profile from populated local p2 HMHI record. [Hill McHardy & Herbst](https://hillmchardy.co.za) is the correct firm; HMH Attorneys in Lydenburg is not this client. No verified Instagram URL on Oct 2 site. |
| 12 | Human Auto | none | unknown | Exact client/dealer account and owner evidence required; [official group site](https://www.humanauto.co.za) did not expose a verified Instagram identity. Do not infer a Bloemfontein account from Kimberley/Welkom/group assets. No matching local record. |
| 13 | Jenkor | none | unknown | Owner must supply this exact client's current public profile; local p2 JENKOR cell blank. Cape Town Jenkor Brick Sales is an unproven different identity and was rejected. |
| 14 | Neshora Oxygen | none | unknown | Owner must attest exact professional-profile identity from populated local p2 NESHORA record. Suggested provider Page is not a saved mapping or Instagram identity. |
| 15 | Novus Steel | 707165899142393 | @novus_steel | Owner must verify professional type and authorize consent; Oct 2 [official site](https://novussteel.co.za) links the unchanged reviewed handle. |
| 16 | Piek Group | 344781792041700 | @piekgroup | Owner must verify professional type and authorize consent. Retained Sep 22 reviewed first-party evidence; no Piek website inspection or Website work in this pass. |
| 17 | PSG Bloemfontein | 1419154644812803 | unknown | Owner must confirm the exact Donald Murray branch profile; local p3 PSG record populated but branch identity unproven. Do not bind national PSG Financial Services. Saved Page names the local branch. |
| 18 | Red Oak | 117937152934535 | @official.redoak | Exact saved Page access must be recovered/rechecked by CA before declaring the Page route unavailable. Page absent from Oct 2 discovery. Oct 2 [official site](https://www.redoakgroup.co.za) preserves the reviewed handle, not provider consent. |
| 19 | Supa Quick BFN | 674483549349334 | unknown | Owner must supply exact BFN profile and branch scope; [Wiseman contact](https://wisemangroup.co.za/contact-us/) lists multiple BFN stores. No matching local record; do not reuse Centurion/group identity. |
| 20 | Supa Quick Centurion | 2129885203953798 | unknown | Owner must supply the Centurion Lifestyle professional profile; saved Page already identifies Lifestyle, supported by [Wiseman contact](https://wisemangroup.co.za/contact-us/). No matching local record. Do not broaden to all Centurion stores. |
| 21 | The Staffordshire | 326455741182925 | unknown | Owner must attest current exact profile from supporting local p3 THE STAFFY record. Historical thestaffordshirepub mention is not current verified evidence and is not promoted. |
| 22 | Tobich Optics | 109396908107344 | unknown | Owner must prove the exact Otjiwarongo profile/scope; local p3 TOBICH OPTICS record populated. [Current site](https://www.tobichoptics.com) lists Windhoek practices, so a group/Windhoek profile cannot replace the saved Otjiwarongo Page. |
| 23 | Toyota Bloemfontein | none | @cfaomobilitytoyotabloemfontein | Owner must verify professional type and authorize exact dealer-account consent. Preserved #505 reviewed identity, not national @cfaomobility. No matching local record. |
| 24 | We Ar Fuels | 101633701368819 | @we_ar_fuels | Owner must verify professional type and authorize consent; retain Sep 22 first-party-reviewed identity. Oct 2 non-www website returned no Instagram link; absence does not invalidate the reviewed handle. |
| 25 | WiseRide | none | unknown | Exact owner professional-profile identity required; local p3 WISERIDE cell blank. [Wiseman contact](https://wisemangroup.co.za/contact-us/) proves the division, not its Instagram account. Reject reuse of canonical wisemangroup.za; suggested Page is not a receipt. |

The client UUIDs and Page-to-client relationships were read from production;
execution must re-resolve the exact UUID from that canonical row, never names.
No public/group candidate above was added to `instagramConnectionQueue.ts`.
Reviewed handle authority: [#505 comment 5800495869](https://github.com/CGProductionHouse/CG-Dynamics/issues/505#issuecomment-5800495869).
Bouwer/Emoya screenshot provenance remains in their verified-source-update docs.

## Already satisfied — do not replay

- #595 callback migration and deployments are live; no namespace backfill needed.
- #600 accepted known-good encryption pair is satisfied; no revalidation/reset.
- Inventory Oct 2: OAuth start v6, OAuth callback v7, connection confirm v6,
  deauthorize v2 and data deletion v2 ACTIVE. Existing external-callback JWT
  configuration is unchanged. Meta sync v53 and worker v40 ACTIVE; the accepted
  shared credential-expiry correction is already deployed, not a new gate.
- Existing Meta/Page reporting and all 22 canonical mappings are untouched.

## Exact next protected action and executable order

**Next CA authorization:** the bounded #598 configuration/legal-save packet only:
securely configure the correct Instagram-product `INSTAGRAM_APP_SECRET`, correct
`APP_PUBLIC_URL` to `https://www.cgdynamics.co.za`, and save/read back the five
exact public legal/callback fields below. Keep activation **false**. Do not bundle
App Review submission, permission changes, Live mode, tester additions or OAuth.

Names-only Oct 2 inspection: all existing required names are present except
`INSTAGRAM_APP_SECRET`; activation matches literal false; public origin still
matches the old Vercel origin. No secret values/digests were emitted. Current
Meta dashboard was deliberately untouched; its last inspected Oct 1 state is
Development, both two reporting scopes Standard, empty review request,
Unverified business/access gate, missing/incorrect legal fields. CA may have
changed that state privately; require fresh CA readback before any protected step.

1. Execute the separately authorized #598 saves/readbacks; preserve the existing
   OAuth redirect `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-oauth-callback`
   and only `instagram_business_basic` + `instagram_business_manage_insights`.
2. CA resolves business/access verification and supplies an explicitly authorized
   professional review fixture. Do not reuse a canonical Page-linked/client
   account as if it were an unlinked standalone fixture. Demo/tester/OAuth steps
   need their own authorization, not an activation bypass.
3. Submit review/obtain required access and Live state only under subsequent CA
   authority. Record real provider evidence. Then explicitly authorize activation.
4. For each exact queue client, re-load Page assets first. If an exact saved Page
   exposes the account, review/bind that exact provider identity under separate
   authority; do not start standalone. If Page access is incomplete, hold and
   resolve access rather than claim no linkage. New Page mappings also require
   separate approval. Otherwise, require owner-confirmed professional identity.
5. Authorize ONE exact-client OAuth first, provider-native owner login/consent,
   exact returned ID/username/type/two scopes, encrypted pending-review receipt,
   then separate admin confirmation. Stop that client on any mismatch. Never
   inherit another client's browser account or reuse a group identity.
6. Under separate sync authority, verify canonical reporting, exact-client
   isolation, real observation age/null facts. Only then repeat individually.

Canonical fields (not saved by this pass):

- Privacy: `https://www.cgdynamics.co.za/privacy-policy`
- Terms: `https://www.cgdynamics.co.za/terms-of-service`
- Deletion instructions: `https://www.cgdynamics.co.za/privacy-policy`
- Deauthorize callback: `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-deauthorize`
- Data deletion callback: `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-data-deletion`

Use `INSTAGRAM-CONFIG-META-SAVE-PREFLIGHT-598.md` and
`META-591-PROTECTED-PREREQUISITES-2026-10-01.md` for save/readback/stop conditions.
No account is presently authorized to connect just because this matrix exists.

## Acceptance and impact

Desktop queue rendered at 1536px with no horizontal body overflow. Screenshot
retained privately at `C:/Users/chris/.codex/artifacts/issue-505/2026-10-02-page-first-desktop.jpg`.
Browser recorded six message-channel listener errors; no visible application
failure, but this is not a claim of an error-free browser session. No UI code
changed and no mobile acceptance is claimed. This is evidence/docs only.

No Meta dashboard change, provider write, secret/config write, OAuth, sync,
binding, migration, Edge deployment, strategy action or production data mutation.
#505 remains OPEN: configuration/provider verification and exact owner evidence
are genuine protected/human gates, not 25 executable connections today.

Verification: eight focused queue/OAuth/credential/callback/eligibility suites:
107 tests, **91 passed / 16 skipped / 0 failed**. The 16 database integration
cases require a disposable local PostgreSQL container and were not executed;
no production DB test was substituted. A separate executable manifest check
proves 25 unique canonical queue names, all eight exact reviewed handles and 17
unknowns unchanged. `npm run build` (TypeScript + Vite), scoped ESLint on queue,
eligibility, queue UI and asset discovery, and `git diff --check` PASS. Existing
bundle-size advisory remains. No runtime source/test changes; full unrelated
product suite was not run. The documentation PR does not change production UI.
