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
├── Board Views (flat board navigation)
│   ├── Operations / To Do
│   ├── Client Websites
│   ├── Admin Check List (admin_only)
│   ├── Client Schedule (Package Master View)
│   └── CG Socials
│
├── Package Master View
│   ├── Per-client package template (DP, F, Video, Reel counts)
│   ├── Editing affects future months only
│   ├── Archive dates and recurrence rules
│   └── Admin/CA/Amonique only
│
├── Monthly Bucket View
│   ├── One month at a time
│   ├── Each deliverable is an independent row
│   ├── Individual assignment per item
│   ├── Full approval/status lifecycle
│   └── Main working view for staff + Amonique
│
├── Calendar View
│   ├── Monthly deliverables by date
│   ├── Public CG calendar
│   ├── Staff-specific calendars
│   ├── Client package calendar
│   ├── CA/Amonique sets scheduled_date
│   └── Staff view-only + production status updates
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

## Real Planner Export Findings

On 2026-06-29, four `.xlsx` exports were extracted from Microsoft Teams Planner and saved in `docs/planner-exports/`. Below are the findings that corrected the seed model.

### 2025 CLIENTS SCHEDULE (4306 tasks, 43 buckets)
- **Buckets are clients**, not general columns. The 43 client buckets (exact names from export):
  1. ACTION SPORT, 2. AV EVENT LIFE, 3. BOHEMIA, 4. BRAIZE PROMOTIONS, 5. C&L INNOVATIONS,
  6. CAPE LUMBER, 7. CENTRAL CANVAS, 8. DAISY & CO, 9. DELTA GAS, 10. DULUX BLOEMFONTEIN,
  11. ECONO, 12. EHRLICH PARK BUTCHERY, 13. EMMANUEL FUNERALS, 14. FIRST TECH, 15. GERMOPARTS,
  16. HINO TRUCKS, 17. HMHI ATTORNEYS, 18. HUMAN AUTO FORD, 19. JENKOR, 20. KUNDEDIENSTE,
  21. LOCAL DELI, 22. LORACLOX, 23. MADISON WEAR, 24. NOVUS STEEL, 25. PEYPER BONDS,
  26. PIEK GROUP, 27. PSG, 28. RC POLYPIPE, 29. RED OAK, 30. SECURIFORCE,
  31. SUPA QUICK BFN, 32. SUPA QUICK CENTURION, 33. TBS, 34. TOBICH OPTICS, 35. TOYOTA BLOEMFONTEIN,
  36. WATCH ADDICT, 37. WE AR FUELS, 38. WISEMAN GROUP, 39. WISEMAN MIDAS, 40. WISERIDE,
  41. BLOEM MARBLE & GRANITE, 42. BOUWER & COETZEE ATTORNEYS, 43. THE STAFFORDHIRE PUB
- **Task naming:** `{code} {instance} - {client}` — e.g. `WEB - WISEMAN GROUP`, `F 1 - WISEMAN GROUP`, `WEB` (no client suffix when bucket is the client)
- **Deliverable codes observed:** `WEB`, `F` (photo), `DP` (designed poster), `VIDEO`, `REEL`, `T` (TBS Brokers-specific), plus numbered variants (DP 1–12, VIDEO 1–8, F 1–8)
- **Statuses:** 4012 Completed, 293 Not started, 1 In progress — indicating heavy historical data
- **Assignments:** mostly unassigned; assigned to team in Planner via user picker
- **Users:** CG Production House (info@), Amonique (amonique@), Christie-Ann (ca@)
- **Due dates:** set per task with start/due date pairs (e.g. due 2026-07-02, start 2026-07-02)
- **No labels used.** Notes contain specific instructions (e.g. "THURSDAYS\n4 EDITED FOTOS BRANDED WITH LOGO STRIP")

### To Do (507 tasks, 7 buckets)
- **Buckets (exact, in order):** CG ADMIN - RECURRING, CLIENT REQUESTS, GRAPHIC DESIGN, ADMIN / TO DO, WEBSITES, CONTENT GUIDES, ONCE-OFF
- **Task patterns:** recurring tasks (WIX INQUIRIES — weekly, END OF DAY UPDATE — daily), project tasks (RED OAK TV, CG SOCIALS, CANVA, ONE DRIVE, CGPH WEBSITE UPDATES)
- **Multi-assignment:** semicolon-separated user GUIDs mapped to names: Christie-Ann Groenewald, Amonique Fourie, Franco Lessing
- **Users (7):** Christie-Ann Groenewald, Amonique Fourie, Franco Lessing, CG Production House, Sydney Oosthuizen, Ger-Marie Pretorius, KG
- **Statuses:** 488 Completed, 16 Not started, 3 In progress
- **Recurring:** tasks repeat with new rows each cycle (same name, different due dates)
- **Priority:** Medium only (no use of Urgent/High in this board)

