# #623 / #405 M2C — inert public intake adapter

Code-only. No production migration, deployment, configuration, recipient binding,
provider send or client-data write has been performed. The default is OFF.

## Authority and transport

Browser → same-origin Piek server route → `website-enquiry-intake` → existing
`submit_website_enquiry` transaction → canonical Lead Inbox.

The website server holds the existing endpoint's opaque `intake_key`; never expose
it or a service-role credential to the browser. Fixed host/schema/version headers
bind that capability to the exact active production endpoint. Browser payloads may
contain only a UUID submission key, answers, bounded attribution and an empty
honeypot. No browser-selected client, Website, environment or recipient is accepted.
The canonical transaction remains the sole validation/persistence authority.

`verify_jwt=false` permits server capability authentication inside the handler; it
does not grant browser RPC access. The admission RPC is service-role-only, security
invoker, empty search path. Budget table is forced-RLS, with no browser privileges.
Unknown/inactive capability, mismatched host, preview endpoint, inactive form or
unapproved recipient configuration cannot submit. No CORS access is granted.

Controls: 16 KiB actual streamed UTF-8 payload; five-second body read bound;
honeypot; strict envelope; exact origin; persistent atomic per-endpoint admission
of 10 requests/minute and 100/hour, including retries. Counters saturate. A public
budget limit may temporarily defer an accepted replay; it cannot duplicate or
delete the durable receipt. Canonical replay authority is unchanged.

Success returns only `{accepted:true, receiptId, acceptedAt}` after the canonical
transaction commits. It does **not** claim email delivery. Invalid data, conflicts,
timeouts or unavailable authority never show success. Provider/storage diagnostics,
PII, client/Website IDs and credentials are not returned or logged.

## Verification

- `node --test tests/websiteEnquiryIntake.test.mjs`
- `node scripts/website-enquiry-intake-acceptance.mjs`: disposable PostgreSQL 17,
  actual handler-to-transaction-to-inbox; duplicate replay, exact-client isolation,
  RLS/grants, disabled binding, 20 concurrent sessions, minute/hour budgets.
- Existing M2A/M2B/delivery acceptances and tests, full suite/build/scoped lint.
- Actual Deno entrypoint check; CI executes intake tests and PostgreSQL acceptance.

## Protected activation order — NOT executed

1. Supervisor reviews code. CA separately authorizes production schema/config/deploy.
2. Read-only preflight verifies ledger, exact current contracts, RLS/grants and no
   partial/conflicting existing rollout. Apply M2A transaction, then intake guard
   `20261002085355_website_enquiry_intake_guard.sql`, then M2B lifecycle, then
   delivery runtime (timestamp order). Verify each before proceeding.
3. Deploy intake/worker/webhook with documented gateway settings. Keep
   `WEBSITE_ENQUIRY_INTAKE_ENABLED` and `WEBSITE_ENQUIRY_EMAIL_ENABLED` OFF.
4. Confirm Piek Website 1 / exact client / canonical host / contact form version /
   recipient inbox with CA. Existing public email is not recipient approval.
   Provision one reviewed disabled binding and server-only site capability.
5. Deploy separately reviewed Piek adapter with its form activation OFF. Validate
   exact production host/origin and schema parity before enabling either intake flag.
6. Complete separately approved email provider/DNS/secrets/webhook/worker scheduling.
7. Explicitly authorized pilot only: one controlled real submission, receipt,
   durable enquiry/outbox/event, mailbox/provider evidence, exact-client Inbox,
   Good/Poor lifecycle/metrics and negative cross-client acceptance, desktop/375px.

Stop on host/client/schema/grant/version mismatch, secret exposure or ambiguous
receipt/provider outcome. Disable site/intake/email flags and exact endpoint to
stop new work; preserve all existing receipts/outbox/history. Never drop populated
tables or retry an ambiguous provider send with a new key. Production activation
and authenticated real pilot acceptance remain protected, not claimed by fixtures.
