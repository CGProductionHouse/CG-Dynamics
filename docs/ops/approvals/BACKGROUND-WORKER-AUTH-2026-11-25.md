# Worker authentication — exact local review packet, 25 November 2026

Prepared only for PR #991. No new live key, cron, permissions or worker release is authorized by the prior disabled-runtime approval. Publishing and confirmation remain OFF.

## Problem and supported correction

Worker v66 currently accepts unauthenticated calls before privileged housekeeping. Do not probe it. Cron job 1, cg-background-worker, is the existing durable caller. Its current command fingerprint is a432533625dcb8db3cd10c3c7e518e69, minute cadence, active, 30000ms timeout. Preserve identity, database, username and all other jobs.

The rejected 24 November static-header prototype MUST NOT be released. A fresh read-only check found net.http_request_queue SELECT available to anon/authenticated through PUBLIC grants, with owner supabase_admin; postgres is neither owner member nor superuser. This does not establish external Data API exposure. No queue ACL, RLS or protected role change is proposed or attempted.

Instead, keep one fresh random 256-bit lowercase64hex key only in Edge BACKGROUND_WORKER_INVOCATION_SECRET and Vault cg_background_worker_invocation_secret. pgcrypto hmac(text,text,'sha256') signs UTF-8 cg-background-worker:v1 + newline + POST + newline + Unix seconds. Queued headers carry only X-CG-Worker-Timestamp and X-CG-Worker-Signature, never the base key. One statement timestamp is materialized. Missing, malformed or ambiguous Vault key sends no HTTP.

The async worker guard checks POST, valid private configuration, exact timestamp/signature format, age <=90 seconds and future skew <=15 seconds, then verifies with WebCrypto before constructing any privileged client or housekeeping. No bearer/public-key fallback. Refusals are no-store and contain no credential/exception detail. Crypto failures fail closed. Request body is unused and grants no authority.

A proof is NOT single-use: anyone able to read a queued signature can replay it inside its remaining freshness window, and a database reader with continuing queue access could obtain subsequent proofs. This design protects the long-term key, limits proof lifetime and removes arbitrary unauthenticated internet invocation; it does not grant exclusive access against database actors able to read current proofs. Existing durable claim leases, exact publication fingerprints and uncertain-outcome reconciliation remain mandatory. Requiring single-use requests would need a separately reviewed durable nonce boundary; not silently introduced here.

## Source and caller compatibility

Exact candidate: background-worker only, 37 files; one existing entry changed, 35 hosted files preserved byte-for-byte, one shared private helper added. verify_jwt=false/import_map=false retained; custom signed guard is before all effects. No package/lockfile/dependency changes. Existing browser nudgeBackgroundWorker cannot carry the private key and will receive a refusal. It is fire-and-forget; canonical RLS enqueue/read remains, and minute cron guarantees draining, with up to the next-tick delay. No browser design, permission or Vercel change.

Only tests/clientPortalLibraryTruth.test.mjs additionally receives explicit loopback Vite test configuration. A global conflicting fixture origin caused a false failure; production transport and design remain unchanged.

## Qualification

Focused HTTP/actual worker entry/queue/library checks: 33 passed, no skips. Actual isolated PostgreSQL: 13 passed, no skips; cron/Vault/net test ports, real pgcrypto, Node HMAC and actual worker WebCrypto acceptance, no real HTTP. Preserves cron identity/unrelated jobs; refuses missing/malformed/ambiguous keys at preparation and runtime; detects command/schedule/identity drift and rolls unexpected mutations back. Native Deno checks the exact assembled 37-file candidate. Whole Node suite: 399 files /5148 tests /5109 pass /39 optional skips /0 remaining failures, reconciled with the retained Git-Bash replacement receipt (12/12 pass;11 initial WSL-startup failures) and test-only loopback fixture fix. Build/tsc/Vite7.3.6, app-bearing bundle(17chunks), scoped ESLint and diff PASS. No browser/phone/native provider acceptance claimed. Exact receipts/hashes are in the adjacent JSON manifest.

Fixtures do not prove live cron acceptance or a native Facebook publication. No browser/phone/native platform acceptance was performed for this server-only increment.

## Exact rollout requiring new approval

1. Recheck current worker v66 source/bundle, exact cron identity/fingerprint, private key absence, disabled publishing gates and unrelated function/config inventory. Stop on drift.
2. Privately generate ONE new key, configure only its Edge and Vault stores, verify matching digest privately. Never use an existing public/service-role/provider token. No key/signature value in chat, logs, screenshots or handover.
3. Apply ONLY BACKGROUND-WORKER-AUTH-CRON-2026-11-24.sql. This changes job1's command to signed HTTP; no schema, cadence, timeout, username, database or other job changes. No manual worker invocation.
4. Release the exact 37-file guarded worker LAST, preserving 35 hosted helpers and all other functions/settings. Independently read back every hosted byte and metadata.
5. Anonymous worker POST must now refuse401 without housekeeping; methods refuse405; verify one naturally occurring authenticated minute tick by matching the new job1 dispatch request ID to a completed pg_net HTTP2xx response and sanitized worker execution outcome. A succeeded cron dispatch alone proves only request enqueueing, not successful HTTP execution. Do not read/capture raw queued headers or proof values, or manually invoke the signed worker. Confirm social jobs and publishing gates unchanged.

Rollback also requires exact authority. Before guard deployment, a cron-preparation failure leaves current worker operational; stop and retain evidence, do not retry blindly. After guard deployment, investigate missing tick/key parity first. Restoring captured worker66 would reopen the pre-existing anonymous invocation gap and is an emergency security downgrade requiring explicit approval, not an automatic rollback. Signed cron is compatible with66, but that alone does not justify restoring it. Never remove keys, discard audit rows, cancel housekeeping or replay uncertain posts.

## Remaining first Facebook test gate

Use existing Cape exact-content evidence record. Still needs one genuinely approved future original JPEG/caption/SAST time tuple, fresh Teams/native duplicate and app-review evidence, then separate exact-account activation and ONE controlled post approval. No new all-client sweep, content approval or Microsoft-hold workaround. No native publishing readiness claimed.

Official API basis: [PostgreSQL pgcrypto HMAC](https://www.postgresql.org/docs/current/pgcrypto.html#PGCRYPTO-HASH-FUNCS-HMAC), [Deno WebCrypto](https://docs.deno.com/api/web/crypto/). Actual production metadata confirms extensions.hmac(text,text,text) and bytea overload; actual isolated SQL verifies interoperable bytes.
