---
name: cg-dynamics-feature-implementer
description: Use when implementing a focused CG Dynamics feature safely — a new page, view, drawer, filter or workflow. Invoke before writing feature code so the change stays small, typed and shippable.
---

# CG Dynamics Feature Implementer

Ship one focused feature without breaking the app or duplicating source of truth.

## Before coding

1. `git status`; pull latest `main`; work on a short focused branch.
2. Read the pages/libs you will touch. Match existing patterns (structure,
   Tailwind tokens, drawer/empty-state components).
3. Confirm the data source. Schedule work = `monthly_deliverables` via
   `src/lib/planner.ts`. Never spin up a parallel table or a second source of
   truth.

## While coding

- Reuse shared helpers (`getEffectiveScheduleDate`, `toClientSafeStatus`,
  `normalizeScheduleStatus`) and shared UI (`components/ui`, `ClientPicker`,
  `EmptyState`). Add new shared logic to `lib/planner.ts`, don't copy per page.
- Client-facing surfaces must stay client-safe: no assignees, helper names,
  internal notes, codes, priorities or IDs. Use the `report-*` palette for
  client-ready views, the `brand-*` palette for internal ones.
- Reads/writes go through the typed helpers in `src/lib`. Only write on an
  explicit user action; never auto-write an inferred `client_id`.
- Add empty, loading and error states. Make it mobile-friendly.
- Keep diffs small. Do not refactor unrelated code.

## Design tokens

- Internal UI: `brand-bg`, `brand-surface`, `brand-accent`, `brand-teal`,
  `brand-primary`.
- Client-ready UI: `report-bg`, `report-surface`, `report-line`, `report-text`,
  `report-muted`, `report-accent`, `report-sand`.

## Before finishing

- `npm run build` must pass (remember: verify the bundle contains app code).
- Cross-link new pages to/from the relevant existing ones.
- Commit with a clear message; push only on a green build.
- Report files touched, build result, risks, next steps.
