# Master AI Tools and Workflow

Last updated: 17 August 2026 SAST
Status: CURRENT cross-project authority
Repository: `CGProductionHouse/CG-Dynamics`
Canonical URL: `https://github.com/CGProductionHouse/CG-Dynamics/blob/main/docs/ai-workforce/MASTER-AI-TOOLS-AND-WORKFLOW.md`

This is the cross-project authority for AI tools, coding agents, shared capabilities, reusable systems and working process used across CG projects.

Project-specific product/design/business decisions still belong in each project's own `AGENTS.md`, continuity/decision docs, issues, PRs and codebase.

## 1. Mandatory grounding rule

Every new ChatGPT project/chat, Claude Code session, OpenCode session, Codex task, Antigravity session, Cline task, Roo Code task or other coding/research agent should ground itself in this order before proposing work:

1. Read this file when the task touches shared tools/agents/workflow.
2. Identify the exact project and repository. Never invent a repo, owner, local path, target branch or deployment target.
3. Read the project's `AGENTS.md`, `CONTINUE-HERE.md`, `README.md`, current goal/decision docs and project standards.
4. Inspect current GitHub `main`, latest relevant commits, open PRs and open issues.
5. Continue an existing branch/PR when it already owns the task instead of creating duplicate/abortive work.
6. Check whether a reusable CG system already solves the foundation before scaffolding anything new.
7. Check connected/current tool state when the answer depends on GitHub, Vercel, email/calendar, Supabase, model/provider availability or other live systems.
8. Only then choose the agent/tool and execute.

Every new CG repository's `AGENTS.md` should point directly to this file.

Do not ask CA to repeat information that can be recovered from current GitHub, connected tools or established continuity files.

## 2. Canonical truth rules

### Current state beats static checkpoints

Historical commit SHAs in shared docs are orientation only. When a repo is accessible, current GitHub `main` is authoritative unless the project explicitly pins a version.

### Verify identity before blaming credentials

If `gh repo view owner/repo` or a connector lookup fails:

1. verify the documented owner/name;
2. search GitHub for the repo/name/known commit;
3. check whether documentation is stale;
4. only then investigate authentication/permissions.

Do not immediately switch GitHub accounts.

### Shared references must be verifiable

Before recording repo/path/checkpoint facts as canonical, verify:

- repo exists;
- owner/name is exact;
- referenced file exists;
- checkpoint belongs to the stated repo;
- local paths are clearly labelled workstation-local;
- current `main` is not being confused with a historical milestone.

The Website System draft improvement adds `validate-shared-truth.ps1` to automate much of this.

## 3. Verified shared-system registry

### CG Website Builder / CG Website System

Product/system name: **CG Website Builder / CG Website System**

GitHub repo:

`CGProductionHouse/cg-website-editor`

Local canonical repo path on CA's current workstation:

`C:\Projects\CG-Websites\cg-website-editor`

Reusable system directory:

`C:\Projects\CG-Websites\cg-website-editor\website-system`

Historical foundation milestone: `ed823b7` — not pinned.

Old `Captured-Growth/cg-website-builder` references are stale and must not be used as current truth.

### Imbewu reference site

GitHub repo:

`CGProductionHouse/Imbewu-Website`

Historical bootstrap checkpoint: `df00359` — not pinned.

Imbewu is a learning/reference project, not a visual template every new site should copy.

### CG ARCC setup test

`CGProductionHouse/cg-arcc` was used as a real new-project setup test on 17 August 2026 and exposed shared GitHub/Vercel/startup friction. Project-specific CG ARCC decisions do not belong in this master.

## 4. What belongs in this master

Update this file when a change affects multiple projects/agents, including:

- AI subscriptions/provider availability;
- coding-agent installation/availability;
- shared model/provider lessons;
- agent routing by job type;
- unattended/autonomous execution policy;
- reusable Website System capabilities/startup/deployment process;
- shared connected tools;
- cross-agent coordination/anti-duplicate rules;
- major shared workflow decisions.

Do not turn this into a duplicate log of each project's features/client decisions.

## 5. Current practical AI / coding stack

