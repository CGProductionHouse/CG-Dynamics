# Autonomous coding orchestration — CG Dynamics

Last updated: 7 September 2026.

This document is the continuity record for the new **wake-and-supervise coding-agent workflow**. Its purpose is to remove CA from being the manual relay between coding agents.

## Core operating model

GitHub is the durable control plane and handoff memory.

The target loop is:

1. CA states the product/business goal.
2. GitHub issues/comments/docs record the goal, constraints, ownership and current truth.
3. Coding workers wake independently, read current GitHub truth, and continue safe unowned work.
4. A supervisor checks progress, failures, duplication and blockers.
5. CA is only pulled back in for genuine product decisions, credentials/consent, risky production gates or physical-device acceptance.

Do **not** make CA repeatedly copy giant prompts between tools. Full specifications belong in GitHub. Capable coding agents should usually receive a short continuation instruction that points them at the current issue/control state.

## Current agent lanes

### ChatGPT — supervisor / product-control layer

Role:
- product direction and architectural continuity;
- GitHub control-plane actions;
- inspect PRs, commits, workflow runs and issue state;
- dispatch/re-dispatch workers through GitHub when supported;
- reconcile ownership and prevent duplicate broad work;
- maintain concise handoffs and product truth.

A ChatGPT automation named **CG Dynamics Supervisor** is configured to inspect the repo hourly and surface only meaningful progress, failed workers, real blockers or safe GitHub-control actions.

ChatGPT can currently wake the OpenCode GitHub worker by placing `/oc ...` or `/opencode ...` on a relevant issue/PR, then inspect the resulting GitHub Actions run and PR output.

### OpenCode — persistent autonomous GitHub worker

Implemented in PR #229 and merged to `main`.

Canonical files:
- `.github/workflows/opencode-autonomous.yml`
- `.github/workflows/opencode-on-demand.yml`
- `docs/automation/OPENCODE-AUTONOMOUS-WORKER.md`

Capabilities:
- scheduled hourly wake-up;
- on-demand wake-up from `/oc ...` or `/opencode ...` comments;
- manual GitHub Actions dispatch;
- GitHub-first continuity: read current `main`, Issue #216/latest control issue, open PR ownership and linked issues before working;
- implement/test/build/open or update PRs;
- leave concise evidence/blockers in GitHub;
- concurrency guard to prevent overlapping autonomous runs.

Current unattended safety boundary:
- may implement, test and open/update PRs;
- must not autonomously merge, deploy production, apply production migrations, change credentials/provider permissions, publish externally or make unsafe destructive guesses;
- production authority remains with the supervisor/CA until this lane has proven reliable.

Model routing is intentionally handled at the workflow/control level rather than relying on one long-lived model session. Primary can use a free OpenCode Zen model; optional quality and NVIDIA fallbacks can be configured. If one model/provider is rate-limited or unavailable, a new lane can start from GitHub truth rather than depending on stale conversational memory.

### Claude Code — primary long-session implementation worker

Claude Code remains a preferred heavy implementation agent because it can work autonomously for long stretches and has produced verified merged work in this repo.

Local/Cowork Claude remains separate from GitHub-hosted Claude partner-agent usage.

GitHub also supports **Anthropic Claude as a third-party coding agent powered by a paid GitHub Copilot plan**. That route can be enabled under GitHub Copilot cloud-agent settings and can work asynchronously on issues/PRs. It is a separate usage/billing lane from Claude Cowork/Claude Code sessions.

Important current account fact on 7 Sep 2026: the CGProductionHouse GitHub account is on **Copilot Free**, so GitHub shows the cloud agent as unavailable for assignment and third-party Claude/Codex partner agents cannot yet be enabled for this account. A paid Copilot plan is required before using this route.

### Codex / Astra

Use Codex for difficult specialist engineering/review when its quota is available. Do not rely on it as the only persistent worker because usage caps can interrupt long runs.

Thread automation/wake-up behaviour should be used where available so the same Codex thread can resume without CA repeatedly typing `continue`. GitHub remains the durable project memory regardless of Codex conversation state.

GitHub also supports **OpenAI Codex as a third-party coding agent** on paid Copilot plans; this is a separate GitHub/Copilot usage lane from the Codex app quota.

### Crestodian

Crestodian remains the orchestration/watchdog lane. Before giving Crestodian work, check active Claude/OpenCode/Codex ownership so it does not duplicate a broad mission.

Its best role is independent dispatch/research/QA/control work rather than competing with an already-owned implementation branch.

## Worker selection rule

Choose agents by **autonomy + availability + cost + fit**, not by loyalty to one model.

Ask:
- Can the worker be woken remotely?
- Can it read GitHub truth without CA restating context?
- Can it work unattended and return a PR/evidence?
- Can it resume after rate limits or switch providers/models?
- Is the cost sensible for the task?
- Does another agent already own this code area?

Prefer a cheaper/free persistent worker for bounded engineering when it is good enough; reserve expensive high-capability models for hard architecture, debugging, review or tasks where quality materially matters.

## Model/provider fallback principle

Do not let one depleted provider stop the whole project.

Where supported, use an ordered routing strategy such as:
1. free/low-cost capable model;
2. higher-quality paid model;
3. independent provider/model fallback;
4. try again on the next scheduled wake-up if every configured lane is rate-limited.

The fallback should restart from current GitHub truth so it does not need private conversational state from the failed model.

Never silently create paid usage or add provider billing without CA approval.

## GitHub is the handoff contract

Every autonomous worker must:
- read current `main` first;
- read the latest relevant control issue/comments;
- inspect active PR ownership before editing;
- avoid duplicate architecture/branches;
- write meaningful progress, decisions and real blockers back to GitHub;
- leave the repository in a state the next worker can understand without the previous chat transcript.

For launch work, Issue #216 remains the control issue until superseded by a newer explicit control issue/comment. Latest comments/current `main` override stale issue-body snapshots.

## Short-prompt rule

For capable agents, prefer prompts like:

> Continue Issue #216 from current GitHub truth. Read latest comments/open PR ownership first. Take the highest-priority safe unowned launch task through implementation and verification. Update GitHub as you work. Do not duplicate active work or invent credentials.

Do not paste the entire architecture into every coding-agent prompt. Put the architecture/spec in GitHub once and keep it current.

## Current discovery backlog

Next tooling lanes to evaluate after OpenCode/Claude GitHub integration:
- Cursor Cloud Agents / scheduled automations;
- OpenHands as a possible multi-agent control surface;
- GitHub Copilot cloud agent once a paid Copilot plan exists;
- GitHub partner-agent Claude and Codex once eligible;
- other coding agents that can be remotely dispatched, scheduled, audited and handed GitHub-first work.

Research these proactively when they can reduce CA involvement or create a cheaper/stronger fallback lane.

## Safety / authority

Autonomy does not override security.

Never:
- weaken auth/RLS/client isolation;
- invent credentials or provider consent;
- copy local OAuth/session credentials into GitHub secrets without a reviewed architecture;
- merge/deploy/apply production SQL from an unproven unattended lane;
- make destructive data/file moves based on names/path guesses;
- publish externally without explicit authority.

The goal is **less human relay**, not less engineering discipline.
