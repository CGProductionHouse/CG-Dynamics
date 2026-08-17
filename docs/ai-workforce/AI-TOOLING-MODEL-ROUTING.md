# AI Tooling and Model Routing

Last updated: 17 August 2026

This document tracks the AI systems used **inside CG Dynamics** and the separate AI tools/models used by CA to **build, review and research** CG systems. These are related but must not be confused.

No API keys, tokens or secrets belong in this file or anywhere else in GitHub.

## 1. Three separate AI layers

### A. CG Dynamics product AI

This is application functionality shipped inside CG Dynamics:

- CG Assistant;
- AI Workforce / specialist agents;
- Marketing AI;
- reviewed Marketing/Knowledge retrieval;
- future staff-specific agents and management routing.

Product AI remains provider-agnostic and server-side. Model/provider changes must not weaken permissions, client isolation, review gates, citations, auditability or confirmed-write rules.

Canonical architecture references:

- `docs/ai-department-architecture.md`
- `docs/ai-workforce/AI-WORKFORCE-MASTER-ARCHITECTURE.md`
- `docs/ai-workforce/AI-WORKFORCE-IMPLEMENTATION-PLAN.md`
- `docs/agent-operating-model.md`

### B. External development agents

These help CA build and maintain CG software. They are **not** CG Dynamics runtime AI.

| Tool | Current role |
|---|---|
| ChatGPT | Product direction, GitHub inspection, prompt control, review, second opinion and cross-project continuity. |
| Claude Code | Primary heavy engineering agent for large architecture, substantial multi-file work and repo-wide missions. Do not micromanage it file-by-file. |
| OpenCode | Practical workhorse for bounded implementation, routine coding, fixes and continued work when other agent usage is constrained. OpenCode is a shell over selectable model providers; it is not synonymous with DeepSeek. |
| Codex | Focused coding/review work when useful and available; keep prompts tight because usage can be constrained. |
| Gemini / Google tools | Secondary option. Keep available, but CA has found current quota/cap behaviour too restrictive for regular coding use. |

Agents must check GitHub `main`, open PRs and continuity docs before starting work so multiple agents do not solve the same problem twice.

### C. External research/model services

These are optional model/provider resources used for research or as model backends. They do not automatically become CG Dynamics production dependencies.

A future paid Google research/deep-research option may be considered for a research/custodian role working on Media/Marketing Library research. This is a **candidate decision only**, not an approved subscription or production dependency.

## 2. OpenCode workstation checkpoint

Confirmed by CA on 17 August 2026:

- OpenCode CLI version: `1.18.18`.
- Global model cache refresh completed successfully with `opencode models --refresh`.
- OpenCode Desktop exposes a very large Models.dev/provider catalogue, including many legacy model versions.
- The previous selected DeepSeek V4 Flash endpoint reached end-of-life and failed; stale/retired models therefore must not remain durable defaults.

The model catalogue is dynamic. Exact model names in this file are a dated checkpoint, not a permanent truth.

## 3. OpenCode provider strategy

### OpenCode Zen — free fallback pool

Purpose: free/included models for cheap or fallback work.

Current catalogue includes several free OpenCode Zen entries. Keep the provider available, but curate the model selector so obsolete/low-value entries do not clutter daily use.

Free availability and model identities can change. A free model must not be assumed healthy merely because it still appears in the catalogue.

### OpenRouter — primary paid API route for OpenCode

CA has a separate API-backed OpenCode route intended to avoid being limited by OpenCode Zen's free-model quota. Treat OpenRouter as the primary paid multi-model route unless CA deliberately changes provider strategy.

Rules:

- prefer a small curated current model set rather than hundreds of catalogue entries;
- prefer stable current aliases such as `...latest` where they are suitable, or a deliberately pinned current model when reproducibility matters;
- never keep a known retired model as a project/global default;
- model choice should reflect job type, quality, speed and cost rather than brand loyalty;
- provider/model retirement is maintenance, not a reason to redesign agent workflows.

