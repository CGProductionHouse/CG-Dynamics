# CG Dynamics Core Principles

**Status:** Active guardrails  
**Last updated:** 2026-07-20

These principles protect the product from accidental regression. They apply unless Christie-Ann explicitly changes them.

## Simplicity

- The app must reduce administration, not introduce duplicate work.
- Prefer one clear action over multi-step workflows.
- Prefer one voice note over several manual questions when AI can safely extract the detail.
- Clients should approve, reject, comment or suggest changes with minimal effort.
- Staff should only correct AI interpretation when necessary.
- Every screen should be understandable without training.

## Calendar and scheduling

- CG Calendar is operational only: meetings, shoots, content runs, deadlines and operational events.
- Social post scheduling belongs to Client Schedule and monthly deliverables, not CG Calendar.
- Client Schedule must have a genuine month, week and day calendar experience showing dates and times.
- A bucket or board view may be optional, but must not replace the calendar-first schedule experience.
- Planner tasks may appear as an optional overlay where useful.
- A feature or sync must not silently regress an established calendar or schedule view.

## Tasks and operations

- Planner-style buckets remain important because they reflect how the team works.
- The Operations Hub should evolve beyond Microsoft Teams by reducing friction, not merely copying features.
- Existing working workflows should be preserved unless an intentional replacement has been agreed.
- Operational information should have one source of truth inside the appropriate module.

## AI removes work

- AI should operate quietly in the workflow rather than becoming another system users must manage.
- AI must retrieve, reason and apply expertise; it must not invent expertise.
- AI-generated content is not a source of authority.
- The system should explain the evidence or context behind important recommendations.
- Human-sounding output is mandatory; generic AI phrases and empty marketing language are unacceptable.
- Free-first AI routing is preferred, with paid fallbacks only when justified.

## Knowledge integrity

- General knowledge, Industry Brain knowledge and Client Brain knowledge must remain distinct.
- Industry knowledge must be reusable and based on trusted human or measured sources.
- Client-specific knowledge must be isolated to the correct active client.
- Inactive or former client information must not become default universal knowledge.
- Never fabricate quotations, page numbers, attribution or evidence.
- Separate direct source support from interpretation and modern application.
- Skill Cards remain untrusted until their review requirements are met.

## Content Guides

- Digital Content Guides replace PDF guides as the source of truth.
- PDF export may exist only as an optional output.
- Guides must support internal review, simple client approval and direct linking from the relevant content run.
- Client amendments and rejections must teach the Client Brain.
- Approved but unfinished ideas should carry forward only when still relevant.
- Expired seasonal or public-holiday ideas must not be carried forward automatically.

## Content Run completion

- Finishing a content run should require one voice note, not a report form.
- AI should identify completed, amended, rejected, deferred and expired ideas automatically.
- The app should show a short bullet summary such as videos completed, videos moved and ideas removed.
- Staff may correct the summary, but should not rebuild it manually.

## Client experience

- The client portal should feel exceptionally simple and premium.
- Clients should see only their own content and information.
- The most important actions should be one-tap wherever possible.
- Do not expose internal complexity or irrelevant operational detail to clients.
- Client approval workflows must be clearer and easier than scattered message threads.

## Visual experience

- Mobile-first behaviour is required.
- The design should be modern, premium, readable and consistent.
- The app needs meaningful design coherence, not scattered cosmetic changes.
- Client-facing dashboard and reporting quality sets the visual benchmark for the wider app.
- Avoid clutter and feature density that makes daily work unpleasant.

## Roles and boundaries

- Supported roles are admin, manager, staff and client.
- User management is admin-only.
- Permissions must be enforced in data access, not only hidden in the interface.
- Sensitive payroll and accounting information must remain outside client-facing and general assistant workflows.
- CG Hours remains separate.

## Microsoft transition

- Microsoft is read-only upstream during transition; CG Dynamics is the execution view.
- No Microsoft writes are permitted unless a later product decision explicitly changes this.
- Sync must be repeatable and completeness-aware.
- No destination hard deletes.
- Source removals require explicit approval.
- Preserve CG-only workflow fields.
- Client Socials maps only to Client Schedule.
- Outlook maps only to CG Calendar.
- Operational Planner data maps only to the appropriate operational destinations.
- Unknown or ambiguous mappings must fail closed rather than guessing.

## Development quality

- GitHub is the source of truth for current code, documentation, branches and milestones.
- Major changes must be tested through the dedicated authenticated QA workflow.
- Christie-Ann is the product owner, not the routine QA operator.
- Coding agents should test, fix and retest autonomously.
- Ask Christie-Ann only for genuine product decisions or approval before consequential production actions.
- Never claim a build, deployment, test or repository write occurred unless it was actually verified.