| Tool | Practical role | Current lesson/state |
|---|---|---|
| **ChatGPT Plus** | Product/visual direction, connected tools, GitHub/Vercel inspection, research, planning, review, cross-project continuity and efficient coding-agent missions | Active. Inspect connected/current state instead of asking CA to manually find information. Can make targeted GitHub changes directly where appropriate. |
| **Claude Code** | Heavy engineering, architecture, substantial multi-file missions, repo-wide refactors/audits | Strong option but usage frequently depletes. Use when available for substantial work; give objective/constraints/acceptance, not file-by-file micromanagement. |
| **OpenCode** | Main practical coding workhorse when current provider/model quota is available | Keep prompts tight and execution-focused. Check actual current models/providers rather than assuming a model ID or quota still exists. |
| **Codex** | Focused implementation/review/fixes | Useful but usage is too limited for long continuous website builds unless quota clearly exists. |
| **Antigravity CLI (`agy`)** | Proper fallback coding-agent bucket | Installed, Google sign-in working and tested successfully on Imbewu. Gemini 3.7 Flash High completed useful multi-file website implementation, lint/build/QA, Git commit and push. Launch from the project folder with `agy`. Treat quota as limited. |
| **Cline** | VS Code fallback coding agent | Keep as fallback. Must use same repo/project grounding; never independently reinvent architecture. |
| **Roo Code** | VS Code fallback coding agent | Same rules as Cline. |
| **Google / Gemini services** | Secondary coding/research capability | Keep available, but CA reports caps/quotas are poor for dependable daily coding. Do not make critical continuity depend on Google quota. |
| **OpenRouter** | Separate paid API-backed multi-model route usable through OpenCode | Useful when available; separate from Zen/free limits. Never store keys/billing secrets in GitHub. |
| **OpenCode Zen** | Free/fallback OpenCode models | Availability changes. Inspect current list before assigning work. |
| **Direct OpenAI through OpenCode** | Additional model route when connected/available | Previously visible on 17 Aug 2026; inspect current state before relying on it. Do not hide working provider access through speculative global filtering. |
| **Ollama / local models** | Optional experimental/simple/local tasks | Do not route production website implementation to an unproven local model merely because it is free. |

### Possible research subscription

A dedicated paid Google research/deep-research product may be considered for high-volume Media/Marketing Library custodian/research work.

Status: **candidate only**. Verify the actual current product, pricing, quotas and terms before spending money.

## 6. OpenCode configuration — rollback and current rule

On 17 August 2026 an experimental global OpenCode provider/model filtering config was introduced, caused confusion by hiding/changing already-working provider/model access, then was **backed up and removed**.

Previous path:

`%USERPROFILE%\.config\opencode\opencode.json`

Current rule:

- do **not** assume a custom global OpenCode config exists;
- do not recreate restrictive provider/model whitelists merely to make the picker cleaner;
- do not hide already-working providers;
- actual current provider/model availability beats stale documentation;
- never guess model IDs;
- project-level `opencode.json` may still exist for legitimate project-specific tooling/MCP and must be inspected before changing anything.

Before troubleshooting OpenCode:

```powershell
opencode --version
opencode models
```

Then inspect, in order:

1. current session model;
2. actual provider/model list;
3. project-level `opencode.json`;
4. provider/auth state;
5. global config only if one actually exists.

If catalogue/version drift is the problem:

```powershell
opencode upgrade
opencode models --refresh
```

Do not repeatedly patch global config based on a guessed model/provider name.

### Local-model lesson

Gemma 4 12B was tested through OpenCode for real agentic website implementation/tool use and performed poorly: incorrect/nonexistent tools and irrelevant tasks were attempted.

Do not route production website implementation to Gemma by default. Local models are experimental/simple-task options unless a specific model proves itself on the real workflow.

## 7. Agent routing by job type

