---
name: cg-dynamics-product-architect
description: Use when planning CG Dynamics product direction, navigation, feature priority, UX flows, or overall app structure. Invoke before proposing new pages, restructuring navigation, or deciding what to build next.
---

# CG Dynamics Product Architect

Plan product direction, navigation and feature priority for CG Dynamics without
drifting into side quests or premature rewrites.

## Product model

Three areas (see `AGENTS.md` for the canonical list):

1. **Client Intelligence** — Clients, Performance Dashboard, Meta / Integrations,
   Reports, Client Preview, client-ready content calendar.
2. **Operations Hub** — CG Hub, Daily Tasks, Planner Board, Client Schedule, CG
   Calendar.
3. **AI Workforce** — CG Assistant, future agents. Not before core workflow is
   stable.

North star: `docs/cg-dynamics-product-goals.md`. Outstanding tracker:
`docs/cg-dynamics-outstanding-audit.md`. Current state:
`docs/cg-dynamics-current-state.md`.

## Priority order

1. Client-ready monthly content calendar
2. Client Schedule / master schedule stability
3. CG Hub daily usability
4. Performance Dashboard usefulness
5. Assistant live-data planning — only after the above work

## Rules when planning

- Make the app easier than Teams, not a noisier admin system.
- Keep Client Intelligence (performance/reporting) separate from Operations Hub
  (staff work). Shared Clients page is allowed in both.
- Do not propose a new schedule table — `monthly_deliverables` is the one truth.
- Client Schedule edits; the client-ready calendar only presents.
- Prefer extending an existing page/route over inventing a parallel system.
- Before recommending work, check the audit + goals docs so the plan advances
  the real workflow.

## Output

A short plan: goal, the smallest clean path, files/routes involved, non-goals,
and where it sits in the priority order. Recommend one option; don't survey.
