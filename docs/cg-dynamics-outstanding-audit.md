# CG Dynamics outstanding request audit

This document tracks what the user asked for, what is done, what is only prepared, and what is still missing.

It must be checked before new coding-agent prompts so the app keeps moving toward the main goal and does not drift into side quests.

## Rule for future feedback

When user feedback changes direction:

1. Keep the main product goal intact.
2. Update this audit with the new request.
3. If it changes the actual product direction, update `docs/cg-dynamics-product-goals.md` too.
4. Do not treat small UI feedback as permission to forget the bigger workflow.

## Strict import rules (from scheduler Teams parity pass)

Applied during feat/scheduler-teams-parity:

- `scheduled_date` is the single canonical "Schedule Date" field in all UI labels — do not expose `due_date` to users in schedule views
- `scheduled_posted` status uses muted/opacity styling (`text-white/25 border-white/5`) instead of teal accent in all STATUS_TONE maps
- "Needs Action" filter excludes `approved`, `scheduled`, `posted`, `completed`, `done`, `archived` statuses
- "+N more" in calendar grids must be clickable and open a day detail drawer
- Client Schedule Board defaults to current month with month controls, not a year-long client list
- Master Schedule defaults to current month section expanded, not January
- Two separate calendars must stay separate: Package Calendar (monthly_deliverables) and Company Calendar (company_calendar_events)

## Current trust issue to correct

The app has had too much UI polishing and future-prep while core workflow gaps remain.

The biggest missing pieces are:

- real calendar / master schedule view
- Teams/Planner data imported into the live app
- package request workflow actually saving
- client brand update workflow
- content guideline / OneDrive workflow
- staff-facing calendar dates and schedule clarity
- live app verification after each deployed change

## Status key

- DONE: implemented and pushed to main
- PREPARED: UI/docs/migration exists but feature is not active until SQL or follow-up work
- PARTIAL: some pieces exist, but not enough to satisfy the real workflow
- OUTSTANDING: not properly built yet
- FUTURE: intentionally later, not current core scope

## 1. Core app goal

| Request | Status | Notes |
|---|---|---|
| Replace Teams/Planner as the main internal operations system | PARTIAL | Navigation, Daily Tasks, Planner and Monthly Planner exist. Teams Planner production data has now been imported, and imported-data workflow polish is build-verified. Live signed-in browser testing is still required. |
| Make the app easier than Teams, not more complicated | PARTIAL | Several pages were simplified, but the app still needs real workflow testing with imported data. |
| Keep CG Hub and Performance separate | DONE | Navigation zones were split and pushed. |
| Same Clients page available from both zones | DONE | Shared Clients route preserved. |
| Staff should open the app and instantly know what to do | PARTIAL | CG Hub now shows Today Focus: priority queue, scheduled today, my active work. Needs testing with real staff data. |

## 2. Visual and brand direction

| Request | Status | Notes |
|---|---|---|
| App must match CG Production House/client report visual direction | PARTIAL | Dark, bold, premium direction improved, but needs full brand polish pass across all pages. |
| Remove orange-heavy UI | PARTIAL | Big orange blocks were reduced, but copper/amber must remain small accent only. Needs continued review. |
| Use black/charcoal, subtle gradients, bold type, teal accents | PARTIAL | Implemented in several places, but not audited globally. |
| No noisy helper paragraphs | PARTIAL | Many pages cleaned, but this must remain an ongoing rule. |
| Client report view is the benchmark | PARTIAL | Product docs say this, but UI needs a full consistency audit. |
| Brand update workflow for clients | OUTSTANDING | This is not the same as app visual style. Need a workflow for client brand updates, brand notes, brand assets, and change tracking. |

## 3. Real calendar / master schedule

