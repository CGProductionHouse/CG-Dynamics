# Master AI Tools and Workflow

Last updated: 17 August 2026 SAST
Status: CURRENT cross-project authority
Repository: `CGProductionHouse/CG-Dynamics`
Canonical URL: `https://github.com/CGProductionHouse/CG-Dynamics/blob/main/docs/ai-workforce/MASTER-AI-TOOLS-AND-WORKFLOW.md`

This is the master continuity file for the AI tools, coding agents, shared capabilities, reusable systems and working process used across CG projects.

It is intentionally **cross-project**. Project-specific product decisions still belong in each project's own `AGENTS.md`, continuity docs, issues and codebase.

## Mandatory grounding rule

Every new ChatGPT project/chat, Claude Code session, OpenCode session, Codex task, Cline task, Roo Code task or other coding/research agent should ground itself in this order before proposing work:

1. Read this file.
2. Identify the exact project and repository. Never invent a repo, owner, local path or target branch.
3. Read that project's `AGENTS.md`, `CONTINUE-HERE.md`, `README.md`, current goal/decision docs and any project-specific constitution/standards.
4. Inspect current GitHub `main`, latest relevant commits, open PRs and open issues.
5. Continue an existing branch/PR when it already owns the task instead of creating duplicate work.
6. Check whether a reusable system already solves the foundation before scaffolding anything new.
7. Only then decide which agent/tool should do the work.

Every new CG repository's `AGENTS.md` should include a direct pointer to the canonical URL above. Website bootstrap/agent automation should add this pointer automatically so agents in other repos know where the shared process lives.

Do not ask CA to repeat information that can be recovered from current GitHub, connected tools or established continuity files.

## What belongs in this master file

Update this file when a change affects multiple projects or agents, including:

- AI subscriptions/provider availability;
- OpenCode global provider/model setup;
- which coding agent is used for which class of work;
- new connected tools/connectors that materially change capability;
- reusable website-system milestones that affect every new site;
- global bootstrap/QA/deployment process;
- agent coordination rules;
- model retirement/replacement decisions;
- major shared workflow decisions.

Do **not** turn this into a duplicate log of every project's tickets, UI changes or client-specific decisions.

## Current AI / agent stack

| Tool / service | Current role | Current state |
|---|---|---|
| **ChatGPT Plus** | Product direction, research, connected-tool work, GitHub inspection, prompt control, review and cross-project continuity | Active. Use current connected tools when available rather than asking CA to search manually. |
| **Claude Code** | Primary heavy engineering agent for architecture, substantial multi-file work and repo-wide missions | Available. Give it the goal, constraints and acceptance result; do not micromanage file-by-file. |
| **OpenCode** | Practical coding workhorse for bounded implementation, routine fixes and continued coding | Active with global provider/model configuration. Model/provider routed; not synonymous with DeepSeek. |
| **Codex** | Focused coding/review work | Available but usage can be constrained; keep missions focused. |
| **Cline** | VS Code fallback coding agent | Wired into shared workflow. Must read current repo instructions first. |
| **Roo Code** | VS Code fallback coding agent | Wired into shared workflow. Must read current repo instructions first. |
| **Google / Gemini** | Secondary coding/research option | Connected, but CA reports current quota/cap behaviour is too restrictive for dependable daily coding. Keep available; do not depend on it for critical continuity. |
| **OpenRouter** | Separate paid API-backed multi-model route used through OpenCode | Active connection. Treat as paid route separate from OpenCode Zen free limits. Never store key/billing secrets in GitHub. |
| **OpenCode Zen** | Free/fallback model pool | Active. Curated shortlist should be used rather than the full catalogue. |
| **Direct OpenAI in OpenCode** | Direct OpenAI models available inside OpenCode | Connected and visible. Do not hide the provider globally. Exact billing/auth mechanism is not recorded here. |

### Possible future research subscription

A dedicated paid Google research/deep-research product may be considered for high-volume Media/Marketing Library research/custodian work.

Status: **candidate only**. No purchase/subscription is approved by this file. Verify current product, pricing, quotas and terms before spending money.

## OpenCode global configuration — current checkpoint

Global configuration is managed under the user's OpenCode config directory, currently via `%USERPROFILE%\.config\opencode\opencode.json`.

