# CA coding-agent prompt contract

Status: CURRENT cross-project authority for prompts CA manually sends to coding agents.

This file exists because long handover prompts waste CA's time and premium model context when the repository already contains the authority.

## Hard rule

When CA asks ChatGPT for a coding-agent prompt, ChatGPT must first inspect current GitHub truth and then produce the **shortest prompt that can safely execute the next scoped mission**.

Do not restate the project's history, architecture, roadmap, file-by-file plan, prior results, reusable standards, or already-recorded acceptance criteria unless the agent genuinely cannot recover them from repository authority.

## Required sequence before writing a prompt

1. Inspect current GitHub state for the exact repo: `main`, relevant branch/PR, latest commits, open issue ownership and blockers.
2. Read/use the repo's `AGENTS.md` and current authority docs rather than copying them into the prompt.
3. Confirm whether an existing branch/PR already owns the mission.
4. Identify only the **next unblocked scoped task**.
5. Then write the prompt.

## Default prompt size

Normal implementation prompt: **roughly 4-10 short lines**.

Preferred shape:

```text
CA MANUAL AGENT

Read AGENTS.md and current GitHub truth first.
Continue <existing issue/PR/phase>.

Next mission: <one scoped objective>.
Acceptance: <only the few result-specific checks not already in repo docs>.
Do not touch <specific active/held lane if needed>.

Verify, commit and push only if green.
Return: completed / verification / commit / blockers.
```

For websites with an approved phase, the prompt can be even shorter:

```text
CA MANUAL AGENT
Read AGENTS.md and the current approved PHASE-X.md.
Implement the next unblocked scope using the shared Website System.
Verify, commit and push only if green.
Return completed / verification / commit / blockers.
```

## Long prompts are the exception

A long prompt is allowed only when at least one of these is true:

- genuinely new architecture has not yet been captured in repo authority;
- genuinely new creative/product direction still needs to be conveyed;
- a one-off external/live operation needs exact safety boundaries not stored elsewhere;
- CA explicitly asks for a full handover/specification prompt.

If substantial instructions are needed repeatedly, **write/update the repo authority first**, then send a short execution prompt pointing to it.

## CA manual agent naming

Prompts that CA personally copies/runs must be labelled:

`CA MANUAL AGENT`

This keeps them separate from ChatGPT-managed autonomous agent lanes.

## Never do this

Do not send CA a giant prompt merely because more context is available.
Do not make the coding agent re-read research that another agent already committed to GitHub.
Do not duplicate acceptance criteria already present in an issue/PHASE-X/PR unless the specific next slice needs clarification.
Do not ask CA to paste repo history into a coding terminal.

## Success test

If the agent can recover the missing detail by reading `AGENTS.md`, the current issue/PR/phase docs, or GitHub state, that detail normally does **not** belong in CA's prompt.
