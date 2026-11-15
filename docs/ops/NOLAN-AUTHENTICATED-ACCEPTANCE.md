# Native Nolan overview: authenticated acceptance checklist

Local candidate, not a production acceptance receipt. No credentials or sessions
are stored in this document. Use existing authorized sessions, never impersonation
or changes to role/security settings just to complete a test.

## Before release

- Record current main/candidate SHA and existing #679 hosting approval/budget.
- Preserve external pinned Site until the native destination is proven.
- Run local build, lint and regression tests; record actual command results.
- Identify existing authenticated admin/manager test account and separately an
  authorized staff/client test session. If unavailable, mark that role untested.
- Do not load raw internal task data into unauthenticated preview/screenshot pages.

## Browser acceptance matrix

1. Manager/admin: direct `/admin/work?tab=nolan` opens native Dynamics shell and
   liked board design. Check 360px, 768px, 1024px and wide desktop host widths.
   All nav remains reachable; no sideways clipping or conflicting fixed sidebar.
2. Keyboard: reach nav, filter, refresh and disclosures; visible focus and logical
   headings; expanded details and errors readable without relying on badge colour.
3. Staff/client: same URL must fall back to existing allowed view / route access.
   No Nolan data requests or privileged data exposure. Existing RLS remains enforced.
4. Pick one already-existing canonical task, video and monthly deliverable. Compare
   exact source ID/status/owner to existing source screens. Follow source link.
   Use an explicitly authorized reversible test edit only if independently approved;
   otherwise record edit/readback untested. Never mutate production to prove UI.
5. Switch months during slow network. Old data never relabelled as new month; switch
   again before completion and verify late first response ignored.
6. Simulate source failures locally (no production outages induced). Verify explicit
   errors, no healthy/complete claim, no old data labelled fresh, recovery on refresh.
7. Verify records beyond one page and late-page errors against a controlled local
   fixture. Actual production total must be independently reconciled before 'all'.
8. Package evidence disclosure: opens lazily, preserves confirmed/conflict/unknown,
   no payment/period-authority claim from current settings; actual-posted reconciliation
   remains clearly incomplete.
9. Master schedule is responsibility navigation, not fabricated live task statuses.
   Assigned to you is signed-in ownership, not the former manually curated CA queue.
10. Website registry endpoint absent: gap remains explicit. No token bridge, iframe,
    permission grant or silent list of four sites pretending to cover the fleet.

## Current gaps

Authenticated browser/role/visual/edit-readback acceptance has NOT been performed.
Full website inventory, external GitHub app milestone inventory, historical paid
entitlement and deduplicated actual-posted reconciliation remain open work.