Important decision: **do not use a global `enabled_providers` allowlist at the moment.** It previously hid direct OpenAI and other already-connected providers. Curate large providers with per-provider model whitelists instead.

### OpenCode Zen shortlist

Current global whitelist:

- `deepseek-v4-flash-free` — CA's proven favourite OpenCode model; keep visible unless it actually stops working;
- `big-pickle`;
- `mimo-v2.5-free`;
- `nemotron-3-ultra-free`;
- `nemotron-3.5-lightning-free`.

Do not confuse the working Zen model `opencode/deepseek-v4-flash-free` with an older/dead provider identifier that may report end-of-life.

### OpenRouter shortlist

Current global whitelist:

- `~deepseek/deepseek-v4-flash-latest`;
- `deepseek/deepseek-v4-pro-0813`;
- `~anthropic/claude-sonnet-latest`;
- `~anthropic/claude-haiku-latest`;
- `~moonshotai/kimi-latest`;
- `~openai/gpt-latest`;
- `~openai/gpt-mini-latest`.

Current global default recorded in local config:

- normal model: `openrouter/deepseek/deepseek-v4-pro-0813`;
- small model: `openrouter/~openai/gpt-mini-latest`.

These are defaults, not a statement that they outperform CA's preferred Zen DeepSeek for every task.

### Google shortlist

Current global whitelist:

- `gemini-flash-latest`;
- `gemini-3.1-pro-preview`;
- `deep-research-max-preview-04-2026`.

Google remains secondary because of quota/cap experience.

### Direct OpenAI currently visible in OpenCode

Confirmed on 17 August 2026:

- `openai/gpt-5.3-codex-spark`;
- `openai/gpt-5.4`;
- `openai/gpt-5.4-fast`;
- `openai/gpt-5.4-mini`;
- `openai/gpt-5.4-mini-fast`;
- `openai/gpt-5.5`;
- `openai/gpt-5.5-fast`;
- `openai/gpt-5.6-luna`;
- `openai/gpt-5.6-luna-fast`;
- `openai/gpt-5.6-sol`;
- `openai/gpt-5.6-sol-fast`;
- `openai/gpt-5.6-terra`;
- `openai/gpt-5.6-terra-fast`.

Direct OpenAI is intentionally **not** globally whitelisted yet, so useful models such as Sol are not accidentally hidden again.

### OpenCode maintenance

When a model fails, is retired or the catalogue becomes stale:

```powershell
opencode --version
opencode upgrade
opencode models --refresh
```

Then inspect the real current model IDs before editing global/project config. Do not guess provider IDs or delete a model merely because another similarly named endpoint died.

Project-level `opencode.json` can override global settings. Inspect it before diagnosing a project-specific model problem.

## Agent allocation

### Claude Code

Use for:

- large architecture;
- substantial multi-file implementation;
- repo-wide refactors/audits;
- major product missions.

Give Claude the objective, source-of-truth docs, boundaries and acceptance criteria. Let it choose implementation shape unless there is a real product/security constraint.

### OpenCode

Use for:

- bounded implementation;
- routine fixes;
- practical continued development;
- local setup/automation work when the mission is well understood.

OpenCode should still inspect repo instructions and current GitHub first. Do not let a cheap model redo architecture another agent already delivered.

### Codex

Use for focused implementation/review where useful. Keep missions tight because usage may be constrained.

### Cline / Roo Code

Fallback execution paths, not separate product brains. They must use the same GitHub source of truth, repo instructions and current mission ownership.

### ChatGPT

Use for:

- deciding what should happen next;
- inspecting GitHub/current state;
- research and connected-account work;
- reviewing agent output;
- writing efficient agent missions;
- cross-project continuity;
- business/product/professional reasoning.

ChatGPT should not invent local/repo state when it can inspect it.

## New website startup — canonical process

This is the default startup for a new CG website. Do not improvise a new workflow per site.

### 1. Ground first

Before scaffolding:

- read this master file;
- confirm the client's/site's real facts and scope;
- check whether the local folder already exists;
- check whether a GitHub repo already exists and confirm its exact owner/name;
- inspect the reusable Website Builder system and current bootstrap/skills;
- do not invent a repo or assume files exist because another chat mentioned them.

### 2. Human-controlled VS Code / repository setup

CA's preferred startup is to establish the project correctly before handing implementation to a coding agent.

