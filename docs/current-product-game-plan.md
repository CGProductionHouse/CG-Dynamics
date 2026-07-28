# CG Dynamics Current Product Game Plan

Last updated: 28 July 2026

This is the canonical handoff for any new ChatGPT, Codex, Claude Code or other
agent continuing CG Dynamics. Read `AGENTS.md`, this file, and
`docs/cg-dynamics-page-vision-and-milestones.md` before proposing or making
changes. Do not redesign working business processes unless CA explicitly asks.

## 1. Product direction

CG Dynamics is the internal operating system for CG Production House. It should
orchestrate the existing business workflow rather than replace working tools for
the sake of it.

- CG Dynamics owns client/package data, monthly deliverables, Content Runs,
  Content Guidelines, assignments, statuses, schedules, reports and operational
  history.
- WhatsApp remains the client communication and approval channel.
- OneDrive remains the internal media storage and editing source.
- Canva remains the poster design and scheduling workspace where currently used.
- The client portal is a safe status/reporting projection, not a raw-file portal.

## 2. Current release state

Latest supplied release status:

- UX PR #78 merged as `ab8135d`.
- Content Run propagation PR #79 merged as `c4147b1`.
- Main SHA: `c4147b1b68d4918f1e8b8ca21f7f563b9337bc2c`.
- Production migration applied:
  `20260726075342_content_run_client_propagation.sql`.
- Tests: 518 passed.
- Build passed.
- Final Vercel production READY and authenticated desktop/mobile checks were not
  proven at the last available check.

Microsoft reconciliation supplied state:

- Five of five sources completed.
- 1,668 records processed, zero failed, zero unsupported buckets.
- No Microsoft writes and no removals approved.
- 203 conflicts remained at the supplied checkpoint.
- Imported Planner tasks: 109, assigned: 0.
- Imported Client Schedule records: 234, assigned: 0.
- Microsoft `User.Read.All` is still required for safe staff identity resolution.

Content production supplied state:

- Content Runs: 76 of 82 client-linked.
- Six unresolved runs: Wiseride, Emoya Driving Range, Weekend Highlights, Midas,
  Bloemvascular and Supa Quick.
- Client Schedule: 234 Microsoft-linked records; 217 scheduled and 17 to do.
- Content Guidelines: 10 drafts; 16 schedule videos linked into guidelines.
- Published guidelines: 0.
- Do not invent missing scripts. Thirteen linked videos had no script text in the
  available source.

Client portal is not ready for general client release while published guideline
and report coverage is incomplete and production verification remains unproven.

## 3. Existing OneDrive structure is correct

Do not redesign, replace or add speculative subfolder structures. Preserve the
existing CG Production House client template and naming conventions.

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

The dated video folder contains the raw footage and any working media the team
currently puts there. Final completed videos remain in `Final Video Exports`.
Do not introduce RAW, Assets, Project Files or Exports subfolders unless CA later
changes the real workflow.

## 4. Content Guidelines are canonical inside CG Dynamics

Content Guidelines must no longer be generated or stored as PDFs in dated
OneDrive folders.

- Each Content Run has one canonical Content Guideline inside CG Dynamics.
- The guideline contains ordered videos, names, complete scripts, shoot details,
  changes and outcomes.
- Staff open the guideline from CG Dynamics and raw footage from the linked
  OneDrive folder.
- Preserve historical guidelines across all clients.
- Future AI should compare concepts, hooks, scripts, visual treatment, location,
  product focus and calls to action across historical guidelines.
- Similarity detection warns and shows likely matches; it does not automatically
  block a concept.
- The purpose is to avoid repeating near-identical content between clients and to
  maintain unique, high-quality service.

## 5. OneDrive integration target

Do not create production folders until client/package data has been verified and
a dry-run has been approved.

Desired flow:

1. Verify active client and current package.
2. Calculate future Content Runs and video deliverables for the remaining year.
3. Match existing dated folders without changing them.
4. Preview missing folders, duplicates and ambiguous matches.
5. Create only approved missing folders using the existing naming convention.
6. Store the internal drive ID, item ID, web URL, folder name, client ID,
   Content Run ID, deliverable/video ID and last-checked state.
7. Link one or several videos to the same Content Run folder where the real shoot
   workflow uses one folder for the run.
8. Detect when media has populated the folder.
9. After files stop changing for a safe settling period, change the operational
   state from `Awaiting footage` to `Footage uploaded` / `Ready to edit`.
10. Show staff actions such as `Open Content Guideline` and
    `Open raw footage folder` from the same CG Dynamics record.

