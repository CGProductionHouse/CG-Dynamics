# Continue CG Dynamics Here

Read `docs/ai-workforce/MASTER-AI-TOOLS-AND-WORKFLOW.md` first for cross-project AI/tool/workflow grounding, then `AGENTS.md` and `docs/vision/PROJECT-CONTINUITY-HANDOFF-2026-08-13.md`, followed by the page constitution, current product game plan, current milestone, client research ledger, current `main`, and open PRs/issues.

Use `docs/ai-workforce/AI-TOOLING-MODEL-ROUTING.md` as the detailed provider/model appendix when changing OpenCode/provider configuration.

The 2026-08-13 handoff is current for CG Dynamics. The 2026-08-06 handoff is historical only.

Critical continuity:

- PR #195 owns #183/#184 Marketing/Knowledge; do not create a parallel Library architecture. Reviewed head `0295aa4` has the documented final freshness blocker before merge.
- PR #175 owns staff invitation/auth lifecycle; keep it isolated.
- #176 completed-task authority already landed in PR #188.
- #177 Outlook duplicate architecture already landed in PR #189; remaining work is controlled production rollout/acceptance.
- #181/#182 responsive + navigation architecture already landed in PR #194; do not start another shell rewrite.
- `monthly_deliverables` is Client Schedule truth.
- CG Calendar is the separate operational company calendar. Never inject Client Schedule posts into it or merge the two.
- Pending production migration order: `20260809120000_calendar_outlook_identity.sql` then `20260809130000_client_portal_visibility_contract.sql`; no production SQL without explicit CA approval.
- External AI tools, OpenCode models/providers, shared website bootstrap and agent allocation are tracked in the cross-project master file, not re-decided inside each project.
- Client research is complete through HMH Attorneys; next is Human Auto, only after CA says `go`.

Do not ask CA to explain the project or shared tool workflow again before reading current GitHub continuity state.
