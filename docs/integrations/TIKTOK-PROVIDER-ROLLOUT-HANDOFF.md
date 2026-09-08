# TikTok provider rollout handoff

Last verified: 2026-09-08 (Africa/Johannesburg)

GitHub lane: Issue #238 / draft PR #239, branch `feat/tiktok-v1-provider`

## Current code checkpoint

- Current pushed head before this rollout checkpoint: `3e36fe67`.
- Read-only OAuth requests `user.info.basic`, `user.info.profile`, `user.info.stats`, and `video.list`.
- `video.publish` is added to OAuth and connection-health requirements only when `TIKTOK_PUBLISHING_ENABLED=true`.
- Provider writes remain fail-closed unless that flag is exactly `true`.
- The integration page describes the active rollout as read-only and no longer tells staff that Content Posting API or publishing is part of the configured sandbox.
- Public, unauthenticated `/privacy-policy` and `/terms-of-service` routes are implemented locally for the provider application and linked from the landing and sign-in pages.
- The live rollout exposed and fixed two contract defects: the metric seed now supplies the live non-null `comparable_group`, and `tiktok-sync` now creates and finalizes a valid canonical `platform_sync_runs` checkpoint before writing facts.
- Validation after the checkpoint fix: 80/80 focused tests passed; final build, focused ESLint, and diff checks are recorded in the PR checkpoint.

## Live TikTok Developer Portal truth

- Developer account: `info@cgproductionhouse.com`.
- Organization: **CG Production House**.
- Organization ID: `7683120909015827464`.
- Organization role: Owner.
- App: **CG Dynamics**.
- App ID: `7683117164207933447`.
- Production state: Draft; never submitted for review.
- Sandbox: **CG Dynamics Read-Only QA**.
- Sandbox ID: `7683127505863264274`.
- Sandbox was created on 2026-09-08 with explicit CA approval.
- Never copy client keys or secrets into this document or GitHub.

## Sandbox configuration saved in the live portal

Verified again in the authenticated TikTok Developer Portal after CA completed the browser actions:

- Category: Business.
- Description: `CG Dynamics manages client social performance, content approvals, analytics, and approved publishing workflows.`
- Platform: Web.
- Web URL: `https://www.cgdynamics.co.za`.
- Product: Login Kit.
- Redirect URI: `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/tiktok-oauth-callback`.
- Scopes: `user.info.basic` (included by Login Kit), `user.info.profile`, `user.info.stats`, and `video.list`.
- Content Posting API is intentionally absent from the read-only sandbox.
- Terms URL: `https://www.cgdynamics.co.za/terms-of-service`.
- Privacy URL: `https://www.cgdynamics.co.za/privacy-policy`.
- Target user: `cgproductionhouse`, added 2026-09-08 at 17:14 portal time.

The sandbox form shows no validation error. The app icon is present, the configuration is saved, and the target account is authorized. Provider-side read-only sandbox setup is complete.

## Live Supabase read-only rollout

CA approved the bounded read-only rollout. The following changes were completed in project `ehtjfntukiwbgptqgbzy` on 2026-09-08:

1. Apply `supabase/phase-5a-tiktok-provider-foundation.sql`.
2. Apply `supabase/phase-5b-tiktok-metric-registry.sql`.
3. Apply `supabase/phase-5c-tiktok-client-mapping.sql`.
4. Configured `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, and `TIKTOK_REDIRECT_URI` as Edge Function secrets. Secret values were never written to the repository or GitHub. `TIKTOK_PUBLISHING_ENABLED` remains unset.
5. Deployed only `tiktok-oauth-start`, `tiktok-oauth-callback`, `tiktok-connection-status`, and `tiktok-sync`. The first three are version 1; final accepted `tiktok-sync` is version 3. The callback has JWT verification disabled for the provider redirect; the other three have JWT verification enabled and also enforce admin/manager access in function code.

Phase 5a applied successfully. The first phase 5b attempt was rejected atomically because the live `metric_registry.comparable_group` column is non-null while the seed supplied null for some metrics. The branch seed was corrected to use `tiktok_organic` for video facts and `tiktok_profile` for profile snapshots, matching `tiktok-sync`; no partial phase 5b rows were inserted by the failed statement. The corrected phase 5b and phase 5c then applied successfully. All five provider tables have RLS enabled. Token and OAuth-state tables have no client policies; service-role functions are their only access path.

The first real sync exposed a second live-only defect. The TikTok function inserted `health_state='partial'`, which is outside the canonical sync-run constraint, then continued without an id. Supabase-js omitted the undefined `p_sync_run_id`, so PostgREST could not resolve the 19-argument fact RPC. The function now uses the canonical run fields and health values, checks the insert result, fails closed without a durable checkpoint, and stores truthful snapshot notes in fact provenance. Version 3 of `tiktok-sync` was deployed for final acceptance.

## Production draft state

The production browser tab contains unsaved exploratory values. Treat these as uncommitted UI state, not provider truth:

- Business category, description, Web platform, Web URL, exact callback, Login Kit, and read scopes were entered.
- Content Posting API was temporarily added for inspection. Direct Post was switched back off.
- Before any production save, remove Content Posting API from this app unless TikTok confirms this developer product is appropriate for CG's agency use case.
- `cgdynamics.co.za` is not verified in TikTok URL Properties.
- Production review has not been submitted.

Production prerequisites still missing:

1. Deploy the implemented public, unauthenticated CG Dynamics Terms of Service and Privacy Policy pages before the provider URLs are relied on for production review.
2. Domain ownership verification for `cgdynamics.co.za`, normally using TikTok's DNS-record method.
3. Sandbox demonstration video showing the real integration and every requested production product/scope.
4. Explicit CA approval before production review submission.
5. Explicit CA approval before production credentials, production app changes, enabling publishing, or publishing content.

## Provider architecture decision

Use the TikTok for Developers app for Login Kit plus Display API read-only analytics.

Do not assume the consumer Content Posting API Direct Post route is acceptable for CG's publishing use case. TikTok's current Content Sharing Guidelines say API clients must be intended for a wide audience and not limited to internal/private use. CG Dynamics is an agency operating tool for accounts managed by its team, so that audit route has a material eligibility conflict.

Investigate TikTok API for Business / Organic API for publishing. TikTok explicitly lists agencies as intended users, and its Accounts API includes `/business/video/publish/` for owned TikTok accounts. This is a separate provider application and permission path; do not replace the completed read-only Display API path while investigating it.

## Media transfer decision

The current Direct Post code generates a one-hour signed URL under:

`https://ehtjfntukiwbgptqgbzy.supabase.co/storage/v1/object/sign/content-review-snapshots/...`