| Job type | Preferred routing |
|---|---|
| Thinking, product/visual direction, research, connected accounts, repo inspection, prompt preparation, review | ChatGPT / strongest available reasoning/vision capability |
| Initial visual/reference audit or genuinely new creative direction | Strong vision/reasoning agent first; capture result in project docs before coding |
| Major architecture / risky multi-file change | Claude Code or another proven strong coding agent when quota exists |
| Approved implementation already defined in repo docs | OpenCode or Antigravity as practical workhorse; Claude where complexity warrants it |
| Styling, components, responsive work, testing, repetitive implementation | Coding workhorse with repo docs as authority |
| Bounded fixes, docs, simple mechanical refactors | Cheaper/smaller proven model is acceptable |
| Unproven local model experiment | Only when it cannot delay the production path |

Use the strongest **suitable available** tool, not simply the cheapest tool.

Never spend expensive coding-agent quota re-planning decisions already captured in the repository.

## 8. Prompt efficiency — think before coding

New standard:

**DO THE THINKING BEFORE THE CODING PROMPT.**

ChatGPT/project docs should establish:

- exact objective;
- verified content/facts;
- assets and their roles;
- design direction/references;
- constraints;
- reusable patterns/skills;
- acceptance criteria;
- explicit out-of-scope items.

Then the coding-agent prompt should normally be tiny:

```text
Read AGENTS.md and the current approved PHASE-X.md. Implement it using the CG Website System. Use the standard autonomous/unattended execution rules. Build, test, run CG Website System QA, commit and push only if verification passes.
```

Long prompts are justified only for a genuinely new creative phase, architecture change, or unattended boundary not already captured in repo docs.

Do not paste the full client history into every coding session.

## 9. Standard autonomous / unattended execution

CA frequently leaves agents running. Routine project development should not repeatedly stop for `Yes` on reversible in-scope work.

When a coding prompt explicitly invokes autonomous/unattended execution, the agent is authorised to perform normal project development without repeated confirmation, including:

- reading/searching project files;
- editing/creating/moving/deleting in-scope files where Git makes the change reversible;
- normal dependency install justified by the approved phase;
- non-interactive development commands;
- lint/typecheck/tests/build/CG Website System QA;
- fixing failures and rerunning checks;
- Git status/diff/add/commit;
- pushing when repository instructions allow it and required verification passes.

The agent should choose safe/reversible implementation details itself, fix failures and continue, and finish all unblocked work rather than sitting indefinitely on a minor external blocker.

**Stop only for:**

- required missing credentials/secrets unavailable through an approved connected tool;
- purchases/subscriptions/billing;
- DNS/domain ownership changes or external account ownership actions not explicitly approved;
- irreversible production deletion/destruction;
- destructive work outside scope;
- genuine unrecoverable technical blocker;
- major unresolved product/design decision not answered by current project authority.

Unattended mode never authorises weakening security, inventing client facts, exposing secrets or making unrelated destructive external changes.

Website-specific reusable block:

`CGProductionHouse/cg-website-editor/website-system/prompts/AUTONOMOUS-EXECUTION.md` (currently on the draft Website System improvement branch until merged).

## 10. New website startup — canonical target process

The human-controlled start remains correct, but repetitive mechanics should be automated.

### CA confirms once

- exact local folder;
- exact GitHub `owner/repo`;
- repo visibility;
- intended Vercel scope/team.

Automation must stop rather than guess anything ambiguous.

### Read-only preflight

Draft Website System PR #1 adds:

```powershell
C:\Projects\CG-Websites\cg-website-editor\website-system\scripts\check-new-project.ps1 `
  -ProjectPath "C:\Projects\CG-Websites\client-site" `
  -TargetRepo "CGProductionHouse/client-site"
```

It is intended to report folder/Git/origin, GitHub auth/repo identity, Node/npm, Ollama inventory, Website System state, Vercel CLI/version/capabilities/link/config, bootstrap/project-doc state and other startup truth without modifying anything.

### Combined new-site command

Draft target:

```powershell
C:\Projects\CG-Websites\cg-website-editor\website-system\scripts\new-site.ps1 `
  -ProjectPath "C:\Projects\CG-Websites\client-site" `
  -Repo "CGProductionHouse/client-site" `
  -Private `
  -VercelScope <verified-vercel-scope>
```

Target end state:

