# #593 — standalone Instagram provider callbacks

Code baseline: main `df6610746d4a285d76e06ff203f3dfb0a69e1b44`.
Code/test preparation only. Nothing here authorizes migration application, Edge
deployment, Meta saves, secrets, OAuth or real-data deletion.

## Official requirements checked before implementation

Authenticated Chrome, 1 October 2026:

- [Instagram app setup](https://developers.facebook.com/documentation/instagram-platform/create-an-instagram-app), updated 14 May 2025: Instagram business-login settings have distinct Deauthorize callback and Data deletion request URL fields.
- [Business Login for Instagram](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login), updated 13 March 2026: use the **Instagram** app ID/secret and app-scoped user identity returned by the token exchange, not a Facebook/Page identity.
- [Meta deletion callback](https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/data-deletion-callback), updated 7 November 2025: HTTPS POST `signed_request`, app-scoped `user_id`; verify HMAC-SHA256 over the original encoded payload with the app secret. Return JSON `url` and alphanumeric `confirmation_code`, with human-readable request status. Unknown IDs can be disregarded.
- [Manual login flow](https://developers.facebook.com/documentation/facebook-login/guides/advanced/manual-flow), updated 30 June 2026: deauthorization notifies app removal; no additional response object is specified. Our authenticated successful handler acknowledges with empty HTTP 200, not invented deletion confirmation semantics.
- [Supabase webhook authentication](https://supabase.com/docs/guides/functions/auth#external-webhooks): provider signatures are checked inside the handler; JWT platform verification is disabled for these two endpoints only. Changelog inspected; no relevant API migration required.

Meta dashboard fields were NOT modified. Provider-produced live callback delivery
has NOT been tested; the official signed-request fixtures and local contract tests
are not real consent/removal evidence.

## Final canonical URLs — usable only after separately approved deployment

| Instagram business-login field | Value |
|---|---|
| Deauthorize callback URL | `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-deauthorize` |
| Data deletion request URL | `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-data-deletion` |

Deletion returns exactly:

```json
{"url":"https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/instagram-data-deletion?code=<opaque-code>","confirmation_code":"<opaque-code>"}
```

The 64-character hexadecimal code is alphanumeric, keyed, non-identifying and
stable for an identical signed request. GET with that bearer code returns a
minimal human-readable completion explanation; absent/invalid codes return 404.
No provider/client IDs, tokens, usernames or report content are returned. No-store,
no-referrer and restrictive CSP headers protect the status surface.

These URLs are **not** the OAuth redirect and **not** generic Facebook callbacks.
Do not replace App Basic's human data-deletion instructions with a handler signed
using the wrong Facebook app secret. Preserve the reviewed public Privacy/Terms
and the existing OAuth redirect. Use only `INSTAGRAM_APP_SECRET` and
`INSTAGRAM_APP_ID`; no Meta/Page credential fallback. No new secret name is needed.

## Authentication, scope, atomicity and retention

- Bounded form-urlencoded POST with exactly one `signed_request`; no query/body
  client-ID overrides, JSON identity shortcuts or username/account-ID matching.
- Canonical base64url, 32-byte signature, Web Crypto HMAC verification, exact
  algorithm/ID/timestamp validation. Invalid/missing credentials fail closed.
- Exact `(instagram_app_id, app_scoped_user_id)` resolution. New canonical OAuth
  persistence stamps the app namespace. Historical rows remain NULL rather than
  inferred/backfilled; matching unnamespaced evidence returns an error for review.
- Service-only RPC, empty search path, no anonymous/authenticated execution or
  receipt-table access. Existing connection/client/report RLS is not broadened.
- Shared advisory locking with OAuth persistence, connection and asset row locks,
  exact-client/account/standalone binding checks, all writes in one transaction.
- Deauthorization deletes the exact encrypted token and marks the connection
  revoked. The asset credential route remains bound so canonical loading fails
  closed rather than silently falling back to an unrelated legacy Meta token.
- Deletion removes the exact token and connection and clears only its exact
  standalone Instagram identity fields on the bound asset before FK unlink.
  Facebook Page bindings fail closed; Facebook credentials, unrelated clients,
  active flags, reports, posts, published snapshots and reporting truth are untouched.
- Staff OAuth intention rows are not provider-derived account data and remain
  untouched. Minimal append-only completed receipts contain only keyed request
  and confirmation digests plus kind/time, never raw signed payload, client/provider
  identity, username or credentials. No broad audit/history rewrite.
- Receipt replays cannot affect a later reconnect. New callbacks predating the
  current connection (including ambiguous same-second ordering) error without a
  false completion. Do not bypass this hold; inspect actual provider timing during
  the separately authorized fixture acceptance. Provider retry age has no invented
  TTL; explicit signed expiry is respected when supplied.
- Completion is returned only after successful commit or truthful absence of the
  exact namespaced identity. Persistence/binding conflicts never claim deletion.

## Protected activation sequence still required

1. CA separately approves the migration after security review:
   `20261001131621_instagram_provider_callbacks.sql`. Existing standalone foundation,
   encrypted token and review-binding migrations must already exist. No historical
   backfill is included. Keep standalone consent activation OFF throughout.
2. Apply only the approved migration; verify scoped RPC grants, receipt RLS/no direct
   access and historical NULL namespace truth. The previous unscoped persistence
   RPC is revoked and replaced by a namespaced wrapper; coordinate this rollout.
3. Under separate Edge authority deploy the updated `instagram-oauth-callback`
   (now sends `p_instagram_app_id`), then both new callback functions with
   `verify_jwt=false`. There is no cron/queue/provider-worker change.
4. Privately verify existing `INSTAGRAM_APP_ID` is the approved Instagram app and
   `INSTAGRAM_APP_SECRET` is that app's secret. The missing-secret gate from #505
   is unchanged; any secret write needs separate approval. Callback protection
   does not depend on the consent activation flag and must remain available for
   revocation/deletion even when new consent is disabled.
5. Reject unsigned/forged requests and unknown confirmation codes before any
   provider field is saved. Verify no DB error can return a completion receipt.
6. CA separately authorizes saving the two exact Instagram product URLs above.
   Read back only those values; do not change OAuth scopes/Live mode or Facebook routes.
7. Use only the separately approved coherent standalone review fixture from #591.
   Genuine OAuth/removal/deletion tests require explicit owner/CA authorization.
   Verify real provider signature, correct app-scoped identity, revocation,
   deletion response/status, repeat delivery and unrelated-client/report preservation.
   No real production client deletion is authorized by this runbook.
8. Business/access verification, authorized demo/reviewer/tester access, App Review
   requests/submission, Live mode and eventual consent activation remain separate.

## Verification

- 48 new executable tests: 32 signed-request/HTTP/security/reporting cases plus 16 actual
  disposable PostgreSQL cases, including concurrent duplicates, simultaneous
  revoke/delete, real OAuth-persistence race, replay after reconnect, stale callback,
  exact-client/Page binding rollback, namespace holds and grants/auth boundaries.
- Local SQL tests opt in with `CG_INSTAGRAM_CALLBACK_TEST_CONTAINER=cg-dynamics-593-test`.
  They create/drop only their own PID-named database in that disposable container;
  there is no database URL or production credential input.
- Focused callbacks/Instagram/Meta reporting/client isolation: 141 PASS.
- Full suite: 3347 PASS, zero failures/skips, including the local SQL tests. Unit
  configuration used dummy `https://example.test` / test publishable values.
- TypeScript/Vite build PASS; existing large-chunk advisory only.
- Deno check PASS for both new handlers and updated OAuth callback. Existing
  encryption helper received ArrayBuffer type annotations only, no behavior change.
- Scoped ESLint PASS; `git diff --check` PASS. Vercel evidence recorded on the PR.
- No production migration, deletion, deploy, provider settings, OAuth or secret
  changes. Browser work inspected official documentation only. No product UI changed.
