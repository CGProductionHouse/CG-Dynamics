# AGENTS.md — CG Dynamics agent instructions

Shared operating instructions for Codex, Claude Code, OpenCode and any other coding agent working in this repo. Read this before making changes.

## Mandatory continuity reads

Before planning or editing code, read:

1. `CONTINUE-HERE.md`
2. `docs/vision/PROJECT-CONTINUITY-HANDOFF-2026-08-13.md`
3. `docs/cg-dynamics-page-vision-and-milestones.md`
4. `docs/current-product-game-plan.md`
5. `docs/vision/CURRENT-MILESTONE.md`
6. `docs/ai-workforce/AI-TOOLING-MODEL-ROUTING.md` when the task involves AI agents, providers, models, research tooling or coding-agent setup
7. the latest relevant open PRs/issues on GitHub

The 2026-08-13 handoff is current. Older handoffs are historical only. Page contracts override generic product ideas.

## Product direction

CG Dynamics is CG Production House's internal operating system. Three product areas:

- Client Intelligence — Clients, Performance, reports, integrations and client-safe projections.
- Operations Hub — Hub, Work, Planner, Client Schedule, CG Calendar and team workflow.
- AI Workforce — CG Assistant, Marketing/Knowledge and specialist agents grounded in reviewed evidence.

## Source of truth

- GitHub `main` is the committed source of truth.
- Open PR state is source of truth for in-flight work. Continue an existing PR when it owns the requested area.
- `monthly_deliverables` is Client Schedule truth; `/admin/client-schedule` is its editing surface.
- Planner/Work (`planner_tasks`) is separate operational task truth.
- One Content Run has one canonical Content Guideline.

## Non-regression rules

Do not redo solved architecture:

- #176 completed-task authority: PR #188.
- #177 Outlook duplicate architecture: PR #189; remaining work is rollout/acceptance.
- Client Portal explicit visibility: PR #192; no unsafe fallbacks.
- #181/#182 responsive/layout/navigation architecture: PR #194; no second shell/IA system.
- #183/#184 Marketing/Knowledge: active PR #195; no parallel Library rewrite.
- staff invitation lifecycle: draft PR #175; avoid overlapping auth/invite/user files.

## CALENDAR LOCK

CG Calendar and Client Schedule are intentionally separate.

CG Calendar (`/admin/cg-calendar`) = operational company calendar for meetings, shoots, content runs, client events, deadlines, internal events and intentionally enabled dated Planner tasks.

Client Schedule (`/admin/client-schedule`) = DP/F/Video/Reel/package/posting work from `monthly_deliverables`.

Do NOT:

- inject `monthly_deliverables` into CG Calendar;
- turn CG Calendar into the posting schedule;
- merge CG Calendar and Client Schedule;
- treat missing scheduled posts in CG Calendar as a defect;
- deduplicate Outlook/native events by title alone;
- destructively delete audit/history rows to hide duplicates;
- write back to Outlook/Microsoft;
- redesign Calendar because another mission touches UX, responsive layout, Marketing, AI or navigation.

## Workflow rules

- run `git status` first;
- pull latest `main`;
- inspect open PRs before creating a branch;
- keep one coherent branch/PR per substantial mission;
- do not duplicate schedule, task, Marketing Library or Calendar authorities;
- preserve safe legacy deep links when consolidating navigation;
- no new production dependencies without approval;
- keep changes shippable and verifiable.

## Agent allocation

CA's preferred workflow:

- Claude Code handles large architecture/substantial implementation; do not micromanage it file-by-file.
- OpenCode handles bounded isolated fixes and is provider/model-routed, not permanently tied to one DeepSeek model.
- ChatGPT coordinates product direction, GitHub continuity, prompts and review.
- Codex is used for focused coding/review when useful and available.
- Do not launch overlapping broad missions.
- Review actual GitHub output before merge advice.

External coding-agent/model routing is **not** the same thing as CG Dynamics runtime AI. Read `docs/ai-workforce/AI-TOOLING-MODEL-ROUTING.md` before changing the coding/research provider stack. Never redesign product AI because a desktop coding model is capped, retired or unavailable.

## Data and production safety

- Never mutate live Supabase or run production SQL without explicit CA approval.
- A migration file on `main` does not prove production application.
- Never expose/commit privileged secrets.
- Never guess a `client_id` UUID.
- Microsoft/Outlook remains read-only upstream unless explicitly redesigned later.

Pending production migration order:

1. `20260809120000_calendar_outlook_identity.sql`
2. `20260809130000_client_portal_visibility_contract.sql`

Do not apply either without approval. Do not replay obsolete client-portal phase scripts afterward.

## Build and security

- `npm run build` = `tsc -b && vite build`.
- Commit/push only if build passes.
- Vite stays 7.x unless the production bundle is explicitly proven after any future change.
- Vercel preview success is not authenticated product acceptance or production DB rollout.
- Before new tables/RPCs/routes/Edge Functions/Storage, read the security architecture/access-control docs, enforce least privilege/RLS and test horizontal isolation.

## Marketing / Knowledge safety

- source material is not automatically company knowledge;
- AI output is not automatically trusted knowledge;
- draft/stale/retired knowledge must not ground production answers;
- client knowledge remains isolated and client-ID linked;
- goldmine/source-pack markdown files are containers; distinct cited sources retain provenance;
- no copyrighted full-text ingestion without explicit rights.

## AI tooling / provider continuity

- Canonical external AI/coding/research tool inventory: `docs/ai-workforce/AI-TOOLING-MODEL-ROUTING.md`.
- OpenCode Zen is the free/fallback pool; CA's OpenRouter API route is the primary paid multi-model OpenCode route unless CA changes this.
- Google remains available as secondary/research tooling, but do not assume its current quota is dependable for critical coding continuity.
- Keep the OpenCode selector curated to a small current working set; do not hardcode retired model IDs across projects.
- Never commit OpenRouter, Google, OpenAI, Anthropic or OpenCode auth secrets.
- If the external agent/provider/model stack materially changes, update the canonical tooling document in the same work.

## Client research

Read `docs/ai-workforce/client-intelligence/CLIENT-RESEARCH-PROGRESS.md` first.

Complete through HMH Attorneys. Exact next client: **Human Auto**. Do not begin automatically; ask CA `Human Auto — skip or go?` and proceed only on `go`.

## Reporting

Report files touched, tests/build, production migration/data impact, security/role checks, browser/device verification actually performed, remaining risks/unverified work, overlap with open PRs and exact next step.