Folder creation and linking must be idempotent:

- Existing exact folder: link it.
- Missing folder: include it in preview/create flow.
- Duplicate or unclear folder: flag it.
- Never overwrite, replace, rename, move or delete existing content automatically.

## 6. Raw content is strictly internal

This is a non-negotiable business and security rule.

- Clients must never receive raw footage, raw folder links, source-file metadata,
  OneDrive item IDs, internal URLs or permissions.
- Never create anonymous client links to internal media.
- Never grant client accounts direct OneDrive access.
- Client-facing API routes, loaders, components and logs must not expose internal
  OneDrive references.
- Clients receive review/final files and give approvals through WhatsApp.
- The client portal may show safe statuses only, such as Editing, Awaiting
  approval, Changes requested, Approved, Scheduled and Published.
- Test horizontal access and ensure client users cannot infer or fetch another
  client's or their own raw media.

## 7. Real approval and production workflow

Client onboarding:

- Create a WhatsApp group containing the client's required marketing/approval
  people and the relevant CG management team.
- Store supplied logo, CI manual, company profile and other brand material in the
  existing client OneDrive structure.

Video workflow:

- Plan the Content Run and Content Guideline in CG Dynamics.
- Upload raw media manually into the exact linked dated OneDrive folder.
- Detect population and make the videos available for editing.
- Editors use CG Dynamics for the guideline and OneDrive for source media.
- Send review exports directly through WhatsApp as files.
- Record approval/change status in Dynamics without forcing the client into a new
  approval platform.
- Changes are handled by the internal team, resent on WhatsApp and reflected in
  the operational status.

Poster workflow:

- Design and organise posters in Canva using the established naming/scheduling
  workflow.
- Obtain client approval through WhatsApp.
- Dynamics may track state and work ownership, but must not add unnecessary
  duplicate manual administration.

## 8. Post-Content-Run voice report

Staff need a simple report action from the selected Content Run and linked
Content Guideline.

- Provide a microphone option available in the relevant workflow.
- Accept a staff voice note and transcribe it accurately.
- Use the transcript in a structured, AI-assisted report conversation.
- Capture what happened during the run.
- Capture script/concept changes made on site.
- Mark which videos were shot successfully and are ready to edit.
- Mark videos that must move to the next Content Run.
- Mark videos rejected or cancelled on site.
- Preserve the original transcript and require review/confirmation before writes.
- Apply approved changes to the guideline, deliverable statuses, assignment/admin
  scheduling views and editing queue.
- Never silently invent, remove or reschedule videos from an uncertain transcript.

## 9. CG Assistant product contract

The CG Assistant is not primarily a separate destination page or menu item. It is
part of the application and should be available throughout staff workflows.

Preferred interaction:

- A small persistent assistant control, similar to a website chat control, placed
  unobtrusively in the app shell.
- Opening it reveals a compact composer supporting typed input, voice notes,
  files where safe and a send action.
- It can also be surfaced inside the AI Library where appropriate, but should not
  require a dedicated navigation tab for normal use.
- It uses the current page, selected client, selected Content Run, current task,
  signed-in profile, role, assignments and authorised app data as context.
- It gradually builds useful staff-specific context from real work history, while
  respecting role and privacy boundaries.

Examples of confirmed-action workflows:

- “Add a task under Wiseman Group to design a vector billboard, due tomorrow,
  assigned to Ger-Marie.”
- Summarise the current staff member's day and blockers.
- Explain the selected Content Run or guideline.
- Start the post-run voice report flow.
- Find relevant historical content concepts and possible repetition.

Action rules:

- Read-only summaries and navigation may happen immediately.
- Data writes require a clear preview and user confirmation.
- Destructive, security, role, permission and raw-file-sharing actions are not
  available through the assistant.
- Never invent clients, users, tasks, due dates, statuses or scripts.
- Resolve names against current canonical data and ask for confirmation when
  ambiguous.
- Every confirmed write must be auditable with actor, timestamp, proposed action,
  final action and affected record IDs.

## 10. Microsoft and package sync hardening

The sync must fetch the complete canonical dataset before reconciliation. A prior
failure read only the first 1,000 `monthly_deliverables` while production had
roughly 2,900, causing existing slots beyond page one to appear missing and 177
creates to collide.

Required rules:

- Implement real pagination for every Supabase and Microsoft collection.
- Do not rely on default page sizes or first-page assumptions.
- Explicitly record source completeness, page counts, fetched counts and ranges.
- If any required source is incomplete, failed, timed out or range-limited, block
  removals and destructive reconciliation.