| Request | Status | Notes |
|---|---|---|
| Full calendar view with real month/day layout | PARTIAL | Calendar grid added to Monthly Planner with real weekdays and day numbers. |
| Calendar must use real dates for 2026, 2027, etc. | PARTIAL | Date math uses native JS Date (year, month, day) — works for any year. |
| Full-screen calendar/schedule view like screenshots shared | PARTIAL | Month grid exists in Monthly Planner. Day detail drawer added for "+N more" click-through. Full master schedule (all clients, full year) exists. |
| Master schedule must show the whole year/content plan | PARTIAL | Master Schedule page built at /admin/master-schedule. Defaults to current month section expanded. Month tab strip and "Jump to current" button added. Needs drag/drop and bulk scheduling. |
| Planner Board Client Schedule must use the same schedule source | PARTIAL | Client Schedule Board now filters by selected month with search and status filter. Reads monthly_deliverables grouped by client. |
| Monthly Planner must connect directly to master schedule/calendar | PARTIAL | Monthly Planner now has calendar view using scheduled_date. Links to Master Schedule and vice versa. |
| Staff should see monthly summary, not full-year complexity | PARTIAL | Monthly Planner calendar view shows current month only. Master Schedule now defaults to current month expanded. |
| Scheduled/Posted status visually muted (not teal) like completed work | DONE | STATUS_TONE in MonthlyPlannerPage, PlannerPage, MasterSchedulePage, and CgHubPage updated to mute scheduled_posted with grey/opacity styling. |
| "+N more" day cell overflow opens detail drawer | DONE | "+N more" buttons in MonthlyPlannerPage calendar grid open a DayDetailPanel drawer showing all items for that date. |
| "Due date" label renamed to "Schedule Date" across all schedule views | DONE | Labels changed from "Due date"/"Scheduled"/"Due" to "Schedule date" in MonthlyPlannerDetailDrawer, ScheduleDeliverableDrawer, MasterScheduleDrawer, and inline card displays. |
| CA/Amonique control final schedule dates and Scheduled/Posted states | PREPARED | UI/role split exists in Monthly Planner; RLS migration still pending. |
| Staff can view schedule but not control final scheduling | PARTIAL | Calendar view built; permissions need live testing after RLS migration. |
| Calendar dates must support CG Hours recommendations later | OUTSTANDING | Date foundation exists; CG Hours bridge still future work. |

## 4. Teams/Planner Excel data import

| Request | Status | Notes |
|---|---|---|
| Import Teams/Planner Excel exports so user can cancel Teams | DONE | Import script fixed and production import has run. Current production counts reported: planner_tasks 4,143; client_packages 38; package_deliverable_templates 243; monthly_deliverables 2,931. |
| Import must not use raw Planner IDs as bucket/client names | DONE | Importer was fixed and dry run showed bucket names resolving. |
| Review regenerated preview SQL/JSON before running | OUTSTANDING | Generated files are local/ignored and need review before Supabase run. |
| Import operational boards/tasks | PARTIAL | Live planner_tasks import completed. Daily Tasks now loads imported tasks with native quick-add tasks, readable buckets and useful filters. Needs live signed-in browser testing with staff/admin roles. |
| Import client schedule/monthly package data | PARTIAL | Live client packages/templates/monthly deliverables import completed. Monthly Planner, Master Schedule, Package and Clients pages now surface imported production data. Needs live signed-in browser testing. |
| Remove imported Planner tasks from active views | PREPARED | UI/code path added. Requires running supabase/phase-9a-planner-task-archive.sql before imported planner_tasks can be archived instead of hard deleted. |
| Protect admin-sensitive checklist boards | PREPARED | Admin board logic exists, but must be verified with imported data. |

Known source workbooks:

- 2025 CLIENTS SCHEDULE.xlsx
- To Do.xlsx
- Client Websites.xlsx
- ADMIN CHECK LIST.xlsx

## 5. Planner board

| Request | Status | Notes |
|---|---|---|
| Planner should feel like Teams Planner | PARTIAL | Board, columns, quick add and drawer exist, but needs imported data and usability testing. |
| Simple columns/cards | PARTIAL | Implemented, but visual/usability still needs review with data. |
| Quick add per column | DONE | Added in Planner board. |
| Task details hidden until clicked | DONE | Planner task drawer added. |
| Admin/private boards last/outskirts | DONE/PARTIAL | Sorting/positioning added, but needs testing with actual boards. |
| Import button quiet | DONE | Kept as small admin action. |
| Planner should not become the daily staff focus page | DONE | Daily Tasks is separate. |

## 6. Daily Tasks

