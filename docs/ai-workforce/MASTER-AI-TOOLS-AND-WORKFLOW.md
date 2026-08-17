# Master AI Tools and Workflow

Last updated: 17 August 2026 SAST
Status: CURRENT cross-project authority
Repository: `CGProductionHouse/CG-Dynamics`
Canonical URL: `https://github.com/CGProductionHouse/CG-Dynamics/blob/main/docs/ai-workforce/MASTER-AI-TOOLS-AND-WORKFLOW.md`

This is the cross-project authority for AI tools, coding agents, shared capabilities, reusable systems and working process used across CG projects.

Project-specific product decisions still belong in each project's own `AGENTS.md`, continuity docs, issues and codebase.

## 1. Mandatory grounding rule

Every new ChatGPT project/chat, Claude Code session, OpenCode session, Codex task, Cline task, Roo Code task or other coding/research agent should ground itself in this order before proposing work:

1. Read this file.
2. Identify the exact project and repository. Never invent a repo, owner, local path or target branch.
3. Read that project's `AGENTS.md`, `CONTINUE-HERE.md`, `README.md`, current goal/decision docs and any project-specific standards.
4. Inspect current GitHub `main`, latest relevant commits, open PRs and open issues.
5. Continue an existing branch/PR when it already owns the task instead of creating duplicate work.
6. Check whether a reusable system already solves the foundation before scaffolding anything new.
7. Only then decide which agent/tool should do the work.

Every new CG repository's `AGENTS.md` should include a direct pointer to this canonical file.

Do not ask CA to repeat information that can be recovered from current GitHub, connected tools or established continuity files.

## 2. Canonical truth rules

### Current state beats static checkpoints

Static commit SHAs in this file are historical orientation only.

When a repository is accessible, current GitHub `main` is authoritative unless a project explicitly pins a version.

Never treat a historical milestone as the required current commit.

### Verify repository identity before blaming authentication

If `gh repo view owner/repo` or a connector lookup fails:

1. verify the documented repo owner/name;
2. search GitHub for the repository/name/known commit;
3. check whether the documentation is stale;
4. only then investigate GitHub authentication or permissions.

Do **not** immediately switch GitHub accounts.

### Canonical shared references must be machine-verifiable

Before changing repo/path/checkpoint facts in this master, verify that:

- the repo exists;
- the owner/name is exact;
- referenced files exist;
- historical checkpoints actually belong to the stated repo;
- local canonical paths are clearly labelled as workstation-local rather than GitHub truth.

The Website System improvement PR described below adds `validate-shared-truth.ps1` for this purpose.

## 3. Verified shared-system registry

### CG Website Builder / CG Website System

Product/system name: **CG Website Builder / CG Website System**

Verified GitHub repository:

`CGProductionHouse/cg-website-editor`

Verified accessible on 17 August 2026.

Local canonical repository path on CA's current workstation:

`C:\Projects\CG-Websites\cg-website-editor`

Reusable system directory:

`C:\Projects\CG-Websites\cg-website-editor\website-system`

Historical foundation milestone:

`ed823b7` — verified to belong to `CGProductionHouse/cg-website-editor`.

Observed current-main checkpoint during the CG ARCC setup test:

`f891383` — **not pinned**; always re-check current `main` before work.

Old `Captured-Growth/cg-website-builder` references are stale and must not be used as current truth.

### Imbewu reference site

Verified GitHub repository:

`CGProductionHouse/Imbewu-Website`

Historical bootstrap checkpoint:

`df00359` — verified to belong to that repository.

Old `Captured-Growth/cg-imbewu-website` references are stale and must not be used as current truth.

### CG ARCC setup test

`CGProductionHouse/cg-arcc` now exists as a private repo and was used as the real-world new-project setup test on 17 August 2026.

Do not move CG ARCC project-specific decisions into this master; its value here is as the test case that exposed shared startup friction.

## 4. What belongs in this master

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

Do **not** turn this into a duplicate log of each project's tickets, UI changes or client-specific decisions.

## 5. Current AI / agent stack

| Tool / service | Current role | Current state |
|---|---|---|
| **ChatGPT Plus** | Product direction, research, connected-tool work, GitHub inspection, prompt control, review and cross-project continuity | Active. Use connected tools when available instead of asking CA to search manually. |
| **Claude Code** | Primary heavy engineering agent for architecture, substantial multi-file work and repo-wide missions | Available. Give it the goal, constraints and acceptance result; do not micromanage file-by-file. |
| **OpenCode** | Practical coding workhorse for bounded implementation, routine fixes and continued coding | Active with global provider/model configuration. Model/provider routed; not synonymous with DeepSeek. |
| **Codex** | Focused coding/review work | Available but usage can be constrained; keep missions focused. |
| **Cline** | VS Code fallback coding agent | Wired into shared workflow. Must read current repo instructions first. |
| **Roo Code** | VS Code fallback coding agent | Wired into shared workflow. Must read current repo instructions first. |
| **Google / Gemini** | Secondary coding/research option | Connected, but CA reports current quota/cap behaviour is too restrictive for dependable daily coding. Keep available; do not depend on it for critical continuity. |
| **OpenRouter** | Separate paid API-backed multi-model route used through OpenCode | Active connection. Treat as separate from OpenCode Zen free limits. Never store keys/billing secrets in GitHub. |
| **OpenCode Zen** | Free/fallback model pool | Active. Curated shortlist should be used rather than the full catalogue. |
| **Direct OpenAI in OpenCode** | Direct OpenAI models available inside OpenCode | Connected and visible. Do not hide the provider globally. Exact billing/auth mechanism is not recorded here. |

