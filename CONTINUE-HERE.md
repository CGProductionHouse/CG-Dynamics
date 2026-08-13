# Continue CG Dynamics Here

Read these before proposing or changing anything:

1. `AGENTS.md`
2. `docs/vision/PROJECT-CONTINUITY-HANDOFF-2026-08-13.md`
3. `docs/cg-dynamics-page-vision-and-milestones.md`
4. `docs/current-product-game-plan.md`
5. `docs/vision/CURRENT-MILESTONE.md`
6. `docs/ai-workforce/client-intelligence/CLIENT-RESEARCH-PROGRESS.md`
7. current `main`, open PRs and relevant issues

The 2026-08-13 handoff is the current continuity authority. The 2026-08-06 handoff is historical only.

Current active work:

- PR #195 owns #183/#184 Marketing/Knowledge. Continue the same PR; do not start a parallel Library architecture. Reviewed head `0295aa4` still has the documented final freshness blocker before merge.
- PR #175 owns staff invitation/auth lifecycle. Keep it isolated from unrelated work.

Already implemented — do not redo:

- #176 completed-task authority: PR #188.
- #177 Outlook duplicate architecture: PR #189; remaining work is controlled production rollout/acceptance.
- #180 major UX cleanup phases: PR #190/#191; visibility prerequisite PR #192.
- #181/#182 responsive + navigation architecture: PR #194. Remaining work is acceptance/evidence-based defects, not another shell rewrite.
- Client Portal explicit visibility contract: PR #192; production migration remains separate.

Hard locks:

- `monthly_deliverables` = Client Schedule truth.
- CG Calendar = operational company calendar. Never merge it with Client Schedule or inject scheduled content posts into it.
- Do not dedupe Outlook/native events by title alone.
- Do not create a second Marketing Library, task authority or schedule source of truth.
- Do not apply production Supabase SQL without explicit CA approval.
- Pending migration order: `20260809120000_calendar_outlook_identity.sql` then `20260809130000_client_portal_visibility_contract.sql`.

Client research is complete through HMH Attorneys. Next client is **Human Auto**. Do not start until CA says `go`.

Do not ask CA to explain the project again before reading these files and checking current GitHub state.