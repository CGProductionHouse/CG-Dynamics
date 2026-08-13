# CG Dynamics Current Product Game Plan

Last updated: 13 August 2026

> **CURRENT CONTINUITY OVERRIDE:** Read `AGENTS.md`, `CONTINUE-HERE.md` and `docs/vision/PROJECT-CONTINUITY-HANDOFF-2026-08-13.md` before using this workflow reference. The 2026-08-13 handoff is authoritative for current PRs, issues, migration state, client-research progress and exact next work. The durable workflow contracts below remain authoritative unless CA deliberately changes them.
>
> **Non-regression locks:** `monthly_deliverables` remains Client Schedule truth; CG Calendar stays the separate operational company calendar; do not inject Client Schedule posts into CG Calendar; #177 Outlook dedupe architecture already exists in PR #189; completed-task authority already landed in #176/#188; responsive/navigation architecture already landed in #194; active Marketing/Knowledge work belongs to PR #195; PR #175 invitation/auth work stays isolated; production migrations require explicit user approval.

This is the canonical business-workflow handoff for any new ChatGPT, Codex, Claude Code or other agent continuing CG Dynamics. Read `AGENTS.md`, this file, and `docs/cg-dynamics-page-vision-and-milestones.md` before proposing or making changes. Do not redesign working business processes unless CA explicitly asks.

## 1. Product direction

CG Dynamics is the internal operating system for CG Production House. It should orchestrate the existing business workflow rather than replace working tools for the sake of it.

- CG Dynamics owns client/package data, monthly deliverables, Content Runs, Content Guidelines, assignments, statuses, schedules, reports and operational history.
- WhatsApp remains the client communication and approval channel.
- OneDrive remains the internal media storage and editing source.
- Canva remains the poster design and scheduling workspace where currently used.
- The client portal is a safe status/reporting projection, not a raw-file portal.

## 2. Historical supplied release checkpoint

The figures in this section are the historical supplied checkpoint from 2 August 2026. They are retained for context only. For current SHAs, PRs, migration state and active work, use the 2026-08-13 continuity handoff and live GitHub state.

- Historical main SHA: `56d71dcc99a5e12f933bef85f99ca6978d9cfa96`.
- AI provider health/usage fix shipped via PRs #132–#134 (`cg-assistant-chat` v1, `verify_jwt: true`).
- Historical production migration ledger was consistent through `20260802120000`; 11 local-only SQL-editor-era files were recorded via migration repair.
- Historical test checkpoint: 938 passed, build clean.

Historical Microsoft reconciliation checkpoint:

- Five of five sources completed.
- 1,668 records processed, zero failed, zero unsupported buckets.
- No Microsoft writes and no removals approved.
- 203 conflicts remained at that checkpoint.
- Imported Planner tasks: 109, assigned: 0.
- Imported Client Schedule records: 234, assigned: 0.
- Microsoft `User.Read.All` was still required for safe staff identity resolution.

Historical content-production checkpoint:

- Content Runs: 76 of 82 client-linked.
- Six unresolved runs: Wiseride, Emoya Driving Range, Weekend Highlights, Midas, Bloemvascular and Supa Quick.
- Client Schedule: 234 Microsoft-linked records; 217 scheduled and 17 to do.
- Content Guidelines: 10 drafts; 16 schedule videos linked into guidelines.
- Published guidelines: 0.
- Do not invent missing scripts. Thirteen linked videos had no script text in the available source.

Do not use this historical checkpoint to override newer GitHub evidence.

## 3. Existing OneDrive structure is correct

Do not redesign, replace or add speculative subfolder structures. Preserve the existing CG Production House client template and naming conventions.

Typical client structure:

```text
Client
├── Admin
├── Brand Identity
├── Final Video Exports
├── Photos
├── Posters
└── Videos
    └── YYYY
        ├── YYYY_01_JAN
        ├── YYYY_02_FEB
        └── ...
```

The dated video folder contains the raw footage and any working media the team currently puts there. Final completed videos remain in `Final Video Exports`. Do not introduce RAW, Assets, Project Files or Exports subfolders unless CA later changes the real workflow.

## 4. Content Guidelines are canonical inside CG Dynamics

