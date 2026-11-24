# Guideline preparation and RC discovery — 24 November 2026

Same isolated draft PR1005. No Vercel, migration, package/provider/configuration,
permission, upstream or media change. No production business-data write in this
increment. Other worktrees and the parallel publishing lane remain untouched.

## What actually failed

The company RC-Polypipe ChatGPT conversation searched 24November–15December.
It saw three cancelled 1December bookings and incorrectly concluded there could
be no guideline. The existing undated planning run already held the published
eight-script document. A booking is not required to prepare or share scripts.

Exact client `4f6106de-c437-404e-8cef-fbe848de0665`; planning run
`c705cece-9e5c-4952-b217-73f3f9e5ee96`; canonical guideline
`1f9eab52-8291-4733-bf1e-45e7fd9a0d8b`. Its date/month remain NULL. All three
cancelled bookings remain cancelled. The live no-login capability URL is returned
by `get_content_guideline_share`; it is deliberately not committed here.

## Shared workflow correction

- Existing `ensure_content_guideline` accepts an exact run, an exact saved
  content-run calendar event, or an exact active client and content month.
  Existing documents are reused. A new preparation uses one deterministic
  undated run and the existing canonical actor RPC, with no calendar booking,
  package slot, edit assignment, production folder or posting date inferred.
- Failed ensures can recover using their original exact retry receipt. Concurrent
  calls and lost insert responses reuse the same run/document. Failed month
  writes recover that same workspace; they cannot become a legacy-draft dead end.
- Legacy unassigned guidelines are surfaced for exact selection before creating
  another document. Their missing coverage does not authorize relabelling them.
  Successful receipts, staff wording and published content remain protected.
- Date-filtered discovery preserves `runs` as exact date matches and separately
  returns `undated_preparations`. Its source reads page beyond1000; response detail
  is bounded to25 and explicitly reports truncation. Failed source reads cannot
  turn into a claim that no guideline exists. An unperformed supplemental scan
  has a NULL count. Exact event/deliverable selection cannot substitute a draft.
- Calendar edits remain normal staff/company-admin operations. Client-Project
  guideline work does not grant staff-wide calendar access or impersonate staff.

## Released code and independent acceptance

MCP98 introduced preparation. MCP99 corrected date-filtered discovery. Final
MCP100 fixes interrupted-month recovery; only its owned preparation helper differs
from99. All74 hosted files independently match the final candidate. Bundle SHA256:
`1da6cb62a662e0823aeeae4eeeeab7015df1f433d2d306f7ad3ce256c6edf19d`.
The prior parallel Meta/publishing modules are preserved byte-for-byte; existing
custom OAuth and verify_jwt=false configuration are unchanged.

Actual installed connector, pinned RC client context: the original date range and
exact1December query both return three cancelled bookings plus one separate
undated published guideline with eight videos. A foreign-client request is denied.
The company ChatGPT tool catalogue was refreshed normally. The original blocked
RC conversation then used read-only discovery/share actions and returned the
correct no-login review link; no record was created/restored/edited/republished.
Company Chrome independently renders all eight complete scripts. No client
approval or technical product certification was submitted or inferred.

Final verification:219/219 serial tests across20 focused files, zero failures or
skips, including actual disposable PostgreSQL canonical-RPC/calendar-trigger and
operational transaction tests; final preparation/discovery/catalog checks51/51.
Production build, scoped ESLint, diff check, official Edge Runtime1.74.3 bundle
and native Deno check of the preparation helper pass. Full downloaded-runtime
native checking has the same10 diagnostics as its preimage (missing type-only
support modules); a blanket full-runtime native-check pass is not claimed.

Private rollback sources, all source hashes and logs live under
`C:/Users/chris/.codex/artifacts/guideline-preparation-2026-11-24/`.

## Frontend boundary and remaining work

`src/lib/contentWorkflow.ts` now reuses the calendar trigger's exact existing run
instead of inserting a duplicate and cancelling the genuine event after a unique
conflict. Uncertain reads/writes preserve the booking; accepted inserts are
re-read. Tests exercise the actual function. This form fix is SOURCE-ONLY until
the next authorized frontend release: no Vercel action was performed.

An undated preparation does not itself schedule a shoot or auto-attach a future
booking. Use an actual requested date/time and the existing calendar workflow.
This receipt establishes the guideline repair, not every client's content,
package, consent, source-media or calendar readiness. Earlier exact source and
package holds remain in the active-client production receipt. Google Control
Centre target is still unidentified; no guessed tracker write was made.
