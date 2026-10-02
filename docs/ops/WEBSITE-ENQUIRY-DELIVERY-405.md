# Website enquiry notification runtime — #405

Owner #405. Stacked on #620 (M2B inbox); M2A (#614) is on `main`.
Migration `20261002110000_website_enquiry_delivery_runtime.sql` is **UNAPPLIED**.
No secret, env var, provider account, webhook or real email has been created or sent.

## Provider gate (exact)

No approved transactional-email provider exists in CG Dynamics today.
`supabase/functions/client-onboarding/email-adapter.ts` is a fail-closed stub that
names Resend/Postmark/SendGrid/SMTP as unapproved options. This runtime therefore
ships a **Resend adapter that is inert until CA approves Resend** and sets:

| Name (Supabase Edge Function secret) | Value shape |
| --- | --- |
| `WEBSITE_ENQUIRY_EMAIL_ENABLED` | `true` |
| `WEBSITE_ENQUIRY_EMAIL_PROVIDER` | `resend` |
| `WEBSITE_ENQUIRY_EMAIL_FROM` | approved CG sender on a Resend-verified domain, e.g. `CG Leads <leads@<verified-domain>>` |
| `WEBSITE_ENQUIRY_RESEND_API_KEY` | Resend API key, send-only scope |
| `WEBSITE_ENQUIRY_WORKER_SECRET` | random ≥32 bytes; scheduler sends it as `x-worker-secret` |
| `WEBSITE_ENQUIRY_RESEND_WEBHOOK_SECRET` | Resend webhook signing secret (`whsec_…`) |

Any missing value → worker returns `{state:"disabled", gate:"<exact name>"}` and
claims nothing. Choosing a different provider means adding one adapter beside
`classifyResendResponse`; the DB contract is provider-neutral.

## Contract

- Outbox rows are created atomically with the enquiry by `submit_website_enquiry`
  (M2A). Email failure can never lose the enquiry or its Lead Inbox entry.
- `claim_website_enquiry_deliveries(provider, limit, lease_seconds)` — `FOR UPDATE
  SKIP LOCKED` lease; first moves expired leases to `reconcile` (`lease_expired`).
- `complete_website_enquiry_delivery(job, lease, outcome, message_id, error)` —
  `accepted` (requires provider id) / `retryable_failure` (backoff 1,2,4,8 min…≤1h;
  5th attempt → `failed`) / `permanent_failure` / `ambiguous` → `reconcile`.
  Stale or foreign leases are reported, never applied.
- `resolve_website_enquiry_delivery_reconcile(job, found|absent|idempotent_replay, id)`
  — `idempotent_replay` only inside 23h (Resend dedupes an `Idempotency-Key` for 24h),
  so a message the provider already accepted is returned, not duplicated. Older
  ambiguous jobs stay in `reconcile` for staff review.
- `apply_website_enquiry_delivery_event(provider, event_id, message_id, delivered|bounced, at)`
  stores every verified event in `website_enquiry_delivery_provider_events` (unique on
  provider + svix-id) **before** the webhook acknowledges it, then applies it if the job
  is accepted. Events that arrive before the worker persists the accepted provider id
  wait there and are applied inside `complete_…('accepted')` / `resolve_…('found')`,
  in occurrence order. A per-message advisory lock serialises webhook storage and
  acceptance, so neither can miss the other. accepted → delivered → bounced stay
  distinct; a late "delivered" after a bounce is recorded as `superseded` and never
  regresses state. The worker also runs `sweep_website_enquiry_provider_events`.
- All RPCs: `service_role` execute only.
- Email: From = approved CG sender; visitor email only as Reply-To (CR/LF rejected);
  plain-text transactional body (labelled fields, page, received time, reference);
  no unsubscribe/list/tracking/marketing headers; `Idempotency-Key = delivery_key`.
- Functions (both `verify_jwt = false` in `supabase/config.toml`, so the gateway passes
  the request to the handler, which is the sole authority):
  `website-enquiry-delivery-worker` — scheduler sends only `x-worker-secret`
  (constant-time check; unset secret rejects everything; no JWT or service-role bearer
  is given to the scheduler); `website-enquiry-delivery-webhook` — Svix signature, ±5 min;
  returns 2xx only after durable storage, 5xx otherwise so the provider retries.
  Logs/responses carry counts only, never addresses or content.

## Acceptance

