# CG Dynamics working brief

This document captures the current product direction so coding-agent prompts stay focused and do not lose important workflow requirements.

## Core product split

CG Dynamics should not feel like one mixed menu.

There are two zones:

### CG Dynamics

Client performance and client-facing business intelligence.

Suggested section items:

- Performance
- Clients
- Reports
- Client Preview
- Meta / Integrations

### CG Hub

Internal staff workflow and production.

Suggested section items:

- Hub
- Clients
- Planner
- Daily Tasks
- Assistant
- OneDrive
- CG Hours

The same Clients page must be available from both CG Dynamics and CG Hub.

CG Dynamics users must be able to zone into the performance/reporting side without seeing staff-work noise. CG Hub users must be able to zone into daily work without performance/reporting noise.

## Visual direction

Use the existing client report view as the benchmark.

The app should feel:

- black
- premium
- cinematic
- bold
- calm
- clean
- readable
- simple
- production-focused

Colour direction:

- near-black / warm black backgrounds
- charcoal panels with subtle gradients
- white and off-white headings
- readable grey muted text
- teal glow as a tasteful secondary accent
- copper/amber as a small premium accent only
- no large orange UI blocks
- no noisy helper paragraphs everywhere

The user likes bold fonts and simple dashboards.

## Text and UX rules

The user does not want to read long app copy.

Use:

- clear page titles
- clear button labels
- short empty states
- hidden detail drawers/modals
- minimal helper text

Avoid:

- long explanatory paragraphs
- repeated descriptions
- huge forms visible by default
- noisy dashboards
- broad redesigns without workflow clarity

## OneDrive

CG Hub should have a OneDrive panel/card.

It should contain three clear external links:

- CG OneDrive
- Client OneDrive
- Once-Off OneDrive

External links must be obvious. Do not rely on tiny arrow icons only.

## Planner structure

Planner must be simple and closer to Teams Planner.

Important concepts:

- Monthly Planner is the staff-facing current-month work surface.
- Client Schedule Board is the master/full schedule backbone.
- Staff should mainly see the monthly summary.
- Admin/CA/Amonique can access and control the master schedule.

Suggested board order:

- Operations
- Websites
- Client Schedule Board
- CG Socials
- Admin

Private/admin-heavy areas should sit at the far right or last in the workflow.

## Monthly Planner

Monthly Planner should show a clear summary of the current month:

- outstanding
- in progress
- ready for review
- awaiting client approval
- Meta Drafts
- Scheduled / Posted

Staff do not need the whole year in their face to do daily work.

The monthly view should be linked to the master schedule tasks/posts.

## Master schedule

Master schedule should show the full-year content plan.

Staff may be able to view it, but they must not control final scheduling states.

Only CA and Amonique can control:

- Meta Drafts
- Scheduled / Posted
- final schedule dates
- package/master schedule structure

## Status permissions

Staff can update production statuses:

- Not started
- In progress
- Ready for review
- Awaiting client approval

Only CA and Amonique can update final scheduling statuses:

- Meta Drafts
- Scheduled / Posted

Reason: staff must track their own work so Amonique can come online and see progress without manually chasing everyone.

## Daily Tasks

Daily Tasks replaces the old Command Centre language.

Daily Tasks must be the staff starting point.

Default behaviour:

- default to the logged-in staff member
- show My Tasks first
- allow All Tasks / team view second
- priority sorted, top item first
- urgent client requests should move to the top
- quick add task must be very simple

Quick add must only require:

- task title
- save/cancel

Details should open later through a drawer/modal/menu and include:

- client
- primary assignee
- helpers/collaborators
- bucket/group
- due date
- notes
- checklist
- status
- package link if relevant

Do not show the full details form by default.

## Collaborative assignments

Tasks need:

- primary/original assignee
- helpers/collaborators

Example: Franco is primary. Sydney adds herself to help. Franco is not removed. Both remain visible as responsible for the output.

## Client requests

Client requests are tasks.

Do not build a duplicate noisy capture panel for client requests.

Workflow:

1. Add task.
2. Mark or source it as a client request if needed.
3. Paste the WhatsApp/client message into Notes.
4. Link it to package slot/add-on/moved package item when relevant.

## Package usage

Client packages must control how many deliverables are included.

Core package types:

- DP
- F
- Video
- Reel

A client request can be:

1. Use package slot
   Example: client requests a public holiday poster and Amonique links it to DP2.

2. Add-on / extra
   Example: package includes 4 DPs but the client requests 2 additional DPs. App shows 4 package DPs plus 2 add-ons and flags quote needed.

3. Move package work
   Example: client wants 2 posters this month and 6 next month. Admin moves DP3 and DP4 forward. Analytics must show only 2 package posters used this month.

The app must clearly show:

- planned package work
- client-requested package work
- add-ons/extras
- moved/deferred package work
- package usage totals by client and month
- over-package requests
- quote-needed extras

This solves the problem of clients getting unlimited extra work without it being tracked or quoted.

## CG Assistant

CG Assistant should eventually be active and helpful, but not noisy.

Good future uses:

- convert Amonique voice-note text into tasks
- create morning task suggestions
- summarise end-of-day progress
- suggest next actions from tasks/planner/client requests

Do not flood the UI with assistant paragraphs.

## CG Hours relationship

CG Hours is the source of truth for:

- time
- payroll
- commission
- finance
- clients
- task templates
- task groups/buckets

CG Dynamics must adapt to CG Hours naming.

CG Dynamics should prepare for mapping:

- CG Dynamics client to CG Hours client
- CG Dynamics bucket/type to CG Hours task_template_list
- CG Dynamics work item to CG Hours task_template
- CG Dynamics user to CG Hours user/profile

Do not deeply integrate yet.

Later, CG Dynamics can send end-of-day recommendations into CG Hours. Staff must review, fill/adjust hours, and accept. No silent payroll or finance updates.

## Timer future concept

Later, CG Dynamics can have a timer to support accurate CG Hours recommendations.

Possible behaviour:

- start task quickly without full details
- pause/resume/stop
- add notes after a call or work session
- capture elapsed time against a task
- use elapsed time as a suggested duration for CG Hours
- staff still reviews before acceptance

Because CG Dynamics is web-based, true desktop overlay may be limited. Possible options are sticky in-app timer, browser notifications, tab title timer, or PWA install mode later.

## Data import priority

Teams/Planner Excel data must still be imported.

Known state:

- Import foundation exists.
- Migration for planner tasks was run.
- Import preview script was fixed to resolve bucket names instead of raw Planner IDs.
- Generated preview SQL/JSON is ignored and not in GitHub.

Before running import:

- regenerate preview SQL/JSON locally
- review generated output
- confirm matched clients and bucket names
- then run in Supabase

Do not blindly run production import SQL without review.

## Development workflow

Before coding-agent prompts:

1. Check the relevant GitHub repo first.
2. Use GitHub as source of truth.
3. Write short focused prompts.
4. One task per prompt.
5. Tell agents to run git status, pull, build, and commit/push only if build passes.

Avoid broad prompts like make it nicer. Use focused workflow prompts.

## Near-term implementation order

Recommended order:

1. Review and import Teams data safely.
2. Split navigation into CG Dynamics and CG Hub sections.
3. Keep Clients accessible from both zones.
4. Restore OneDrive panel with the three external links.
5. Rebuild Daily Tasks around quick add and my-work-first.
6. Simplify Planner around monthly summary and master schedule relationship.
7. Link client requests to package slots/add-ons/moved package items.
8. Add/prepare CG Hours naming alignment only after core workflows are stable.
