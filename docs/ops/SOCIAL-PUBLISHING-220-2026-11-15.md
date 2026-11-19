# Social publishing — 15 November 2026

## 19 November — TWO exact-approved backend packets live; dispatch still off

CA approved only the reviewed MCP scheduling actions + OAuth permission-setup
handler and consent-setup flag, including the documented identical-property
cleanup. No approval for publishing, jobs, client mappings, migrations, Vercel,
worker activation or Facebook consent. Source checkpoint08960624 is built/tested
and pushed to SAME DRAFT PR #991; existing owners/Teams hold preserved.

Deployed the unchanged immutable packets after fresh source/auth drift checks:
MCP payload5aac9755859e0a54fcdf7b0bbc38e14e2cca0e294230e870ba54302dde4610cf,
OAuth payload07750f9e57118aab7b51c98a5b70d950e91cab9e1ca8c8ed1203a17014cf8d09.
MCP initialv88 then FINALv89 after config,68files ACTIVE, bundle
cf248a21ded526729053224bef5f238abf2aa1f2ac4948bb8b2c756b7af04f15.
OAuth initialv74 then FINALv75 after config,5files ACTIVE, bundle
d8f5654726d3ae72eabd5eb3c4367e3774e32b820fc5b36dda46ceebdcf8264d.
Every final hosted source file matches its approved packet byte-for-byte;
verify_jwt=false/import_map=false preserved. MCP62hosted files and OAuth3helpers
preserved. No source packet regenerated or extra function implementation deployed.
OAuth deployment API reported internal error while exact source was actually
ACTIVE; fresh readback recovered truth and NO retry/redeploy occurred. First
verifier assumed all helper paths contained supabase/; corrected normalization
for src/ and functions/ roots and verified unique complete sets. No runtime fix
or rollback was needed; errors are retained in private release evidence.

Used the installed authenticated Supabase CLI2.115.0 only after reading its
current --help. Read metadata, set ONLY
SOCIAL_FACEBOOK_PHOTO_CONSENT_ENABLED=true, then read metadata again. All76prior
configuration hashes unchanged,77rows total, exactly this one new flag. Actual
publishing/confirmation/MCP submission/exact-account release keys are all ABSENT.
CLI output labels SHA256 digest value rather than digest; verified all76/77
rows contain64hex digests, checked true's known digest, compared every existing
name/value hash. Corrected verifier without repeating a write. No actual secret,
token, auth store, encryption key or credential values read/exported. CLI uses its
existing authorized connection internally; no copied credentials or new login.

Unauthenticated POST to each live endpoint returns401. Existing authenticated
company-admin Cape readiness list still returns available/empty/has_more:false/
canConfirm:false/canPublish:false. Bounded canonical SELECT found no eligible
future approved unscheduled Facebook photo, and no linked Cape review snapshot.
No invented review ID or historical-post reuse. This release only makes supported
MCP actions and consent setup available; it does not confer a grant or job authority.

Company Chrome and ChatGPT info@cgproductionhouse.com verified through visible
profile/account UI; existing company ChatGPT plugin remained installed with both
connections and unchanged Allow all setting. Before refresh catalogue30write/
30read; after one Refresh tools and completion, actual app modal31write/32read
and all3new exact action names present. Captured catalogue screenshot. A separate
new normal ChatGPT read-only acceptance asks for Cape readiness and exposed tools,
explicitly prohibiting confirmation, job/content/date/mapping/consent/provider/
Microsoft writes or invented IDs. Never touch staff/Nolan chats; catalogue exposure
and actual normal-chat execution are separate receipts. Result is captured with
this increment's private evidence and PR handoff. No plugin permission expansion.

The permission UI source is fully tested but not deployed (ZERO Vercel). Owner
consent is still pending and needs a supported accessible setup surface; do not
pretend the new source button is live or extract/copy auth to manufacture a URL.
Actual future approved pilot, exact account binding, native duplicate/Teams proof,
specific dispatch/worker release, controlled native post/readback and normal-chat
acceptance remain. Other held migrations and Elcheck repair are untouched.
No scheduling, publication, campaign/spend, SQL/data, Microsoft or hosting action.
Google Control Centre target still unknown; no guessed update.

Normal ChatGPT acceptance finished in the COMPANY account, ordinary Chat mode:
https://chatgpt.com/c/6afedf1d-0e2c-83ea-bc80-cce2e02bd297
(title Inspect Facebook Readiness). It confirms all3new actions exposed; executed
ONLY resolve_project_context and two get_facebook_post_readiness inspections.
The actual responses show exact-account mapping unavailable and a complete empty
eligible-review list. It refuses invented IDs and distinguishes exposed tools
from executed calls. Final discovery PASS/read-only inspection PASS, native Cape
scheduling BLOCKED. No prepare/confirm/status call was fabricated without a real
review; no jobs/data/provider/consent/sync writes. Preserved new test chat as the
review deliverable; all pre-existing company/staff/Nolan tabs/chats unchanged.
Private company-normal-chat-acceptance transcript/screenshot and refreshed app
catalogue screenshot retained. This is genuine normal-chat read acceptance,
NOT successful platform publication or proof of actual token grants.

## 19 November — explicit publishing permission setup in the existing Meta screen

Resumed SAME DRAFT PR #991 from1dda40f4; fetched mainb524a9f9 unchanged, PR/open
ownership and active workers checked. No second scheduler or overlapping staff,
Nolan, client, Teams, calendar or package lane. The missing publishing-permission
UI was reproduced before implementation in the preceding continuation; completed
that saved local work here. Normal reporting handleConnect remains unchanged.

FacebookPublishingConsent.tsx uses existing branded buttons and the existing
integration card: separate review, explicit checkbox, then opt-in OAuth request.
It does not connect accounts automatically or schedule/publish. Checking, unknown,
absent and recorded permission states stay distinct; recorded scope still needs
Page checks. No OAuth request on render/open/cancel; synchronous pending guard,
disabled controls and cleared confirmation prevent accidental duplicate requests.
Unmount/changed connection state cannot navigate on a late response. React ref
update moved into a layout effect after scoped lint reproduced the render-ref
failure. Existing manager route/server current-role gates remain authority.

metaPublishingConsent.ts invokes ONLY meta-oauth-start with the exact purpose and
confirmation query. It accepts only a verified publishing-purpose response with
publishing_ready:false, HTTPS www.facebook.com versioned dialog/code request,
one-use-format state, rerequest and the exact existing six reporting scopes plus
pages_manage_posts. Duplicate/unknown URL parameters, credentials/hash, unsafe
callback scheme, missing/broadened scopes and old reporting-only backend responses
are refused without navigation. Only safe known server error codes become UI copy;
no raw service error/token/URL is displayed or logged. Server opt-in gate and
owner consent remain independent from worker/confirmation/exact-release gates.

Deterministic regressions:102focused pass, including actual installed
Supabase FunctionsClient -> actual OAuth-start handler, with synthetic database/
auth/provider fixtures. Shared handler fixture extracted without changing its
prior10tests. Actual SDK proves query propagation, disabled/no-state behavior,
current-role refusal and hashed state; React SSR proves no request on initial
render and no false permission=readiness claim. No mocked transport proves a grant.
Build (tsc/Vite7.3.6) and actual MetaIntegrationPage-DXEg0Naj emitted app bundle
contain the new controls; scoped lint/diff pass. No new dependency or lock change.

Correct company Chrome profile cgproductionhouse.com was available this turn.
Private local fixture uses actual React DOM and compiled app CSS, synthetic
invoke/navigation ports, fake public Supabase settings and blocked external fetch.
TEN interaction checks pass: render/open zero requests, explicit consent, cancel
reset, disabled refusal, rapid repeated clicks one request, backend error privacy/
confirmation reset, verified-purpose captured redirect, connection-change and
unmount late-response suppression. Initial private harness read the Response
stream too early; bounded act/event-loop settling corrected the HARNESS, not the
production behavior. Actual375/390/430viewports show scroll widths360/375/415;
desktop and phone screenshots retained. Viewport reset, created tab closed,
task-owned fixture server stopped. No native Facebook consent/post, company
ChatGPT normal-chat action acceptance or physical-phone verification claimed.

Full-suite fixture uses the existing documented fake Supabase URL/key, Git
OpenSSL PATH and CG_PUBLICATION_JPEG_PACKAGE pointing to the previously qualified
official jpeg-js0.4.4 TEMP package. Shared node_modules lacks that already-approved
package; no install/change to shared dependencies was made. Initial broad run
without that package override was interrupted, preserved as failed/incomplete,
and not counted as acceptance. The preceding focused attempt also lacked the
documented fake environment; the final102pass receipt supersedes it. Final whole
suite5083total/5051pass/32optional skips/0fail/0cancel (473.5s) is the final receipt.
Existing37real
PostgreSQL tests remain PRIOR green evidence: no queue/SQL/worker change here,
so do not count a rerun or infer native publishing from those synthetic responses.

Bounded read-only pilot search with source-equivalent approval/client/date/media/
archive/posted/status checks returned ZERO future approved unscheduled Facebook
photos. Null production statuses are included consistently with the actual source
helper. No original media/caption copied, approval manufactured, staff date changed
or old published post reused. Cape's last authenticated exact-account inspection
returned EXACT_ACCOUNT_MAPPING_REQUIRED; browser human access is not API binding.

Fresh read-only hosted source metadata matches immutable packet baselines:
MCPv87/65files, bundle88fd63fd438fcded48a9d6f08615293f4eff4059d18950d8261dc3def5d7ca50;
OAuth-startv73/5files, bundle88f73a2c52f1f70fc69f635ae98b808d7d96d12654802ddcd66567fc4f49893c.
verify_jwt=false/import_map=false preserved. No env values, tokens or credentials
read; no source packet regenerated. Qualified payloads remain the MCP68-file
5aac9755859e0a54fcdf7b0bbc38e14e2cca0e294230e870ba54302dde4610cf and OAuth5-file
07750f9e57118aab7b51c98a5b70d950e91cab9e1ca8c8ed1203a17014cf8d09 packets below.

CA explicitly APPROVED ONLY these two backend updates plus consent-setup flag.
Source checkpoint precedes execution; no live release is claimed until readback.
Existing publishing,
MCP queue submission, staff confirmation and worker activation stay disabled;
owner's Facebook consent is separate. No Vercel, SQL/migration, accounts/mappings,
ads, content/date/approval, Microsoft, secrets or publishing action. Elcheck exact
repair approval separately pending and untouched. Google Control Centre target
unknown; no guessed write. Client-facing release/phone acceptance still separate.

Next executable live path after exact authorization: release these packets with
fresh drift checks, owner consent without altering existing asset selections,
verify actual grant/exact Page/connection mapping, select one explicitly approved
unscheduled future photo/caption/time, inspect fresh Teams/native duplicates,
then separately approve exact dispatch/worker activation and controlled native
post/readback. ChatGPT uses the existing company-admin preview/confirmation/status
actions, same fingerprint/key and same queue; actual normal-chat catalogue and
receipt acceptance remain required. No silent Instagram cross-posting or implied
TikTok/LinkedIn/YouTube readiness.

## 18 November — ChatGPT preview, exact confirmation and receipt recovery

Continued SAME DRAFT PR #991 from0149441d; mainb524a9f9/ownership checked;
other staff/client/leads/Nolan/Teams/calendar lanes preserved. Reproduced the
missing prepare_facebook_photo_publication action before editing. Added it,
confirm_facebook_photo_publication and get_social_publication_status to the
EXISTING MCP router, catalogue and company-admin context. Source catalogue63:
32read/31write. These are unreleased source actions, not current live tools.

The new facebookPublicationActions.ts adapter reuses photoPublicationStaffHandler,
facebookPublicationRuntime, socialPublicationAuthorizationStore and
readPublicationManagementStatus. No duplicate queue, schedule, source authority,
direct provider submission, schema, scope or dependency. Fresh active manager
and exact review/client binding precede runtime/media/credential reads. New
SOCIAL_FACEBOOK_PHOTO_MCP_ENABLED defaults off, then existing staff/dispatch/
exact-client-account-connection release gates must all pass. Preview returns
only safe approved content, Page, future time and fingerprint, with zero writes.
Confirmation requires exact explicit scheduling intent, fingerprint and stable
idempotency key; generic MCP input-hash/audit plus canonical receipt replay are
retained. Current role/source/content changes still refuse confirmation/replay.
No caller account, date, caption, media, approval or Microsoft override.

Status is independently readable when submission flags are off. Per-channel
stored jobs remain distinct from native schedules and verified platform posts.
Lost confirmation response or post-commit access loss is unverified/mayHaveCommitted,
with status-first recovery; never automatically replace/retry a provider POST.
No credentials, connection IDs, signed media URLs or raw exceptions in output.

Final frozen adapter SHA256
5793153f3141c05494844c08a169dcca6e3c08806268ced18a99dd4bf26ffd86.
Full suite5075total/5043pass/32optional skips/0fail/0cancel (510.1s);
focused93pass/0skip. The first interrupted full run found one stale catalogue
count60, corrected to63 before the final complete green run; do not count it as
additional acceptance. Tests cover actual MCP dispatcher key conflicts/cached
receipt replay and current role, not only helper-shaped mocks.

Real isolated PostgreSQL37pass/0skip/0fail (308.9s), including new actual MCP
adapter -> real runtime/preflight -> atomic authorization -> existing durable
queue -> due worker -> independently observed receipt. Runs before either held
later-platform migration, proving Facebook only needs the approved pair. One
durable job for repeated confirmation, lost-response read recovery, one due
simulated Graph POST, independent verified synthetic receipt, gates/role/client/
approval/source/lease refusals and existing paired-channel independence pass.
SQL execution is real; canonical fixtures and Graph/Storage transports are
synthetic. This does NOT establish native grants/publication or real ChatGPT UI.
Task-owned network-none QA container stopped and suite-generated unrelated
access-matrix artifacts restored after evidence capture.

Build (tsc +Vite7.3.6), actual emitted app bundle, scoped lint/diff and native
Deno2.9.8 strict adapter check pass. Whole source and exact packet entry also
pass with seven analysis-only mappings for inherited type-only frontend edges;
checker rejects runtime extensionless imports, product import_map unchanged.
Two late nullability assertions were proven emitted-token-identical to the
fully tested runtime; private check receipt retained, no executable late edit.

New immutable private packet:
C:/Users/chris/.codex/artifacts/social-publishing-991/2026-11-18/mcp-publication-actions/candidate-5793153f-final.
Captured actual live MCPv87/65files read-only; closure SHA256
8fccb9844e551e6c780fdbe95ce731a37796566ded44d27b862775fbae05d3dc.
Patch only index.ts/projectContext.ts/toolCatalog.ts; preserve62hosted files
byte-for-byte; add facebookPublicationActions.ts, facebookPublicationStaff.ts,
socialPublicationManagement.ts =68files. Existing SDK/jpeg-js imports are
inherited/approved dependencies, not newly approved packages. verify_jwt=false,
import_map=false preserved; config_writes empty. Payload SHA256
5aac9755859e0a54fcdf7b0bbc38e14e2cca0e294230e870ba54302dde4610cf.
Exact assembled packet native Deno and14action tests pass;5offline guards cover
source/version/auth/helper drift, duplicate/overwrite/output escape and exact
owned patch. Hosted-only static ACCESS SDK alias is inspected and preserved;
arbitrary computed imports refused. Initial partial candidate-5793153f rejected.
Fresh hosted version/source/auth check required before separately approved release;
rollback is exact capturedv87 source only after approval, preserving config/data.

No deployment or enablement authorized/performed. Live MCP remainsv87 with
unchanged tools; new flag unset/false. No production SQL/data/config/secret/
OAuth/account/mapping/permission/content/date/approval/provider POST/Microsoft/
Vercel or cost action. Previously approved Facebook DB pair is not replayed;
held TikTok/Instagram migrations and immutable runtime/OAuth packets untouched.
Elcheck exact repair approval remains pending, no apply from this continuation.
Google Control Centre target remains unidentified; no guessed tracker write.

Exact next step remains verified native publishing grant +client/connection/Page
binding and one approved unscheduled asset/caption/future time, fresh Teams/native
duplicate inspection, then separate exact runtime/MCP/config release approval.
Company normal-chat catalogue refresh/preview/confirmation/status acceptance and
controlled native publication readback are still required. Instagram needs its
own real permission/media/container path after the first Facebook pilot; existing
pairing does not confer approval or silent cross-posting. TikTok/LinkedIn/YouTube
dependencies remain as recorded below; no unsupported readiness claim.

