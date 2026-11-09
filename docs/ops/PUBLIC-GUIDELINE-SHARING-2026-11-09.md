# Public client Content Guideline delivery — 9 November 2026

Owner #896 / #450; supervision #381. CA explicitly requested publishing the
existing Germoparts four-video guideline for client review and a client-named,
no-login link returned directly by normal company/personal ChatGPT. This
supersedes the earlier staff-only-link outcome, not unrelated publication gates.

## Exact change

- Reuse the accepted black/teal/orange ContentGuidelineDocument renderer at
  `/guidelines/:client-content-guideline/:capability` outside sign-in guards.
- Three MCP actions: publish_content_guideline, get_content_guideline_share,
  revoke_content_guideline_share. Tool catalog59 (29read/30write), bootstrap first.
  Fix stale global instructions that incorrectly prohibited all publication.
- Exact-client/run validation and server-resolved active staff actor remain.
  Publishing issues a client-safe snapshot, never an approval or calendar write.
  Republish updates the snapshot; ordinary draft edits do not leak publicly.
- Private RLS registry,256-bit bearer capability, no public table access or
  enumeration. Anonymous RPC returns one allowlisted snapshot. Revocation and
  source unpublication deny access; republishing a revoked link rotates its key.
- Staff UI publishes/copies the same client link; published document can publish
  its latest version. Existing sign-in and client portal restrictions remain.
- No new production dependency, provider/OAuth/scope/secret/Teams/schedule change.

## Verification before release

- Actual disposable PostgreSQL17 migration/anonymous/authenticated/staff/role,
  client isolation, draft/snapshot, revocation/key-rotation and unpublish tests pass.
- Supported full suite4,247pass/30optional skips/0fail (4,277total);12 unrelated
  Unix SES CLI-mock tests excluded on Windows as previously documented. A final
  instruction regression was added afterward and checked in the focused run.
-135 focused tests passed before that additional regression. Final scoped lint,
  repository MCP Deno check (validation-only Vite ambient declaration), app build,
  application chunks and diff checks pass as recorded in the release receipt.
- Local production-target Vercel prebuild passes; public route has noindex,
  no-referrer and private/no-store headers. Git deployments remain disabled.

## Release boundaries and packet

Reviewed #970, feature commit33972850, merged main46a38c39. The prebuilt tree
matches merged main exactly. Exact deployment/readback identifiers follow below.
Supabase target ehtjfntukiwbgptqgbzy. Migration
20261109093718_public_content_guideline_shares adds only the private snapshot
registry and three narrowly granted RPCs. MCP baseline ACTIVEv79/40files;
replace only index.ts/contentGuidelineActions.ts/toolCatalog.ts/projectContext.ts/
capabilityManifest.ts, preserving other35files/settings/authentication.

Vercel project prj_jHVsExoStNjI7ikqlJyXZx26Ahuu, team
team_SK5vvWv1AIXFkPNV8JFYL205 (cg-dynamics-projects), production environment.
Rollback dpl_HMKqEahvYRDx6fVuNDbmn1oAfiq5. One locally prebuilt production-target
staging upload, no alias until verification, then promote that same deployment.
Zero cloud compilation, additional preview churn, hosting/DNS/budget changes.
CA's standing conservative live-release instruction applies to this requested
feature; no additional spending allowance or budget-setting increase is inferred.

Fresh official CLI usage9November: current cycle18October–18November; reported
cost27.7818936843USD includes14.8387096774USD Pro allocation. Service usage about
12.9431840068USD, about7.0568USD of included20USD left; reported billed overage
effectively zero. These are provider charge-period estimates, not instantaneous
metering. Retain at least5USD serving reserve; stop this release if estimated
incremental cost exceeds1USD or crosses reserve. Active team/project readback
passes; no cap or protection is changed. Current budget-setting meter was not
independently refreshed;6November's15USD/PauseON is historical only.

## Exact content acceptance target

Germoparts client b6052710-417d-4b3b-8348-0f126bfea671;
run72624865-e13d-4d98-af5d-211f6c837d21;
guideline e4a541a8-e730-478c-812e-feb043d0ed71. Four existing scripts must read
back verbatim; only requested publication/snapshot/normal audit receipts change.
No new guide, approval, message, other-client content or schedule mutation.
Do not commit the public bearer capability to source or GitHub; return it only
to CA and retain private acceptance evidence locally.

