# Future roadmap: Smart Daily Planner and Personal Staff Assistant

This is a future/luxury roadmap item. Do not implement this until the core CG Dynamics app is stable, useful and trusted.

The purpose of this document is to preserve the long-term vision so it can be built later without distracting from the current milestone work.

## Status

FUTURE

This is not part of the current build pass.

## Core idea

Daily Tasks must eventually become each staff member's smart daily planner.

The app should not only show a flat task list. It should help each person understand what their day should look like, what they should start with, what meetings or content runs affect their time, and how long each task should reasonably take.

This will make CG Dynamics feel like a personal work assistant for every staff member.

## Current workflow this builds on

Amonique often sends WhatsApp messages like:

- Franco, do these tasks today.
- Sydney, please focus on these videos.
- Ger-Marie, these are the posters/designs for today.
- KG, these client posters/photos are yours.

Those messages are not just task creation. They are daily prioritisation.

The app must eventually understand that a WhatsApp morning list is a daily plan signal.

## Relationship to other modules

This future planner should connect to:

- Daily Tasks
- WhatsApp task import
- Client Schedule / monthly_deliverables
- CG Calendar / company_calendar_events
- existing planner_tasks
- command_centre_tasks
- CG Hours, later
- CG Assistant, later

It should not duplicate work.

It should link existing work into a daily plan.

## Daily Planner views

Daily Tasks should eventually have at least two staff-facing views:

### 1. Task list view

A clean list of what the staff member must do today.

This includes:

- tasks assigned directly to them
- WhatsApp-imported daily assignments
- linked package schedule items
- linked existing planner tasks
- linked client requests
- urgent items
- overdue items that still need action

### 2. Day calendar view

A time-based day view, similar to a daily calendar.

Example layout:

- 08:00 to 09:00
- 09:00 to 10:00
- 10:00 to 12:00
- 12:00 to 13:00
- 13:00 to 15:00
- 15:00 to 17:00

This view should pull in:

- CG Calendar events
- meetings
- content runs
- shoots
- internal deadlines
- package tasks assigned for the day
- daily tasks from WhatsApp
- existing linked tasks that Amonique prioritised

## Smart scheduling behaviour

The app should suggest a daily schedule.

Example:

If Franco has a content run from 10:00 to 12:00, the app should block that time.

If travel is likely needed, the app should suggest travel time.

Example:

- 09:30 to 10:00: Travel to client for content run
- 10:00 to 12:00: Content run
- 12:00 to 12:30: Travel back / admin notes

If he also has a video edit assigned, the app should suggest where it fits.

Example:

- 08:00 to 09:30: Red Oak Video 1 edit
- 13:00 to 14:30: Madison BTS edit
- 14:30 to 15:00: Send Red Oak menu update

## Priority logic

The suggested day should respect:

- Amonique's WhatsApp list order
- urgent wording
- due today items
- overdue items
- client requests
- package schedule deadlines
- CG Calendar events
- company policy about task urgency
- staff role and usual task type

Amonique's message order usually matters. The first items are often the most important.

## Suggested time durations

The app should suggest expected task durations based on CG Production House internal standards.

Examples:

- simple poster
- template poster
- normal social video
- reel edit
- client changes
- content guide
- website update
- photo sorting
- content run
- travel time

These suggested durations must later connect to CG Hours recommendations and time tracking.

When this is implemented, use the CG Production House time policy / suggested hours document as the source of truth.

## Staff editing and learning

The staff member must be able to adjust the suggested day.

Examples:

- task took 20 minutes instead of 1 hour
- task took 50 minutes instead of 30 minutes
- client called and interrupted for 20 minutes
- content run took longer
- meeting was cancelled

When a staff member edits their day, the app should learn from it over time.

The goal is not to police staff. The goal is to make the assistant smarter and make planning more realistic.

## Interruption capture

If someone is supposed to be done with a task but they are not, the app can eventually ask:

- Are you still busy with this?
- Did something come up?
- Do you want to add the interruption?

Example:

A client called Franco for 20 minutes.

The app should suggest:

- Add client call
- Link to client
- Category: admin / client communication
- Duration: 20 minutes
- Add to CG Hours later

## Link to CG Hours

This is future work.

CG Hours remains the source of truth for time, payroll, commission and finance.

CG Dynamics may eventually recommend or prepare time entries, but it must not directly change payroll/finance data without a proper CG Hours integration plan.

Future flow:

1. Staff plans day in CG Dynamics.
2. Staff updates actual time or task completion.
3. CG Dynamics compares planned vs actual.
4. CG Dynamics suggests time entries or summaries.
5. CG Hours remains the official time/finance system.

## AI Assistant learning

This is part of the larger CG Assistant vision.

The assistant should learn from:

- how Amonique writes WhatsApp task lists
- which tasks get linked to package schedule items
- which tasks become new daily tasks
- which tasks are assigned to which staff
- how staff plan and edit their day
- how long tasks actually take
- what types of work get interrupted
- what clients often request
- what gets prioritised at CG

The assistant should eventually help manage the business by making informed suggestions, not by guessing blindly.

## Desired future staff experience

Franco opens CG Dynamics and sees:

- what he needs to do today
- what order to do it in
- when his content runs or meetings are
- when to travel
- how long tasks should take
- what is linked to the client schedule
- what is urgent
- what is waiting for review
- what he needs to update before end of day

The app should feel like it has his back.

## Example future day view

Franco Today

- 08:00 to 09:30: Red Oak Video 1 edit
  - linked to Client Schedule
  - suggested duration: 1.5 hours

- 09:30 to 10:00: Travel to content run
  - linked to CG Calendar

- 10:00 to 12:00: Content run: The Staffy
  - linked to CG Calendar

- 12:00 to 12:30: Travel / notes

- 13:00 to 14:00: Red Oak menu changes
  - linked to existing planner task

- 14:00 to 15:30: Madison BTS video
  - linked to WhatsApp daily assignment

- 15:30 to 16:00: Client call follow-up
  - added from interruption

- 16:00 to 17:00: Review and upload ready work

## Implementation phases later

### Phase A: Daily Assignment Layer

Create a daily assignment concept that links a staff member and a date to an existing work item.

A daily assignment can point to:

- monthly_deliverables
- planner_tasks
- command_centre_tasks
- company_calendar_events

This avoids duplicate work.

### Phase B: WhatsApp import linking

When WhatsApp import finds a task, it should suggest:

- link to package item
- link to existing planner/native task
- create new task
- create CG Calendar event
- needs review

### Phase C: Staff My Day task list

Build a staff-facing Today view that shows linked daily assignments.

### Phase D: Time-based day view

Build the actual day calendar layout with time blocks.

### Phase E: Smart suggestions

Use rules first:

- list order
- urgency
- due date
- schedule date
- CG Calendar events
- task type duration

Only add AI once the rule-based version is reliable.

### Phase F: CG Hours recommendation bridge

Prepare time summaries and suggested time entries for CG Hours.

### Phase G: Personal staff assistant

Allow the assistant to learn from staff behaviour and suggest better daily plans over time.

## Hard rules

- Do not duplicate tasks when linking is possible.
- Daily planning must link to the real work item.
- Client Schedule remains protected.
- Staff can update production status, but they should not accidentally alter the protected schedule.
- CG Calendar events must block time in day view.
- AI suggestions must be reviewable and explainable.
- CG Hours remains the source of truth for official time and finance.
