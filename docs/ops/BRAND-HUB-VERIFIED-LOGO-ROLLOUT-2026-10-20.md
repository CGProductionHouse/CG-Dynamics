# Brand Hub verified-logo rollout — 20 October 2026

Client lane #396/#668; supervisor #381. ZERO Vercel operations.
This supersedes the earlier Braize-only pilot state, not its retained audit trail.

## Exact approved scope and result

CA approved extending the pilot to remaining launch clients only for individually
verified current logos already inside each client's safe Brand Identity folder,
enabling only those verified libraries and skipping missing/ambiguous files.
A separate later CA approval covers only the optional-context handler release.

Forty additional logos were published through the real signed-in admin workflow,
then their libraries enabled separately, each with fresh saved-state readback.
Together with Braize: **41 enabled libraries /41 active assets**. All58 linked
libraries/174 category mappings remain. The other17 libraries stay disabled with
zero assets. No new folder, file copy/move, sharing, permissions, schema, migration,
secret/config, provider mapping or Vercel change. No raw/internal tree publication.

Before publication, each reviewed file was rechecked via the read-only OneDrive
connector: exact item, parent, name, byte size and safe portal category. Thirty-nine
source versions matched the reviewed eTag; Novus' eTag differed, but exact item,
parent, size and SHA256 bytes matched, so its identical reviewed logo was retained.
Visual logo attribution used the existing private inspection sheets/PDF renders.
JFJ's dark digital export was selected once, not both dark/light variants.
Emmanuel's marketing mockup and Vrystaat subbrands were NOT published.

Independent final read-only DB acceptance:40 expected additional rows,40 exact
visible assets,0 errors in client/library/category/drive/parent/file/size/display
name/publisher/time relationships. Fleet totals58/41/174/41,0 inactive assets,
0 wrong per-library asset counts,0 assets for held AV/Red Oak or prospective Zooz.

## Completed additional clients

- All Around PVC
- Bloem Action Sports
- Bloem Vascular
- Bouwer & Coetzee Attorneys
- C&L Innovations
- Cape Lumber
- Case Bloemfontein
- Central Canvas
- Delta Gas
- Ehrlich Park Butchery
- Elcheck
- Emoya Estate Driving Range
- First Technology Central
- Germoparts
- HMHI
- Human Auto
- Jenkor
- JFJ Electrical
- Kundedienste
- LHP Student Village & Block
- Local Deli
- Loraclox
- Madison Wear
- NCNA
- Neshora Oxygen
- Novus Steel
- Peyper Bonds
- Piek Group
- PSG Bloemfontein
- SecuriForce
- Supa Quick BFN
- Supa Quick Centurion
- The Staffordshire
- Tobich Optics
- Toyota Bloemfontein
- VCS Cleaning Solutions
- Watch Addict
- We Ar Fuels
- Wiseman Group
- WiseRide

## Explicit skips (17, all remain private)

Sixteen safe Brand Identity folders were successfully read and empty:
Agri-Secure; Bat Hill Royale; Bloem Marble & Granite; Bohemia Quick Stop;
CG Production House; Daisy & Co; Dulux Paint & Paper Bloemfontein; Econofoods;
Forklift Trucks; Hino Trucks; Ipopeng Office Supplies; Mimosa Mall; RC-Polypipe;
Rusoord Farmstay; TBS Brokers; Vrystaat Kunstefees.

Emmanuel Funerals had one file, visually a marketing mockup rather than a logo.
It remains private and untouched. Missing content is not a failed/unreadable folder.
Separate internal exports were reviewed for later source promotion, but this
approval did not copy/promote files from internal folders. Do not relabel source
availability as already-published client content or silently expand this scope.

## Optional Brand foundation context — exact approved backend release

Live Braize preview reproduced a false outage: valid library worked, but absent
optional onboarding session returned404. Read-only DB confirmed zero Braize
onboarding rows. Existing clients legitimately need no onboarding session.

Changed only the portal_load/staff preview read: query errors stay sanitized503;
genuinely absent data returns200 {ok:true,data:null}; existing valid records keep
their normal safeState projection. No session is created or approved/published.
Existing frontend already omits empty optional context while preserving real errors.

