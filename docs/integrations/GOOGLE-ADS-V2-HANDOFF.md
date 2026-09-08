# Google Ads V2 — Issue #237

Branch: `codex/google-ads-v2`, based on main `0a50ee6`.

First checkpoint: campaign discovery includes v25 native budget/settings with an observation timestamp. This is current configuration, not evidence of the budget on a historical activity date. Daily and total budgets remain separate; shared budget is explicit; missing fields are null.

Next checkpoint: persistence/migration, report-bound projection, shared Campaigns/Performance rendering, removal of generic MoM, null-safe metrics and Cape Lumber regression evidence. No production mutation is authorized or performed.

Provider references:
- https://developers.google.com/google-ads/api/reference/rpc/v25/CampaignBudget
- https://developers.google.com/google-ads/api/reference/rpc/v25/Metrics

Cape Lumber benchmark supplied in #237 (not a fresh live API acceptance): customer 4951506884, campaign 23937664317, Africa/Johannesburg, ZAR. August 1–31: R572.32, 5,490 impressions, 151 clicks, 37 conversions; activity Aug 25–31. September 1–7: R627.41, 6,989 impressions, 191 clicks, 52 conversions. No known budget should be hardcoded from these costs.
