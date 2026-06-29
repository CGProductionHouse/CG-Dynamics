# CG Dynamics — Planner Replacement Architecture

> Replace Microsoft Teams Planner with a purpose-built CG Dynamics module that beats Planner at its own game for CG Production House.

---

## 1. What Current Planner Does Well

- **Zero-friction capture** — anyone adds a card in seconds, no form, no required fields
- **Bucket (tab) navigation** — visual grouping by category; clicking a tab filters instantly
- **Checklist inside cards** — sub-items within a task without creating separate rows
- **Drag-and-drop status** — move a card across columns; feels fast and tactile
- **Assignment by name** — pick a person from a dropdown; the task appears on their "My Tasks" view
- **Due-date sorting** — Planner surfaces overdue/upcoming naturally
- **Everyone can see everything** (except Admin Check List) — no permission confusion
- **Excel export** — one click, full flat dump, easy to share with clients who don't have Teams

---

## 2. What CG Dynamics Currently Gets Wrong

| Problem | Detail |
|---|---|
| **Flat task table** | `command_centre_tasks` has no concept of packages, deliverables, monthly recurrence, or client schedules |
| **No client package model** | A client's "4DP + 4F + 2 Video + 4 Reel" monthly package cannot be represented |
| **Status lifecycle too short** | `to_do → in_progress → done` skips internal review, client approval, scheduled, and posted stages |
| **No monthly generation** | Every month's deliverables must be created as separate rows; no "generate July's DP1" |
| **No calendar** | Staff have no view of what is scheduled to post on which date |
| **No approval workflow** | Staff and CA/Amonique share the same status set; no separation of concerns |
| **Admin board not hidden** | RLS exists but the same UI shows everything; no dedicated admin-only section |
| **No client context** | A task's `client_name` is a text field; no link to client package, deliverables, or monthly totals |
| **Morning import is disconnected** | It creates tasks but doesn't know about packages or monthly quotas |
| **No scheduled/posted tracking** | Once a post is done it vanishes; no record of what went live and when |
| **CG Socials missing** | CG's own content (studio, internal posts) has no home |

---

## 3. Correct CG Dynamics Module Structure

```
CG Dynamics Planner
├── Dashboard (existing Daily Dashboard enhanced)
│   ├── My tasks (today/overdue)
│   ├── Package completions this month
│   ├── Pending approvals count
│   └── Quick add → task / client request
│
├── Planner (replaces Teams Planner entirely)
│   ├── Active tasks        (flat view, all statuses)
│   ├── Client schedules    (calendar / package view)
│   ├── Monthly packages    (per-client deliverable grid)
│   ├── Admin board         (hidden from non-admin)
│   └── CG Socials          (CG's own content)
│
├── Calendar
│   ├── Public CG calendar
│   ├── Staff-specific calendars
│   └── Client package calendar
│
├── Morning import (existing, enhanced)
│   └── Import → assign to package + month
│
└── CG Assistant (existing, enhanced later)
    └── Suggest assignments based on staff role + workload
```

---

## 4. Recommended Database Tables

### `client_packages`
One row per client's active package.

```sql
create table client_packages (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  name        text not null,            -- e.g. "Standard Monthly", "Premium Monthly"
  active      boolean not null default true,
  start_date  date not null,
  end_date    date,                      -- null = ongoing; set to archive future generation
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
```

### `package_deliverable_types`
Defines what a package produces each month. E.g. "DP (designed poster)", "F (photo)", "Video", "Reel".

```sql
create table package_deliverable_types (
  id              uuid primary key default gen_random_uuid(),
  package_id      uuid not null references client_packages(id) on delete cascade,
  code            text not null,         -- e.g. "DP", "F", "Video", "Reel"
  label           text not null,         -- e.g. "Designed Poster", "Photo"
  count_per_month integer not null,      -- e.g. 4
  sort_order      integer not null default 0,
  unique (package_id, code)
);
```

### `monthly_deliverables`
Each month's instance of a deliverable type. **This is the core table.**

