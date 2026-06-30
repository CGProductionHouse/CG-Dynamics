# CG Dynamics product goals

This document is the product north star for CG Dynamics. It captures the bigger app goal so interface feedback, small fixes and coding-agent prompts do not drift away from the actual vision.

## Main goal

CG Dynamics must become the central operating system for CG Production House.

It must replace Microsoft Teams/Planner for day-to-day work management, while also keeping the client performance/reporting side of CG Dynamics clean and separate.

The app must help staff know what to do, help Amonique/CA manage work and client packages, and help the business clearly track what was planned, requested, moved, completed, quoted and reported.

The app must not become another noisy admin system. It should make work easier, quicker and clearer.

## Product zones

CG Dynamics has two major zones.

### 1. CG Hub

CG Hub is the internal staff workflow zone.

It is for:

- daily staff tasks
- staff focus lists
- client requests
- monthly content work
- planner boards
- package work visibility
- OneDrive links
- CG Assistant workflow support
- future timer support

CG Hub should feel like opening the team work app for the day.

### 2. Performance

Performance is the client reporting and business intelligence zone.

It is for:

- client performance dashboards
- reports
- Meta data
- client preview
- insights
- import and data tools
- client-facing performance review

Performance should not be mixed with staff task noise.

### Shared Clients

The same Clients page must be available from both zones.

Clients is shared because clients are central to both operations and reporting.

## What the app must replace

CG Dynamics must replace the practical Teams/Planner workflow.

The replacement must include:

- boards
- buckets
- daily tasks
- staff tasks
- client schedule work
- monthly content planning
- status tracking
- client requests
- package tracking
- task details hidden until clicked
- quick add task
- progress visibility
- staff collaboration

It must be simpler than Teams, not more complicated.

## What stays outside the app for now

WhatsApp remains the main communication channel for clients and staff.

CG Dynamics should structure the work that comes from WhatsApp, but it does not need a full WhatsApp API yet.

CG Hours remains the source of truth for time, payroll, commission and finance. CG Dynamics may prepare for future CG Hours recommendations, but deep CG Hours integration must wait until the main Dynamics workflow is stable.

## Visual and UX principles

The benchmark is the existing client report view.

The app should feel:

- black
- premium
- cinematic
- bold
- clean
- calm
- readable
- simple
- production-focused

Colour rules:

- near-black and warm-black backgrounds
- charcoal panels with subtle gradients
- white and off-white headings
- readable grey muted text
- teal as a tasteful live/secondary accent
- copper/amber only as a small premium accent
- no large orange UI blocks
- no noisy helper paragraphs

UX rules:

- quick action first
- details hidden until clicked
- one clear purpose per page
- no giant forms visible by default
- no long explanatory copy
- no repeated helper text
- no extra panels that repeat the same function
- task details in drawers or modals
- staff should instantly understand what to do next

## Core app modules

### 1. CG Hub dashboard

CG Hub should be the staff launchpad.

It should show:

- Planner
- Daily Tasks
- Clients
- Assistant
- OneDrive panel
- CG Hours external link

The OneDrive panel must include:

- CG OneDrive
- Client OneDrive
- Once-Off OneDrive

External links must be obvious, not tiny arrows only.

### 2. Daily Tasks

Daily Tasks is the staff starting point.

It must show the current staff member what to do today.

Required behaviour:

- default to My Tasks when possible
- staff can still view All Tasks if allowed
- client requests appear near the top
- urgent work appears near the top
- overdue work appears near the top
- due today work appears near the top
- in-progress work stays visible
- done work is quiet or collapsed
- quick add is simple
- details are hidden in a drawer

Quick add should only need:

- task title
- add/save

Details drawer should handle:

- client
- manual client name if needed
- primary assignee
- helpers/collaborators
- bucket/group
- priority
- due date
- notes
- status
- package link if relevant
- timer later

Client requests are just tasks.

There should not be a duplicated WhatsApp/client request form that does the same thing as Add Task.

WhatsApp/client message text belongs in Notes.

### 3. Planner board

Planner must feel close to Teams Planner, but cleaner.

It must have:

- simple board tabs
- clear columns/buckets
- compact task cards
- quick add per column
- task details drawer
- status and priority chips
- import button kept quiet
- Admin/private boards last or on the outskirts

Planner is for broader boards and buckets.

Daily Tasks is for the immediate staff work list.

### 4. Monthly Planner

Monthly Planner is the main staff-facing content production summary.

Staff should mainly work from the current month.

It must show:

- monthly content deliverables
- client name
- content type
- package/source chip
- status
- current progress
- outstanding work
- in-progress work
- ready for review
- awaiting client approval
- Meta Drafts
- Scheduled / Posted

Content type codes:

- DP - Designed Poster
- F - Photo
- Video
- Reel

Monthly Planner must be linked to the master schedule.

Staff must not need to stare at the whole year to do daily work.

### 5. Master schedule / Client Schedule Board

The master schedule is still a main missing goal.

It must become the full-year content calendar/backbone.

It should show:

- all clients
- all months
- planned package content
- moved content
- client-requested content
- scheduled/posted work
- overall yearly planning

Staff may be able to view the master schedule, but final scheduling controls must remain admin-only.

Only CA/Amonique should control:

- Meta Drafts
- Scheduled / Posted
- final schedule dates
- package/master schedule structure
- final monthly generation or schedule-level admin actions

The calendar/master schedule is a core app requirement and must not be forgotten.

### 6. Client packages

Client packages must be quantity-based and easy to manage.

Core package quantities:

- DP
- F
- Video
- Reel

Package Master must let admin:

- select client
- create package
- edit monthly quantities
- see included package items
- archive packages
- generate monthly deliverables