| Request | Status | Notes |
|---|---|---|
| Rename Command Centre to Daily Tasks | DONE | UI language changed. |
| Daily Tasks should be staff start page | PARTIAL | CG Hub Today Focus is now the real start screen (priority queue, scheduled today, quick add). Daily Tasks remains the full task list. |
| Default to active staff member/my tasks | PARTIAL | Logic added where profile can match assigned_to_name. Needs real user testing. |
| Staff can still view team/all tasks where allowed | PARTIAL | Filters exist. Needs role testing. |
| Priority stack: client requests, urgent, overdue, today, in progress | DONE/PARTIAL | Sort logic added, must be tested with real tasks. |
| Quick add should only require title | DONE/PARTIAL | Quick add simplified; check live UI. |
| Details should open in drawer | DONE | Daily task drawer added. |
| Remove duplicate client request/WhatsApp panel | PARTIAL | Client request should be task + notes. Verify old noisy panel is gone. |
| Morning message and end-of-day update are useful but lower priority | DONE/PARTIAL | Moved lower, needs live review. |
| Staff should update their own production status | PARTIAL | UI supports status; RLS migration pending for monthly deliverables. |

## 7. Monthly Planner

| Request | Status | Notes |
|---|---|---|
| Monthly Planner is the main staff-facing content production summary | PARTIAL | Page exists with calendar grid, day detail drawer, and Teams-style status semantics. |
| Show current month summary | PARTIAL | Summary exists with status counts, stats, and calendar grid. |
| Show DP/F/Video/Reel totals | DONE/PARTIAL | Totals exist, but need data verification. |
| Use short codes: DP, F, Video, Reel | DONE/PARTIAL | Implemented in package/client pages and monthly views. Verify globally. |
| Show status counts | DONE/PARTIAL | Existing status counts/totals exist. |
| Source chips: Package, Client request, Moved/Replaced, Unlinked | DONE/PARTIAL | Added to Monthly Planner. |
| Deliverable drawer | DONE | Fully functional. |
| Calendar day cells show "+N more" overflow | DONE | Clickable buttons open DayDetailPanel drawer with all items for that date. |
| "Schedule date" is canonical label throughout UI | DONE | Changed from "Due date"/"Scheduled" to "Schedule date" in drawer and card displays. |
| scheduled_posted status visually muted as completed work | DONE | Uses `text-white/25 border-white/5 bg-white/[0.02]` instead of teal. |
| Staff/admin status split | PREPARED | UI exists; RLS migration pending. |
| Admin package action placeholder | PREPARED | Buttons exist as placeholder after migration. Not saving yet. |

## 8. Client packages

| Request | Status | Notes |
|---|---|---|
| Packages must be quantity based only | PARTIAL | Package Master has DP/F/Video/Reel quantity editing. Needs testing. |
| Package Master should not feel like a separate noisy app | PARTIAL | Simplified, but still needs integration into client/control centre flow. |
| Generate monthly deliverables from packages | PARTIAL | Generation exists, but needs real data and calendar linkage. |
| Archive packages | PARTIAL | Exists in UI, needs testing. |
| Client page should show package chips | PARTIAL | Added, needs live review. |

## 9. Client requests and package usage

| Request | Status | Notes |
|---|---|---|
| Client requests are tasks | PARTIAL | Daily Tasks supports client request priority/source, but full package link not active. |
| Paste WhatsApp/client message into notes | PARTIAL | Notes label adapts for client request tasks. Needs testing. |
| Link request to package slot | PREPARED | Migration and placeholder exist. Actual save workflow not active. |
| Mark request as add-on/extra | PREPARED | Placeholder exists. Actual save workflow not active. |
| Move package work to another month | PREPARED | Placeholder exists. Actual save workflow not active. |
| Show package usage totals by client and month | PARTIAL | Monthly summary source chips/totals started, but full package accounting not done. |
| Flag quote-needed extras | PREPARED | Migration field planned. Save/reporting not active. |
| Clearly show when normal planned posters were moved for a request | PREPARED/PARTIAL | Source chips exist, but actual move/link workflow not active. |

## 10. Client page / control centre