Current refreshed catalogue confirms current OpenRouter families are available for Anthropic/Claude, DeepSeek, Google/Gemini, Moonshot/Kimi, OpenAI, Qwen, GLM and others. The visible catalogue is not the approved daily shortlist.

### Google

Keep Google available as a secondary provider/research option for now.

CA's current operational feedback: Google model usage is capped too aggressively to be dependable as the main coding workhorse. Do not architect critical coding continuity around Google quota being available.

Potential future decision: evaluate a paid Google research/deep-research product specifically for high-volume Media/Marketing Library research. Confirm current product, pricing, quotas and terms before any purchase.

### Direct OpenAI / other providers

A provider or model appearing in OpenCode's catalogue does **not** prove that CA has intentionally configured a paid API route for it. Do not record a provider as active/paid merely because its section is visible in Manage Models.

Before changing provider strategy, inspect the local OpenCode config/auth state without printing secrets.

## 4. Model-selector policy

The goal is a **small, current working set**, not a museum of every model exposed by Models.dev.

Keep visible/selectable models in three buckets:

1. **Free fallback** — a few current OpenCode Zen models that are verified working.
2. **Primary paid coding** — a few current OpenRouter models suitable for implementation/reasoning/tool use.
3. **Research/specialist** — only current Google/research or specialist models that have a real workflow reason to exist.

Hide old/legacy model versions from the daily selector when they are not intentionally needed. Do not delete historical model names from documentation, logs or audit records when they explain past runs.

A legacy model may remain temporarily visible only when a specific compatibility/reproduction task requires it.

## 5. OpenCode global vs project configuration

OpenCode supports a global config and project-level config. Project settings can change what happens inside one repository, so a stale model override can survive even after the global model catalogue is refreshed.

Before diagnosing model failures, inspect:

- global OpenCode config under the user's OpenCode config directory;
- project `opencode.json` files;
- connected providers;
- currently selected session model;
- model-cache freshness.

Do not commit machine-specific credentials or auth files to any repo.

## 6. Maintenance procedure

Run this when a model is retired, the selector becomes stale, or approximately monthly while OpenCode is being used heavily:

```powershell
opencode --version
opencode upgrade
opencode models --refresh
```

Then:

1. restart OpenCode Desktop;
2. remove/hide retired and redundant models from the selector;
3. confirm the global default points to a current model;
4. search project `opencode.json` files for stale model overrides;
5. smoke-test the chosen free fallback and paid primary route;
6. update this document only when provider roles or the curated model policy materially changes.

Do not hardcode a model name into every project merely to make today's selection consistent. Prefer global policy unless a project genuinely requires a different model.

## 7. Model retirement / failure rule

If a provider reports end-of-life, unavailable, gone/410 or model-not-found:

- stop retrying the dead identifier;
- refresh the model catalogue;
- check whether the model was selected only for the current session or hardcoded globally/project-locally;
- move to a current replacement in the same role;
- update any durable config that still points to the dead identifier;
- preserve the failure in logs/history when relevant;
- do not let a model retirement trigger duplicate application code or a new AI architecture.

## 8. Cost and routing principle

Use the cheapest model that can perform the task reliably, but do not optimise cost by accepting repeated failures or poor engineering.

Suggested routing principle:

- simple bounded edit / repetitive implementation → capable low-cost OpenCode model;
- difficult multi-file engineering or architectural ambiguity → Claude Code or another proven strong coding model;
- independent review / product reasoning → ChatGPT or a separate strong reviewer;
- broad evidence-heavy research → purpose-fit research model/tool with source capture and human review;
- CG Dynamics runtime AI → server-side routing governed by the application's AI architecture, not by CA's desktop coding-agent preferences.

## 9. Security and continuity

Never store in GitHub:

- OpenRouter API keys;
- Google API keys;
- OpenAI/Anthropic keys;
- OpenCode auth/session tokens;
- paid-provider billing secrets.

Store only provider roles, non-secret configuration principles, known quota/quality observations and maintenance decisions.

When another AI agent changes the coding/research stack, it must update this file and `docs/agent-operating-model.md` in the same work so the next agent does not repeat setup work or reintroduce retired models.