Confirm in VS Code/local tooling:

- correct local folder;
- Git repository state;
- correct GitHub remote/owner/repo;
- current `main`;
- project `AGENTS.md` / `CLAUDE.md` / continuity docs;
- reusable website-system linkage/bootstrap state;
- Node/toolchain/dependencies;
- Vercel/project connection when relevant.

A coding agent must not guess these foundations on CA's behalf.

### 3. Reuse the CG Website System

Current user-confirmed reusable-system checkpoint:

- Website Builder repo: `Captured-Growth/cg-website-builder`;
- checkpoint: `ed823b7`;
- Imbewu repo: `Captured-Growth/cg-imbewu-website`;
- Imbewu bootstrap checkpoint: `df00359`;
- `bootstrap-site.ps1` is create-only and idempotent;
- OpenCode, Claude Code, Codex, Cline and Roo Code are wired into the reusable workflow;
- reusable skills cover project bootstrap, content audit, asset selection, image quality, responsive design, animations/motion, SEO, production QA, Vercel deployment and domain handover;
- reusable implementation patterns include accessible header/mobile dialog, responsive hero video, controlled gallery carousel, logo marquee, reveal/ambient motion, interactive cards, section/CTA primitives, responsive images, PDF fallback, footer and Sharp image optimisation.

Detailed website implementation history stays in the Website Builder/site repos. This master only records shared capability/progress.

### 4. No abortive rebuilding

Every new website should inherit the strongest current reusable standards rather than recreating:

- responsive/mobile foundations;
- accessibility/navigation/footer;
- media fallbacks;
- image optimisation;
- SEO foundations;
- animation primitives;
- QA;
- Vercel deployment conventions;
- agent/bootstrap setup.

If a new site improves a reusable pattern, feed that improvement back into the reusable Website Builder instead of leaving it isolated when appropriate.

### 5. Then hand implementation to the agent

Once setup and project facts are confirmed, the normal website coding handoff is intentionally short:

> Read `AGENTS.md`, the project docs and the CG Website System. Inspect the current repo and implement the approved phase. Build, test, commit and push only if verification passes.

Do not send a giant project-history prompt when the repository already contains the context.

## New chat / project grounding protocol

A fresh ChatGPT chat should not behave like a blank generic assistant.

Before advising on an existing CG project, it should:

1. identify the project;
2. inspect this master when the question touches tools/agents/shared workflow;
3. inspect the relevant repo if one exists;
4. read repo-specific instructions/decisions;
5. check connected files/accounts when the answer depends on them;
6. distinguish known facts from assumptions;
7. avoid proposing setup/build work already completed elsewhere.

For a brand-new project with no repo yet, ChatGPT should help establish the facts and controlled setup first. It should **not** invent a target repo, folder tree or coding mission and then ask CA to catch up.

## Research / connected tools

Use connected tools when they materially reduce manual work, but verify the tool is actually available in the current session before claiming capability.

Examples include:

- GitHub for code/current repo state;
- Gmail/Outlook for correspondence when connected;
- Calendar for schedules/events when connected;
- Supabase for authorised schema/data inspection;
- Vercel for deployment/build state;
- web research for current laws, standards, products, prices and professional guidance.

Never claim a connected-account action happened without actually invoking the relevant tool.

## Cross-agent anti-duplicate rules

Before starting work, every agent asks:

- Is this already on `main`?
- Is an open PR already solving it?
- Is another agent/session actively working on it?
- Is there already a reusable system/pattern/skill for it?
- Is the requested behaviour intentionally locked by project docs?
- Am I about to create another source of truth?

If yes, reconcile first.

## Security / secrets

Never commit:

- OpenRouter keys;
- OpenAI/Anthropic/Google keys;
- OpenCode auth/session tokens;
- Supabase service-role secrets;
- paid-provider billing secrets;
- passwords or private credentials.

Track capability and process, not secrets.

## Update rule

When an agent changes something that affects the shared stack, it must update this file in the same work.

Examples:

- new/replaced coding agent;
- new shared subscription;
- OpenCode provider/model strategy change;
- reusable Website Builder milestone affecting all future sites;
- new global bootstrap/QA/deployment process;
- new research tooling affecting multiple projects.

Project-specific work should update that project's own continuity files instead.
