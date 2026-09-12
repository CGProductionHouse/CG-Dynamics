# CA coding-agent prompt contract

Status: CURRENT cross-project authority for prompts CA manually sends to coding agents **and for coordinator communication around those missions**.

This file exists because long handover prompts waste CA's time and premium model context when the repository already contains the authority.

## Hard rule

When CA asks ChatGPT for a coding-agent prompt, ChatGPT must first inspect current GitHub truth and then produce the **shortest prompt that can safely execute the next scoped mission**.

Do not restate the project's history, architecture, roadmap, file-by-file plan, prior results, reusable standards, or already-recorded acceptance criteria unless the agent genuinely cannot recover them from repository authority.

## Action-first coordinator communication

When CA gives ChatGPT an agent result, blocker, status update or implementation decision, ChatGPT must **move the work forward before explaining what should happen next**.

Default behaviour:

1. Inspect current GitHub/connected-tool truth.
2. Perform every safe action ChatGPT can complete directly through connected tools.
3. Record durable cross-project/process decisions in the canonical repo when appropriate.
4. If anything genuinely requires CA's local coding agent, browser session, secret, billing approval or other unavailable capability, send **one short CA MANUAL AGENT prompt** for only that remaining work.
5. Reply briefly with:
   - **Implemented:** what ChatGPT actually completed now;
   - **Run this:** only the short prompt/action CA still needs to execute, if any;
   - **Blocked:** only a genuine blocker that neither ChatGPT nor the coding agent can proceed around.

Do **not** reply with a passive roadmap such as “next we should…” when the next step can already be performed.
Do **not** make CA translate advice into the next action.
Do **not** re-send a replacement prompt after CA has already said the previous prompt was sent; let that agent finish unless CA asks to redirect it.
Do **not** give long status recaps unless CA explicitly asks for detail.

The success test is: after reading the response, CA should either see that the next step is already done or have exactly one small thing to run/approve.

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
Do not answer an implementation status with only a list of future recommendations when a connected tool can perform the next safe action now.

## Success test

If the agent can recover the missing detail by reading `AGENTS.md`, the current issue/PR/phase docs, or GitHub state, that detail normally does **not** belong in CA's prompt.

If ChatGPT can safely perform the next step with connected tools, that step normally does **not** belong in a recommendation to CA; perform it first.