### Client Websites (31 tasks, 5 buckets)
- **Buckets (exact, in order):** NEW WEBSITES / REQUESTS, MONTHLY UPDATES, WEBSITES MAINTENANCE, GOOGLE BUSINESS PROFILES, BACKGROUND SITES (OLD CLIENTS)
- **Task naming:** `{SITE} - {PLATFORM}` — e.g. `LGM - WORDPRESS`, `RAADZAAL - GOOGLE SITES`
- **Main recurring task:** "WEBSITE MONTHLY STATUS CHECK" (11 instances across MONTHLY UPDATES bucket)
- **Statuses:** mostly Not started or Completed
- **Users (5):** Christie-Ann, Sydney, Amonique, Franco, CG Production House

### ADMIN CHECK LIST (3605 tasks, 7 buckets)
- **Buckets (exact, in order):** DAILY, WEEKLY, MONTHLY, INSTAGRAM NOT CONNECTED, TIKTOK PAGES (trailing space in export — trimmed in seed), LINKDIN, ADDITIONAL ADMIN
- **Daily tasks (6):** SOCIAL MEDIA POSTS CHECK, FACEBOOK GROUPS SHARE, CLIENT GROUPS CHECK, TASK ASSIGNMENT, SCHEDULING AND SORTING, EMAILS CHECK
- **Weekly:** XERO ADMIN, SYSTEM & SCHEDULING REVIEW, EMPLOYEE TASK REVIEW, TIKTOK POSTS, INSTAGRAM POSTS, LINKDIN POSTS, MYHOURS APPROVALS
- **Monthly:** CLIENT CHECK-IN, CLIENT STATEMENTS, CLIENT INVOICES, CONTENT RUN SCHEDULING, HUMAN RESOURCES, WISEMAN INVOICE, PAYRUN (full-time + part-time)
- **Checklist:** semicolon-separated platform names (e.g. `LINKDIN;INSTAGRAM;TIKTOK;FACEBOOK`)
- **Assigned to:** mostly Amonique
- **Users (4):** Amonique, CG Production House, Christie-Ann, Franco

### Corrections Applied

| Previous assumption | Real export finding | Change |
|---|---|---|
| Client Schedule buckets: Scheduled, Unscheduled, Waiting Approval | Client Schedule buckets are **client names** (43 clients) | No generic buckets seeded; 8 representative client buckets instead |
| Operations/To Do had "Video" bucket | No "Video" bucket in To Do export | Removed; videos belong in Client Schedule as deliverables |
| Admin Check List had "Social Checks", "Client Check-ins" | Real buckets: DAILY, WEEKLY, MONTHLY, INSTAGRAM NOT CONNECTED, TIKTOK PAGES, LINKDIN, ADDITIONAL ADMIN | Seed updated |
| Client Websites had "Website Maintenance" (title case) | Exact name: "WEBSITES MAINTENANCE" (uppercase) | Seed updated |
| Background Sites bucket name | Exact name: "BACKGROUND SITES (OLD CLIENTS)" | Seed updated |
| Admin Check List "TIKTOK PAGES" | Trailing space in export: "TIKTOK PAGES " | Trimmed in seed — stored as "TIKTOK PAGES" |
| To Do users | All 7 staff found | Stored in architecture doc for reference |
| Client Schedule task naming | Pattern: `{CODE} {N} - {CLIENT}` | Drives monthly deliverable title format |

### Corrected Model: Three Views for Client Schedule

The 2025 CLIENTS SCHEDULE board reveals that the Planner replacement must support three distinct views, not just a flat bucket board:

#### 1. Package Master View
- Shows the client's package template for the year/future.
- Editing this affects future generated months only.
- This is where package changes, archive dates and recurrence rules live.
- Only CA/Amonique/admin should edit this.

#### 2. Monthly Bucket View
- Shows only deliverables for one selected month.
- Each monthly item is independent.
- Example: July DP1 - WISEMAN is separate from August DP1 - WISEMAN.
- Moving/editing/ticking off July DP1 must not affect future months.
- This is the main working view for Amonique and staff.

#### 3. Calendar View
- Shows monthly deliverables by date.
- Amonique/CA can schedule/reschedule `scheduled_date`.
- Staff can view calendar and update production status only.
- Staff cannot mark items as scheduled/posted.