```sql
create table monthly_deliverables (
  id                  uuid primary key default gen_random_uuid(),
  package_id          uuid not null references client_packages(id) on delete cascade,
  client_id           uuid not null references clients(id) on delete cascade,
  deliverable_type_id uuid not null references package_deliverable_types(id) on delete cascade,
  code                text not null,         -- denormalised: "DP", "F", etc.
  instance_number     integer not null,      -- e.g. 1, 2, 3, 4
  month               date not null,         -- first day of month, e.g. 2026-07-01
  status              text not null default 'to_do'
                      check (status in (
                        'to_do',
                        'in_progress',
                        'ready_for_internal_review',
                        'internal_changes',
                        'ready_for_client_approval',
                        'waiting_client',
                        'client_changes',
                        'approved',
                        'scheduled',
                        'posted',
                        'blocked',
                        'moved'
                      )),
  due_date            date,                  -- when this deliverable should be ready
  scheduled_date      date,                  -- when it is scheduled to post (only CA/Amonique sets this)
  posted_at           timestamptz,           -- when it actually went live
  assigned_to_user_id uuid references profiles(id) on delete set null,
  assigned_to_name    text,
  title               text,                  -- optional override / specific post title
  notes               text,
  parent_request_id   uuid references client_requests(id) on delete set null,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique (package_id, deliverable_type_id, instance_number, month)
);
```

### `command_centre_tasks` (extended)
Keep the existing table but add `deliverable_id` FK so ad-hoc tasks / client requests can link to a deliverable.

```sql
alter table command_centre_tasks
  add column deliverable_id uuid references monthly_deliverables(id) on delete set null;
```

### `admin_board_tasks`
Separate table for admin-only tasks (payroll, checking, financial). Never visible to non-admin staff.

```sql
create table admin_board_tasks (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  category          text not null check (category in ('daily','weekly','monthly','payroll','checking','other')),
  assigned_to_id    uuid references profiles(id) on delete set null,
  assigned_to_name  text,
  status            text not null default 'to_do'
                    check (status in ('to_do','in_progress','done','blocked')),
  due_date          date,
  recurring         text check (recurring in (null, 'daily', 'weekly', 'monthly')),
  notes             text,
  created_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
```

### `cg_socials_tasks`
CG's own content schedule (studio posts, internal content, CG brand content).

```sql
create table cg_socials_tasks (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  platform          text not null check (platform in ('facebook','instagram','tiktok','linkedin','other')),
  content_type      text not null check (content_type in ('post','reel','story','video','photo','other')),
  status            text not null default 'to_do'
                    check (status in (
                      'to_do','in_progress','ready_for_internal_review',
                      'approved','scheduled','posted','blocked','moved'
                    )),
  scheduled_date    date,
  posted_at         timestamptz,
  assigned_to_id    uuid references profiles(id) on delete set null,
  assigned_to_name  text,
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
```

### `deliverable_comments`
Threaded comments on deliverables (replaces Planner checklist comments).

```sql
create table deliverable_comments (
  id              uuid primary key default gen_random_uuid(),
  deliverable_id  uuid not null references monthly_deliverables(id) on delete cascade,
  author_id       uuid not null references profiles(id) on delete cascade,
  body            text not null,
  created_at      timestamptz default now()
);
```

---

## 5. Permission Model

| Role | Planner Access | Admin Board | Calendar | Assignments | Status Changes | Package Changes |
|---|---|---|---|---|---|---|
| **CA** (admin) | Full CRUD | Full | Full | Full | Full | Full |
| **Amonique** (admin) | Full CRUD | Full | Full | Full | Full | Full |
| **KG** (team) | Read + own tasks | Hidden | View | None | Mark in_progress → ready_for_internal_review | Hidden |
| **Ger-Marie** (team) | Read + own tasks | Hidden | View | None | Mark in_progress → ready_for_internal_review | Hidden |
| **Sydney** (team) | Read + own tasks | Hidden | View | None | Mark in_progress → ready_for_internal_review | Hidden |
| **Franco** (team) | Read + own tasks | Hidden | View | None | Mark in_progress → ready_for_internal_review | Hidden |
| **Clients** | No access | No access | No access | No access | No access | No access |

### RLS Rules
- `admin_board_tasks`: `is_admin()` only
- `monthly_deliverables`: staff can read all, update only own assigned rows
- `command_centre_tasks`: existing RLS stays (staff read, admin update any, team update own)
- `client_packages` / `package_deliverable_types`: admin only
- Staff cannot set `scheduled_date` or `status` to `scheduled` / `posted` / `approved`
- CA/Amonique can change any status, any date, any assignment

---

## 6. Package Model

A **package** is what a client pays for each month. Examples:

| Package | Deliverables per Month |
|---|---|
| Standard Monthly | 4 DP, 4 F, 2 Video, 4 Reel |
| Premium Monthly | 8 DP, 8 F, 4 Video, 8 Reel |
| Website Only | 1 Website Update |
| Content Only | 2 Content Runs |

