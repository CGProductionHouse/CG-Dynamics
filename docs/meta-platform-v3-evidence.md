# Meta platform v3 — issue #236

Owner: Codex. Branch: `codex/meta-platform-v3`. Integrated with main `0a50ee6`.
This is an implementation and browser-acceptance record. Production rollout remains gated.

## Cape Lumber — August 2026

Observed in authenticated Meta Business Suite Results and CG Dynamics on 8 September 2026.
The Results date picker says dates are Pacific Time. Compare 1–31 August only.
Meta Overview displayed an August header while its inner Performance section still
showed 10 August–6 September. That section is not August evidence.

| Platform / source measure | Meta August | Stored API fact | Assessment |
| --- | ---: | ---: | --- |
| Facebook Views | 20,156 | 20,156 | All 31 daily values match |
| Facebook Content interactions | 1,163 | — | Exact API equivalent not yet established |
| Facebook Post engagements | Different measure | 1,275 | Must retain this name; includes broader engagement |
| Facebook Viewers | 8.1K rounded | unavailable | Daily uniques sum to 10,468; that is not monthly viewers |
| Facebook Visits | 249 | 249 | Match |
| Facebook Follows | 5 | 5 | Match |
| Facebook Link clicks | 4 | not collected | Pending verified connector mapping |
| Instagram Views | 1,408 | 1,408 | Native Instagram portion; Meta also displays 7,660 Facebook views |
| Instagram Reach | 305 | 305 | Match |
| Instagram Content interactions | 74 | 74 | Match |
| Instagram Profile visits | 20 | 20 | Match |
| Instagram Follows | 9 | 9 | FOLLOWER breakdown component |
| Instagram Unfollows | Not independently checked in UI | 2 in raw response | NON_FOLLOWER component; parser coverage added |

Current follower snapshots (Facebook 2,215; Instagram 903) are latest-sync
snapshots, not August net growth. Paid/organic splits, exact monthly viewers,
content counts and Facebook unfollows/net follows remain unverified.

## Implementation and rollout ledger

- Actual response shape retained, including successful responses that cannot
  produce a valid total. Unique daily series never added into monthly audiences.
- Daily sum requires exactly the expected Pacific ending buckets, including DST.
- Post engagements separated from Content interactions; reconstructed post sums
  removed as an account interaction substitute. Page likes no longer substitute
  for follower count.
- Client overview groups by Facebook/Instagram; normal admin preview shares it.
- Unavailable facts remain visible with an em dash and a source/permission/error
  explanation. Facebook viewers therefore no longer disappears or becomes zero.
- Cooldown/heartbeat-aware progress replaces false stall inference.
- Scheduled sync resolves only the client-mapped Page token and verifies the
  returned Page and linked Instagram identities before using it. Global Page
  discovery remains an onboarding operation.
- Lease-generation fencing, atomic report/post/fact writes, per-metric resume
  checkpoints and scoped rate-limit cooldowns are prepared with one worker lane
  by default until live acceptance proves safe capacity.
- Queue items carry their exact linked asset and workload class. Terminal
  Facebook/Instagram checkpoints update per-asset high-water marks in the same
  lease-fenced transaction as page progress, so an expired worker cannot
  overwrite a newer attempt.
- Meta connection health reads only Facebook and Instagram verified runs. This
  prevents another provider in the shared canonical run table from being shown
  as Meta's latest verified insight.
- Native metric registry migration prepared, not applied. No historical facts
  rewritten and no production deployment or sync performed in this lane yet.
- Production build, changed-file ESLint and 173 Meta/backend/navigation/mobile/
  route-recovery tests pass. The fencing and incremental-checkpoint SQL tests pass
  against isolated local Supabase; all five migrations execute successfully in
  rolled-back local transactions.

## Remaining full mission

1. Apply the prepared schema and Edge Function checkpoint under explicit
   production rollout approval, then run one controlled Cape Lumber incremental
   sync and verify per-asset health plus stale-lease behavior.
2. Re-run authenticated admin and client acceptance after the Supabase function
   deployment. The latest Vercel frontend preview is healthy, but it correctly
   continues to call the currently deployed production Edge Function.
3. Publishing must consume approved immutable content_review_versions and existing
   monthly_deliverables scheduling. Add idempotent receipts, provider-state
   reconciliation and Instagram container lifecycle. No parallel scheduler and no
   live publication without explicit authorization.
4. Expand to other clients only after Cape Lumber production acceptance. TikTok is separate.

## Connector evidence

Official Meta Instagram collection:
https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api

It documents direct Page token retrieval, linked professional accounts, media
container publishing and cursor pagination. Instagram result ordering is not
supported generally; a stop-at-old-item shortcut is not an established guarantee.
Meta Developers pages returned HTTP 429 during research; verify current Graph
v25 endpoint requirements before rollout. No new production dependency added.

