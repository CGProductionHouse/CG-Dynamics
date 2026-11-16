# Social publishing — 15 November 2026

## Latest 16 November — concrete Instagram credentials and JPEG qualification, SOURCE ONLY

Same draft PR #991 / #220, with no worker activation or production change. Both
Instagram routes now have private read-only credential adapters over the EXISTING
encrypted stores and exact active client/account/connection mappings. Instagram
Login verifies the stored app/grant/confirmed-asset provenance, current professional
and app-scoped identity, and publishing-permission quota endpoint on
graph.instagram.com. Facebook Login separately checks encrypted USER-token app
diagnostics, current grants, mapped Page tasks, Page-token identity and its linked
Instagram identity on graph.facebook.com. It does not require the unrelated
pages_manage_posts scope. Shared Meta token diagnostics were extracted from the
existing Facebook provider; all existing Facebook regressions still pass. No
reporting fallback, plaintext fallback, token refresh/write, added scope or consent.

Private Instagram composition now joins those checks to the existing durable
create/publish/status protocol and original approved-file hash/signing. It is
deliberately NOT registered in an Edge entry, worker or MCP action, and requires
an actual private decoder function; there is no passing qualification default.
Canonical Instagram candidate/confirmation/release-policy wiring remains future
work. No caller-supplied proof can activate this composition.

JPEG qualification admits only original baseline 8-bit single-scan JFIF in a
conservative greyscale/YCbCr profile: <=8 MB for Instagram, <=4 MP, width 320..1440,
aspect 0.8..1.91. Other profiles, progressive/EXIF/ICC/Adobe/MPO extensions, trailing
payloads and mismatched source hashes fail closed; nothing is converted, stripped
or recompressed. Marker/header checks alone never qualify a file: bounded strict
pixel decode is REQUIRED and dimensions/RGBA output must match. Decoder settings
cap resolution/memory and disable tolerant decoding. These application bounds
are a supported pilot subset, not a claim to support every provider-valid JPEG.

Three integration defects were reproduced before fixing: asynchronous credential
evidence compared with the pre-request clock; fresh preparation evidence treated
as future-dated after a slow verifier; and exhausted publication quota preventing
GET-only reconciliation of the last submitted post. Freshness/token margin and
captured Teams proof now use completion time. Zero remaining quota blocks NEW
admission/create/publish, while authenticated status reads can still verify the
existing receipt. No replay or quota bypass was added.

Final full local acceptance: **4,597 total / 4,567 passed / 30 skipped / 0 failures**,
including all 27 real isolated PostgreSQL checks. Focused acceptance: 154/154,
including 41 credential/composition, 44 Instagram protocol/transport, 41 Facebook,
11 JPEG and 17 preparation checks. Synthetic provider/storage transports exercise
actual encryption helpers and composition; they are not live provider acceptance.
Build/emitted app bundle, scoped lint, helper TypeScript bridge and diff pass.
No new UI or browser/physical phone/native Deno acceptance is claimed. FOUR prior
candidate migrations remain unapplied; this increment adds no migration.

`scripts/qa/publication-jpeg-codec.mjs` separately exercises an official integrity-
checked `jpeg-js@0.4.4` archive in task-only TEMP, without installing it in the app.
Five real decode calls pass, including corrupt entropy rejection and solid/high-
detail 1440x1800 images. Original fixture bytes remain unchanged. Desktop decode
timing is NOT a hosted Edge CPU/memory receipt. Repository package.json/lock and
shared node_modules are unchanged; no production dependency is approved or added.

### Exact source-only decoder adoption proposal — requires dependency approval