Content Guidelines must no longer be generated or stored as PDFs in dated OneDrive folders.

- Each Content Run has one canonical Content Guideline inside CG Dynamics.
- The guideline contains ordered videos, names, complete scripts, shoot details, changes and outcomes.
- Staff open the guideline from CG Dynamics and raw footage from the linked OneDrive folder.
- Preserve historical guidelines across all clients.
- Future AI should compare concepts, hooks, scripts, visual treatment, location, product focus and calls to action across historical guidelines.
- Similarity detection warns and shows likely matches; it does not automatically block a concept.
- The purpose is to avoid repeating near-identical content between clients and to maintain unique, high-quality service.

## 5. OneDrive integration target

Do not create production folders until client/package data has been verified and a dry-run has been approved.

Desired flow:

1. Verify active client and current package.
2. Calculate future Content Runs and video deliverables for the remaining year.
3. Match existing dated folders without changing them.
4. Preview missing folders, duplicates and ambiguous matches.
5. Create only approved missing folders using the existing naming convention.
6. Store the internal drive ID, item ID, web URL, folder name, client ID, Content Run ID, deliverable/video ID and last-checked state.
7. Link one or several videos to the same Content Run folder where the real shoot workflow uses one folder for the run.
8. Detect when media has populated the folder.
9. After files stop changing for a safe settling period, change the operational state from `Awaiting footage` to `Footage uploaded` / `Ready to edit`.
10. Show staff actions such as `Open Content Guideline` and `Open raw footage folder` from the same CG Dynamics record.

Folder creation and linking must be idempotent:

- Existing exact folder: link it.
- Missing folder: include it in preview/create flow.
- Duplicate or unclear folder: flag it.
- Never overwrite, replace, rename, move or delete existing content automatically.

## 6. Raw content is strictly internal

This is a non-negotiable business and security rule.

- Clients must never receive raw footage, raw folder links, source-file metadata, OneDrive item IDs, internal URLs or permissions.
- Never create anonymous client links to internal media.
- Never grant client accounts direct OneDrive access.
- Client-facing API routes, loaders, components and logs must not expose internal OneDrive references.
- Clients receive review/final files and give approvals through WhatsApp.
- The client portal may show safe statuses only, such as Editing, Awaiting approval, Changes requested, Approved, Scheduled and Published.
- Test horizontal access and ensure client users cannot infer or fetch another client's or their own raw media.

## 7. Real approval and production workflow

Client onboarding:

- Create a WhatsApp group containing the client's required marketing/approval people and the relevant CG management team.
- Store supplied logo, CI manual, company profile and other brand material in the existing client OneDrive structure.

Video workflow:

- Plan the Content Run and Content Guideline in CG Dynamics.
- Upload raw media manually into the exact linked dated OneDrive folder.
- Detect population and make the videos available for editing.
- Editors use CG Dynamics for the guideline and OneDrive for source media.
- Send review exports directly through WhatsApp as files.
- Record approval/change status in Dynamics without forcing the client into a new approval platform.
- Changes are handled by the internal team, resent on WhatsApp and reflected in the operational status.

Poster workflow:

- Design and organise posters in Canva using the established naming/scheduling workflow.
- Obtain client approval through WhatsApp.
- Dynamics may track state and work ownership, but must not add unnecessary duplicate manual administration.

## 8. Post-Content-Run voice report

Staff need a simple report action from the selected Content Run and linked Content Guideline.

- Provide a microphone option available in the relevant workflow.
- Accept a staff voice note and transcribe it accurately.
- Use the transcript in a structured, AI-assisted report conversation.
- Capture what happened during the run.
- Capture script/concept changes made on site.
- Mark which videos were shot successfully and are ready to edit.
- Mark videos that must move to the next Content Run.
- Mark videos rejected or cancelled on site.
- Preserve the original transcript and require review/confirmation before writes.
- Apply approved changes to the guideline, deliverable statuses, assignment/admin scheduling views and editing queue.
- Never silently invent, remove or reschedule videos from an uncertain transcript.

## 9. CG Assistant product contract

The CG Assistant is not primarily a separate destination page or menu item. It is part of CG Dynamics itself and should be available throughout every authorised staff workflow.