## 18 November — reuse verified Facebook/Instagram pairs; Elcheck repair prepared

CA requested that linkable client Facebook/Instagram accounts work together for
scheduling as this lane progresses. Continued SAME PR #991 from b9041fff, with
main b524a9f9 unchanged, clean initial worktree and current owners checked. Only
this Codex chat is active; #995/#1003/#1004/Nolan/Teams/calendar lanes preserved.
No new OAuth system, schedule, queue, provider setting or automatic publication.

Bounded SELECT-only canonical registry inventory: 63 active registry clients,
47 active Meta mappings, 29 with both Page and Instagram IDs, 18 Page-only and
16 with no active mapping; 10 mapped rows have no connection_id. Registry active
is not the launch roster: preserve AV/Red Oak hold and Zooz not-yet-active
decisions. These are STORED mappings, not fresh native proof for all 29 pairs.
No token/secret/credential columns or values were read.

Existing company Chrome profile cgproductionhouse.com / Facebook Christie-Ann
used. Native selectors expose established pairs including Cape, Braize, Bat Hill,
Local Meat Deli, Dulux, Loraclox and Delta Gas. Do not reconnect/disconnect or
move working assets merely to make the count look complete. Two portfolio
previews were bounded: 20/25 visible company assets and 11 design assets;
third portfolio's Instagram directory also inspected. No full all-client native
acceptance is claimed. Private native-pair-directory.json records coverage.

Concrete discrepancy: Elcheck's Page1299076156631543 is already connected in
Meta to @elcheck_sa, Instagram17841459467022319. Verified the Instagram account
ID and its Connected assets link to that EXACT Page. Existing Dynamics mapping
27b13118-a207-4436-8cb7-7b0c33e26a47, client7b7d244f-77b4-4b2a-88f0-8ce3f7e1c202,
has no Instagram ID/username. No other active mapping owns that Instagram ID.
Existing connection65d8f626 remains; it is not a new account or grant.

Prepared one exact private SQL transaction, elcheck-link.sql, SHA256
aa106c507a667aa5b94b0a2c25afc9dd807e68b714f53fa06cd5ce914eb54cd0.
It changes ONLY Elcheck's Instagram ID/username/update timestamp, with exact
client/Page/connection/baseline/active/ownership checks, a bounded metadata
table lock, no-op same-tuple replay and atomic stale/conflict refusal. The only
real non-internal table trigger was inspected: timestamp-only. Two actual
isolated PostgreSQL tests, including that trigger, pass; unrelated client, ads,
staff fields and concurrent-edit baselines remain intact. No production apply
occurred. Exact approval is pending via the existing user-input request;
AGENTS.md:125 requires explicit CA approval. Do not infer it from silence or the
general request. Before applying, reread the exact baseline and SQL hash; verify
only those three fields differ afterwards. No forced sync/publication follows.

Native app976168728361566 (same canonical CG Dynamics app) is in Development.
pages_manage_posts, instagram_content_publish and the separate
instagram_business_content_publish show Standard access / Ready to use (0) /
No App Review requested. Facebook permission Requirements lists no standard
requirement and Business verification + App Review for Advanced Access.
This does NOT establish that a CA/app-role controlled pilot is prohibited;
nor does it establish external-client rollout eligibility or actual token grants.
No Live switch, advanced request, verification, terms or settings were submitted.
Existing #505 review records remain authority; do not restart old resolved setup.
Some already-paired accounts show native Login needed, including Loraclox/Dulux
and CG's Instagram; native-session recovery is separate from API grant health.
No password/session/permission replacement attempted.

Added one meaningful real-SQL paired-channel acceptance to the EXISTING queue
suite: one approved creative with Facebook+Instagram channels has two distinct
jobs, exact pre-due idempotency, independent Facebook success/Instagram uncertain
state, no cross-channel receipt promotion and no canonical whole-item posted
stamp. Due-time re-enqueue is refused, not rearmed. Initial test incorrectly
expected admission replay after due; corrected that expectation instead of
weakening the existing future-time guard. Provider observations are synthetic;
SQL authority, fencing, receipts and duplicate barriers are actual execution.
Final isolated database suite: 36 tests passed, zero skips/failures/cancellations
(265.9s), including the new paired case, real approval/dispatch/recovery and role/
cross-client/lease/secret-table refusal. The two exact-repair tests are a separate
fixture receipt, not additional platform acceptance. Application runtime is
unchanged from b9041fff's full 5029pass/32skip/build/native-Deno qualification;
that prior full/build receipt is retained, not rerun or counted again. Final
scoped lint/diff pass. Self-review found no blocking test/source issue. The
task-owned network-none QA container is stopped after receipt capture.

The product target remains one staff/ChatGPT scheduling request with selected
channels and separate provider results. A Page/Instagram pairing is not a shared
publishing API or publishing grant. Current MCP is still read-only for publishing;
preview/confirmation/status actions must reuse the same existing authorization
core and durable queue, stay separately default-off and be locally/SQL tested
before a future exact release. Do not claim ChatGPT can submit jobs live yet.
First exact Facebook pilot remains the priority; Instagram uses its existing
candidate runtime/credential/container sequence after real route/permission/media
acceptance. No approval inheritance, implicit cross-posting or duplicate queue.

No production write, provider/account/permission/secret change, content/date/
approval mutation, Microsoft refresh/write, Edge deployment, Vercel or spend.
Previously approved Facebook DB pair and immutable release packets untouched;
two later-platform migrations remain held. Native screenshots and exact repair
review evidence are private under native-acceptance. Google tracker target is
still unidentified; no guessed update.

## 18 November — company/native acceptance and opt-in Meta publishing consent

Continued SAME DRAFT PR #991 from2fe35141; mainb524a9f9 and open ownership
rechecked. Only this chat is active in the current Codex inventory; staff,
client-readiness, leads and Nolan PRs remain separate. No competing scheduler.

Existing company Chrome was reachable this turn. Verified the Chrome profile
cgproductionhouse.com, ChatGPT account info@cgproductionhouse.com, and Meta's
selected Facebook profile Christie-Ann Groenewald. Cape Lumber Marketing's native
Page262645554440912 matches the existing Dynamics client42d9841f-90ac-4ef0-a0f0-7e39f3d8aefa
mapping. Its linked Instagram is @deniscoyne; native portfolio Denis Coyne.
Meta's Scheduled tab explicitly showed no scheduled posts. The18Nov07:00 post
was already published and must not be replayed. No content or native settings
were changed. A transient terms modal disappeared before reinspection; no Accept
was clicked and no accepted-consent claim is made.

Fresh SELECT-only metadata found Cape's active mapping has connection_id NULL.
The single stored Meta connection65d8f626-54d7-45fa-ac75-5348eb364540 is connected
but its recorded grant lacks pages_manage_posts (last connected25Oct). Native
human Page access does not establish this app's publishing grant or exact token
binding. No token columns/values, secrets, keys or credentials were inspected.
The authenticated MCP's15:47:55UTC candidate read returned no eligible approved
future Facebook photo, has_more:false, canConfirm:false/canPublish:false.
Do not invent approval, bind the NULL mapping by guess, or reuse a published post.
Reporting health separately showed Facebook PARTIAL and Instagram PASS; these
are reporting observations, not publishing authorization.

The existing company Dynamics plugin's Refresh tools action was clicked once;
its spinner settled and the button re-enabled. This is catalogue refresh only,
not a verified new schema. An isolated normal-chat acceptance attempt was NOT
sent: browser transport timed out during composer entry, then Debugger detached.
Closure of that task-created unsent draft is unverified. No staff/Nolan chat was
used. Existing sessions and permissions preserved; no browser retry loop.
Private screenshots: native-acceptance/company-dynamics-refreshed.jpg and
cape-scheduled-none.jpg. Browser numeric IDs changed during recovery: always
re-identify the company profile/account rather than reusing a cached number.

Concrete source gap: meta-oauth-start requested only the six reporting scopes,
so reconnecting through the existing button could not request Page publishing.
Before the change, four actual-handler regression cases failed. Added a separate
opt-in to the EXISTING endpoint, not a new OAuth/token system:
POST query purpose=facebook_photo_publishing&confirm_permission_request=true,
exactly once each with no additional keys, plus server flag
SOCIAL_FACEBOOK_PHOTO_CONSENT_ENABLED=true. The gate is DEFAULT OFF and has NOT
been configured live. Enabled mode rechecks the active admin/manager profile,
adds ONLY pages_manage_posts and auth_type=rerequest, reuses hashed expiring
OAuth state, and explicitly returns publishing_ready:false. Disabled, malformed,
role-revoked or unreadable-profile requests create no state or provider URL.
Normal Connect Meta retains its exact six scopes and behavior. The existing
callback records actual granted permissions, not requested permissions; it is
unchanged, as are encryption/token storage, mappings, approvals and queue.

There is NO new publishing-consent UI button yet and this source change is NOT
deployed. App Review/Advanced Access, real grant, exact Page tasks/token binding
and owner consent remain unverified. This opt-in requests permission only; it
cannot enable confirmation or publishing. Official Meta Page publishing and
manual Facebook Login documentation were checked; no universal platform grant
is inferred. Supabase changelog/auth guidance reviewed; existing custom auth and
SDK dependencies preserved.

Final frozen-runtime suite:5061total/5029pass/32optional skips/0fail/0cancelled
(596.8s). All10new actual-handler tests pass. tsc/Vite build and emitted
app-bearing ContentReviewCard bundle, scoped lint/diff and native Deno2.9.8 of
all FOUR repository entrypoints pass. No native provider publication or phone
acceptance claimed; scopes/roles/state persistence in OAuth tests are synthetic.

Additional targeted hosted read captured meta-oauth-start ACTIVEv73/5files,
custom auth/import_map:false. Private release preparation caught TWO native
failures hidden by repository-only checks: hosted ReturnType SDK annotation
resolves to incompatible generic types, and hosted meta.ts has a duplicate
identical availability property. Both initial packets are REJECTED_DO_NOT_RELEASE
and retained. Final candidate-meta-consent-f9eeb5b7-qualified preserves three
hosted helpers byte-for-byte, changes only entry and removes only the later
identical availability:probe.availability from the hosted helper. The entry uses
the tested explicit SDK annotation (emitted runtime tokens identical to old
annotation). Actual old/new factPayload expression values match across four
availability states. Five offline packet guards and native Deno checking of
the EXACT assembled closure pass. Existing shared helper is otherwise preserved;
no local helper replacement or SDK upgrade.

This is a SEPARATE, UNAUTHORIZED/UNDEPLOYED five-file one-function packet; no
flag write is included. Payload SHA256:
07750f9e57118aab7b51c98a5b70d950e91cab9e1ca8c8ed1203a17014cf8d09.
Hosted closure0009fcd7b0b82a499a334adf450e43373fa4400e10b93a31493f46729836af2d;
frozen repository entry SHA256f9eeb5b77f4196b9df1358a8edb9028994d872c5037ec5d0b1abe53a7b0df928.
Snapshot/source/payload/manifest, rejected native logs, qualification and offline
preparer/tests remain private under2026-11-18/native-acceptance. Fresh hosted
version/source/auth/flag review and exact permission/release approval are still
required; do not treat source qualification as permission to release.

The prior36actual SQL checks remain prior receipts: this increment adds no SQL,
table, RPC, state model or database migration. Exact three-function runtime
packet candidate-fdfaf1ea remains immutable and separately held; this OAuth
change is NOT included in or authorized by that packet. Applied Facebook DB
pair not replayed; TikTok Business/Instagram migrations remain held. No Supabase
production SQL/data/Edge/config/key/OAuth/account/mapping/permission/content/
date/approval change, provider submission, deployment, Vercel or Microsoft write.

Exact next dependency remains provider app eligibility and owner-granted posting
permission, verified connection binding, then ONE genuinely approved unscheduled
original/caption/future time with owner-resolved fresh Teams capture and native
duplicate review. Prepare separate exact releases/consent/mapping/live-test
approval packets only after prerequisites, never infer them from continue.
Google Control Centre target remains unidentified; no guessed write.

## 18 November — native worker SDK boundary repaired; exact runtime packet prepared

Continued SAME DRAFT PR #991, tested source fdfaf1eaa9eb6241eee436563be19859c5ef462a.
Fresh main b524a9f9 / PR ownership checked; other-agent lanes untouched.

A targeted read-only capture verified background-worker ACTIVE v64, 16 hosted
files, custom auth setting unchanged; inventory49, both social-publication and
social-publication-authorization ABSENT. No business rows, tokens or credentials
read. Hosted source closure hash92e77be14cff304b152746e422181fa3c30f5e57241cb55107cc54699d1077ae.

Exact candidate native Deno check reproduced TS2345 before repair: worker JSR
SupabaseClient and helper ESM SupabaseClient have separate nominal identities.
Node/Vite tests and the local type bridge had not caught that actual Edge type
boundary. Reused the existing worker's localized Parameters-based SDK adapter;
kept the exact client instance/session and all runtime guards. No SDK import,
role, authorization, scheduling, provider or runtime behavior change. Compiled
JavaScript token streams before/after are identical (only trivia differs), hash
 e25582035fcaf8caf24a35050ad835f822503797bbcfcc562eb9d38c5634a387.

Added two actual worker-runJob regressions: exact same SDK client through due
submission and independent receipt, one synthetic POST only; disabled publishing
blocks without constructing bindings or contacting the provider. Focused final
runtime/management suite74pass,0skip,0fail. Build/app-bearing status bundle,
scoped lint/diff and native Deno2.9.8 all THREE real entrypoints pass. Existing
prior full5017pass/32skip and36actual SQL checks are retained as PRIOR receipts,
not rerun or inflated this turn: executable tokens/SQL are unchanged. First
native check populated its local cache with existing public dependencies; final
exact-packet check used that cache. No package/lock/shared node_modules edits.

Private immutable candidate-fdfaf1ea uses actual hosted helpers, not local
replacements. Worker36files: ONLY existing entry modified,15hosted helpers
preserved byte-for-byte,20publishing helpers added. New staff status/withdrawal
endpoint9files; staff inspection/preview/confirmation endpoint28files. All use
existing custom authentication; active manager gates remain. No flag values or
secrets were read; configuration safety must be freshly verified before release.
Four offline packet checks pass: exact payload/source hashes, hosted helper
preservation, version/auth/source/inventory drift refusal, no overwrite or
checkout/junction escape. Native Deno checks the EXACT assembled source closure,
not a fixture module declaration. Previous candidate-e564c182 is explicitly
REJECTED_DO_NOT_RELEASE; its failing log/payloads are preserved, not overwritten.

Final payload SHA256:
background-worker cf9ac414c547a332147306842115dea23da9ac85563b24f601cfdef0fd755800
social-publication ec8fa2c145cd7a71ea0b267efdfc785f538c952f19fdf7e38a23cc7facb8cb3e
social-publication-authorization b774f58462efbb0b19a73f6c0ce4f00b002d0209f528b6ae735aa4ebe583409c
Source/inventory/manifest/checker/rollback/acceptance evidence retained under
existing PR991 artifact root,2026-11-18/facebook-runtime-preparation. Status is
PREPARED_NOT_AUTHORIZED_NOT_DEPLOYED; two new endpoints and worker release still
need exact separate approval. Do not deploy this from a bare continuation.

No production SQL/data/Edge/config/key/OAuth/account/mapping/permission/content/
date/approval/Microsoft/Vercel/publication change. Applied DB pair not replayed;
TikTok Business/Instagram migrations remain held. Browser access still reports
unavailable; installed tool schema still lacks account_only. One access question
is pending; no retry loop, credential extraction or unsupported invocation.
Next remains native Page/grants, approved unscheduled original/caption/future
time, fresh Teams capture/native duplicate review, then exact reviewed live-test
packet/approval. Self-review only; no real provider/browser/phone acceptance.
Google Control Centre target remains unidentified; no guessed write.

## 18 November — confirmation recovery and final staff/source fencing (source only)

Continued the same DRAFT PR #991 from ef1655048b61f4cefe568e86cc8d81664c6d4d21;
main b524a9f9 and ownership checked. No competing scheduler or other-agent work.

Reproduced before editing: a never-settling confirmation left the panel busy;
a lost confirmation allowed another preparation; a role revoked during status
pagination still received evidence. A later regression also reproduced a stale
click handler resending after successful reconciliation. Corrected that latch,
interrupted the earlier full run, and used a new final run on frozen runtime.