- Packages have a `start_date` and optional `end_date`
- An `end_date` in the past means the package is stopped (history preserved, future generation paused)
- Changing a package (e.g. 4 DP → 8 DP) applies to **future months only**; past months are immutable
- A client can have multiple packages (e.g. Standard Monthly + Website Only)

---

## 7. Monthly Deliverable Generation Model

### Generation Trigger
When a new package is created, or at the start of each month, a background process (Supabase pg_cron or a daily edge function) generates rows in `monthly_deliverables` for the upcoming month.

### How it works
1. `client_packages.active = true` and (`end_date IS NULL` or `end_date >= next_month`)
2. For each `package_deliverable_types` row, generate `count_per_month` rows in `monthly_deliverables`
3. `instance_number` = 1..count_per_month
4. `month` = first day of the month
5. `status` = `to_do`

### Example
Package "Standard Monthly" for Client "Cape Grace":
- 4 DP → rows: (DP-1, Jul), (DP-2, Jul), (DP-3, Jul), (DP-4, Jul)
- 4 F → rows: (F-1, Jul), (F-2, Jul), (F-3, Jul), (F-4, Jul)
- 2 Video → rows: (Video-1, Jul), (Video-2, Jul)
- 4 Reel → rows: (Reel-1, Jul), (Reel-2, Jul), (Reel-3, Jul), (Reel-4, Jul)

### Archive (Stopping)
- Set `client_packages.end_date = last_month_date`
- Past deliverables remain; no new rows generated
- Existing in-flight deliverables can still be completed

### Package Change (Downgrade/Upgrade)
- End current package (set end_date)
- Create new package with start_date = next month
- Old deliverables in current month stay; new package generates from next month

---

## 8. Calendar Model

### Three calendar layers
1. **Public CG Calendar** — all staff see all scheduled posts across all clients
2. **Staff Calendar** — filter to show only tasks assigned to a specific staff member
3. **Client Package Calendar** — show only scheduled deliverables for a specific client

### Data source
- `monthly_deliverables.scheduled_date` is the canonical posting date
- Only CA/Amonique can set `scheduled_date`
- Staff can view the calendar but not drag-and-drop dates
- Calendar cells show: deliverable code + instance_number (e.g. "DP-3") + client abbreviation

### UI approach
- Month grid view (like Google Calendar month view)
- Click a cell to see the deliverable detail card
- No drag-to-reschedule for non-admin users

---

## 9. Approval / Status Workflow

### Full lifecycle
```
to_do
  │
  ▼
in_progress
  │  (staff marks ready)
  ▼
ready_for_internal_review
  │  (CA/Amonique reviews → approves or requests changes)
  ├──► internal_changes ──► in_progress  (loop back)
  │
  ▼
ready_for_client_approval
  │  (CA/Amonique sends to client via WhatsApp)
  ├──► waiting_client
  │     │  (client responds)
  │     ├──► client_changes ──► in_progress
  │     └──► approved
  │
  ▼
approved
  │  (CA/Amonique schedules)
  ▼
scheduled
  │  (post goes live)
  ▼
posted  ◄── Final state
```

### Who can do what

| Status | Staff | CA/Amonique |
|---|---|---|
| to_do | ✓ | ✓ |
| in_progress | ✓ | ✓ |
| ready_for_internal_review | ✓ | ✓ |
| internal_changes | ✗ | ✓ |
| ready_for_client_approval | ✗ | ✓ |
| waiting_client | ✓ (view) | ✓ |
| client_changes | ✗ | ✓ |
| approved | ✗ | ✓ |
| scheduled | ✗ | ✓ |
| posted | ✗ | ✓ |
| blocked | ✓ | ✓ |
| moved | ✓ | ✓ |

### Edge case: moving a deliverable
- "Moved" status + `notes` field specifying the new month
- Original row stays with `status = 'moved'` and `notes = 'Moved to August'`
- A new row is generated in the target month with cross-reference notes
- This ensures July's DP1 moved to August does not affect July's counts

---

## 10. Client Request Rescheduling Model

### How client requests interact with packages

1. A client sends a WhatsApp request (e.g. "Can we do an extra Reel this month?")
2. Staff captures via "Capture Request" in Command Centre
3. The request creates a `command_centre_tasks` row with `priority = 'client_request'`
4. **Rescheduling logic:**
   - If the request replaces a planned deliverable: link to the `monthly_deliverables` row via `deliverable_id`, set that deliverable to `moved`
   - If the request is extra/over-and-above package: create as ad-hoc `command_centre_tasks` with `deliverable_id = null`
   - If the request pushes a deliverable to next month: set original to `moved`, add note "Replaced by client request [request_id]"

