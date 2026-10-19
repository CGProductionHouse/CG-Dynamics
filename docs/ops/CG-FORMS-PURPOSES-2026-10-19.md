# CG Forms purpose and admin contract — 19 October 2026

This is code in a draft branch. It does not apply a migration, create a production endpoint, activate a form, change an email recipient or send a message.

## Scope

- `website_form_schemas.purpose` is reviewed server configuration, immutable after activation. The browser cannot set it. Existing schemas default to `enquiry`.
- `submit_website_enquiry` retains endpoint bound validation and idempotent receipts. Only `enquiry` creates `generate_lead` and appears in the Lead Inbox/metrics. `application` and `booking_request` create the existing transactional email job. `subscription` requires a reviewed required consent checkbox, stores a private subscriber/consent record and creates no email job.
- The original delivery claim now selects enquiries only. The new purpose-aware claim carries `purpose` to the Resend worker for correct application and booking email copy. Deployment order is migration, worker, then per-form activation; this keeps an older or SES worker from claiming a new application with lead wording.
- `CG Forms` is an admin-only Dynamics page. Admin RPCs show nonlead submissions and subscribers scoped by exact client, and allow unsubscribe only. Managers, staff, clients and anonymous callers have no private table access. An opt-in can restore a previously unsubscribed address with a new consent receipt.

## CG Production House owner choices

- Application and studio booking request delivery recipient: `info@cgproductionhouse.com`.
- Newsletter records live in the CG-owned subscriber list.
- The booking form is a request; eight Wix Bookings services still own reservation and payment until that separate checkout is implemented and accepted.

## Release gates

1. Review the two migration files and confirm the real CG Production House Website/client binding. Production SQL needs separate explicit CA approval under `AGENTS.md`.
2. Apply `20261019100000_website_form_purposes.sql`, then `20261019110000_cg_forms_admin.sql`; verify grants/RLS and the admin page.
3. Deploy the purpose-aware delivery worker. Confirm existing Piek enquiry delivery remains functional and no application is claimed by the legacy/SES path.
4. Register each CGPH schema with its exact `purpose` and `consent_field_key`; approve the one intended recipient route, Turnstile host and endpoint capability. Do not infer these bindings from this document.
5. Pilot one controlled contact, application, booking request and subscription with owner consent. Verify receipt/idempotency, Lead Inbox exclusion/inclusion, subscriber status, delivery job/provider and `info@cgproductionhouse.com` arrival. Then turn on each site form kind individually. Keep Wix fallback until each path is accepted.

## Local evidence

`node scripts/website-enquiry-intake-acceptance.mjs` runs all migrations in disposable PostgreSQL 17. It checks enquiry behavior, a nonlead application and a no-job consent subscriber; confirms lead Inbox exclusion, legacy claim exclusion, purpose-aware claim, admin-only reads, client scoping and unsubscribe. `node --test tests/websiteEnquiryDelivery.test.mjs tests/websiteEnquiryIntake.test.mjs`, `npm run build` and `npm run lint` pass locally (lint has existing warnings). These do not prove production mail delivery or a live browser flow.

The CGPH site branch was also tested against these exact migrations in a disposable database using all four source-matched CG form definitions and synthetic submissions: 4 stored submissions, 3 email jobs, 1 lead event, 1 subscriber. This is source-to-database evidence only; it does not establish live Resend delivery or production authorization.

Draft PR [#843](https://github.com/CGProductionHouse/CG-Dynamics/pull/843) CI [run 39224102362](https://github.com/CGProductionHouse/CG-Dynamics/actions/runs/39224102362) passed the complete PostgreSQL acceptance job and Deno check on `f8c0dfa6`. The recipient-gate assertion now checks the purpose-aware delivery claim. This verifies repository tests; it does not deploy the worker or apply production SQL.
