# Current Milestone

Last updated: 2026-07-25
Current milestone: Operations Hub — Teams / Planner replacement foundation
Status: COMPLETED — Operations Hub controlled beta released.

## Completed and in production (merged to main)

- **Meta reporting truth** — availability-aware facts (unavailable ≠ zero), FB/IG
  separated, no cross-platform unique-audience sums, comparability gate. Live (PR #43).
- **Unified client portal foundation** — `/client`, `/client/performance`,
  `/client/campaigns`, `/client/content-calendar`; report-bound RPCs; published
  reports only; own-client isolation. Live (PR #44).
- **Google Ads reporting** — client-isolated, honest disconnected states, no
  conversions-as-revenue. Live.
- **Microsoft deterministic reconciliation engine** — tolerant parser,
  `link_existing`, `package_template_create`, phase-21a/21b live (apply contract
  v2, backward compatible). Admin-only, beta-labelled (PR #45).
- **Controlled beta** — released via PR #46; main at `1bfa8e1`.
- **Client-facing trust quality gate** — enforced invariants for client isolation,
  published-only content, unavailable≠zero, cross-client safety. Live (PR #47, main `c80eb35`).
- **Content Calendar completion** — month nav, type labels, mobile/desktop views,
  summary cards, unscheduled posts, RPC safety. Live (PR #51, main `96ac699`).
- **Full monthly content-guide workspace** — publication gating via `client_published_at`,
  admin FullContentGuidePage with publish/unpublish, client read-only view via
  `SECURITY-DEFINER` RPC. Live (PR #52, main `fd804bf`).
- **Forward-looking reviewed strategy** — `buildClientStrategyPreview` reads all
  `strategyData` fields (campaign recommendation, client direction, client actions);
  dedicated client StrategyPage with action plan and strategic drivers. Live (PR #53, main `7123b06`).
- **Operations Hub PR 1** — milestone and canonical model (docs).
- **Operations Hub PR 2** — shell and unified board page at `/admin/ops-hub` with tabbed interface. Merged `bfc6425` (PR #55).
- **Operations Hub PR 3** — Quick Add (title-only, progressive fields, Enter/Escape), TaskCard, TaskDetailDrawer (editable, dirty-state, Save/Cancel, close-confirmation), `updateTask` whitelist, `'Once-off'` default bucket. Merged `c27c1d2` (PR #56).
- **Operations Hub PR 4** — RequestIntake (WhatsApp paste capture, duplicate detection), RequestApproval (copy approval message, Mark as sent/approved/changes requested), package classification (admin-only: use_slot/addon/move_work, deliverable linking, quote_needed), ClientWorkView upgrade with filters. Merged `1d0e36b` (PR #57).
- **Operations Hub PR 5** — board drag-and-drop (HTML5 native, optimistic, keyboard alternatives), calendar month/week/day views with navigation and filters, drag-to-schedule, mobile agenda. Merged `26618dc` (PR #58).
- **Operations Hub PR 6** — quality-gate test suite (46 tests), admin board implementation, security hardening, error handling. Merged `f52ebfd` (PR #59).
- **Operations Hub PR 7** — release documentation, navigation audit, Vercel deployment, production smoke checks. Merged (PR #60).

## Operations Hub milestone — COMPLETED

The Operations Hub is live in production as a controlled beta. All daily staff
workflow features are shipped: task capture, editing, My Work, board with
drag-and-drop, client request intake, package classification, WhatsApp approval
tracking, calendar views with drag-to-schedule, and admin board.

See `docs/releases/2026-07-27-controlled-beta-launch.md` for the full release
scope and known limitations.

### Carry-over blockers (not blocking Ops Hub release)

1. **Microsoft live dated fetch → apply → verify** — authenticated admin session
   required to invoke `microsoft-transition-sync` v12. Engine + apply paths are
   live; the live Graph fetch step needs a human admin in the browser.
   Microsoft Planner remains the source of truth until this is done.
2. **Authenticated client portal end-to-end visual QA** — needs a drivable browser
   with client login. Isolation is verified by quality gate tests.
   Client-facing systems remain healthy and separate from this milestone.

## Original data-truth goal (delivered)

Make CG Dynamics a trustworthy, automated client reporting system before expanding AI strategy generation. Meta reporting truth, the Overview comparability gate, and Google Ads reporting are delivered and live; Cape Lumber's stored data was the diagnostic benchmark.

The system must answer:

1. What happened?
2. Why does it matter commercially?
3. What should CG do next?

It may only answer those questions from verified evidence.

## Why this milestone is active now

The Marketing Library and Skill Card foundation remains essential, but the current client dashboard has exposed a more urgent dependency: AI strategy is unsafe when the underlying metrics are incomplete or incomparable.

The production Meta connector currently treats unavailable Facebook visibility metrics as zero and can compare them with older months that used different source coverage. This creates false declines and weakens client trust.

Data truth is therefore the required foundation for the next Client Intelligence and AI Workforce work.

## Source strategy

The implementation must follow:

- `docs/vision/CG-DYNAMICS-MASTER-GOAL-TRACKER.md`
- `docs/client-intelligence-roadmap.md`
- `docs/client-intelligence/META-REPORTING-TRUTH-STRATEGY.md`
- `docs/marketing-library/README.md`

The detailed Meta architecture, research sources, acceptance criteria and desktop-agent sequence live in the Meta Reporting Truth strategy document.

## Delivered (previous milestone: client-facing completion and trust)

All client-facing work is complete in production (PRs #48–#53 merged, main `7123b06`):
- Meta reporting truth, unified client portal, Google Ads reporting, Microsoft engine
- Content Calendar, content-guide workspace, forward-looking strategy
- 335 quality gate tests, build green

See `docs/releases/2026-07-27-controlled-beta-launch.md` for the controlled beta scope.

## Operations Hub scope for this milestone

### 1. Operations Hub shell and unified board

Create one primary `/admin/ops-hub` route that groups:
- My Work (today, overdue, upcoming, in progress, waiting)
- Operations Board (kanban with drag-and-drop, buckets, quick-add)
- Client Work (package deliverables + requests)
- Client Schedule link (existing, not duplicated)
- CG Socials board context
- Admin Board (database-protected, admin-only)
- Calendar view

### 2. Quick task capture

Zero-friction Quick Add from any ops-hub view. Required: title only.
Optional fields: client, bucket, assignee, due date, priority.

### 3. Task detail panel

Click a card → opens drawer/modal with:
title, description, client, bucket, status, assignee, helpers, priority,
due date, scheduled date, checklist, comments/activity, linked request,
linked deliverable, source badge. Progressive disclosure — no overwhelming form.

### 4. Workflow and status model

Operational base states: to_do, in_progress, blocked, done.
Package/content states add: ready_internal_review, internal_changes,
ready_client_approval, waiting_client, client_changes, approved, scheduled, posted.
Staff update progress; reviewers/CA/Amonique manage final states.
Admin work is database-separated.

### 5. Client request / WhatsApp approval workflow

Capture: paste or type a WhatsApp request → record client, original text,
category, urgency, source=whatsapp.
Convert: link to ad-hoc task, monthly deliverable, or new approval action.
Approval states: ready_to_send, sent_to_client, waiting, approved,
changes_requested, closed. Copy-ready wording button — never fake a send.

### 6. Calendar integration

Unified view of task due dates, filming dates, review deadlines,
scheduled posting dates, CG Socials. Colour-coded by client or type.
Filter by person, client, board, work type. Clear label distinction:
due date ≠ shoot date ≠ scheduled post date ≠ posted date.

### 7. Role safety and RLS

- Normal staff: see normal operational work, update own/assigned
- Admin: manage all normal work
- Admin board: database-protected, non-admins cannot read
- Client users: no ops hub access
- No service-role key in browser
- Scheduled/posting controls restricted

### 8. Migration strategy

Additive only. No duplicate task tables. No destructive rewrites.
`monthly_deliverables` remains canonical for package work.
`command_centre_tasks` + `planner_tasks` keep their roles with a clear
unification layer.

## Out of scope for this milestone

- Two-way Microsoft writes or Planner retirement before parity
- CG Hours integration or payroll access
- Broad AI Workforce expansion
- Timer or time tracking
- WhatsApp Business API integration
- OneDrive deep integration

## Delivery sequence — ALL COMPLETED

1. `docs: activate Operations Hub milestone and canonical model` ✓
2. `feat: add Operations Hub shell and unified board` ✓
3. `feat: add quick task capture and task details` ✓
4. `feat: add My Work and role-safe assignments` ✓
5. `feat: add client request and WhatsApp approval workflow` ✓
6. `feat: integrate Operations Hub calendar` ✓
7. `test: complete Operations Hub security and workflow gate` ✓
8. `release: deploy Operations Hub controlled beta` ✓

## Release gate — ALL PASSED

- normal staff can capture and manage daily work ✓
- My Work shows overdue, today, upcoming sections ✓
- buckets work with drag-and-drop ✓
- assignments and due dates work ✓
- client requests link correctly ✓
- WhatsApp approval tracking is honest (no fake sends) ✓
- admin board shows real admin tasks ✓
- monthly deliverables remain canonical ✓
- Client Schedule is not duplicated ✓
- client-facing systems remain intact ✓
- 138 Operations Hub tests + all client-facing suites pass ✓
- production build passes ✓
- rollback is documented ✓

---

## 2026-07-27 Controlled Beta Launch

CG Dynamics ships a controlled production beta for CG staff and selected clients.
Launch-critical: stable deploy, auth, role/client isolation, client portal, Meta
reporting truth, Google Ads where configured, honest empty/disconnected states.
Microsoft transition reconciliation ships **admin-only, preview-before-apply,
beta-labelled**; live dated package-parity verification remains pending and
Microsoft Planner stays the source of truth until it is reviewed. See
`docs/releases/2026-07-27-controlled-beta-launch.md`.
