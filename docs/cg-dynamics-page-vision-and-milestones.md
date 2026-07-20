# CG Dynamics Page Vision And Milestones

This document is the product constitution for CG Dynamics page behavior. It is
not a wishlist, roadmap brainstorm, or loose design note. It defines what each
major page is for, what data it may use, what it must never become, and how to
test regressions.

Page contracts override generic product ideas. If a future feature conflicts
with this document, update this document deliberately first, then implement the
feature.

## Global Product Rules

- CG Dynamics is the daily operating system for CG Production House staff.
- Client Schedule, Master Schedule, Client Dashboard, and the client-ready
  calendar are all views over client content schedule work. The source of truth
  is `monthly_deliverables`.
- CG Calendar is the Microsoft Teams-style operational company calendar. It is
  not the content posting schedule.
- Planner Board (`planner_tasks`) is operational task management. It is separate
  from Client Schedule and must not be merged into `monthly_deliverables`.
- Client-facing pages must be client-safe: no internal assignee clutter,
  private notes, helper names, raw IDs, admin diagnostics, or sensitive setup.
- AI/assistant features must use current app data and role-specific context.
  They must not invent work, clients, statuses, or demo data.
- Admin/security settings are owner/admin territory. Managers manage operations;
  staff execute their work; clients only see their client area.

## Role Model

- `admin`: full access to users, roles, clients, invites, Meta setup, reports,
  dashboards, settings, imports, schedules, and all operational pages.
- `manager`: operational leadership. Can manage schedules, Planner, Calendar,
  Client Schedule, Client Dashboard, reports, approvals, imports, and syncs.
  Cannot manage owner/admin security settings.
- `staff` / `team`: execution role. Can access My Day, Hub, Planner visibility,
  CG Calendar visibility, assigned work, timers/status updates, and personal
  assistant context. Cannot manage users, roles, dangerous setup, or security.
- `client`: client portal/dashboard only, scoped to their own client data.

## 1. CG Hub

### Page Purpose
The staff start screen. It answers: what matters today, what is urgent, what is
overdue, and where should the user go next?

### Primary Users
Admin, manager, staff/team.

### What Belongs
- Today summary.
- This week summary.
- Urgent and overdue operational work.
- Assigned work for the signed-in user.
- Client requests and blockers.
- Upcoming events/content runs.
- Links into My Day, Planner, CG Calendar, Client Schedule, Client Dashboard.

### What Must Not Belong
- Random launch tiles without status context.
- Full user management.
- Full Meta setup.
- Client portal-only content.
- Large AI agent marketplace.

### Correct Data Sources
- `profiles` for the signed-in user.
- `planner_tasks` for operational work.
- `company_calendar_events` for meetings, shoots, content runs, client events,
  deadlines, and internal events.
- `monthly_deliverables` only for concise assigned client work summaries and
  links to Client Schedule.
- Client request/task sources already used by Command Centre.

### Forbidden Data Sources
- Fake/demo data.
- Hardcoded client names.
- Raw Meta tokens or integration secrets.

### Allowed Actions
- Navigate to source pages.
- Mark owned/assigned work where existing status models support it.
- Open My Day.

### Forbidden Actions
- Editing user roles.
- Running dangerous sync/setup actions.
- Editing Client Schedule inline in Hub unless explicitly designed as a safe
  shortcut later.

### Role Access
- Admin: all Hub summaries.
- Manager: operational summaries.
- Staff: personal/assigned summaries.
- Client: no access.

### Connected Pages
My Day, Planner Board, CG Calendar, Client Schedule, Client Dashboard, Daily
Tasks / Command Centre, CG Assistant.

### AI/Assistant Role
Summarize the signed-in user’s day and suggest next action from existing data.
No autonomous changes.

### Empty States
- Show useful setup hints when no tasks/events exist.
- Distinguish no assigned work from query/migration errors.

