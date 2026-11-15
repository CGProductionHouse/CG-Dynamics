# Social publishing — 15 November 2026

Candidate: [draft PR991](https://github.com/CGProductionHouse/CG-Dynamics/pull/991),
branch `codex/social-publishing-220`. Owners: #220 shared production/publishing, #236 Meta, #269 TikTok Business,
#493 LinkedIn. This extends their existing lane; it is not a new calendar or
Nolan workboard. Teams remains the team's scheduling platform. The Microsoft
sync hold, calendar separation, package authority and staff edits are unchanged.

## Verified accounts and existing work

Read-only inspection used the existing company Chrome profile
`cgproductionhouse.com`, preserving open tabs and sessions. Meta Business Suite
shows CG Production House / `@cg_production.house` and its native creation and
Planner controls. Native UI access does **not** establish Dynamics API permissions.

TikTok Business Center shows CG Production House and ten Manage account entries:
Braize, Forklift Trucks OFS, Neshora Oxygen, Wiseman Group, Dulux Bloemfontein,
Watch Addict, The Staffy, Madisons Menswear, Red Oak and CGPRODUCTIONHOUSE.
The existing Red Oak publisher exposes its Scheduler and zero scheduled posts.
No content was uploaded, drafted, scheduled or published.

The API for Business portal now shows **CG Dynamics — Approved**. Its TikTok
Accounts permission section lists `/business/video/publish/`,
`/business/photo/publish/` and `/business/publish/status/`. This supersedes the
September Pending observation. The configured account-holder callback ends in
`/tiktok-business-oauth-callback`. The connected Supabase function inventory
confirms that callback is **absent live**; only the older analytics OAuth functions
exist. Read-only catalog inspection confirms the Business authorization tables
are absent, while canonical schedule/review/connection/job columns match the
local contracts. This branch now implements the missing callback locally.
No secret was revealed/copied and no live client Accounts API grant was created.

Inspected clean `codex/tiktok-business-agency`: its authorization schema,
refresh/status helpers, disabled schedule endpoint and queue migration are
unmerged historical foundation. This continuation reuses its authorization/state/
credential table names and the existing connection mapping, with encrypted tokens
and refresh fencing. It deliberately omits the old separate publish-job queue.
Do **not** apply the historical migration or merge its old frontend over this
candidate; the two new migrations here replace that unshipped rollout path.
The historical worktree remains clean/preserved. Its Pending gate is stale.

Main's consumer TikTok Direct Post implementation remains disabled. It is not
the substitute for the approved Business/Accounts route. No connected YouTube
client was found or assumed; no LinkedIn publishing entitlement was verified.

## Implemented locally

* Shared typed preflight binds the canonical `monthly_deliverables` item to an
  immutable approved `content_review_versions` row, exact client/account/route,
  approved bytes/hash/caption, Johannesburg calendar date and explicit publishing
  authorization. Content approval alone is not permission to publish.
* Stable channel intent identity survives repeated clicks and reconnection.
  Re-read source, authorization, mapping, access and expiry before dispatch;
  refuse changed source, overdue catch-up and terminal/ambiguous resubmission.
* Execution seam requires a durable atomic claim/fence and persisted attempt
  **before** provider mutation. Timeouts and receipt-save failures become
  `unknown_outcome`; recovery reconciles that attempt instead of posting again.
  Each channel has its own outcome, preserving partial success.
* Provider-specific state normalization distinguishes upload/container processing,
  native scheduling and verified publication. Bounded retries respect Retry-After;
  ambiguous mutation responses cannot trigger fresh submission.
* Facebook JPEG/PNG submission adapter uses the approved caption and exact Page,
  requests a bounded media URL only at submission, returns the operation/post
  identity immediately, and performs publication read-back separately. No signed
  URL or token is returned in durable receipts. Reconciliation checks Page/post
  identity and `is_published` before reporting posted.
* Existing `tiktok-post-status` now refuses false success when receipt/mapping
  persistence fails or completion has no public post identifier. The response
  directs status-only reconciliation. Authentication and manager/admin boundary
  remain unchanged. This is a local candidate, not a live repair.
* Durable SQL ports now use the **existing `background_jobs`** table, unique
  channel identity, current source/actor checks, lease fences and cross-version
  advisory locking. The existing worker recognizes the new type and preserves
  its owned receipt/completion. Generic expired-lease recovery cannot erase the
  submission barrier. A late response from a fenced-out submitting worker retains
  provider IDs as evidence without promoting state; recovery verifies it without
  another POST. Missing/null platform and route/media mismatches fail closed.
* Business OAuth start/callback/status are implemented with the approved
  account-holder URL/scopes, hashed 256-bit one-use state (5-minute lifetime),
  active manager/client/connection checks, exact provider username confirmation,
  and atomic metadata plus encrypted credential saves. Business open IDs are
  app-specific; no equality with consumer Login Kit open IDs is assumed. Existing
  client mappings and consumer analytics credentials are never rewritten.
* AES-GCM uses a dedicated Business key/provider domain and connection + token-kind
  additional data, with no plaintext fallback. Token/state tables have no browser
  grants. Manager metadata grants exclude the private refresh fence.
* Expiring Business credentials refresh through the existing Business status seam,
  with one leased rotation, exact returned open-ID/scopes/expiry checks and atomic
  save. A stale/ambiguous rotation requires reauthorization; no blind retry or
  older refresh response can overwrite a newer OAuth connection.
* Existing TikTok integration UI now has a separate exact-account Business form.
  Callback returns to the state-owned client. Switching clients, including leaving
  and returning, clears confirmation. Analytics remains read-only by default;
  Business consent does not create a publication job or approve content.

All of this remains **undeployed**. The worker's private provider bindings
are intentionally unconfigured and hold jobs even if the publishing flag is
prematurely enabled. There is no public enqueue endpoint: only the service-only
enqueue RPC may receive an explicitly authorized, server-preflighted intent.
Three authorization tables and two migrations are local candidates; no second
queue, calendar, production dependency or background schedule was introduced.

## Supported provider paths and remaining prerequisites

| Provider | Submission/timing path | Required before activation |
| --- | --- | --- |
| Facebook Pages | Due-time Page photo submission implemented against an injected versioned Graph transport. Video/Reel uploads remain separate adapters. Native scheduling is not assumed. | Reuse encrypted Meta token resolver, exact Page mapping and CREATE_CONTENT task; verify `pages_manage_posts`, `pages_read_engagement`, app review/advanced access and any content-specific permission. Wire approved-media resolver and durable worker. |
| Instagram professional accounts | Facebook Login: `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`; Instagram Login uses the different `instagram_business_*` permissions. Create container, poll, publish, read media at due time. JPEG images; video/Reel checks separate. | Confirm actual login route/account, conditional Business Manager requirements, app review and publishing limit dynamically. No claim that analytics OAuth grants publishing. Container FINISHED is not publication. Transport adapter not implemented here. |
| TikTok Business / Accounts API | Approved app exposes Business video/photo publication and publish-status endpoints. OAuth, encrypted storage and refresh are implemented/tested locally. Dynamics due-time submission/polling; no assumed native scheduling field. | Review/deploy the candidate OAuth schema/functions/form, configure dedicated server settings privately, obtain exact-account consent, then verify the actual granted permissions. Publishing transport/media eligibility remains a separate pilot gate; metadata eligibility defaults to not_approved. No consumer Direct Post fallback. |
| LinkedIn organizations | Media initialize/upload/readiness, then versioned `/rest/posts` at due time, followed by read-back. | Community Management access/review, correct organization role and `w_organization_social` / `r_organization_social`. Use supported monthly `LinkedIn-Version` plus Rest.li header; do not ship retiring 202511. Member scope is not organization authority. Adapter remains to implement. |
| YouTube, future clients | Resumable private video upload and native future `status.publishAt`, followed by processing/privacy/publication read-back. | Explicit future channel OAuth and `youtube.upload`, exact channel mapping, consent/review/quota checks and schema support. Current review channel enum excludes YouTube; do not bypass it. Never omit private status or send a past publishAt (can publish immediately). Upload/session adapter remains to implement; due-time kernel is not an early-upload scheduler. |

The generic binding's evidence booleans are internal server adapter inputs, not
client-provided authorization. A production transport must reject non-success
HTTP/Graph envelopes, resolve tokens privately, and never log signed media URLs.
Media preparation must verify format/codec/dimensions/duration/size, image count,
rights and expiry per provider and preserve the approved immutable asset hash.
No universal hard-coded media size, quota or native scheduling window is inferred.

## Activation sequence within the existing owners

1. Review the now-tested storage/worker and OAuth candidate. Migrations are
   `20261115104948_social_publishing_queue.sql` and
   `20261115104950_tiktok_business_oauth.sql`, generated by the installed CLI.
   No historical #269 publish_jobs migration should be applied alongside them.
2. For a future OAuth-only rollout, review the three Business functions and shared
   helpers against hosted manifests first. Configure only the reviewed Business
   app ID/secret, exact existing callback URI, dedicated 32-byte base64 key and
   key version `v1`. `TIKTOK_BUSINESS_OAUTH_ENABLED` stays off until the reviewed
   schema/functions/form are in place. Preserve all analytics credentials, Meta
   keys, provider settings and mappings. A new frontend release needs its own
   #679 release packet; no hosting action is authorized here. Then request consent
   for one specified account in the existing company Chrome session. Do not start
   consent while its callback is absent or infer grants from Business Center access.
   Reviewed setting names are `TIKTOK_BUSINESS_APP_ID`, `TIKTOK_BUSINESS_APP_SECRET`,
   `TIKTOK_BUSINESS_REDIRECT_URI`, `TIKTOK_BUSINESS_TOKEN_ENCRYPTION_KEY` and
   `TIKTOK_BUSINESS_TOKEN_KEY_VERSION`. No values belong in chat or handovers.
   Never reuse the consumer Login Kit secret or an existing Meta/Instagram key.
3. Separately wire the first Facebook photo adapter to encrypted token/mapping source
   and an approved-hash media resolver. Add provider status reconciliation jobs,
   per-provider polling cadence and a staff-authorized publication producer using
   fresh server preflight. Register those private bindings only after review.
   `SOCIAL_PUBLISHING_ENABLED` remains false; OAuth enablement never enables it.
   Current bounded 30-second/120-read reconciliation is Meta-first, not a promise
   that future YouTube native schedules should be polled every 30 seconds.
4. Obtain specific permission for one controlled provider post, then verify its
   actual account/content/time and returned public post independently. No test
   post, backfill, bulk scheduling, ad or budget change has been authorized here.

## Official sources checked 15 November

* [Meta Page publishing](https://developers.facebook.com/documentation/pages-api/posts):
  Page tasks/permissions, photo receipt and scheduling. The guide and endpoint
  references show differing scheduling windows, so no universal window is coded.
* [Instagram content publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing):
  login-specific permissions, media retrieval, containers and publication limit.
* [TikTok Accounts overview](https://business-api.tiktok.com/portal/docs/accounts-api-overview/v1.3)
  and the signed-in approved app's own permission list. Historical exact endpoint
  research remains in `docs/integrations/TIKTOK-BUSINESS-AGENCY-ROLLOUT-HANDOFF.md`
  on the existing #269 branch; do not invent request fields while docs are JS-only.
* [TikTok Accounts authentication](https://business-api.tiktok.com/portal/docs/accounts-api-authentication/v1.3)
  and [account profile](https://business-api.tiktok.com/portal/docs?id=1762228399168514)
  were read in the signed-in official portal: Business token exchange uses
  `auth_code`, refresh uses its separate endpoint, and `/business/get/` accepts
  the Business app's `open_id` as `business_id`. Exact `username` is compared;
  display names are not identity evidence.
* [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-09):
  organization roles, media readiness and version headers.
* [YouTube insert](https://developers.google.com/youtube/data/reference/rest/v3/videos/insert)
  and [video status/publishAt](https://developers.google.com/youtube/data/reference/rest/v3/videos):
  explicitly private uploads; future schedule restrictions and current quotas.
  Current documentation says unverified API projects are **not** automatically
  restricted to private viewing; do not rely on obsolete audit restrictions as a
  safety guard. This implementation still requires explicit private status.

## Verification receipt

Focused130/130 pass, including real isolated PostgreSQL, actual Edge handler
execution with fixture transports, refresh races, source/actor revocation, lost
leases, cross-version guards and late receipts. Full Node24.16.0 run4359 total /
4329 pass /30 skipped /0 failures completed, including source-shape/column-grant
hardening. The130-test affected suite passed; after the Wi-Fi pause,120 affected
checks passed again for the final publication-worker-only completion guard.
Reruns are not extra unique tests. Build,
emitted app bundle, scoped lint and helper/Edge-entrypoint TypeScript pass.
The Edge typing check bridges Deno globals to the installed SDK; it is not hosted
Edge or native Deno acceptance. PostgreSQL runs in the task-owned, network-none
local container using actual queue foundation/claimer + candidate migrations
against a minimal canonical fixture schema, not the entire production schema.

Real company Chrome local React fixture verified disabled-until-confirmed state,
client switching, exact captured request and the reproduced/fixed revived
confirmation defect. All provider/backend fixture calls were blocked or mocked;
no real sign-in, consent or publishing/phone acceptance is inferred. The fixture
uses its own temporary Vite cache to avoid parallel test optimizer collisions.
Only fake keys/IDs were used, and existing Git OpenSSL was added to the test
process PATH only. No real credentials or machine configuration changed.

The initial95-test checkpoint and its corrected fixture-origin failure are
historical, superseded by this continuation's acceptance. Generated access-matrix
outputs are restored before commit; no unrelated artifacts belong in this diff.
No production migration/data/configuration/OAuth/deployment was performed. Other
open Nolan/Picasso/staff PRs remain untouched. Exact Google Control Centre target
remains unidentified in current handover; no guessed tracker write.
