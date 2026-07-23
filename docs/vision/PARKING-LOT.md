# CG Dynamics Parking Lot

Last updated: 2026-07-23
Purpose: Capture valuable ideas without derailing the current milestone.

## How to use this file

When a new idea comes up during development, place it here unless it directly belongs in the active milestone.

Each item should include:

- Date added.
- Idea.
- Division affected.
- Why it matters.
- When to revisit.
- Status.

## Status options

- Parked.
- Needs research.
- Ready for milestone planning.
- Rejected.
- Completed.

## Parking lot items

### 2026-07-23 - Microsoft client package and schedule parity audit

Division: Operations Hub
Status: Ready for milestone planning

Current finding:
The current Client Schedule and client-facing Content Calendar do not reliably match the existing Microsoft Planner client schedules. Some client package counts, deliverable types, task identities and dates were imported incorrectly or incompletely during the legacy Teams shadow import. Action Sport is one confirmed example: Microsoft Planner clearly contains a `VIDEO - ACTION` item together with `F1` to `F4` and `DP1` to `DP4`, while the CG Dynamics July client calendar currently presents only four designed posters and four photos and does not reflect the video correctly. This is one faulty client among multiple suspected mismatches.

Product direction:
Treat Microsoft Planner as the transition source of truth and run a proper preview-first parity reconciliation across every active client before retiring Teams. Do not patch Action Sport alone. The import must determine the real monthly package and deliverables from source tasks, preserve exact Microsoft identities, and reconcile CG Dynamics safely without duplicating or silently deleting work.

Required behaviour:

- Audit every active client bucket in the approved monthly Client Socials plan against the corresponding CG Dynamics client package, monthly deliverables and client-facing calendar.
- Parse source task labels and readable variations consistently, including `VIDEO`, `REEL`, `DP`, `F`, numbered forms such as `DP1`, `DP 1`, `F1`, `F 1`, and client-name suffixes.
- Preserve `microsoft_plan_id`, `microsoft_bucket_id` and `microsoft_task_id` as the canonical source identity so repeat imports update the same deliverable instead of creating duplicates.
- Compare source task type, number, title, due date, completion state and client bucket with the stored CG Dynamics row.
- Distinguish true package composition from scheduled post dates. Package counts must reflect the actual source deliverables, while each task keeps its own scheduled date.
- Surface creates, updates, unchanged rows, missing-source candidates, duplicates, type conflicts, date conflicts, unmatched clients and ambiguous task labels in the preview before any write.
- Never infer a missing video, reel, poster or photo from package totals alone when the source task is available.
- Do not silently omit unsupported or unfamiliar task names. Keep them as visible review conflicts.
- Do not auto-create clients or packages from guessed names.
- Do not hard-delete existing CG work when a source task is absent. Source-removal requires a complete successful fetch and explicit approval.
- After applying the reviewed reconciliation, verify Client Schedule, client Content Calendar, Content Workflow deliverable selectors and package badges against Microsoft for every active client.
- Use Action Sport as an acceptance case: the source video plus all four `F` and four `DP` items must be represented with the correct identities and dates.
- Add additional representative acceptance clients with videos, reels, mixed packages, completed tasks, changed dates and imperfect naming.
- Produce a parity report showing source count, created, updated, unchanged, conflict, skipped and missing-source totals per client.

Why it matters:
The client calendar and downstream content workflow depend on accurate monthly deliverables. Missing videos, incorrect package counts or wrong dates make the production system untrustworthy and force staff to keep checking Teams manually, which defeats the transition to CG Dynamics.

Revisit:
Immediately after the Meta reporting-truth and three-client parity milestone. Complete this before treating the Microsoft transition sync as ready for normal operational use or retiring the Teams client schedule.

### 2026-07-23 - Full content guide workspace instead of fragmented video forms

Division: Operations Hub, AI Workforce
Status: Ready for milestone planning

Current finding:
The canonical video and folder naming is now correct, and the linked Client Schedule deliverable selector is working. The actual content-guideline experience is still too fragmented and manual. Separate fields for objective, hook, script, shot-by-shot breakdown, CTA, props, visual notes and internal notes feel like a database form rather than a useful production guide. It is not yet an improvement on the real content guidelines CG currently sends to clients and production staff.

Product direction:
Replace the current one-video-at-a-time form experience with one cohesive full content guide workspace for a client and month. The guide must contain all scheduled video deliverables for that period in one readable document-style workspace, while preserving the correct schedule links, video numbers and canonical folder names.

