# TikTok provider rollout handoff

Last verified: 2026-09-08 (Africa/Johannesburg)

GitHub lane: Issue #238 / draft PR #239, branch `feat/tiktok-v1-provider`

## Current code checkpoint

- Current pushed head before this provider-state checkpoint: `d421e29` (`docs(tiktok): record preview rollout gate`).
- Read-only OAuth requests `user.info.basic`, `user.info.profile`, `user.info.stats`, and `video.list`.
- `video.publish` is added to OAuth and connection-health requirements only when `TIKTOK_PUBLISHING_ENABLED=true`.
- Provider writes remain fail-closed unless that flag is exactly `true`.
- The integration page describes the active rollout as read-only and no longer tells staff that Content Posting API or publishing is part of the configured sandbox.
- Public, unauthenticated `/privacy-policy` and `/terms-of-service` routes are implemented locally for the provider application and linked from the landing and sign-in pages.
- Validation with these changes: 78/78 focused tests passed; `npm run build`, focused ESLint, and `git diff --check` passed.
- The Vercel build for `2858f1e` was refused by the project build-rate limit. The preceding PR preview is healthy and authenticated browser QA was completed against it.

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

## Live Supabase deployment preflight

Read-only inspection of project `ehtjfntukiwbgptqgbzy` on 2026-09-08 established:

- No `tiktok-*` Edge Function is deployed.
- `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, and `TIKTOK_REDIRECT_URI` are not configured as Edge Function secrets.
- REST schema checks return `PGRST205`/missing-table responses for the TikTok provider tables, so phases 5a, 5b, and 5c have not been applied.
- No production data, schema, function, or secret was changed during this inspection.

Real OAuth cannot start safely until this deployment gate is approved and completed. The minimal read-only rollout is:

1. Apply `supabase/phase-5a-tiktok-provider-foundation.sql`.
2. Apply `supabase/phase-5b-tiktok-metric-registry.sql`.
3. Apply `supabase/phase-5c-tiktok-client-mapping.sql`.
4. Configure the sandbox client key, sandbox client secret, and exact callback as the three TikTok Edge Function secrets. Leave `TIKTOK_PUBLISHING_ENABLED` unset/false.
5. Deploy only `tiktok-oauth-start`, `tiktok-oauth-callback`, `tiktok-connection-status`, and `tiktok-sync`. The callback must allow the provider's unauthenticated redirect; the other functions retain authenticated admin/manager checks.
6. Run OAuth from the PR preview for the exact **CG Production House** client, then verify granted scopes and exact TikTok identity before syncing.
7. Run a read-only sync and compare the returned profile and public-video facts against the authenticated `@cgproductionhouse` account. Confirm missing values remain unavailable and the connection remains isolated from Cape Lumber.

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
- The preview currently reflects the preceding successful deployment; the copy change from `2858f1e` awaits a new Vercel build after the rate limit resets.
- After pushing legal-page commit `10b8855`, the stable PR preview still served the older deployment: a direct `/privacy-policy` request redirected to `/admin/cg-hub`. GitHub's Vercel checks report the daily build-rate limit, so preview acceptance of the new routes remains pending a fresh deployment.

Local unauthenticated acceptance for the provider legal routes:

- `/privacy-policy` renders directly without an auth redirect and identifies the TikTok data, OAuth-token, isolation, retention, deletion, and contact terms.
- `/terms-of-service` renders directly without an auth redirect and identifies authorized account use, provider permissions, approval-bound publishing, and contact terms.
- Both routes were checked at desktop size and at a 390x844 mobile viewport; navigation and content remain available without horizontal page overflow.

## Exact continuation order

1. Obtain CA approval for the exact read-only Supabase gate documented above: three migration phases, three sandbox secrets, and four read-only Edge Functions.
2. Run exact-client OAuth for **CG Production House**, inspect granted scopes, connection status, and a read-only sync.
3. Compare synced profile/video facts against the native authenticated TikTok account and verify Cape Lumber remains isolated.
4. Wait for a fresh Vercel PR deployment and browser-verify the public legal routes and updated read-only integration copy.
5. Verify the production domain and prepare a sandbox demonstration video.
6. Confirm the appropriate agency publishing path with TikTok API for Business before changing the production app or enabling `TIKTOK_PUBLISHING_ENABLED`.
7. Prepare review evidence, then stop for explicit CA approval before any submission.
