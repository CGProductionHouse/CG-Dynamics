# Meta platform v3 — issue #236

Owner: Codex. Branch: `codex/meta-platform-v3`. Baseline: main `ef79234`.
This is an active implementation record, not production acceptance.

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
- Cooldown/heartbeat-aware progress replaces false stall inference.
- Native metric registry migration prepared, not applied. No historical facts
  rewritten and no production deployment or sync performed in this lane yet.
- First build and 62 tests passed before the additional coverage/registry work;
  rerun required before committing those additions.

## Remaining full mission

1. Finish same-window parity evidence, secure exact-metric probes and native
   labels/availability on all report surfaces. Do controlled Cape Lumber resync
   only after required production deployment approval; verify admin and client.
2. Adapt #202 lease-generation fencing, atomic post/metric checkpoints and bounded
   dispatch. Its mock throughput is not live Meta throughput. Do not import its
   unrelated branch changes or enable assumed Instagram ordering.
3. Retain usage headers/Retry-After and distinguish app, business, account and
   transport waits. Narrow token retrieval to the mapped Page.
4. Continuous sync must use durable per-asset checkpoints and separate historical
   workloads; supported webhook events trigger reconciliation, not invented facts.
5. Verify mapped identities, token validity/expiry and granted scopes; implement
   Business Login/reconnection diagnostics without disclosing credentials.
6. Publishing must consume approved immutable content_review_versions and existing
   monthly_deliverables scheduling. Add idempotent receipts, provider-state
   reconciliation and Instagram container lifecycle. No parallel scheduler and no
   live publication without explicit authorization.
7. Expand to other clients only after Cape Lumber acceptance. TikTok is separate.

## Connector evidence

Official Meta Instagram collection:
https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api

It documents direct Page token retrieval, linked professional accounts, media
container publishing and cursor pagination. Instagram result ordering is not
supported generally; a stop-at-old-item shortcut is not an established guarantee.
Meta Developers pages returned HTTP 429 during research; verify current Graph
v25 endpoint requirements before rollout. No new production dependency added.
