# Brand Hub logo pilot and file-access repair — 20 October 2026

Client lane #396/#668; supervisor #381. ZERO Vercel operations.
This receipt supersedes the all-disabled state only for the single approved
Braize logo pilot; the other57 libraries remain private.

## Owner-approved production scope and result

CA approved publication of only Braize's visually verified BRAIZE_01.png,
enablement of only Braize, and view/download testing. Used the real signed-in
admin workflow, not SQL writes. Source matched the exact durable portal item
and was visually reviewed before publication. Display name: Braize logo.

Read-only stored-state acceptance:58 libraries, exactly1 enabled, exactly1
active asset, no assets/enabled libraries for other clients. File267992bytes,
image/png; exact asset/client/library relationship and publishing actor/time
recorded. No OneDrive file copy/move/share/permission, schema/RLS/grant, credential
or other-client write. No historical/source/raw tree publication.

The pilot reproduced a real failure: listing succeeded, but View/Download
showed File access failed. Read-only browser response inspection found HTTP200
with a grant pointing to the Edge gateway's rewritten internal HTTP
/client-onboarding URL rather than the external HTTPS /functions/v1 endpoint.
The strict frontend transport validator correctly refused it. No grant
signature, browser session, provider token or privileged key was exported.

CA then separately approved ONLY the tested public-file-link backend repair.
Existing client-onboarding deployed once: v46 -> v47, ACTIVE,
verify_jwt=false preserved with existing internal active-profile/role checks.
Only index.ts and portal-library-stream.ts changed. All eight other hosted
files were preserved, not replaced from local main. Full ten-file hosted
readback equals the frozen release after newline normalization.

## Scope and rollback discipline

The link builder now uses the server's existing SUPABASE_URL, never request.url,
forwarded headers or a browser-provided host. HMAC asset/purpose/expiry checks,
one-hour TTL, exact-client/root ancestry checks and streaming remain unchanged.
Configured public gateways reject credentials, path/query/fragment and insecure
non-loopback HTTP; explicit loopback HTTP remains available for local fixtures.
No dependency, auth setting, secret/config, schema or permission change.

Reviewed runtime13fa5fcbb8431e7c3bbe25e451dcdf8747bb020b:
- index.ts Git blob71a5864bd73d8cc8876a658b42f4e1ee098d3aea
- portal-library-stream.ts Git blob1705d30f5250c6c0b44293d2301cbc827e39cb05

Released normalized SHA256 (LF, trimEnd):
- index.ts6f5458805c8f6c3659b4a60953474b82d36c4272e78495fad69bb6fc2a99eb0b
- portal-library-stream.ts83f4266837d3616429af34e73ff8df608adc1c71671f7649d35d821b917b2062

The hosted onedrive-token-store.ts is the older already-released helper, not
main's d72cbcd1 pending-consent hardening. It was deliberately preserved because
this approval covers two media-link files only. The separately deployed OAuth
functions retain their own hardened closures. Do not blindly deploy all of
current main's transitive files under this two-file approval.

Private local rollback closure:
C:/Users/chris/AppData/Local/Temp/cg-onboarding-hosted-20261020/
Release closure:
C:/Users/chris/AppData/Local/Temp/cg-onboarding-media-release-20261020/
These contain code only, no secrets; no Vercel artifact. Content rollback is
the existing non-destructive Hide file/Hide library, not audit deletion.
Neither rollback was needed or executed.

## Actual live acceptance

After release, the real signed-in read-only admin client preview:
- freshly lists Braize logo with one published brand file;
- loads a170x176 thumbnail;
- opens the real4220x4341 PNG in a separate tab;
- downloads BRAIZE_01.png,267992bytes, with Dynamics still open.

Live unauthenticated asset request401; invalid HMAC grant403.
RLS stays enabled for libraries/categories/assets/token store, with no direct
anon/authenticated SELECT and no authenticated INSERT/UPDATE/DELETE.
No synthetic client login or impersonation. This is actual admin-preview PNG
acceptance, NOT genuine client-password acceptance, MP4/range playback or
all-client file rollout. CA retained password tests.

The Graph-provided staff Review source file link landed on OneDrive home.
Used OneDrive's exact-name search and matched durable item before visual review;
no guessed URL fix or permission change. Existing unrelated Brand foundation
details unavailable message remains separate from the working file library.

