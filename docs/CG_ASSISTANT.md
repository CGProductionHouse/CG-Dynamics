# CG Dynamics Assistant Working Agreement

**Audience:** ChatGPT sessions and coding agents contributing to CG Dynamics  
**Status:** Active  
**Last updated:** 2026-07-20

## Required reading order

Before major planning or implementation work:

1. Read `docs/VISION.md`.
2. Read `docs/CORE_PRINCIPLES.md`.
3. Read `docs/CHAT_CONTINUITY.md` when continuing the project in a new ChatGPT conversation.
4. Read the current milestone and relevant trackers under `docs/vision/`.
5. Read relevant implementation files, migrations, routes, tests and latest commits.
6. Treat current GitHub code and reviewed milestone documents as the technical source of truth.

Historical handovers may explain why decisions were made, but they must not override newer current-state documents or implementation.

## Documentation-first workflow

After a meaningful product or vision session:

- Update `docs/VISION.md` when current product direction changes or matures.
- Update `docs/CORE_PRINCIPLES.md` when a durable product or UX guardrail is established.
- Update this file when the development workflow changes.
- Update `docs/CHAT_CONTINUITY.md` with the latest project state and exact continuation point.
- Do this before issuing major implementation prompts.

These are living documents. They should contain current truth rather than an exhaustive transcript of every historical idea.

## GitHub workflow

- GitHub is the source of truth.
- Before writing a coding prompt, inspect the relevant branch, latest commit and affected files.
- Confirm the exact target branch before writing.
- Never write directly to `main` unless Christie-Ann explicitly instructs it.
- Use GitHub write actions directly when available.
- Use `create_file` only for new paths.
- Fetch an existing file and its current SHA before using `update_file`.
- Verify remote writes and report the resulting full commit SHA.
- A remote GitHub write does not update the user's local Windows worktree; the local environment must later pull it.
- Never claim a local build was run when only the GitHub connector was used.

Known repositories include:

- CG Dynamics: `CGProductionHouse/CG-Dynamics`
- CG Hours: `CGProductionHouse/CG-Hours`
- Red Oak Rugby Table League App: `CGProductionHouse/RedOak-RugbyTableLeague-App`
- Red Oak Rugby Table League: `CGProductionHouse/RedOak-RugbyTableLeague`
- Piek Group Website: `CGProductionHouse/PiekGroup-Website`
- Get Together Website: `CGProductionHouse/gettogether-website`
- CG Website Editor: `CGProductionHouse/cg-website-editor`

## Prompting coding agents

- Keep one task per prompt wherever practical.
- Avoid repeating large project histories when the repository documents already contain them.
- Tell the agent exactly which current documents to read.
- For major feature work, require the agent to preserve `VISION.md` and `CORE_PRINCIPLES.md` constraints.
- Require `git status` first, then pull the target branch before local work.
- Require build and relevant tests before commit.
- Commit and push only when validation passes.
- Use short inline prompts for small fixes.
- Create downloadable prompt files only for genuinely long prompts.

## Tooling context

Christie-Ann uses a mixed coding-agent workflow:

- Codex for strong repository and autonomous engineering work.
- Claude Code when available for complex implementation and reasoning.
- OpenCode with DeepSeek as a practical continued-development workhorse.
- Gemini CLI as a backup.
- Cline and Roo Code as optional VS Code backups.
- Visual Studio Code on Windows for local development.
- GitHub for repository source of truth.
- Vercel for deployment and previews.

Do not assume one agent has all context. Repository documentation must carry the product intent between tools.

## Autonomous QA expectation

Christie-Ann is the product owner, not the routine QA operator.

Coding agents should autonomously:

- Establish and reuse authenticated QA sessions.
- Test admin, manager, staff and client behaviour as applicable.
- Test desktop and mobile layouts.
- Run previews and inspect structured results.
- Fix defects and retest.
- Return evidence and recommendations.

Do not ask Christie-Ann to perform routine button clicks, screenshots, data copying or browser checks that can be automated.

Ask her only for:

- A genuine product or business decision.
- Explicit approval before consequential production actions.
- Account ownership or identity steps that cannot technically be completed without her.

A dedicated CG Dynamics QA admin identity exists for reusable authenticated testing. Credentials must remain outside Git and must never appear in prompts, logs, reports or screenshots.

## Production safety

Coding agents may autonomously inspect, preview, create clearly marked temporary QA data, test and deploy preview branches.

Pause for explicit approval before:

- Applying major production imports.
- Approving source removals.
- Destructive migrations.
- Deleting real production records.
- Sending real client communications.
- Enabling paid services.
- Changing external account ownership.

## Product-owner communication

- Christie-Ann prefers practical, direct guidance.
- Do not bury the next action in a long explanation.
- Explain product consequences clearly when a decision is needed.
- Infer obvious transcription errors from context rather than getting stuck on wording.
- Do not overcomplicate the application to demonstrate technical sophistication.
- Preserve previously agreed workflows unless intentionally changing them.

## Important standing product rules

- CG Calendar is operational; Client Schedule owns scheduled posts.
- Client Schedule must remain calendar-first.
- Digital Content Guides replace PDF guides as the source of truth.
- One voice note should finish a content run and let AI apply the result.
- AI should remove work and produce human-sounding marketing based on trusted sources.
- Industry Brains support isolated Client Brains.
- Client approvals, rejections, content-run outcomes and performance should teach the system.
- CG Hours remains separate.
- Sensitive financial and payroll information does not belong in general CG Dynamics assistant workflows.

## New-chat continuation

When a ChatGPT conversation reaches its limit, start a new conversation and instruct it:

> Read `docs/VISION.md`, `docs/CORE_PRINCIPLES.md`, `docs/CG_ASSISTANT.md` and `docs/CHAT_CONTINUITY.md` in `CGProductionHouse/CG-Dynamics`, then inspect the current branch, milestone and latest commits before continuing.

A new assistant must not rely only on `CHAT_CONTINUITY.md`; it must verify current GitHub state because the repository may have progressed since that file was updated.
