# AGENTS.md — CG Dynamics agent instructions

Shared operating instructions for Codex, Claude Code, OpenCode and any other coding agent working in this repo. Read this before making changes.

## Mandatory continuity reads

Before planning or editing code, read:

1. `CONTINUE-HERE.md`
2. `docs/vision/PROJECT-CONTINUITY-HANDOFF-2026-08-13.md`
3. `docs/cg-dynamics-page-vision-and-milestones.md`
4. `docs/current-product-game-plan.md`
5. the latest relevant open PRs/issues on GitHub

The 2026-08-13 handoff is the current continuity authority. Older handoffs are historical context only.

Before changing page behavior, navigation, permissions or product scope, read `docs/cg-dynamics-page-vision-and-milestones.md`. The page contracts in that document override generic product ideas and agent assumptions.

Before planning or implementing current product work, also read `docs/current-product-game-plan.md`. It is the canonical business-workflow handoff, including Content Guidelines, OneDrive, WhatsApp, Microsoft/package sync, CG Assistant and release-verification requirements.

## Product direction

CG Dynamics is the internal operating system for CG Production House. It is replacing Microsoft Teams/Planner for planning, tasks and content scheduling where CG Dynamics is genuinely better. WhatsApp remains the main client communication channel for now.

Three product areas:

- **Client Intelligence** — Clients, Performance Dashboard, Meta / Integrations, Reports, Client Preview, and the client-ready monthly content calendar.
- **Operations Hub** — CG Hub, Work, Planner, Client Schedule / master schedule, CG Calendar, team workflow.
- **AI Workforce** — CG Assistant, Marketing/Knowledge and specialist agents grounded in reviewed evidence.

## Source of truth

- **GitHub `main` is the source of truth.** Everything worth keeping is committed and pushed; local working environments are ephemeral.
- **Open PR state is the source of truth for in-flight work.** If a PR already owns the requested area, continue/review it instead of starting a duplicate branch.
- **`monthly_deliverables` is the source of truth for the client content schedule.** Do not create a second/duplicate schedule table.
- **Client Schedule (`/admin/client-schedule`) is the operational content-schedule editing surface.** Source: `monthly_deliverables`.
- **The client-ready content calendar is a read-only/client-safe projection** over approved/visible data. It is not another editing authority.
- Planner/Work (`planner_tasks`) is a separate operational task system from Client Schedule and must stay separate.
- One Content Run has one canonical Content Guideline.

## Non-regression rules

### Do not redo solved architecture

Before creating code, check whether the behavior already landed on `main` or is owned by an open PR.

Specifically:

- Completed-task authority for #176 already landed. Do not create screen-specific competing completion rules.
- The responsive/layout and navigation foundation for #181/#182 already landed in PR #194. Do not create a second shell/layout/IA system.
- Client Portal explicit visibility contract landed in PR #192. Do not add unsafe fallbacks or infer visibility from internal status alone.
- Outlook duplicate identity architecture landed in PR #189. Do not invent a second dedupe model.
- Marketing/Knowledge #183/#184 is currently owned by PR #195. Do not start a parallel Marketing Library rewrite while that PR is active.
- Staff invitation lifecycle remains isolated in draft PR #175. Avoid overlapping its auth/invite/user-lifecycle files unless explicitly directed.

### CALENDAR LOCK

CG Calendar and Client Schedule are intentionally separate products.

**CG Calendar (`/admin/cg-calendar`)** is the operational company calendar. It may show meetings, shoots, content runs, client events, deadlines, internal events and intentionally enabled dated Planner tasks.

**Client Schedule (`/admin/client-schedule`)** owns DP/F/Video/Reel/package/posting work from `monthly_deliverables`.

Do NOT:

