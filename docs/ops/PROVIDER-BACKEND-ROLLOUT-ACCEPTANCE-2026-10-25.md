# Provider backend rollout and local acceptance — 25 October 2026

### 3 November — exact-approved Teams shared-date backend LIVE (#941)

CA approved migration plus existing backend plus Cape8date-follow grants. All five
SQL function bodies match reviewed source; ACL/owners/search paths/RLS retained,
security-advisor categories/counts unchanged. Microsoft transition sync v78→**79**,
ACTIVE/JWT/importmap retained:18files read back, reviewed index+new helper only,
**16 other files byte-identical**. Unauthenticated request401.
Cape8grants enabled in-place by exact-approved optimistic management SQL with the
private reviewed source validator; UI already-shared dates cannot be re-shared.
No hide/re-share or auth impersonation. Independent readback confirms0other-client
grants and all prior sharing/content/approval/posting/source fields unchanged.
Eight audits explicitly identify management activation with no fabricated user actor.
Actual preview still shows8dates and Video repost. No Microsoft writes, resync or
Vercel. Natural automatic date continuation not yet observed; periodic cadence stays.
Full hash, receipt, actual Google/source and owner-retained role/device boundaries:
[Cape acceptance](CAPE-LUMBER-LAUNCH-REVIEW-2026-11-02.md).

### 3 November — approved reporting backend rollout complete

CA explicitly approved PR #938's exact four-function reporting release in this chat.
Fresh preflight found no hosted drift. All four functions are ACTIVE and independently
read back with exactly four changed helpers and **81 other files byte-identical**:

| Existing function | Version | Changed helper | Retained files |
| --- | --- | --- | --- |
| cg-dynamics-mcp | 75 → 76 | monthlyStrategyAutopilot.ts | 39 |
| monthly-strategy-autopilot | 48 → 49 | surgical legacy monthlyStrategyAutopilot.ts | 15 |
| meta-sync | 89 → 90 | metaInsightResponse.ts | 11 |
| meta-sync-worker | 76 → 77 | metaInsightResponse.ts | 16 |

Entrypoints, import settings, JWT/custom-auth code, identity and all other hosted
contents match their baselines. No secrets, schedules, permissions, scopes, mappings,
campaigns, strategies or database/schema were changed. No generation, worker wake,
manual/bulk resync or Vercel operation was performed.

The connector's initial pre-release connection failure recovered on the bounded
post-release retry without auth changes. Its normal authenticated read-only Cape
November brief now returns `verified_cg_creatives: unavailable` and zero
`published_report_post` seed citations. Cape's reviewed/published version 10 remains
version 10; its immutable-strategy gate is preserved. This does not delete or rewrite
approved staff strategy text.

The returned live Meta helper was executed locally: exact single-day 78 and observed
zero pass; unknown/multiple/wrong-day/duplicate/null/breakdown/wrong-period cases reject.
The newly deployed MCP 76 logged eight HTTP 200 responses and no runtime errors in
the bounded observation through 09:14 UTC. Other three functions were not invoked by
this release; their next normal cadence is not falsely claimed as observed acceptance.
No new provider figures were produced or old report facts replaced.

Receipt `%TEMP%/cg-reporting-backend-rollout-938-20261103.json`, SHA256
`33e4c942c9220af072009bf942a837c266b243540995e809f52bec04fe442b07`.
All 85 hosted files were compared. The tested source/runtime remains PR #938,
`f768c490b2873a8c8e1918c1c05db2059d08f2a8`; no further runtime edit.

This completes the exact backend approval and supersedes the pending-backend status
below. Client frontend guard and PR #931 visual reader still await the separate #679
release; automatic positive creative proof/matching is unfinished. Staff #325 retains
automatic schedule refresh. Real-password and physical-phone acceptance remain
owner-held. This backend receipt is not a whole-app/fleet launch certificate.

## 3 November — reviewed packet retained as release history

The packet below is the reviewed proposal; the completed rollout receipt above is
current authority. PR #937's calendar repost projection
is separately approved and live; do not reapply it. Tested runtime `84b0e929` and
fixture-only `b67e191c` have 4,222 passing supported tests, 24 existing skips and no
failures, mandatory PostgreSQL, build/bundle, backend TypeScript, scoped lint and diff.
All 24 canonical browser fixtures passed. The handover records the transparent
27-step reconciliation; the interrupted stock runner is not relabelled as successful.

| Existing function | Baseline | Only file to change | Other files retained |
| --- | --- | --- | --- |
| cg-dynamics-mcp | 75 / JWT false | `supabase/functions/_shared/monthlyStrategyAutopilot.ts` | 39 |
| monthly-strategy-autopilot | 48 / JWT true | Same helper, surgical hosted-48 variant only | 15 |
| meta-sync | 89 / JWT false | `functions/_shared/metaInsightResponse.ts` | 11 |
| meta-sync-worker | 76 / JWT false | Same parser | 16 |