- Git initialized on `main`;
- exact GitHub repo created/connected;
- origin verified;
- canonical Next.js scaffold installed;
- dependencies installed;
- `AGENTS.md` + project intelligence created;
- cross-project master + Website System pointers present;
- local `reference/` ignored;
- lint/build/shared QA passing;
- initial commit pushed;
- Vercel project linked to the intended scope;
- Next.js framework/build/install/output auto-detection verified;
- Git integration connected;
- temporary Vercel URL verified and recorded before deployment setup is considered complete.

The script must never guess a generated deployment URL; verify the real result.

### Production-readiness status

The enhanced startup automation is still **draft/experimental** in `CGProductionHouse/cg-website-editor#1` until one complete real Windows workstation acceptance run proves the full path.

Do not call it production-ready before that happens and the PR is merged.

Existing reusable standards/templates/create-only bootstrap remain available independently.

## 11. Standard website project document flow

Every new site should quickly establish/maintain:

- `AGENTS.md`
- `docs/PROJECT-BRIEF.md`
- `docs/DESIGN-DIRECTION.md`
- `docs/CONTENT-SOURCE.md`
- `docs/ASSET-MANIFEST.md`
- `docs/DECISIONS.md`
- `docs/DEPLOYMENT.md`
- current `docs/PHASE-X.md`

Authority:

- `CONTENT-SOURCE` = verified facts/assets/source provenance safe to publish;
- `ASSET-MANIFEST` = which assets map to which website roles;
- `DESIGN-DIRECTION` = approved visual benchmark and brand/interaction direction;
- `DECISIONS` = durable choices future agents should not reopen without reason;
- `PHASE-X` = actual approved implementation authority;
- `DEPLOYMENT` = repo/Vercel/domain/verification state, never secrets.

This is what allows a coding agent to receive a tiny prompt instead of redoing research/planning.

## 12. Reusable Website System capability

Current verified reusable-system repo: `CGProductionHouse/cg-website-editor`.

It contains reusable standards/templates/skills/patterns around:

- project bootstrap/grounding;
- server-first typed Next.js architecture;
- responsive/mobile/accessibility foundations;
- navigation/footer;
- media fallbacks and image optimisation;
- SEO/metadata;
- motion/animation primitives;
- QA;
- Vercel deployment/domain handover;
- agent automation.

Every new website should inherit the strongest verified foundation instead of rebuilding basics.

## 13. Creative quality lesson from Imbewu

Do **not** turn every future website into an Imbewu clone.

General lesson: a technically clean one-page site is not automatically premium.

Creative review should consider, where appropriate:

- visual storytelling density;
- human imagery/trust;
- section variety;
- hero depth/layering;
- overlapping/breakout composition;
- purposeful motion/immersive transitions;
- translucent/glass surfaces where brand-appropriate;
- opening/load animation where useful;
- multi-page architecture when content supports it;
- avoiding repetitive card-grid layouts;
- deliberate mobile composition.

These are available techniques, not mandatory styling.

### Pattern candidates discovered during Imbewu

Candidates only until visually approved/proven/extracted:

- opening brand reveal;
- frosted/matte glass navigation;
- human breakout image composition;
- dimensional/rotating hero stack;
- pointer-responsive hero depth;
- ambient living-background system;
- no-controls interactive marquee;
- browser-friendly contact modal: Copy email / Open Gmail / `mailto:` fallback.

Promotion process:

client implementation → visual approval → responsive/accessibility/performance proof → clean client-agnostic extraction → shared-system validation.

Do not promote an experimental client implementation directly into the shared Website System.

## 14. Responsive website standard

Minimum creative/QA viewport set:

Desktop: 1920, 1440

Tablet: 1024, 768

Mobile: 430, 390, 375

Mobile must be designed, not merely stacked.

Check at minimum:

- page overflow;
- navigation;
- image/video crops/fallbacks;
- hero composition;
- interactive elements;
- motion + reduced motion;
- typography/wrapping;
- touch targets;
- modals/dialogs/focus;
- performance;
- intentional horizontal scrollers remaining contained.

Automated lint/build is not a replacement for browser/device/visual QA.

## 15. Vercel / deployment / domain handover

