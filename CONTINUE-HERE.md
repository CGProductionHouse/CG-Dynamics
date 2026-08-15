# Continue CG Dynamics Here

Read `AGENTS.md` and `docs/vision/PROJECT-CONTINUITY-HANDOFF-2026-08-13.md` first, then the page constitution, current product game plan, current milestone, client research ledger, current `main`, and open PRs/issues.

The 2026-08-13 handoff is current. The 2026-08-06 handoff is historical only.

Critical continuity:

- PR #195 owns #183/#184 Marketing/Knowledge; do not create a parallel Library architecture. Reviewed head `0295aa4` has the documented final freshness blocker before merge.
- PR #175 owns staff invitation/auth lifecycle; keep it isolated.
- #176 completed-task authority already landed in PR #188.
- #177 Outlook duplicate architecture already landed in PR #189; remaining work is controlled production rollout/acceptance.
- #181/#182 responsive + navigation architecture already landed in PR #194; do not start another shell rewrite.
- `monthly_deliverables` is Client Schedule truth.
- CG Calendar is the separate operational company calendar. Never inject Client Schedule posts into it or merge the two.
- Pending production migration order: `20260809120000_calendar_outlook_identity.sql` then `20260809130000_client_portal_visibility_contract.sql`; no production SQL without explicit CA approval.
- Client research is complete through HMH Attorneys; next is Human Auto, only after CA says `go`.

Do not ask CA to explain the project again before reading current GitHub continuity state.