The strategy guard removes automatic winners and citations for unverified page posts,
and reports `verified_cg_creatives: unavailable`. Original published findings, staff
wording, windows, canonical writes/approvals and normal ChatGPT ownership remain.
There is no automatic matcher or proof registry; the separately governed frontend
guard omits unknown CG highlights.

The Meta parser accepts a unique value only for one explicitly expected day and one
exact matching numeric bucket. Existing shape, breakdown and coverage checks remain.
Multi-day unique audiences cannot be summed. This fixes the observed single-day
78-viewer case; it does not recover unavailable monthly uniques or alter campaigns.

Before release, re-fetch every target's version, authentication/import metadata and
full file list/content. Stop on baseline drift. Preserve all 81 other files exactly.
The legacy-48 helper has unrelated source drift: never replace it wholesale with main.
Its private actual 16-file hosted-bundle proof and receipt are at
`%TEMP%/cg-hosted-monthly-proof-YPO4ug/`.
Original helper SHA256:
`7a02efe8bf5aeaed9a900797ce2a3c0b1522980d1f32957bfd038014e68841b8`.
Surgical candidate SHA256:
`b6013a74fede20d5153b479439639ef0d73431ec346d7d575d8ba2e83d0b4b0c`.
The baseline reproduces the unknown winner; the candidate omits it with all other
draft/evidence/window fields equal and zero writes. No private bundle is committed.

After exact approval, deploy only these four helper copies. Preserve entrypoints,
imports, JWT/custom authentication, roles, permissions, secrets and cadence.
Independently read back all 85 files: four changed and 81 unchanged, plus settings
and versions. Read the normal MCP brief to verify unavailable creative coverage
and no unverified creative citations. Do not save, approve or publish strategies,
trigger generation, wake a worker or bulk-resync providers. Scheduled cadence can
exercise the parser. No SQL, new function, migration, OAuth, key, mapping, campaign,
permission, dependency or Vercel change is part of this packet.

Client lane only, source `8353e75fd944dc038fbe7403a0013e9c1219b328`.
CA explicitly approved the exact Google safeguard and then the staged Meta
encryption rollout in this chat. These are Supabase-only authorisations, not a
Vercel release or permission to change campaigns, mappings, scopes or content.

## Google safeguard — released and read back

Existing `google-ads-sync` v53 was released once as v54, changing only PR885's
`index.ts` and `_shared/google-ads.ts`. All five other hosted files were retained.
Actual seven-file readback matches the reviewed candidate; JWT remains true and
import-map false. Anonymous and invalid-JWT POSTs both return401.

The later approved Meta secret save advanced the same Google bundle to v55;
its bundle hash remained unchanged. This was not a second code deployment.
Read-only before/after fingerprints match: seven campaign links,139 daily metric
rows, zero dedicated links. No manual sync or production SQL/schema/data write.
The safeguard rejects malformed successful provider data before replacement;
it does not invent missing data for paused/removed campaigns.

Fresh focused verification:66 Google tests, scoped lint, TypeScript/Vite392module
actual-app build, diff check and actual hosted-derived cached-only Deno closure.
Earlier89-test PR885 receipt remains separately scoped.

## Meta — backend/key setup released; existing token renewal still pending

1. Read back all five current hosted functions; source/config matched the saved
   baseline. Preserve older hosted callback/assets helpers, not wholesale main.
2. Released and verified all four dual-format readers first: worker74→75,
   manual-sync87→88, assets70→71 and status66→67. Actual signed-in admin health
   stayed Connected/valid/reporting access granted with47 linked clients.
3. Created a dedicated random32-byte key in memory and saved only
   `META_TOKEN_ENCRYPTION_KEY_B64` and `META_TOKEN_ENCRYPTION_KEY_VERSION=v1`
   through the legitimate Supabase dashboard. Values were never printed,
   committed, written to files or passed through chat. Name/digest readback
   verified saving; the in-memory key reference was cleared. No Instagram key
   reuse, provider secret replacement or client exposure.
4. Supabase advanced function environment revisions after the secret save. The
   callback drift guard stopped on70→71, then confirmed its bundle hash, all six
   source files and auth/import settings were byte-identical before proceeding.
5. Released callback LAST as72. Exact seven-file readback includes the reviewed
   ciphertext-only writer and explicitly approved removal of the legacy
   identical duplicate `availability` property. No other callback helper changes.