```
node --test tests/websiteEnquiryDelivery.test.mjs
node scripts/website-enquiry-delivery-acceptance.mjs
deno check --no-lock --node-modules-dir=none supabase/functions/website-enquiry-delivery-worker/index.ts supabase/functions/website-enquiry-delivery-webhook/index.ts
```

Race regressions (in the acceptance SQL) cover: delivered before acceptance; provider
retry of the same event; bounced + delivered both early and out of order; late delivered
after bounce; early event resolved via reconcile `found`; and a real two-session race
(dblink) where the webhook transaction is uncommitted while the worker accepts — the
worker must wait and then apply the event. Negative controls (removing the post-accept
processing, or the lock) make the suite fail.

Disposable PostgreSQL 17 applies M2A + M2B + runtime and proves non-overlapping
claims, stable idempotency key, stale-lease rejection, accepted/delivered/bounced
distinctness, webhook idempotency, retry backoff and 5-attempt cap, ambiguous and
expired-lease reconcile without resend, 23h replay window, and that enquiries survive
every failure path. No provider is contacted.

## Suppression before activation (`20261002140000_website_enquiry_delivery_suppression.sql`)

`suppressed` is a terminal delivery state. A suppressed job is never claimed (the claim RPC
leases `pending` only), never replayed (reconcile resolution acts on `reconcile` only) and
keeps its enquiry, event and Lead Inbox evidence. Columns `suppressed_at/_by/_from_state`,
`suppression_reason` (`acceptance_test|duplicate|spam|client_request|other`, note required
for `other`) are enforced together by `website_enquiry_delivery_suppression_complete`.

- `suppress_website_enquiry_delivery(job_id, reason, note)` — SECURITY DEFINER, callable by
  `authenticated` but only succeeds for an **active `admin` or `manager`** (`auth.uid()`).
  Allowed from `pending`, `failed`, `reconcile` only. `leased` (in flight) and
  `accepted/delivered/bounced` return `not_suppressible`; a repeat returns
  `already_suppressed`. The row lock serialises with the worker's
  `FOR UPDATE SKIP LOCKED` claim, so a job being suppressed is skipped, never leased.
- `website_enquiry_delivery_preflight()` — admin/manager read of every job a worker could
  still send (`pending`/`reconcile`): receipt, client, Website, recipient, contact email,
  subject. No message body.

### Executed 2 Oct 2026 (CA-approved)

Steps 1–2 below are **done**: migration `20261002140000` applied ledger-exact (ledger 151→152,
MD5 `fe8981ff68908d4f08d36672d1ccac13` = GitHub file); Piek pilot job
`74112f4d-8021-43f0-aaa1-f0cff3038abe` suppressed `pending → suppressed`, reason
`acceptance_test`, by the CG admin profile; preflight now empty; 0 sendable jobs; 0 provider
events. Only step 3 (email activation) remains, under a separate CA approval.

### Protected activation gate (CA) — exact order

1. Apply `20261002140000_website_enquiry_delivery_suppression.sql` through the same
   ledger-exact path used for the four #405 migrations (file + ledger row with the exact
   repo version/name in one transaction; verify MD5 of `statements[1]`).
2. As the CG admin identity, run the preflight and suppress the Piek pilot job
   (enquiry `8a7ec21d-4c64-40f3-9b81-120f05f8c87c`, receipt `4bf9fcc9-…`):

   ```sql
   begin;
   set local role authenticated;
   select set_config('request.jwt.claims', json_build_object('sub', '<active CG admin profile id>', 'role', 'authenticated')::text, true);
   select * from public.website_enquiry_delivery_preflight();
   -- `authenticated` has no table access by design: take the job id from the preflight.
   select public.suppress_website_enquiry_delivery(p.job_id, 'acceptance_test', 'Piek #405 production pilot - DO NOT ACTION')
   from public.website_enquiry_delivery_preflight() p
   where p.enquiry_id = '8a7ec21d-4c64-40f3-9b81-120f05f8c87c' and p.delivery_state = 'pending';
   commit;
   ```
   Expect `{"applied": true, "state": "suppressed", "from": "pending"}` and the job absent
   from a second preflight.
3. **Activation precondition:** the preflight returns no acceptance/test job. Only then
   approve the provider, verify the CG sending domain (DNS), set the six secrets, deploy
   worker + webhook (`verify_jwt = false`), register the webhook and schedule the worker.

## Amazon SES transport (primary fleet transport — code ready, inert)

