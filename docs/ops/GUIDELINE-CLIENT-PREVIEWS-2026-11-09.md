# Client-named guideline message previews — 9 November 2026

Owner #896/#450, supervision #381. CA's real WhatsApp screenshot showed the
generic CG Dynamics app icon/title when sharing the otherwise working public
Germoparts guideline. Reproduced with a WhatsApp-user-agent HTTP read:200,
title CG Dynamics, no Open Graph tags. React's later document.title update is
insufficient for initial-HTML link preview crawlers.

## Focused repair

One Node24 Vercel function renders metadata into the exact built SPA shell for
`/guidelines/:slug/:token` before the existing fallback. It reads only the existing
anonymous published-snapshot RPC using existing publishable configuration. No
SQL, Supabase permissions, source content, approval, calendar or OAuth change.
One current-publication read per GET/HEAD; five-second upstream timeout, no retry
loop or persistent client cache. Invalid/revoked links return unavailable404;
transport failures503. Never derive a client label from an unverified slug.

Initial HTML now carries the verified client's name + Content Guideline, content
month/video count and an existing public client logo when available. No video
scripts, source IDs, contacts, operational notes or private logo URLs enter the
HTML. Metadata escapes attributes/text; no user-controlled fetch destination.
Existing app shell/scripts and no-login access remain. noindex/no-referrer/
private-no-store retained. Shared public assets are reused, no new dependency.

Copied staff/public links and the connector's shaped share URL use a publication-
version query (`v=cg2-<published timestamp>`). This preserves the same capability
and old URLs, while giving new shares a fresh preview key. Canonical Open Graph
URL matches that connector/copy version. Previously sent WhatsApp cards can stay
cached by WhatsApp; they cannot be retroactively edited by Dynamics.

## Verification / release packet

Eight new handler tests plus six public-sharing regressions pass: exact metadata/
app shell, cross-client/no cached carryover, invalid/revoked links, injection,
anonymous-only configuration, HEAD/error/method boundaries, canonical version
agreement and deployment route order. Scoped lint, Deno and diff checks pass.
Production-target local Vercel prebuild and isolated built-function GET/HEAD check
pass using the existing live anonymous snapshot. All46 traced shell/public-logo
files are present; the shared TypeScript logo resolver uses its emitted .js
specifier. This caught a packaging error locally before any upload. No video
scripts enter HTML. Supported full suite **4,256pass/30optional skips/0fail**
(4,286total), excluding the same12 unrelated Windows-unsupported Unix SES shell
mock tests. The old one-rewrite hosting assertion was updated to explicitly pin
this one new preview route followed by the unchanged SPA fallback; Git deploys
remain disabled. Final17 focused tests pass. Actual staged/live/WhatsApp checks
follow; no fixture pass is represented as a WhatsApp pass.

Supabase target ehtjfntukiwbgptqgbzy; MCP baseline ACTIVEv80/40files. Only existing
contentGuidelineActions.ts changes its successful client_share_url to include
the publication preview version. Other39files/authentication/settings preserved;
no schema/data/secret/config write or content republishing is needed.
Reviewed helper LF SHA256: cd95b779de569cd23688b60221b85499465c40c5197152f4837771c938bc9ff6.

Vercel project prj_jHVsExoStNjI7ikqlJyXZx26Ahuu; team
team_SK5vvWv1AIXFkPNV8JFYL205 (cg-dynamics-projects), production. Rollback
dpl_ArdGYhaAcEh9kbAP2r8skWV8HNCS. CA's standing conservative release authority
covers this requested sharing fix. Exact source SHA recorded before release.
One locally prebuilt production-target staging upload, verify, promote same
deployment; zero cloud compilation/extra preview churn/hosting or budget changes.
New route performs a small anonymous metadata read; no background jobs.

