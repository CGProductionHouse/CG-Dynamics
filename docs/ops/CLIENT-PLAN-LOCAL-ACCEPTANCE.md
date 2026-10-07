# Client Plan / published guidelines: local-only acceptance

Owning lane: #668, existing PR #674. No deployment or production-write mode.

## Reproduction and correction

Three executable reader regressions failed against the old direct cast: malformed
responses became successful empty state, private extra fields were retained, and
wrong-month rows were accepted. Existing RPC authorization is still the exact-client
security boundary; transport projection is defence in depth, not substitute RLS.
The reader preserves canonical script nulls and full ordered text. It rejects mixed
valid/invalid envelopes instead of silently displaying partial corrupted guidance.

The actual Plan page now keys only its read panel by client/month/tab. An in-flight
new scope cannot render the preceding scope's scripts under a new working month.
All three tab controls fit at 375px rather than clipping the third tab.
Null or blank scripts render an explicit unavailable statement, not a misleading
“Complete script” heading over empty space; no replacement script is invented.

## Executable browser check

Use the existing approved Playwright installation (no dependency install):

```powershell
$env:CG_PLAYWRIGHT_MODULE='C:/Users/chris/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
node scripts/client-plan-readonly-browser.mjs
```

This renders the actual components with synthetic authenticated-role/context fixtures
and localhost-only mocked reads. It does not access a real session, Supabase project,
provider or client. Unexpected network/RPC calls fail assertions. No write fixture
exists. The test covers desktop 1440px and mobile 375/390/430px, full scripts,
month/client transitions while reads are deliberately held, unavailable vs empty,
tab bounds/text, body overflow and page runtime exceptions. PNG screenshots go to
the OS temporary directory as `cg-plan-{width}.png`.
It also renders the actual desktop month grid/mobile agenda with synthetic planned
content and a published-guideline event. Clicking that event preserves exact preview
client, working month and opaque guideline key; the corresponding full script renders.
Calendar PNGs are `cg-plan-calendar-{width}.png`. This does not establish a portal
asset link for scheduled posts: that separate canonical linkage remains outstanding.

## Verification boundaries

123 focused tests pass across published guidelines, full-preview scope, Plan,
Content Guideline usability/Creative Intelligence/workflow and calendar release.
Full supported suite: 3,634 tests, 3,617 pass, 17 intentional skips, zero failures.
The Bash-only SES shell test is excluded on this Windows environment, not called
passed. Existing Git OpenSSL is placed on PATH for executable SES trust fixtures.
TypeScript/Vite build, scoped lint and diff check pass locally.

These results are NOT authenticated production acceptance, substantive strategy
approval, research knowledge activation, or proof that scheduled posts have exact
portal assets. Those require their canonical contracts/evidence. Keep Vercel Git
deployment disabled, do not deploy or apply migrations, and preserve all protected
gates. Nothing here writes guidelines, schedules, strategies, packages or reports.

## Brand Hub / Library follow-through — 4 October

Two executable malformed-envelope regressions reproduced the existing library
reader accepting null/missing evidence as successful reads. The reader now validates
the existing server projection: exact category, published asset identity, calendar
month, timestamp, bounded pagination and consistent observed counts. Missing,
invalid or conflicting evidence fails unavailable; verified zero and nullable file
size remain distinct. Only the existing public projection fields survive. Existing
Edge authorization remains the exact-client security boundary, not this validator.

The actual flat Brand Identity section also reproduced a silent HTTP read failure.
It now renders loading/error truth and clears the error after a successful retry.
“View in Plan” opens Calendar rather than Strategy, preserving the exact preview
client and canonical linked month. No title-matching or inferred post identity is used.

```powershell
$env:CG_PLAYWRIGHT_MODULE='C:/Users/chris/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
node scripts/client-library-readonly-browser.mjs
```

Actual-component localhost-only fixture passes 1440/375/390/430px: unavailable vs
verified-empty, flat category error/retry, malformed files/retry, exact scoped
Calendar link, four read calls only per viewport, no body overflow or captured
runtime errors. Screenshots: OS temporary directory `cg-library-{width}.png`.
375px screenshot visually inspected. This is not authenticated production acceptance.

Focused combined suite: 133 PASS. Full supported suite: 3,637 total /3,620 PASS /
17 intentional skips /0 fail. The same Bash-only Windows exclusion above applies.
TypeScript/Vite build, scoped lint and diff check PASS. Existing large-chunk build
warning remains; it is not a new failure. No new dependency, schema, Edge action,
RLS/grant, provider call, production write or Vercel operation.

