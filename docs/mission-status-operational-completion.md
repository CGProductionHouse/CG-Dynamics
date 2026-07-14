# Mission status — operational completion

Live status for the "CG Dynamics operational completion" mission. Updated as
work lands. Format per goal: problem found → chosen solution → verification →
blockers → state.

_Last updated: 2026-07-14_

## Goal 1 — Microsoft migration

- **Problem:** PR #25 shipped good preview/classification logic behind a
  dead-end transport: an Edge Function that always returned `setup_required`
  and could only ever work after building a full Entra OAuth + encrypted
  refresh-token platform — over-engineering for a once-off migration.
- **Decision:** **Option A — once-off, operator-assisted migration** (ratified
  in `docs/microsoft-365-import-map.md`). No Microsoft OAuth in the deployed
  app, ever, unless a recurring connection is genuinely needed later. The
  operator exports a normalized JSON snapshot via the coding-agent Microsoft
  connector; an admin uploads it at `/admin/microsoft-import`; preview +
  insert-only apply run in the browser under the admin's RLS session.
- **Done in this pass:** snapshot parser, live mapping-context and
  existing-target loaders (graceful `migrationNeeded` before phase-15a),
  natural-key slot guard for `monthly_deliverables`, insert-only apply with
  three idempotency layers, page rewrite, stub Edge Function removed, PR #25
  month-key bug fix retained.
- **Verification:** build + targeted lint pass; pure preview/parse logic
  exercised by a scripted test run (see PR #25 description for the scenario
  list). Authenticated end-to-end browser testing is **not possible from this
  environment** (no Supabase credentials here) — first live run must be
  watched by an admin.
- **Live schema correction (verified 2026-07-14):** Phase 15a is already live.
  A read-only Management API query confirmed all Microsoft source columns on
  `planner_tasks`, `monthly_deliverables`, and `company_calendar_events`, plus
  the unique indexes `planner_tasks_microsoft_source_key`,
  `monthly_deliverables_microsoft_source_key`, and
  `company_calendar_events_microsoft_source_key`. Do not rerun Phase 15a.
- **Blocker (human):**
  1. Reconnect the Microsoft 365 connector for the export session — it
     disconnected mid-mission; real plan/calendar snapshots are not yet
     exported.
- **State:** architecture resolved; import tooling and live schema ready; real
  data migration is pending only the future connector-assisted snapshot export.

## Goal 2 — daily operating system (Hub, My Day, Planner, Command Centre, CG Calendar)

- Month-key dates leaking into My Day/Hub date logic fixed (part of PR #25).
- **Loop 1 route baseline:** `/admin` and successful staff login now resolve to
  `/admin/cg-hub`; protected deep links survive login; unknown routes recover
  through the role-aware root redirect; navigation zones follow the current
  URL; Daily Tasks replaces Assistant in the five-item mobile operations bar;
  auth/profile loading states are visible instead of blank screens.
- **Role baseline:** Users, Invites and Microsoft Import remain admin-only.
  Hub, My Day, Planner, Daily Tasks and CG Calendar remain staff workspace
  routes; clients are redirected to their dashboard.
- **Loop 1 browser verification:** real headless Edge at 1440x900, 1366x768
  and 390x844. Landing, direct Hub protection, Microsoft Import protection,
  wildcard recovery and browser Back passed with no console errors or
  horizontal overflow. Navigation-related font requests aborted during route
  changes only; no repeated application request loop was observed.
- **Loop 1 limitation:** no signed-in browser session was accessible to the
  automation context, so authenticated admin/team menu visibility is not yet
  recorded as passed.
- **Loop 2 Hub/My Day:** staff Hub task and deliverable summaries are now
  assignment-scoped while admin/manager roles retain operational summaries.
  Hub query and Quick Add failures are visible, Quick Add stores the current
  profile ID, completed schedule/event history is excluded, and the generic
  launcher/placeholder AI sections no longer displace daily work.
- **Loop 2 data correctness:** recurrence templates are excluded from the
  combined task feed; undated Planner rows stay undated; monthly-deliverable
  queries normalize `YYYY-MM` to a real month-start date; My Day reads the
  current schedule year so overdue assigned work is not limited to the current
  month; native Daily Tasks and Planner items keep distinct labels/links.
- **Loop 2 time/timeline:** business date, grouping, query boundaries and event
  labels use `Africa/Johannesburg`. Completed events are not active work,
  assigned events for another person do not enter a personal day, all-day
  events consume the workday, outside-hours events are not relocated into the
  08:00–17:00 timeline, and Current is set only during an actual work block.
- **Loop 2 verification:** production build and targeted ESLint passed. Live
  read-only aggregates confirmed 57 active Calendar events and no active
  recurrence templates at verification time. Authenticated Hub/My Day browser
  data could not be exercised because the automation browser has no accessible
  signed-in session; protected-route behavior remains covered at all required
  viewports.
- **Loop 3 Planner:** operational statuses now preserve blocked, waiting-client
  and done states; start dates can be edited; manager controls are separated
  from assigned-staff status changes; archive results remain visible in
  History; desktop buckets use the same priority/date ordering as mobile;
  title/client/assignee and status filters are available; managers have a
  phone-width task creator; helpers can be maintained as comma-separated names.
- **Loop 3 Daily Tasks:** SAST supplies the default day, failed quick-status
  writes are visible, self-assignment stores the profile ID, the invalid
  `__other__` assignee sentinel was removed, suggested Morning List client
  matches are no longer preselected for saving, and partial batch failures
  remove already-created rows from retry state to prevent duplicates.
- **Loop 3 permissions:** prepared
  `supabase/phase-16a-operational-task-permissions.sql` aligns manager Planner
  and Daily Tasks management, adds assigned-staff status RPCs, extends Planner
  operational statuses, and fixes the live Daily Tasks bucket constraint. It
  was not run against production; review and explicit approval are required.
- **Loop 3 verification:** production build and targeted ESLint passed. Real
  Edge checks at 1440x900, 1366x768 and 390x844 confirmed Planner and Daily
  Tasks direct URLs remain protected, with no console errors or horizontal
  overflow on the login result. Authenticated create/edit/archive testing and
  temporary QA records were not attempted because no signed-in automation
  session was accessible and Phase 16a is not live.

## Goals 3–8

Not started this pass. Order of attack: client content operations (Goal 3),
client dashboard/portal (Goal 4), roles/nav/access audit (Goal 5), reports &
Meta stabilisation (Goal 6), UX/mobile pass (Goal 7), full regression +
release (Goal 8), then the OpenClaw handoff doc.

## Standing environment constraints

- The configured Supabase project is available for read-only schema checks.
  Production data mutations and migration execution still require explicit
  approval and review in the Supabase SQL editor.
- The Microsoft 365 connector is not part of the deployed app and is only
  needed later for operator-assisted snapshot export.
- `docs/pending-supabase-migrations.md` is stale (2026-06-30): it predates
  phases 10a–15a. Treat every phase-≥10 migration as unverified until checked
  live.
