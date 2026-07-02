# Recurring tasks & Microsoft import — design foundation

Design for two connected workstreams: real recurring tasks in CG Dynamics and
a safe Microsoft Teams / Planner / Calendar import path. Foundation only —
implementation lands in follow-up passes.

## 1. Recurring tasks (planner_tasks)

**Goal:** daily/weekly/monthly operational tasks (e.g. "Payroll checklist",
"Weekly content run") behave like real recurring tasks without duplicate or
runaway creation.

**Model (migration to prepare, not yet written):** add to `planner_tasks`:

- `recurrence_rule text null` — small subset of RRULE: `FREQ=DAILY|WEEKLY|MONTHLY`,
  optional `BYDAY` (MO..SU), optional `BYMONTHDAY` (1–28), optional `INTERVAL`.
- `recurrence_parent_id uuid null` — instance → template link.
- `recurrence_until date null` — optional end.

**Safe materialisation rules (the anti-runaway contract):**

1. Instances are only materialised **on view** ("materialise the current
   window when a board/Daily Tasks loads"), never by an unbounded background
   loop.
2. Window is capped: today → +14 days, and never backfills more than 7 days.
3. Idempotency key: unique index on `(recurrence_parent_id, due_date)` —
   inserting an existing instance is a no-op (`on conflict do nothing`).
4. A template (`recurrence_rule is not null`) never appears in task lists
   itself; only its instances do.
5. Completing/deleting an instance never touches the template; editing the
   template only affects future, not-yet-materialised instances.

**Why not cron:** Supabase scheduled functions add deploy surface; on-view
materialisation with the unique-index guard is idempotent, needs no infra,
and CG staff open the app daily anyway.

## 2. Microsoft Teams / Planner / Calendar import

**Principle:** Microsoft data → **preview** mapped result → staff approves →
apply. Never blind-import, never overwrite CG Dynamics edits silently.

**Pipeline stages:**

1. **Fetch** (connector or exported files): Planner plans → buckets → tasks
   (title, bucket, assignees, due date, checklist, recurrence); Outlook/Teams
   calendar events (subject, start/end, recurrence, attendees).
2. **Map** to CG Dynamics shapes:
   - Planner plan → `planner_boards` (match by name, else propose new)
   - bucket → `planner_buckets` (match by lower(name))
   - task → `planner_tasks` (`import_hash` = stable hash of plan+task id keeps
     re-imports idempotent; assignee display names → `assigned_to_name` +
     `helper_names`)
   - recurring Planner tasks → `recurrence_rule` template (section 1)
   - calendar events → `company_calendar_events` (event_type inferred:
     shoot / meeting / content_run keywords; else `internal`); client match
     only via explicit staff confirmation — never guess `client_id`.
3. **Diff/preview:** each row classified `create` / `update` / `conflict`
   (CG-side edits newer than Microsoft-side) / `skip (unchanged)`. Conflicts
   are flagged for a human, never auto-resolved.
4. **Apply:** only approved rows; batch recorded in `planner_activity_log`
   (action `microsoft_import`) so an import is reviewable afterwards.

**Existing foundations to reuse:** `scripts/import-planner-exports.mjs`
(Excel export parsing, import_hash idempotency, checklist-as-sibling
strategy), `planner_tasks.source = 'teams_import'`, the strict import rules
in `docs/cg-dynamics-outstanding-audit.md`.

**Connector note:** when a Microsoft 365 connector is available to an agent
session, use it read-only to enumerate plans/buckets/labels and validate the
mapping above against the real structure before writing any importer code.

## 3. Calendar ↔ tasks connection (next pass)

CG Calendar should stop being events-only. Next pass: read-only overlays on
`/admin/cg-calendar` — scheduled posts (`monthly_deliverables` via
`getEffectiveScheduleDate`) and dated planner tasks (`planner_tasks.due_date`)
as toggleable chip layers with a legend, each chip linking back to Client
Schedule / Planner for editing. No new tables; the calendar stays a
presentation layer over the existing sources of truth.
