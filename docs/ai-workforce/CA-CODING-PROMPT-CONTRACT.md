# CA coding-agent prompt contract

Status: CURRENT and mandatory for every prompt CA manually sends to a coding agent.

## Hard rule

GitHub is the brief. CA must not carry the brief between agents.

Before writing a manual-agent prompt:
1. inspect current GitHub truth;
2. perform every safe supervisor action directly;
3. write any substantial new requirement into the owning issue/PR;
4. then send only the tiny execution prompt.

## Hard size limit

Normal CA manual-agent prompt:
- target: 4-7 short nonblank lines;
- hard cap: 10 nonblank lines;
- hard cap: about 140 words.

If the mission needs more than that, the coordinator must put the detail in GitHub first and shorten the prompt.

A long prompt is allowed only when CA explicitly asks for a full handover/spec or an external protected operation genuinely cannot be represented safely in GitHub.

## Required shape

```text
CA MANUAL AGENT

Read AGENTS.md + latest <issue/PR>. GitHub is the full brief.
Continue <lane>. Next action: <one scoped objective>.
Do not touch <only necessary exclusion>.
Verify and update GitHub. Return completed / verification / blocker.
```

Do not add project history, architecture summaries, file-by-file implementation instructions, acceptance lists or prior results already recorded in GitHub.

## After an agent result

The coordinator must:
1. inspect the real PR/issue/diff/current production truth;
2. perform every safe merge/deploy/comment/fix directly;
3. update durable GitHub state;
4. automatically send one tiny follow-up prompt only if the local agent still has work.

Do not make CA ask “what next?”.
Do not respond with a roadmap when the next step can already be executed.
Do not resend a prompt CA already sent unless the lane actually changes.

## Multiple agents

One short prompt per active manual agent.
Never combine multiple detailed missions into one giant prompt.
Each prompt points to exactly one owning issue/PR or a clearly ordered continuation already written there.

## User-facing response around prompts

Keep the chat wrapper brief:
- what the supervisor actually completed;
- the one real blocker, if any;
- the short prompt(s).

Do not surround a 6-line prompt with an essay.

## Security

Never put secrets, passwords, tokens or private keys into a coding-agent prompt.

When a local credential source exists, the prompt may identify its local location only when needed and must state that credentials are entered only into the provider-owned login UI and never echoed to terminal/GitHub/chat/logs.

## Success test

If an agent can recover a detail from `AGENTS.md`, the owning issue/PR, current `main`, or the ops handover, that detail does not belong in CA's prompt.

If the coordinator can safely perform the step with connected tools, perform it instead of asking CA or the coding agent to do it.