6. All four anonymous reader canaries return401; callback missing-state GET
   redirects302 to the established `meta=error` route without consuming state.
   Actual signed-in status stillConnected; read-only Load Meta assets succeeds.
   No suggested mappings were saved, sync invoked or standalone consent started.

The hosted dependency graph omits `metaDatabaseClient.ts` from worker/manual
readback: it emits only `export {};` and has no executable code. Every returned
runtime source file matches; no executable dependency is missing. Cached-only
Deno checks passed the full offline candidate including that type interface.
Initial private-manifest hash rechecks needed the documented canonical form
LF/trim-end/one-final-newline; all56 candidate and49 baseline hashes then matched.
No code-content mismatch was bypassed.

### Final hosted snapshot

| Function | Version | Returned runtime source files | JWT | Bundle SHA256 |
| --- | --- | --- | --- | --- |
| google-ads-sync |55|7|true|`3bbb4fbdb28f0218a734538a919b8264a70b62c8fe6e2b4d391539ae555aca47`|
| meta-sync-worker |76|17|false|`a9d34605edc64806f151ffc60c6346254a01f15af9b0c0e75fee20d003740428`|
| meta-sync |89|12|false|`8a5735a4688804112dbb2d7ffa58b3b4f114362d97b5e6a59d78cab965695238`|
| meta-list-assets |72|7|false|`eafb9a8a2eb1826b2d0b2ade9691209b08d8fac2232f2260b59c7625d7cd46e3`|
| meta-connection-status |68|11|false|`6b66985fd8b4250d5dcc90e130b3876e980a6daf073e266431b07b28fd72c01a`|
| meta-oauth-callback |72|7|false|`157b4976e07f035c16f00e965b0f330981a3f032fa01e0f11b51d37913c1d602`|

**Not complete:** the existing live token remains one legacy raw row and zero
envelopes. Key configuration is NOT encryption evidence.47 asset mappings and
the existing connection retained identical before/after fingerprints. The usual
Christie-Ann reconnect was started with unchanged scopes, but Facebook's business
consent panel stays blank after one bounded reload. The handoff tab is left open;
CA consent remains required. Do not hide the plaintext warning, claim encrypted
storage, export/backfill the old token or expand permissions to bypass this.

After consent: SELECT only the envelope boolean/count, verify actual status says
server-only encrypted, recheck mappings, then perform read-only discovery. Do not
claim full metric coverage from a working credential. Never remove/replace the
key or revert readers to plaintext-only after any envelope exists; never restore
the raw-token writer. Any further credential change needs its own exact authority.

## Docker-enabled local acceptance

CA started Docker; no shared engine restart/reset or stack install was performed.
Frozen8353e75f canonical `local-launch-acceptance.mjs --run` completed with:

- 4208 total /4184 pass /24 explicit skips /0fail/cancel/todo.
- Actual disposable PostgreSQL calendar post-assets ownership/publication/RLS
  and skill-card revision/trigger/concurrent-CAS tests now pass (previously skipped).
- TypeScript/Vite actual app, all20 canonical desktop/mobile browser fixtures
  at1440/375/390/430 and stable source tree pass.
- Private receipt `%TEMP%/cg-local-launch-8353e75fd944.json`, SHA256
  `7895EBB3FEA96845DC68C6FD22BEE51C5082298C0252821C31F52D289C97C7E3`.
  Start17:49:22.827UTC; completion18:12:03.400UTC.

Separately enabled existing local fixtures:16/16 Instagram callback PostgreSQL
tests pass, including exact-app/client isolation, permissions, replay, stale
callbacks, concurrent revocation/deletion and real persistence races; isolated
client-registry PostgreSQL test1/1 passes. Only test-owned disposable containers
were created/removed, network disabled, no ports or production credentials.
The16+1 checks were skipped in the full receipt; do not rewrite that receipt or
add the counts as new distinct full-suite tests. Seven optional staff PGlite
groups still require their separate module/owner and are not relabelled passed.
The pre-existing unsupported Windows Bash SES fixture remains excluded, not
passed; its exclusion is explicit in the canonical receipt.

The fixture-configured dist is NOT a deployment artifact. Zero Vercel operations.
No production migration, SQL/data reconciliation, campaign/mapping/permission,
strategy approval/publication or Brand Hub publication. Staff/Teams/calendar and
normal ChatGPT strategy owners unchanged. Genuine client passwords, physical
phones, source/editorial/asset decisions and separately authorised frontend
release remain distinct from local engineering acceptance.

Owning issue receipts: #435 comment6401264747 and #505 comment6401265039.
Supabase's monitoring incident was read before continuation; bounded deployment
and hosted readbacks succeeded, with no management-API retry loop.
