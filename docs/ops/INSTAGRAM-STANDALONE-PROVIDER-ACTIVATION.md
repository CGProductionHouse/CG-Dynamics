# Standalone Instagram provider activation runbook — Issue #505

Updated: 1 October 2026 (read-only #505 reconciliation)

## Purpose

Finish the remaining standalone Instagram provider activation without weakening the existing Page-linked-first, exact-client, read-only reporting contract.

## Current production truth

- Recurring-social eligible clients: 47; explicitly excluded: 10; held: 0.
- Canonical Instagram mappings: 22.
- Instagram-unmapped recurring-social clients: 25.
- Standalone OAuth connections: 0.
- Standalone encrypted token rows: 0.
- Pending standalone reviews: 0.
- Standalone foundation, encrypted-token correction and review-binding migrations are already ledgered in production.
- `instagram-oauth-start`, `instagram-oauth-callback` and `instagram-connection-confirm` are ACTIVE v5. All deployed source files match the accepted main baseline `2f5d4dad94ecba91f3c3f38a85180fb5c52ac0f9` after line-ending normalization.
- The canonical Instagram business-login callback is already saved in the Meta developer configuration.
- Names-only production inspection confirms six Instagram configuration names exist. `INSTAGRAM_APP_SECRET` is absent. Presence does not prove valid values; validate the key/version, Graph version and redirect contract privately before consent.
- `INSTAGRAM_STANDALONE_LIVE_ACTIVATION_ENABLED` remains deliberately fail-closed until provider review is complete.

## Provider product and permissions

Use the existing CG Dynamics Meta Developer app and its **Instagram API with Instagram Login** product.

Request only:

- `instagram_business_basic`
- `instagram_business_manage_insights`

Do not request publishing, messaging, ads or unrelated permissions for this reporting activation.

The standalone flow is for exact Instagram **Business or Creator** accounts which are not exposed through the saved Facebook Page route.

## Review explanation

CG Dynamics is an internal CG Production House reporting and operations system.

An authenticated CG admin/manager:
1. selects an exact active client whose confirmed package includes recurring social service;
2. loads the client's saved Meta/Page assets first;
3. uses standalone Instagram Login only if the Page route does not expose an Instagram account;
4. authenticates on Instagram/Meta's own provider surface;
5. grants the two reporting permissions above;
6. returns to the client-bound callback;
7. CG Dynamics verifies the provider account ID, username and Business/Creator account type;
8. the access token is encrypted before persistence and the account remains `pending_review`;
9. an authenticated active admin/manager explicitly confirms the exact returned identity before it can become the client's canonical Instagram reporting mapping;
10. the existing Meta reporting/sync path then reads account/media insights.

CG Dynamics does not collect Instagram passwords and does not use this standalone flow to publish content.

## App-review demo sequence

Use an exact owner-controlled professional test account.

1. Sign in to CG Dynamics as an active admin/manager.
2. Open **Admin → Integrations → Meta**.
3. Show the eligible exact client with no canonical Instagram mapping.
4. Click **Load Page-linked assets** first.
5. Show that no linked Instagram identity is available for that client's saved Page, or that no Page route exists.
6. Click **Connect exact Instagram account**.
7. Complete provider-native Instagram Login.
8. Show the requested permissions are read/reporting-only.
9. Return through the canonical callback.
10. Show the returned exact username/account type in **pending review** state.
11. Confirm the exact mapping as an active admin/manager.
12. Show that the canonical Meta reporting path can use the reviewed Instagram identity.
13. Show that no publishing action is present in this standalone connection flow.

Never use another client's account/session to demonstrate the flow.

## Public URLs

- Terms: https://www.cgdynamics.co.za/terms-of-service
- Privacy: https://www.cgdynamics.co.za/privacy-policy

Both routes are public and unauthenticated in the production app.

## Meta dashboard checklist

Before enabling standalone OAuth in production:

- [ ] Existing CG Dynamics app selected.
- [ ] Instagram API with Instagram Login product selected.
- [ ] Canonical callback URL saved in Instagram business-login settings.
- [ ] Public Terms URL accepted.
- [ ] Public Privacy URL accepted.
- [ ] `instagram_business_basic` requested for the exact reporting use case.
- [ ] `instagram_business_manage_insights` requested for the exact reporting use case.
- [ ] App Review / Advanced Access completed for the permissions required to serve client-owned professional accounts.
- [ ] Required provider demonstration/video supplied.
- [ ] App switched from Development to Live only after review succeeds.
- [ ] Provider-owned Instagram app secret retrieved through Meta's security/re-authentication flow and entered directly into Supabase secret management as `INSTAGRAM_APP_SECRET`.
- [ ] Secret value is never pasted into GitHub, chat, logs or screenshots.
- [ ] Names-only production config check confirms all required names are present.
- [ ] Only then set `INSTAGRAM_STANDALONE_LIVE_ACTIVATION_ENABLED=true`.
- [ ] Run one exact-client controlled OAuth acceptance before fleet rollout.

## Current exact reviewed identities among the 25 unmapped clients

- Bouwer & Coetzee Attorneys — `@bouwer_coetzee_attorneys`
- Emmanuel Funerals — `@emmanuelfunerals`
- Emoya Estate Driving Range — `@emoyadrivingrange`
- Novus Steel — `@novus_steel`
- Piek Group — `@piekgroup`
- Red Oak — `@official.redoak`
- Toyota Bloemfontein — `@cfaomobilitytoyotabloemfontein`
- We Ar Fuels — `@we_ar_fuels`

These are identity evidence only. They do not prove current owner access, professional account type or standalone eligibility; Meta/provider verification remains authoritative at consent time.

## Explicit identity holds

Do not guess an Instagram identity for unresolved clients. Current reviewed intelligence explicitly leaves Bloem Action Sports, Hino Trucks, Jenkor and WiseRide unresolved, and the other unverified fleet rows remain provider/client-evidence gated.

## Acceptance standard

Standalone Instagram is production-ready only when:

- server config is complete without exposing secret values;
- Meta provider review/Advanced Access is complete;
- the app is in the provider state required for live client-owned account access;
- one controlled exact-client OAuth completes;
- the returned Business/Creator identity is exact and client-bound;
- encrypted token persistence succeeds;
- pending-review confirmation creates only the intended canonical mapping;
- canonical Meta sync/reporting succeeds for that exact Instagram identity;
- another client cannot read/use the token or mapping;
- no publishing permission/action was introduced.

## Exact controlled activation order

No step here is authorized merely by this runbook. #505 remains OPEN.

#593 callback prerequisite is production-active under completed #595 Phase B.
Do not replay its migration or three deployments. Before consent/demo, follow
`INSTAGRAM-CONFIG-META-SAVE-PREFLIGHT-598.md`: app ID is verified, app secret is
absent, public origin still needs its canonical correction, and existing key/
version structure requires private validation. Config and exact public Meta URL
saves require separate approval. Keep activation OFF throughout; #598 made no
production changes.

1. CA verifies the existing Instagram product, exact callback URL and the two reporting permissions in Meta. Prepare the demonstration from `INSTAGRAM-META-REVIEW-SUBMISSION-2026-09-23.md`; select one owner-controlled professional review account. The packet is prepared, not submitted or provider-accepted. Any reviewer/test-account consent needed before submission requires separate authorization; never bypass the production gate for a demo.
2. CA completes Meta App Review/Advanced Access. Record provider approval evidence, not a guessed status. Current dashboard review/access/mode was not re-inspected in this pass.
   Superseding 1 October dashboard inspection: Development; empty unsubmitted
   request; both standalone scopes Standard access/zero calls; Insights advanced
   request disabled. Business is Unverified and access verification blocked.
   Privacy URL blank, Terms/deletion instructions are facebook.com, product
   deauthorize/deletion URLs blank. Resolve those protected prerequisites and a
   real authorized demo before submission. See `INSTAGRAM-META-REVIEW-PREP-2026-10-01.md`.
3. CA switches to the required Live state only after approval.
4. Under separate protected authority, securely configure the missing `INSTAGRAM_APP_SECRET`; privately validate all existing names. Encryption key must decode to exactly 32 bytes, key version must be `v1`/`v2` etc., and Graph version must be explicit. Verify `INSTAGRAM_REDIRECT_URI` equals `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-oauth-callback`. Correct/verify `APP_PUBLIC_URL` to the authenticated canonical origin `https://www.cgdynamics.co.za`: the current blocked callback redirects to the old `cg-dynamics.vercel.app` origin. No configuration was changed in this pass.
5. Before enabling consent, deploy the accepted shared credential-expiry correction to both existing consumers (`meta-sync` and `meta-sync-worker`) under separate Edge deployment authorization. No migration or new scheduler is needed. Keep standalone activation disabled until all server/provider prerequisites pass.
6. Only then, with explicit authorization, enable `INSTAGRAM_STANDALONE_LIVE_ACTIVATION_ENABLED=true` and conduct one exact-client consent. Load Page-linked assets first; do not use standalone when the exact Page supplies the account.
7. Verify exact `/me` account ID, username, Business/Creator type and both granted scopes; one-time state consumption; ciphertext-only persistence; `pending_review`; no canonical mapping yet. Confirm the exact returned identity separately as an active admin/manager. Check another client cannot use/read that connection.
8. Under explicit sync authority, verify canonical Instagram reporting/freshness, provider observation age and unavailable/null metrics. No auto-publish. Roll out remaining clients individually only after that acceptance; the 17 unresolved handles require exact owner evidence first.

Present names: `INSTAGRAM_APP_ID`, `INSTAGRAM_REDIRECT_URI`, `INSTAGRAM_GRAPH_VERSION`, `INSTAGRAM_TOKEN_ENCRYPTION_KEY_B64`, `INSTAGRAM_TOKEN_ENCRYPTION_KEY_VERSION`, `INSTAGRAM_STANDALONE_LIVE_ACTIVATION_ENABLED`; shared `APP_PUBLIC_URL` also exists. No secret values are recorded here.

Evidence and verification: `docs/ops/INSTAGRAM-READINESS-ACCEPTANCE-2026-10-01.md`.