#### Individual Assignment
Every deliverable item must be individually assignable:
- WISEMAN DP1 → Ger-Marie
- WISEMAN DP2 → KG
- WISEMAN F1 → Franco / content run
- WISEMAN Video 1 → Sydney
- WISEMAN Reel 1 → Alana / Sydney

### Import Plan (future)

When building the data importer from Planner exports:

| Planner field | CG Dynamics target |
|---|---|
| Plan name → slug | `planner_boards.slug` (lowercased, hyphenated) |
| Bucket name | `planner_buckets.name` (on matching board) |
| Task Name | `monthly_deliverables.title` or `command_centre_tasks.title` |
| Bucket (client name in Client Schedule) | `monthly_deliverables.code + instance_number` + `client_id` lookup via name |
| Status (Completed / Not started / In progress) | `monthly_deliverables.production_status` (posted / to_do / in_progress) |
| Priority (Medium, etc.) | `monthly_deliverables.priority` |
| Assigned To (semicolon-separated) | `monthly_deliverables.assigned_to_name` (first assignee) |
| Created Date | `created_at` |
| Due date | `monthly_deliverables.due_date` |
| Start date | start date (optional) |
| Completed Date | `monthly_deliverables.posted_at` |
| Notes | `monthly_deliverables.notes` |
| Checklist Items (semicolon-separated) | Future `deliverable_checklist` table or `metadata` JSONB |
| User ID → User Name → Email | Map Teams user GUIDs to existing `profiles` rows via email |

Do not build the importer yet. The import mapping is documented here for when data migration is ready.

---

## Phase 6A Implementation Note

**Status:** ✅ Complete (committed alongside Phase 1 of arch doc)

| Item | Detail |
|---|---|
| Migration file | `supabase/phase-6-cg-planner-core.sql` |
| Helper file | `src/lib/planner.ts` |
| Migration applied to production? | ❌ Not yet |
| UI wired? | ❌ Not yet |
| Existing Command Centre modified? | ❌ No (only added `deliverable_id` FK column) |

### Tables created in migration
- `planner_boards` — board-level organisation
- `planner_buckets` — columns/buckets inside boards
- `client_packages` — versioned client package setup
- `package_deliverable_templates` — repeatable deliverable types
- `monthly_deliverables` — core table: one row per deliverable per month
- `planner_activity_log` — safe audit log (no secrets/finance)

### Existing table extension
- `command_centre_tasks` gains `deliverable_id` FK (safe `do $$` block)

### RLS model
- `planner_boards`: staff select public/staff boards; admin_only hidden from non-admin
- `client_packages` / `package_deliverable_templates`: admin CRUD, staff select
- `monthly_deliverables`: staff select, admin CRUD (conservative — field-level RLS TODO for Amonique-specific perms)
- `planner_activity_log`: staff insert + select

### Phase 6C — Package Master View

**Status:** ✅ Complete

| Item | Detail |
|---|---|
| Page | `src/pages/admin/PackageMasterPage.tsx` |
| Route | `/admin/package-master` (staff, under CG Hub nav) |
| Helpers added | `updatePackageDeliverableTemplate()`, `deactivatePackageDeliverableTemplate()` in `src/lib/planner.ts` |
| Clients | Uses existing `clients` table via `listActiveClients()` — no duplicate client list |
| Packages | `client_packages.client_id → clients.id` — shared client memory with reporting/Meta/tasks |
| Templates | `package_deliverable_templates` — define monthly DP/F/Video/Reel structure per package |
| Permissions | Admin CRUD on packages/templates; staff view-only via RLS |
| Quick-add buttons | +DP, +Photo, +Video, +Reel — auto-generate next code number |
| Custom add | Full form with code, type, title template, assignee, day-of-month |
| Archive | Packages can be ended with end_date; templates can be deactivated |

### What Package Master Can Do Now
- Select an active client from the existing `clients` table
- View current package(s) with template totals (DP/Photo/Video/Reel/Other counts)
- Create new packages with name, start date, notes
- Add deliverable templates via quick-add buttons or custom form
- View templates in a compact table with code, type, title, count, assignee, day
- Deactivate templates (soft-delete via `active = false`)
- Archive packages (sets `end_date`, `status = 'archived'`)

### Phase 6D — Monthly Planner Package Board

**Status:** ✅ Complete