### Core product direction

- The Assistant should run across the whole staff application rather than live as one isolated page.
- Normal staff use should not require opening a dedicated Assistant menu item.
- A full Assistant workspace may remain inside the AI/Marketing Library area for long-form work, specialist research, diagnostics and deeper conversations.
- The Assistant must feel like part of `My Work`, Planner, Clients, Content Runs, Content Guidelines, scheduling, reports and the wider app — not an external bot bolted onto CG Dynamics.
- Over time it should build useful employee-specific context from each staff member's authorised work history, responsibilities, assignments and recurring patterns, without crossing role or privacy boundaries.

### Persistent app-shell interaction

- Add a small, unobtrusive Assistant icon in the bottom-right corner of the app, similar to a modern website chat control.
- The control must be available while any authorised staff page is open on both desktop and mobile.
- Selecting the icon opens a compact chat/composer surface without forcing the user to leave the current page.
- The composer should support typed messages, voice notes, safe file attachments where role/workflow allows them, a clear send action and follow-up messages within the same contextual conversation.
- The shell should be compact by default, expandable when needed, and must not cover critical mobile navigation or page actions.

### Context awareness

The Assistant should receive safe, role-authorised context from:

- the current page and route;
- the signed-in user and role;
- the selected client;
- the current work item or task;
- the selected Content Run and canonical Content Guideline;
- the selected calendar or Client Schedule item;
- the selected report or performance view;
- assignments, due dates, statuses and visible operational history;
- approved Marketing Library, platform and industry knowledge;
- relevant active-client intelligence and performance data once connected.

It must never assume that a page label, client name or partial context is enough for a write. Ambiguous entities must be resolved against canonical data.

### Example confirmed-action workflow

A staff member should be able to voice or type:

> “Quickly add a task under Wiseman Group to design a vector billboard, due tomorrow, assigned to Ger-Marie.”

The Assistant should:

1. Resolve the active client, user and destination work area.
2. Interpret the due date in the signed-in user's timezone.
3. Show a concise proposed action.
4. Ask for confirmation where required.
5. Create the task in CG Dynamics after confirmation.
6. Return the created task and a direct navigation action.
7. Record an audit trail.

Other expected workflows:

- Summarise the current staff member's day, priorities and blockers.
- Explain the selected Content Run or guideline.
- Start the post-run voice report flow from the current Content Run.
- Find relevant historical concepts and warn about likely repetition.
- Draft a client update from real visible progress.
- Navigate directly to the relevant record or filtered view.

### Action and safety rules

- Read-only summaries, explanations and navigation may happen immediately.
- Data writes require a clear preview and user confirmation unless an explicitly approved low-risk shortcut is later defined.
- Destructive, security, role, permission and raw-file-sharing actions are not available through the Assistant.
- Never invent clients, users, tasks, due dates, statuses, scripts or performance.
- Resolve names against current canonical data and ask for confirmation when ambiguous.
- Every confirmed write must be auditable with actor, timestamp, proposed action, confirmation, final action and affected record IDs.
- Client isolation and staff permissions apply equally to Assistant retrieval and Assistant actions.
- Production skilled-agent retrieval must use current approved knowledge; stale/draft/retired knowledge is excluded.

## 10. Microsoft and package sync hardening

The sync must fetch the complete canonical dataset before reconciliation. A prior failure read only the first 1,000 `monthly_deliverables` while production had roughly 2,900, causing existing slots beyond page one to appear missing and creates to collide.

Required rules:

- Implement real pagination for every Supabase and Microsoft collection.
- Do not rely on default page sizes or first-page assumptions.
- Explicitly record source completeness, page counts, fetched counts and ranges.
- If any required source is incomplete, failed, timed out or range-limited, block removals and destructive reconciliation.
- Repeat runs must be idempotent.
- Load canonical existing records before classifying a row as create.
- Classify each source item as link existing, update existing, create missing, unchanged, skip historical completed, conflict, unsupported or failed.
- No Microsoft write-back.
- No hard deletion of Microsoft-linked records.
- Source removals require complete-source proof and separate approval.
- Long-running reconciliation must use an observable job/queue model rather than leaving an untracked timed-out child process running in the background.
- A timed-out client request must not imply that the server job stopped or may be safely restarted.

