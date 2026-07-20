# CG Dynamics Chat Continuity

**Purpose:** Continuity backup for future ChatGPT conversations  
**Audience:** ChatGPT helping Christie-Ann continue CG Dynamics  
**Last updated:** 2026-07-20

## Current snapshot

- Repository: `CGProductionHouse/CG-Dynamics`
- Active Microsoft transition PR: `#27` on `feature/microsoft-transition-sync`
- Latest reported Microsoft sync commit: `9424ebf6b9b48d415d5ca0b8a7396663b97698ba`
- Separate AI Workforce documentation branch: `feature/ai-workforce-db-design`
- Current product-owner priority: finish Microsoft transition safely, then move into Digital Content Guides, Client Brains and specialist AI architecture.

Always verify these details against GitHub before acting because code and branches may have progressed after this file was updated.

## Exact continuation point

The Microsoft transition sync has reached a corrected autonomous preview:

- 1,648 source records.
- 539 creates.
- 248 conflicts.
- 861 skipped.
- 0 failed.
- All five sources complete.
- `unsupported_bucket = 0`.
- 22 Microsoft sync tests passed.
- Build passed.
- Vercel deployment passed.
- Recommendation reported by the coding agent: `SAFE TO APPLY`.
- Nothing was applied.
- No source removals were approved.
- No Microsoft writes occurred.

A dedicated persistent QA admin identity and reusable authenticated browser session were created for autonomous testing. Do not expose or request its credentials in chat. Use the existing secure QA workflow.

Before any first production reconciliation, inspect PR #27 and the latest conflict breakdown. Require explicit product-owner approval for the Apply action and any source removals.

## Microsoft transition architecture

- One-way, repeatable Microsoft to CG reconciliation during coexistence.
- Microsoft remains read-only upstream.
- CG Dynamics is the execution view.
- No Microsoft writes.
- Completeness-aware reconciliation.
- Supports create, update, unchanged, complete, reopen, move, cancel, archive/source-removed, conflict, skipped and failed states.
- Preserves CG-only fields.
- No hard deletes.
- Source removals require explicit approval.
- Outlook maps exclusively to CG Calendar.
- Operational Planner sources map to operational destinations.
- Client Socials maps exclusively to `monthly_deliverables` and Client Schedule.
- Unknown and ambiguous mappings fail closed.

Resolved mapping work included:

- To Do categories mapping into `operations-todo`.
- CG Socials source buckets mapping to `CG Schedule` and `CG Studio Schedule`.
- MASTER CLIENT TO DO source buckets resolving as clients and routing into `CLIENT REQUESTS`.
- `EHRLICH PARK` aliasing to Ehrlich Park Butchery.
- Supa Quick remaining intentionally ambiguous where two active clients exist.

## Current product vision additions

Recent sessions matured the AI and content-production vision.

### Specialist AI hierarchy

The intended hierarchy is:

1. Shared CG marketing and business knowledge.
2. Industry Brains.
3. Client Brains.
4. Campaign and Digital Content Guide context.
5. Content Run outcomes.
6. Performance learning.

Industry Brains are built from trusted human and measured sources and provide current, sector-specific marketing guidance.

Every active client has an isolated Client Brain that inherits the correct Industry Brain and adds brand, audience, products, tone, approved wording, rejected ideas, content pillars, assets, history and performance.

The purpose is to humanise captions, scripts, designs and campaign ideas. Generic AI language is unacceptable.

### Digital Content Guides

PDF content guidelines should be replaced by structured Digital Content Guides in the app.

The Content Guide should connect:

- Client.
- Content run.
- Internal operational calendar event.
- Client-visible operational event where appropriate.
- Staff assignment.
- Industry Brain and Client Brain.
- Internal review.
- Client approval, amendment, rejection and comments.
- Editing and Client Schedule handoff.

AI should suggest content using relevant industry research, seasonal opportunities and public holidays only when appropriate to the specific business.

### One-voice-note Content Run completion

The employee should tap Finish Content Run and record one natural voice note.

The AI should automatically apply what it hears and produce a short review summary covering:

- Videos completed or shot.
- Videos amended on site.
- Videos rejected or no longer appropriate.
- Approved videos not completed.
- Videos to move to the next content run.
- Expired time-sensitive ideas that should not carry forward.
- New client preferences and useful learnings.

Do not turn this into several questions or a manual report form. The less manual work staff and clients perform, the more successful the product is.