### Possible future research subscription

A dedicated paid Google research/deep-research product may be considered for high-volume Media/Marketing Library research/custodian work.

Status: **candidate only**. Verify current product, pricing, quotas and terms before spending money.

## 6. OpenCode global configuration — current checkpoint

Global configuration is managed under `%USERPROFILE%\.config\opencode\opencode.json`.

Important decision: **do not use a global `enabled_providers` allowlist at the moment.** It previously hid direct OpenAI and other already-connected providers. Curate large providers with per-provider model whitelists instead.

### OpenCode Zen shortlist

Current global whitelist:

- `deepseek-v4-flash-free` — CA's proven favourite OpenCode model; keep visible unless it actually stops working;
- `big-pickle`;
- `mimo-v2.5-free`;
- `nemotron-3-ultra-free`;
- `nemotron-3.5-lightning-free`.

Do not confuse the working Zen model `opencode/deepseek-v4-flash-free` with an older/dead similarly named provider endpoint.

### OpenRouter shortlist

Current global whitelist:

- `~deepseek/deepseek-v4-flash-latest`;
- `deepseek/deepseek-v4-pro-0813`;
- `~anthropic/claude-sonnet-latest`;
- `~anthropic/claude-haiku-latest`;
- `~moonshotai/kimi-latest`;
- `~openai/gpt-latest`;
- `~openai/gpt-mini-latest`.

Current global defaults recorded locally:

- normal model: `openrouter/deepseek/deepseek-v4-pro-0813`;
- small model: `openrouter/~openai/gpt-mini-latest`.

These are defaults, not a claim that they outperform CA's preferred Zen DeepSeek for every task.

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

Direct OpenAI is intentionally not globally whitelisted yet so useful models such as Sol are not accidentally hidden again.

### OpenCode maintenance

When a model fails, is retired or the catalogue becomes stale:

```powershell
opencode --version
opencode upgrade
opencode models --refresh
```

Then inspect the real current model IDs before editing global/project config. Do not guess provider IDs.

Project-level `opencode.json` can override global settings. Inspect it before diagnosing a project-specific model problem.

## 7. Agent allocation

### Claude Code

Use for large architecture, substantial multi-file implementation, repo-wide refactors/audits and major product missions.

Give Claude the objective, source-of-truth docs, boundaries and acceptance criteria. Let it choose implementation shape unless there is a real product/security constraint.

### OpenCode

Use for bounded implementation, routine fixes, practical continued development and local setup/automation once the mission is understood.

OpenCode must still inspect repo instructions/current GitHub first. Do not let a cheap model redo architecture another agent already delivered.

### Codex

Use for focused implementation/review where useful. Keep missions tight because usage may be constrained.

### Cline / Roo Code

Fallback execution paths, not separate product brains. They must use the same GitHub source of truth, repo instructions and current mission ownership.

### ChatGPT

Use for deciding what happens next, inspecting GitHub/current state, research/connected-account work, reviewing agent output, writing efficient agent missions, cross-project continuity and business/product/professional reasoning.

ChatGPT should not invent local/repo state when it can inspect it.

## 8. New website startup — canonical process

The CG ARCC setup test confirmed the **human-controlled start is correct**, but repetitive verification/setup must be automated.

### Step 1 — human confirms the three facts

Before automation, CA confirms:

- exact local folder;
- exact GitHub `owner/repo`;
- visibility (normally private unless explicitly public).

Nothing else should be guessed.

### Step 2 — one read-only preflight