### Display
- Client requests appear in both the Planner (as tasks) and linked to the relevant deliverable
- Monthly totals show: `4 DP (3 completed, 1 replaced by client request)`
- CA/Amonique decides whether a request replaces or supplements the package

---

## 11. How Each Planner Board Maps to CG Dynamics

| Teams Planner Board | CG Dynamics Mapping |
|---|---|
| **To Do** | `command_centre_tasks` (enhanced with `deliverable_id` FK) — all ad-hoc tasks, graphic design, videos, websites, content guides, once-off items, bigger operational items. Quick-add from dashboard. |
| **Client Websites** | Bucket = `Websites` in `command_centre_tasks` + optional website-specific package in `client_packages`. Monthly website updates become `monthly_deliverables` with `code = 'Website Update'`. Google Business Profiles as tasks with `bucket = 'Websites'`. |
| **Admin Check List** | New `admin_board_tasks` table. Daily/weekly/monthly recurring tasks with `recurring` column. Only visible to admin role. Payroll, checking items, financial tasks. Separated at table level — no risk of staff seeing it. |
| **2025 Clients Schedule** | `client_packages` + `package_deliverable_types` + `monthly_deliverables`. This is the core replacement. Each client's annual calendar is auto-generated from their package. Deliverable codes (DP1-4, F1-4, Video 1-2, Reel 1-4) map directly to `code` + `instance_number`. |
| **CG Socials** | New `cg_socials_tasks` table. CG's own content — studio schedule, internal posts, CG brand content. Separate from client deliverables. |

---

## 12. Phase 1 Build Plan — Core Schema + Migration

**Goal:** Get the package + deliverable model into the database. No UI changes.

### Tasks
1. Create migration file `phase-6-cg-planner-core.sql` containing:
   - `client_packages` table
   - `package_deliverable_types` table
   - `monthly_deliverables` table with full status lifecycle
   - `admin_board_tasks` table
   - `cg_socials_tasks` table
   - `deliverable_comments` table
   - Alter `command_centre_tasks` to add `deliverable_id`
   - RLS policies for all new tables
   - Indexes
2. Write `src/lib/planner.ts` with types for all new tables
3. Write server-side functions:
   - `generate_monthly_deliverables(package_id, month)` — generates rows for one package
   - `generate_all_monthly_deliverables(month)` — generates for all active packages
4. Write a `generate-next-month` edge function or pg_cron job
5. Write tests for generation logic (deterministic, idempotent)
6. Run migration, test RLS

### Non-goals
- No UI yet
- No calendar view
- No approval workflow UI
- No changes to existing Command Centre yet

---

## 13. Phase 2 Build Plan — Planner UI + Client Schedule View

**Goal:** Replace the four Planner boards with CG Dynamics UI.

### Tasks
1. **Active Tasks view** (replaces "To Do" board)
   - Flat scrollable list of `command_centre_tasks` + `monthly_deliverables`
   - Filter by bucket, staff, client, month
   - Sort by priority, due date, status
   - Quick status change dropdown (respecting permission rules)
   - Left accent bar per row (same as current visual polish)
   - Deliverable rows show `code-instance_number` badge (e.g. "DP-3")

2. **Client Schedule view** (replaces "2025 Clients Schedule" board)
   - Select client → show that client's `monthly_deliverables` grouped by month
   - Month tabs (January, February, ...)
   - Within each month: grouped by deliverable type
   - Progress bar per type: "DP: 2/4 complete"
   - Status coloured dots
   - Only CA/Amonique can drag dates or change scheduled/approved status

3. **Monthly Packages view**
   - Per-client grid showing deliverable type counts
   - "Generate next month" button (admin only)
   - Add/edit deliverable types (admin only)

4. **Admin Board** (replaces "Admin Check List")
   - Separate page/section, hidden from non-admin
   - Daily/weekly/monthly tabs
   - Recurring task auto-generation
   - Simple checkbox completion

5. **CG Socials** (replaces "CG Socials" board)
   - Calendar-style view for CG's own content
   - Same status lifecycle (simplified — no client approval steps)

### Non-goals
- No calendar grid yet (just list views)
- No approval workflow modals
- No assignment suggestions from CG Assistant
- No OneDrive links

---

## 14. Phase 3 Build Plan — Calendar + Approvals + Assistant

**Goal:** Calendar visibility, full approval workflow, and CG Assistant integration.

