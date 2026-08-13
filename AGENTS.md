# AGENTS.md — CG Dynamics agent instructions

Shared operating instructions for Codex, Claude Code, OpenCode and any other coding agent working in this repo. Read this before making changes.

## Mandatory continuity reads

Before planning or editing code, read:

1. `CONTINUE-HERE.md`
2. `docs/vision/PROJECT-CONTINUITY-HANDOFF-2026-08-13.md`
3. `docs/cg-dynamics-page-vision-and-milestones.md`
4. `docs/current-product-game-plan.md`
5. `docs/vision/CURRENT-MILESTONE.md`
6. the latest relevant open PRs/issues on GitHub

The 2026-08-13 handoff is the current continuity authority. Older handoffs are historical only.

Before changing page behavior, navigation, permissions or product scope, read `docs/cg-dynamics-page-vision-and-milestones.md`. Page contracts override generic product ideas and agent assumptions.

## Product direction

CG Dynamics is the internal operating system for CG Production House. It is replacing Microsoft Teams/Planner for planning, tasks and content scheduling where CG Dynamics is genuinely better. WhatsApp remains the main client communication channel for now.

Three product areas:

- **Client Intelligence** — Clients, Performance, reports, integrations and client-safe projections.
- **Operations Hub** — Hub, Work, Planner, Client Schedule, CG Calendar and team workflow.
- **AI Workforce** — CG Assistant, Marketing/Knowledge and specialist agents grounded in reviewed evidence.

## Source of truth

- **GitHub `main` is the source of truth.**
- **Open PR state is the source of truth for in-flight work.** If a PR already owns the requested area, continue/review it instead of starting a duplicate branch.
- **`monthly_deliverables` is Client Schedule truth.** Do not create a duplicate schedule table.
- **Client Schedule (`/admin/client-schedule`) is the operational content-schedule editing surface.**
- **Client-ready schedule/calendar views are safe projections**, not another editing authority.
- Planner/Work (`planner_tasks`) is separate operational task management.
- One Content Run has one canonical Content Guideline.

## Non-regression rules

Before creating code, check whether the behavior already landed on `main` or is owned by an open PR.

Specifically:

- #176 completed-task authority already landed through PR #188. Do not create competing screen-specific completion rules.
- #177 Outlook duplicate identity architecture already landed through PR #189. Remaining work is controlled production rollout/acceptance, not a new dedupe model.
- Client Portal explicit visibility contract already landed through PR #192. Do not add unsafe fallbacks or infer client visibility from internal status alone.
- #181/#182 responsive/layout/navigation foundation already landed through PR #194. Do not create a second shell/IA system.
- #183/#184 Marketing/Knowledge is currently owned by PR #195. Do not start a parallel Library rewrite.
- Staff invitation lifecycle remains isolated in draft PR #175. Avoid overlapping its auth/invite/user-lifecycle files unless explicitly directed.

## CALENDAR LOCK

CG Calendar and Client Schedule are intentionally separate products.

**CG Calendar (`/admin/cg-calendar`)** is the operational company calendar. It may show meetings, shoots, content runs, client events, deadlines, internal events and intentionally enabled dated Planner tasks.

**Client Schedule (`/admin/client-schedule`)** owns DP/F/Video/Reel/package/posting work from `monthly_deliverables`.

Do NOT:

- inject `monthly_deliverables` into CG Calendar;
- turn CG Calendar into the posting calendar;
- merge CG Calendar and Client Schedule;
- treat missing scheduled posts in CG Calendar as a defect;
- deduplicate Outlook/native events by title alone;
- destructively delete audit/history rows to hide duplicates;
- write back to Outlook/Microsoft;
- redesign Calendar merely because another mission touches UX, responsive layout, Marketing, AI or navigation.

## Workflow rules

- Always run `git status` first.
- Pull latest `main` before starting work.
- Inspect open PRs before creating a branch.
- Use one coherent branch/PR per substantial mission rather than chains of tiny overlapping PRs.
- Inspect the repo before editing. Do not rewrite working business processes without explicit approval.
- Do not duplicate the master schedule, task authority, Marketing Library data model or calendar authority.
- Do not add new production dependencies without approval.
- Preserve safe legacy deep links when consolidating navigation.
- Keep changes shippable and verifiable.

## Agent allocation

CA's preferred workflow:

- Claude Code handles large architecture and substantial product implementation. Give it room to inspect and solve the system rather than micromanaging every file.
- OpenCode handles bounded implementation fixes and isolated tasks.
- Do not launch overlapping broad missions when one large PR is already active.
- Review actual GitHub output before merge advice.

## Data and secrets safety

- Never touch live Supabase data or run SQL against production without explicit user approval.
- A migration file existing on `main` does not mean it has been applied in production.
- Never expose or commit privileged secrets.
- Client-side code only uses public/publishable Supabase settings; privileged operations belong server-side.
- Do not commit ignored environment/build artifacts.
- Never guess a `client_id` UUID.
- Microsoft/Outlook remains read-only upstream unless CA explicitly authorises a future write-back design.

## Production migration guard

Pending calendar/client-portal rollout order:

1. `20260809120000_calendar_outlook_identity.sql`
2. `20260809130000_client_portal_visibility_contract.sql`

Do not apply either without explicit production approval. Do not replay obsolete client-portal phase scripts after the new visibility contract.

## Build and ship

- Build command: `npm run build` (`tsc -b && vite build`).
- Commit and push only if the build passes.
- Vite is pinned to 7.x on purpose. Do not bump to vite 8 without proving the built app bundle is intact.
- Vercel preview success proves branch deployability; it does not prove authenticated product acceptance or production database rollout.

## Security requirements

Before adding tables, RPCs, routes, Edge Functions or Storage:

1. Read `docs/security/SECURITY_ARCHITECTURE.md` and `docs/security/ACCESS_CONTROL_MATRIX.md`.
2. Document the access model.
3. Enable RLS on exposed tables.
4. Add least-privilege policies.
5. Distinguish authentication from authorisation.
6. Use `USING` and `WITH CHECK` appropriately.
7. Never expose service-role credentials.
8. Read roles from `public.profiles.role`, not editable metadata.
9. Test horizontal access.
10. Stop on security-model conflicts rather than guessing.

## Marketing / Knowledge safety

- Source material is not automatically company knowledge.
- AI output is never automatically trusted knowledge.
- Draft, stale and retired knowledge must not ground production answers.
- Client-specific knowledge remains client-isolated and linked by canonical client ID.
- Goldmine/source-pack markdown files are containers; distinct cited sources retain their own provenance.
- Do not ingest copyrighted full text unless rights explicitly permit it.

## Client research workflow

Read `docs/ai-workforce/client-intelligence/CLIENT-RESEARCH-PROGRESS.md` before client research.

Current sequence is complete through HMH Attorneys. Exact next client is **Human Auto**.

Do not begin Human Auto automatically. Ask CA `Human Auto — skip or go?` and proceed only on `go`.

## Reporting

At the end of every task report:

- files touched;
- tests/build;
- production migration/data impact;
- security/role checks;
- browser/device verification actually performed;
- risks/unverified work;
- whether the work overlapped an existing PR;
- exact next step.