| Item | Detail |
|---|---|
| Page | `src/pages/admin/MonthlyPlannerPage.tsx` |
| Route | `/admin/monthly-planner` (staff, under CG Hub nav) |
| Purpose | First working monthly package tracker for generated client deliverables |
| Source of truth | `client_packages` + `package_deliverable_templates` |
| Generated instances | `monthly_deliverables` rows for a selected month |
| Month isolation | July DP1 and August DP1 are separate rows; updating one month does not affect another |
| Helpers added | `listMonthlyDeliverablesByMonth()`, `generateMonthFromPackages()`, `getMonthlyPackageTotals()` |
| Permissions | Staff view if RLS allows; generation/status updates are admin-only in the UI |

### What Monthly Planner Can Do Now
- Select previous/current/next month or choose a month with a compact month input
- Generate one month's deliverables from active Package Master templates
- Prevent duplicate generation in code by checking existing `(package_id, template_id, instance_number, month)` rows before insert
- Rely on the existing database unique constraint as a final guard: `unique (package_id, template_id, instance_number, month)`
- View generated monthly deliverables grouped by client
- Show client totals for DP, Photo, Video, Reel, Other and remaining work
- Filter by client, client search text, production status and deliverable type
- Update production status as admin only
- Show compact deliverable cards with code, title, type, assignee, status, priority, due date, scheduled date and notes

### Deferred to Phase 6E
- Calendar View — scheduled dates on a month grid
- Drag-and-drop status changes across buckets
- Approval workflows (internal review modal, client approval modal)
- Staff-specific permission rules for scheduled/posted controls
- Package change wizard for future-month package edits
- Year planner and bulk month operations
- WhatsApp API and AI assignment automation

### Phase 6E — Teams Planner Import Foundation

**Status:** ✅ Foundation complete; dry-run only by default

| Item | Detail |
|---|---|
| Script | `scripts/import-planner-exports.mjs` |
| Dry-run | `node scripts/import-planner-exports.mjs --mode dry-run` |
| SQL preview | `node scripts/import-planner-exports.mjs --mode generate-sql` |
| JSON output | `scripts/generated/planner-import-preview.json` (gitignored) |
| SQL output | `scripts/generated/planner-import-preview.sql` (gitignored) |
| Migration | `supabase/phase-6e-teams-planner-import.sql` adds `planner_tasks` for non-package Planner tasks |
| Admin route | `/admin/planner-import` shows local run instructions; no production import button |

#### Source files
- `docs/planner-exports/2025 CLIENTS SCHEDULE.xlsx`
- `docs/planner-exports/To Do.xlsx`
- `docs/planner-exports/Client Websites.xlsx`
- `docs/planner-exports/ADMIN CHECK LIST.xlsx`

These files are local-only references and must not be committed.

#### Client Schedule mapping
- Buckets are treated as client names.
- Client matching uses existing `clients.name` only, with safe normalised matching.
- No duplicate clients are created.
- Unknown client buckets are flagged for manual review.
- Known package content codes are imported only when detected:
- `DP1`, `DP2`, etc. → `dp`
- `F1`, `F2`, etc. → `photo`
- `Video 1`, `Video 2`, etc. → `video`
- `Reel 1`, `Reel 2`, etc. → `reel`
- Unknown card types are warnings, not package templates.

#### Package import rule
- Create one active `Monthly Content Package` per matched client only if no active package exists.
- Generate package templates from detected quantities.
- Generate monthly deliverables by task due/start month.
- Each month remains independent.
- Inserts are idempotent using existing unique constraints and `on conflict do nothing`.

#### Generic Planner task mapping
- `To Do.xlsx` imports to `planner_tasks` under Operations.
- `Client Websites.xlsx` imports to `planner_tasks` under Client Websites.
- `ADMIN CHECK LIST.xlsx` imports to `planner_tasks` under the admin-only board.
- Admin board tasks stay protected by board visibility and RLS.

#### Simplified status mapping
- Not started → `to_do`
- In progress → `in_progress`
- Ready for review → `ready_internal_review`
- Awaiting client approval → `ready_client_approval`
- Meta Drafts → `approved`
- Scheduled / Posted → `scheduled`

#### Dry-run first rule
- Always run `--mode dry-run` first.
- Review `planner-import-preview.json` for unmatched clients and warnings.
- Then run `--mode generate-sql`.
- Review generated SQL manually before running it in Supabase.
- The script does not apply SQL automatically.

#### Manual review still needed
- Unmatched client bucket names.
- Client Schedule cards that are not DP/F/Video/Reel.
- Tasks with missing due/start dates where month cannot be inferred.
- Completed operational tasks where Planner status does not clearly mean scheduled/posted.

### Next step
**Phase 6F — Calendar View and approval workflow foundations.**
