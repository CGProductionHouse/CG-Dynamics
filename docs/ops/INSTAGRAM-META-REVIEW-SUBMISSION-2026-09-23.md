# Instagram standalone Meta review submission — Issue #505

Updated: 23 September 2026

## Current production state

- Active clients: 57.
- Recurring-social eligible: 47.
- Non-social/not-currently-social: 10.
- Unresolved service scope: 0.
- Canonical Instagram mappings among eligible clients: 22.
- Instagram-unmapped eligible clients: 25.
- Standalone Instagram OAuth connections: 0.
- Standalone encrypted token rows: 0.
- Pending standalone reviews: 0.
- Instagram OAuth start/callback/confirm Edge Functions: ACTIVE v4.
- Standalone schema, encrypted-token correction and review-binding migrations: applied.
- Canonical production callback:
  `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-oauth-callback`
- Public Terms:
  `https://www.cgdynamics.co.za/terms-of-service`
- Public Privacy:
  `https://www.cgdynamics.co.za/privacy-policy`

## Meta app/product

Use the existing **CG Dynamics** Meta Developer app and the existing **Instagram API with Instagram Login** product.

The application must remain read-only for this activation.

Requested permissions:
- `instagram_business_basic`
- `instagram_business_manage_insights`

Do not request publishing, messaging, ads or unrelated permissions.

## Review use-case text

CG Dynamics is an internal CG Production House operations and reporting platform used to report on social performance for client-owned professional Instagram accounts.

An authenticated CG admin or manager selects one exact active client whose confirmed package includes recurring social service. CG Dynamics first attempts the existing Facebook Page-linked Instagram route. If that route does not expose an Instagram account, staff may use the standalone Instagram Login fallback.

The user authenticates on Instagram/Meta's provider-owned login surface. CG Dynamics requests only `instagram_business_basic` and `instagram_business_manage_insights` so it can identify the exact Business/Creator account and retrieve account/media reporting data.

After provider callback, CG Dynamics verifies the exact returned provider account ID, username, professional account type and granted reporting scopes. The provider token is encrypted before persistence. The returned identity remains in `pending_review` until an authenticated active CG admin/manager explicitly confirms that exact provider identity for that exact client. Only then can the existing canonical Meta reporting/sync path use the account.

CG Dynamics does not collect Instagram passwords and this standalone flow does not publish content.

## App Review demonstration sequence

Use one exact owner-controlled professional Instagram Business or Creator account that can be safely used for review.

1. Sign in to CG Dynamics as an active admin/manager.
2. Open **Admin → Integrations → Meta**.
3. Select one exact recurring-social client with no canonical Instagram mapping.
4. Show that Page-linked assets are checked first.
5. Show that no suitable Page-linked Instagram account is available for that exact client.
6. Click **Connect exact Instagram account**.
7. Complete Instagram Login on Meta/Instagram's provider page.
8. Show that only the two reporting permissions are requested.
9. Return through the production callback.
10. Show the exact returned username and Business/Creator account type in pending-review state.
11. Confirm the exact returned identity as an active admin/manager.
12. Show the canonical mapping belongs only to the selected client.
13. Show the reporting/sync path can use the reviewed account.
14. Show there is no publishing action in this standalone connection flow.

## Security and isolation points to state in review

- No Instagram passwords are stored.
- Tokens are encrypted before persistence with AES-256-GCM.
- AAD binds the encrypted token to the exact Dynamics client and exact Instagram account identity.
- OAuth state is one-time, hashed, client-bound and staff-bound.
- Callback rechecks the original connecting actor is still an active admin/manager.
- Only Business or Creator professional accounts are accepted.
- Required reporting scopes are checked before persistence.
- One Instagram identity cannot be assigned to multiple clients.
- Canonical mapping is not written until explicit staff review/confirmation.
- Page-linked Instagram remains preferred; standalone login is fallback only.
- Provider rollout is restricted to confirmed recurring-social clients.
- Publishing scope is intentionally absent.

## Remaining 25 unmapped eligible clients

1. Bloem Action Sports
2. Bohemia Quick Stop
3. Bouwer & Coetzee Attorneys
4. Central Canvas
5. Daisy & Co
6. Ehrlich Park Butchery
7. Emmanuel Funerals
8. Emoya Estate Driving Range
9. Forklift Trucks
10. Hino Trucks
11. HMHI
12. Human Auto
13. Jenkor
14. Neshora Oxygen
15. Novus Steel
16. Piek Group
17. PSG Bloemfontein
18. Red Oak
19. Supa Quick BFN
20. Supa Quick Centurion
21. The Staffordshire
22. Tobich Optics
23. Toyota Bloemfontein
24. We Ar Fuels
25. WiseRide

Reviewed exact identities currently known for eight of these:
- Bouwer & Coetzee Attorneys — `@bouwer_coetzee_attorneys`
- Emmanuel Funerals — `@emmanuelfunerals`
- Emoya Estate Driving Range — `@emoyadrivingrange`
- Novus Steel — `@novus_steel`
- Piek Group — `@piekgroup`
- Red Oak — `@official.redoak`
- Toyota Bloemfontein — `@cfaomobilitytoyotabloemfontein`
- We Ar Fuels — `@we_ar_fuels`

Identity evidence is not provider authorization. Exact owner access and provider-returned identity must still be verified during consent.

## Exact remaining external gates

1. Meta App Review / Advanced Access for:
   - `instagram_business_basic`
   - `instagram_business_manage_insights`
2. Meta app moved from Development to the provider state required for live client-owned accounts.
3. Provider-owned Instagram app secret revealed through Meta's own security/re-authentication flow and entered directly into Supabase as:
   - `INSTAGRAM_APP_SECRET`
4. After those are complete, enable:
   - `INSTAGRAM_STANDALONE_LIVE_ACTIVATION_ENABLED=true`
5. Run one controlled exact-client OAuth acceptance.
6. Verify encrypted token persistence, pending review, exact mapping confirmation, reporting sync and cross-client isolation.
7. Then roll through the remaining exact eligible clients one by one.

## Stop conditions

Do not activate standalone OAuth if:
- Meta review is incomplete;
- the app is still restricted to development-only account access;
- `INSTAGRAM_APP_SECRET` is absent;
- any required config name is missing;
- the returned identity does not exactly match the client;
- the returned account is not Business/Creator;
- required reporting scopes are missing;
- an account identity is already bound to another client.

Do not paste the provider app secret into GitHub, chat, screenshots or logs.