### Milestone Phases
- Phase 1: Today/overdue/assigned summaries.
- Phase 2: My Day preview and current/next task.
- Phase 3: Assistant-informed recommendations.

### Done Criteria
- Staff can start the day from Hub without visiting admin-heavy pages.
- All cards link to the correct source pages.

### Regression Tests
- Staff user sees assigned work, not admin setup.
- Client user cannot access Hub.
- Empty Planner or Calendar data shows helpful messages.

## 2. My Day

### Page Purpose
Personal workforce screen for each staff member. It turns assigned work and
fixed events into a deterministic daily plan.

### Primary Users
Staff/team, manager, admin.

### What Belongs
- Staff member name and today date.
- Fixed events, shoots, content runs, client events, deadlines.
- Assigned Planner tasks.
- Assigned content/client work.
- Overdue work.
- Current task and next task.
- Timeline from 08:00 to 17:00.
- Suggested task blocks around fixed events.
- Impossible workload warning.
- Links to source items.

### What Must Not Belong
- Generic team-wide dashboards as the primary view.
- Client-safe portal content.
- Fake AI scheduling.
- User management.

### Correct Data Sources
- `profiles` for current user.
- `planner_tasks` assigned to current user.
- `company_calendar_events` assigned to or relevant for current user.
- `monthly_deliverables` only for assigned client content work summaries.

### Forbidden Data Sources
- All-client schedule firehose unless filtered to assigned/relevant work.
- Fake workload/demo blocks.

### Allowed Actions
- Mark existing Planner task statuses where supported.
- Start task / mark in progress where supported.
- Navigate to source pages.
- Surface blocked/done/move actions only when existing models support them.

### Forbidden Actions
- Editing roles/users.
- Creating AI-generated work without confirmation.
- Editing Client Schedule package data outside source pages.

### Role Access
- Admin/manager can view their own My Day and may later inspect staff days.
- Staff sees their own My Day.
- Client: no access.

### Connected Pages
Hub, Planner Board, CG Calendar, Client Schedule, Daily Tasks / Command Centre,
CG Assistant.

### AI/Assistant Role
Explain the day, highlight overload, suggest next deterministic action. No fake
automation.

### Empty States
- “No assigned work today” with links to Planner/Calendar.
- Separate overdue and query error messages.

### Milestone Phases
- Phase 1: Assigned work and fixed event list.
- Phase 2: Timeline and task block suggestions.
- Phase 3: Assistant guidance and workload balancing.

### Done Criteria
- Staff can answer “what do I do now?” from this page.
- Timeline never invents work.

### Regression Tests
- Staff sees only their relevant assigned work.
- Fixed events appear before flexible tasks.
- Overbooked day shows warning.

## 3. CG Calendar

### Page Purpose
Microsoft Teams-style operational company calendar.

### Primary Users
Admin, manager, staff/team.

### What Belongs
- Meetings.
- Shoots.
- Content runs.
- Client events.
- Deadlines.
- Internal company events.
- Optional dated Planner tasks if they are real operational tasks.

### What Must Not Belong
- Client Schedule posts.
- `monthly_deliverables`.
- DP/F/Video/Reel package items.
- Package work firehose.
- Client content calendar presentation.

### Correct Data Sources
- `company_calendar_events`.
- Optional `planner_tasks` with `due_date`, excluding recurring templates,
  archived rows, completed/history statuses.

### Forbidden Data Sources
- `monthly_deliverables`.
- Client package tables as calendar chips.
- Meta/reporting tables.

### Allowed Actions
- Create/edit/delete company calendar events where role permits.
- Toggle event types.
- Optional Planner task visibility.
- Navigate to Planner for tasks.

### Forbidden Actions
- Editing Client Schedule posts.
- Showing scheduled content as default or primary layer.
- Complaining that scheduled posts are missing.

### Role Access
- Admin/manager: manage company events.
- Staff: view events and operational tasks; event edit only if permitted.
- Client: no access.

