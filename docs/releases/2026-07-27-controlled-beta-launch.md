# CG Dynamics — Controlled Beta Launch (Monday 27 July 2026)

Last updated: 2026-07-25
Status: Release readiness — CONDITIONAL GO
Scope: Controlled production beta for CG staff and selected clients.

## 1. Launch scope

A controlled production beta, not a full feature launch. The bar is a stable,
secure, honest app: working auth, correct role/client isolation, a reliable
client portal, verified Meta reporting truth, Google Ads where configured, safe
admin navigation, and honest empty/disconnected states. Unfinished features are
clearly labelled beta/preview or hidden — none pretend to be complete.

## 2. Supported production modules

- **Authentication & routing** — login, logout, password recovery, role-based
  guards (`RequireStaff` / `RequireAdmin` / `RequireManager` / `RequireClient`),
  `/dashboard` → `/client` redirect, unknown-route fallback.
- **Client portal** — `/client` (overview), `/client/performance`,
  `/client/campaigns`, `/client/content-calendar`. Report-bound RPCs; published
  reports only; own-client data only.
- **Meta reporting truth** — availability-aware facts (unavailable ≠ zero), FB/IG
  kept separate, unique audiences never summed cross-platform, comparability gate
  on movement, per-platform labels. Connector diagnostics are staff-only.
- **Google Ads reporting** — client-isolated; honest disconnected/no-activity
  states; spend "Unavailable" on mixed currency; conversions never shown as
  revenue. Edge functions are JWT-protected.
- **Admin workflow (read + core actions)** — CG Hub, Client Performance, Clients,
  Reports/Published preview, Client Schedule, Planner, My Work, CG Calendar,
  Content Workflow, Integrations.

## 3. Beta / transition modules (labelled, non-blocking)

- **Microsoft transition reconciliation** (`/admin/microsoft-import`) — admin-only.
  Deterministic reconciliation engine (tolerant parser, `link_existing`,
  `package_template_create`, deterministic apply order) is complete and tested;
  production apply RPCs (phase-21a/21b) are live and backward compatible. The UI
  shows a **beta/pending banner** and requires a reviewed preview before apply.
  **Live dated package-parity verification is still pending** — see §5.
- **CG Assistant** (`/admin/assistant`) and **Marketing Library**
  (`/admin/marketing-library`) — AI Workforce foundations; treat as beta. No
  fabricated results; do not rely on them for client-facing output this beta.

## 4. Operations Hub (new — launched in this release)

The Operations Hub (`/admin/ops-hub`) replaces Teams/Planner for daily staff workflow with the following modules:

- **My Work** — personal task list in sections (overdue, today, in progress, upcoming, waiting, no due date)
- **Board** — kanban board grouped by bucket with native HTML5 drag-and-drop (bucket moves only), keyboard alternatives, and quick-add
- **Client Work** — request queue with filters (client, request state, classification), unclassified banner, urgent banner, WhatsApp capture intake, package deliverables grid
- **Calendar** — month/week/day views with navigation, staff/client/bucket filters, drag-to-schedule for tasks, date-type labels (Due, Schedule), mobile-friendly day/agenda view
- **Admin** — database-protected admin-only board showing Admin / To Do tasks; RLS prevents non-admin writes

Task features:
- **Quick Add** — title-only capture with progressive fields, Enter/Escape, duplicate-prevention, `'Once-off'` bucket default
- **Task detail drawer** — right-side drawer (desktop) / full-screen sheet (mobile), editable all fields, dirty-state tracking, Save/Cancel, close-confirmation
- **Status quick-change** — optimistic UI with revert on failure
- **Request intake** — WhatsApp paste capture with client/contact/source selection, duplicate detection, `client_request` priority default
- **Package classification** — admin-only controls for `use_slot`, `addon`, `move_work`; deliverable linking with same-client enforcement; `quote_needed` flag
- **WhatsApp approval** — honest copy-approval-message button (no false sending claims), Mark as sent/approved/changes requested states

Tests: 138 automated quality-gate tests covering route protection, capture, edit, assignment, bucket movement, failure rollback, due-date handling, request intake, package classification, WhatsApp honesty, client isolation, deliverable linking, calendar views, drag-to-schedule, mobile fallbacks, and source identity preservation.

## 5. Known limitations

- **Microsoft live dated parity is PENDING.** The fresh dated Microsoft Graph
  fetch (source of per-task scheduled dates) requires an authenticated admin
  session or the service-role key to invoke `microsoft-transition-sync`, which is
  not available to the release automation. Action Sport's 9-row live result and
  the all-client live parity matrix are therefore **not yet verified**. The
  feature is admin-only, preview-before-apply, no automatic source removal.
  **Microsoft Planner remains the source of truth until the dated apply is run
  and reviewed.**
- **Operations Hub drag-to-schedule for deliverables** requires admin role
  matching at the database layer — normal staff cannot reschedule package
  deliverables through the calendar. This is enforced by RLS.
