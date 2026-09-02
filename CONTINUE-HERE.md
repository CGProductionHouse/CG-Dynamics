# Continue CG Dynamics Here

Read `docs/ai-workforce/MASTER-AI-TOOLS-AND-WORKFLOW.md` first for cross-project AI/tool/workflow grounding, then `AGENTS.md` and `docs/vision/PROJECT-CONTINUITY-HANDOFF-2026-08-13.md`, followed by the page constitution, current product game plan, current milestone, client research ledger, current `main`, and open PRs/issues.

Use `docs/ai-workforce/AI-TOOLING-MODEL-ROUTING.md` as the detailed provider/model appendix when changing OpenCode/provider configuration.

The 2026-08-13 handoff is current for CG Dynamics. The 2026-08-06 handoff is historical only.

Critical continuity:

- PR #195 owns #183/#184 Marketing/Knowledge; do not create a parallel Library architecture. Reviewed head `0295aa4` has the documented final freshness blocker before merge.
- PR #175 owns staff invitation/auth lifecycle; keep it isolated.
- #176 completed-task authority already landed in PR #188.
- #177 Outlook duplicate architecture already landed in PR #189; remaining work is controlled production acceptance/resolution.
- #181/#182 responsive + navigation architecture already landed in PR #194; do not start another shell rewrite.
- `monthly_deliverables` is Client Schedule truth.
- CG Calendar is the separate operational company calendar. Never inject Client Schedule posts into it or merge the two.
- Production migration Stage A `20260809120000_calendar_outlook_identity.sql` was applied on 2026-08-19 with explicit CA approval through the authorised Supabase migration mechanism. Post-apply verification: company calendar row count remained 272, complete Outlook identities remained 215, partial identities remained 0, superseded rows remained 0, the supersession RPC/policies/indexes are present, and `planner_tasks_canonical` remains `security_invoker=true`. Do not reapply Stage A or auto-resolve any duplicate.
- Production migration Stage B `20260809130000_client_portal_visibility_contract.sql` was applied on 2026-08-19 with separate explicit CA approval through the authorised Supabase migration mechanism. Post-apply verification: company calendar row count remained 272, all 272 events remained client-internal by default (`client_visible=false`), visible events=0, unaudited/partial visibility rows=0, superseded rows=0, the visibility constraints/index/triggers/RPCs are present, direct client base-table policies remain absent, authenticated users have no direct UPDATE privilege on visibility audit columns, and the capability/portal projection functions are installed. Existing eligible deliverables with client disclosure evidence=0 at rollout, so no historical deliverable became client-visible from prior evidence. Do not reapply Stage B or manufacture visibility evidence.
- The Microsoft reconciliation Apply action remains a separate production data mutation. Stage A/B being live does not authorise applying reviewed Microsoft changes or resolving duplicates. Re-open/refresh `/admin/microsoft-import`, verify the migration guard is gone and the reviewed safe-change set/count is still truthful before any explicit Apply approval.
- Client Calendar event visibility is now explicit manager/admin opt-in only; Outlook events remain internal by default. Do not bulk-publish historical events.
- External AI tools, OpenCode models/providers, shared website bootstrap and agent allocation are tracked in the cross-project master file, not re-decided inside each project.
- Client research is complete through HMH Attorneys; next is Human Auto, only after CA says `go`.

Do not ask CA to explain the project or shared tool workflow again before reading current GitHub continuity state.

## Current Active Work

### Issue #208: CG Assistant V2 — The Main Operating Remote
- **Branch**: `fix/assistant-v2-mobile-regressions` (PR #212)
- **Status**: Multi-action composition complete, 1740 tests pass, build passes
- **Completed**: Mobile UX hardening, grounded query handlers, deterministic action parser, model-backed intent extraction, extended entity context, multi-action composition
- **Next**: Test in production, add more compound action examples, consider deterministic parser compound support

### Issue #196: Control — V2 Actions
- **Status**: All V2 action features complete (query handlers, grounded queries, semantic intent extraction, extended entity context, multi-action composition)