Decision (#405, 2 Oct): **Amazon SES à-la-carte** with shared IPs is the primary transport.
Resend stays inactive; Afrihost SMTP is a bounded fallback only. Client websites are
unchanged — SES sits behind the provider-neutral outbox.

**Code (no AWS SDK; WebCrypto only)**
- `_shared/awsSigV4.ts` — SigV4 signer, verified against AWS's published IAM example.
- `_shared/websiteEnquirySes.ts` — SES v2 `SendEmail` request (approved From, visitor
  Reply-To only, `ConfigurationSetName`, tag `cg_delivery_key=<delivery_key>`), response
  classification, SNS signature verification (cert URL pinned to `sns.<region>.amazonaws.com`,
  SHA1/SHA256 RSA), SES event mapping.
- `_shared/websiteEnquiryProviders.ts` — `WEBSITE_ENQUIRY_EMAIL_PROVIDER=ses|resend`, fail-closed.
- Worker dispatches by provider. **SES has no idempotency key**: a 5xx / lost response is
  `ambiguous → reconcile` and is **never auto-replayed** (replay stays Resend-only).
  SES reconcile jobs resolve from SES's own evidence: any SES event carrying the job's
  `cg_delivery_key` tag (incl. `Send`) resolves `found` with the SES MessageId.
- `website-enquiry-ses-events` (`verify_jwt = false`) — SNS HTTPS endpoint: topic ARN must
  equal `WEBSITE_ENQUIRY_SES_SNS_TOPIC_ARN`; signature verified before anything is stored or a
  subscription confirmed; Delivery → `delivered`, permanent Bounce / Reject → `bounced`,
  Complaint → `complained` (new terminal state), transient bounce / delay ignored. Stored in
  the durable provider-event inbox (keyed by SNS MessageId) before 2xx; storage failure → 5xx.
- Migration `20261002160000_website_enquiry_delivery_ses_events.sql` (**unapplied**): adds
  `complained` state/event + `complained_at`; redefines event processing with the same
  lock/never-regress rules. Rehearsed over a production-shaped suppressed job.

Classification: 2xx with `MessageId` → accepted; 2xx without id, 5xx, lost response →
ambiguous; 429 / throttling / sending-paused / account / credential errors → retryable (not
sent); other 4xx (e.g. `MessageRejected`) → permanent.

**Secrets (names only)** — `WEBSITE_ENQUIRY_EMAIL_ENABLED`, `WEBSITE_ENQUIRY_EMAIL_PROVIDER=ses`,
`WEBSITE_ENQUIRY_EMAIL_FROM`, `WEBSITE_ENQUIRY_SES_REGION`, `WEBSITE_ENQUIRY_SES_ACCESS_KEY_ID`,
`WEBSITE_ENQUIRY_SES_SECRET_ACCESS_KEY`, `WEBSITE_ENQUIRY_SES_CONFIGURATION_SET`,
`WEBSITE_ENQUIRY_SES_SNS_TOPIC_ARN`, `WEBSITE_ENQUIRY_WORKER_SECRET`.

### SES protected activation gate (CA) — exact order
1. Merge the SES PR; apply `20261002160000` ledger-exact; deploy `website-enquiry-delivery-worker`
   and `website-enquiry-ses-events` from the merge commit.
2. AWS (CA): choose region; confirm **à-la-carte** pricing, shared IPs, no dedicated IP / VDM /
   paid add-ons (warn before any recurring-cost feature).
3. Verify `notify.cgdynamics.co.za` in SES (Easy DKIM CNAMEs + custom MAIL FROM MX/TXT) — records
   added at the existing cgdynamics.co.za DNS host only; root mail untouched.
4. Request SES production access (sandbox: 200/24h, 1/s, verified recipients only).
5. Create a configuration set (e.g. `cg-dynamics-events`) with event destination → SNS topic for
   Send, Delivery, Bounce, Complaint, Reject; HTTPS subscription to
   `https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/website-enquiry-ses-events`
   (auto-confirmed by the function only for the configured topic).
6. IAM user/role with **only** `ses:SendEmail` on the verified identity + configuration set.
7. CA sets the secrets above from a terminal (never pasted into GitHub/chat); keep
   `WEBSITE_ENQUIRY_EMAIL_ENABLED` unset; worker secret also in Vault for the schedule.
8. Agent: verify names, schedule worker (reads Vault), confirm `state: disabled`; with CA approval
   enable; one CG-owned acceptance send (→ delivered via SNS) and the SES mailbox simulator
   (`bounce@simulator.amazonses.com`, `complaint@simulator.amazonses.com`) for bounce/complaint.