### Connected Pages
Hub, My Day, Planner Board, Daily Tasks / Command Centre.

### AI/Assistant Role
Use as fixed event context for My Day and Assistant suggestions.

### Empty States
- Show event count and optional Planner dated task count.
- Show migration/seed hints for `company_calendar_events`.
- Show Planner query hints if task layer fails.
- Never mention missing scheduled posts.

### Milestone Phases
- Phase 1: Events CRUD and month/agenda views.
- Phase 2: Optional Planner dated task overlay.
- Phase 3: My Day timeline integration.

### Done Criteria
- Default CG Calendar shows operational events only.
- Client Schedule work is absent.

### Regression Tests
- DP/F/Video/Reel items do not appear.
- Missing event table does not blank Planner task layer.
- Mobile view shows events and optional tasks only.

## 4. Daily Tasks / Command Centre

### Page Purpose
Daily operational command input and triage center.

### Primary Users
Admin, manager, staff/team.

### What Belongs
- Daily task entry/import.
- Operational task triage.
- Staff assignment/status updates.
- Today-specific task operations.

### What Must Not Belong
- Long-term content schedule ownership.
- Client portal content.
- User/security management.

### Correct Data Sources
- `planner_tasks` and existing command centre task sources.
- `profiles` for staff names.
- Active clients only when linking explicit client work.

### Forbidden Data Sources
- Fake pasted examples as saved data.
- Client-only portal views.

### Allowed Actions
- Create/update operational tasks.
- Assign and move daily work where supported.
- Link to Planner/My Day.

### Forbidden Actions
- Editing monthly deliverables unless explicitly routed to Client Schedule.
- Changing roles/users.

### Role Access
Admin/manager full operational access; staff assigned-work operations; client no
access.

### Connected Pages
Hub, My Day, Planner Board, CG Calendar.

### AI/Assistant Role
Assist parsing/triage later, but no hidden data writes without explicit review.

### Empty States
Show how to add daily tasks and whether Planner data is missing.

### Milestone Phases
- Phase 1: Daily task capture.
- Phase 2: Assignment/status flow.
- Phase 3: My Day and Assistant integration.

### Done Criteria
Daily tasks can become actionable assigned work.

### Regression Tests
Staff cannot access admin/security functions from Command Centre.

## 5. Planner Board

### Page Purpose
Operational task board replacing Microsoft Planner for internal work.

### Primary Users
Admin, manager, staff/team.

### What Belongs
- Operational tasks.
- Buckets/boards.
- Status, priority, due date, assignment, helpers.
- Recurring task instances, not templates as active work.

### What Must Not Belong
- Client Schedule as a duplicated editing system.
- Client portal-only views.
- Package deliverable source-of-truth editing except via intended Client
  Schedule board integration.

### Correct Data Sources
- `planner_tasks`.
- `planner_boards`.
- `planner_buckets`.
- Shared helpers in `src/lib/planner.ts`.

### Forbidden Data Sources
- Duplicate schedule tables.
- Fake demo boards/tasks.

### Allowed Actions
- Create/update/archive operational tasks.
- Change status/priority/assignment.
- Materialise recurring instances safely.

### Forbidden Actions
- Showing recurring templates as active work.
- Creating duplicate imported tasks.
- Editing `monthly_deliverables` outside explicit Client Schedule paths.

### Role Access
Admin/manager full operational access; staff visibility and assigned updates;
client no access.

### Connected Pages
Hub, My Day, CG Calendar, Daily Tasks / Command Centre, Planner Import.

### AI/Assistant Role
Provide task context and next actions. No autonomous task creation without
confirmation.

### Empty States
Show missing boards/buckets/tasks distinctly.

### Milestone Phases
- Phase 1: Stable board/task management.
- Phase 2: Recurrence/import hardening.
- Phase 3: My Day workload planning.

### Done Criteria
Planner is reliable operational task source for staff work.