### Tasks
1. **Calendar view**
   - Month grid showing all scheduled deliverables
   - Colour-coded by client
   - Click to see detail popover
   - Staff filter toggle
   - Only CA/Amonique can click-and-type to change `scheduled_date`

2. **Approval workflow modals**
   - "Ready for internal review" banner for CA/Amonique
   - Approve / Request changes buttons
   - "Send for client approval" → generates WhatsApp message template
   - "Client approved" → moves to approved status
   - Audit log in `deliverable_comments`

3. **OneDrive resource links**
   - External link cards in the UI (not iframes):
     - CG OneDrive
     - Client OneDrive
     - Once-Off OneDrive
   - Click opens in new tab

4. **CG Assistant integration**
   - Assistant reads `monthly_deliverables` context
   - Assistant suggests assignments based on staff role + workload
   - Assistant answers "What's left for Cape Grace this month?"
   - Staff can ask "What is urgent today?" across all boards

5. **Reporting memory**
   - Monthly deliverable completion stats feed into reports
   - "Package completion rate" as a reportable metric
   - Client request → deliverable override tracking

### Non-goals
- No WhatsApp API
- No push notifications
- No client-facing portal for approvals (approvals go via WhatsApp still)
- No SSO or OAuth changes

---

## 15. Next Prompt Recommendation

Here is the exact prompt to hand to the developer after commit:

```
Phase 6 — Planner Core Schema + Library

Create a migration file `supabase/phase-6-cg-planner-core.sql` with these tables:

1. `client_packages` — id, client_id, name, active (default true), start_date, end_date, created_at, updated_at
2. `package_deliverable_types` — id, package_id FK cascade, code (e.g. "DP"), label (e.g. "Designed Poster"), count_per_month (int), sort_order (int). Unique on (package_id, code).
3. `monthly_deliverables` — id, package_id FK cascade, client_id FK cascade, deliverable_type_id FK cascade, code (denormalised), instance_number (int 1..N), month (date, first of month), status (text with check constraint: 'to_do','in_progress','ready_for_internal_review','internal_changes','ready_for_client_approval','waiting_client','client_changes','approved','scheduled','posted','blocked','moved'), due_date, scheduled_date, posted_at, assigned_to_user_id FK to profiles, assigned_to_name, title, notes, parent_request_id FK to client_requests, created_at, updated_at. Unique on (package_id, deliverable_type_id, instance_number, month).
4. `admin_board_tasks` — id, title, category ('daily','weekly','monthly','payroll','checking','other'), assigned_to_id FK, assigned_to_name, status ('to_do','in_progress','done','blocked'), due_date, recurring (nullable 'daily','weekly','monthly'), notes, created_by FK, created_at, updated_at.
5. `cg_socials_tasks` — id, title, platform ('facebook','instagram','tiktok','linkedin','other'), content_type ('post','reel','story','video','photo','other'), status ('to_do','in_progress','ready_for_internal_review','approved','scheduled','posted','blocked','moved'), scheduled_date, posted_at, assigned_to_id FK, assigned_to_name, notes, created_at, updated_at.
6. `deliverable_comments` — id, deliverable_id FK cascade, author_id FK cascade, body, created_at.
7. Alter `command_centre_tasks` to add `deliverable_id uuid references monthly_deliverables(id) on delete set null`.

Add proper RLS for all tables:
- Admin board: only admin can select/insert/update/delete
- Packages + deliverable types: admin only
- Monthly deliverables: staff can select all, update only assigned rows, admin can do everything
- CG socials: staff select + update own, admin full
- Comments: staff select all + insert own + update own

Add indexes on: monthly_deliverables(client_id, month), monthly_deliverables(status), monthly_deliverables(assigned_to_name), admin_board_tasks(category, status), cg_socials_tasks(scheduled_date).

Write `src/lib/planner.ts` with:
- TypeScript types matching all new tables
- `listDeliverables(filters)` — client_id, month, status, assigned_to_name
- `updateDeliverableStatus(id, status)` — with permission check
- `updateDeliverable(id, partial)` — admin only for sensitive fields
- `listAdminTasks(filters)` — category, status
- `listCgSocials(filters)` — platform, status
- Helper: `generateDeliverableRows(packageId, month)` — deterministic row generator
- Helper: `generateAllForMonth(month)` — loops active packages

Do NOT:
- Create UI pages yet
- Create calendar views
- Create approval modals
- Delete existing command_centre_tasks or any existing code

The migration must be safe to run on an existing database without data loss.
```
