---
name: cg-dynamics-repo-auditor
description: Use when auditing routes, build health, dead code, duplicate logic, data flow, TypeScript risks, broken UX, mobile issues, or hidden production problems in CG Dynamics. Invoke before a stabilisation pass or when asked what is broken.
---

# CG Dynamics Repo Auditor

Find what is broken, half-built or duplicated — before writing features.

## What to check

- **Routes** — `src/App.tsx`. Every route resolves to a real page; redirects
  (e.g. `/admin/monthly-planner` → client-schedule) still point somewhere real.
  Flag pages that are imported but half-built, or built but never routed.
- **Build health** — run `npm run build`. Exit 0 is NOT enough: verify the
  emitted `dist/assets/*.js` actually contains app code (grep for a known app
  string like `client-schedule`). Vite 8 silently produced a vendor-only
  bundle; vite is pinned to 7.x. Re-check this if the bundle looks too small.
- **Dead code** — pages/exports nothing imports. Deleting them must keep the
  build green and routes intact.
- **Duplicate logic** — schedule date/status helpers were copied across pages.
  Canonical versions live in `src/lib/planner.ts`
  (`getEffectiveScheduleDate`, `toClientSafeStatus`, `normalizeScheduleStatus`).
- **Data flow** — confirm reads hit the right table. `monthly_deliverables` for
  schedule; `planner_tasks` for Planner Board; `reports`/`posts` for reporting.
- **TypeScript risks** — `noUnusedLocals`/`noUnusedParameters` are on; untyped
  Supabase rows; optional columns from unapplied migrations
  (`docs/pending-supabase-migrations.md`).
- **UX / states** — every list has empty, loading and error states; capped
  lists and "+N more" controls actually work; mobile layouts (drawers, grids).

## Method

1. `git status`, confirm branch and clean tree.
2. Map routes → pages → data libs.
3. Build, then inspect the bundle, not just the exit code.
4. Grep for duplicate helpers and TODO / "after migration" / placeholder.
5. Report findings ranked by user impact, each with file:line and a concrete
   failure scenario. Separate "blocks usability" from "polish".

## Non-goals

Do not fix everything inline during an audit. Produce the ranked list; fix only
what the task explicitly asks for.