### Regression Tests
- Templates hidden from active work.
- Completed/history tasks do not clutter active views.
- Import hashes prevent duplicates.

## 6. Client Schedule

### Page Purpose
Operational content production and posting schedule.

### Primary Users
Admin, manager, content staff.

### What Belongs
- DP/F/Video/Reel monthly deliverables.
- Scheduled posts.
- Client package work.
- Content delivery tracking.
- Status, schedule date, due date, client/package context.

### What Must Not Belong
- Company meetings as primary events.
- Generic staff calendar management.
- User management.

### Correct Data Sources
- `monthly_deliverables` as source of truth.
- Client/package tables as supporting context.

### Forbidden Data Sources
- New duplicate content schedule tables.
- `company_calendar_events` as content post source.

### Allowed Actions
- Schedule/edit deliverables.
- Update status/assignee/core schedule fields.
- Link to Client Dashboard/Master Schedule.

### Forbidden Actions
- Writing company calendar meetings.
- Guessing `client_id`.

### Role Access
Admin/manager full; staff operational updates as permitted; client no direct
admin access.

### Connected Pages
Master Schedule, Client Dashboard, Client Portal, Client-ready calendar, Hub/My
Day summaries.

### AI/Assistant Role
Summarize workload and blockers using existing schedule data.

### Empty States
Show month/client filters and explain no package posts match.

### Milestone Phases
- Phase 1: Reliable schedule editing.
- Phase 2: Staff workload and dashboard connections.
- Phase 3: Assistant summaries.

### Done Criteria
All content schedule edits happen here, not CG Calendar.

### Regression Tests
Changing schedule date updates all read-only schedule views.

## 7. Master Schedule

### Page Purpose
Full-year/monthly overview of all content schedule work.

### Primary Users
Admin, manager, content leads.

### What Belongs
- Many scheduled posts and deliverables.
- Year/month/client status overview.
- Content workload trends.

### What Must Not Belong
- Company meetings calendar.
- User/security management.

### Correct Data Sources
- `monthly_deliverables`.
- Client/package metadata.

### Forbidden Data Sources
- `company_calendar_events` as content schedule.
- Fake package data.

### Allowed Actions
- Navigate to Client Schedule/Client Dashboard.
- Bulk overview/filtering. Editing only if explicitly routed safely.

### Forbidden Actions
- Creating a second schedule source of truth.

### Role Access
Admin/manager; staff if operationally needed; client no admin access.

### Connected Pages
Client Schedule, Client Dashboard, Reports.

### AI/Assistant Role
Portfolio-level workload/status summary later.

### Empty States
Explain missing monthly deliverables or filters.

### Milestone Phases
- Phase 1: Readable overview.
- Phase 2: Risk/overdue highlighting.
- Phase 3: Forecasting summaries.

### Done Criteria
It can show many scheduled posts because that is its purpose.

### Regression Tests
Full-year view does not write to a duplicate table.

## 8. Client Dashboard

### Page Purpose
Client command centre for staff: premium, clean, client-safe operational and
performance context.

### Primary Users
Admin, manager, staff handling clients.

### What Belongs
- Client-safe performance summary.
- Upcoming work and scheduled content.
- Report status.
- Meta health.
- Next actions.

### What Must Not Belong
- Internal-only notes/IDs/secrets.
- Full user/security management.
- Raw Meta tokens.

### Correct Data Sources
- Clients.
- Reports/performance tables.
- `monthly_deliverables` for scheduled content.
- Meta connection health summaries.

### Forbidden Data Sources
- Raw secret/token tables in client code.
- Fake performance numbers.

### Allowed Actions
- Navigate to reports, Client Schedule, Meta, client preview.
- Staff-safe next actions.

### Forbidden Actions
- Exposing internal helper notes to clients.
- Editing owner/security setup.

### Role Access
Admin/manager/staff as permitted; clients use Client Portal instead.