Reverse Calendar post-to-exact-published-asset navigation remains outstanding:
the current server contract exposes an opaque calendar row key and the library's
linked month/title, not their shared public identity. Do not manufacture a link
from titles or expose raw OneDrive IDs. This needs a separately verified canonical
server projection before release; today's correction does not claim it solved.

## 7 October — exact published post files and reader hardening

The previous reverse-link CODE gap is now implemented locally, not production-live.
`client_portal_post_assets(client UUID, month date, opaque post key)` explicitly
executes the existing month-post ownership/visibility authority, then joins the
exact deliverable to its published, active portal assets and verified enabled
library/category/drive/folder boundary. At most 24 public final-file metadata rows
are returned, with no internal drive/item/path, provider URL or private text.
Same title is never an association. Existing calendar RPCs, RLS/table grants,
scheduling and publication semantics are unchanged. New additive migration:
`20261007100000_client_portal_post_assets.sql` — **UNAPPLIED**.

Calendar post disclosures reuse the existing file opener, not a second portal.
Reads are lazy and scope-keyed by client/month/post. Null/malformed/foreign-month
responses stay unavailable; an explicit empty array alone means no linked files.
Missing migration/auth stays unavailable without falling back to direct tables.
Files remain reauthorized by the existing Edge boundary when opened. There is no
publish, share, mapping, copy, approve or scheduling control in this disclosure.

Two other defects were reproduced: timestamps without offsets/24:00/reversed event
ranges entered the calendar; leaving Files during a pending View still opened the
departed client's response. Strict timestamp validation preserves valid offsets;
file access now fences unmount/scope and duplicate pending actions. Access transport
validation accepts only the exact existing signed broker URL, asset, purpose and
one-hour expiry contract; malformed/external/duplicate query evidence fails closed.
This is defence in depth, not a new authorization system.

Commands: the two browser commands above; focused `node --test` on
clientCalendarPostAssets, clientPortalLibrary, clientPortalLibraryTruth,
clientPortalVisibilityContract, clientPortalPreview, clientPlanPass2,
clientPublishedGuidesTruth and hostingBudgetPolicy. Set `CG_RUN_LOCAL_DB=1` for the
disposable PostgreSQL acceptance. It uses an already installed `postgres:17-alpine`
image, `--pull=never`, no network/host ports, tmpfs data, synthetic identities and
removes only its own container in `finally`. Never point these fixtures at production.
The actual historical visibility function and foundation migration are executed,
not replaced by a mocked authorization function. This is NOT a full production
migration replay or proof that production prerequisites have been applied.

91 focused tests PASS including executable SQL ownership/publication/access checks.
Integrated full supported suite: 3,642 total /3,625 PASS /17 intentional skips /
zero failures, with `CG_RUN_LOCAL_DB=1` so the new disposable SQL acceptance ran.
The Windows Bash-only SES fixture remains explicitly excluded, not passed.
TypeScript/Vite build, scoped ESLint and diff check PASS; existing bundle-size
warning unchanged. Projection-only Fast Refresh lint finding was corrected by
keeping the pure projection in the existing TypeScript projection module.
Local actual-component checks PASS 1440/375/390/430: exact post file rendering,
unavailable versus empty/retry, full guideline navigation, held-read month changes,
valid broker opening, malformed refusal and departure-response fencing. No body
overflow or captured page runtime exceptions. Desktop calendar narrow-cell file
layout is compact to avoid clipping controls/titles. 375px screenshot visually
inspected. Screenshots: TEMP/cg-plan-calendar-{width}.png, cg-library-{width}.png,
cg-library-departed-{width}.png. These remain synthetic, not authenticated live checks.

Release prerequisites: review/apply only the new migration through its separate
protected gate; deploy the already-pending Brand Hub exact-preview Edge seam;
retain the signed file broker and verify real published final assets. Rollback of
this additive reader is to remove only its new function (separately authorized);
the old calendar continues and the new disclosure reports unavailable. No existing
table/history or calendar function must be dropped/replayed. With zero published
production portal assets observed on 7 October, code alone cannot populate files.
Strategy quality/approval/publication, research runtime and authenticated full-role
release acceptance remain separate requirements, not solved by a file button.
