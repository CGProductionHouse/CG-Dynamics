# Mission status — operational completion

Live status for the "CG Dynamics operational completion" mission. Updated as
work lands. Format per goal: problem found → chosen solution → verification →
blockers → state.

_Last updated: 2026-07-18_

## Goal 1 — Microsoft migration

- **Requirement correction (2026-07-15):** Microsoft is a temporary upstream
  source during a one-to-two-month coexistence period. The normal experience is
  repeat one-way transition sync, not a once-off JSON migration and never
  Microsoft write-back.
- **Transition architecture:** the admin page fetches allowlisted Outlook and
  Planner sources through a server-only Edge Function; connected agents can
  provide the same normalized version 2 snapshot through an advanced transport.
  Both triggers use one completeness-aware reconciliation engine.
- **Reconciliation:** exact Phase 15a IDs classify create, update, unchanged,
  complete, reopen, move, cancel, archive/source-removed, conflict, skipped and
  failed. Microsoft-owned baselines protect newer CG edits; CG-only notes and
  workflow fields are preserved. Missing items become removal candidates only
  after a complete successful source fetch and separate admin approval.
- **Audit/lifecycle:** prepared review-only Phase 17a with active/paused/complete
  transition state, per-run and per-item audit, source baselines/removal markers,
  metadata protection and transactional item apply.
- **Verification:** production build and focused lint pass; pure reconciliation
  checks passed across create, unchanged, complete, move, local conflict,
  complete/incomplete removal, invalid identity, reopen, baseline adoption and
  Client Schedule identity/type changes. Authenticated/live validation remains
  blocked until Phase 17a, the Edge Function and read-only Graph connection are
  reviewed and configured.
- **Live schema correction (verified 2026-07-14):** Phase 15a is already live.
  A read-only Management API query confirmed all Microsoft source columns on
  `planner_tasks`, `monthly_deliverables`, and `company_calendar_events`, plus
  the unique indexes `planner_tasks_microsoft_source_key`,
  `monthly_deliverables_microsoft_source_key`, and
  `company_calendar_events_microsoft_source_key`. Do not rerun Phase 15a.
- **Activation verification (2026-07-18):** Phase 17a tables, tracking columns,
  triggers, RLS policies and admin apply RPC were already present from a manual
  SQL Editor run. The transition is `active` and no sync runs or linked rows
  exist yet. A tracked hardening migration removed anonymous execution from
  the apply RPC and all browser execution from its trigger helper. Phase 16a
  and Phase 16b remain unapplied; neither is required for a dry reconciliation.
- **Microsoft source discovery:** the connected `info@cgproductionhouse.com`
  account can read its default Calendar and the exact approved Planner plans:
  `To Do`, `MASTER CLIENT TO DO`, `CG Socials`, and
  `Client Socials - July 2026`. Historical monthly plans remain excluded.
  The bounded Calendar window contains operational events and paginates beyond
  100 rows; the selected Planner plans and real buckets are readable.
- **Confidentiality correction:** a real `To Do` item demonstrated that the
  staff-visible operational board can contain confidential admin work.
  Finance, payroll, banking, identity-number and private HR terms now produce
  an admin-only `restricted_content` conflict instead of a destination write.
- **Edge deployment:** `microsoft-transition-sync` version 1 is active in the
  production Supabase project. Its custom authorization returned HTTP 401 for
  an anonymous status request and logged no secret values.
- **Current blocker:** this environment can read Outlook and Planner through
  delegated connectors but cannot manage Entra applications or securely enter
  a new client secret. A CG-owned read-only app registration with
  `Calendars.Read` and `Tasks.Read.All`, admin consent, and four Supabase secret
  values is still required before authenticated status, fetch, preview or apply.
- **State:** schema and Edge deployment are activated and source IDs are
  verified. No live reconciliation has been run and no destination business
  rows were changed.
- **Browser check:** local Edge at 1440x900 and 390x844 confirmed Microsoft
  Sync, Calendar, Planner, My Work, Hub and Client Schedule remain protected,
  with no console errors, failed requests or horizontal overflow on the login
  result. Authenticated sync and destination verification remain outstanding.

## Goal 2 — daily operating system (Hub, My Day, Planner, Command Centre, CG Calendar)

- Month-key dates leaking into My Day/Hub date logic fixed (part of PR #25).
- **Loop 1 route baseline:** `/admin` and successful staff login now resolve to
  `/admin/cg-hub`; protected deep links survive login; unknown routes recover
  through the role-aware root redirect; navigation zones follow the current
  URL; Daily Tasks replaces Assistant in the five-item mobile operations bar;
  auth/profile loading states are visible instead of blank screens.
- **Role baseline:** Users, Invites and Microsoft Sync remain admin-only.
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
- **Loop 4 Calendar:** event queries are bounded to the visible SAST month;
  default Calendar content remains operational events only; optional Planner
  tasks load only when enabled and exclude recurrence templates, archives and
  history. Event type filters now include Internal and Cancelled, imported
  Outlook events are labelled, and managers/admins have create/edit/delete
  controls while staff receive a read-only drawer.
- **Loop 4 event safety:** timed and all-day inputs are converted with explicit
  `Africa/Johannesburg` boundaries, end-before-start is rejected, all-day
  events default to a one-day exclusive end, and overlapping active events are
  warned before save without blocking intentional overlaps.
- **Loop 4 navigation:** Team now contains URL-backed Users and Invites tabs;
  My Work contains URL-backed My Day and Daily Tasks tabs. Existing deep links
  redirect to the matching tab, sidebar entries are consolidated, and Planner
  has synced sticky top/bottom horizontal navigation plus Shift+wheel support.
- **Loop 4 permissions:** prepared
  `supabase/phase-16b-calendar-manager-permissions.sql` to retain staff read
  access while restricting event writes to manager/admin roles. It was not run
  against production; review and explicit approval are required.
- **Loop 4 verification:** production build and focused ESLint passed. The
  signed-in role matrix, Calendar CRUD, tab history/refresh behavior, Planner
  scrollbar synchronization and desktop sidebar fit still require an
  authenticated browser session. No QA records or production writes were
  created.

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