### Connected Pages
Client Schedule, Reports, Meta / Integrations, Client Portal.

### AI/Assistant Role
Suggest client next actions from real data.

### Empty States
Explain missing reports, schedule, or Meta connection.

### Milestone Phases
- Phase 1: Clean operational dashboard.
- Phase 2: Report/schedule/action maturity.
- Phase 3: Assistant-guided client management.

### Done Criteria
Premium, clean, client-safe dashboard for internal client handling.

### Regression Tests
No internal secrets or unsafe fields render.

## 9. Client Portal

### Page Purpose
Client-only area showing only the client’s own approved/safe data.

### Primary Users
Clients.

### What Belongs
- Client-safe reports.
- Approved content calendar/preview.
- Client’s own dashboard data.

### What Must Not Belong
- Internal task board.
- Staff assignments/helpers.
- User management.
- Other clients’ data.

### Correct Data Sources
- Client-scoped reports and deliverables.
- Client profile/linking data.

### Forbidden Data Sources
- Cross-client data.
- Admin diagnostics.
- Internal Planner data.

### Allowed Actions
- View own client content/reports.
- Future approve/comment actions only if explicitly designed.

### Forbidden Actions
- Editing schedules directly.
- Seeing internal operations.

### Role Access
Client only, scoped to linked client. Admin may use previews, not portal auth as
client data bypass.

### Connected Pages
Client Dashboard, Reports, client-ready calendar.

### AI/Assistant Role
None by default unless client-safe assistant is explicitly designed.

### Empty States
Explain no published report/content yet.

### Milestone Phases
- Phase 1: Safe report/dashboard viewing.
- Phase 2: Approval/comment workflows.
- Phase 3: Client-safe assistant if approved.

### Done Criteria
Client cannot see any other client or internal-only data.

### Regression Tests
RLS/client filters prevent cross-client access.

## 10. Meta / Integrations

### Page Purpose
Connect and sync Meta assets/data safely.

### Primary Users
Admin, manager where approved.

### What Belongs
- Meta connection health.
- Asset linking.
- Sync controls and progress.
- Diagnostics safe for staff.

### What Must Not Belong
- Raw tokens/secrets.
- General user management.
- Content schedule editing.

### Correct Data Sources
- Meta connection tables via safe Edge Functions.
- `meta_client_assets`.
- Sync queue/status tables.

### Forbidden Data Sources
- Service-role secrets in client code.
- Raw provider tokens in UI/logs.

### Allowed Actions
- Connect/reconnect Meta.
- Link assets to clients on explicit save.
- Run/retry authorized syncs.

### Forbidden Actions
- Guessing `client_id`.
- Logging secrets.
- Running production SQL.

### Role Access
Admin full; manager may run operational sync if allowed; staff no dangerous
setup; client no access.

### Connected Pages
Client Dashboard, Reports, Client Schedule.

### AI/Assistant Role
Use summarized health/status only.

### Empty States
Explain missing connection, missing assets, missing queue migration.

### Milestone Phases
- Phase 1: Safe connect/link/sync.
- Phase 2: Background queue reliability.
- Phase 3: Health and client dashboard integration.

### Done Criteria
Sync is safe, observable, and never exposes secrets.

### Regression Tests
No token strings render; queue progress survives navigation.

## 11. Planner Import

### Page Purpose
Preview-first Microsoft Planner Excel import into CG Dynamics Planner.

### Primary Users
Admin, manager if import permission is allowed.

### What Belongs
- Excel upload.
- Preview categories: New, Already imported, Conflict.
- Admin approval before writes.
- Missing bucket creation preview.
- Errors and warnings.

### What Must Not Belong
- Automatic writes on upload.
- Conflict rows preselected.
- Duplicate task creation.

### Correct Data Sources
- Uploaded workbook.
- `planner_tasks`, `planner_boards`, `planner_buckets`.
- Existing CLI import hash recipe.

