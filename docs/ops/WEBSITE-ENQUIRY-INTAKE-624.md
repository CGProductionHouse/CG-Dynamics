# Website enquiry intake — #624 (#405 M2C)

Edge Function `website-enquiry-intake`. Server-to-server bridge from a CG website's own
server route into the merged canonical M2A transaction `submit_website_enquiry`.
Not deployed. No secrets, endpoint rows, recipients or provider config are activated.
An additive admission-only migration is proposed and **UNAPPLIED**:
`20261002085355_website_enquiry_intake_guard.sql` (depends only on M2A).

## Gateway and authority

- `supabase/config.toml`: `[functions.website-enquiry-intake] verify_jwt = false`.
  The website server never holds a Supabase JWT or service-role key.
- Sole credential: one opaque per-endpoint UUID in header **`x-cg-intake-key`**
  (`website_enquiry_endpoints.intake_key`). Client, Website, environment and approved
  recipients are resolved only by the canonical transaction from that key.
- Requests carrying `Origin` or `Sec-Fetch-Site` (browsers) → 403. `Sec-Fetch-Mode` alone is
  allowed: Node/undici server-side `fetch` (Vercel routes) always sends `sec-fetch-mode: cors`.
  No CORS headers are ever sent. `Cache-Control: no-store` on every response.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (platform-provided) stay inside the
  function and are used only for the RPC.
- No provider send: success only creates pending outbox jobs for the inert delivery worker.

## Request

`POST` · `Content-Type: application/json` · body ≤ 32 KiB (declared and streamed).
Stream reads are bounded to five seconds; errors/timeouts fail closed, including a
parseable prefix from a stream that never finishes. No partial body is accepted.

```json
{
  "schemaKey": "contact_form",
  "schemaVersion": 1,
  "submissionKey": "<16-128 chars [A-Za-z0-9:_-], stable across retries>",
  "answers": { "name": "…", "email": "…", "phone": "…", "subject": "…", "message": "…" },
  "attribution": { "landing_path": "/contact", "referrer": "…", "utm_source": "…" },
  "honeypot": ""
}
```

- Only these six top-level fields; any other (e.g. `clientId`, `websiteId`,
  `environment`, `recipientEmail`, `role`, `status`) → 400 `invalid_request`.
- `answers`: 1–32 keys `^[a-z][a-z0-9_]{1,63}$`, values string ≤ 4000 / boolean / null;
  the active form schema then validates required fields, types, options and lengths.
- `attribution` keys: `landing_path, referrer, utm_source, utm_medium, utm_campaign,
  utm_content, utm_term, gclid, device_class`; strings, no CR/LF, ≤ 500 (referrer 2048).
- Non-empty `honeypot` → **202 `{ "ok": true, "handled": true }`**, nothing stored.

## Responses

| Status | Body |
| --- | --- |
| 201 | `{ ok, handled, accepted: true, receiptId, acceptedAt, replayed: false }` |
| 200 | same, `replayed: true` (identical payload + submission key) |
| 202 | `{ ok: true, handled: true }` (honeypot) |
| 400 / 401 / 403 / 405 / 413 / 415 / 409 / 422 | `{ ok: false, error: <category>, retryable: false }` |
| 503 | `{ ok: false, error: "temporarily_unavailable", retryable: true }` — retry with the **same** submission key |
| 429 | `{ ok: false, error: "rate_limited", retryable: true }`, `Retry-After: 60` or `3600` — defer and retain the same submission key |

Categories: `invalid_request`, `unauthorized` (missing/malformed key), `server_to_server_only`,
`method_not_allowed`, `payload_too_large`, `unsupported_media_type`,
`intake_unavailable` (unknown key, disabled endpoint, inactive schema or no approved
recipients — deliberately indistinguishable), `schema_unsupported`, `invalid_submission`,
`submission_conflict` (same key, different content).

Logs: one JSON line `{event, outcome, status}` per request — never key, body, answers or PII.

## Acceptance

```
node --test tests/websiteEnquiryIntake.test.mjs
node scripts/website-enquiry-intake-acceptance.mjs
deno check --no-lock --node-modules-dir=none supabase/functions/website-enquiry-intake/index.ts
```

The acceptance runs the exact handler against the real M2A + M2B + delivery migrations in a
disposable PostgreSQL 17 container, calling `submit_website_enquiry` as `service_role`.
Negative controls (disabling the honeypot short-circuit or the top-level field allow-list)
make it fail.

## #623 bounded admission hardening

Before canonical submission, the service-only `reserve_website_enquiry_intake(uuid)`
resolves the exact enabled, active-client, approved-recipient **production** endpoint
from the same capability. One forced-RLS budget row per endpoint atomically admits
10 requests/minute and 100/hour across instances. Counts saturate; older delayed
requests/clock rollback cannot rewind newer buckets. No per-visitor PII is stored.
Browser roles have no table or RPC privileges. This is an admission budget, not a
second lead/reporting store. Honeypot handling still creates no lead or budget row.
No binding/recipient/provider/scheduler is created by the migration.

Replay requests consume admission budget; a 429 may defer retrieval, but accepted
canonical receipts remain authoritative and cannot be duplicated/deleted by it.
Canonical submission/schema/conflict checks and the Piek #17 wire contract remain
unchanged. Missing/error/malformed admission cannot bypass into submission. Valid
UUID receipt and parseable observation timestamp are required before success.

Disposable acceptance additionally proves real exact-client Inbox output, RLS/grants,
20 simultaneous admissions (10 allowed/10 limited), hour exhaustion and monotonic
buckets. No production apply/deploy/config or real provider send occurred.

## Exact remaining protected rollout

After supervisor review and separate CA authority: read-only production preflight;
apply numbered migrations in timestamp/dependency order M2A → intake guard → M2B →
delivery; verify each schema/grant/RLS/ledger. Deploy intake, worker and webhook with
documented JWT settings; reviewed disabled Piek binding/form/recipient configuration;
Piek Production-only env and separately approved form placement. Provider sender/DNS,
secrets, webhook and scheduling remain separate protected gates. Enable the exact
endpoint/site transport only after parity checks and authorization. Run one controlled
pilot receipt→enquiry→email→Inbox→Good/Poor metrics→cross-client/375px acceptance.

On mismatch or ambiguity: stop; disable the exact endpoint/site intake and email worker,
preserve receipts/outbox/history and keep the same idempotency keys. Never drop live
tables, silently remap a client/recipient or blindly resend with a new provider key.
