# CG Dynamics Game Plan Addendum — Staff Assignment Is Launch-Critical

Last updated: 28 July 2026
Status: confirmed product decision from CA

This addendum extends `docs/current-product-game-plan.md` and must be read with it until consolidated into the canonical file.

## Problem confirmed from production UI

The current Planner task drawer treats assignment as a basic field. That is not acceptable for a staff-management product and is materially behind the Microsoft Teams / Planner workflow CG Production House currently uses.

The current experience is too limited and too "rookie" for launch because it does not make people assignment a first-class task workflow.

## Required assignment experience

Staff assignment must provide:

- a searchable people picker over real active CG Dynamics users;
- profile avatar, full name and useful role/team context;
- support for several assignees on one task where the real workflow requires it;
- fast add and remove without typing or manually editing a name string;
- immediate visibility of current assignees;
- compact avatars on task cards with an overflow count;
- clear unassigned state;
- keyboard and mobile-friendly use;
- correct permission handling;
- assignment history and audit trail;
- no invented users or stale Microsoft-only identities;
- canonical linking to CG Dynamics profile IDs rather than display-name-only storage.

## Teams-parity direction

Use the existing Teams / Microsoft Planner workflow as the minimum usability benchmark:

- select a person through a searchable picker;
- show currently assigned users as removable people entries;
- show suggestions from active staff;
- support more than one responsible person where appropriate;
- preserve the difference between primary owner and additional collaborators/helpers if CG Dynamics requires that distinction;
- make assignment possible both while creating and editing a task;
- show assignment clearly on the board and in each staff member's Work / My Day view.

Do not copy Teams visually for its own sake. Match or improve the speed, clarity and reliability of the real workflow.

## Staff-management contract

Assignments drive:

- each employee's Work and My Day views;
- overdue and blocked work;
- workload summaries;
- management visibility;
- each employee's personal AI agent context;
- the future master coordination agent;
- notifications and follow-up;
- accountability and completion history.

Therefore assignment cannot remain a cosmetic text field.

## Data and migration rules

- Inspect the current `planner_tasks` assignment fields and existing helper/collaborator patterns before changing schema.
- Reuse existing profile and assignment models where correct.
- If the current model stores only one name/string, migrate safely to canonical profile relationships.
- Preserve existing imported assignment information.
- Do not silently lose unresolved imported identities.
- Keep Microsoft read-only.
- Repeated migrations and saves must be idempotent.
- RLS must ensure users can see only permitted staff/task information and only authorised roles may reassign others where policy requires it.

## Launch acceptance criteria

The staff V1 is not launch-ready until an authorised user can:

1. Open or create a Planner task.
2. Search active CG Dynamics users by name.
3. Assign one or several users quickly.
4. Remove an assignee without editing raw text.
5. Save and reopen the task with the same canonical assignments.
6. See assignee avatars/names on the board card.
7. See the task in every assigned user's Work / My Day view.
8. Filter and report workload accurately by assignee.
9. Use the same workflow on desktop and mobile.
10. Confirm assignment changes are audited.

This is a launch blocker and belongs before advanced AI expansion.