Runtime commit9afd53a5db026eeb4b18f10c6b5ff15cb5bfb045; handler Git blob
05db7dd81f73d1797660bc7abaf056ae21749d03.
CA approved this exact handler-only backend update. Fresh v47 preflight matched
all10 frozen hosted files. Staged the tested handler plus nine HOSTED dependencies,
not all of local main. Deno checked that exact closure, then existing
client-onboarding deployed once v47->v48 ACTIVE, verify_jwt=false preserved
with internal active-profile/role checks. Full10-file hosted readback equals
the frozen release after newline normalization; all nine other files preserved.
In particular, did not silently replace the hosted older token-store helper.
No secret/auth/config/dependency or permission change.

Normalized handler SHA256 (LF, trimEnd):
1a99d4fd1679c0c4cf6eb49c2e700ce372bb9270a497f7540388401bb7b6cfab

Rollback: previous code-only v47 closure remains at
C:/Users/chris/AppData/Local/Temp/cg-onboarding-media-release-20261020/.
New code-only release closure:
C:/Users/chris/AppData/Local/Temp/cg-onboarding-optional-context-release-20261020/.
No rollback needed. Asset rollback uses existing Hide file/Hide library, never
deleting history or changing OneDrive sharing.

## Verification and boundaries

Fresh real read-only admin client-preview sweep: all40 additional selected clients
show exactly their own published logo with one View and one Download control,
no library/optional-context errors. All37 image thumbnails loaded with nonzero
natural dimensions; three PDF logos have the expected no-thumbnail file entries.
Braize's existing pilot was freshly reloaded and its file list still works after
v48. This checks listing/thumbnail availability, not40 separate actual downloads
or genuine client credential acceptance. UI navigation/loading snapshots were
allowed to settle before matching the exact selected client; no uncertain write
was repeated. Private processing journals/screenshots stay in local Temp, not Git.
All17 skipped-client real admin previews also passed: exact selected client,
prepared/private state, no Library file region, no Download control or false
optional-context outage. Thus Brand Hub was checked for all58 launch clients:
40 additional published clients +17 private +fresh Braize canary, no duplicates.
A single browser read timeout was recovered with a fresh responsive snapshot;
no publication, enable or other mutation was repeated.

Failing-first tests reproduced404 versus expected200 and503. After repair,
31 focused serial tests PASS,0fail/skip/cancel/todo, using canonical sanitized
fixture environment. Actual handler tests cover real client/admin preview empty
context, GET-only/no creation, cross-client/staff denial, sanitized query errors,
plus existing mutation/concurrency/media guards. Final rerun31/31 passes;
Vite printed a non-blocking occupied HMR port warning; no peer server was stopped.
Actual optional-context browser journey passes1440/375/390/430. Fresh npm build
passes TypeScript/Vite7.3.6,386 modules, real application JS; current/exact hosted
Deno, scoped ESLint and diff checks pass.

Live Braize reload now shows the working library without the false Brand foundation
warning. Unauthenticated valid JSON request401 and invalid file HMAC403 after
release; the initial malformed shell JSON probe returned400, corrected actual
JSON probe returned401. Service-only RLS remains enabled for all three library
tables, no anon/authenticated SELECT or authenticated write grants.

The earlier frozen non-DB3972pass/19explicit skips/19 browser journeys receipt
is retained, not rerun or represented as new full DB acceptance. Two Docker SQL
fixtures remain unverified on this lane; shared Docker was not reset/restarted.
Peer staff/Teams checkout has active uncommitted work, intentionally untouched.
Open onboarding/guideline/nav owners retain their lanes. Exact Control Centre
reference remains unavailable; no guessed tracker write.

This is logo/library and optional-context acceptance, not genuine client-password,
MP4/range fleet, strategy semantic quality or staff/calendar acceptance. Frontend
recovery changes in main PR853 remain source-only: no Vercel release.

Reviewer checklist verdict: approve this focused handler/test/continuity change;
no blocking correctness, secret, role-boundary, source-of-truth or scope finding.
Only one existing backend handler and its real-dispatcher regression changed;
two continuity documents record exact approvals, rollout and remaining limits.
No ignored dist/config/assets or privileged values are included. Broader client
login/content/media/staff gates remain independent, not waived by this review.