Shared lessons:

- connect GitHub/Vercel early enough to verify automatic `main` deployment;
- record the real temporary Vercel URL;
- standard Next.js projects must not inherit stale static `public` output settings;
- current Vercel CLI capabilities must be checked before automation creates a project;
- framework/build/dev/install/output settings should be normalized/auto-detected for the canonical Next.js path before first Git deployment;
- local build success does not prove Vercel project configuration is correct.

For final domain connection:

- read the **exact DNS records shown by that project's current Vercel configuration**;
- inspect existing DNS/screenshots first;
- never guess registrar UI behaviour when visible state exists;
- preserve MX/SPF/DKIM/DMARC unless mail migration is explicitly in scope;
- change only web records required for the website;
- expect propagation and verify intended hosts;
- update canonical/OG/sitemap metadata to the real production domain after connection.

Screenshots/current DNS supplied by CA are source-of-truth evidence for visible state; generic registrar instructions must not contradict them.

## 16. New chat / project grounding protocol

A fresh ChatGPT/agent session must not behave like a blank generic assistant.

Before advising on an existing project:

1. identify the project;
2. read this master when shared tooling/workflow matters;
3. inspect the real repo/current GitHub state;
4. read repo-specific instructions/decisions/current phase;
5. inspect connected files/accounts where relevant;
6. distinguish verified facts from assumptions;
7. avoid setup/build work already completed elsewhere.

For a brand-new project, establish the human-controlled setup facts and use the verified shared startup path. Do not invent a repo/folder tree/coding mission and ask CA to catch up.

## 17. Master vs Website appendix

Authority split:

- this file = cross-project AI/tool/workflow authority;
- `cg-website-editor/website-system/AI-TOOLCHAIN.md` = website-specific implementation/tooling appendix;
- project `AGENTS.md` / docs = project-specific truth.

The website appendix must reference this master and not become a competing source for subscriptions/accounts/provider truth.

## 18. Connected tools

Use connected tools when they materially reduce manual work, but verify availability in the current session before claiming capability.

Examples:

- GitHub for repo/current state;
- Vercel for projects/deployments/build/runtime state;
- Gmail/Outlook/Calendar when correspondence/schedules matter;
- Supabase for authorised schema/data inspection;
- web research for current laws/standards/products/prices/professional guidance.

Never claim an external action happened without invoking the relevant tool.

### CG Dynamics Owner Dev Bridge

CG Dynamics now contains an isolated remote MCP development-control package at
`dev-bridge/`. It is designed to let an authorised owner ChatGPT client inspect
and develop only `CGProductionHouse/CG-Dynamics` through narrow GitHub,
validation, Vercel and fixed read-only Supabase tools. It is not a raw shell,
does not replace CG Assistant or Crestodian/Workboard, and has no merge,
production deploy, arbitrary SQL, secret, auth-change or default-branch write
tool. Activation and current ChatGPT plan/client constraints are documented in
`docs/owner-dev-bridge.md`.

## 19. Cross-agent anti-duplicate rules

Before starting work, ask:

- Is this already on `main`?
- Is an open PR already solving it?
- Is another agent/session actively working on it?
- Is there already a reusable pattern/skill/system for it?
- Is the requested behaviour intentionally locked by project docs?
- Am I about to create another source of truth?

If yes, reconcile/continue first.

## 20. Security / secrets

Never commit API keys, OpenCode auth tokens, provider billing secrets, passwords, Supabase service-role secrets, Vercel tokens or private credentials.

Track capability/process, not secret values.

## 21. Continuity loop

The biggest goal is that **each website/project should take less avoidable setup time than the previous one**.

Every project asks:

- What existing CG capability can solve this?
- What did the previous project teach us?
- Is this reusable or project-specific?
- Can the next project inherit it automatically?

New websites should spend more time on client-specific research/creative quality and less time rebuilding navigation, mobile menus, SEO, metadata, image optimisation, motion primitives, accessibility, deployment structure, contact fundamentals, project grounding and QA.

When a shared tool/process materially changes, update this master in the same work. Project-specific changes stay in project-specific continuity.
