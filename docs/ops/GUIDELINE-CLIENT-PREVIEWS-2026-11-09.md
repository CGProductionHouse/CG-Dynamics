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

Pending exact source/runtime release readback and WhatsApp unsent-draft visual.
No external client/staff message is authorized or sent by this repair.

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
