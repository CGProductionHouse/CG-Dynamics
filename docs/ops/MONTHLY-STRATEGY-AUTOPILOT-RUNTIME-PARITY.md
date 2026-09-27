# Monthly strategy autopilot runtime parity — Issue #540

Updated: 27 September 2026

## Problem

Production `monthly-strategy-autopilot` is ACTIVE v5 but its bundled shared logic is older than current main.

Observed production drift:
- live bundle still treats legacy `client_packages` and `monthly_deliverables` as package-readiness authority;
- current main reads canonical `clients.package_settings` through `readPackageAuthority()`;
- live behavior therefore auto-seeded Neshora Oxygen Sep/Oct draft rows with stale `PACKAGE_UNVERIFIED` blockers even though the canonical package had already been confirmed.

This is runtime parity only. Do not redesign the scheduler or strategy contract in this lane.

## Current canonical code

Main authority:
- `supabase/functions/monthly-strategy-autopilot/index.ts`
- `supabase/functions/_shared/monthlyStrategyAutopilot.ts`
- canonical package reader: `src/lib/packageAuthority.ts`

Current main file identities at this checkpoint:
- entrypoint blob: `6bd1d1373ef436046dfd293943546fb3e7c4ef08`
- shared autopilot blob: `cb65c208eb51855921adf88df2dc04b0a4f25e0c`

Live function checkpoint:
- function: `monthly-strategy-autopilot`
- status: ACTIVE
- version: 5
- live bundle hash: `3ae767dd74bf06faf14204b0778cfdb6b1fa6b42425335ee837424fd3e422308`

## Regression contract

The focused parity test must prove:

1. a fully confirmed `clients.package_settings` receipt is sufficient package authority;
2. zero rows in legacy `client_packages` does not create `PACKAGE_UNVERIFIED`;
3. zero rows in `monthly_deliverables` does not invalidate confirmed package capacity;
4. action-plan quantities come from the confirmed package;
5. seed context may truthfully record no legacy monthly-deliverable rows and no legacy package-row ID;
6. existing client/month strategy rows remain untouched;
7. no approval or publication transition is introduced.

## Production-safe redeploy scope

Redeploy only the existing `monthly-strategy-autopilot` Edge Function from current reviewed main.

Do not:
- alter the shared background worker;
- invoke the function as part of deployment;
- delete or rewrite existing Neshora strategy rows;
- apply strategy migrations;
- approve or publish strategy;
- change provider or Content Autopilot settings.

The deployed bundle must include the exact relative dependencies required by the current entrypoint/shared module. Do not reconstruct source from memory; fetch from the reviewed main commit immediately before deployment.

## Pre-deploy checks

- current main is clean and reviewed;
- #540 parity regression passes;
- full focused strategy-autopilot tests pass;
- production function is still the expected stale version/hash or a newer version is independently reconciled before proceeding;
- Neshora exact Sep/Oct strategy IDs remain:
  - Sep: `345ff5dc-a669-4e71-8312-e11472a3494f`
  - Oct: `c4db3ace-ceed-4c8f-99cb-2841edf12613`
- both Neshora rows remain draft, unapproved and unpublished before redeploy.

## Post-deploy acceptance

Read-only only:

- function status ACTIVE;
- deployed source matches reviewed current-main logic;
- canonical package authority path is present;
- old `!packageRow.data || ds.length === 0` readiness gate is absent;
- no duplicate Neshora Sep/Oct rows;
- existing Neshora draft rows remain unchanged by redeploy;
- no strategy approval/publication occurs;
- background-worker ownership is unchanged.

Do not invoke the autopilot merely to prove deployment parity. A separate reviewed runtime invocation should be used only if later explicitly required.
