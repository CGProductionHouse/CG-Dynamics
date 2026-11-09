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

Reviewed branch codex/public-guideline-sharing, based on main0a80a069. Exact final
commit/deployment identifiers and hosted readback belong in acceptance below.
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

## Acceptance

Pending this release: schema/grants readback, exact40-file hosted acceptance,
same-artifact production promotion, real connector publication/get-link and
anonymous client page including full four scripts. Browser adapter reports
disabled despite visually enabled Chrome settings; native app UI remains usable.
No final normal ChatGPT/phone pass is claimed until actually observed.

This lane does not certify all-client/provider launch readiness. Existing
strategy, provider, recipient-safety, client-role and real-phone gates remain.