## Live acceptance

- Migration applied; independent readback confirms registry RLS enabled, anon/
  authenticated table SELECT denied, anonymous management denied, authenticated
  actor-injection RPC denied, authenticated narrow wrapper allowed. Only the
  exact read-only public snapshot RPC is executable anonymously.
- Existing MCP **ACTIVEv80**, runtime bundle
  `0c164dd8f28128b8e1b639b4dc47e1ab216b51c337b3108db0e8224f75676691`.
  Fresh v79 preflight exact; final40-file readback exact,35other files preserved,
  verify_jwt=false/import_map=false and existing authentication unchanged.
- Production **dpl_ArdGYhaAcEh9kbAP2r8skWV8HNCS**; one2.5MB differential prebuilt
  upload then promotion of that same deployment. Zero cloud compilation.
  Protected staging verified with existing Vercel CLI identity; no protection
  setting changed. Staged HTML/new-page chunk SHA256 match the local artifact.
  Production root/login/new route/chunk HTTP200; new chunk exact and
  noindex/no-referrer/private-no-store headers independently verified live.
- Normal **company ChatGPT Chat mode** performed resolve/read/publish/get-share
  and returned the named no-login link. Independent audit SELECT confirms exactly
  one successful publish receipt for the exact client/run/guide. Source guideline
  now published; all four script hashes/video IDs/order/idea states unchanged.
  Exactly one share exists; no other client was published.
- Normal **personal ChatGPT Plus Chat mode** retrieved the identical verified
  no-login link and four-video count in a read-only test. Both existing personal
  app entries were refreshed through their normal settings UI; both point to the
  same production endpoint. The alternate Personal Refresh app's misleading
  read-only-acceptance description was corrected to its actual staff/content/
  client-review-sharing capabilities. No OAuth scope or permission was expanded.
  Company settings tools were refreshed too; no laptop handoff was needed.
- Independent anonymous HTTP RPC (publishable key, no user session) returns all
  four exact original scripts. Wrong token/foreign slug return null. Anonymous
  table read and management both401. Snapshot has only allowlisted fields.
- Native Chrome public page displays Germoparts branding and all four complete
  scripts without login.375/390/430px responsive UI checks show readable wrapped
  content; video04 anchor navigation, copy-link/no-sign-in feedback and expandable
  filming direction pass. DevTools closed afterward. Responsive browser acceptance
  does not mean a real iPhone test was performed.
- CUA browser adapter still reports disabled despite visibly enabled settings/
  installed extension. Native app controls provided the verified path; no
  credentials were copied or authentication bypassed.

Private live proof: `%TEMP%/cg-public-guideline-live-acceptance.json`;
artifact185files/41,569,096bytes manifest `%TEMP%/cg-public-guideline-artifact.json`;
staged/live inspection and final prebuild logs retained alongside them. Own
disposable PostgreSQL container stopped; other Docker workloads untouched.

Five reviewed hosted file LF SHA256 values:

| File | SHA256 |
| --- | --- |
| index.ts | 743e6f8bedce93f2ed0738f2ab0e31eeac6f06ee83c055cce86f917832cfb713 |
| contentGuidelineActions.ts | 79d3a0fa38f48c7689be92b0104e9328ed0e724274e565c7171a18b59c2fb826 |
| toolCatalog.ts | 5dc7a743138a9034e0330c039682cc9d5352e7d9a0289b334a014ff1d065cf63 |
| projectContext.ts | 179bb11113ec8a4d6817fe16d2dcb4e7c100c23d1f7ac61b79132f53667e9a66 |
| capabilityManifest.ts | 84f5c78004bdfa7e45bc53b5af82672d34f817a85478cca133401db7873aae5b |

This lane does not certify all-client/provider launch readiness. Existing
strategy, provider, recipient-safety, client-role and real-phone gates remain.
Final connected Google Drive discovery did not expose the exact Control Centre
file (bounded keyword and exact-title-filter searches). No substitute tracker or
guessed-cell update; owning issues/#381 and this handover retain the live receipt.