The point is to know what a client is paying for and what work is included.

### 7. Client requests and package usage

This is a core business workflow.

Clients often request extra work or move planned work around.

When a client request comes in, Amonique/CA must be able to classify it as:

1. Use package slot
   - example: client requests a public holiday poster and it uses one DP from the package

2. Add-on / extra
   - example: package includes 4 DPs, client requests 2 extra DPs, app flags quote needed

3. Move package work
   - example: client uses 2 DPs this month and moves 2 DPs to next month

The app must clearly show:

- planned package work
- client-requested package work
- add-ons/extras
- moved/deferred package work
- quote-needed extras
- package usage totals by client and month
- over-package requests

This solves the problem of clients getting unlimited additional work without it being tracked or quoted.

### 8. Clients page

Clients must be a control centre, not just a list.

The client page should connect:

- client details
- package settings
- package quantities
- Monthly Planner
- performance reports
- Meta/sync status
- client preview
- OneDrive/client assets later

The same page must be accessible from CG Hub and Performance.

### 9. OneDrive and content guideline integration

OneDrive is important to the production workflow.

Future work must link content planning with:

- correct OneDrive folder naming
- video/reel content locations
- what was shot
- what was not shot
- what can be shot next time
- what is ready to edit
- temporary/external editor allocation

This should come after the main planner/package workflow is stable, but it is part of the bigger app vision.

### 10. CG Assistant

CG Assistant should help without adding noise.

Good future uses:

- turn Amonique voice-note text into tasks
- create morning task suggestions
- summarise end-of-day progress
- help write client updates
- check what is still outstanding
- suggest next actions from tasks/planner/client requests
- later help with content guideline and OneDrive naming checks

CG Assistant must not flood the UI with long paragraphs.

### 11. Staff collaboration

Tasks need a primary assignee and helpers.

Example:

- Franco remains primary assignee
- Sydney adds herself as helper
- Franco is not removed
- both are visible as responsible for the output

This applies to:

- Daily Tasks
- Planner tasks
- Monthly deliverables

### 12. Status permissions

Staff can update normal production statuses:

- Not started
- In progress
- Ready for review
- Awaiting client approval

Only CA/Amonique/admin can update final scheduling statuses:

- Meta Drafts
- Scheduled / Posted

Reason:

Staff must track their own work so Amonique can see progress without manually chasing everyone.

### 13. CG Hours future bridge

CG Hours is the locked truth app.

CG Dynamics must not break or directly rewrite CG Hours.

CG Dynamics should eventually help create CG Hours recommendations from actual work done in Dynamics.

Future behaviour:

- staff starts a timer from a Dynamics task
- staff pauses/stops timer
- Dynamics captures task/client/bucket/context
- Dynamics suggests a CG Hours entry
- staff reviews and fills/adjusts time
- staff accepts
- CG Hours remains the final source of truth

CG Dynamics must align naming with CG Hours:

- client names
- task groups
- buckets
- task templates
- users

Do not deeply integrate CG Hours until the main Dynamics planner, calendar, package and request workflow works.

### 14. Data import

Teams/Planner Excel data must be imported safely.

Known priority:

- regenerate planner import preview SQL/JSON locally
- review matched clients and bucket names
- confirm no raw Planner IDs are being used as bucket/client names
- run reviewed SQL in Supabase
- verify counts
- verify boards/tasks/monthly deliverables/package templates

Do not blindly run production import SQL without review.

### 15. Setup and migrations

Prepared features that depend on SQL must stay clearly marked until migrations are applied.

Current pending concepts include:

- staff status RLS
- client request package links
- helpers/collaborators
- timer foundation

The UI can prepare placeholders, but it must not pretend features are live if SQL was not applied.

## Priority order from here

### Phase 1 - Stabilise current live app

- finish Setup Checklist page
- apply pending Supabase migrations in the correct order
- verify staff status saves
- verify package action fields exist
- verify helpers fields exist
- verify timer table exists if timer foundation is applied
- test from phone and desktop

### Phase 2 - Import real Teams data

- regenerate import preview files locally
- review SQL/JSON
- run import in Supabase after review
- verify all Teams boards/tasks are visible
- verify client schedule/monthly package data
- verify admin-sensitive boards stay protected

### Phase 3 - Build calendar/master schedule

- build full-year Client Schedule Board / master calendar
- link Monthly Planner directly to the master schedule
- show month summary from master schedule data
- keep final scheduling controls admin-only
- make monthly view staff-friendly

### Phase 4 - Build package request workflow

- make Package Action buttons actually save
- link client requests to package slots
- mark add-ons/extras
- flag quote needed
- move package work between months
- show usage totals per client/month
- show over-package work clearly

### Phase 5 - Make staff workflow excellent

- refine Daily Tasks priority stack
- make task drawers excellent
- activate helpers/collaborators after migration
- activate timer after migration
- improve mobile workflow
- reduce any remaining noise

### Phase 6 - Performance/reporting side

- keep Performance separate from staff work
- improve client reports
- improve Meta/import workflows
- connect package delivery history to client reporting where relevant

### Phase 7 - Assistant and future integrations

- make CG Assistant more active using real app data
- add voice-note-to-task workflows
- add OneDrive/content guideline checks
- build CG Hours recommendations only after core workflow is stable

## What must not distract us

Do not let small UI feedback change the main goal.

Button/layout feedback is polish.

The main goal remains:

- replace Teams/Planner
- manage daily staff work
- manage monthly content production
- manage the master content calendar
- track client packages and extras
- connect work to clients, OneDrive and reporting
- later suggest accurate CG Hours entries without touching payroll/finance directly

CG Hours prep is only future alignment. It is not the main build priority until the core CG Dynamics workflow is actually working.