| Request | Status | Notes |
|---|---|---|
| Clients page should be available in CG Hub and Performance | DONE | Shared route. |
| Clients page should be a control centre | PARTIAL | Package/performance/production/admin columns added, but needs testing and more depth. |
| Link client to package settings | PARTIAL | Package links exist. Needs flow review. |
| Link client to Monthly Planner | PARTIAL | Links exist or planned; verify live. |
| Link client to reports/performance/client preview | PARTIAL | Links exist; verify live. |
| Link client to OneDrive/assets later | OUTSTANDING | Not built. |

## 11. Client brand updates

| Request | Status | Notes |
|---|---|---|
| Track brand updates/brand direction changes for clients | OUTSTANDING | Needs a proper module or client sub-section. |
| Store brand notes/guidelines per client | OUTSTANDING | Not built. |
| Track when client brand assets are updated | OUTSTANDING | Not built. |
| Connect brand updates to content planning | OUTSTANDING | Not built. |
| Connect brand updates to reports/strategy where relevant | OUTSTANDING | Not built. |

This must be added as a core goal, not a forgotten side note.

## 12. OneDrive and content guideline workflow

| Request | Status | Notes |
|---|---|---|
| Hub OneDrive panel with CG, Client, Once-Off links | DONE/PARTIAL | Panel exists, some links may still be placeholders. |
| External links must be clear | PARTIAL | Improved, but verify live. |
| Integrate content guideline with videos/reels and OneDrive naming | OUTSTANDING | Important future module. |
| Track what videos were shot | OUTSTANDING | Not built. |
| Track what was not shot and can be shot later | OUTSTANDING | Not built. |
| Track ready-to-edit videos/reels | OUTSTANDING | Not built. |
| Link tasks/deliverables to correct OneDrive folders | OUTSTANDING | Not built. |
| Help allocate external/temporary editors | OUTSTANDING | Not built. |

## 13. CG Assistant

| Request | Status | Notes |
|---|---|---|
| Assistant should help, not add noise | PARTIAL | UI simplified, but assistant is not yet deeply useful. |
| Convert Amonique voice-note text into tasks | OUTSTANDING | Not built. |
| Create morning task suggestions | PARTIAL | Morning message exists, task generation flow needs testing/improvement. |
| Summarise end-of-day progress | PARTIAL | End-of-day update exists, needs testing with real data. |
| Suggest next actions from tasks/planner/client requests | OUTSTANDING | Not built. |
| Help with content guideline/OneDrive checks later | OUTSTANDING | Not built. |

## 14. Staff collaboration

| Request | Status | Notes |
|---|---|---|
| Primary assignee must remain visible | PARTIAL | Current assigned_to_name remains. |
| Helpers/collaborators should be additional, not replacement | PREPARED | Migration and placeholders created. Not active until SQL and save UI. |
| Example: Sydney helps Franco without replacing Franco | PREPARED | Documented and placeholder added. Not active. |
| Helpers should apply to Daily Tasks, Planner tasks and Monthly deliverables | PREPARED | Placeholder in all three drawers. |

## 15. Status permissions

| Request | Status | Notes |
|---|---|---|
| Staff can set Not started | PARTIAL | UI supports normal statuses. Needs RLS and live test. |
| Staff can set In progress | PARTIAL | UI supports normal statuses. Needs RLS and live test. |
| Staff can set Ready for review | PARTIAL | UI supports normal statuses. Needs RLS and live test. |
| Staff can set Awaiting client approval | PARTIAL | UI supports normal statuses. Needs RLS and live test. |
| Only CA/Amonique/admin can set Meta Drafts | PREPARED | UI split exists. RLS migration pending. |
| Only CA/Amonique/admin can set Scheduled/Posted | PREPARED | UI split exists. RLS migration pending. |

## 16. CG Hours relationship

| Request | Status | Notes |
|---|---|---|
| CG Hours is source of truth for time/payroll/commission/finance | DONE in docs | Must not be touched yet. |
| CG Dynamics must align naming to CG Hours | OUTSTANDING/PARTIAL | Needs GitHub audit of CG Hours naming before active mapping. |
| Future CG Hours recommendations from Dynamics | FUTURE | Timer foundation exists, but integration must wait. |
| No direct payroll/finance updates from Dynamics | DONE in docs | Must remain a hard rule. |
| Timer foundation | PREPARED | Migration + placeholders created, but not applied or active. |

