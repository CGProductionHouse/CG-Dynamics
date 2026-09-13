# OpenCode autonomous worker

## Purpose

Use GitHub as the persistent control plane so OpenCode can keep CG Dynamics moving without CA manually relaying `continue` prompts.

## Workflows

- `.github/workflows/opencode-autonomous.yml`
  - wakes hourly at minute 17;
  - can also be run manually from GitHub Actions;
  - reads current `main`, Issue #216, latest comments and open PR ownership before choosing work;
  - works only on safe unowned engineering work;
  - opens/updates PRs for real code changes;
  - is notification-silent by default: routine progress, status and evidence stay in workflow logs, commits and PR bodies instead of issue/PR comments that email subscribed team members;
  - genuine blockers are surfaced by the supervisor rather than repeated bot comments;
  - does not merge, production-deploy, apply production migrations, change credentials/provider permissions, or publish externally;
  - concurrency guard prevents overlapping autonomous runs;
  - model-lane exhaustion is recorded in the workflow log without deliberately failing the run just to generate notification mail;
  - the primary lane is step-bounded (`timeout-minutes: 30`) below the 55-minute job
    timeout so a fallback lane always keeps real execution time (issue #357);
    a step-level timeout concludes the step as `cancelled`, so every fallback
    step triggers on `failure` **or** `cancelled` outcomes instead of being skipped.

- `.github/workflows/opencode-on-demand.yml`
  - `/oc ...` or `/opencode ...` in an issue/PR comment wakes OpenCode on that exact thread;
  - manual `workflow_dispatch` supports a direct prompt from GitHub Actions;
  - comment-triggered mode inherently creates/updates a GitHub bot comment, so it is reserved for deliberate ad-hoc use rather than routine supervisor dispatch;
  - OpenCode action-step failures are allowed to conclude without turning the whole workflow into a notification-generating failed run; supervisors inspect logs directly;
  - both jobs bound the Go quality lane (`timeout-minutes: 30`) below the 55-minute
    job timeout and trigger the free fallback on `failure` or `cancelled` (issue #357).

## Model routing

The scheduled worker uses an explicit ordered fallback at the GitHub workflow level rather than trusting one long-lived OpenCode session to switch providers correctly after quota errors.

1. `OPENCODE_PRIMARY_MODEL`
   - repo variable;
   - default: `opencode/nemotron-3-ultra-free`;
   - step-bounded to 30 minutes; if it fails, times out or is cancelled, the Go lane starts from GitHub truth.
2. Go quality lane (`OPENCODE_GO_API_KEY`, model `opencode-go/glm-5.3`)
   - fixed in the workflow;
   - per current CA authority GLM-5.3 is the preferred serious-coding Go model and the DeepSeek V4 Pro hardcode was removed (issue #357);
   - receives the remaining job window after the primary lane ends.
3. `OPENCODE_FALLBACK_MODEL_1`
   - optional repo variable;
   - set to `opencode/gpt-5.6-sol` if CA explicitly wants the paid Zen quality fallback enabled.
4. `OPENCODE_NVIDIA_MODEL`
   - optional repo variable;
   - exact NVIDIA model ID from OpenCode's current `/models` catalog.

If a lane fails, times out or is cancelled, the next configured lane starts from GitHub truth. This is deliberate: GitHub state is the durable memory, not the previous model session.

### Important billing/auth boundary

On a GitHub-hosted runner, `opencode/gpt-5.6-sol` uses the configured OpenCode Zen credential/balance. It does **not** consume CA's ChatGPT Plus/Pro subscription session. The workflow therefore does not enable Sol by default; paid fallback is opt-in.

OpenCode locally supports ChatGPT Plus/Pro browser authentication. If we want scheduled work to consume that local subscription instead, the next phase is an official GitHub **self-hosted runner** on CA's Windows machine using the existing local OpenCode auth state. That only runs while the PC/runner is online and should not copy OAuth credentials into GitHub Secrets.

## Required one-time repository setup

GitHub Actions secrets:

- `OPENCODE_API_KEY` — OpenCode Zen key used by the primary/free Zen lane and any configured Zen fallback.
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
- Routine agent progress must not be posted as repetitive issue/PR comments. The supervisor reads GitHub state, workflow logs and PRs directly.
- Production authority stays with the supervisor until the autonomous lane has proven reliable.
- If all model lanes fail or are rate-limited, the hourly schedule tries again on the next wake-up without deliberately generating email noise.

## Supervisor integration

ChatGPT/Crestodian should prefer the scheduled autonomous worker and inspect its workflow/PR output directly. `/oc <instruction>` on an issue or PR remains available for a deliberate thread-specific intervention, but it is not the normal dispatch path because OpenCode's GitHub action creates a bot progress/result comment and GitHub may email subscribed team members. This keeps CA and the broader CG team out of routine agent progress noise while preserving a durable audit trail in GitHub.