Local screenshots:
- cg-braize-logo-pilot-review-20261020.png (source)
- cg-braize-pilot-access-20261020.png (reproduced failure)
- cg-braize-pilot-working-20261020.png (working thumbnail/actions)
All remain in the user's Temp folder, not committed as public client assets.

## Real automatic OneDrive renewal

Before normal admin read, access expiry19Oct12:45:57.617Z, last update11:45:58.619Z.
The20Oct admin folder read succeeded without reconsent and automatically renewed:
updated07:19:53.508Z, access expiry08:19:52.507Z, encrypted access=true,
refresh=true, pending=false. Selected presence flags/timestamps only.
This proves that real next-day renewal, not an indefinite future guarantee.
No rotation, token/ciphertext copying or direct token-store mutation.

## Local client file recovery changes (NOT deployed to frontend)

The same focused branch also fixes two actual-component regressions:
1. download opens safely with _blank/noopener/noreferrer even when an expired
   broker grant returns an error page, retaining the portal;
2. native video load failure removes the broken player and exposes explicit
   Play-to-retry recovery, with no background retry loop.

Existing desktop design, canonical Calendar links and exact-client request
fencing remain unchanged. Browser regression first failed on old code for
both defects, then passed after the bounded component changes. Synthetic
loopback fixture now uses a browser-safe port and intercepts the new tab too.
No production request or credentials enter those tests.

## Verification and limits

Focused suite44/44 pass, no skips/failures. Fresh npm run build passes
(TypeScript, Vite7.3.6, actual app JS); scoped ESLint and git diff --check pass.
Deno check passes for the exact staged ten-file hosted release.

Canonical full attempt28b274d8:3964pass/7fail/17skip.
Two failures were unavailable/unresponsive local Docker SQL fixtures; five
were missing OpenSSL on PATH. Kept the failed receipt, did not weaken assertions.
Installed Git OpenSSL added only to the test process PATH; both crypto files
rerun18/18pass. Docker Desktop started once, but its engine did not answer;
no shared-engine restart/reset, cleanup or peer disruption.

Separate sanitized NON-DB local run13fa5fcb:
3991total /3972pass /19explicit skips /0fail/cancelled/todo.
Two SQL fixtures deliberately NOT accepted, plus17 pre-existing declared skips.
The unsupported Windows Bash SES fixture remains excluded, not passed.
All19 canonical browser journeys, TypeScript and actual Vite app bundle pass;
receipt cg-client-nondb-13fa5fcb.json, stable_tree=true. This is explicitly
NON_DB_LOCAL_CHECKS_PASS, NOT the canonical LOCAL_CODE_ACCEPTANCE_PASS.
The browser harness retains portable default launch behavior; only the local
CG_PLAYWRIGHT_MODULE wrapper selects installed Chrome (no browser download).
After the final launcher-only adjustment and non-overlapping PR852 integration,
fresh verification passes:62/62 focused+integration tests, four-width library
browser journey, npm build, current and exact staged Deno closure, scoped lint
and diff check. Actual emitted app JS is present. No staff implementation edited.
No whole local/production launch certificate from this reduced-scope evidence.

Staff/Teams peer observed clean4f045c5f, untouched. Later main PR852 changes only
Microsoft automatic-reconciliation.ts and its test; no overlapping client file.
Existing onboarding843/851/850/775/662/618 and guideline842 owners preserved.
Exact Google Control Centre reference remains inaccessible, no guessed tracker.

## Remaining separately governed work

Other57 libraries are privately linked, not published/enabled by this pilot.
Reviewed exact current assets and client media/recipient acceptance are required
before expanding rollout. Normal ChatGPT retains strategy authorship/publication
lane; staff agent retains Teams/calendar. Genuine client-password/phone review,
MP4/range/expiry and cross-client credential tests are not inferred from admin
preview. No Vercel release or fixture-dist upload under this mission.

GitHub live receipts: #396comment6286208060, #668comment6286208047,
#381comment6286208037. Final PR/verification close-out follows.

Reviewer checklist verdict: approve this focused code/receipt change; no blocking
correctness, scope, security or source-of-truth finding. Runtime changes are one
client component and two existing backend files; regression changes are one
existing browser fixture and two test files; continuity is this receipt and the
ops handover. No ignored build/config/client asset or privileged value included.
The explicitly unverified database/client-role/cohort gates above remain, not
waived by code review. Frontend recovery changes await a separate hosting release.

