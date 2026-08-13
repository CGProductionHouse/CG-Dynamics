# Continue CG Dynamics Here

For any new ChatGPT, Claude Code, Codex, OpenCode or other agent session, read these **in this order** before proposing or changing anything:

1. `AGENTS.md`
2. `docs/vision/PROJECT-CONTINUITY-HANDOFF-2026-08-13.md`
3. `docs/cg-dynamics-page-vision-and-milestones.md`
4. `docs/current-product-game-plan.md`
5. `docs/vision/CURRENT-MILESTONE.md`
6. `docs/ai-workforce/client-intelligence/CLIENT-RESEARCH-PROGRESS.md`
7. the latest relevant open PRs and issues on GitHub

The **2026-08-13 handoff is the current continuity authority**. The older `PROJECT-CONTINUITY-HANDOFF-2026-08-06.md` is historical only.

## Current active work

- **PR #195** owns #183/#184 Marketing/Knowledge. Continue/review the same PR; do not create a parallel Library architecture. Reviewed head `0295aa4` still needs the final cross-consumer freshness fix before merge.
- **PR #175** owns staff invitation/auth lifecycle. Keep isolated from unrelated work.

## Already implemented — do not redo

- #176 completed-task authority: PR #188.
- #177 Outlook duplicate architecture: PR #189; remaining work is controlled production rollout/acceptance.
- #180 major UX cleanup phases: PR #190/#191; visibility prerequisite PR #192.
- #181/#182 responsive + navigation architecture: PR #194. Remaining work is authenticated acceptance/evidence-based defects, not another shell rewrite.
- Client Portal explicit visibility contract: PR #192; production migration remains separate.

## Hard locks

- `monthly_deliverables` = Client Schedule truth.
- CG Calendar = operational company calendar. Never merge it with Client Schedule or inject scheduled content posts into it.
- Do not dedupe Outlook/native events by title alone.
- Do not create a second Marketing Library, task authority or schedule source of truth.
- Do not apply production Supabase SQL without explicit CA approval.
- Pending migration order is `20260809120000_calendar_outlook_identity.sql` then `20260809130000_client_portal_visibility_contract.sql`.

## Client research

The canonical ledger is `docs/ai-workforce/client-intelligence/CLIENT-RESEARCH-PROGRESS.md`.

Completed through HMH Attorneys. Next client: **Human Auto**. Do not start until CA says `go`.

Do not ask CA to explain the project again before reading these files and checking current GitHub state.