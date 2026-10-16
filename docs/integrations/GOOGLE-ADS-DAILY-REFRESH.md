# Google Ads daily refresh — #623

**Activated on 16 October 2026.** The reviewed queue constraint was applied as
live migration `20261016104744`; `google-ads-sync` v51/JWT true and
`background-worker` v60/JWT false were deployed, and only the non-secret
`GOOGLE_ADS_REFRESH_ENABLED` flag was enabled. The existing worker token was
confirmed by name only, not read or copied. No new scheduler or Vercel operation.

The successful manual run `b5f7da69-70b1-4826-8faa-873fd3841ce9` covers
11 September–15 October and saved 52 daily rows. Its identical 35-day coverage
suppresses another daily job today. Existing worker calls returned HTTP 200;
the first future scheduled provider call is **not yet observed**, so activation
is not a claim of completed daily-run acceptance. See
`../ops/INTEGRATION-RELEASE-2026-10-16.md` for release and rollback receipts.

The existing background worker had no Google Ads cadence, so a successful manual
refresh could become stale indefinitely. The new `google_ads_refresh` job uses
that same worker and durable queue. There is no new scheduler or Vercel work.

When `GOOGLE_ADS_REFRESH_ENABLED=true`, each worker pass can queue at most two
accounts. Each account gets one unique job per Johannesburg day, with up to three
queue attempts and existing backoff. Terminal daily keys are not recreated.
Automatic provider calls make one attempt each (10-second timeout); the queue
owns retries. The internal dispatch times out after 45 seconds.

Only active, configured accounts with an unambiguous active-client mapping are
eligible. Dedicated accounts require one active client and no campaign mapping;
shared accounts require active mapped clients, no dedicated mapping and no
conflicting campaign ownership. Inventories are paginated. Missing account time
zones, identities, or unreadable inventories admit no work. Recent running syncs
and successful coverage of the same range suppress duplicate queueing.

The window is the last 35 complete **account-local** days, excluding today. It
covers recent reporting and delayed conversions without repeated historical
backfills. A job carries the exact canonical account ID, customer ID, time zone,
operating day and date range. The sync endpoint checks these again before provider
access, so changed account identity or stale jobs fail before a metrics write.

Internal invocation requires both the service bearer and the existing worker
token. Manager invocation retains its existing authorization. Gateway JWT
verification stays enabled for `google-ads-sync`. HTTP 200 or an account-level
connection alone cannot complete the job: the inner response must confirm one
exact successful account, range and canonical run. A verified empty provider
response is an account sync success; it is **not** proof that each mapped client
has campaign rows. Existing client/report availability rules remain authoritative.

The only metrics write is the existing transactional
`replace_google_ads_account_campaign_metrics` RPC. No mapping, ad setting,
campaign, package, strategy or report publication changes.

## Protected activation procedure (executed 16 October; do not replay)

1. Review/apply only `20261016075631_google_ads_daily_refresh.sql`. This admits
   the system job type; it adds no browser write grant or cron and changes no
   manager enqueue RPC. Never use a broad `db push`.
2. Deploy the reviewed `google-ads-sync` and `background-worker` from one commit,
   preserving their current JWT contracts (`true` and `false`, respectively).
3. Confirm the existing private `WORKER_INTERNAL_TOKEN` is present for both.
   Keep `GOOGLE_ADS_REFRESH_ENABLED` absent/false until activation is authorized.
4. Under activation authority set that flag true, then passively observe the
   existing worker: one exact daily queue key, canonical sync run and terminal
   result. Repeated minute ticks must not create duplicate keys.
5. Check Cape Lumber's stored dates/facts and keep no-row clients classified as
   no rows. A failed provider call must retain last successful facts and show
   failed freshness. Do not claim new live evidence from local fixtures.

Rollback: set `GOOGLE_ADS_REFRESH_ENABLED=false`. Queued refresh jobs then finish
with an explicit disabled result and do not call the provider. Existing metrics
and manual manager sync remain available; no deletion or migration reversal is
needed. Activation uses Supabase only; it has no Vercel dependency.