### Forbidden Data Sources
- Client Schedule import writes unless explicitly using the CLI/migration path.
- Fake task rows.

### Allowed Actions
- Preview import.
- Apply approved rows with duplicate protection.
- Create missing buckets safely.

### Forbidden Actions
- Non-admin apply.
- Preselect conflict rows.
- Bypass `import_hash` idempotency.

### Role Access
Admin apply. Manager only if explicitly permitted. Staff/client no apply.

### Connected Pages
Planner Board, Admin settings/import docs.

### AI/Assistant Role
None required; can explain conflicts later.

### Empty States
Explain how to export Planner Excel and what fields are required.

### Milestone Phases
- Phase 1: Preview and safe apply.
- Phase 2: Better conflict resolution.
- Phase 3: Guided migration tooling.

### Done Criteria
Re-uploading an imported file shows rows as Already imported.

### Regression Tests
`xlsx` lazy-loaded; duplicate rows do not create duplicate tasks.

## 11A. Microsoft Sync

### Page Purpose
Temporary one-way transition reconciliation while Microsoft and CG Dynamics
coexist. Microsoft is read-only upstream; CG Dynamics is the execution view.

### Primary Users
Admin. Connected agents may provide the same normalized transport through the
documented operator workflow.

### What Belongs
- Server-side connection and allowlisted source availability.
- Complete Outlook and Planner source fetches with explicit Outlook range.
- Preview actions: create, update, unchanged, complete, reopen, move, cancel,
  archive/source-removed, conflict, skipped and failed.
- Explicit approval for writes and separate source-removal approval.
- Progress, run history, per-item results and transition lifecycle state.

### What Must Not Belong
- Microsoft write-back or two-way sync.
- Browser-visible Microsoft credentials.
- Client Socials cards in CG Calendar.
- Removal inference from incomplete sources or narrow/failed ranges.
- Hard deletion of Microsoft-linked records.

### Correct Data Sources
- Allowlisted operational Outlook calendar and Planner plans.
- `planner_tasks` for operational Planner work.
- `monthly_deliverables` for Client Socials and no duplicate schedule table.
- `company_calendar_events` for operational Outlook events.
- Phase 15a exact Microsoft source IDs and Microsoft sync run/item audit tables.

### Allowed Actions
- Admin fetches and previews current Microsoft state.
- Admin applies reviewed Microsoft-owned field changes.
- Admin pauses or completes transition mode.
- Connected agent submits a complete normalized version 2 snapshot.

### Role Access
Admin only. Staff consume reconciled work through Hub, My Work, Planner,
Calendar and Client Schedule. Clients have no access.

### Done Criteria
Repeat runs are idempotent, source completeness is explicit, CG-only fields are
preserved, removals require complete-source proof and no Microsoft writes occur.

### Regression Tests
Client Socials never enter CG Calendar; incomplete sources never create removal
actions; local baseline conflicts remain blocked; paused/complete mode blocks
fetch and apply; imported exact source IDs never duplicate.

## 12. User Management

### Page Purpose
Admin-managed users, roles, invites, client links, and permissions.

### Primary Users
Admin.

### What Belongs
- List profiles/users.
- Full name, email, role, linked client, created date.
- Safe role/client updates.
- Staff, manager, client invites.
- Pending and accepted invites.
- Revoke pending invites.
- Copy invite/login link workflow.

### What Must Not Belong
- Staff self-service role changes.
- Client-visible user directory.
- Operational schedules as primary content.

### Correct Data Sources
- `profiles`.
- `invites`.
- `clients` for client invite linking.

### Forbidden Data Sources
- Auth provider secrets.
- Guessed client UUIDs.

### Allowed Actions
- Admin creates/revokes invites.
- Admin updates safe profile fields/roles.
- Client invite requires explicit selected client.

### Forbidden Actions
- Staff managing users.
- Manager changing owner/admin security settings.
- Deleting real users without explicit destructive workflow.

