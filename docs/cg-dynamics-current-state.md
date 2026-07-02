# CG Dynamics — current state

Snapshot of the app as it stands in the repo. Descriptive only.

## Stack

- React 19 + TypeScript + Vite (pinned to **vite 7.x**), Tailwind (custom
  `brand-*` and `report-*` tokens), React Router 7.
- Supabase (untyped client) for data + auth; Edge Functions for privileged
  work (Meta, CG Assistant).
- Build: `npm run build` = `tsc -b && vite build`. `noUnusedLocals` /
  `noUnusedParameters` on.

> **Build note:** vite 8 (rolldown) silently emitted a vendor-only production
> bundle (all `src/` code tree-shaken out → blank app). Vite is pinned to 7.x
> until that is resolved. Verify the built bundle contains app code, not just a
> green exit.

## Routing (`src/App.tsx`)

Staff area under `/admin` (guarded), client area at `/dashboard`.

- **Client Intelligence** — `/admin/client-performance`, `/admin/clients`,
  `/admin/reports`, `/admin/published` (Client Preview), `/admin/client-calendar`
  (client-ready content calendar), `/admin/integrations` (+ `/meta`).
- **Operations Hub** — `/admin/cg-hub`, `/admin/command-centre` (Daily Tasks),
  `/admin/planner`, `/admin/client-schedule`, `/admin/cg-calendar`,
  `/admin/package-master`.
- Legacy redirects: `/admin/monthly-planner` and `/admin/master-schedule` →
  Client Schedule views. `/admin/company-calendar` → `/admin/cg-calendar`.
- Client dashboard: `/dashboard` shows published monthly reports.

## Schedule domain

- `monthly_deliverables` is the source of truth.
- **Client Schedule** (`ClientSchedulePage.tsx`) — operational editor; Grid /
  Board / Calendar / Charts / Year views; shared helpers in `lib/planner.ts`.
- **Client-ready content calendar** (`ClientContentCalendarPage.tsx`) — new
  read-only presentation layer; client-safe statuses/badges; "Preview as
  client" and "Edit in Client Schedule" links.

## Other areas

- **CG Hub** — Today Focus (priority queue, scheduled today, my work, quick
  add). Needs a daily-use pass so tiles land on pre-filtered views.
- **Daily Tasks / Planner Board** — `planner_tasks`; separate from Client
  Schedule. Live Teams/Planner import has run.
- **Performance Dashboard / Reports** — driven by `reports` + `posts`; Client
  Preview mirrors the client report view. Needs a cleanup pass.
- **Meta / Integrations** — connection status and asset counts via Edge
  Functions (`meta-connection-status`, `meta-*`). Needs a diagnostics pass.
- **CG Assistant** — talks to the `cg-assistant-chat` Edge Function with
  role-aware guardrails; not yet wired to real planner/deliverable data for
  useful summaries.

## Recently changed (branch `claude/admin-nav-zones-ami91e`, not yet merged)

- Fixed the vite-8 broken-bundle issue (pinned vite 7 + plugin-react 5).
- Added the client-ready content calendar (`/admin/client-calendar`).
- Removed dead `MonthlyPlannerPage` and `MasterSchedulePage` (~2,100 lines).
- Prepared Supabase seed SQL (calendar 2026 Monday + one-off events) — NOT
  applied live.

## Known gaps / risks

- Several Supabase migrations are PREPARED but unapplied
  (`docs/pending-supabase-migrations.md`): staff status RLS, client-request
  package link, helpers, timer. Optional columns may be absent at runtime.
- Bundle is one large chunk (xlsx-heavy) — code-splitting outstanding.
- Duplicate schedule helpers still exist in a couple of pages pending cleanup.
- Client-login access to the content calendar needs a read RLS migration before
  it can appear on `/dashboard`.
- Reference trackers: `docs/cg-dynamics-product-goals.md`,
  `docs/cg-dynamics-outstanding-audit.md`.