- Repeat runs must be idempotent.
- Load canonical existing records before classifying a row as create.
- Classify each source item as link existing, update existing, create missing,
  unchanged, skip historical completed, conflict, unsupported or failed.
- No Microsoft write-back.
- No hard deletion of Microsoft-linked records.
- Source removals require complete-source proof and separate approval.
- Long-running reconciliation must use an observable job/queue model rather than
  leaving an untracked timed-out child process running in the background.
- A timed-out client request must not imply that the server job stopped or may be
  safely restarted.

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
Known problems included an isolated worktree without `.env.local`, an older
Windows PowerShell without a newer hex helper, browser automation blocked by a
Windows workspace ACL issue, Codex execution quota exhaustion, and an unproven
Vercel READY state.

Before declaring a production release complete, verify:

- Required environment variables are available without printing secrets.
- Database and Microsoft connections work.
- Full pagination tests cover more than one page and more than 1,000 rows.
- Preview and apply runs are independently observable.
- Automated tests pass.
- Build passes.
- Static route and permission checks pass.
- Vercel production deployment is READY.
- Authenticated desktop and mobile checks pass for admin, staff and client roles.
- Raw OneDrive information is absent from client responses and rendered pages.
- Any unverified check is reported plainly; do not call it complete.

## 12. Immediate implementation order

1. Stabilise full pagination and deterministic Microsoft reconciliation.
2. Resolve or obtain business decisions for current conflicts and six unresolved
   Content Run client identities.
3. Verify active clients and correct packages before creating future folders.
4. Build preview-only OneDrive matching/linking for existing dated folders.
5. Add approved folder creation for missing future Content Runs.
6. Add folder-population detection and `Ready to edit` transition.
7. Finish Content Guideline publishing/history and safe client projection.
8. Add the post-Content-Run voice report with reviewed structured updates.
9. Refactor CG Assistant into a contextual app-shell capability and implement
   confirmed-action task creation.
10. Complete report review/publication and production role/device verification.

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

When this document conflicts with an implementation assumption, preserve the
real workflow described here and stop for clarification rather than redesigning
it.

## 14. Navigation and app-shell consolidation decisions

These decisions were confirmed by CA on 28 July 2026 and must guide future
navigation and shell work.

### Daily staff navigation should reflect workflows, not every route

The current sidebar is too fragmented. Do not keep separate top-level links for
every screen when several screens belong to one daily workflow.

Target staff navigation structure:

- `Hub`
- `Work`
  - combines the current `My Work` and `Planner` experiences into one coherent
    work area;
  - preserve existing data and routes internally where useful, but do not force
    staff to choose between overlapping task destinations;
- `Calendar`
  - groups `CG Calendar` and `Client Schedule` under one scheduling area;
  - preserve their distinct source-of-truth responsibilities;
- `Content`
  - combines `Content Workflow` and `Full Content Guide` into one connected
    content-production area;
  - users should move naturally between Content Runs, canonical guidelines,
    scripts, statuses and production progress without treating them as unrelated
    products;
- `Clients`
  - remains a core staff destination.

Do not collapse canonical data models merely because navigation is consolidated.
`monthly_deliverables`, Content Runs, Content Guidelines and Planner tasks keep
their existing source-of-truth boundaries.

### Users and administration

- Rename the current `Team` concept to `Users`.
- `Users` belongs inside a clearly separated admin area, not in the normal daily
  staff workflow navigation.
- User accounts, roles, permissions, access controls and other administrative
  settings must be grouped under an admin panel visible only to authorised roles.
- Marketing Library, integrations, diagnostics and other technical controls should
  also be visually separated from ordinary operational navigation where
  appropriate.

### Assistant belongs to the whole application

- The Assistant must not remain only as an isolated sidebar destination.
- Implement it as a persistent app-shell capability available across the whole
  authorised staff app.
- The shell Assistant should receive safe context from the current page, selected
  client, work item, Content Run, guideline, calendar item or report.
- A full Assistant workspace may remain for long-form work, diagnostics or deep
  research, but normal use should not require leaving the current workflow.
- Navigation cleanup and Assistant-shell work must be designed together so the
  Assistant feels like part of CG Dynamics rather than another disconnected
  module.

### External product handling

- `CG Hours` may remain visibly marked as external until it is genuinely integrated
  into the CG Dynamics shell.

### Required design outcome

The resulting sidebar must be shorter, clearer and mobile-friendly. It should
prioritise the main daily journeys of work, scheduling, content and clients, while
keeping administration and AI governance appropriately separated.
