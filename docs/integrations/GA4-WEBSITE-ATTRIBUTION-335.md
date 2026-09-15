# Google Ads + GA4 website attribution (#335)

Extends the merged Google Ads V2 work (#237 / PR #270). Google Ads V2 remains provider truth for
Ads metrics; nothing in this lane recalculates them.

## Verified provider contracts

Checked against official Google documentation on **2026-09-10**.

### GA4 Data API schema
Confirmed present in the schema reference: `sessionCampaignId`, `sessionCampaignName`, `landingPage`,
`eventName`, `linkUrl`.

**Not confirmed** in that reference: session-scoped Google Ads dimensions
(`sessionGoogleAdsCampaignId`) and the session source/medium trio.

Because of that — and because GA4 property schemas legitimately differ, since custom dimensions and
key events are per-property — **every field is validated at request time against the property's own
`getMetadata` response**. Unsupported fields degrade to `unavailable`, never to a fabricated zero and
never to an invalid API request. This is the correct design regardless of what the reference lists.

### ValueTrack (Final URL suffix)
`{campaignid} {adgroupid} {creative} {device} {network} {matchtype} {keyword}` all exist.

**Critical restriction:** `{keyword}` *"returns a blank value"* where the ad matches without keywords
— **AI Max for Search, Dynamic Search Ads and Performance Max**. `{matchtype}` returns `a` for AI Max
keywordless.

The convention suggested in #335 includes `utm_term={keyword}`. Applied blindly to PMax/DSA that
silently emits an **empty `utm_term`**, which reads as missing data rather than "not applicable". So
the recommended suffix is campaign-type aware:

| Campaign type | Recommended suffix |
|---|---|
| `SEARCH` | `utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content={creative}&utm_term={keyword}` |
| `PERFORMANCE_MAX` | `utm_source=google&utm_medium=cpc&utm_campaign={campaignid}` |
| others | as Search, without `utm_term` |

`{campaignid}` is never dropped — it is the join key back to Google Ads.

## Architecture

```
clients.id
  → google_ads_account_links / google_ads_campaign_links   (existing, exact)
  → client_ga4_properties                                   (new, exact, one active per client)
  → client_website_domains                                  (new, exact, one client per domain)
  → client_cta_event_definitions                            (new, CG CTA taxonomy)
```

| Layer | File |
|---|---|
| Attribution truth rules | `supabase/functions/_shared/ga4-contract.ts` (+ app copy `src/lib/ga4Contract.ts`) |
| Tracking contract | `supabase/functions/_shared/google-ads-tracking-contract.ts` (+ app copy) |
| GA4 Data API adapter | `supabase/functions/_shared/ga4-data-api.ts` |
| Provider read path | `supabase/functions/ga4-website-report/index.ts` |
| Canonical projection | `src/lib/websiteAfterClick.ts` |
| Client UI | `src/components/client/WebsiteAfterTheClick.tsx` |
| Setup health (staff) | `src/components/admin/TrackingSetupHealth.tsx` |
| Mapping schema | `supabase/migrations/20260910180000_client_ga4_mapping.sql` **(prepared, NOT applied)** |

### Client / admin parity
`ClientReportView` computes the projection **once** in a `useMemo` and passes that same value to the
Google Ads overview and the Google Ads tab. Admin Preview renders `ClientReportView`, so parity is
structural rather than a convention. Tests assert exactly one `buildWebsiteAfterClickProjection`
call site there, and that `PublishedPreview` does not render its own copy of the section.

### Truth rules (all tested)
- Ads clicks and GA4 sessions keep separate provider labels and are never reconciled 1:1. Funnel
  stages are not clamped to look monotonic; the variance is explained.
- Organic google traffic can never be counted as paid (medium list is `cpc`/`ppc`/`paid`, and the
  generic `sessionCampaignId` fallback is always paired with a paid source/medium filter).
- CTA truth: expected-but-missing → `setup_required`; unexpected missing → `not_tracked`; GA4
  unreachable → `unavailable`; a tracked event reporting a real `0` shows `0`. **No path fabricates a
  zero.**
- Conversion rate only from a same-provider numerator/denominator with a positive denominator.
- Differing Ads/GA4 timezones are surfaced rather than implying an exact comparison.
- A rate metric is never summed across rows.

## Cape Lumber acceptance — current state

Read-only production inspection, 2026-09-10:

| Check | Result |
|---|---|
| Google Ads campaign link | **Present** — campaign `23937664317` |
| Google Ads account link | **Absent** |
| `google_ads_campaign_daily_metrics` rows | **Zero** |
| GA4 property mapping | **Table does not exist yet** (migration prepared, not applied) |
| GA4 credentials | **Not configured** (`GOOGLE_ANALYTICS_*` unset) |

Zero Ads rows is consistent with PR #270's note that daily rows stay null until an authorised
post-deploy sync. **A live field-by-field Ads↔GA4 proof is therefore blocked by provider state, not
by code.** The implementation is complete and proven against deterministic fixtures instead of
inventing data.

## Exact steps required for the live Cape Lumber proof

All CA-gated. None performed.

1. **Apply the mapping migration** `20260910180000_client_ga4_mapping.sql` to production.
2. **Record Cape Lumber's mapping** — insert one active row in `client_ga4_properties` with the real
   numeric GA4 property id, and one active `client_website_domains` row for the approved domain.
   (Constraints make a wrong or duplicated mapping structurally impossible.)
3. **Create GA4 API credentials** and set `GOOGLE_ANALYTICS_CLIENT_ID`, `GOOGLE_ANALYTICS_CLIENT_SECRET`
   and `GOOGLE_ANALYTICS_REFRESH_TOKEN`. The refresh token needs
   `https://www.googleapis.com/auth/analytics.readonly` and the credential's Google account needs at
   least Viewer on that GA4 property. **Do not reuse the Google Ads credential** — the function
   deliberately does not read it.
4. **Deploy** `ga4-website-report`.
5. **Run an authorised Google Ads sync** for the target period so
   `google_ads_campaign_daily_metrics` has rows and the Ads half of the funnel is non-null.
6. **Verify the Ads↔GA4 link and auto-tagging** in the Google Ads account (read-only inspection
   first). If auto-tagging is off, enabling it is a separate CA decision — the join then falls back
   to `sessionCampaignId` + paid source/medium, which the code already supports.
7. **Record CTA taxonomy** in `client_cta_event_definitions` for the actions Cape Lumber cares about.
   Anything not instrumented will correctly show `Setup required` rather than `0`.
8. **Then run the field-by-field proof** for one exact period: Ads impressions/clicks/spend unchanged
   against Google Ads UI, GA4 sessions shown separately, landing pages present, CTA availability
   truthful, and the same values in Admin Preview and the client portal.

## Gates respected in this lane

No production SQL applied · no Edge Function deployed · no Google credential or scope created or
changed · no Ads account, campaign, tracking-template, Final-URL-suffix, auto-tagging or Ads↔GA4
link change · no client analytics data mutated · no Vercel production promotion.
