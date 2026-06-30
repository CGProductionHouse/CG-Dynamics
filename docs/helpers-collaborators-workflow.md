# Helpers / Collaborators Workflow

## Concept

Every task, planner task, and monthly deliverable has a **main assignee** and optional **helpers**.

- **Main** (`assigned_to_name`): the primary responsible person. Set at creation or by admin. Never removed by adding a helper.
- **Helpers** (`helper_names[]`): additional staff who are assisting. Self-service — a staff member adds themselves without changing the main assignee.

Example: Franco is the main assignee on a poster task. Sydney adds herself as a helper. Both are visible and responsible. Franco is not removed.

## What phase-7b migration adds

File: `supabase/phase-7b-helper-names.sql`

Adds `helper_names text[] not null default '{}'` to:
- `command_centre_tasks`
- `planner_tasks`
- `monthly_deliverables`

Migration is **idempotent** — safe to run multiple times. Uses `IF NOT EXISTS` checks.

## What is NOT active until migration is applied

The drawer UI shows **"After migration phase-7b"** in the Helpers section until the column exists in the database.

Once migration runs and `helper_names` is returned by Supabase queries:
- Helpers section shows chips (one per name)
- "No helpers yet" if the array is empty
- Add/remove helper functionality can be wired in

## Ready-to-use helper functions

These functions exist in the lib files and are ready to call once the migration is applied. Do not wire them into active save paths until migration is confirmed.

**commandCentre.ts**
- `addTaskHelperName(id, currentHelpers, name)` — appends a name, no duplicates
- `removeTaskHelperName(id, currentHelpers, name)` — removes by name

**planner.ts**
- `addPlannerHelperName(id, currentHelpers, name)` — for `planner_tasks`
- `removePlannerHelperName(id, currentHelpers, name)`
- `addDeliverableHelperName(id, currentHelpers, name)` — for `monthly_deliverables`
- `removeDeliverableHelperName(id, currentHelpers, name)`

## Future UI behaviour (post-migration)

Once active:
1. Drawer shows **Main**: `assigned_to_name` chip (read-only for staff, editable for admin)
2. Drawer shows **Helpers**: chips for each name in `helper_names[]`
3. Logged-in staff member sees **"Add me as helper"** button if not already in the list
4. Admin sees **Remove** button on each helper chip
5. Save uses `addTaskHelperName` / `removeTaskHelperName` helpers above

## Where Helpers section appears

- Daily Tasks drawer (`CommandCentrePage.tsx`) — between Notes and Package action
- Planner task drawer (`PlannerPage.tsx`) — below Notes
- Monthly deliverable drawer (`MonthlyPlannerPage.tsx`) — between meta fields and Scheduled date