AGENTS.md requires "no new production dependencies without approval". Proposed
next increment: pin ONLY `jpeg-js` to `0.4.4` and its one lock entry, preserve
upstream licensing notices, add a private facade importing `npm:jpeg-js@0.4.4`, and
pass its strict decode implementation to the already tested Instagram composition.
No worker registration/activation, other media profile, provider call, live setting,
SQL, upload, publication, OAuth or deployment is included. The package has no
runtime dependencies. Verified archive SRI:
`sha512-WZzeDOEtTOBK4Mdsar0IqEU5sMr3vSV2RqkAIzUEV2BHnUfKGyswWFPFwK5EeDo93K3FohSHbLAjj0s1Wzd+dg==`.
Do not copy npm's generated proposal lock wholesale: it pruned unrelated existing
entries. A minimal reviewed lock delta and isolated dependencies are required;
this checkout's node_modules junction must not be mutated. Native Edge acceptance,
caption/tag/disclosure constraints and exact rollout authorization remain separate.

Current main remains 4af41304; Nolan PR #990 has no overlapping publishing files.
Teams scheduling/Microsoft sync hold and all other provider prerequisites below
are preserved. Google Control Centre target remains unidentified; no guessed write.

## Earlier 16 November — durable Instagram photo protocol, SOURCE ONLY

Same draft PR #991 / #220 / #236; no competing scheduler or Nolan lane. Reproduced the
ready-container gap before the change: FINISHED could only remain processing;
there was no durable, separate authority for media_publish. New protocol now
supports four persisted claims over the SAME background_jobs row: create one
container, record readiness, atomically begin one publish attempt, verify the
distinct media ID and owner with GET-only reads. No create+publish double POST
inside one claim, and no container ID/FINISHED status is advertised as posted.

New CLI-generated, **UNAPPLIED** fourth migration:
`20261116102019_instagram_publication_steps.sql`. It preserves existing generic
claimer/receipt implementations behind service-only wrappers and adds
`begin_instagram_publication_publish`. Durable phase/read budget/attempt markers
live in the existing private job JSON. Second begin rechecks lease/fence, source,
original authorization/fingerprint, active actor, revocation, schedule and older
attempt barriers. It consumes the attempt BEFORE the second provider mutation;
restart/timeout cannot replay it. Receipt/container identities are immutable;
late receipts remain evidence without phase promotion. Five-minute execution
bound and conservative five status/receipt-check budget, with one-minute spacing,
prevent indefinite polling. No client grants, RLS weakening, new table or cron.

Private single-photo protocol and bounded transport support Instagram Login and
Facebook Login as distinct host/scope families. Exact account/connection/client,
credential expiry, current private verifier receipt, request paths/fields,
approved caption and qualified delivery URL are pinned. Facebook-login HMAC proof
is route-specific. No redirect, arbitrary URL/path/header, POST retry, credential
DTO or native-console token reuse. Quota uses the CURRENT returned config; Meta's
overview and reference give different numerical examples, so no 50/100 default.
Owner-verified public media is required for a posted receipt. HTTP/Graph/timeout
errors are scrubbed. Initial dispatch keeps its earlier no-resubmit decisions;
the shared-check refactor regression was reproduced and fixed in review.

**Instagram is NOT registered/activated in the production worker/configuration.**
Its concrete login-specific app/permission/role/mapping verifier and actual JPEG
qualification remain mandatory private adapter gates. The existing reporting
credential helper's analytics fallback is NOT sufficient publication evidence.
No new OAuth scope, token, account mapping, media conversion, provider setting,
consent, file upload, schedule, post or deployment was performed. JPEG/metadata,
caption/tag/disclosure and other provider media constraints must be qualified
before any exact pilot release. Reels/carousels/stories are intentionally not
accepted by this single-JPEG adapter. No runtime dependency was added. A read-only
registry/source review identified `jpeg-js@0.4.4` as a candidate decoder; its official
tarball was downloaded to a task-only TEMP directory for inspection, not installed
or executed in the app. New production dependencies require separate approval.

