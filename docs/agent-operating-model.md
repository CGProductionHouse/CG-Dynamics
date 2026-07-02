# Agent operating model

How the different agents and connectors are used on CG Dynamics. The point is
to route each job to the tool that does it best, with GitHub `main` as the
shared source of truth.

## Which agent for what

| Agent | Best for |
|---|---|
| **Claude Code / Fable** | Heavy architecture, larger implementation, repo-wide audits, multi-file features, planning. Uses plan mode and the repo skills. |
| **Codex** | Focused implementation, code review, safety/security scans, PR checks. Reads the mirrored skills in `.agents/skills/`. |
| **ChatGPT** | Business direction, quick repo inspection, prompt control, second opinion. Not the primary code writer. |
| **OpenCode / DeepSeek** | Practical workhorse for routine, well-scoped coding tasks when a cheaper/faster pass is enough. |

Rule of thumb: architecture and anything cross-cutting → Claude Code; a
well-defined single change or a review pass → Codex; direction and sanity
checks → ChatGPT; routine grind → OpenCode/DeepSeek.

## Connectors

| Connector | Used for |
|---|---|
| **Teams / Microsoft 365** | Workflow discovery — understanding how the team currently plans in Teams/Planner so CG Dynamics can replace it. Read-only reference, not a live data source for the app. |
| **Supabase** | Verified source-of-truth data work: schema inspection, advisors, logs. Migrations are reviewed before running; secrets never exposed. |
| **Vercel** | Deploy verification and runtime/build logs for the deployed app. |
| **GitHub** | Source of truth for code, branches, PRs and CI. All durable work lands here. |

## Shared instructions and skills

- `AGENTS.md` — shared rules for every agent (product direction, source of
  truth, workflow, secrets, build/ship, reporting).
- `CLAUDE.md` — Claude Code memory; imports `AGENTS.md` and adds Claude notes.
- `.claude/skills/` — skills for Claude Code.
- `.agents/skills/` — the same five skills mirrored for Codex.

The five skills: **product-architect** (direction/priority),
**repo-auditor** (health/dead code/duplication), **feature-implementer**
(safe focused features), **client-schedule** (monthly_deliverables /
calendar domain), **agent-reviewer** (pre-merge gate).

## Non-negotiables for every agent

- `git status` first; pull latest `main`; short focused branches.
- Don't rewrite the app or duplicate the schedule source of truth without
  approval.
- `npm run build` must pass (and the bundle must contain app code) before
  commit/push.
- Never expose Supabase Edge Function secrets.
- Report files touched, build result, risks and next steps.