Package changes must be detected on every sync:

- Package changed.
- Quantity increased or decreased.
- Deliverable type changed.
- Client paused or reactivated.
- Package start/end date changed.

For a package change:

1. Show the previous and new package values.
2. Calculate impact on future deliverables only.
3. Preserve completed historical work.
4. Preview additions, cancellations, relinks and conflicts.
5. Require explicit approval for business decisions.
6. Never silently rebuild the client's schedule.

## 11. Tooling and release verification

Coding-agent tool limitations must not be confused with application success.

Before declaring a production release complete, verify:

- required environment variables are available without printing secrets;
- database and Microsoft connections work;
- full pagination tests cover more than one page and more than 1,000 rows where relevant;
- preview and apply runs are independently observable;
- automated tests pass;
- build passes;
- static route and permission checks pass;
- Vercel production deployment is READY where applicable;
- authenticated desktop and mobile checks pass for required roles;
- raw OneDrive information is absent from client responses/rendered pages;
- any unverified check is reported plainly.

## 12. Immediate implementation order

The old July implementation sequence has been superseded. Current order is maintained in the 2026-08-13 continuity handoff.

At this update:

1. Finish the final freshness-contract fix on the same PR #195.
2. Review/merge #195 only after current-approved knowledge is enforced across staff Library, Marketing AI and CG Assistant.
3. Keep PR #175 isolated.
4. Treat #177 as controlled production rollout/acceptance of already-merged PR #189, not another Calendar rewrite.
5. Finish #180/#181/#182 through authenticated evidence-based QA without restarting shell/navigation architecture.
6. Resume client research from Human Auto only after CA explicitly says `go`.

## 13. Definition of done for future agents

A feature is not done because code compiles. Report:

- Exact files changed.
- Migration and production-data impact.
- Tests and build results.
- Security/role checks performed.
- Desktop/mobile/authenticated checks performed.
- Vercel deployment state.
- What remains blocked, ambiguous or unverified.
- Whether any production write occurred.
- Whether the work overlaps an existing open PR.

When this document conflicts with an implementation assumption, preserve the real workflow described here and the current continuity handoff rather than redesigning it.

## 14. Navigation and app-shell consolidation decisions

These decisions were confirmed by CA on 28 July 2026 and must guide future navigation and shell work.

### Daily staff navigation should reflect workflows, not every route

Do not keep separate top-level links for every screen when several screens belong to one daily workflow.

Confirmed structure and boundaries:

- `Hub` remains the main operational overview.
- `Work` combines My Work and Planner experiences into one coherent daily work area while preserving underlying data boundaries.
- `CG Calendar` remains its own operational calendar destination.
- `Client Schedule` remains a separate top-level product area.
  - Do not combine it with CG Calendar.
  - Preserve `monthly_deliverables` as its canonical source of truth.
- `Content` connects Content Runs, canonical guidelines, scripts, statuses and production progress.
- `Clients` remains a core staff destination.

Do not collapse canonical data models merely because navigation is consolidated. `monthly_deliverables`, Content Runs, Content Guidelines and Planner tasks keep their existing source-of-truth boundaries.

### Users and administration

- The user-management concept is `Users`.
- `Users` belongs inside a clearly separated admin area, not normal daily staff workflow navigation.
- User accounts, roles, permissions, access controls and other administrative settings must be grouped under an admin panel visible only to authorised roles.
- Marketing Library governance, integrations and diagnostics must be separated appropriately from ordinary operational navigation.

### Assistant belongs to the whole application

- Normal staff should not need an `Assistant` sidebar tab for everyday use.
- Implement the Assistant as the persistent app-shell capability described in Section 9.
- It may also live inside the AI/Marketing area as a deeper AI workspace.
- Navigation cleanup and Assistant-shell work must be designed together so the Assistant feels like CG Dynamics itself rather than another disconnected module.

### External product handling

- `CG Hours` may remain visibly marked as external until it is genuinely integrated into the CG Dynamics shell.

### Required design outcome

The resulting navigation must be shorter, clearer and mobile-friendly. It should prioritise the main daily journeys while keeping administration, integrations and AI governance appropriately separated.