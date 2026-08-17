# Agent operating model

How the different agents and connectors are used on CG Dynamics. The point is
to route each job to the tool that does it best, with GitHub `main` as the
shared source of truth.

Current provider/model routing, OpenCode maintenance and the separation between
product AI and development AI are tracked in:

- `docs/ai-workforce/AI-TOOLING-MODEL-ROUTING.md`

Do not treat CG Dynamics runtime AI, OpenCode models and external coding agents
as one system. They have separate permissions, costs and failure modes.

## Which agent for what

| Agent | Best for |
|---|---|
| **Claude Code** | Heavy architecture, substantial multi-file implementation, repo-wide audits and large engineering missions. Give it the product goal and constraints; do not micromanage it file-by-file. |
| **Codex** | Focused implementation/review work when useful and available. Keep tasks tight because usage can be constrained. Reads the mirrored skills in `.agents/skills/`. |
| **ChatGPT** | Business direction, GitHub inspection, prompt control, review, second opinion and continuity across projects. Not the primary code writer for large repo changes. |
| **OpenCode** | Practical workhorse for bounded implementation, routine fixes and continued coding. OpenCode is model/provider-routed; do not equate it permanently with DeepSeek or hardcode one retired model across projects. |
| **Cline** | Additional VS Code coding-agent fallback. Use for continuity or bounded work when it materially helps; it must follow repository instructions and current GitHub state. |
| **Roo Code** | Additional VS Code coding-agent fallback under the same repository/source-of-truth rules. |
| **Google/Gemini tools** | Secondary coding/research option. Keep available, but do not depend on current quota being available for critical coding continuity. |

Rule of thumb: architecture and anything cross-cutting → Claude Code; a
well-defined isolated change → OpenCode or Codex; Cline/Roo Code are fallback
execution paths; direction/review/coordination → ChatGPT. Use the current
model-routing document for OpenCode/provider choice.

## External AI stack vs CG Dynamics product AI

The tools above help **build** CG systems. They are not automatically providers
for the AI features shipped **inside** CG Dynamics.

CG Dynamics product AI includes CG Assistant, AI Workforce/specialist agents and
Marketing AI. Runtime provider/model selection stays server-side and
provider-agnostic and must preserve permissions, client isolation, citations,
review gates and confirmed-write/audit rules.

Never change product AI architecture merely because a desktop coding model is
retired, capped or temporarily unavailable.

## Cross-project reusable website workflow

The external agent stack is also wired into the reusable CG website-building
system. The current reusable-system checkpoints are recorded in
`docs/ai-workforce/AI-TOOLING-MODEL-ROUTING.md` rather than duplicated here.

Important principle: new websites should inherit proven standards, skills,
patterns and bootstrap automation from the Website Builder instead of rebuilding
the same foundation per client. Detailed website implementation history belongs
in the Website Builder/site repositories, not in CG Dynamics.

## OpenCode provider policy

Current user-confirmed direction (17 August 2026):

- keep **OpenCode Zen** as the free/fallback pool;
- use CA's separate **OpenRouter API route** as the primary paid multi-model
  OpenCode route rather than depending on Zen free limits;
- keep **Google** available for now, but CA reports the current caps are too
  restrictive for dependable day-to-day coding;
- consider a dedicated paid Google research/deep-research option later for
  high-volume Media/Marketing Library research only after current product,
  pricing and quota verification;
- curate a small current model selector and hide obsolete/redundant versions;
- when a model reaches end-of-life, refresh the catalogue and replace the dead
  identifier instead of retrying it or redesigning the workflow.

Current OpenCode maintenance procedure and security rules are in
`docs/ai-workforce/AI-TOOLING-MODEL-ROUTING.md`. Never commit provider API keys or
auth tokens.

## Connectors

| Connector | Used for |
|---|---|
| **Teams / Microsoft 365** | Workflow discovery — understanding how the team currently plans in Teams/Planner so CG Dynamics can replace it. Read-only reference, not a live data source for the app. |
| **Supabase** | Verified source-of-truth data work: schema inspection, advisors, logs. Migrations are reviewed before running; secrets never exposed. |
| **Vercel** | Deploy verification and runtime/build logs for the deployed app. |
| **GitHub** | Source of truth for code, branches, PRs and durable continuity. All durable work lands here. |

## Shared instructions and skills

- `AGENTS.md` — shared rules for every agent (product direction, source of
  truth, workflow, secrets, build/ship, reporting).
- `CLAUDE.md` — Claude Code memory; imports `AGENTS.md` and adds Claude notes.
- `.claude/skills/` — skills for Claude Code.
- `.agents/skills/` — mirrored skills for Codex where applicable.
- `docs/ai-workforce/AI-TOOLING-MODEL-ROUTING.md` — current external AI/tool/model
  routing, cross-project agent workflow and maintenance authority.

Core skills include **product-architect** (direction/priority),
**repo-auditor** (health/dead code/duplication), **feature-implementer**
(safe focused features), **client-schedule** (`monthly_deliverables` /
calendar domain), and **agent-reviewer** (pre-merge gate).

## Non-negotiables for every agent

- `git status` first; pull latest `main`; inspect open PRs before starting work.
- Continue an existing PR when it already owns the area; do not create duplicate
  architecture or overlapping broad missions.
- Do not rewrite the app or duplicate the schedule/task/Marketing Library source
  of truth without approval.
- Respect the CG Calendar vs Client Schedule lock in `AGENTS.md` and the current
  continuity handoff.
- `npm run build` must pass (and the bundle must contain app code) before
  commit/push.
- Never expose Supabase Edge Function secrets or external AI provider credentials.
- Report files touched, build result, risks and next steps.
- Cline and Roo Code are fallback agents, not permission to bypass current PR
  ownership, repository instructions or source-of-truth rules.
- If agent/provider/model routing materially changes, update
  `docs/ai-workforce/AI-TOOLING-MODEL-ROUTING.md` so the next agent does not redo
  setup or reintroduce retired models.
