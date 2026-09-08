# TikTok Business agency rollout handoff

Last verified: 2026-09-08 (Africa/Johannesburg)

GitHub lane: Issue #269, branch `codex/tiktok-business-agency`

## Scope lock

This lane extends the accepted read-only TikTok integration from Issue #238 / merged PR #239. It does not replace that Login Kit and Display API connection.

Agency publishing uses TikTok API for Business v1.3, Organic API, and Accounts API. `monthly_deliverables` remains the only Client Schedule authority. A scheduled publish must be derived from the approved `content_review_versions` row for that deliverable and must write its provider receipt, status, and public post ID back against the same deliverable.

The consumer Content Posting API Direct Post functions from #239 remain disabled and undeployed. They are not the production agency publishing path.

## Official provider contract verified

Official TikTok API for Business documentation was checked on 2026-09-08:

- Base URL: `https://business-api.tiktok.com/open_api/v1.3`.
- An agency can register as a TikTok API for Business developer and create one reusable application for multiple client authorizations.
- Accounts API is the Organic API product for TikTok Business Accounts.
- Account token exchange: `POST /tt_user/oauth2/token/`.
- Token renewal: `POST /tt_user/oauth2/refresh_token/`.
- Token revocation: `POST /tt_user/oauth2/revoke/`.
- Permission inspection: `/tt_user/token_info/get/`.
- Account profile: `/business/get/`.
- Account media: `/business/video/list/`.
- Video privacy settings: `/business/video/settings/`.
- Video publishing: `/business/video/publish/` with **TikTok Accounts > Account Post Content > Video Publish**.
- Photo publishing: `/business/photo/publish/` with **TikTok Accounts > Account Post Content > Photo Publish**.
- Publish polling: `/business/publish/status/`.
- TikTok account webhook configuration is available in Accounts API and should supplement, not replace, durable polling/reconciliation.
- Account access tokens expire after one day. Refresh tokens expire after one year. Expired refresh credentials require the account holder to authorize again.
- The authorization code is single-use. Current Accounts API authentication documentation states a ten-minute lifetime. The callback must exactly match the app's configured TikTok account holder redirect URL.
- Analytics require the Business Account owner to have published at least one video and enabled Analytics in the TikTok mobile app.

Primary sources:

- [API for Business endpoint reference](https://business-api.tiktok.com/gateway/docs/index?doc_id=1735713875563521&language=ENGLISH)
- [Accounts API authentication](https://business-api.tiktok.com/gateway/docs/index?doc_id=1738084387220481&language=ENGLISH)
- [API for Business authorization concepts](https://business-api.tiktok.com/gateway/docs/index?doc_id=1738928364967937&language=ENGLISH)
- [Accounts API overview](https://business-api.tiktok.com/gateway/docs/index?doc_id=1737944775511041&language=ENGLISH)

The exact TikTok account holder authorization URL and final permission identifiers must be copied from the approved app configuration. They are not guessed in code before TikTok grants the application access.

## Live provider portal evidence

Authenticated Chrome reached `https://business-api.tiktok.com/portal/apps` using the signed-in `@cgproductionhouse` account.

- The API for Business portal is separate from the existing `developers.tiktok.com` consumer app.
- TikTok API for Business developer registration was completed by CA, including interactive email/phone verification and the Agency declaration. The portal says TikTok may take up to three days to review the developer profile, while app creation is available immediately.
- The account still has no TikTok API for Business applications.
- The **CG Dynamics** app form was reopened after enrollment and populated as an unsaved draft with the dedicated callback `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/tiktok-business-oauth-callback` and an accurate agency use-case description. TikTok does not expose a separate draft-save action; pressing **Submit** would create/request the provider application, so it was deliberately not pressed.
- The live permission tree confirms the minimum relevant product is **TikTok Accounts**, with the subgroups **Account User**, **Get Account Media**, and **Account Post Content**. The Account Post Content group exposes `/business/video/publish/`, `/business/photo/publish/`, `/business/publish/status/`, `/business/video/settings/`, hashtag suggestions, and location lookup.
- TikTok displays a mandatory separate **Accounts API Access Application Form** before it will approve TikTok Accounts permissions. The live form requires matching business/developer-profile name, app name, the developer registration email, company/product website, business verification (an accepted company document or a verified TikTok Business Center ID), a detailed use case, screen recordings of the implemented/prototyped permission flows, estimated authorized-account count, developer type, and an Accounts API usage/revocation acknowledgement.
- An earlier permission-tree interaction triggered a TikTok portal client-side exception. Reload recovery succeeded. No app submission, Accounts API form submission, or permission request was sent.

Do not confuse this missing Business developer application with the existing **CG Dynamics** consumer developer app. The consumer app remains the accepted read-only analytics lane.

## Reusable connection model

One approved API for Business application should serve all CG clients. Each client account holder completes TikTok's account authorization once. Dynamics must then:

1. bind the returned `open_id` to one exact `clients.id`;
2. inspect and store the exact granted permission set;
3. store access and refresh tokens server-side only;
4. refresh the one-day access token before use;
5. mark reauthorization required when refresh fails or expires;
6. never select a connection by recency or fall back to another client;
7. expose only safe connection identity and health to staff UI;
8. keep raw tokens and provider diagnostics inaccessible to browser clients.

## Publishing contract

The due-time worker must fail closed unless all conditions hold:

- agency publishing rollout is enabled server-side;
- the deliverable is not archived, cancelled, posted, or moved;
- the exact approved review version still belongs to the deliverable and client;
- the approved review includes the `tiktok` channel;
- required internal and client approval evidence is present;
- the review `scheduled_at` is due and still agrees with the canonical `monthly_deliverables.scheduled_date` in `Africa/Johannesburg`;
- the exact client has a healthy Accounts API connection with the required publish permission;
- the media snapshot and caption are the immutable approved values;
- no successful or in-flight provider intent already exists for the same deliverable, review version, provider, and account.

Dynamics retains future scheduling and calls TikTok only when a row becomes due. A local idempotent intent must exist before the provider call. Provider request ID, publish ID, state, public post ID, errors, attempt timestamps, and reconciliation timestamps remain durable. The worker marks `monthly_deliverables.posted_at` / posted state only after TikTok confirms the public post.

The manager scheduling request is authenticated in the Edge Function and forwards the verified user ID to a service-role-only queue RPC. The RPC independently confirms that the actor is still an active admin/manager. Direct browser RPC execution is denied, and the Edge Function refuses to queue anything while `TIKTOK_BUSINESS_PUBLISHING_ENABLED` is off.

No actual provider publish is permitted in this branch or its tests.

## Media transport

The existing private `content-review-snapshots` object is the immutable approved source. Provider code must not trust a caller-supplied URL.

Before production publishing, confirm the Accounts API upload contract exposed to the approved app. If TikTok fetches media by URL, serve approved snapshots through a CG-controlled, verified HTTPS host or URL prefix for the complete provider processing window. Supabase signed URLs under `supabase.co` are not treated as a verified CG-owned publishing origin. If Accounts API accepts multipart upload from the server, stream the immutable private object from the Edge Function without making it public.

## Current external gates

The live portal has passed developer enrollment. Remaining provider gates are:

1. TikTok's developer-profile review;
2. CG Dynamics app submission and requested Accounts API permissions;
3. application ID/secret and exact TikTok account holder redirect configuration;
4. production secrets and SQL/Edge Function rollout;
5. each client account holder's authorization; and
6. explicit approval for the first controlled external post.

No provider app was submitted, no permission expansion was requested for a CG app, no secret was read or changed, no production SQL/function was applied, and no content was published during this checkpoint.

## Resume sequence

1. Wait for TikTok to accept the developer profile; no useful provider submission can bypass this review.
2. Reopen the **CG Dynamics** API for Business app form, use the callback recorded above, and select only the required TikTok Accounts permissions: Account User, Get Account Media, and the necessary video/photo Account Post Content permissions.
3. Prepare the required screen recordings from this PR's prototype and the company verification evidence or verified Business Center ID.
4. Submit both the provider app and mandatory Accounts API access form only at the explicit review gate.
5. After approval, implement the exact authorization URL and final permission identifiers disclosed by the approved app, then configure secrets and apply reviewed migrations/functions at the production gate.
6. Authorize one controlled Business Account, verify exact-client isolation, and run a dry/readiness cycle.
7. Obtain explicit approval for the first real approved-content post, verify native TikTok output, receipt reconciliation, and duplicate prevention.
8. Roll the same authorization workflow across the current active-client list; never hardcode client names into the architecture.