## 17. Calendar and dates for staff/work tracking

| Request | Status | Notes |
|---|---|---|
| Tasks/deliverables must be date-aware | PARTIAL | Due dates and scheduled dates exist; Monthly Planner now has calendar view using scheduled_date. |
| Staff must know what day work belongs to | PARTIAL | Daily Tasks has due dates; Monthly Planner calendar view now shows which day each deliverable falls on. |
| Full month calendar must show actual weekdays/dates | PARTIAL | Month calendar grid built in Monthly Planner with Sun–Sat headers, real day numbers and Today marker. |
| Future CG Hours suggestions need correct work date | OUTSTANDING | Timer/date context must be connected later. |
| Real date handling for 2026/2027 and future years | PARTIAL | Calendar uses native JS Date arithmetic — correct for any year including 2026, 2027+. |

## 18. Performance/reporting side

| Request | Status | Notes |
|---|---|---|
| Performance side must stay separate from staff work | DONE/PARTIAL | Zones split. Needs live review. |
| Client preview must remain accessible | DONE/PARTIAL | Link restored, needs live test. |
| Reports and Meta sync remain available | PARTIAL | Performance dashboard links exist, deeper workflows need testing. |
| Connect package delivery history to reporting later | OUTSTANDING | Not built. |

## 19. Mobile usage

| Request | Status | Notes |
|---|---|---|
| App should be usable from phone | PARTIAL | Mobile polish done, but live testing still needed. |
| Drawers should work on mobile | PARTIAL | Mobile drawer footers fixed, needs user test. |
| Phone can be used for coding-agent workflow | DONE outside app | User can use Claude/Copilot mobile, but app itself still needs mobile verification. |

## 20. Setup/migrations

| Request | Status | Notes |
|---|---|---|
| Setup Checklist page | OUTSTANDING/IN PROGRESS | Claude hit usage limit before completing. |
| phase-6f staff production status RLS | PREPARED | SQL file exists, not applied. |
| phase-7a client request package link | PREPARED | SQL file exists, not applied. |
| phase-7b helpers/collaborators | PREPARED | SQL file exists, not applied. |
| phase-7c dynamics timer | PREPARED | SQL file exists, not applied. |
| Apply migrations in Supabase | OUTSTANDING | Needs laptop/Supabase or explicit manual execution. |

## 21. What is not good enough yet

These items are not acceptable as “done” yet:

- empty Planner/Monthly Planner/Master Schedule without imported data
- Master Schedule without real Teams/Planner data loaded (all months appear empty until import runs)
- Master Schedule without drag/drop date assignment or bulk scheduling
- RLS migrations not applied — final scheduling status restrictions (Meta Drafts, Scheduled/Posted) not enforced at DB level yet
- package action buttons that only say after migration
- helper/collaborator placeholders without active save logic
- timer placeholders without active timer logic
- client package tracking without actual usage/add-on/move save workflow
- app visual style that is only partly aligned with CG Production House/client report style
- client brand update workflow missing entirely

## Correct next implementation priority

Do not continue with CG Hours integration now.

Next order should be:

1. Finish Setup Checklist only if useful.
2. Apply pending Supabase migrations.
3. Regenerate and review Teams import preview.
4. Import real Teams/Planner data.
5. ~~Build the real calendar/master schedule month view.~~ DONE — Monthly Planner calendar + Master Schedule page built.
6. ~~Link Monthly Planner to the master schedule/calendar.~~ DONE — "Year view" link in Monthly Planner, "Monthly view" link in Master Schedule.
7. ~~Add Hub Today Focus so staff know what to do instantly.~~ DONE — CG Hub shows priority queue, scheduled today, my active work, quick add task.
8. Activate package request workflow: package slot, add-on, moved work, quote needed.
9. Add client brand update workflow.
10. Activate helpers/collaborators.
11. Activate timer only after calendar/package/staff workflows are stable.
12. Then consider CG Hours recommendation bridge.

## Main correction from latest feedback

The calendar/master schedule is not optional polish.

It is core.

A proper calendar view must show real dates and real months. It must connect staff tasks, Monthly Planner and future CG Hours recommendations to actual work dates.

Brand updates are also a core missing workflow and must be added to the product goals/backlog.
