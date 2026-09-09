# Google Ads V2 — Issue #237

Branch: `codex/google-ads-v2`, based on main `0a50ee6`.

Implemented checkpoints:

- Campaign discovery and sync request Google Ads v25 native campaign, budget and interaction fields.
- Sync persists nullable provider-native interactions and an observed settings snapshot. Required metric fields fail closed instead of becoming false zeros.
- The report-bound V2 projection preserves report period, account timezone/currency, provider status/type and a client-safe settings subset. Provider resource names never cross the client RPC.
- Performance and Campaigns share one canonical Google Ads presentation. Spend and budget are separate, daily and campaign-total budgets are labelled explicitly, conversion value is unitless until configuration is verified, and generic automatic MoM is removed.
- V2 status includes the last successful complete-period sync. Legacy RPC fallback supports a staged migration/Edge rollout.
- A dated, audited CG monthly-target table and manager/admin save RPC keep client-approved targets distinct from Google provider budgets. Near-live tracking adds data-through freshness, spend-to-target, days remaining, a clearly labelled calendar-day projection, and coverage-verified equal seven-day windows.
- `buildGoogleAdsWeeklyReportData` exposes those same canonical seven-day windows as a serializable payload for an automated weekly sender; it does not create a second metric calculation path or send anything by itself.

The settings timestamp remains essential: current configuration is not evidence of the budget on a historical activity date. Existing daily rows remain null until they are refreshed after deployment.

Acceptance evidence is recorded in `GOOGLE-ADS-V2-ACCEPTANCE.md`. No production mutation was authorized or performed.

Provider references:
- https://developers.google.com/google-ads/api/reference/rpc/v25/CampaignBudget
- https://developers.google.com/google-ads/api/reference/rpc/v25/Metrics

Cape Lumber canonical rows were independently verified read-only on 2026-09-09. No known budget is hardcoded or inferred from cost. Live budget and conversion-action configuration still require the reviewed migration/function deployment followed by an authorized targeted API sync.

Denis's instruction of R4,000/month for September–November and R2,875 for December is business acceptance context only. The values are deliberately absent from migration seed data and no Google Ads mutation exists in this implementation. A manager/admin must record each dated target with approval evidence after rollout; changing a CG target still cannot change a Google budget.

## Verification checkpoint — 2026-09-09

- The environment-backed focused Google Ads/client-safety suite passes all 130 assertions. Its V1 assertions now enforce the V2 RPC names and row contract, complete calendar-month boundary, exact current-period loading, client-safe projection, staged legacy fallback, and equal seven-day windows; it does not restore generic MoM.
- `npx tsc -b`, `npm run build`, and `git diff --check` pass. The emitted build contains dedicated Google Ads dashboard, results, campaigns, integration and performance chunks.
- Focused lint passes for the new Google Ads component/libraries/functions and test changes. Changed-file ESLint still reports two baseline findings on unchanged legacy lines: the existing `ClientReportView` memo dependency warning and `Dashboard` synchronous reset effect.
- No production schema/data change, deployment, Google mutation or target seeding was performed.
- Protected Google Ads pages could not be visually accepted without a local authenticated session. The local unauthenticated app/login rendered at desktop and 390×844 with no Vite overlay; authenticated Cape Lumber desktop/mobile acceptance remains a post-deploy gate.