## Authenticated preview acceptance — checkpoint `af09e1e`

Verified in the user's signed-in Chrome session against Meta Results and the PR
#240 Vercel preview:

- Both selectors show 1–31 August 2026.
- Facebook-only and Instagram-only report tabs contain no metrics from the other
  platform; the overview groups both platforms without combining their totals.
- Facebook values/labels: Views 20,156; Viewers unavailable; Post engagements
  1,275; Follows gained 5; Page visits 249.
- Instagram values/labels: Views 1,408; Reach 305; Content interactions 74;
  Profile visits 20; Follows gained 9. Meta's 9.1K Views overview was correctly
  rejected as the Instagram native value because it breaks down to 7,660
  Facebook views plus 1,408 Instagram views.
- Instagram link clicks is a provider-confirmed `valid_zero`, so its displayed 0
  is evidence-backed rather than a missing-value fallback.
- Admin report and normal client preview render the same canonical fact values.

The staff connector table exposed one new wording defect: complete facts inherited
the platform run's partial state as the vague phrase “Partial, error or stale”.
Checkpoint `494eb75` replaces it with the exact run and health states.

Authenticated Chrome acceptance was repeated after current main was integrated:

- Meta Results remained on Instagram, 1–31 August 2026: native Instagram Views
  1,408, Reach 305, Content interactions 74, Link clicks 0, Profile visits 20,
  and Follows 9. The combined 9.1K overview still breaks down to Facebook 7,660
  plus Instagram 1,408 and is not used as the Instagram-native value.
- PR preview August Overview and its separate Facebook and Instagram tabs retained
  the exact values above; Facebook showed Views 20,156, Viewers as an em dash with
  “Unavailable from the connected Meta source”, Post engagements 1,275, Follows
  gained 5 and Page visits 249. No Instagram metric appeared on the Facebook tab
  and no Facebook metric appeared on the Instagram tab.
- The staff-only health table shows the exact provider run state, for example
  `Platform run: partial · verified partial`, instead of the former vague wording.
- Admin Preview and Client View render the same canonical report component and
  values. Staff-only connector details remain marked internal.
- A live defect was found on the integration screen: `Last verified insight`
  displayed `tiktok`. Commit `6fdced8` constrains that query to Facebook/Instagram
  and adds regression coverage. The new Vercel preview builds successfully, but
  browser verification of this server-side fix requires deploying the corrected
  `meta-connection-status` Edge Function; the preview still calls the currently
  deployed function and therefore reproduces the old `tiktok` value as expected.

## Connection diagnostics checkpoint

- Meta tokens are introspected server-side through Meta's documented
  `/debug_token` endpoint at connection time and at most once per 24 hours when
  staff open connection health.
- Token type, token expiry, data-access expiry, validation state and last check
  are stored beside the server-only credential. Only sanitized lifecycle status
  reaches the manager UI; token/app-secret values remain server-side and are
  redacted from failures.
- An invalid token, expired token or expired data access becomes an explicit
  reconnect state. A transient validation failure remains `unverified` instead
  of being falsely called revoked.
- Linked client rows now report the last Facebook and Instagram run separately,
  including run type, period and current/stale/attention state. A missing run is
  displayed as “no durable checkpoint recorded” or “refresh diagnostics
  unavailable” according to schema availability, without implying success.
- Meta connection, asset linking and sync mutations now use the current
  admin/manager role contract consistently.
- Migration `20260908130000_meta_token_lifecycle_diagnostics.sql` was syntax
  checked in a rolled-back local database transaction. It has not been applied
  to production, and no token, secret, permission or production data changed.

## Production rollout gate

The next step mutates production and was not performed in this lane. The minimum
controlled read/reporting rollout is:

1. Apply, in order, `20260908100000_meta_native_metric_identity.sql`,
   `20260908110000_meta_sync_parallel_lane_safety.sql`,
   `20260908120000_meta_sync_fencing_and_idempotency.sql`,
   `20260908130000_meta_token_lifecycle_diagnostics.sql`, and
   `20260908140000_meta_incremental_asset_checkpoints.sql`.
2. Deploy the changed Meta read/sync functions and shared modules only. Do not
   deploy or enable a publishing path as part of this checkpoint.
3. Confirm existing Meta secrets and permissions without rotating or expanding
   them. Keep worker concurrency at one.
4. Run a selected-client August 2026 Cape Lumber reconciliation through the normal
   queue, then verify terminal per-asset checkpoints, exact retry/cooldown wording,
   Facebook/Instagram health rows, and identical facts in admin and client views.

Rollback boundary: revert Edge Functions to their prior deployment and stop new
enqueues. The migrations are additive and historical metric facts are not
rewritten; do not drop new audit/checkpoint objects or destructively roll back facts.
