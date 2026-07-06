# AGENTS.md — CG Dynamics agent instructions

Shared operating instructions for Codex, Claude Code and any other coding
agent working in this repo. Read this before making changes.

Before changing page behavior, navigation, permissions or product scope, read
`docs/cg-dynamics-page-vision-and-milestones.md`. The page contracts in that
document override generic product ideas and agent assumptions.

## Product direction

CG Dynamics is the internal operating system for CG Production House. It is
replacing Microsoft Teams/Planner for planning, tasks and content scheduling.
WhatsApp remains the main client communication channel for now.

Three product areas:

- **Client Intelligence** — Clients, Performance Dashboard, Meta / Integrations,
  Reports, Client Preview, and the client-ready monthly content calendar.
- **Operations Hub** — CG Hub, Daily Tasks (Command Centre), Planner Board,
  Client Schedule / master schedule, CG Calendar, team workflow.
- **AI Workforce** — CG Assistant and future AI agents. Do NOT build
  speculative AI agents before the core data and workflow are stable.

## Source of truth

- **GitHub `main` is the source of truth.** Everything worth keeping is
  committed and pushed; the working container is ephemeral.
- **`monthly_deliverables` is the source of truth for the client content
  schedule.** Do not create a second/duplicate schedule table.
- **Client Schedule (`/admin/client-schedule`) is the operational master
  schedule** and the only place schedule edits happen. Source: `monthly_deliverables`.
- **The client-ready content calendar (`/admin/client-calendar`) is a
  read-only presentation layer** over the same data. It never writes.
- Planner Board (`planner_tasks`) is a separate operational system from Client
  Schedule and must stay separate.

## Workflow rules

- Always run `git status` first.
- Pull latest `main` before starting work.
- Use short, focused branches (one concern per branch).
- Inspect the repo before editing. Do not rewrite the app without explicit
  approval.
- Do not duplicate the master schedule source of truth.
- Do not add new **production** dependencies without approval. Dev-only tooling
  changes still need a clear reason.
- Keep changes small and shippable.

## Data and secrets safety

- Never touch live Supabase data or run SQL against production without explicit
  approval. SQL migration files are reviewed in the Supabase SQL editor first.
- Supabase Edge Function secrets (service-role keys, Meta tokens, provider API
  keys) must NEVER be exposed, logged, committed or returned to the client.
- Client-side code only uses `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY`. Anything privileged belongs in an Edge
  Function.
- Do not commit ignored files (`.env.local`, `dist/`, `node_modules/`,
  generated import artifacts).
- Never guess a `client_id` UUID. Link clients only on an explicit user save.

## Build and ship

- Build command: `npm run build` (`tsc -b && vite build`).
- Commit and push only if the build passes.
- Note: `noUnusedLocals` / `noUnusedParameters` are on — unused code fails the
  build.
- Vite is pinned to 7.x on purpose: vite 8 (rolldown) silently tree-shook all
  app code out of the production bundle. Do not bump vite to 8 without
  verifying the built bundle actually contains app code.

## Reporting (end of every task)

Report back:

- files touched
- build result
- risks / anything left unverified
- next steps
