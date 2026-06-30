# Dynamics Timer Foundation

## Why it exists

Staff often forget what they worked on by end of day, leading to reconstructed (inaccurate) CG Hours logs. A lightweight in-app timer lets staff track work as it happens so CG Dynamics can later recommend clean CG Hours entries.

The timer runs inside CG Dynamics only. CG Hours remains the final locked source of truth for payroll, commission and finance.

## What it stores

Table: `dynamics_time_sessions`

| Field | Purpose |
|---|---|
| `user_id` | Which staff member |
| `source_type` | `daily_task`, `planner_task`, or `monthly_deliverable` |
| `source_id` | UUID of the linked task/deliverable |
| `client_id / client_name` | Denormalised client for quick CG Hours matching |
| `task_title / bucket_name` | Denormalised for CG Hours recommendation context |
| `status` | `running`, `paused`, or `stopped` |
| `started_at / paused_at / stopped_at` | Timestamps for accurate elapsed calculation |
| `elapsed_seconds` | Accumulated paused time so resume is correct |
| `notes` | Staff notes added when pausing or stopping |

## How it will later recommend CG Hours entries

Once the timer is active:

1. Staff starts a timer from a task card or drawer.
2. They pause/resume as needed (elapsed seconds accumulate across pauses).
3. When stopped, the session is a complete work record.
4. At end of day, CG Dynamics can display that day's sessions and propose CG Hours entries using `client_name`, `bucket_name`, and `elapsed_seconds` as the suggested duration.
5. Staff reviews suggestions in CG Hours, adjusts, and accepts.
6. CG Hours remains the final system — no silent writes.

## What this does NOT do yet

- Timer Start / Pause / Stop buttons are **disabled** placeholders in the drawers.
- No live running clock in the UI.
- No session is created or updated until migration is applied.
- No CG Hours entries are created or recommended yet.
- No floating/sticky timer widget yet.

## Migration

File: `supabase/phase-7c-dynamics-timer.sql`

**NOT applied.** Run in Supabase SQL editor when ready.

Verify after applying:
```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'dynamics_time_sessions'
order by ordinal_position;

select count(*) from public.dynamics_time_sessions;
```

## Where timer placeholders appear

- Daily Tasks drawer (`CommandCentrePage.tsx`) — below Helpers
- Planner task drawer (`PlannerPage.tsx`) — below Helpers
- Monthly deliverable drawer (`MonthlyPlannerPage.tsx`) — at the bottom of the drawer body

All three show Start / Pause / Stop buttons disabled with **"After migration"** label until the session table exists.
