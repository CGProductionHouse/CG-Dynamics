# CG Dynamics Master Milestone Tracker

Living tracker for cross-area CG Dynamics milestones, product notes and future fixes that should not be lost while work is focused elsewhere.

Last updated: 2026-07-02

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