Fresh CLI current-cycle estimate9November:27.7970082903USD total including
14.8387096774USD Pro allocation; service usage12.9582986129USD, included headroom
about7.0417USD, billed overage effectively zero. Provider period18October–
10November, billing cycle ends18November; charges are delayed estimates. Preserve
5USD serving reserve; stop on estimated incremental release use over1USD or reserve
breach. No cap/protection modification. Current budget configuration not reverified;
no unlimited/free claim. Read-only environment-name listing confirms existing
VITE_SUPABASE_URL/PUBLISHABLE_KEY in production; values never printed.

Official implementation references: [Vite functions](https://vercel.com/docs/frameworks/frontend/vite),
[bundled server files](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions),
[Open Graph fields](https://ogp.me/).

## Acceptance

**LIVE** — #972/f1fcf4bc (main f8d99e8f) plus packaging #973/7b9c8327
(main133b8701). Final source app/API tree matches the locally built runtime.

- Vercel production **dpl_EJr74MFsLf1uqmveHTZCqPQTyHFE** on the existing domain.
  Corrected self-contained stage READY; existing-identity protected staging GET
  returns exact Germoparts metadata, logo, current month/count, original app shell
  and privacy headers. Wrong capability404 reveals no client metadata. Verified
  previous alias unchanged, then promoted this SAME deployment; no recompilation.
  First attempted upload2.6MB; corrected artifact deduplicated upload only315bytes.
- Existing MCP **ACTIVEv81**, runtime SHA256
  `0e531104c52faf01b50f69bb01425864dfacc815c732463b56ee274121b2960d`.
  Fresh v80 preflight exact; final40-file readback exact, other39preserved and
  verify_jwt=false/import_map=false/authentication unchanged. Both connected
  company/second-account get-share reads return the same new publication-version
  URL, correct client and four-video count. No tool registration change required.
- Independent live WhatsApp-user-agent GET verifies200, client title/logo/month/
  count, exact public path and no-referrer; root/login200. Separate anonymous
  snapshot check confirms all four original scripts unchanged, foreign slug and
  wrong token denied, registry/management401. No content was republished.
- **Actual personal WhatsApp Business unsent-draft preview PASS:** Germoparts ·
  Content Guideline; November2026 ·4videos. Ready for your review; client logo.
  This is the account corresponding to CA's screenshot. The older sent message
  remains its cached generic card; no external message was sent or edited.
  Cleared both company/personal test composers and independently observed empty.
- The company Web session returned fallback domain cards even for the independent
  Wikipedia control URL, with no additional Dynamics function request. It does
  not prove a Dynamics metadata failure; the real personal-account card above
  supplies the actual rendered acceptance. No WhatsApp privacy setting changed.

Final local evidence:4256 full-suite pass/30optional skips/0fail;17focused pass,
separate2packaging pass; scoped JS/TS lint, Deno, built app chunks, exact traced
resources, isolated built GET/HEAD and diff pass. No physical iPhone test claimed.
Private prebuild/runtime/stage/production receipts are `%TEMP%/cg-guideline-preview-*`.
Public bearer capabilities stay out of GitHub/source. No SQL/schema/data/secret/
OAuth/permission/approval/Teams/calendar or other-client publication change.
Exact Control Centre target remains unavailable from this chat's bounded Drive
discovery; no guessed tracker write. Update existing owning issues/#381/handover.
This documentation closure requires no additional deployment.

First prebuilt stage dpl_8L6LUPxxAyfZhVYATx77QhUhc8qZ failed ingestion before
promotion: Vercel's generated filePathMap referenced source dist/index.html,
correctly excluded by .vercelignore. No cloud application compilation or live
alias/backend change occurred. Do not repeat that artifact. A reviewed local
packaging helper materializes only the exact HTML/public-logo references inside
the .func directory and removes external references, following Build Output API.
Run after the final local vercel build and before upload:
`node scripts/materialize-guideline-preview-bundle.mjs`. Two deterministic
self-containment/path-refusal tests cover the reproduced error. Keep dist ignored;
do not enable source upload or change hosting protections. One corrected bounded
retry remains under the same1USD/reserve stopping condition; no blind retries.
