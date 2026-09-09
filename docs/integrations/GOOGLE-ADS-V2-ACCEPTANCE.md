# Google Ads V2 acceptance evidence — issue #237

Verified 2026-09-09 SAST. Production checks were read-only. No migration, Edge Function, report status, Google Ads, or other production data was changed.

## Cape Lumber canonical truth

| Check | Verified canonical value |
|---|---|
| Account | Customer `4951506884`; shared; active; `ZAR`; `Africa/Johannesburg` |
| Mapping | Campaign `23937664317` → Cape Lumber client `42d9841f-90ac-4ef0-a0f0-7e39f3d8aefa`; active |
| Report | `d335f176-51ea-49f7-b0eb-a98335ec71bb`; 2026-08-01 through 2026-08-31; currently `draft` |
| August | R572.317666 cost (R572.32 display), 5,490 impressions, 151 clicks, 37 conversions, 36.995573246 configured conversion value |
| August activity | 2026-08-25 through 2026-08-31; one mapped campaign |
| September 1–7 | R627.405343 cost (R627.41 display), 6,989 impressions, 191 clicks, 52 conversions, 52 configured conversion value |
| Latest stored activity | 2026-09-08; campaign lifecycle `ENABLED`; channel type `SMART` |
| Sync evidence | July, August and September targeted runs succeeded on 2026-09-08; August/September recorded one mapped and one unmapped discovered campaign |

The numeric benchmarks match #237. The configured conversion value is intentionally not labelled as revenue or formatted as ZAR: Google Ads conversion-action configuration must be verified before assigning that meaning.

## Code acceptance

- Exact calendar period, provider account timezone, and currency are carried through the report-bound V2 RPC.
- Cost remains actual period spend. Budget is an observed campaign setting with explicit daily/custom-period and shared-budget semantics; no pacing percentage or budget-from-spend inference exists.
- `metrics.interactions` is persisted for Google-native conversion-rate semantics. Legacy rows remain unavailable rather than silently using clicks or zero.
- Current lifecycle status, primary serving status/reasons, channel type, bid strategy, campaign dates, budget status/type/delivery and observation time are projected.
- Client RPC access remains report-bound, active-profile checked, published-own-client for client roles, and staff-only for draft reports.
- The client projection removes the provider budget resource name.
- Performance/admin preview and Campaigns render the same component. Automatic generic MoM and currency-formatted conversion value were removed.
- Client Campaigns requests the current tracking month using the latest published report only as its exact-client authorization anchor. Performance remains anchored to the selected report month.
- A client-approved monthly target is dated, versioned, approval-evidenced and manager/admin writable. It is compared only when its currency matches canonical spend.
- Near-live pacing uses the latest stored metric date, calendar days elapsed, and a clearly labelled run-rate projection. It is not a forecast guarantee.
- Seven-day trends compare two exact seven-calendar-day windows only after sync-run coverage proves all 14 days were queried. The serializable weekly-report builder carries the same canonical period, freshness, pacing, performance, campaign and equal-window data; it does not recalculate a parallel set of metrics.

Denis's R4,000/month instruction for September–November and R2,875 for December is not seeded. It is recorded here only as business acceptance context; entering those targets requires the reviewed rollout and approval-evidence workflow, and it provides no authority or code path to mutate Google Ads.

## Required rollout acceptance (not performed)

1. Review and apply `20260908181448_google_ads_v2_native_settings.sql`.
2. Deploy the updated `google-ads-sync` and account/campaign discovery functions together with the app.
3. Run an authorized targeted Cape Lumber sync for the exact acceptance dates.
4. Record each approved monthly CG target through the manager/admin form with its approval evidence. Confirm R4,000 for Sep–Nov and R2,875 for Dec against the client instruction before saving.
5. Verify the live campaign budget snapshot and conversion-action configuration against Google Ads. Existing production rows cannot prove either fact today.
6. Review authenticated admin preview. Publish the draft report only after approval, then review the same canonical data in the Cape Lumber client role.
7. Capture desktop and narrow-mobile screenshots after deployment; a local or preview UI cannot prove production credentials/data rollout.