Official sources checked 16 November:
[publishing flow](https://developers.facebook.com/documentation/instagram-platform/content-publishing),
[container states](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-container),
[quota response](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit),
[media/owner verification](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/v21.0/),
[image/container requirements](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media).
The provider, not a guessed shared publishing API, defines each stage.

Local evidence: 43 Instagram regressions + existing policy checks pass; real
PostgreSQL group passes all 27 tests, including four new Instagram integration,
concurrent/crash/late-response, revocation/source/age/lease and service-role-only
cases. Uses actual candidate SQL with synthetic Graph/media transports, not live
provider acceptance. Final full run: 4,542 total / 4,512 passed / 30 skipped / 0 failures;
includes the actual candidate SQL and preserves existing Facebook/TikTok tests.
Build/emitted app, scoped lint and helper/entry typing bridge pass. Generated
unrelated access-matrix artifacts were restored and the task-owned network-none
PostgreSQL container stopped after acceptance.
No new UI changes or physical phone/browser verification are claimed. Current main
is `4af41304`; open Nolan PR #990 has no overlapping publishing files. All FOUR candidate
migrations need a future exact release review; none was applied by this lane.

Further TikTok official research confirms media URLs require an owned verified
URL property; do not assume a Supabase signed storage URL qualifies. The exact
current property inventory/Business publish payload and receipt contract still
need primary-provider verification. The portal reference remains inaccessible
through the documentation tool; no secondary sample was implemented as fact and
no live DNS/provider property/upload change occurred. Existing TikTok OAuth gates
and other platform/real-provider/phone acceptance work remain in this same record.

Earlier increments below are historical; this latest section supersedes their
three-migration and missing-Instagram-phase SOURCE status.

## 16 November continuation — concrete Facebook photo path, SOURCE ONLY

This supersedes earlier statements that preparation/provider bindings are
unregistered in source. Same PR991/#220, same existing background_jobs and
monthly_deliverables authorities. Nothing in this continuation is deployed.

The new private runtime composes the canonical candidate reader, encrypted Meta
token diagnostics, live exact-Page permissions/tasks/token identity, original PNG
qualification, durable staff authorization and existing worker. A separate
UNDEPLOYED `social-publication-authorization` entry accepts only a review ID for
preview, then its exact fingerprint + explicit confirmation. It derives the
client/deliverable/account on the server; caller-supplied account/media/permission
proofs are rejected. Preview cannot sign files, enqueue jobs or publish. Confirm
atomically records one existing-queue job, without making a provider request.
The worker recovers the ORIGINAL authorization and rechecks the same canonical
and private evidence before its durable begin barrier. Provider receipt reading
remains separate from submission. Lost responses never license another POST.

Staff confirmation UI is implemented behind default-off
`VITE_SOCIAL_PUBLISHING_PREVIEW`. Existing client/ordinary-staff visibility gates
remain intact. It requires prepare then exact confirmation, supports zero-write
cancel, clears stale/uncertain previews, refreshes job status and never calls a
queued job a live post. The status API's `canAuthorize:false` remains its scoped
status/withdrawal contract; new authority uses the separate gated entry.

Server activation needs BOTH `SOCIAL_PUBLISHING_ENABLED=true` and
`SOCIAL_FACEBOOK_PHOTO_ENABLED=true`, plus `SOCIAL_FACEBOOK_PHOTO_RELEASE` with
exactly clientId/connectionId/accountId for ONE later approved account packet.
No packet/client/default Graph version is inferred. Existing META_GRAPH_VERSION,
META_APP_ID, META_APP_SECRET, encrypted-token settings and SUPABASE_URL are reused;
none was read from production or changed. Global flag alone still cannot publish.
The new entry and changed worker must be reviewed/deployed together in a later
exact release packet; none of these flags is authorization to enable them now.

First qualified media profile: original static, non-interlaced, 8-bit PNG;
greyscale/RGB with optional alpha, <10,000,000 bytes, maximum 4096 per dimension
and 16,777,216 pixels. Those dimensions/format subset are OUR conservative pilot
bounds, not Facebook's universal limits. PNG CRCs, chunk order, static profile,
actual bounded zlib stream, scanline lengths/filters and SHA256 are checked.
Byte bounds apply before body materialization/copy; no new runtime dependency,
conversion, metadata stripping, public upload or external verifier. JPEG/video,
palette/interlaced/APNG and unreviewed metadata extensions are held. Qualification
does not infer licensing/content suitability; staff's exact confirmation carries
that editorial decision. Media is revalidated before its short-lived delivery URL.

Official sources checked 16 November:
[Meta Photo reference](https://developers.facebook.com/docs/graph-api/reference/photo/)
states static photos under 10MB; [W3C PNG Third Edition](https://www.w3.org/TR/png-3/)
defines CRC, chunks, zlib datastream and scanline rules. Detailed Page-photo
reference availability had been limited; no undocumented universal pixel limits
or successful live provider qualification is asserted.

Validation: 103 affected tests pass, including the fully composed runtime with
fixture storage/Graph (prepare -> confirm -> one queue -> submit -> separate
published receipt), loss/duplicate/foreign-account/revocation guards, valid PNGs
and corrupt/oversized/animated/decompression-bomb rejection, plus actual TSX
callback lifecycle/confirmation tests. Build/app bundle, scoped lint, helper and
new-entry typing bridge pass. Full PostgreSQL-inclusive run: 4494 total /4464
passed /30 skipped /0 failures. One additional actual-authorization-Edge-entry
regression was added afterward and passes in the 103-test affected rerun; runtime
source is unchanged from the full run. This is local fixture acceptance, not live
provider or native Deno acceptance. Browser inventory again returned no browser
access; no UI input/profile/session changes or new visual/phone acceptance.

Still open in this SAME lane: deployed schema/entries and exact-account/provider
approval; publishing-scope OAuth consent where absent; real provider/media/native
schedule cross-check and phone acceptance; qualified JPEG/video; Instagram's
durably separated container/publish phases, TikTok Business media/status adapters,
LinkedIn media/role flow, and future-only explicitly-private YouTube upload flow.
TikTok OAuth grant remains unverified live. All THREE existing candidate migrations
(queue/authorization, TikTok OAuth, captured schedule evidence) remain unapplied.
No provider settings/consent/post/schedule, production
data/SQL/Edge/config/secret, Microsoft or Vercel action occurred. Teams remains
the team's scheduling surface and the Microsoft sync hold stays intact.

The remainder below records earlier increments and evidence; the current source
composition above supersedes their historical "not registered" statements.

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

### 16 November continuation — canonical preparation and captured schedule proof

`publicationCandidateReader` now binds the active manager, active exact client,
approved review, canonical deliverable and reviewed exact-account release policy.
It derives SHA-256 from the actual private review snapshot, re-reading approval
metadata first. `inspectPublicationSnapshot` is shared with due-time delivery;
preparation creates no signed URL, upload, transformation or grant. Private byte
buffers and verifier extras/credentials never enter its returned context/evidence.
Provider access and full media qualification require fresh independent private
receipts; a signature/hash or caller readiness flag cannot substitute for them.
Selected target/release identity is captured against mutation during async work.
Only allowlisted preparation blockers reach the authorization response; raw private
adapter/SDK errors remain unavailable and sanitized.

The CLI-generated **unapplied**
`20261116085815_social_publication_preparation_evidence.sql` adds one stable,
invoker, service-only read RPC over existing Microsoft capture tables. It neither
collects Graph data nor invokes refresh/apply, stamps jobs or writes Microsoft/
schedule state. It reads only the exact persisted plan/task/bucket link, checks
the approved revision/client and rejects duplicate canonical task links. The
latest source attempt wins: a newer incomplete/failed capture blocks an older
success. Job start, export and source completion must be within the existing
five-minute preparation evidence window; an old capture cannot be freshened by
changing only its export timestamp. Run/job/source identities and completed
coverage must agree, and the exact task must be uncompleted with the canonical
posting date. Only IDs, date, revision and timing proof leave SQL; titles, notes
and the captured array remain private. The existing Microsoft sync hold is intact.

This proves the current captured **date/completion instruction**, not a native
platform's full schedule or every semantic change to task notes. The approved
review and staff confirmation bind the exact UTC/SAST publication time and bytes.
Stale or absent captures are held; this reader never starts a new capture to
manufacture freshness or falls back to a task/client title match.

A real-PostgreSQL negative test reproduced a duplicate-post risk: setting the
canonical item to `scheduled` manually, without `posted_at`, still permitted the
worker begin barrier. Both pure admission and final SQL source checks now reject
canonical `scheduled`/`posted` state. The existing unapplied queue migration was
updated for that guard; current-source review is required before any later apply.

There are now **three unapplied migration candidates** in this PR (queue, Business
OAuth and this narrow preparation read). No existing Microsoft function/table,
collector, permission or mapping is changed by this increment. The new candidate
reader is private/unregistered: provider/media qualification implementations,
reviewed exact-account release policy, preview/new-confirmation wiring and real
provider/phone acceptance remain activation gates. Existing status/withdrawal
scope is unchanged; `canAuthorize` remains false. No production/API/provider/
OAuth/Microsoft/deployment action was performed and no browser work was repeated.

Final acceptance: **4463 total /4433 passed /30 skipped /0 failures**, Node24.16.0,
with the task-isolated real PostgreSQL fixture. Nineteen new regressions are
included (15 preparation/snapshot checks, four added SQL subtests). The121 affected
checks pass:98 policy/OAuth/provider/authorization/preparation and23 PostgreSQL.
The manual-scheduled source defect failed first in
`%TEMP%/cg-preparation-manual-schedule-repro.log`, then passed in the corrected
targeted and full runs. Build/emitted app bundle, scoped ESLint, strict helper
typing and diff pass. No new dependency or CLI upgrade; CLI2.115.0 generated the
third migration in this exact isolated worktree. Generated access artifacts were
restored and the owned QA container stopped. No new UI/browser/phone/hosted Edge/
real-provider acceptance is claimed. Logs: `%TEMP%/cg-preparation-full-acceptance.log`,
`%TEMP%/cg-preparation-focused-final.log`, `%TEMP%/cg-preparation-evidence-pg-final.log`,
`%TEMP%/cg-preparation-build.log`. Existing Vercel Git-deployment guard remains off.

### 16 November continuation — staff status and withdrawal interface

The existing `ContentReviewCard` now exposes a lazy **Publishing status** panel
to managers/admins in Client Schedule's production panel and the staff approval
queue. Client cards and ordinary staff cards never expose management controls.
It uses existing branded components/classes and vendored Lucide SVG assets; no
production dependency or new page/calendar was added. The old unconditional
claim that an approved review had not been scheduled/posted by Dynamics was
replaced with an instruction to check actual status and the native platform.

The new **undeployed** `social-publication` Edge entrypoint supports only status
and explicit withdrawal. It verifies the current active manager profile, derives
client/deliverable scope from the exact review, and reads complete matching jobs.
Private payloads, evidence, credentials and arbitrary provider URLs are not
returned. Missing/malformed/partial backend evidence is unavailable, never empty
or healthy. Verified Facebook links require the exact Page/post identity. A
generic cancellation cannot make an unstarted job look queued. Reading a stored
receipt is not a fresh provider-health assertion or a native scheduler inventory.

The UI distinguishes queued, submitting, processing, provider-scheduled,
verified-posted, stopped, failed/blocked and uncertain outcomes. Withdrawal needs
a second explicit click and sends only review/job IDs; the server derives client
scope and refuses a job from another review. Uncertain withdrawal invalidates the
old view until readback. Once an operation starts, withdrawal preserves its state
and warns that no provider post was cancelled/deleted. Creative approval, Teams
and canonical schedule fields remain untouched. No automatic retry/submit action
is offered. Both the UI and endpoint keep new authorization unavailable.

A deterministic regression reproduced that the prior disabled-rollout gate also
blocked withdrawal (`409` instead of `200`). Withdrawal now remains available
to an active manager even while creation/publishing is disabled. Preview and
new confirmation still require the original rollout gate and trusted preflight.

No UI automation action completed: browser inventory reported local browser access
unavailable, and the native Chrome read was stopped because the tool could not
determine the current URL confidently. No browser/security setting, tab/session
or provider account was changed. The synthetic fixture was prepared and stopped;
it was **not visually accepted**. Actual component callback/lifecycle tests cover
second confirmation, late responses after review switching, and uncertain or
already-started withdrawals. These are unit checks, not browser/mobile proofs.

Release order remains review/approval first: current queue migration, then the
reviewed new management function, then a separately authorized frontend release.
Before those gates, the UI's absent-backend path is explicitly unavailable and
directs staff to Teams/native-platform checks. No live status/withdrawal action,
SQL, Edge rollout, provider mutation, OAuth, Microsoft write or Vercel use occurred.
Trusted current-context/Teams/media adapters, preview/new-confirmation staff
wiring and remaining provider adapters stay in the existing activation plan.

Final acceptance for this increment: **4444 total /4414 passed /30 skipped /
0 failures**, Node24.16.0, including the existing isolated PostgreSQL fixtures.
Twenty new checks are included: the disabled-gate withdrawal regression and19
management/role/receipt/component lifecycle checks. The42 targeted management,
authorization, client-approval and teardown checks pass. Full acceptance initially
exposed an old staff-copy assertion and a teardown-guard mismatch; those contracts
were updated/cleanup hardened, then the targeted and complete suites passed.
App build, emitted `ContentReviewCard` management code, scoped ESLint, strict
Edge/helper typing bridge and diff checks pass. React review retained event-driven
loading, imported existing icons, bounded scoped requests and keyed async cleanup.
The two generated access-matrix files were restored; the owned QA container and
local fixture were stopped. No visual/mobile pass is inferred from these checks.
Logs: `%TEMP%/cg-publication-management-final-acceptance.log`,
`%TEMP%/cg-publication-management-focused-final.log`,
`%TEMP%/cg-publishing-stop-repro.log`, `%TEMP%/cg-publication-management-build.log`.
Existing Vercel Git-deployment guard remains false; no PR checks/cloud deployment
were triggered. Source checkout is clean after the continuation commit.

### 16 November continuation — exact staff confirmation in the existing queue

The authorization core now provides **preview → explicit confirmation → durable
queue receipt**, one channel/account at a time. Preview writes nothing. Confirmation
re-reads the server candidate, requires an active manager/admin and the exact
preview fingerprint, and uses fresh server-owned Teams/provider/media evidence.
Request bodies cannot supply an actor, caption, asset hash, readiness flag or
permission proof. Unknown fields, stale/foreign evidence, changed source, past
times and expired credentials fail closed. Bodies are bounded while streaming;
errors/receipts expose no provider credentials, delivery URLs or internal evidence.

The fingerprint binds client, deliverable, approved revision, route/channel,
connection/account, path/hash/MIME, caption and exact time using UTF-8 byte-length
prefixes shared by TypeScript and SQL. It is a stale-preview detector, **not a
bearer permission**. Reconnection/retargeting cannot silently replace the recorded
intent; repeated and concurrent confirmations preserve the original receipt.

The existing unapplied queue migration now stores the immutable confirmation and
safe preflight provenance in `background_jobs.publication.authorization`, atomically
with enqueue. No new table, queue, calendar or production dependency is introduced.
The worker's SQL begin barrier now requires that stored, matching, unrevoked
confirmation plus its active authorizer. A raw internal enqueue alone cannot
authorize provider mutation. A private loader recovers that original confirmation
for the worker's future trusted current-context adapter; it never mints a grant.

Revocation cancels an unstarted queued/claimed job and invalidates its lease. If an
operation has already begun, it records withdrawal while preserving in-flight/
posted truth and permitting status/receipt reconciliation. It does **not** claim
to cancel/delete a provider post or make a started mutation reversible. Repeat
withdrawals preserve the same audit fact; foreign-client lookups cannot mutate it.

`socialPublicationAuthorization.ts` and `socialPublicationAuthorizationStore.ts`
are a tested server action core and service-only RPC ports. Preview/new confirmation
is **not exposed through a deployed Edge endpoint, ChatGPT tool or staff button yet**;
status and withdrawal now have the source-only management interface above. Trusted
current-context/Teams/media adapters and the existing staff interface must be
connected before registration. No native provider access/OAuth or caller checkbox
is promoted into proof. Worker bindings remain unregistered; publishing and
deployment remain disabled. No live user/client/post/Teams record was changed.

Security review reproduced a candidate RLS gap in real isolated PostgreSQL:
the generic job policy let an original requester still read publication payloads
after their role became client/staff or inactive. A new **restrictive SELECT policy
for social_publish only** requires an active manager/admin. The negative test first
failed with `Publication leaked to client/true`; the policy closes that case while
preserving generic job visibility. This is a local candidate fix, not evidence of
live social publication data or a production incident. No browser grants were
added to the authorization RPCs; they remain service-only, invoker/search-path safe.

The queue migration candidate `20261115104948_social_publishing_queue.sql` was
revised in place because it is still unapplied. Any later rollout must review the
current PR contents, not an earlier c0b21145/ec06d3a7 migration snapshot. Existing
OAuth migration, credentials and server settings are unchanged. Publication reads
are narrowed as described above; generic job visibility is preserved.

Final acceptance for this continuation: **4424 total /4394 passed /30 skipped /
0 failures**, Node24.16.0, including real isolated PostgreSQL. There are28 new
regressions:19 authorization/HTTP/worker-read checks and9 additional PostgreSQL
subtests. The101 affected checks pass (82 policy/OAuth/provider/authorization +
19 PostgreSQL), included in the full total. The expected failing RLS reproduction
was followed by the passing19-test PostgreSQL run and this final full run.
Build/emitted app-code bundle, scoped ESLint, strict helper typing and diff pass.
No UI was changed; no additional browser/phone/hosted Edge/provider acceptance
is claimed. Generated access-matrix outputs restored and owned QA container stopped.
Logs: `%TEMP%/cg-social-authorization-final-acceptance.log`,
`%TEMP%/cg-social-authorize-focused.log`, `%TEMP%/cg-social-authorization-pg-final.log`,
`%TEMP%/cg-social-authorization-rls-repro.log` and `%TEMP%/cg-social-authorization-build.log`.
This supersedes the earlier4423 run, before the final privacy regression/policy.
Vercel Git deployments remain disabled; no PR checks/deployment were triggered.

### 16 November continuation — private Facebook photo delivery

Continued the same draft PR991 after confirming the isolated checkout was clean,
main remained `4af41304`, and no competing social-publishing PR existed. Nolan's
PR990 and other staff/workboard lanes were left alone. No live browser/provider
session was needed or changed for this source-only increment.

`facebookPublishingProvider.ts` now composes private photo submission/read-back
ports over the existing Meta mapping, encrypted token store and snapshot bucket.
It requires the exact active client/Page/**connection_id** mapping; nullable or
ambiguous mappings are held, never inferred from the latest global connection.
It reuses `readMetaStoredToken` and live `inspectMetaAccessToken` app/USER-token,
scope and expiry diagnostics, rejects plaintext fallback, and never rewrites tokens.

`facebookPublishingTransport.ts` rechecks live permission grants (including
`pages_show_list` needed for discovery), the exact Page's `CREATE_CONTENT` task
and Page-token identity. Page discovery uses bounded cursors on the fixed,
explicitly versioned Graph host; provider-supplied pagination URLs are never
followed. Authorization headers and HMAC app-secret proofs stay private.
Photo submission accepts only the captured approved caption, Page and freshly
resolved media URL, with one mutation per transport, no redirects/retries and a
two-minute credential/preflight lifetime. HTTP/Graph/malformed/timeout errors
return sanitized codes; they never authorize a repeated POST. Submission remains
behind the durable attempt barrier, with publication read-back kept separate.

`socialPublishingMedia.ts` reads the exact approved client/deliverable/revision
from `content_review_versions`, downloads only its private INSERT-only
`content-review-snapshots` object, and verifies MIME, signature and SHA-256 before
signing the exact untransformed object for five minutes. It rejects foreign
paths/hosts, traversal, changed captions/dates/channels/bytes and signing errors.
No source OneDrive URL, arbitrary caller URL, public-bucket switch, upload or
asset publication is introduced. The existing 50 MiB bucket bound is not a
provider media-limit claim. Signatures are not a substitute for full provider
dimensions/codec/rights qualification, which remains a separate preflight gate.

These are **unregistered private ports**, not an enabled publishing path. The
worker still has no provider bindings and no public enqueue producer. Current
context/staff-action wiring, Teams instruction verification and provider
media/app-review acceptance must be completed before registration. Native Suite
access and OAuth alone do not satisfy those gates. No migration or new setting
was added in this increment; no live API, consent, publication or deployment ran.

Verification: 37 new deterministic provider/storage/credential checks pass;
63 affected policy/OAuth/provider checks pass. Full Node24.16.0 acceptance is
4396 total / 4366 passed / 30 skipped / 0 failures, including the existing real
isolated PostgreSQL fixtures. App build and emitted TikTok integration bundle,
scoped ESLint, strict helper typing (including unused checks) and diff checks pass.
The full suite's generated access-matrix files were restored and only this lane's
label-verified, network-isolated QA container was started/stopped. Review found no
blocking local issue; activation/current-context/media gates above remain open.
No new UI was changed, so no additional mobile/browser or real provider acceptance
is claimed. Logs: `%TEMP%/cg-social-facebook-full-acceptance.log`,
`%TEMP%/cg-facebook-focused.log`, `%TEMP%/cg-social-facebook-build.log`.
Vercel's existing `git.deploymentEnabled=false` guard and no PR checks were
verified before the source-only push; neither was changed.

Official guidance rechecked 16 November: [Meta Page photo publishing](https://developers.facebook.com/documentation/pages-api/posts)
and [secure requests](https://developers.facebook.com/docs/graph-api/guides/secure-requests/),
plus [Supabase private storage/signing](https://supabase.com/docs/guides/storage/serving/downloads).
The Supabase changelog shows no relevant JS storage contract change; the installed
CLI stays pinned and no upgrade/configuration was performed.

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
| Facebook Pages | Due-time Page photo submission now has private versioned Graph, encrypted exact-Page credential and approved-hash snapshot delivery ports. Video/Reel uploads remain separate adapters. Native scheduling is not assumed. | Complete trusted current-context adapter/staff-action wiring, full media preflight, app review/advanced access and any content-specific permission; register in the durable worker only after review. Live Page discovery also requires `pages_show_list`; analytics OAuth is insufficient. |
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
   `20261115104950_tiktok_business_oauth.sql`, plus the narrow read RPC in
   `20261116085815_social_publication_preparation_evidence.sql`, all CLI-generated.
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
3. The first Facebook photo adapter now has private encrypted token/mapping and
   approved-hash snapshot delivery ports. Exact preview/confirmation persistence
   and revocation now exist in the same queue. Complete trusted current-context,
   media qualification and staff-action wiring before registering it. The canonical
   candidate/snapshot reader and captured-Teams proof now exist privately; no
   default provider/media proof is supplied. Add provider status reconciliation jobs,
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