## Calendar regression to investigate

Christie-Ann recently reviewed Client Schedule and found that the schedule view appeared as buckets rather than a genuine calendar.

This conflicts with an established product rule:

- Client Schedule must default to a real calendar showing the month, days, dates and scheduled times.
- Bucket or board view may exist only as an optional view.
- CG Calendar remains operational and does not own scheduled social posts.

Treat the current behaviour as a regression or unresolved UX issue. It must be tested through the authenticated browser workflow and corrected without asking Christie-Ann to perform manual QA.

## Core product philosophy

The governing idea is not simply more AI. It is less administration.

- Every feature should remove work rather than create work.
- Every interaction should leave the system smarter.
- Clients should experience extremely simple one-tap workflows.
- Staff should not duplicate information AI can infer.
- Voice notes are preferred over report forms.
- AI recommendations should come from trusted human sources, current industry context and measured client learning.
- The app should become easier and more useful than Teams before attempting to replace it fully.
- WhatsApp can remain a transition entry point, but structured approvals and source-of-truth workflows should move into CG Dynamics.

## Development and agent workflow

Christie-Ann uses:

- ChatGPT for product architecture, planning and coordination.
- Codex for strong autonomous repository work and QA.
- Claude Code when available for complex implementation.
- OpenCode with DeepSeek as a practical continued-development workhorse.
- Gemini CLI as backup.
- Cline and Roo Code as optional VS Code backups.
- Visual Studio Code on Windows.
- GitHub as source of truth.
- Vercel for deployments and previews.

Before writing coding prompts:

1. Inspect the correct GitHub repository.
2. Check the exact branch and latest commit.
3. Read the relevant files, docs, migrations and tests.
4. Keep the prompt focused on one task where practical.
5. Require autonomous testing and QA.
6. Require build and relevant tests before commit and push.

Do not ask Christie-Ann to do routine browser testing, copy totals, send screenshots or click through ordinary workflows. The coding agent should use the dedicated QA identity and browser automation. Ask her only for real product decisions or explicit approval before consequential production actions.

## Documentation workflow

The repository now uses four living current-truth documents:

- `docs/VISION.md` — what CG Dynamics is and where it is going.
- `docs/CORE_PRINCIPLES.md` — durable UX and product guardrails.
- `docs/CG_ASSISTANT.md` — how ChatGPT and coding agents should work on the project.
- `docs/CHAT_CONTINUITY.md` — current state and continuation point for a new ChatGPT conversation.

After major product sessions, update these documents before issuing major implementation prompts.

These files are not intended to preserve every historical idea. They should reflect current truth. Historical documents remain useful for deeper reasoning but must not override newer current-state documentation and code.

## Existing historical AI Workforce context

A detailed early-stage handover exists at:

`docs/vision/EARLY-STAGE-AI-WORKFORCE-DISCOVERY-HANDOVER-2026-07-01.md`

It preserves the original Marketing Library, Skill Card and AI Workforce reasoning. It remains valuable foundational reading, but it is historical and must be layered beneath the current vision, current milestone and latest code.

Key enduring ideas from that work include:

- AI must apply verified knowledge rather than invent expertise.
- The Marketing Library should use trusted human and measured sources.
- Skill Cards require source integrity, confidence and review status.
- Industry knowledge and client-specific knowledge must remain separate.
- South African market intelligence is an important dedicated layer.
- Former clients must not pollute active default recommendations.

## Next likely roadmap

After Microsoft Sync is safely completed:

1. Repair and protect the Client Schedule calendar-first view.
2. Build the Digital Content Guide foundation.
3. Add internal and client collaboration and approvals.
4. Build Industry Brain and Client Brain foundations using existing Marketing Library work.
5. Integrate free-first AI routing.
6. Add one-voice-note Content Run completion.
7. Feed approvals, content outcomes and performance back into Client Brains.
8. Introduce deeper orchestration and OpenClaw only after the core operational workflows are stable.

## New-chat instruction

In a new ChatGPT conversation, Christie-Ann should be able to say:

> Read `docs/VISION.md`, `docs/CORE_PRINCIPLES.md`, `docs/CG_ASSISTANT.md` and `docs/CHAT_CONTINUITY.md` in `CGProductionHouse/CG-Dynamics`. Then inspect the current GitHub branches, milestones, PRs and latest commits before continuing the app.

The assistant should then continue as product architect and coordinator without requiring Christie-Ann to re-explain the project history.