- inject `monthly_deliverables` into CG Calendar;
- turn CG Calendar into the content posting schedule;
- merge CG Calendar and Client Schedule;
- treat missing scheduled posts in CG Calendar as a defect;
- deduplicate Outlook/native events by title alone;
- destructively delete audit/history rows to hide duplicates;
- write back to Outlook/Microsoft;
- redesign the Calendar merely because another mission touches UX, responsive layout, Marketing, AI or navigation.

Issue #177 code is already implemented through PR #189. Remaining work is controlled production migration/acceptance, not another calendar architecture rewrite.

## Workflow rules

- Always run `git status` first.
- Pull latest `main` before starting work.
- Inspect open PRs before creating a branch.
- Use one coherent branch/PR per substantial mission rather than chains of tiny overlapping PRs.
- Inspect the repo before editing. Do not rewrite working business processes without explicit approval.
- Do not duplicate the master schedule, task authority, Marketing Library data model or calendar authority.
- Do not add new **production** dependencies without approval. Dev-only tooling changes still need a clear reason.
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
- A migration file existing on `main` does **not** mean it has been applied in production.
- Supabase Edge Function secrets, service-role keys, Meta tokens and provider API keys must NEVER be exposed, logged, committed or returned to the client.
- Client-side code only uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Anything privileged belongs in an Edge Function.
- Do not commit ignored files (`.env.local`, `dist/`, `node_modules/`, generated temporary artifacts).
- Never guess a `client_id` UUID.
- Microsoft/Outlook remains read-only upstream unless CA explicitly authorises a future write-back design.

## Production migration guard

The currently pending calendar/client-portal rollout requires this order:

1. `20260809120000_calendar_outlook_identity.sql`
2. `20260809130000_client_portal_visibility_contract.sql`

Do not apply either without explicit production approval. Do not replay obsolete client-portal phase scripts after the new visibility contract.

## Build and ship

- Build command: `npm run build` (`tsc -b && vite build`).
- Commit and push only if the build passes.
- `noUnusedLocals` / `noUnusedParameters` are on — unused code fails the build.
- Vite is pinned to 7.x on purpose: vite 8 (rolldown) previously tree-shook app code out of the production bundle. Do not bump vite to 8 without proving the built bundle contains the app.
- Vercel preview success proves deployability of that branch; it does not prove authenticated product acceptance or production database rollout.

## Security requirements

Before adding tables, RPCs, routes, Edge Functions or Storage:

1. Read `docs/security/SECURITY_ARCHITECTURE.md` and `docs/security/ACCESS_CONTROL_MATRIX.md`.
2. Document the access model for the new component.
3. Enable RLS on every exposed table.
4. Add explicit least-privilege policies.
5. Distinguish authentication from authorisation — never treat `auth.uid()` alone as ownership.
6. Use `USING` and `WITH CHECK` appropriately.
7. Never expose service-role or secret credentials.
8. Do not trust editable user metadata for roles — read from `public.profiles.role`.
9. Test horizontal access between users and clients.
10. Stop and document security-model conflicts rather than guessing.

## Marketing / Knowledge safety

- Source material is not automatically company knowledge.
- AI output is never automatically a trusted source.
- Draft, stale and retired knowledge must not ground production answers.
- Client-specific knowledge must remain client-isolated and linked by canonical client ID.
- Goldmine/source-pack markdown files are containers; registration must preserve distinct cited sources and their provenance.
- Do not ingest copyrighted full text unless rights explicitly permit it.

## Client research workflow

Read `docs/ai-workforce/client-intelligence/CLIENT-RESEARCH-PROGRESS.md` before client research.

Current sequence is complete through HMH Attorneys. Exact next client is **Human Auto**.

Do not begin Human Auto automatically. Ask CA `Human Auto — skip or go?` and proceed only on `go`.

## Reporting (end of every task)

Report:

- files touched;
- build/test result;
- production migration/data impact;
- security/role checks;
- browser/device verification actually performed;
- risks or anything left unverified;
- whether the work overlaps an existing PR;
- exact next step.