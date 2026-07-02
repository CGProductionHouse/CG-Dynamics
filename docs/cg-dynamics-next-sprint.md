# CG Dynamics — next sprint

Short, ordered plan for the next highest-impact work. Each task: goal, files,
scope, non-goals, acceptance, validation.

## 1. Verify deployed build after the Vite downgrade

- **Goal:** confirm production deploys correctly on vite 7 (not the vite-8
  blank bundle).
- **Files:** none (ops / Vercel).
- **Scope:** deploy the branch; load login + `/admin/client-calendar` live;
  check Vercel build logs.
- **Non-goals:** config changes, vite 8 retry.
- **Acceptance:** deployed app renders; bundle contains app code.
- **Validation:** open the deployed URL; `npm run build` locally green.

## 2. Merge / review the client-ready calendar branch

- **Goal:** get `claude/admin-nav-zones-ami91e` (vite fix + calendar + dead-code
  removal) reviewed and merged to `main`.
- **Files:** review the branch diff.
- **Scope:** run the agent-reviewer checklist; open/merge PR.
- **Non-goals:** new features in the PR.
- **Acceptance:** review passes; `main` builds and contains app code.
- **Validation:** `npm run build` on merge result.

## 3. Client Schedule cleanup

- **Goal:** one definition of the schedule display helpers; URL-synced state.
- **Files:** `ClientSchedulePage.tsx`, `CgHubPage.tsx`, `PlannerPage.tsx`,
  `lib/planner.ts`.
- **Scope:** replace local copies of `getEffectiveScheduleDate` / status-tone
  with the `lib/planner.ts` exports; sync month/client to URL params.
- **Non-goals:** visual redesign, schema changes.
- **Acceptance:** behaviour identical; single helper definitions.
- **Validation:** `npm run build`.

## 4. CG Hub daily-use pass

- **Goal:** staff open the Hub and act without hunting.
- **Files:** `CgHubPage.tsx`.
- **Scope:** Today Focus tiles link to pre-filtered views (carry
  `client`/`month`/`mode`); add a "Client calendars" quick row.
- **Non-goals:** new data sources.
- **Acceptance:** every tile navigates somewhere useful.
- **Validation:** `npm run build`; click-through.

## 5. Performance Dashboard cleanup

- **Goal:** the dashboard clearly surfaces what needs attention.
- **Files:** `ClientPerformancePage.tsx`, `lib/reportPeriod.ts`,
  `lib/strategyEngine.ts`.
- **Scope:** tighten the attention list (ready-to-publish, needs-strategy,
  needs-repair), fix any dead links.
- **Non-goals:** new reporting features.
- **Acceptance:** states are accurate against real reports.
- **Validation:** `npm run build`; review with data.

## 6. Meta diagnostics pass

- **Goal:** clear, honest connection status when Meta is mis-configured.
- **Files:** `IntegrationsPage.tsx`, `MetaIntegrationPage.tsx`,
  `supabase/functions/meta-connection-status`.
- **Scope:** surface actionable states (disconnected / no assets / token
  expired) without exposing secrets.
- **Non-goals:** changing the OAuth flow.
- **Acceptance:** status reflects reality; no secret leakage.
- **Validation:** `npm run build`; live check.

## 7. Assistant live-data plan (planning only)

- **Goal:** a written plan to feed real `planner_tasks` /
  `monthly_deliverables` summaries into `cg-assistant-chat`.
- **Files:** doc only (plan); later `lib/assistant.ts`, the Edge Function.
- **Scope:** define which summaries, which role guardrails, what data the
  function may read.
- **Non-goals:** building agents; live wiring before core workflow is stable.
- **Acceptance:** a reviewed plan exists.
- **Validation:** n/a (doc).