### Role Access
Admin only for full page. Manager may receive future limited operations view,
not security settings. Staff/client no access.

### Connected Pages
Settings/Admin panel, Client list, Auth/invite claim flow.

### AI/Assistant Role
None for permissions. Assistant must not make role/security changes.

### Empty States
Show no users/invites with create invite CTA and migration hints.

### Milestone Phases
- Phase 1: Admin users/invites foundation.
- Phase 2: Manager role permissions.
- Phase 3: Audit logs and advanced security.

### Done Criteria
Admin can invite and role-manage without SQL console.

### Regression Tests
Staff cannot access; client invite requires client; pending revoke works.

## 13. CG Assistant

### Page Purpose
User-specific assistant grounded in CG Dynamics data.

### Primary Users
Admin, manager, staff/team.

### What Belongs
- Context-aware summaries.
- Assigned tasks.
- Today events/content runs.
- Overdue work.
- Scheduled assigned client work.
- Next suggested action.
- Relevant clients.

### What Must Not Belong
- One generic assistant for everyone.
- Secrets/tokens.
- Invented tasks/clients.
- Autonomous destructive actions.

### Correct Data Sources
- Signed-in `profile` and role.
- `planner_tasks` filtered to role/user context.
- `company_calendar_events` relevant to user.
- `monthly_deliverables` for relevant assigned client work.
- Client data scoped by permissions.

### Forbidden Data Sources
- Raw secrets.
- Cross-client data for clients.
- Outdated hardcoded client lists.

### Allowed Actions
- Explain current context.
- Suggest next action.
- Link users to source pages.

### Forbidden Actions
- Writing data without confirmation.
- Making security/role changes.

### Role Access
Admin/manager/staff with role-specific context. Client assistant only if
explicitly client-safe later.

### Connected Pages
Hub, My Day, Planner, CG Calendar, Client Dashboard, Client Schedule.

### AI/Assistant Role
Be personal and role-aware; prioritize current work over speculative agents.

### Empty States
Explain missing assigned work/context and show source links.

### Milestone Phases
- Phase 1: App-side context builder.
- Phase 2: Read-only assistant summaries.
- Phase 3: Confirmed action workflows.

### Done Criteria
Assistant context differs correctly by signed-in user and role.

### Regression Tests
Staff context excludes admin-only data; client context excludes internal data.

## 14. AI Workforce / Skill Cards

### Page Purpose
Future AI workforce surface for specific, grounded skills.

### Primary Users
Admin, manager later; staff where useful.

### What Belongs
- Skill cards tied to current active clients and real app data.
- Clear status of what the skill can/cannot do.
- Links to source workflows.

### What Must Not Belong
- Higher priority than Hub, My Day, Client Dashboard, Calendar, User
  Management.
- Outdated client names.
- Fake autonomous agents.

### Correct Data Sources
- Active clients.
- Current tasks/schedules/reports as needed.
- Assistant context builder outputs.

### Forbidden Data Sources
- Hardcoded stale clients.
- Speculative agent data.

### Allowed Actions
- Read-only summaries first.
- Explicitly confirmed actions later.

### Forbidden Actions
- Building speculative agents before core workflow stability.
- Secret exposure.

### Role Access
Admin/manager first; staff only if the skill supports staff work; client no
access unless explicitly client-safe.

### Connected Pages
CG Assistant, Hub, My Day, Client Dashboard.

### AI/Assistant Role
This is future workforce capability, not a substitute for core product pages.

### Empty States
Explain which data/setup is missing for a skill.

### Milestone Phases
- Phase 1: Data-grounded skill cards.
- Phase 2: Read-only skill outputs.
- Phase 3: Confirmed workflow actions.

### Done Criteria
Skill cards use active clients and current app data only.

### Regression Tests
No stale client list; no fake/demo outputs; no autonomous writes.