Confirmation and withdrawal now observe one mutation for at most 12 seconds,
without cancellation, automatic retry or assumed failure. An uncertain result
may have committed. The confirmation panel retains the captured intent and
locks preparation for its mounted review, including after success. Its explicit
Check confirmation action uses the existing bounded read-only status endpoint.
Only one exact client/review/Facebook Page/time/server-verified fingerprint with
current recorded authority proves an existing confirmation. Missing old-version
fingerprints can still display status but cannot prove reconciliation. Neither
confirmation receipt nor recovery is presented as a verified live post. Failed
withdrawal observation requires status recovery and never claims it stopped.
The latch is mounted-form memory, not reload persistence; existing backend
idempotency and authorization guards remain authoritative after navigation.

The staff-only status reader rechecks review/client/deliverable identity,
canonical source existence and active admin/manager after all pages, including
empty results. Drift or partial evidence is unavailable. No new schema/RPC,
privilege, client DTO or provider call. The fingerprint is existing confirmation
evidence, not a credential or additional publication authority.

Isolated real PostgreSQL exercised a committed confirmation with a lost browser
response, actual frontend recovery through the management reader, the same job
before/after, zero provider calls before due, then one simulated provider POST
and independently verified receipt. Graph/Storage/accounts/media remain synthetic;
SQL and installed SDK/component callbacks are actual local execution. No browser
visual, real role/device, native Page or real publication acceptance is inferred.

Final frozen-runtime suite: 5,049 total / 5,017 pass / 32 optional skips /
zero failures (700.7s). Separate isolated PostgreSQL: 36 pass, no skips, including
approval admission, due worker/receipts, authorization/role/lease fences and the
release-packet rehearsal. Owned network-none QA container stopped, exit 0.
Final tsc/Vite 7.3.6 build, emitted app/status/read-deadline/mutation-observer
bundle, cached native Deno 2.9.8 check of social-publication entrypoint, scoped
lint and diff pass. Default-off preparation UI remains hidden/tree-shaken;
component behavior was executed with synthetic React callbacks, not a browser.
The two issue-519 test-generated outputs were restored. No runtime changes after
the final full suite began. Earlier interrupted suite is NOT acceptance evidence.
Source self-review found no blocking issue for this increment; not independent
provider review or permission to merge/deploy/publish the full DRAFT PR.
Private source hashes and acceptance logs retained under the existing PR991
artifact root, 2026-11-18/confirmation-recovery.

Production remains the previously verified MCP v87/source ecc8d256 and the exact
approved database pair already applied once; no replay. The two TikTok Business/
Instagram migrations remain held. Staff confirmation, worker and this new
management helper/UI remain unreleased/default off. No production SQL/data,
Edge/config/key/OAuth/account/mapping/permission, content/date/approval, Microsoft,
Vercel/deployment or provider publication changes in this increment. Company
browser access remains unavailable and installed connector discovery omits the
account-only argument; no repeated transport loop or unsupported invocation.

Next: supported company action refresh plus native exact Page/grants proof;
select genuinely approved unscheduled content/caption/future time with fresh
Teams capture and native duplicate review; then prepare one separately approved
complete worker/UI/live-test packet. Preserve #995/#1003/#1004/Nolan/staff lanes.
Google Control Centre target remains unidentified; no guessed update.

## 18 November — exact-approved Facebook database pair APPLIED and verified

CA explicitly approved PR991/bd5d3fc7's two exact Facebook database transactions
AND their original-version history receipts. Continued same DRAFT PR991; no
publisher/Edge/frontend/config/account/content/Microsoft/Vercel authority added.
Fresh main/PR/ownership check retained #995/#1003/#1004/Nolan/staff/calendar lanes.

Fresh read-only preflight matched55 required column types/RLS/service access,
zero candidate collisions/versions/publication column/social jobs. Existing
history178rows and533background jobs recorded; queue relation688128bytes.
Private immutable packet SHA256
2ad6060315430cffd580fdc1cf623f32ebf32d9342913b316e849c8e826cba76
still exactly matched the source-pinned offline preparer. Both transactions
used the EXACT rehearsed original-version route,3slock/60sstatement budgets and
advisory lock. Applied queue ONCE, independently verified before applying capture
ONCE, then independently verified both at 2026-11-18T12:51:52.58219+00:00.

LIVE ORIGINAL migration receipts:
20261115104948 social_publishing_queue, one source statement, SHA256
00233282015fcfac969421f6429f0c13cdb2421df57dff7141b64e5562076b7b;
20261116085815 social_publication_preparation_evidence, one source statement,
SHA256 d82380bc84e4ccedc702408e07353c334a4c16c3fa7650faaf21e13b284600e8.
History now180rows; digest of ALL178 prior rows unchanged. No history repair,
generated timestamp, deletion or broad db push. Capture checked the exact first
receipt before application. Approved guarded query hashes remain6c17c5b0.../
c891204d...; full hashes/packet are retained in the preceding source receipt.

Verified live nullable publication jsonb column,2new partial indexes, preserved
all4existing indexes and original background_jobs policy, added ONLY restrictive
active-manager social-job SELECT policy. RLS stays enabled. Existing8job types
remain allowed plus social_publish. ALL9new RPCs: SECURITY INVOKER, empty fixed
search_path, EXECUTE for service_role, denied anon/authenticated/PUBLIC.
Second apply changed none of the verified queue objects.
social_publish jobs=0; ALL existing publication column values=NULL.
Both TikTok Business/Instagram candidate migration versions remain ABSENT.
No client content, review/approval/date, account/OAuth/mapping/key/provider,
worker/Edge/cron/flag, Microsoft/Teams or Vercel change or native post.

ALL49 Edge function metadata/version/bundle/auth/entrypoint values unchanged
against immediate preflight; MCP remainsv87. Security advisories6before/6after,
NO new findings (not a claim that pre-existing advisories are resolved).
Private applied-readback.json saved beside the immutable packet. No SQL retried.
Current readbacks verify schema/ACL/history/data absence, NOT native scheduling/
publication or real staff/client/phone acceptance. Publishing stays default OFF;
staff confirmation/publishing bindings/worker/frontend remain unreleased.
The pending migrations are now ONLY20261115104950TikTok Business and
20261116102019Instagram steps in this lane; do not replay the applied pair.

Existing source acceptance retained: frozen-runtime5038total/5006pass/32skip,
2offline packet checks,35rehearsed queue/packet SQL +1admission SQL; build/bundle/
scoped lint/diff green before approval. No runtime code changed in this release,
so no repeated full-suite/build. Only these continuity docs change; diff verified.
Next remains supported company ChatGPT action refresh/native Page+grants proof,
genuine approved unscheduled asset/caption/futuretime/native duplicates and fresh
Teams capture, then a complete separately approved worker/UI/live-post packet.
No account connection, content approval or publication authority inferred from
schema application. Google Control Centre target unidentified; no guessed write.

## 18 November — bounded readiness and preview recovery, source only

Continued SAME DRAFT PR991 from867895cf; mainb524a9f9 and open PR ownership
checked. Extends the existing read-recovery increment, no new schedule/queue.

Reproduced BOTH additional hangs before changes with actual confirmation-panel
callbacks: inspect and preview kept "Checking the exact publication" indefinitely.
Both regressions failed on the displayed state. Reused a private read-only
deadline helper in the existing socialPublishing lib for status/inspect/preview.
The8second bound covers SDK/session, transport and error-body JSON parsing;
a transport ignoring abort still returns unavailable. Original exact-review,
mapping, caption/hash/time/media, fixed safe error copy and false-authority
contracts remain. A manual read can recover; late evidence cannot populate it.
Confirmation/withdrawal mutation handlers are unchanged and do NOT use this
read-only timeout or acquire an automatic retry.

Current focused management acceptance41pass includes abort-ignoring hangs with
the real panel callbacks, late results, all3 read modes through the INSTALLED
Supabase SDK, and a streaming HTTP error body which never completes until after
the deadline. Fixture HTTP/Graph/Storage remain synthetic, no browser visual/
phone/native provider acceptance claimed. Full accumulated Node acceptance:
5038total /5006pass /32skip /0fail (646.5s). Separate35 actual isolated PostgreSQL
checks pass:34queue/runtime/OAuth plus1actual admission/internal/client-approval
journey into the same due queue. Owned network-none QA container stopped exit0.
Local tsc/Vite7.3.6 build, emitted app/status-deadline bundle, scoped lint and
diff pass. Default-off preparation UI remains tree-shaken/hidden in that build;
no enabled preparation UI or live browser acceptance is inferred. Only the two
issue519 test-generated outputs were restored. No runtime edits after full run began.
Only lib/tests and these existing continuity records change; no migration,
dependency, role/access, provider or live runtime changes.

Hostedv87/sourceecc8d256, four held migrations/default-off dispatch, Teams hold,
company action-discovery/native account acceptance and the exact genuine
approved unscheduled creative/time/native-duplicate/fresh-Teams pilot gates
remain unchanged. No Vercel/deployment/publication/config/OAuth/accounts/keys/
SQL/data/mappings/permissions/Microsoft or other-agent work. No repeated browser
failure loop. Google Control Centre target remains unidentified; no guessed write.
Source self-review, not independent/native acceptance.

