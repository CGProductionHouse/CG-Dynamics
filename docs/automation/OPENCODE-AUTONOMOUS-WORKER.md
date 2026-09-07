# OpenCode autonomous worker

## Purpose

Use GitHub as the persistent control plane so OpenCode can keep CG Dynamics moving without CA manually relaying `continue` prompts.

## Workflows

- `.github/workflows/opencode-autonomous.yml`
  - wakes hourly at minute 17;
  - can also be run manually from GitHub Actions;
  - reads current `main`, Issue #216, latest comments and open PR ownership before choosing work;
  - works only on safe unowned engineering work;
  - opens/updates PRs and GitHub evidence;
  - does not merge, production-deploy, apply production migrations, change credentials/provider permissions, or publish externally;
  - concurrency guard prevents overlapping autonomous runs.

- `.github/workflows/opencode-on-demand.yml`
  - `/oc ...` or `/opencode ...` in an issue/PR comment wakes OpenCode on that exact thread;
  - manual `workflow_dispatch` supports a direct prompt from GitHub Actions.

## Model routing

The scheduled worker uses an explicit ordered fallback at the GitHub workflow level rather than trusting one long-lived OpenCode session to switch providers correctly after quota errors.

1. `OPENCODE_PRIMARY_MODEL`
   - repo variable;
   - default: `opencode/nemotron-3-ultra-free`.
2. `OPENCODE_FALLBACK_MODEL_1`
   - repo variable;
   - default: `opencode/gpt-5.6-sol`.
3. `OPENCODE_NVIDIA_MODEL`
   - repo variable;
   - optional exact NVIDIA model ID from OpenCode's current `/models` catalog.

If a lane fails, the next configured lane starts from GitHub truth. This is deliberate: GitHub state is the durable memory, not the previous model session.

### Important billing/auth boundary

On a GitHub-hosted runner, `opencode/gpt-5.6-sol` uses the configured OpenCode Zen credential/balance. It does **not** consume CA's ChatGPT Plus/Pro subscription session.

OpenCode locally supports ChatGPT Plus/Pro browser authentication. If we want scheduled work to consume that local subscription instead, the next phase is an official GitHub **self-hosted runner** on CA's Windows machine using the existing local OpenCode auth state. That only runs while the PC/runner is online and should not copy OAuth credentials into GitHub Secrets.

## Required one-time repository setup

GitHub Actions secrets:

- `OPENCODE_API_KEY` — OpenCode Zen key used by the primary/free Zen lane and Zen fallback.
- `NVIDIA_API_KEY` — optional; required only for the independent NVIDIA fallback lane.

GitHub Actions variables (optional):

- `OPENCODE_PRIMARY_MODEL`
- `OPENCODE_FALLBACK_MODEL_1`
- `OPENCODE_NVIDIA_MODEL`

Install/authorize the official OpenCode GitHub app for this repository if it is not already installed.

## Operating rules

- GitHub is source of truth.
- Do not duplicate an active Claude/Codex/Crestodian/OpenCode-owned PR or mission.
- Prefer finishing existing launch work over starting new architecture.
- Safe unattended output stops at a verified PR/review gate.
- Production authority stays with the supervisor until the autonomous lane has proven reliable.
- If all model lanes fail or are rate-limited, the hourly schedule tries again on the next wake-up.

## Supervisor integration

ChatGPT/Crestodian can wake the worker by adding `/oc <instruction>` to the relevant GitHub issue or PR, inspect the resulting workflow/PR, and redirect the next run by updating GitHub truth. This removes CA from the normal dispatch loop while preserving a durable audit trail.
