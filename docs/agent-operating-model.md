# Agent operating model

How the different agents and connectors are used on CG Dynamics. GitHub `main` is the shared source of truth.

Cross-project authority for AI tools, subscriptions/provider state, OpenCode configuration, unattended execution, new-chat grounding, reusable website startup and agent allocation:

- `docs/ai-workforce/MASTER-AI-TOOLS-AND-WORKFLOW.md`

Read the master first. This file only adds CG Dynamics-specific routing/context. Do not treat CG Dynamics runtime AI, desktop coding agents and model providers as one system.

## Which agent for what

| Agent | Best for |
|---|---|
| **Claude Code** | Heavy architecture, substantial multi-file implementation, repo-wide audits and large engineering missions. Give it the product goal/constraints/acceptance result; do not micromanage file-by-file. |
| **OpenCode** | Practical workhorse for bounded implementation, routine fixes and continued coding when current model/provider quota is available. Inspect actual current model/provider state first. |
| **Antigravity CLI (`agy`)** | Tested fallback coding-agent route. Use from the project folder when its Google quota is available; it must read the same repo/project instructions as every other agent. |
| **Codex** | Focused implementation/review work when useful and available. Keep tasks tight because usage can be constrained. Reads mirrored skills in `.agents/skills/`. |
| **ChatGPT** | Business/product direction, connected-tool inspection, GitHub review, research, prompt control, second opinion and continuity. Do the thinking before handing approved implementation to a coding agent. |
| **Cline** | Additional VS Code fallback for bounded work/continuity; must follow repository instructions/current GitHub state. |
| **Roo Code** | Additional VS Code fallback under the same source-of-truth rules. |
| **Google/Gemini tools** | Secondary coding/research option. Keep available, but do not depend on current quota for critical continuity. |
| **Local/Ollama models** | Experimental/simple/local tasks only unless a specific model is proven for the actual agent workflow. |

Rule of thumb: architecture/cross-cutting → Claude Code or another proven strong agent; already-defined implementation → OpenCode/Antigravity; focused small change → OpenCode/Codex; direction/review/coordination → ChatGPT.

Use the strongest suitable available tool, not simply the cheapest tool, and do not spend coding-agent quota re-planning decisions already captured in repo docs.

## External AI stack vs CG Dynamics product AI

The tools above help **build** CG systems. They are not automatically providers for the AI features shipped **inside** CG Dynamics.

CG Dynamics product AI includes CG Assistant, AI Workforce/specialist agents and Marketing AI. Runtime provider/model selection stays server-side/provider-agnostic and must preserve permissions, client isolation, citations, review gates and confirmed-write/audit rules.

Never redesign product AI merely because a desktop coding model is retired, capped or temporarily unavailable.

## OpenCode rule

The authoritative current OpenCode state/maintenance policy is in the master.

Important current lesson: the experimental global provider/model filtering config created on 17 August 2026 was rolled back because it hid/changed already-working access. Do not assume a global `opencode.json` exists, do not recreate restrictive whitelists by default, and never guess model IDs. Inspect `opencode --version`, `opencode models`, current session/provider state and project-level config before changing anything.

## Cross-project reusable website workflow

New website startup is defined in the cross-project master and implemented in the Website System.

The normal principle is:

1. verify folder/repo/current shared-system state;
2. establish project facts/assets/design/phase authority;
3. reuse the Website System;
4. hand the approved phase to the appropriate coding agent;
5. use unattended execution for routine reversible work when explicitly authorised;
6. validate before commit/push/deployment.

Detailed website implementation history belongs in the Website System/site repos, not in CG Dynamics.

## Connectors

| Connector | Used for |
|---|---|
| **Teams / Microsoft 365** | Workflow discovery/reference while CG Dynamics replaces legacy workflow. |
| **Supabase** | Verified source-of-truth schema/data work under project security/change-control rules. |
| **Vercel** | Deployment/build/runtime verification. |
| **GitHub** | Source of truth for code, branches, PRs and durable continuity. |

## Shared instructions and skills

- `docs/ai-workforce/MASTER-AI-TOOLS-AND-WORKFLOW.md` — mandatory cross-project grounding/shared-stack authority.
- `AGENTS.md` — CG Dynamics-specific product/source-of-truth/security/build rules.
- `CLAUDE.md` — Claude Code memory/imports.
- `.claude/skills/` — Claude skills.
- `.agents/skills/` — mirrored Codex skills where applicable.

Core skills include **product-architect**, **repo-auditor**, **feature-implementer**, **client-schedule** and **agent-reviewer**.

## Non-negotiables for every agent

- Read the cross-project master first for shared tool/process decisions.
- `git status` first; pull latest `main`; inspect open PRs before starting work.
- Continue an existing PR when it already owns the area; do not create duplicate architecture or overlapping broad missions.
- Respect project source-of-truth locks, especially CG Calendar vs Client Schedule and existing Marketing/Knowledge/task authorities.
- Build/test requirements in `AGENTS.md` remain mandatory before commit/push.
- Never expose Supabase/provider/connected-account secrets.
- Unattended execution does not authorise billing, secrets, DNS/domain ownership changes, irreversible production destruction or unrelated destructive work.
- Cline/Roo/Antigravity/OpenCode/Claude/Codex are execution routes, not permission to bypass current PR ownership or repository instructions.
- If a shared agent/provider/subscription/model/bootstrap/reusable-system decision changes materially, update the master in the same work.