- **Admin board tasks** are visible to all staff via Supabase SELECT (`is_staff()`
  policy). Only admin/manager roles can update or delete. Full read-isolation
  requires an RLS addition in a future release.
- **WhatsApp approval** uses copy-to-clipboard only; no WhatsApp Business API
  integration is present. Staff manually paste into WhatsApp.
- Authenticated in-app visual QA of client/admin pages is covered by code review
  + automated tests (the Vercel preview is behind Vercel SSO; no test client
  account is available to the automation).

## 6. Security & data-truth checks

- Client routes gated by `RequireClient`; every portal query keys off the
  signed-in `profile.client_id` (never a URL param); reports filtered
  `status='published'` + own client; calendar/facts via SECURITY-DEFINER RPCs
  with `auth.uid()` / report ownership. No cross-client path; no draft exposure.
- Service-role credentials never in browser code (client uses only
  `VITE_SUPABASE_URL` + publishable key). No broad RLS policy introduced.
- Meta: unavailable never becomes zero; no summed unique viewers; correct
  per-platform labels. Google Ads: no conversions-as-revenue.
- Microsoft: no automatic source removal; incomplete sources cannot prove
  deletion; no client/package guessing; CG-owned fields preserved on link.

## 7. Migrations (production)

Recent launch-relevant migrations applied and verified in production:
`phase-20d` (reporting-truth model), `phase-20e` (facts client access + curation),
`phase-21a` (Microsoft link RPC extension — backward compatible, apply contract
stays v2), `phase-21b` (package-template correction RPC). RLS intact; RPC
signatures match callers.

## 8. Edge Function versions (production, all ACTIVE)

`meta-sync` v37, `meta-sync-worker` v14, `meta-connection-status` v17,
`meta-list-assets` v19, `meta-link-assets` v5, `meta-sync-enqueue` v5,
`meta-oauth-start` v24, `meta-oauth-callback` v23, `cg-assistant-chat` v16,
`microsoft-transition-sync` v12, `google-ads-list-accounts`/`-sync`/
`-connection-status`/`-link-account` v3, `google-ads-list-campaigns` v2
(Google Ads functions are `verify_jwt: true`).

## 9. Tests / build

Full suite **138 Operations Hub tests** plus existing client-facing suites.
`npm run build` (tsc + vite) clean. ESLint clean on changed files.
`git diff --check` clean.

## 10. Rollback procedure

- **Frontend**: Vercel → Deployments → promote the previous READY production
  deployment (pre-launch main `aec2603`). Instant, no data change.
- **Git**: `git revert <merge_commit>` on main and redeploy if a code fix must be
  undone.
- **Database**: phase-21a/21b are additive + backward compatible (apply contract
  stays v2) and require no rollback; the pre-launch v2 frontend works against
  them. No destructive migration was applied. If ever needed, phase-21b's function
  can be dropped and phase-21a reverted to the phase-19c body (kept in repo).
- **Microsoft**: no source removal is possible from the app; no client rows were
  written by automation, so there is nothing to reverse.

## 11. Post-launch monitoring

- Supabase logs (edge-function + postgres) for errors; Vercel runtime logs.
- Watch first client-portal loads for RLS/permission errors and any raw provider
  error surfacing to clients (should never happen).
- Meta/Google connector health via admin diagnostics (staff-only).

## 12. Monday first-hour checklist

1. Confirm production deployment READY on `cg-dynamics.vercel.app`.
2. Load `/` and `/login` — no blank screen, no console errors.
3. Confirm `/client`, `/client/performance`, `/client/campaigns`,
   `/client/content-calendar`, `/dashboard` all resolve (unauth → login).
4. Staff sign-in: admin landing + Client Performance + Client Schedule load.
5. Client sign-in (one pilot client): portal loads, sees only own data, published
   report renders, no admin diagnostics.
6. Spot-check one Meta report (unavailable ≠ zero, FB/IG separate) and one Google
   Ads client (honest state).
7. Confirm the Microsoft import page shows the beta/pending banner; do NOT run a
   live apply without a fresh dated fetch.
8. Watch logs for the first hour; keep the rollback (promote previous deploy)
   one click away.

## 13. Follow-up priorities (post-launch)

1. Run the Microsoft dated fetch → apply → verify through an authenticated admin
   session / service-role runner; confirm Action Sport 9-row parity + all-client
   matrix; then retire Planner.
2. Authenticated end-to-end visual QA with a real client account.
3. RLS read-isolation for Admin / To Do bucket tasks (currently all staff can SELECT).
4. Operations Hub week/day calendar improvements (drag-to-reschedule deliverables).
5. Task comments, attachments, and activity log in drawer.
6. Collaborative helper assignment with name-ahead.
7. Promote CG Assistant / Marketing Library out of beta once verified.
