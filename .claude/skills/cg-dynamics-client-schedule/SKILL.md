---
name: cg-dynamics-client-schedule
description: Use when working on monthly_deliverables, Client Schedule, the client-ready content calendar, client packages, DP/F/Video/Reel deliverables, schedule statuses, or calendar UX in CG Dynamics.
---

# CG Dynamics Client Schedule

The schedule domain. `monthly_deliverables` is the single source of truth.

## The systems

- **Client Schedule** — `src/pages/admin/ClientSchedulePage.tsx`, route
  `/admin/client-schedule`. Operational master schedule. Grid / Board /
  Calendar / Charts / Year views. This is where edits happen.
- **Client-ready content calendar** —
  `src/pages/admin/ClientContentCalendarPage.tsx`, route
  `/admin/client-calendar`. Read-only presentation layer over the same data.
  Never writes. Client-safe only.
- **Data layer** — `src/lib/planner.ts`.

## Key rules

- `monthly_deliverables` is the ONLY schedule source of truth. Do not create a
  duplicate table or a second schedule path.
- Schedule date and status are SEPARATE fields. A dated item can still be
  "Not started". Unscheduled = no `scheduled_date` AND no `due_date`, never a
  status.
- Use `getEffectiveScheduleDate()` (prefers `scheduled_date`, falls back to the
  legacy Teams `due_date` during the shadow-run). Always label it
  "Schedule date", never "Due date".
- Status normalisation: `normalizeScheduleStatus()` collapses any raw/legacy
  value into the simplified buckets; unknown → `not_started` (never hidden).
- Client-safe status: `toClientSafeStatus()` →
  Planned / In production / For review / Awaiting approval / Scheduled·Posted.
  Internal states (blocked, internal changes, review loops) must never leak to a
  client view.
- Post types shown on schedule/calendar surfaces: DP, Photo (F), Video, Reel
  (`PACKAGE_DELIVERABLE_TYPES`). Others are filtered out.
- Never guess/auto-write `client_id`. Link only on explicit user save
  (`updateMonthlyDeliverableClient`); `''` coerces to null.

## Client-safe presentation

Hide assignees, helper names, internal notes, codes, priorities and IDs. Use
the `report-*` palette. Provide a clear staff path back to Client Schedule for
editing (the calendar's "Edit in Client Schedule" link). Keep
`/admin/client-schedule` views working — do not regress them.

## Before finishing

`npm run build`, verify bundle, cross-links intact, client-safe fields
enforced. Report as usual.