This is not a dependable TikTok `PULL_FROM_URL` ownership solution:

- CG does not control the `supabase.co` parent domain for DNS verification.
- TikTok URL-prefix verification uses a signature file, which cannot be assumed to work beneath Supabase's signed-object API route.
- The URL contains an expiring token and is available for only the minimum one-hour window.

If the approved publishing provider path needs pull-by-URL, expose approved media through a CG-controlled verified hostname or stable URL prefix. It must serve the asset directly over HTTPS without redirects and remain accessible throughout provider processing. Do not switch server-hosted media to `video.upload` merely to avoid ownership verification.

## Browser acceptance completed

Authenticated PR preview checked at `/admin/integrations/tiktok`:

- TikTok integration route renders under the Performance workspace.
- The client selector lists real clients.
- Selecting **CG Production House** resolves its own `Not connected` state.
- Switching to **Cape Lumber** preserves a separate `Not connected` state.
- Sync stays disabled without a connected exact-client account.
- The current PR preview built successfully at `fe724df` and renders the final read-only integration copy.
- Direct preview requests to `/privacy-policy` and `/terms-of-service` render their public pages without an auth redirect.

Local unauthenticated acceptance for the provider legal routes:

- `/privacy-policy` renders directly without an auth redirect and identifies the TikTok data, OAuth-token, isolation, retention, deletion, and contact terms.
- `/terms-of-service` renders directly without an auth redirect and identifies authorized account use, provider permissions, approval-bound publishing, and contact terms.
- Both routes were checked at desktop size and at a 390x844 mobile viewport; navigation and content remain available without horizontal page overflow.

Authenticated sandbox rollout acceptance completed on the current PR preview:

- Selected the exact **CG Production House** client before OAuth.
- TikTok consent identified **CGPRODUCTIONHOUSE** and requested only profile basics, additional profile information, profile statistics, and public-video read access.
- The stored connection resolves for the exact CG Production House client id `c27d2185-08e4-4c49-be48-2572564ceecf`.
- Granted scopes rendered as exactly `user.info.basic`, `user.info.profile`, `user.info.stats`, and `video.list`; the access token was valid.
- September 2026 sync completed successfully with one in-period video and complete pagination.
- Final CG Dynamics/API result: 816 views, 27 likes, 0 comments, 1 share, 2,282 current followers, 132 following, 10,170 total likes, and 157 videos.
- Native signed-in TikTok rendered 2,282 followers and 10.2K profile likes. The same September video rendered 816 views, matching the final API result; its detail view rendered 27 likes, 0 comments, and 1 share. The view count advanced from 808 to 816 between acceptance runs and matched TikTok at both observation times, demonstrating that the value is a live cumulative snapshot.
- Eight TikTok facts persisted with `availability='partial'` because they are cumulative or current snapshots, not period totals. The real zero comment count remained a provider-backed zero; missing values are not synthesized.
- The final durable sync row is `status='success'`, `health_state='verified'`, with one in-period video and complete pagination.
- Selecting **Cape Lumber** after OAuth still renders `Not connected` and keeps sync disabled, confirming exact-client isolation in the live preview.
- OAuth callback currently returns to `APP_PUBLIC_URL` (the production app host). Because main does not yet contain PR #239's TikTok route, that host falls back to the hub; preview acceptance continued by reopening the PR route. After merge, the same callback target will resolve normally.

## Exact continuation order

1. Keep the live rollout read-only; do not deploy publishing functions or set `TIKTOK_PUBLISHING_ENABLED`.
2. Verify the production domain and prepare a sandbox demonstration video.
3. Confirm the appropriate agency publishing path with TikTok API for Business before changing the production app or enabling `TIKTOK_PUBLISHING_ENABLED`.
4. Prepare review evidence, then stop for explicit CA approval before any production review submission.
