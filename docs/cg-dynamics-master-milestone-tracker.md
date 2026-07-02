# CG Dynamics Master Milestone Tracker

Living tracker for cross-area CG Dynamics milestones, product notes and future fixes that should not be lost while work is focused elsewhere.

Last updated: 2026-07-02

## Full-System Push Notes

### Fable 5 improvement pass

- Next larger agent prompt should not be a narrow bug-fix prompt only.
- Give the agent the main CG Dynamics goals and enough freedom to improve the full app toward daily operational usefulness.
- Required source of truth: repo docs, this milestone tracker, current codebase, active branches/PRs, Supabase schema/migrations and recent Meta integration work.
- The agent should have access to the milestone tracker and use it before proposing or changing Hub/Calendar/Task workflows.
- The agent should use available Microsoft connectors where possible to inspect/sync Teams, Planner and calendar structures, because the goal is for CG Dynamics to replace Teams workflows rather than duplicate them manually.
- Main goal: make the app actually work better for CG Production House daily operations, with less friction, clearer navigation and useful workflows.
- Allow the agent to improve more than one small file when the changes are coherent and move the app over the line.
- Still require guardrails: run git status first, pull latest main, do not commit untracked local scratch files, build before committing, and keep secrets out of code.

## Hub / Task Manager Milestones

### Staff assignment

- Support assigning multiple staff members to one task.
- A task should not be limited to one assigned person.
- UI should make it clear who is responsible, who is assisting, and who needs to act next.
- Future implementation should consider notifications, filters and workload views for multi-assignee tasks.

### Recurring tasks

- Current recurring task behaviour is not truly recurring.
- Fix recurring tasks so they generate or surface the next occurrence properly.
- Recurring logic should support real operational use cases, not just a label/state.
- Recurrence should preserve history of completed occurrences while creating/updating future occurrences safely.
- Avoid duplicate or runaway task creation.

### Calendar and schedule workflow

- The CG Calendar is still not fixed and should be treated as a core Hub/Teams replacement milestone, not visual polish.
- Calendar must integrate properly with tasks so campaign work, posting schedules, shoots, meetings, client events and deadlines can be planned from the same operational workflow.
- The calendar should support real posting schedules like the current Teams/Planner setup, where calendar dates and task buckets work together.
- Tasks should be able to appear on the calendar with correct dates, clients, buckets, assignees, status and recurrence.
- Recurring tasks and recurring schedule items must behave properly across both Planner Board and Calendar views.
- Calendar should eventually support Microsoft Teams / Planner / calendar connector import or linking so existing schedules can be reconciled instead of manually rebuilt.
- Future workflow should move toward: Teams/Planner data -> connector/import preview -> mapped tasks/calendar events/buckets/recurrence -> approved sync into CG Dynamics.
- Avoid making the calendar a separate dead page. It must become part of the daily Hub workflow and make the app easier than Teams.

### Teams import and connector workflow

- Add an easier way to link or import the latest Microsoft Teams / Planner task data.
- Explore connector-based access instead of manual exports where possible.
- Teams data should be used to improve accuracy when migrating or reconciling Hub tasks.
- Import rules must understand recurring tasks and not flatten them incorrectly.
- Import/reconciliation should preview changes before applying them.
- Preserve existing CG Dynamics work where possible and flag conflicts instead of blindly overwriting.
- Useful future flow: latest Teams data -> preview mapped tasks/buckets/recurrence/staff assignments -> approve import -> update Hub.

### Small Hub UI polish

- Tighten the Hub sidebar/menu spacing so the full menu fits more comfortably without the ugly internal scrollbar.
- Keep the menu readable and touch-friendly, but reduce excess vertical gaps, row heights, and section spacing where possible.
- Review the Hub/Performance sidebar split so navigation feels consistent and less cramped.

## Notes

- These are parked milestones, not current implementation tasks.
- Do not mix these into Client Intelligence / Meta sync work unless explicitly planned.
- When Hub work resumes, review this tracker before writing prompts or implementation plans.