Required behaviour:

- One master content guide per client and month containing every linked video deliverable for that period.
- Each scheduled video appears as a clear section or block inside the full guide, in the correct schedule order.
- Preserve canonical naming such as `2026_07_DULUX_VIDEO_01` and the linked Client Schedule deliverable identity.
- Provide one primary flexible writing area per video where a complete script or existing content-guide text can be pasted and edited without splitting everything into mandatory small fields.
- Optional structured production details may still exist, but they must support the guide instead of forcing duplicate manual entry.
- The full guide should make concept, script/dialogue, filming direction, shot ideas, on-screen text/CTA, people/products/props and notes easy to understand in one continuous production document.
- Staff must be able to move through and plan all videos without repeatedly opening separate forms.
- The final output must be polished, readable and suitable for internal production use and client sharing, printing or export.
- Copying a final script into the production workflow must be simple.
- Future AI assistance may help structure pasted scripts, suggest missing production details and improve the guide, but it must not replace human review.
- Before implementation, compare the interface against real CG content-guideline documents and design an obvious improvement on the current working format.

Why it matters:
The Content Workflow should reduce planning time and give the team one reliable production document for the entire client month. The current form creates extra typing, fragments the creative idea and does not match how CG actually prepares and uses content guides.

Revisit:
After the Meta reporting-truth and three-client parity milestone is complete. Use real current CG content guidelines as the product benchmark before coding the redesign.

### 2026-07-23 - Forward-looking report calendar suggestions

Division: Client Intelligence, AI Workforce
Status: Ready for milestone planning

Idea:
Change report calendar suggestions so they plan the next campaign period instead of repeating opportunities from the month being reported.

Required behaviour:

- The report month must drive the planning window, not today's date.
- Report month + 1 is the primary action month.
- Report month + 2 may be included for early planning opportunities.
- Example: a June 2026 report should recommend July 2026 opportunities first and may include selected August 2026 opportunities.
- Do not present dates from the reported month as upcoming recommendations.
- Deduplicate overlapping opportunities such as Mandela Month and Nelson Mandela Day unless they have clearly different campaign angles.
- Keep the suggestions useful for strategy and production planning rather than filling the report with generic calendar events.

Why it matters:
A performance report should turn past results into the next practical content and campaign plan. Suggestions from the already completed report month are stale and cannot guide production effectively.

Revisit:
Immediately after the Meta reporting-truth and three-client parity milestone is complete.

### 2026-07-01 - AI generated poster workflow

Division: AI Workforce, Operations Hub
Status: Parked

Idea:
Create a skilled AI poster workflow that produces first draft social posters using brand knowledge, source assets, product details and marketing principles.

Why it matters:
This can reduce repetitive graphic design production pressure and let staff act more like creative directors and quality controllers.

Revisit:
After the Marketing Library and Skill Card storage exists.

### 2026-07-01 - Brand Guardian review agent

Division: AI Workforce
Status: Parked

Idea:
Create an agent that reviews outputs for brand consistency, generic AI wording, layout issues, CTA clarity and evidence based marketing quality.

Why it matters:
This prevents AI output from becoming low quality generic content and helps staff improve faster.

Revisit:
After first AI Workforce agents can read the Marketing Library.

### 2026-07-01 - Client report as premium storefront

Division: Client Intelligence
Status: Parked

Idea:
Rebuild client reports so they feel like a premium dashboard that clearly proves value, explains results and recommends next actions.

Why it matters:
This can become a separate subscription layer and make clients feel the service is difficult to replace.

Revisit:
After the Marketing Library can support report insights.

### 2026-07-01 - Paid ads strategy agent

Division: AI Workforce, Client Intelligence
Status: Parked

Idea:
Create a specialist agent for Meta and Google campaign planning, audience logic, campaign settings, lead generation strategy and result interpretation.

Why it matters:
The business needs stronger lead generation value, not only better looking content.

Revisit:
After official platform documentation and paid ads Skill Cards exist.

### 2026-07-01 - South African market intelligence layer

Division: AI Workforce
Status: Parked

Idea:
Create a specific knowledge layer for South African audience behaviour, language, platform usage, provincial differences, buying behaviour, trust signals and cultural context.

Why it matters:
Generic American marketing advice often misses local context.

Revisit:
After the core Marketing Library structure exists.

## Future notes

Add new ideas here instead of expanding the current milestone unless the idea is directly required to complete the current milestone.