Target shared command (implemented in draft Website System PR #1):

```powershell
C:\Projects\CG-Websites\cg-website-editor\website-system\scripts\check-new-project.ps1 `
  -ProjectPath "C:\Projects\CG-Websites\client-site" `
  -TargetRepo "CGProductionHouse/client-site"
```

It reports without modifying anything:

- local folder and empty/non-empty state;
- Git state/current branch/origin/working tree;
- GitHub CLI/authenticated account;
- target repo existence;
- Node/npm;
- Ollama + installed models;
- canonical Website System path/current branch/commit/clean state;
- bootstrap state;
- master-pointer presence;
- application scaffold presence.

### Step 3 — one normal new-site command

Target shared command (implemented in draft Website System PR #1):

```powershell
C:\Projects\CG-Websites\cg-website-editor\website-system\scripts\new-site.ps1 `
  -ProjectPath "C:\Projects\CG-Websites\client-site" `
  -Repo "CGProductionHouse/client-site" `
  -Private
```

It is designed to stop rather than guess and to combine:

- Git/main initialisation;
- GitHub account/target repo verification;
- private/public repo creation;
- origin verification;
- canonical Next.js scaffold;
- project docs/agent bootstrap;
- cross-project master pointer;
- dependency install;
- lint/build;
- clean initial commit/push only when verification passes.

Vercel remains a separate verified step because project/team/domain choice can be ambiguous.

### Terminology

- `bootstrap-site.ps1` = repo docs/agent grounding only;
- canonical Next.js template = application scaffold only;
- `new-site.ps1` = preferred combined brand-new-site workflow once merged and validated.

Do not say a site is fully bootstrapped when it only has docs and no application scaffold.

### Current implementation status

Draft Website System PR:

`CGProductionHouse/cg-website-editor#1` — **Automate verified new website startup and shared grounding**.

It also updates `bootstrap-site.ps1` so new `AGENTS.md` files automatically include:

- this master pointer;
- canonical Website System pointer;
- grounding order;
- current Git/GitHub verification;
- anti-duplicate rules.

The PR is intentionally draft until one real Windows workstation dry run validates the PowerShell path end-to-end. Do not claim these new commands are production-ready until that acceptance passes and the PR is merged.

## 9. Reusable Website System capability

Current verified reusable-system repo is `CGProductionHouse/cg-website-editor`.

The system includes:

- create-only/idempotent project bootstrap;
- canonical Next.js template;
- shared agent wiring for OpenCode, Claude Code, Codex, Cline and Roo Code;
- skills for project bootstrap, content audit, asset selection, image quality, responsive design, animation/motion, SEO, production QA, Vercel deployment and domain handover;
- patterns for accessible header/mobile dialog, responsive hero video, gallery carousel, logo marquee, reveal/ambient motion, interactive cards, section/CTA primitives, responsive images, PDF fallback, footer and Sharp image optimisation.

Every new website should inherit the strongest current reusable standards rather than recreating responsive/mobile foundations, accessibility/navigation/footer, media fallbacks, image optimisation, SEO, animation primitives, QA, Vercel conventions or agent setup.

If a new site improves a reusable pattern, feed the verified client-agnostic improvement back into the Website System.

## 10. New chat / project grounding protocol

A fresh ChatGPT chat should not behave like a blank generic assistant.

Before advising on an existing CG project, it should:

1. identify the project;
2. inspect this master when the question touches tools/agents/shared workflow;
3. inspect the relevant repo if one exists;
4. read repo-specific instructions/decisions;
5. check connected files/accounts when the answer depends on them;
6. distinguish known facts from assumptions;
7. avoid proposing setup/build work already completed elsewhere.

For a brand-new project with no repo yet, ChatGPT should establish the three human-controlled setup facts first, then use the shared verified startup workflow. It should **not** invent a target repo/folder tree/coding mission and ask CA to catch up.

## 11. Master vs Website AI tracker

Authority is intentionally split:

- `CG-Dynamics/docs/ai-workforce/MASTER-AI-TOOLS-AND-WORKFLOW.md` = cross-project authority;
- `cg-website-editor/website-system/AI-TOOLCHAIN.md` = website-specific implementation/tooling appendix.

The website appendix must point back to this master and must not duplicate stale account/repo/provider facts as independent truth.

## 12. Research / connected tools

Use connected tools when they materially reduce manual work, but verify the tool is actually available in the current session before claiming capability.

Examples:

- GitHub for repo/current state;
- Gmail/Outlook for correspondence when connected;
- Calendar for schedules/events when connected;
- Supabase for authorised schema/data inspection;
- Vercel for deployment/build state;
- web research for current laws, standards, products, prices and professional guidance.

Never claim a connected-account action happened without actually invoking the relevant tool.

## 13. Cross-agent anti-duplicate rules

Before starting work, every agent asks:

- Is this already on `main`?
- Is an open PR already solving it?
- Is another agent/session actively working on it?
- Is there already a reusable system/pattern/skill for it?
- Is the requested behaviour intentionally locked by project docs?
- Am I about to create another source of truth?

If yes, reconcile first.

## 14. Security / secrets

Never commit:

- OpenRouter keys;
- OpenAI/Anthropic/Google keys;
- OpenCode auth/session tokens;
- Supabase service-role secrets;
- paid-provider billing secrets;
- passwords or private credentials.

Track capability and process, not secrets.

## 15. Update rule

When an agent changes something that affects the shared stack, it must update this file in the same work.

Examples:

- new/replaced coding agent;
- new shared subscription;
- OpenCode provider/model strategy change;
- reusable Website System milestone affecting all future sites;
- new global bootstrap/QA/deployment process;
- new research tooling affecting multiple projects.

For shared website repo/path/checkpoint changes, run the shared-truth validation once PR #1 is merged. Project-specific work should update that project's own continuity files instead.
