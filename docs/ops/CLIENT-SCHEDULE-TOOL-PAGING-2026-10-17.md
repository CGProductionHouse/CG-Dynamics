# Client Schedule connector paging — 17 October 2026

Owner #668/#623; source base `a12c125b` after #836. This is a source-only MCP
repair, not an Edge release, new scheduler, calendar merge or posting backfill.

## Reproduction

The actual `list_client_schedule` handler always applied `limit(50)` and returned
no continuation or coverage information. A deterministic 117-row same-date fixture
reproduced the missing continuation; two new regression groups failed on main.
The bounded live Oct–Nov read happened to return five dated rows, so that live
result was below the cap. No production truncation of those five is claimed.

## Bounded additive contract

- Existing dates, exact client filter, verified FK/name shaping, role/context
  pinning and caller-scoped Supabase/RLS authority are unchanged.
- Default page remains 50. Optional integer `offset` starts at0. The query orders
  by scheduled date then unique ID and requests 51 rows, not an unbounded scan.
- `pagination` returns page size, returned count, `has_more` and `next_offset`.
  Total count remains null, never an inferred fleet total. Caller follows pages
  with unchanged date/client scope. Empty success differs from missing/failed data,
  whose coverage is null/unknown with a sanitized error and no partial rows.
- Offsets outside0–100000 fail before a query. At the safety cap a further page
  keeps `has_more=true`, sets `continuation_blocked=NARROW_DATE_RANGE` and does not
  pretend completion. A date change during paging requires restarting; this is
  stable ordering, not an atomic snapshot guarantee.
- Tool description/result explicitly say these are **scheduled-date rows only**.
  Undated/legacy due-date-only work is excluded, not silently certified absent.
  CG Calendar and `planner_tasks` stay separate; no scope/visibility/date writes.

## Verification

-44focused tests PASS: actual handler retrieves all117rows in3pages without
  duplicates, checks 51-row bounds/tie ordering/exact-client filter/flattening,
  unknown/error/empty, invalid input, safety cap and existing catalog/security/
  calendar separation contracts. Initial Deno join inference error was repaired
  with an actual unknown-value/record guard, not an unchecked cast.
- `npx --no-install deno check --cached-only --no-lock` for the actual MCP closure PASS.
  No new package or remote dependency download. Deno generated an untracked lock
  during checking; that task-generated file was removed, no dependency change.
- Local build/app chunks/scoped ESLint/diff PASS; frontend runtime is byte-for-
  byte source unchanged from #836, whose15canonical browser fixtures all passed.
  Those fixtures were not redundantly rerun for this Edge-only change. No actual
  updated connector/browser acceptance or client-role production pass claimed.
- Full supported suite:3933total/3914pass/19intentional skips/0fail, no cancelled
  or todo tests. Two optional Docker/Postgres checks skipped; unsupported Windows
  Bash SES fixture excluded, not passed.
  Log in workstation Temp: `cg-schedule-tool-page-full-suite.log`.

No production SQL/data/schema/Edge/config/secret/provider/OAuth/permissions,
strategy/asset approval/publication, Vercel or Microsoft writes. #679 freeze and
automatic Git-deploy guard remain intact. The MCP change requires a separate
exact approved release; existing runtime still has its old cap. Open775/662/618
remain untouched. Fresh connected Drive Control Centre search returned no exact
tracker; a native-spreadsheet name filter for Control/control returned no results.
No guessed/replacement spreadsheet or writes to unrelated search results.

## Saved strategy checkpoints during this code lane

Normal company **Write Client Strategies** continued the one existing queue.
Checkpoint1#731comment6237985383: Bouwer, SecuriForce, TBS, SupaQuickBFN and Peyper;
7newdraftmonths,3acceptedNovember drafts retained. Checkpoint2comment6238151225:
C&L, BloemActionSports, Germoparts, CG and Emmanuel;6newdraftmonths,4accepted
November drafts retained. Fresh supervisor readbacks independently confirm all
20current IDs/versions, unpublished status, selected tests/plans and concept counts.
Full before/after/unselected-preserved comparisons remain writer-attributed.
Exact receipt: `strategy-review/2026-10-17-normal-chat-remaining-checkpoints.json`.
The continuing cursor is The Staffordshire; no queue exhaustion inferred yet.

These drafts use their actual prior windows (Emmanuel ends30September, others as
returned), not invented October results or guaranteed sales. JFJ/VCS known scope
is retained without requesting it again. Held source/package decisions and Human
Auto skip/go remain; no new task/automation, paid generator or auto-publication.