Next approval packet is ONLY Facebook's existing minimal database pair on
ehtjfntukiwbgptqgbzy, in source order, with original-version history bookkeeping:
20261115104948_social_publishing_queue.sql SHA256
00233282015fcfac969421f6429f0c13cdb2421df57dff7141b64e5562076b7b;
20261116085815_social_publication_preparation_evidence.sql SHA256
d82380bc84e4ccedc702408e07353c334a4c16c3fa7650faaf21e13b284600e8.
Queue adds the publication column/indexes, restrictive manager read for NEW
social jobs and service-only queue/confirmation/receipt RPCs. Capture RPC is
service-only/read-only over existing complete exact Teams captures; no collector.
Other two candidates/TikTok/Instagram are excluded. No actual job, content/date/
approval change, worker/Edge release, flag/schedule/key/account/Microsoft or Vercel
action. Current35SQL rehearsal includes the Facebook pair alone BEFORE other
platform migrations. Fresh preflight must match absence/dependencies/ownership;
stop on drift, failure or uncertain application before retrying. Preserve all
jobs/approvals/audit/receipts, never destructive schema rollback. Publishing stays
OFF; this packet cannot itself establish native/posted acceptance.
Original-version route is now PREPARED/REHEARSED, NOT APPROVED/APPLIED.
Offline scripts/qa/prepare-facebook-database-release.mjs pins ONLY these two
source hashes, adds transaction-local3slock/60sstatement budgets and a shared
advisory lock, rejects existing version/name or wrong-order receipts, and inserts
each ORIGINAL version/name/source statement receipt in the SAME transaction as
its DDL. No existing history is edited/deleted. Source bytes are hex-encoded in
the receipt to preserve their exact text through SQL transport. Current hosted
history column metadata was read-only checked: required version/name/statements
types match; other columns are nullable. No credential lookup/network in preparer.
This exact guarded SQL transaction route avoids MCP apply_migration's unsupported
version parameter (upstream https://github.com/supabase/mcp/issues/241); application
requires explicit SQL + original-version receipt approval, not an auto-timestamp
apply followed by history repair. No broad db push or generated-version deletion.

Two offline packet tests pass, including tampered-source refusal. The actual
PostgreSQL suite was rerun with THIS generated pair:35pass/0fail, including wrong
order with no receipt, injected receipt failure rolling back the new RPC, correct
original versions and replay refusal with no jobs. Earlier same-turn actual
admission test1pass remains unchanged,36SQLchecks across those final receipts.
Full5038 suite covers the frozen runtime changes; the2new offline packet checks
and new SQL rehearsal ran separately after that full run. No later runtime edit.
Owned QA container stopped exit0 after each run; no other services touched.
Private immutable packet: social-publishing-991/2026-11-18/facebook-database-pair/
payload.json and manifest.json. Whole payload SHA256
2ad6060315430cffd580fdc1cf623f32ebf32d9342913b316e849c8e826cba76.
Queue guarded query SHA256
6c17c5b040e54b4232815b55f79ac5999532eac1f3e376ee15bb6a88f5ec6f06;
capture guarded query SHA256
c891204d8fca8b63384c0a572a5aa3976df753eb8d262ce951c3aafb22a88eea.
Compare all payload/source/query hashes and fresh metadata before any approved
write. After each response (or uncertain response) independently read back
version/name/exact source statement, RPC/role grants/index/policy, zero social
jobs and unchanged default-off runtime; never blindly retry. Stop on drift or
partial failure; retain any earlier committed schema/receipt without deletion.

## 18 November — stalled publishing-status recovery fixed locally

Continued SAME DRAFT PR991 from9d14aedb; mainb524a9f9/current PR ownership and
active workers checked. #995/#1003/#1004/Nolan/staff/Teams/calendar/package lanes
remain separate; no duplicate scheduler or shared dependency installation.

Reproduced BEFORE the fix with the actual publication panel's callback harness:
an SDK read that never settles keeps "Checking publication records" indefinitely,
with Refresh disabled even after the intended deadline. The new test failed on
that exact displayed state. getStaffPublicationStatus now bounds the WHOLE
read to8seconds, including SDK/session work that ignores abort, attempts to abort
the transport, and returns unavailable rather than an empty/successful status.
Staff can explicitly refresh the SAME review; late success cannot replace that
new read. Completed/rejected reads clear their timers. No automatic retry or
withdrawal/confirmation/queue/provider action was added.

Validation:78affected tests pass, including the actual panel callbacks with a
never-settling abort-ignoring read, manual refresh and late result, the INSTALLED
Supabase SDK with abort-aware fixture transport, deadline cleanup, existing
manager/client isolation, exact withdrawal/confirmation and Facebook runtime
duplicate/unknown-outcome guards. This is actual-code integration with SYNTHETIC
Graph/Storage/HTTP, not live publishing or browser visual acceptance. Initial
broader run failed22tests at setup because the shared node_modules lacks jpeg-js;
reused existing SHA512-verified pinned0.4.4 task TEMP package through the existing
fixture switch, then all78passed. No package/lock/shared node_modules change.
Local tsc/Vite7.3.6 build, emitted ContentReviewCard app/deadline bundle,
scoped ESLint and diff checks pass. Self-review found no blocker in this narrow
read-recovery delta; no independent review or live UI acceptance is implied.
No database code changed, so existing35isolated SQL checks remain a prior separate
receipt; neither the full5030suite nor DB fixtures were rerun for this narrow read.

This fix is SOURCE ONLY, not deployed to frontend or MCP. Hostedv87/sourceecc8d256,
four UNAPPLIED migrations, default-off publishing, Teams sync hold and exact pilot
approval/source/account/permission/freshness gates stay unchanged. No production
SQL/data/config/OAuth/account/mapping/permission/Microsoft/Vercel/cost action.
Browser access remains the previously recorded host/tool limitation; no bypass
or new device claim. Self-review only, not independent/native acceptance.
Google Control Centre target remains unidentified; no guessed write.

## 18 November continuation — live schema prerequisites and cached-action diagnosis

Same DRAFT PR991 at3d0cfc66, mainb524a9f9 unchanged after fetch; clean before edits.
Browser inventory still returns no browsers/local access unavailable; ended UI
portion without retrying the known failing Chrome fallback or changing settings.

Authenticated company_admin resolution succeeded through existing Dynamics link.
One bounded request attempted account_only:true through that installed getter.
Returned scope was future_approved_facebook_photo_reviews, NOT account-only,
consistent with the installed cached action schema omitting the new field.
Cape42d9841f-90ac-4ef0-a0f0-7e39f3d8aefa
returned candidates:[],has_more:false,next_offset:null at11:39:46UTC.
This proves live authenticated listing/zero eligible reviews only; it does NOT
prove native Page permission or account access. No invented review/source IDs,
credential extraction, permission expansion or API-auth bypass followed.

Read-only production metadata at11:41:40UTC verifies55 required column types,
all8 prerequisite tables with RLS enabled and service-role SELECT available,
no candidate queue RPC/index/policy collisions, and no publication column.
All4 candidate migration versions are ABSENT from actual migration history.
The current background job type constraint does not permit social_publish.
Saved reusable single-SELECT metadata check:
scripts/qa/social-publishing-schema-preflight.sql.
It reads schema metadata/migration history only, not business rows; no statements
apply or rehearse a migration on production. Compatible metadata is NOT a full
migration rehearsal, native/provider acceptance, live queue or publishing grant.
Existing35 isolated SQL acceptance remains separate; no new full-suite rerun.
This continuation's production metadata SELECT, npm run build (tsc/Vite7.3.6)
and git diff --check pass. Only QA SQL and continuity Markdown changed; no new
runtime/UI/device or independent-review acceptance is claimed.

No runtime, schema, live data, flag/config, accounts/OAuth/mappings/permissions,
provider publication, Microsoft, other-agent or Vercel action. No redeploy ofv87.
Existing exact packet/kill-switch/rollback gates remain unchanged. Need supported
company action discovery refresh before account_only can be tested; approved
unscheduled immutable creative/caption/futuretime and fresh Teams capture still
required before an exact controlled post packet can be authorized. Zero eligible
reviews cannot be fixed by bypassing manager/client approval. Google Control
Centre target remains unidentified; no guessed tracker write.

## 18 November — exact read-only MCP upgrade released; native account test still pending

Continued SAME DRAFT PR991 from tested source ecc8d25662ed2963ecd69977c5ebee94d6f9d421.
CA's contextual "Please continue" followed the exact read-only release question;
scope stayed source-only. Fresh GitHub/main/open-PR checks preserved #995,
#1003/#1004, Nolan, staff, Teams, calendar and package owners.

Immediately before release ALL63 hosted files and complete v86 metadata matched
the captured reviewed baseline, with no drift. Uploaded the exact prepared
candidate-final/payload.json ONCE; SHA256
bbec134a9d84f6adce371021bdcbd10db8e575179078a4c2e96e2390d077ae81.
MCP is ACTIVE v87, same function ID/custom authentication/import_map=false.
Fresh readback verifies ALL65 contents exactly:5existing changed,58preserved,
2reviewed JPEG helpers added. ALL48 other function versions/bundles/auth/entrypoints
unchanged against this turn's fresh inventory. Anonymous tools/list denied401
with authentication challenge. Existing linked company_admin context resolves.

NO config/flag/secret/key/auth/permission/account/OAuth/mapping/SQL/migration,
Microsoft, other-function, publishing/confirmation/worker, Vercel or cost change.
The original PNG/JPEG account/review inspection code is now hosted; staff admission
UI, publishers and four candidate migrations remain unreleased/held. Deployment
does not establish a scheduled item or successful Facebook publication.

Native account-only check was NOT executed: this chat's installed getter snapshot
still lacks account_only. Browser inventory reported local browser access unavailable.
The bounded fallback to existing Chrome window stopped at Computer Use's current-URL
safety enforcement BEFORE navigation/input. UI work ended; no bypass, profile copies,
credential reads, account/settings change, fresh sign-in or staff-message action.
Company ChatGPT discovery refresh and real Cape Page access remain unverified.

No runtime code changed in this continuation. Existing source acceptance remains
5030total/4998pass/32skip/0fail,79focused,35actual isolated SQL,7native codec and
actual prepared MCP Deno/build/app/lint/diff pass. No repeated full-suite run,
new browser/phone acceptance or native publication claim. Source self-review,
not independent native end-to-end acceptance. Private applied-readback.json saved
beside the existing immutable account-readiness-upgrade packet.

Next: when supported company browser/tool discovery is available, refresh ONLY
existing Dynamics actions (preserve both links/permissions), then call the SAME
get_facebook_post_readiness for Cape42d9841f-90ac-4ef0-a0f0-7e39f3d8aefa with
account_only:true and resolved company_admin. Do not redeployv87 or resetflags.
Then prepare a genuinely approved unscheduled creative/caption/futuretime/native
duplicate/Page/grants/media and fresh Teams packet before requesting exact controlled
pilot authority. Cape18Nov already-scheduled work is excluded. Four production
migrations and release/worker authority remain separate gates. Google Control Centre
exact target remains unidentified; no guessed write. Rollback requires exact approval
to restore capturedv86 source while preserving all config and records.

## 17 November continuation — independent mapped-account readiness and exact upgrade packet

Same DRAFT PR991/#220/#236/#269, parent51750a58; main b524a9f9 unchanged.
Current open PRs/issues/active chats checked. #995 shares the catalog; #1003/#1004
and Nolan/staff/Teams/package/strategy/calendar remain separate. Continue Facebook
first, no new scheduler, account connection, native publication or deployment.

### Prerequisite check without manufacturing approved content

Reproduction before implementation: account_only:true on a genuinely empty review
fixture returned READINESS_INPUT_INVALID. An approved review was required even
to inspect the mapped Page's independent API access. Added the optional boolean
to the existing get_facebook_post_readiness schema and company-admin contract;
no new tool, context privilege or mutation capability. Default listing remains
metadata-only with no provider/settings reads. Account-only conflicts with a
review ID or offset and rejects caller account/connection/proof overrides.

Account mode requires the existing explicit inspection flag/config, active
manager/admin, exact active client and unique active Facebook mapping. It calls
the SAME private encrypted-token/app/current-permission/Page-task/token-identity
reader as review inspection. Its target type now correctly needs only client,
connection, account and route; no invented review/deliverable UUID. Required
permissions and CREATE_CONTENT agree with current official
[Meta Page publishing requirements](https://developers.facebook.com/docs/graph-api/reference/page/feed/).
No endpoint/scopes/OAuth setting changed. Current Supabase changelog rechecked;
no relevant SDK/CLI upgrade was made. Direct Meta guide retrieval429 was bounded;
official indexed reference supplied the documented requirements.

Successful result contains Page ID/name, check time and checked-access booleans
only. Both canConfirm and canPublish remain false. It explicitly does NOT inspect
app-review/release eligibility, creative approval, media, Teams/time or native
duplicates. No read of reviews/schedule/Storage/queue is needed. No token, mapping
connection ID, credential, arbitrary diagnostic or mutation handle is projected.
Role/client/mapping are re-read after the native GETs; a slow final database
read cannot return expired proof. Missing/ambiguous mapping, revoked access,
missing native permission, drift or failure remain unavailable, never healthy.

### Exact read-only source release — PREPARED, approval required

Fresh connected read-only Management inventory/source verified Dynamics project
ehtjfntukiwbgptqgbzy MCP cg-dynamics-mcp ACTIVEv86/63files, verify_jwt=false with
EXISTING custom authentication, import_map=false. All63 file contents match the
previous approved payload6ee8f42a2cce61f822b29dc092e350042c9e942f48c20c3e9e044715eb41dd46
exactly. Canonical sorted name/content SHA256:
4ec1fa21f19ac4e29858a41f97f0d261452faa3176ca0e6089aa116e863784a1.
Captured49function metadata for source/bundle/version/auth comparison; no token
or secret values read. This does not reauthorize or repeat the prior release.

The EXISTING scripts/qa/prepare-facebook-readiness-release.mjs gains explicit
--upgrade-v86 mode with a pinned whole-source digest, baseline source74327024 and
five-file allowlist. It prepares offline ONLY; no network/deploy/config action.
It also refuses existing output packets, unsafe/duplicate paths and output via
a junction back into the checkout. No approved private artifact was overwritten.

Proposed change to ONE existing MCP function:

- Modify5 existing files: cg-dynamics-mcp/facebookPostReadiness.ts and toolCatalog.ts;
  _shared/facebookPublicationInspection.ts, facebookPublicationRuntime.ts and
  facebookPublishingProvider.ts. Includes the previously source-only original
  JPEG qualification fix plus this account-only check.
- Preserve58 hosted files BYTE-IDENTICALLY, including hosted-only OneDrive variants,
  MCP index.ts/projectContext.ts/auth/other handlers; do not replace them from git.
- Add2 existing reviewed source helpers: facebookPublicationMedia.ts and
  publicationJpegCodec.ts. Original publicationJpeg.ts already exists in v86.
  New runtime import is the ALREADY-approved pinned npm:jpeg-js@0.4.4; no new
  dependency adoption. Preserve upstream packaged licensing notices.
-65 total files. NO settings, flags, secrets, auth, scopes, mappings, accounts,
  permissions, schema, queue, Microsoft, Vercel or other48function changes.
- Staff UI/admission repair, social-publication endpoints/worker and four held
  candidate migrations are NOT part of this release. Publishing stays disabled.

Exact proposed payload SHA256:
bbec134a9d84f6adce371021bdcbd10db8e575179078a4c2e96e2390d077ae81.
Private root C:/Users/chris/.codex/artifacts/social-publishing-991/2026-11-17/
account-readiness-upgrade/: hosted-v86.json, functions-before.json and
candidate-final/{manifest.json,payload.json,source/,checker/}. Earlier candidate
is obsolete; NEVER use it or overwrite the prior approved readiness-release/.

After exact CA approval ONLY: fresh get/version/all63-file digest comparison;
stop on drift, then upload the exact reviewed65-file payload once to the same
MCP. No secret-setting step. Read back all65contents/custom auth/import-map and
anonymous denial, compare other48function bundle/version/auth metadata, refresh
company ChatGPT tool discovery, resolve ONE exact client and call account_only:true.
Confirm canConfirm/canPublish false. Native success OR unavailable must be reported
as actually observed; do not infer app review or overall publishing readiness.
No publication, new connection/consent, content/approval write or forced sync.
Rollback needs exact authorization and restores only captured v86 source; current
settings/secrets/permissions/content/history/uncertain receipts remain preserved.

### Validation and handoff

79 focused tests pass, including no-review account-only inspection via the actual
private native reader with synthetic Graph, four GETs only, zero Storage/RPC/job,
no credential leakage, missing permission, role/client/mapping drift, proof expiry,
closed schema and old default behavior. Offline packet guard tests reject wrong
version/auth/file count, duplicate/escaping paths, whole-source drift, checkout/
junction output, overwrite and unknown mode. Actual private positive preparation
passes against the verified hosted source; no simulated baseline is blessed.

35 actual isolated PostgreSQL checks pass. The existing pre-migration inspection
case now also runs account-only readiness before ANY publishing migration;
normal full approval/admission, JPEG, due queue, identity/role/fencing/receipt and
unknown-outcome cases remain green. Native Graph and Storage transport are
simulated. Owned network-none QA container stopped; other DBs untouched.
7 native actual-codec Deno tests pass; actual candidate-final hosted MCP index
passes cached Deno typing with its local-only analysis type files omitted from
the upload. Build/emitted app, scoped lint and diff pass.
Completed full suite: **5030 total /4998 pass /32 skips /0 failures** (525.5s).
Final79focused cases also pass after a QA-only negative-test precision improvement;
no runtime source changed after the broad run began. Source self-review completed; not independent/live
acceptance. No new browser/physical-device run claimed: UI code unchanged from
51750a58's24isolated browser cases. Generated issue519 outputs restored.

New account mode is SOURCE ONLY. No production SQL/data/schema/config/secrets/
permissions/provider/OAuth/mapping/Edge/OneDrive/Microsoft/Vercel/publication/cost
write occurred. Its live release requires explicit CA approval under AGENTS.md;
the prior approval was for source74327024, not this new packet. The controlled
live post still requires an approved unscheduled original/caption, exact future
SAST time, real native rights/media/duplicate proof and owner-resolved fresh Teams
capture. Do not bypass the sync hold or reuse already-scheduled Cape18Nov.
Existing PR/issues/#381 and ops handover updated at the verified revision. Google
Control Centre target remains unidentified; no guessed write or duplicate tracker.

## Earlier 17 November — actual review admission to queue; lost-response recovery

Same DRAFT PR991/#220/#236/#269, parent edbd573c; current main b524a9f9 unchanged.
Current issues and active chats checked. Current #995/#1003/#1004 diffs overlap
only the common handover, not this admission helper/form. No Nolan, staff AI,
Teams, calendar, package, strategy or provider configuration lane taken over.

### Concrete reproduced failure and focused repair

Before implementation, three deterministic regressions failed against the actual
frontend helper: a null mutation receipt returned success; a saved transaction
with lost response raised a raw error; a UUID response with mismatched saved
caption was accepted. This is before queue confirmation, so reliable queue code
alone did not complete staff's normal final-creative workflow.

src/lib/contentReviews.ts now captures an immutable attempt before upload and
independently reads its exact unique asset_path+deliverable_id. Matching persisted
UUID, MIME, caption, channel order, scheduled instant and client-approval choice
are required. Review lifecycle state must be valid but is NOT treated as approval
or publication authority. Existing RLS determines visibility; no service role in
the browser. Null/lost responses may recover only from this actual saved row;
missing/unreadable/contradictory evidence becomes UnverifiedContentReviewSubmission.
Existing named source guard rejections retain their exact allowlisted actionable
copy; private/unknown backend errors do not reach the UI. No blind automatic retry.
Mutation uses12second AbortController deadline, receipt read8seconds, following
[official Supabase abortSignal documentation](https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal).
The current official changelog was checked; no SDK upgrade/dependency/config change.
The installed SDK retries only idempotent methods, not this POST.

ContentProductionPanel retains the existing design and admission flow. A ref
prevents same-event double submission before React renders disabled controls.
An uncertain attempt freezes source/media/caption/channel/time/approval controls
and offers Check submission, which ONLY reads the original attempt. Confirmed
save clears file selection and displays current approval separately from scheduling.
Ordinary staff cannot bypass client approval. Unmount/navigation fences late
success/errors and prevents an old item's message entering the next item.
Pending attempt is mounted-form memory only: no session/credential/localStorage
copy or competing durable table. Reload/navigation still requires checking the
canonical review history before explicitly sending another version. It does not
promise exactly-once admission across browser restarts or lost client memory.

### Actual approval functions now feed the same database journey

tests/contentReviewAdmissionPostgres.test.mjs loads the UNCHANGED existing
20260907150843_content_review_foundation and20260907163000_content_review_source_guards
into a new random synthetic DB in the verified owned network-none QA container.
The thin schema prerequisites/SDK/Storage transport are synthetic, not hosted
PostgREST/Storage acceptance. Actual functions, triggers, policies and queue RPCs
execute PostgreSQL. Authenticated upload obeys the original assigned-content
Storage policy; actual submit RPC creates the immutable review and audit event.
A deliberately lost response AFTER that transaction commits is recovered through
the new exact read-back helper, with ONE upload and ONE submit call.

The service-only enqueue RPC rejects the actual internal-review and client-review
stages. Manager's original decide RPC advances to client_review; another client
cannot approve it or see it in their safe queue; the correct client approves
through the actual RPC. No direct UPDATE manufactures approval. Only then the
same Facebook journey confirms atomically, waits for the real due instant,
claims the existing job, performs ONE simulated POST and verifies a separate
receipt. Canonical production_status remains approved, not silently rewritten
to posted. TikTok/Instagram migration objects remain absent during this Facebook
test. Initial QA harness omitted its existing claim RPC from a local allowlist;
fixed that fixture omission, then the actual complete journey passed.

tests/fixtures/facebookPostgresJourney.mjs now has one optional admission port
for this integration; legacy seeded-source cases retain their existing behavior.
ALL34 existing SQL queue/role/fencing/unknown-outcome/rollback tests also pass.
Together this is35 actual database tests; provider and Storage responses remain
simulated, so it is NOT native Facebook or hosted-stack launch acceptance.

### Validation and remaining gates

20 focused helper tests pass: exact scope/MIME/caption/channels/time/client-approval
readback, unreadable receipt, missing/null response, late reconciliation, guarded
source failures, input capture, invalid pre-upload input and bounded timeout.
One uses the ACTUAL installed Supabase SDK with synthetic HTTP to confirm its
POST-null-response and exact GET/maybeSingle behavior; no HTTP escapes the fake
transport. The actual decoder and media protocol are unchanged from edbd573c.

24 isolated actual Chrome cases at375/390/430/1440 pass against the real form,
cards, helper and CSS: rapid double click, saved-but-lost response, repeated
read-only uncertainty check then recovery, source rejection, navigation/unmount
and staff client-approval restriction. External network is blocked; no signed-in
profile or existing browser session is attached.390px recovery screenshot was
visually reviewed at task TEMP cg-review-admission-browser/unverified-390.png.
Browser script: scripts/qa/content-review-admission-browser.mjs.

Build/emitted ClientSchedule app code, scoped lint, cached actual MCP typing and
diff pass. Completed full suite: **5012 total /4980 pass /32 skips /0 failures**
(516.5s). The final QA-only installed-SDK case
passes separately after the broad run started; no production code changed after
that run began. Source self-review is not independent/live acceptance. Generated
issue519 test outputs restored after acceptance. Owned QA container stopped;
other projects' DBs untouched. No new production migration or dependency.

Last verified live MCP was v86 with exact-approved PNG-only source74327024;
this continuation did not release/reconfigure it. JPEG, staff UI/authorizer/worker
and four candidate migrations have not been deployed/applied by this lane.
No deployment, live data, account, OAuth, permission, mapping, secret/config,
provider, OneDrive, Microsoft, publication, Vercel or cost action occurred.
Next real pilot STILL requires genuinely approved unscheduled original/caption,
exact future SAST/UTC time, real Page/grants/native duplicate/media evidence and
fresh complete Teams capture at confirmation AND dispatch. Do not bypass the
Microsoft hold or use Cape's already-scheduled18Nov item. This local repair is
not permission to release any schema/UI/backend or send a native test post.
Existing issues/PR/#381 and canonical handover updated at the final revision;
Google Control Centre target remains unidentified, no guessed write.

## Earlier 17 November — live company discovery/listing verified; original JPEG source increment

Same DRAFT PR991/#220/#236/#269, parent7686ca0c; fresh main b524a9f9 unchanged.
Latest open PR ownership and #381 checked. No Nolan/staff/Teams/workboard/package/
strategy/website-leads work taken over. This supersedes the prior current-URL
safety-stop/discovery-pending checkpoint below; no browser bypass was used.

### Actual company ChatGPT acceptance

Verified existing company Chrome profile CG(cgproductionhouse.com), Google
identity info@cgproductionhouse.com and company ChatGPT projects. Reused only the
isolated verification tab, preserving existing sessions/pinned WhatsApp. In the
installed Dynamics plugin settings clicked ONLY Refresh tools. Both connections
and permission mode preserved. Visible catalog30read/30write now includes
get_facebook_post_readiness and its exact read-only description.

Using Try in chat, actual company conversation
[Facebook Readiness Check](https://chatgpt.com/c/6afc2fd1-7e60-83e9-8022-40499ad9372c)
resolved Cape Lumber42d9841f-90ac-4ef0-a0f0-7e39f3d8aefa and successfully executed
get_facebook_post_readiness at17Nov10:44:55.854UTC. Actual returned state:
available, scope future_approved_facebook_png_reviews, candidates[], has_more:false,
next_offset:null, canConfirm:false, canPublish:false. Separate names-only MCPv86
function log at10:44:55.524UTC confirms the tool call; no credentials/raw payload
were read. Discovery/authentication/candidate listing are VERIFIED. Native
Page/permissions/media qualification and publication are NOT verified by an empty
listing. No fake review, assumed grant, source approval, queue or test post.

Signed-in staff /admin/content-reviews showed No content awaiting review.
Exact Cape Schedule17–30Nov, complete3rows:18Nov F3 a9c5e00f-b53a-4510-a319-aa5db0b3f5e9
already scheduled (exclude from pilot);23Nov DP4 e48f8935-88a9-488f-9c88-7a1a137c571f
to_do/unassigned;25Nov video repost c0ac02d5-6fb7-42e5-8616-23c418085792 to_do,
not photo pilot. Last Microsoft mirror2Nov11:59:52UTC remains held. Opened exact
[23Nov staff source](https://www.cgdynamics.co.za/admin/client-schedule?id=e48f8935-88a9-488f-9c88-7a1a137c571f&client=42d9841f-90ac-4ef0-a0f0-7e39f3d8aefa&month=2026-11&mode=all)
and expanded Send final creative for review. Final-media/caption/channels/SAST
time/client approval fields exist; submit disabled while empty. NO field edits,
save or submit. Default09:00 is not an approved time. This is the existing
canonical admission flow, not a new scheduler or permission grant.

### Concrete JPEG compatibility repair — local only

Direct canonical OneDrive Clients/Cape Lumber/A_ClientPortal_Cape_Lumber/Graphic
Design listing(14children) has dated JPEG+caption pairs28Oct/2/4/9/11/16/18Nov.
No23Nov-named final there; this is NOT a whole-drive absence claim. Separate
Graphic Design1.png–7.png are undated/ambiguous and were not relabelled/mapped.
Search returned zero despite existing dated files: incomplete search indexing,
direct children are authoritative. One legitimate raw18Nov JPEG fetch failed
Microsoft403 serviceReadOnly. No retry, credential workaround or file change.
Actual Cape byte/profile/content/rights acceptance remains unverified.

Before runtime changes, deterministic actual-JPEG regression reproduced
REVIEWED_PROVIDER_MEDIA_PROOF_REQUIRED at the PNG-only inspector. Meta's current
[Page Photos reference](https://developers.facebook.com/docs/graph-api/reference/page/photos/?locale=en_US)
supports JPEG as well as PNG; our narrower baseline profile stays explicit.
Reused existing approved jpeg-js@0.4.4, with a shared private codec adapter and
Facebook qualifier. Inspector, preparation and pre-signed-delivery all qualify
the SAME original bytes/hash/MIME. No conversion/re-encoding/metadata stripping,
dependency addition or schema edit. Static PNG integrity remains unchanged.
JPEG allows only bounded baseline JFIF with real strict pixel decode; progressive,
EXIF/ICC/MPO, trailing payloads, corrupt entropy, spoofed MIME/hash and decoded
size bombs fail closed. Metadata eligibility does not promise every JPEG qualifies.

MCP candidate listing now includes PNG/JPEG, scope future_approved_facebook_photo_reviews;
tool description explicitly distinguishes listing from strict image qualification.
Manager UI and preview parser preserve actual MIME; unsupported WebP/video, other
platforms/unapproved/superseded reviews retain existing exclusion/status behavior.
Instagram keeps its public private-adapter API, now sharing the same actual decoder.
All release flags/exact-account/source/role/Teams/lease/unknown-outcome gates stay.
Live MCPv86 remains approved source74327024, PNG-only. THIS JPEG delta is source-only;
do not overwrite/redeploy the already approved private packet or imply its approval
covers this revision. No source change to staff-authorizer/worker registration,
OAuth, consent, mappings, permission, Microsoft capture or publication activation.

### Validation and exact next action

95 focused runtime/MCP/provider/manager checks pass. Real isolated PostgreSQL:
34/34 checks, with inspection before any publishing migration, then Facebook's
minimal queue+evidence pair; original JPEG passes duplicate confirmation→future
claim refusal→actual due claim→synthetic native POST→independent verified receipt.
One POST only. PNG success/stale/lost-response and later-platform role/fencing/
rollback checks remain green after the other2 migrations. Graph/Storage/SDK
network are simulated; database/RPC/lease/status logic is actual PostgreSQL.
Only owned verified network-none QA container used and stopped exit0.

56 actual isolated Chrome cases at375/390/430/1440 pass, all non-loopback requests
blocked, including JPEG read-only checks/blocked preparation/explicit confirmation,
staff/client exclusion and stale async/uncertain receipt behavior. Viewed390px
readiness screenshot: legible check rows and separate queued/blocked state.
7 native Deno2.9.8 tests pass with unchanged npm import/actual decoder, denied
net/env/write/run/ffi/sys and read only the synthetic fixture. Node qualification
also executes shared and Instagram adapters with actual integrity-verified package.
No mock decoder/proof. Vite test bridge resolves only the pinned Deno npm specifier
through actual CommonJS package, validating name/version; use installed npm-ci
package or CG_PUBLICATION_JPEG_PACKAGE for an already qualified task-local copy.
No shared node_modules edits. Build/emitted ContentReviewCard/ClientSchedule app,
scoped lint, cached actual MCP/staff/worker Deno checks and diff pass.
Completed full suite: **4992 total /4961 pass /31 skips /0 failures** (553.6s).
Generated issue519 test output restored; source self-review finds no blocker to
this source-only increment, not live release or independent platform acceptance.
Initial broad run had obsolete fixture env variable; aborted
that owned test process tree and reran with explicit loopback URL/publishable-key
fixture. Invalid run is NOT counted as acceptance. No product change to hide it.

Next is actual approved unscheduled source admission through the existing23Nov
drawer, exact future SAST time, actual original-byte/native Page/grant/duplicate
evidence and owner-resolved fresh Teams capture at confirmation AND due time.
Do not infer source/approval/time from an undated file, past publish or default UI.
No complete live packet exists yet; no request to publish or apply schema now.
JPEG backend/UI/endpoint release is separate from the already-approved read-only
PNG packet and requires exact reviewed approval. Four production migrations stay
unapplied per fresh release readback; no new migration was added. No production
write, deployment/config, account/OAuth, Microsoft, publication, Vercel or cost.
Same existing trackers updated at committed revision; Google Control Centre
reference remains unidentified, no guessed write. Later-platform dependency plan
and protected rollback remain in the existing sections below, not a second list.

## Earlier 17 November approved read-only release — LIVE, discovery superseded above

CA approved the exact read-only readiness release and inspection flag in this
chat. Tested source is PR #991 revision `74327024ec8976e3d4747701af1c3234b6228a06`.
Fresh preflight compared ALL 41 hosted v84 file contents against the reviewed
baseline; no drift. Applied the exact prepared payload
`6ee8f42a2cce61f822b29dc092e350042c9e942f48c20c3e9e044715eb41dd46`
once to existing cg-dynamics-mcp (v85), then set ONLY
`SOCIAL_FACEBOOK_PHOTO_INSPECTION_ENABLED=true` through the authenticated CLI.

Supabase's project-secret update incremented every function version: MCP is now
ACTIVE **v86**. This is not a second source deployment. Readback matches all
**63 uploaded file contents** exactly, including the 38 preserved hosted files.
All other **48 function bundle hashes, authentication and import-map settings
are unchanged**, with versions incremented by one. Existing custom authentication
and verify_jwt=false/import_map=false remain. Anonymous tools/list is denied401
with an authentication challenge. BOTH existing CG Dynamics plugin links resolve
company_admin as CG Production House Admin after the release.

Secret-name-only readback confirms inspection present; staff confirmation,
publishing worker flags and exact Facebook release tuple remain absent. Existing
Meta settings/keys were not read or changed. No other source deploy, production
SQL/migration/data, OAuth/account/mapping/permission, native post, Microsoft,
Vercel or cost action. The source-only staff endpoint and UI remain undeployed.
The four publishing migrations remain held; none was applied by this release.

Acceptance limit: this chat's available plugin tool catalog still lacks the new
get_facebook_post_readiness action. Existing authenticated context resolution is
verified; native Page/permissions/image inspection has NOT executed. Company
Chrome was identified by its CG (cgproductionhouse.com) profile and signed-in
Dynamics Admin page. Computer Use then stopped because it could not establish
the current browser URL safely. No further browser input, alternate session,
credential copying or control bypass followed; existing tabs remain intact.
Next: refresh supported connector discovery, then inspect one exact client's
existing approved PNG review through the new read-only action. This does NOT
authorize a post, queue confirmation, native connection or further deployment.
Fresh Teams capture and the exact controlled pilot approval remain separate.

Private release evidence: readiness-release/applied-readback.json beside the
existing manifest/payload. No runtime source changed after its completed full
4,980/4,949 pass/31 skip run, 33 SQL and 52 browser checks; no unchanged full-test
rerun. Rollback remains separately authorized, preserving all content/history.

## 17 November continuation — read-only readiness, exact backend packet PREPARED

Same PR991/#220/#236/#269, continuing ac55f313; no new scheduler or platform.
Reproduced that the existing preview is unavailable when dispatch is disabled.
Added an independent READ-ONLY inspection path using the SAME canonical approved
review/source, original PNG/hash qualification, exact existing Meta mapping,
encrypted-token/native Page scope/task/identity readers and captured Teams proof.
Account/image checks run independently of a held/missing Teams capture. Missing
evidence is unavailable, never a pass; time/config are distinct checks. Native
Page name is read with its exact Page-token identity and control characters are
discarded. Source, role and mapping drift invalidate the report. Results ALWAYS
keep canConfirm:false/canPublish:false; no signing, enqueue/authorization,
publication, refresh, account connection, permission or Microsoft mutation.

Staff approved-Facebook-PNG review UI now has “Check Facebook readiness” with
separate actionable rows. A held check disables preparation; an all-pass
inspection alone never exposes a confirmation or creates a job. Stale async
results cannot enter another review. Existing client/staff/superseded/non-PNG
visibility gates remain. The source-only staff entry can run inspect independently
of publishing via SOCIAL_FACEBOOK_PHOTO_INSPECTION_ENABLED. Its separate new
SOCIAL_FACEBOOK_PHOTO_CONFIRMATION_ENABLED defaults off; worker flags cannot
accidentally activate confirmation in a later inspection-only release. No flag
was changed. UI and staff endpoint are NOT part of the proposed backend release.

Added company-admin-only MCP get_facebook_post_readiness, closed schema and same
OAuth/context policy. List mode pages25 future approved FB PNG review IDs for one
exact active client, excluding archived/posted/scheduled canonical items. Returns
has_more/next_offset; no complete fleet, rights or native-duplicate claim. Exact
review mode calls the SAME inspector, rejects a foreign-client review and never
grants authority. No SQL, model call or separate data store. Staff/client Projects
cannot call this company-wide read. Candidate catalog60tools (30read/30write);
live v84 still has the old catalog until separately approved release.

Validation: completed full suite **4980 total /4949 pass /31 skips /0 failures**;
final232affected tests pass after an equivalent control-character lint correction.
**33 actual PostgreSQL checks** pass: inspection FIRST without ANY publishing
migration, then the minimal Facebook pair/three queue journeys, then the other2
migrations/remaining guards. **52 actual local Chrome cases** at375/390/430/1440
pass, all external requests blocked. Build/app bundle, scoped lint, diff and actual
cached Deno check of the PREPARED hosted MCP payload plus staff entry pass. Deno
uses the established --sloppy-imports and private Vite/type-only checking files;
those7 omitted frontend type files and local checker config are NOT uploaded.
Graph/Storage/SDK transport remain synthetic; native API acceptance is not claimed.
Owned network-none QA container stopped exit0; other DBs untouched. Only issue519
generated test output is restored. No new dependency or migration.

### Prepared exact READ-ONLY release — approval still required

Read-only Management API inventory/source confirmed cg-dynamics-mcp ACTIVEv84,
verify_jwt=false (existing custom authentication), import_map=false,41hosted files;
social-publication* endpoints are absent. Fresh migration history read177entries:
ALL4 publishing candidates absent; brand20261111064719 already applied. No SQL
executed and no production mutation. This supersedes the prior unavailable
metadata-read note below.

Private captured v84 source SHA256:
`e62cfae4292db68258dbd100c68de6d2dff022a9d070b704fa9297fe78d105c4`.
Offline preparer: scripts/qa/prepare-facebook-readiness-release.mjs. It verifies
the reviewed version/auth/import-map/three baseline files, closes local dependencies,
rejects path escape/duplicates, and PREPARES ONLY; it has no deploy/network/config
operation. The exact candidate:

- Only existing MCP index.ts (import + getter binding), projectContext.ts (company
  admin allowlist) and toolCatalog.ts (closed read-only definition) change.
- Other38hosted files stay BYTE-IDENTICAL, including two hosted OneDrive files
  that differ from repository versions. Never replace them from the checkout.
- Adds22 reviewed transitive library/source files;63files total. No worker,
  staff-authorizer endpoint or other Edge Function is released.
- Only proposed config write: SOCIAL_FACEBOOK_PHOTO_INSPECTION_ENABLED=true.
  Keep confirmation flag unset/false; no dispatch flag/release tuple, OAuth,
  permission, encryption key/secret, mapping, client content, SQL or Vercel change.
- Prepared payload SHA256:
  `6ee8f42a2cce61f822b29dc092e350042c9e942f48c20c3e9e044715eb41dd46`.
  Private manifest/payload/staged sources:
  C:/Users/chris/.codex/artifacts/social-publishing-991/2026-11-17/readiness-release/.
- Before any approved release, repeat v84/all-file hash preflight. Any version/
  source drift stops release for reconciliation. Preserve current auth/importmap.
  After release read back all63files and unauthenticated denial; then verify
  tool discovery and ONE exact-client candidate/inspection through existing
  company-admin connection. No test post, new approval or automatic sync.
- Rollback, only if separately authorized: restore exact captured v84 files and
  prior inspection-flag state. Keep all content, receipts and history. Do not
  replay migrations, remove keys or reset accounts.

Ownership: PR995 shares index/catalog/tests but its Staff AI/marketing business
logic is untouched. PR1004 website lead work shares only ops handover. New getter
uses no Nolan workboard/package/calendar authority. Fresh hosted source/version
checks prevent either owner's later release from being overwritten. Source
approval is NOT production approval. Google Control Centre target still unknown;
no guessed write. Exact next step is CA approval for this bounded read-only MCP
release+flag, then native Page/approved-post evidence, not platform expansion.

## Latest 17 November — Facebook first pathway, connected SQL acceptance

Same DRAFT PR991/#220/#236/#269, parent `01102d009ed4eca46d2cb1eb93775dd83fc0f5ef`;
reconciled against unchanged main `b524a9f9`. Current PRs/active chats were checked;
Nolan/Picasso/staff/Teams/workboard/Microsoft sync ownership stays separate.
Facebook original static PNG is the shortest IMPLEMENTED candidate: existing
approval, manager confirmation, encrypted Meta adapter, due queue and separate
native receipt reader. No other route was demonstrated closer. A real exact
pilot account and approved creative remain unverified, so this is conditional.

Reproduced before changes: a due-time `FRESH_TEAMS_EVIDENCE_REQUIRED` error escaped
the worker without persisting an actionable publication receipt. New regression
failed, then passed after the fix. ONLY current-preflight errors before the
submission barrier now become blocked receipts with allowlisted codes; unknown
exception text is discarded. Submission/persistence ambiguity and read-only
reconciliation retain their existing behavior. Managers see a specific next
action for source, Teams capture, original media, account or release failures.
A possibly-started attempt always requires native reconciliation first; no
retry/publish shortcut. Existing active-admin/manager visibility remains;
ordinary staff/client roles cannot grant authority or inspect management data.
These are actual-code fixture role checks; named staff/profile acceptance in
the real signed-in publishing UI remains part of the controlled pilot packet.

Connected test now composes the real Facebook runtime/staff/canonical readers,
media/hash checks, encrypted credential reader, SQL confirmation, generic due
claim, submission barrier/save and staff status against REAL isolated PostgreSQL.
Original synthetic approval/date/intent are not time-shifted: it waits until the
actual due instant. Repeated confirmation yields one job; future claims cannot
take it. Mutation acceptance is processing; independent GET must verify posted.
Stale capture blocks before signing/submission; lost response becomes unknown
and cannot auto replay. Canonical/Teams production_status remains unchanged.
Only the local receipt-poll delay is accelerated. Graph/Storage and SDK query
transport are SYNTHETIC ports, not native API or hosted PostgREST acceptance.
Canonical reads and all queue RPCs execute actual service-role SQL in a random
synthetic DB in the verified network-none owned `cg-dynamics-social-220-qa`
container. Docker Desktop and only this QA container were started for the user's
explicit local-testing request; no other projects' databases were started.

Validation: **32 actual PostgreSQL checks pass** including the3 connected
Facebook journeys (success/stale/lost response); **96 affected runtime/management/
status-bridge checks pass**. Status-only bridge test now asserts blocked/no provider
attempt instead of the previous thrown-preflight contract; TikTok code unchanged.
Local isolated Chrome: **44 cases at375/390/430/1440**, external
requests blocked, including staff/client exclusion, exact confirmation, stale
async ownership, manager recovery action and uncertainty precedence. Images:
`%TEMP%/cg-publication-review-browser/blocked-390.png` and `blocked-1440.png`
(synthetic). Build/emitted app, scoped lint, actual cached Deno check and diff
pass. Final complete suite: **4964 total /4933 pass /31 skips /0 failures**
(explicit loopback fixture, concurrency2); actual SQL acceptance is separate above.
Source self-review passes for this increment, not production release. Only the2
unrelated issue519 generated outputs were restored after tests. Exact committed
revision is recorded in the completion comment. Owned QA container stopped with
exit0 after the SQL runs; no other project's services were started/stopped.

### Exact live-test blockers and review packet

Read-only Meta health shows an authorized REPORTING connection and47 mapped
assets; this does not prove publishing grants or a pilot Page. The existing
Chrome window was found, then Computer Use stopped because it could not establish
the current browser URL safely. No further UI input, profile/session/credential
copying or alternate attachment was attempted. Company-browser identity, pilot
review, caption/hash and native Page permissions remain UNVERIFIED.

Before requesting controlled-live approval, read back all these exact fields:

1. Canonical active client ID, existing connection ID, numeric Page ID/native
   Page name; current app access/review eligibility, token health,
   pages_show_list/pages_manage_posts/pages_read_engagement and CREATE_CONTENT.
   Never choose a global/latest credential or silently connect an account.
2. Current approved review ID + deliverable ID, exact caption, original PNG
   path/SHA256 and creative/rights approval; no existing Dynamics/Teams/native
   posting or schedule. **Actual account/content fields remain UNSELECTED.**
3. One explicit future SAST/UTC instant, exact Teams plan/task IDs and complete
   matching capture. Confirmation AND due-time dispatch require evidence under
   5minutes old. Microsoft sync hold remains: old evidence cannot support an
   unattended next-day job. Hold owner must resolve the exact refresh path;
   do not weaken freshness, start refresh/apply or write Microsoft to bypass it.
4. Exact reviewed migration/Edge/config/release tuple and kill switches. None is
   live from this PR. Preview currently shares the default-off backend rollout
   gate; source presence is not a live read-only readiness probe.
5. Proposed live scope: ONE approved original PNG/caption to ONE Page, ONE manager
   confirmation, due dispatch, separate GET and native visual review, staff
   receipt. Timeout stops mutation for reconciliation. No blind retry, second
   account/platform, bulk action or campaign/native-schedule/Microsoft change.
   Do not ask approval on an incomplete packet; no live test is authorized yet.

Official [Page photos](https://developers.facebook.com/docs/graph-api/reference/page/photos/)
and [Post receipt](https://developers.facebook.com/docs/graph-api/reference/page-post/)
references rechecked17November via current official search; direct retrieval429.
This route uses Dynamics due-time submission, not native future scheduling.
Queued-in-Dynamics, provider processing/scheduled and verified posted stay distinct.

### Four UNAPPLIED candidates, security and rollback

| Migration | Scope / gate |
| --- | --- |
| `20261115104948_social_publishing_queue.sql` | Existing background_jobs column/indexes, restrictive active-manager read, atomic confirm/lease/begin/save, service-role-only RPC grants. Queue foundation. |
| `20261115104950_tiktok_business_oauth.sql` | RLS/encrypted Business token/state/authorization store and identity/refresh fences; no browser token/state grants; no account connected by schema. Not needed for Facebook. |
| `20261116085815_social_publication_preparation_evidence.sql` | Service-only exact complete captured Teams instruction,5minute freshness/date/duplicate gates; no collector/upstream write. Facebook source proof. |
| `20261116102019_instagram_publication_steps.sql` | Existing-queue container/publish barriers and retained receipts; Facebook passes under combined set. Not Instagram release authority. |

All4 applied ONLY in isolated synthetic DB. Final rehearsal ran Facebook's3
journeys with ONLY queue+captured-evidence migrations installed (asserting TikTok
Business tables/Instagram publish RPC absent), THEN applied the other2 and ran
all remaining SQL checks:32/32 pass. The minimal Facebook pair is thus locally
verified independently; production application remains unapproved.
Production unapplied status is the current handover's record; a read-only
Supabase metadata refresh returned no result this run. No SQL or retry followed.
No new migration/dependency. Main's brand migration20261111064719 is already
applied by its owner: do not replay. Rollback must disable new dispatch/authority,
preserve all jobs/consent/receipts/ambiguity and retain read-only reconciliation.
No destructive schema/audit removal or automatic native deletion. Any production
switch, exact unsent-job withdrawal or schema action needs its own authorization.

After NATIVE Facebook acceptance: Instagram needs exact route/account/app grants,
hosted JPEG/Edge resource acceptance, delivery and controlled container→publish→GET
pilot. TikTok needs actual Business grant/app review, verified owned media origin,
video bytes/codecs/disclosures and immutable-source-to-share_id uploader/registered
durable path; current readers alone cannot publish. LinkedIn needs existing #493
ownership coordination, actual OAuth/current organization/role resolver and
qualified uploader/post mutation; GET-only receipt core is not a publisher.
YouTube is future-only: no connection assumed; project/API/OAuth/channel access,
resumable upload, explicit privacy/publishAt/processing/receipts, quotas/audit.

No production SQL/data/OAuth/provider/settings/permission/secret/Edge deploy,
Vercel/publication/cost/Microsoft action. Existing PR retained DRAFT.

Local full-suite fixture (no real credentials or API origin):

```powershell
$env:VITE_SUPABASE_URL='http://127.0.0.1:1'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='local-public-fixture'
$env:PATH='C:/Program Files/Git/bin;C:/Program Files/Git/usr/bin;'+$env:PATH
node --test --test-concurrency=2 tests/*.test.mjs
# Separate real SQL run in the verified task-owned network-none container:
$env:CG_SOCIAL_QA_CONTAINER='cg-dynamics-social-220-qa'
node --test tests/socialPublishingQueuePostgres.test.mjs
```

Initial broad run was aborted after missing synthetic Supabase environment was
identified; it is not counted as passing. Use the explicit fixture above.

## Latest 16 November — native TikTok publishing requirements, SOURCE ONLY

Same DRAFT PR #991 / #220 / #269. Implemented PRIVATE, UNREGISTERED prerequisite
reads for current Business account settings and app-level verified URL properties.
Reuses the existing encrypted Business credentials and exact active canonical
client/connection/account/username/grant resolver before AND after these reads;
rotation, revocation or grant changes fail closed. No alternative token store,
account connection, provider permission adoption, publishing eligibility write,
public endpoint, env parser or worker registration. `canSubmit` remains false.

Current primary documentation retrieved through the documentation skill:

- [Public video publication](https://business-api.tiktok.com/portal/docs/publish-a-public-video-post-to-an-owned-account/v1.3):
  video_url needs owned verified delivery and a recommended30-minute lifetime.
  Native formats MP4/MOV/WebM, up to1GB, duration3–600seconds subject to the account
  limit, at least360px dimensions and23–60fps. This increment does NOT qualify
  codecs, decode video or extend the existing image-only snapshot inspector.
  Caption limit is2200 UTF16 units/30mentions. Future publisher must explicitly
  handle required brand disclosures, engagement restrictions, original-sound/AI/
  draft/ads-only choices; no caption/default/setting is guessed here. share_id
  remains task evidence rather than public completion or source proof.
- [Account settings](https://business-api.tiktok.com/portal/docs/get-the-post-privacy-settings-of-a-tiktok-account/v1.3):
  GET `/business/video/settings/` with exact business_id and account token.
  Preserve actual privacy options, disabled engagement booleans and account
  duration limit. Private account is a verified restriction, not unavailable/zero.
- [Property inventory](https://business-api.tiktok.com/portal/docs/get-the-list-of-added-url-properties-under-an-ad-account/v1.3):
  despite its historical title, current request is APP-scoped GET with app_id
  and secret; no guessed advertiser_id/business_id/token header. Use only
  property_status1. Native signatures/file names and all credentials are omitted
  from output. The documented secret-bearing query is private fixed-host HTTPS,
  never logged/returned; no live credential was read or transmitted in this run.
- [Property matching](https://business-api.tiktok.com/portal/docs/manage-url-properties/v1.3):
  verified domains cover their subdomains, not parent/suffix-lookalike domains;
  URL prefixes require their exact HTTPS host and directory prefix. Redirects
  are invalid. No add/verify/delete, DNS or hosted verification-file action.

Reads are bounded to six native inspection/GET calls per invocation under one
deadline, no refresh/retry/polling loop. Actual native account/property reads
remain UNVERIFIED: all execution used synthetic SDK/provider fixtures and the
real encryption primitive. Responses are bounded UTF8 JSON and errors fixed/
sanitized. Shared cancellation prevents late SDK/settings responses proceeding
to app-secret transmission. Canonical input/configuration is captured, and only
the four exact binding fields are projected; caller extras cannot leak.

Added a separate metadata-only URL blocker helper over these private facts.
First delivery profile is conservatively HTTPS/normal DNS/clean ASCII paths,
no credentials/fragments/nondefault ports/encoded or traversing paths. Declared
lifetime must cover1800seconds. Existing generic five-minute signed delivery is
therefore rejected for TikTok; Meta delivery is unchanged. Native ownership
metadata is NOT proof of public availability, DNS, actual expiry, final bytes,
immutable approved source/hash, rights, app review or permission to submit.
The helper never fetches a media URL or returns its private query. Both reader
and helper always return canSubmit:false; no passing capability is created.

56 new /279 affected checks pass, including actual encrypted composition,
canonical/native grant checks, mid-read rotation/revocation, empty/malformed/
duplicate/oversized inventory, account privacy, subdomain/prefix boundaries,
TTL, malformed/foreign/stale input, HTTP/MIME/body/deadline errors and secret/
signature/extra-field projection. Cached actual Deno check, scoped lint and
production build/app-bearing bundle pass. New private endpoint string is absent
from client bundles. Final frozen-source suite: **4,962 total /4,931 passed /
31 skipped /0 failures**, concurrency2,485779ms. Source self-review passes for
this private prerequisite increment; native/SQL/rollout gates remain explicit.
Only the two unrelated generated issue519 artifacts restored after completion.
Evidence: task TEMP `cg-tiktok-requirements-focused.log`,
`cg-tiktok-requirements-types.log`, `cg-tiktok-requirements-lint.log`,
`cg-tiktok-requirements-build.log`, `cg-tiktok-requirements-full.log`.

Integrated current mainb524a9f9, preserving brand panel/system-of-record #984,
stopped hourly OpenCode dispatch #1000, report winner truth #1001 and exact
Dulux/PVC readiness/live snapshots #1002. Their files match main unchanged;
no new acceptance of the other owners' live/device receipts is claimed here.
Brand migration20261111064719 is already applied per its owner: DO NOT REPLAY.
This lane's FOUR publishing migration candidates remain UNAPPLIED. No new
dependency/migration by this increment, no SQL container restart/new SQL proof,
no new product UI/browser/phone/native-provider acceptance. Teams/sync hold,
Nolan/staff/OneDrive finals remain separate. No production SQL/data/config/
secrets/OAuth/mapping/permission/provider mutation, media upload/publication,
Microsoft/Vercel/deployment/hosting/cost action. Remaining same-record gates:
live backend/config/consent/native property/account acceptance; existing approved
video-source qualification; real owned delivery/availability/TTL; explicit
disclosures; immutable source-to-share_id uploader/proof and controlled pilot.
Exact Google Control Centre target unavailable; no guessed tracker write.

## Earlier 16 November — private TikTok queue reconciliation bridge, SOURCE ONLY

Same DRAFT PR #991 / #220 / #269. Added a private status-only binding over the
existing `background_jobs` claim/save contract and concrete Business credential
reader. No additional queue, table, migration, OAuth store, public API or worker
registration. Submission and publication preflight are deliberately unavailable
on this binding; the current worker configuration still registers Facebook only.

The bridge reads the exact stored job, original intent/fingerprint/actor,
submission record, current lease/fence and recorded share_id before private
credential inspection. It rereads the record afterward; changed identity,
receipt, stored intent or lease cannot promote native status. A revoked confirmation
does not conceal an already-started exact task, and cannot permit a new POST.
Job/provider failures use fixed diagnostics, not SDK/provider text or tokens.

The existing receipt JSON now has a bounded typed `tiktokStatus` audit containing
all returned public IDs (maximum32), exact business/share identity, native state,
read count and timestamps. It passes through the existing service-only save RPC;
no candidate SQL or stored permissions were changed. The manager projection
continues to omit the private audit; no client/public projection was added.
Tests exercise the actual queue adapter and real encryption/HTTP composition
with synthetic SDK/RPC/provider responses. This is NOT fresh PostgreSQL/RLS or
durable-database acceptance; the optional SQL suite remains skipped.

Pending native reads wait180seconds even if the generic durable worker wakes
every30seconds. Maximum5native status attempts and20minutes from the recorded
submission; invalid audit metadata cannot reset the budget. Terminal/inbox/
ambiguous evidence is held for review, never silently polled/replayed. All
multiple IDs survive the queue observation without choosing a first post.

Important remaining provenance gate: native success proves only that TikTok's
task produced a public post. This bridge intentionally retains that evidence as
UNKNOWN with `TIKTOK_SOURCE_TO_RECEIPT_UNVERIFIED` until a qualified uploader
durably binds the immutable approved asset/hash to share_id. A native failure
also retains the duplicate barrier rather than authorizing a fresh submission
without that source proof. No uploader or proof-producing path is invented here.
The private binding remains unregistered and cannot be enabled by a request.

61 new / 246 affected focused regressions pass, covering real queue handoff,
multi-ID retention, cooldown/read limits, lost persistence, concurrent lease/
source changes, withdrawal, SDK/HTTP cancellation, safe diagnostics and private
projection. Actual cached Deno check, scoped lint, build/emitted app pass.
Final frozen-source acceptance: **4,898 total / 4,867 passed / 31 skipped /
0 failures**, concurrency2, duration474861ms. Source self-review passes within
this private status-only increment; native/SQL/rollout gates remain explicit.
Restored only the two unrelated generated issue519 artifacts after completion.
Evidence: task TEMP `cg-tiktok-queue-reconcile-focused.log`,
`cg-tiktok-queue-reconcile-types.log`, `cg-tiktok-queue-reconcile-lint.log`,
`cg-tiktok-queue-reconcile-build.log`, `cg-tiktok-queue-reconcile-full.log`,
`cg-tiktok-queue-reconcile-full-corrected.log`, `cg-tiktok-queue-reconcile-final.log`
and failing-before-fix `cg-tiktok-queue-null-repro.log`. The first full run had exactly
one test-environment mismatch: Brand Hub's existing positive grant fixture uses
`http://127.0.0.1:1`; configuring port54321 correctly rejected that foreign origin.
All six Brand Hub checks pass after using the required port1 test base, without
changing application/tests. Corrected full run uses that base, the synthetic
`local-public-fixture` key, existing Git Bash/OpenSSL PATH and concurrency2.

Review then reproduced a real storage-contract defect: the existing SQL's
recursive `jsonb_strip_nulls` removes terminal audit's null notBefore field.
[Official PostgreSQL17 JSON semantics](https://www.postgresql.org/docs/17/functions-json.html)
confirm recursive object-field removal while non-object nulls remain untouched.
Two red regressions (one/multiple public IDs) now model that exact compact
JSON roundtrip. Decoder accepts only the exact compact terminal shape and
normalizes it; processing still requires its real deadline, no read-budget
reset or publication permission. No SQL change. Before this small fix the
corrected full suite passed4896total/4865pass/31skips/0failures; that snapshot is
prior evidence only. Final frozen-source full run includes the additional two
regressions and is recorded above. Lost persistence and terminal
resumption preserve receipts; no automatic retry/submission is introduced.

Integrated main34c4552e/PR998, preserving the other owner's exact Madison
readiness receipt, strategy-heading fix/tests and operational live snapshot.
Those live/phone/content claims remain that owner's receipt, not new acceptance
from this lane. No new product UI/browser/device or live provider call.
FOUR earlier migrations remain unapplied; native consent/rollout, owned-media
qualification, uploader/source proof and controlled provider pilot remain held.
No deployment/provider/OAuth/SQL/data/config/secret/permission/Microsoft/Vercel/
hosting/cost action. Teams/sync hold and staff/Nolan lanes remain separate.
Google Control Centre exact target remains unavailable; no guessed tracker write.

## Earlier 16 November — concrete TikTok Business status credentials, SOURCE ONLY

Same draft PR #991 / #220 / #269. Implemented the previously missing PRIVATE
status-credential resolver against the existing candidate Business OAuth tables,
plus `readStoredTikTokBusinessStatus` composition. No competing connection/token
store, env parser, route/tool/worker registration, publishing authorization or
production data change. Existing public/consumer analytics and OAuth flow remain
untouched. Canonical migrations are still UNAPPLIED; this is source capability,
not a claim a live Business account is connected.

Verified current official references using Firecrawl's documentation skill after
two bounded company-browser control timeouts (no repeated recovery/settings
changes or user sign-in request):

- [Token inspector](https://business-api.tiktok.com/portal/docs/get-the-authorized-tiktok-account-permission-scopes-via-access-token/v1.3):
  POST `/tt_user/token_info/get/` with app_id/access_token JSON; verify returned
  app_id, creator_id and current comma-separated scopes. This is a documented
  **read/inspection POST**, not publication, token refresh or a permission write.
- [Exact profile](https://business-api.tiktok.com/portal/docs/get-profile-data-of-a-tiktok-account/v1.3):
  GET `/business/get/` for the app-specific account, requesting only username.
  That field requires `user.info.username`; native inspection must also confirm
  the already-requested `video.publish` for this conservative status profile.

Resolver verifies active exact client/connection, the bound Business authorization
and canonical consent scopes; refuses refresh-in-progress, revoked/mismatched/
expired/ambiguous records. Reads ONLY the encrypted access envelope, never the
refresh credential or consumer token. Actual existing AES-GCM connection+access
AAD and dedicated key/version verification are reused. Native inspection pins
the configured app and app-specific creator ID; username must match the stored
confirmed handle and any known canonical profile handle. No display-name or URL
redirect identity fallback; short profile URLs are never fetched.

After provider verification, rereads canonical scope and the encrypted access
record. Concurrent revocation, mapping/scope change, rotation or refresh prevents
a credential reaching the status GET. Returned scopes are the intersection of
canonical consent and current native grants; extra native grants are not adopted
or persisted. verifiedAt is ephemeral, not a database write. Eligibility remains
unchanged: a readable status credential does NOT turn not_approved into approval
or establish production app review/media/publication eligibility.

The concrete composition performs at most the two credential inspections and one
task-status GET, with no retry/polling loop or refresh. Shared bounded JSON reader
retains the existing64KiB/UTF8/type bounds and propagates cancellation. Review
reproduced unread response bodies surviving rejection, then added cancellation
for rejected HTTP/oversized responses; all old TikTok/LinkedIn cases still pass.
Signals also reach SDK reads; late SDK/HTTP completion cannot continue credential
transmission after deadline. No credentials are serialized by the composed
status result. No app secret is required for these documented inspection reads.

**76 new credential/composition regressions /222 affected checks pass**, using
the actual encryption primitive, private HTTP composition and synthetic SDK/
provider responses. Cases include wrong app/account/key/AAD, revoked/missing
scopes, rotation/revocation races, expiry, cancellation, native errors, response
limits, no scope adoption, and no secret/refresh/consumer/publication access.
Actual Deno type check, scoped lint and build/emitted app pass. Frozen-source
full run: **4,835 total / 4,804 passed / 31 skipped / 0 failures**, concurrency2
with the existing Git Bash/OpenSSL in process PATH. Opt-in SQL stays skipped;
no fresh SQL proof or restart of the previously blocked container is claimed.
Restored only the two unrelated generated issue519 artifacts after completion.
Evidence in task TEMP: `cg-tiktok-concrete-credential-focused.log`,
`cg-tiktok-concrete-credential-types.log`, `cg-tiktok-concrete-credential-lint.log`,
`cg-tiktok-concrete-credential-build.log`, `cg-tiktok-concrete-credential-full.log`,
and failing-before-fix `cg-tiktok-credential-body-repro.log`. Self-review passes
for the private read-only source increment; native consent/runtime/provider
rollout gates remain explicit. No new product UI/device check for unchanged UI.

Merged main62f7a88a/PR997 by preserving BOTH the other owner's new Novus/fleet
receipt and all source-lane history. Their files are unchanged against main;
no recertification of their live/device evidence by this lane. Product UI is
unchanged, no new product browser/device or real TikTok API acceptance claimed.
No new dependency/schema/migration/permission/config/secret/Edge/OAuth/Microsoft/
Vercel/hosting/cost action or live provider call; no Docker restart. FOUR prior
migrations remain unapplied. Backend/config rollout, real one-time Business
consent, native read/pilot acceptance, uploader/source-to-share_id provenance
and durable registration/audit integration remain gates. Teams/sync hold/staff/
Nolan preserved. Google Control Centre exact target unknown; no guessed write.

## Earlier 16 November — exact TikTok Business publication-status reads, SOURCE ONLY

Same draft PR #991 / #220 / #269. Read the current official Business API v1.3
[publishing-status reference](https://business-api.tiktok.com/portal/docs/get-the-publishing-status-of-a-tiktok-post/v1.3)
in the existing company Chrome profile (`cgproductionhouse.com`); TikTok's own
account menu confirms CGPRODUCTIONHOUSE. Preserved all user tabs/sessions. The
reference is JS-rendered and not readable through ordinary web extraction; no
app settings, consent, credentials or real API request were needed or changed.

Verified native contract: one GET to `/open_api/v1.3/business/publish/status/`,
`Access-Token` header, app-specific `open_id` as `business_id`, and original
publication response's `share_id` as the request's `publish_id`. Successful API
envelope is numeric `code:0` plus `data`. Native public receipts are `post_ids`,
returned only with PUBLISH_COMPLETE when publicly viewable. TikTok says their
availability can lag by three minutes. SEND_TO_USER_INBOX is creator action,
not publication. PROCESSING_DOWNLOAD is pending; FAILED is a failed task.
These are separate from the consumer API's differently named fields/states.

Reproduced official Business `post_ids` being ignored by the existing generic
normalizer. Added an **explicit `tiktok_accounts` route argument** for that
contract; the original two-argument consumer behavior, existing consumer status
handler and accepted read-only analytics are unchanged. No legacy fallback is
used in Business reads. The private core and real fixed-host HTTP adapter read
only an exact stored task; no search, submission, upload, OAuth refresh, queue
mutation, first-account fallback or registration. Current exact active mapping,
actual app entitlement/account identity and native Business credential/grants
must still come from a REQUIRED unimplemented server credential resolver. The
conservative video-pilot credential profile requires existing `video.publish`;
this source work does not prove the app grant or authorize scope expansion.

PUBLISH_COMPLETE without a native public post ID stays processing. A180-second
next-read suggestion covers this documented lag; using the same interval for
download processing is conservative application policy, not a provider rule.
No timer/retry loop is started. Inbox delivery stays unknown/action-required;
raw failure reasons are replaced by fixed safe codes. Malformed/foreign/nonzero
API envelopes remain unavailable, never a genuine publication failure. Existing
receipts survive contradictions. Multiple public IDs are retained privately for
review, with no arbitrary first-post choice; future queue registration must
persist/project that evidence safely. IDs use a bounded conservative source
profile, not a claim to cover every valid provider identifier.

HTTP has a maximum one GET per read port, no redirects or automatic retry,
64KiB strict JSON/UTF8/body limit and deadlines/cancellation spanning fetch and
body. Token goes only in its documented header. Freshness/expiry and exact
client/connection/account are pinned and rechecked. Review reproduced/fixed
factory-caller cancellation being lost after credential resolution; the original
and read-caller signals now both cancel pending work. Existing LinkedIn deadline
logic is extracted into shared `socialPublishingRead.ts`; its public wrapper,
error codes and provider/credential behavior remain intact (69 regressions pass).

**66 new TikTok checks / 242 affected checks pass**: native response states,
public-ID lag/multiple/foreign receipts, envelope errors, cross-client/account/
task isolation, credential scope/expiry, fixed GET/query/header, malformed and
oversized bodies, cancellation/timeouts and legacy consumer/LinkedIn/OAuth
regressions. Actual private HTTP composition uses synthetic fetch/credentials;
no native account/API acceptance is claimed. Deno's actual cached type check,
scoped lint and build/emitted app pass. Frozen-source full run: **4,759 total /
4,728 passed / 31 skipped / 0 failures** (`--test-concurrency=2`, existing Git
Bash/OpenSSL in process PATH). The prior full-run Vite timeout did not recur;
no timeout assertion or staff source was weakened. Task TEMP evidence:
`cg-tiktok-business-status-repro.log`, `cg-tiktok-cancellation-repro.log`,
`cg-tiktok-business-status-focused.log`, `cg-tiktok-business-status-types.log`,
`cg-tiktok-business-status-lint.log`, `cg-tiktok-business-status-build.log` and
`cg-tiktok-business-status-full.log`. PostgreSQL remains intentionally unstarted;
the opt-in SQL group is among skips, not fresh database acceptance. Restored only
the unrelated generated issue519 access artifacts after completion. No new
product browser/mobile acceptance; UI is unchanged. Self-review passes for this
private source increment; native app/grant/pilot and deployment remain held.

Merged current main1c1bd36e/PR996, resolving only the handover prepend conflict
and preserving BOTH its Novus/January/owner-phone receipt and this lane's source
history. Other owner's MCP/strategy/runtime files are byte-identical to main.
No staff/Nolan/Teams/calendar ownership or Microsoft sync-hold change; no new
dependency or migration. FOUR previous migration candidates remain unapplied.
No publication/schedule/upload, production SQL/data/Edge/config/secrets/OAuth/
mapping/permission/provider/Microsoft/Vercel/cost action. Actual Business grant,
source-to-share_id uploader/provenance, durable registration/audit integration,
controlled native pilot and release authorization remain gates. #269's old
separate publish_jobs queue is not resurrected. No guessed tracker write.

## Earlier 16 November — native Deno codec qualification, SOURCE ONLY

Same draft PR #991 / #220. Closed the **standalone native Deno import/decoding**
gap for CA's already-approved `jpeg-js@0.4.4` private adapter. Added only
`scripts/qa/instagram-publication-codec-deno.test.ts`; production code, dependency
manifests, queue/migrations, entrypoints and registration are unchanged. No
concrete production defect was found or speculative runtime fix introduced.

Six native tests pass with the actual `npm:jpeg-js@0.4.4` default import and
actual private adapter/runtime, without Vite, CommonJS test transpilation,
decoder mocks or type-declaration bridges. Deno's own type check also passes
against the real npm/SDK declarations. Covered: denied runtime permissions,
real RGBA pixels and unchanged source bytes on both Instagram login routes,
corrupt entropy and sanitized failure, the codec's independent resolution
ceiling, inactive composition/exact frozen-release isolation before SDK access,
and maximum-profile 1440x1800 solid/high-detail synthetic originals.

The official standalone Deno 2.9.8 Windows archive was downloaded into task
TEMP only and SHA256-verified against its official release metadata:
`cba84b26e0df5ae7f74fc66b86a95b866872a86292ebd84fa1e959927edd93bf`.
No system installation, startup/browser/profile change, persistent PATH edit or
shared node_modules modification. Public package/type downloads populated only
the task's isolated DENO_DIR before execution; test execution was cached-only,
no-prompt, with net/env/write/run/ffi/sys DENIED and read limited to the one
synthetic JPEG fixture. The test asserts those permission states itself.
No credential values or production data were read. Zero provider/database calls.

Reproduce using the verified task-local executable (or an explicitly verified
compatible Deno), keeping cache preparation separate from sandboxed execution:

```powershell
$qaDenoRoot = Join-Path $env:TEMP 'cg-social-220-deno-20261116-v2.9.8'
$qaDeno = Join-Path $qaDenoRoot 'bin/deno.exe'
$env:DENO_DIR = Join-Path $qaDenoRoot 'cache'
& $qaDeno cache --no-config --no-lock --node-modules-dir=none scripts/qa/instagram-publication-codec-deno.test.ts
$qaFixture = (Resolve-Path 'tests/fixtures/publication-baseline-320.jpg').Path
& $qaDeno test --no-config --no-lock --node-modules-dir=none --cached-only --no-prompt --deny-net --deny-env --deny-run --deny-write --deny-ffi --deny-sys "--allow-read=$qaFixture" scripts/qa/instagram-publication-codec-deno.test.ts
```

Evidence: task TEMP `cg-social-220-deno-20261116-v2.9.8/native-tests.log`;
**6 passed / 0 failed**, build/emitted app, scoped ESLint and PR diff pass.
Final native maximum-profile measurements: 138ms solid / 383ms high-detail on
this Windows host. These are NOT hosted Supabase Edge CPU/memory measurements.
Standalone Deno is not Supabase's hosted isolate/version, an app-specific grant,
signed-media retrieval or native Instagram publication acceptance. Those remain
separate rollout gates; the adapter stays unregistered and publishing stays off.

No new browser/device check or full app/SQL suite rerun is claimed for this
QA-only increment. Prior 630e9a0f's full-run Vite timeout, isolated 9/9 recovery,
31 skips and blocked local PostgreSQL restart remain accurately recorded below.
No Docker restart or alternate database execution attempted. Current main is
already an ancestor; other PR/staff/Nolan/Teams work and sync hold preserved.
No production SQL/data/Edge/config/secrets/OAuth/mappings/permissions/provider/
Microsoft/Vercel/cost action; FOUR migrations remain unapplied. Google Control
Centre exact target remains unavailable; no guessed write.

References: [official Deno release](https://github.com/denoland/deno/releases/tag/v2.9.8),
[permissions](https://docs.deno.com/runtime/fundamentals/security/),
[test command](https://docs.deno.com/runtime/reference/cli/test/).

## Earlier 16 November — approved JPEG adapter and accurate scheduling controls, SOURCE ONLY

CA explicitly approved the exact `jpeg-js@0.4.4` dependency and private adapter.
That approval is now consumed for source adoption; it is **not pending** and does
not authorize activation, deployment, account changes or actual publication.
Same draft PR #991 / #220; no second queue, schedule or operating lane.

Manifests pin exactly0.4.4: one root dependency plus one lock package, with no
existing package/version/settings changes or transitive dependencies. Registry
integrity matches the qualified official archive. The shared `node_modules`
junction was NOT installed into or modified. The unvendored npm package retains
its BSD-3-Clause LICENSE and decoder's Apache-2.0 copyright/license notice.
Private `instagramPublicationCodec.ts` supplies the real decoder to the existing
Instagram runtime and its original exact-account/immutable-source/durable
authorization barriers. No entry/worker/MCP registration or activation parser.
[Supabase dependency instructions](https://supabase.com/docs/guides/functions/dependencies)
support versioned npm imports; source support is not native runtime acceptance.

`scripts/qa/publication-jpeg-codec.mjs` executes the actual adapter with the
integrity-checked real CommonJS package and existing runtime. Five real decode
cases pass, including corrupt entropy rejection and1440x1800 solid/high-detail
originals; fixture bytes unchanged, composition performs zero database/provider
calls. Node maximum-profile measured141ms solid/372ms detail in this run, not an
Edge CPU-budget claim. Initial Vite inline CommonJS attempts failed; the local
QA now transpiles the actual adapter and explicitly loads the real package.
Native Deno npm resolution and hosted Edge CPU/import acceptance remain gates.
No decoder mock or passing media flag substitutes for actual pixel decoding.

Reproduced the current candidate UI offering new Facebook scheduling for a
superseded review and other-channel/non-PNG work. The existing staff-manager
visibility and job-history/withdrawal controls remain. Creation now requires an
approved Facebook PNG review plus the default-off preview flag; backend scope,
source and release checks remain authoritative. Same review metadata reaches
both the panel and confirmation action. Unmount invalidates pending previews;
new authority is never inferred from old job history. No design/layout/icon
change. The earlier manual management-only fixture now passes the new props
and keeps creation disabled.

Focused management regressions27/27 and an actual isolated local Chrome run
pass:36 cases across375/390/430/1440, client/ordinary-staff exclusion, exact
manager controls, unsupported/superseded history, second-action confirmation,
cancel-without-write and late-preview discard. Real components/library/CSS with
synthetic I/O and all external requests blocked; no company profile/session
attachment, remote-debugging port, provider/database write or physical phone
claim. Screenshots/log in task TEMP `cg-publication-review-browser`.
Build/emitted app, scoped lint and strict imported-helper typing against the
actual package declarations pass; codec is absent from the browser bundle.
Corrected full-app run: **4,690 total / 4,658 passed / 1 failed / 31 skipped**.
The one failure was a60-second Vite module-load timeout in the unchanged
`teamsReadinessAudit.test.mjs`; the entire affected file then passed **9/9**
in isolation with no source change. Do not label the original full run green.
An earlier invocation's16 environment failures (Windows Bash/OpenSSL selection)
were cleared by the corrected process PATH. No system setting was changed.
Logs: task TEMP `cg-approved-jpeg-full-corrected.log` and
`cg-approved-jpeg-teams-isolated.log`. Self-review finds no blocker to this
bounded source-only change; full-suite Vite stability remains a harness concern,
not permission to change the staff/Teams runtime or claim native acceptance.

Automatic approval review rejected restarting the owned, network-none local
PostgreSQL QA container with only “blocked by policy” as the stated reason.
It remains stopped; no attempt to bypass the rejection was made. The31 skips
include the opt-in PostgreSQL group. The previous frozen2bbaa2b5 receipt's29
actual PostgreSQL checks are separate prior evidence, not rerun in this turn.
Queue, authority, preparation and all four migration sources are unchanged in
this increment. Unrelated generated client-access artifacts were restored.

Integrated mainf89fefea/PR994; preserved its opening-viewport runtime and LIVE
receipt unchanged. This lane did not deploy or independently recertify their
physical-device result. FOUR existing migration candidates remain unapplied;
Teams stays current, Microsoft hold/Nolan/staff lanes untouched. No production
SQL/data/Edge/config/secrets/OAuth/mapping/permission/provider/Vercel/cost action.
Google Control Centre target still unidentified; no guessed tracker write.

## Earlier 16 November — LinkedIn read-only photo receipt verification, SOURCE ONLY

Same draft PR #991 / #220. Added private LinkedIn photo status core and a real
GET-only versioned HTTP transport with REQUIRED server credential resolver. No
OAuth/mapping/token store, account connection, Edge/MCP/worker registration or
first-class provider/analytics ownership is introduced. #493's separate connection
milestone and prerequisites remain its owner's concern; this is publishing-core
source work under the existing mission, not a new client provider rollout.

Exact client/connection UUID, organization URN, post receipt and image receipt
are pinned before async work. No post search, inferred IDs, arbitrary URL, upload,
POST/PUT, permission enlargement, credential refresh or automatic request retry.
Public verification requires the exact READER version's commentary and recorded
image, PUBLIC/main-feed distribution without targeting/ad/reshare/group context,
publication time and AVAILABLE image with the same organization owner. It does
NOT establish CG creative provenance or image SHA256: a future qualified uploader
must first bind that recorded image URN to the immutable approved source/hash.

Review reproduced a subtle draft/public mismatch in the new core before fixing:
a later unpublished AUTHOR edit could hide the already-public original. The
public reader now wins when it exactly matches the recorded job. Conversely, an
old public version cannot prove a newer pending caption is posted. A reader404
or older/unpublished same-post reader may use exact AUTHOR pending/failed evidence;
permission/rate/network errors remain unavailable. Existing receipts survive every
outcome. No draft/readiness
or plain PUBLISHED author marker is sufficient to claim a public photo.

Transport uses only api.linkedin.com/rest, encoded fixed receipt URNs, bearer
headers, explicit monthly LinkedIn-Version and Rest.li2.0 headers, no redirects
or downloadUrl follow. Last12-calendar-month admission is a conservative SOURCE
window, not a claim every version is available/entitled. No latest/unversioned
fallback; exact version needs native acceptance (202511 is outside this window
on16 November). Credentials require current exact scope/identity metadata, fresh
verification and expiry margin; source resolution is still an UNIMPLEMENTED
private port that must check actual app/role/active mappings before registration.
Post reads use r_organization_social; Images GET has a separate eligible-scope/
role requirement. This organic profile does not fall back to member/ads grants.
Fetch plus body is bounded, cancellation propagated, JSON<=256KiB, fixed sanitized
diagnostics and maximum three resource GETs per status invocation. No polling loop.

Current primary references: [Posts/reader view](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-09),
[post schema](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/post-api-schema?view=li-lms-2026-09),
[Images API/access](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api?view=li-lms-2026-09),
[versioning](https://learn.microsoft.com/en-us/linkedin/marketing/versioning?view=li-lms-2026-09).
Exact commentary equality and publishedAt are conservative proof requirements;
native little-text/rich-commentary projection remains a future qualification gate.

69 new LinkedIn regressions /109 affected checks pass, including actual private
HTTP composition with synthetic fetch, pending/public/draft states, owner/scope/
account isolation, permission/rate errors, size/MIME/JSON bounds and cancellation.
Build/emitted app, scoped lint and TypeScript helper check pass. Final frozen-source
full acceptance: **4,711 total / 4,681 passed / 30 skipped / 0 failures**, including
all29 actual isolated PostgreSQL checks. Generated unrelated artifacts restored;
owned network-none QA container stopped. Source review passes within this private
read-only increment, not registration/rollout authorization. No native
Deno/live provider/browser/phone evidence. Existing pipeline integrations and UI
are unchanged. No new production dependency or migration (FOUR prior candidates
unapplied); decoder approval remains pending. No production data/SQL/Edge/config/
provider/OAuth/Microsoft/Vercel action; Teams/sync hold and Nolan remain untouched.

## Earlier 16 November — Instagram caption qualification and current-main integration, SOURCE ONLY

Same draft PR #991 / #220. Brought main4ee7d503 (PR993) into this branch; only
handover prepend conflict required resolution. Preserved BOTH the staff/mobile
owner's committed release record and this lane's source-only evidence. No edits
to their runtime work or any new deployment by this lane. Their LIVE status is
recorded from main's receipt, not independently re-certified here.

Reproduced oversized Instagram copy passing canonical preparation and private
transport construction. Added one pure text profile shared by canonical reading,
admission, create/publish protocol and private transport. Invalid captions stop
before private bytes/credential/provider access; exact safe blocker codes reach
the existing confirmation core without raw text. Valid spaces, CRLF/newlines,
Unicode and business emails are sent unchanged. No truncation, rewriting or
duplicate-tag removal. Invalid UTF-16 is rejected before transport can replace it.

Meta's current [media reference](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media)
documents caption bounds of2200 characters/30 hashtags/20 @tags. Its precise Unicode
counting/tokenization is unspecified: this conservative application profile caps
2200 UTF-16 units and lexical tag occurrences (Unicode hashtags, standalone ASCII
username mentions excluding normal email local parts). This is NOT native proof
for all provider-valid text. Native boundary acceptance remains a rollout gate.
Facebook copy does not inherit Instagram's smaller bound. GET-only receipt reads
skip NEW-post caption qualification, preserving already accepted operation truth.
A ready container with invalid current copy cannot cross the second publish
barrier; its existing uncertainty is retained instead of a false cancelled claim.

The reference also confirms Page Publishing Authorization and conditional two-
factor requirements can block real publication. Current permission/quota checks
are not a guarantee of provider acceptance; no account/security setting was read
or changed to bypass those requirements. Disclosure/partnership options remain
unimplemented and cannot be inferred from approved text or the filename.

Focused236/236, build/emitted app, scoped lint and helper/entry typing bridge pass.
The first merged-source full run exposed TWO stale commandCentreNavigation tests
still requiring PR993's removed desktop-clone phone drawer. Updated only that
test file to exercise the actual mobileNavigationGroups helper, manager/admin
reachability, ordinary-staff isolation and the intentional import-inside-Team-Work
flow. All14 main mobile/login runtime files remain byte-identical to origin/main;
no staff UI rollback or operational change. Navigation/mobile regression33/33
and scoped test lint pass. Final merged-source acceptance after the test-only
compatibility correction: **4,642 total / 4,612 passed / 30 skipped / 0 failures**,
including all29 actual isolated PostgreSQL checks. Generated unrelated access-
matrix artifacts restored and the owned network-none QA container stopped.
Source review passes within this private increment; rollout remains held.
No UI changes from this caption increment or fresh browser/native/provider/phone
acceptance. Decoder dependency approval remains pending; manifest/lock/shared
node_modules untouched. Instagram still UNREGISTERED; FOUR migrations remain
UNAPPLIED. No upload/schedule/publish, live SQL/data/Edge/config/OAuth/provider/
Microsoft/Vercel action, new production dependency or overlapping Nolan work.

## Earlier 16 November — canonical Instagram preparation and confirmation, SOURCE ONLY

Continued the same draft PR #991 / #220. Reproduced that BOTH Instagram login
routes failed the canonical reader's Facebook-only release check. The existing
reader now supports explicit exact-account photo policies for Facebook Page,
Instagram Login and Instagram via Facebook Login. It reuses the SAME immutable
review, monthly_deliverables, captured Teams evidence, private source hash,
original confirmation and background_jobs authorities. No second scheduler or
approval store. Route-specific current grants, channel, original JPEG byte limit
and strict Instagram media profile are checked; Facebook grants/proofs cannot
stand in for Instagram. PNG/video and wrong channels stop before media/provider
access, and oversized JPEGs stop before byte materialization.

New PRIVATE instagramPublicationRuntime joins the already tested credential/
media/provider composition to that canonical reader and the existing fenced
worker interface, including its separate publish-ready-container method. Common
target derivation and ORIGINAL durable authorization recovery were extracted from
the Facebook runtime into socialPublicationRuntimeSource; existing Facebook paths
reuse them. Configuration/intent scalars are captured before asynchronous reads.
The existing staff preview/confirm handler now exposes a generic private photo
alias while preserving its original Facebook import/Edge contract. Browser input
still contains only review ID and exact confirmation, never client/account/proofs.

**Instagram remains UNREGISTERED in Edge/MCP/worker dispatch.** No environment
activation parser, default codec, imported production dependency or live setting
was added. The mandatory decoder argument remains held on the unanswered exact
dependency approval. These source helpers cannot become reachable by enabling the
existing Facebook flags. Caption/tag/disclosure qualification, dedicated exact
Instagram release policy/entry review and native/provider/device acceptance remain
required before rollout. All FOUR prior migration candidates remain UNAPPLIED;
this increment changes no SQL/schema, production data, roles, mappings or tokens.
Teams remains the team's scheduling platform and the Microsoft sync hold is intact.

Actual local composition tests cover both encrypted login routes, zero-write/
zero-sign preview, exact confirmation, duplicate-confirmation original receipt,
worker recovery of the original authorization, changed caption suppression,
revocation, stale captures, inactive manager, foreign routes/accounts and missing
decoder. Provider requests/storage are synthetic; these are not live provider or
native Deno receipts. Focused suite: **228/228**. Real isolated PostgreSQL:
**29/29**, including two new login-specific atomic preview/confirmation cases.
Five separate real codec QA decode calls still pass in integrity-checked task
TEMP only; no manifest/lock/shared node_modules changes. Build/emitted app,
scoped lint and helper/entry typing bridge pass. Final full local acceptance for
this frozen source: **4,608 total / 4,578 passed / 30 skipped / 0 failures**,
including the actual candidate PostgreSQL fixtures. Generated unrelated access-
matrix artifacts were restored and the task-owned network-none QA container
stopped. Source review found no blocking issue within this private increment;
this does not approve registration, dependencies or rollout.
No new UI/browser/physical phone acceptance is claimed. No publishing/upload/
schedule, production SQL/data/Edge/config/OAuth/provider/Microsoft/Vercel action.
Main remains4af41304; Nolan PR990 has no overlapping publishing files. Google
Control Centre target remains unidentified; no guessed tracker write.

## Earlier 16 November — LinkedIn lifecycle correction, SOURCE ONLY

While the exact JPEG dependency approval is pending, official LinkedIn review
exposed a concrete normalization gap: native `lifecycleState=PUBLISH_REQUESTED`
was treated as unknown. Regression reproduced before fixing. The existing shared
normalizer now accepts native lifecycleState and the legacy internal status
projection, distinguishes pending/failed/published, refuses conflicting evidence,
and requires an actual share/ugcPost URN before reporting posted. Image AVAILABLE,
drafts and unknown states cannot become published posts. No account IDs/mappings,
new adapter/route/worker or provider mutation is introduced by this correction.

Current primary references:
[Post Schema](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/post-api-schema?view=li-lms-2026-09),
[Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-09),
[Images API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api?view=li-lms-2026-09).
Image readiness and post publication have different state vocabularies. Versioned
REST/Rest.li headers, Community Management entitlement, current organization roles,
image upload/readiness, durable mutation barriers and exact-author/media readback
are still mandatory before any LinkedIn runtime is registered. The retiring
202511 version is not a safe release default. Member/ads grants are not assumed.

Post-correction affected suite **214/214 passes**, including existing Facebook,
Instagram, Business OAuth, preparation, authority and management regressions.
Build/emitted application, scoped lint, helper typing and diff pass. The full
4597/4567/30 acceptance below was completed BEFORE this small isolated LinkedIn
branch correction; it is not relabelled as a new full run. No database changes or
fresh browser/native/provider acceptance. Exact decoder adoption question remains
pending; manifest/lock/shared dependencies are untouched. Same draft PR #991.

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
