# Social publishing — 15 November 2026

Owners: #220 shared production/publishing, #236 Meta, #269 TikTok Business,
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
`/tiktok-business-oauth-callback`; current main and the historical Business
branch do not implement that callback. No secret was revealed or copied, and
no client Accounts API token or working callback was verified.

Inspected clean `codex/tiktok-business-agency`: its authorization schema,
refresh/status helpers, disabled schedule endpoint and queue migration are
unmerged historical foundation. Preserve/review that work for activation rather
than creating a second OAuth/mapping store. Do not cherry-pick its old frontend
over current staff changes. Its handoff's Pending gate is stale.

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

These helpers have **no deployed entry point or production store/transport
adapter**. Concurrency tests exercise injected transactional fixtures, not a
production claim that the database already implements the contract. No new
dependency, table, queue, route, provider scope or background schedule was added.

## Supported provider paths and remaining prerequisites

| Provider | Submission/timing path | Required before activation |
| --- | --- | --- |
| Facebook Pages | Due-time Page photo submission implemented against an injected versioned Graph transport. Video/Reel uploads remain separate adapters. Native scheduling is not assumed. | Reuse encrypted Meta token resolver, exact Page mapping and CREATE_CONTENT task; verify `pages_manage_posts`, `pages_read_engagement`, app review/advanced access and any content-specific permission. Wire approved-media resolver and durable worker. |
| Instagram professional accounts | Facebook Login: `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`; Instagram Login uses the different `instagram_business_*` permissions. Create container, poll, publish, read media at due time. JPEG images; video/Reel checks separate. | Confirm actual login route/account, conditional Business Manager requirements, app review and publishing limit dynamically. No claim that analytics OAuth grants publishing. Container FINISHED is not publication. Transport adapter not implemented here. |
| TikTok Business / Accounts API | Approved app exposes Business video/photo publication and publish-status endpoints. Dynamics due-time submission/polling; no assumed native scheduling field. | Reconcile historical #269 foundation, implement exact approved OAuth callback with state/expiry/replay protection and encrypted storage, verify granted account permissions/token health and exact-client targets. Current portal approval is not evidence of an authorized client token. No consumer Direct Post fallback. |
| LinkedIn organizations | Media initialize/upload/readiness, then versioned `/rest/posts` at due time, followed by read-back. | Community Management access/review, correct organization role and `w_organization_social` / `r_organization_social`. Use supported monthly `LinkedIn-Version` plus Rest.li header; do not ship retiring 202511. Member scope is not organization authority. Adapter remains to implement. |
| YouTube, future clients | Resumable private video upload and native future `status.publishAt`, followed by processing/privacy/publication read-back. | Explicit future channel OAuth and `youtube.upload`, exact channel mapping, consent/review/quota checks and schema support. Current review channel enum excludes YouTube; do not bypass it. Never omit private status or send a past publishAt (can publish immediately). Upload/session adapter remains to implement; due-time kernel is not an early-upload scheduler. |

The generic binding's evidence booleans are internal server adapter inputs, not
client-provided authorization. A production transport must reject non-success
HTTP/Graph envelopes, resolve tokens privately, and never log signed media URLs.
Media preparation must verify format/codec/dimensions/duration/size, image count,
rights and expiry per provider and preserve the approved immutable asset hash.
No universal hard-coded media size, quota or native scheduling window is inferred.

## Activation sequence within the existing owners

1. Implement/review storage ports on **existing `background_jobs`**, using its
   durable claim substrate. Enforce unique intent plus cross-version recovery:
   unresolved or posted attempts for the same deliverable/platform/account must
   block fresh submission even if review version or connection changes. Atomic
   beginAttempt must compare current source/authorization and fence. Include
   local PostgreSQL concurrent claims, expired lease and cross-client role tests.
2. Wire first Facebook photo adapter to existing encrypted token/mapping source
   and an approved-hash media resolver. Add provider status reconciliation jobs,
   bounded safe retries, cancellation/reschedule races and private error receipts.
   Extend #269's Business foundation and individual provider adapters separately.
3. Request an exact production packet only after reviewed migration/functions,
   app scopes/consent and fixture acceptance. No deployment or provider setting
   change is authorized by this local work or by opening signed-in native apps.
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
* [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-09):
  organization roles, media readiness and version headers.
* [YouTube insert](https://developers.google.com/youtube/data/reference/rest/v3/videos/insert)
  and [video status/publishAt](https://developers.google.com/youtube/data/reference/rest/v3/videos):
  explicitly private uploads; future schedule restrictions and current quotas.
  Current documentation says unverified API projects are **not** automatically
  restricted to private viewing; do not rely on obsolete audit restrictions as a
  safety guard. This implementation still requires explicit private status.

## Verification receipt

Focused95/95, scoped ESLint, helper TypeScript and full app build pass. Emitted
application chunks contain CG Dynamics code. Node24.16.0 full suite:4338 total,
4307 pass,30 skipped,1 fixture-origin failure in unchanged
`clientPortalLibraryTruth.test.mjs`. That test expects `http://127.0.0.1:1`, while
the isolated run used `https://fixture.invalid`; its complete6-test file passes
with the expected loopback fixture origin. These reruns are not additional unique
tests and this is not described as an unqualified green full invocation. Existing
Git OpenSSL was added to that process's PATH only; no machine configuration or
real Supabase credentials were used. A first invocation lacked fixture env and
OpenSSL; the supported run above supersedes that setup result. Generated access
matrix outputs were restored; no unrelated artifacts remain in the diff. No UI changed;
no authenticated Dynamics publishing or phone acceptance is claimed from fixtures.
No production migration/data/configuration/OAuth/deployment was performed. Other
open Nolan/Picasso/staff PRs remain untouched. Exact Google Control Centre target
remains unidentified in current handover; no guessed tracker write.
