# Website enquiry M2A — current-main inert recovery

Baseline: `04fe827ad2f724fcfe5af211541f776a67dfa85c`; owner #405 under #611.
Closed #422 is absent from main. This recovery includes only a server transaction
foundation, not a public route, mail worker, portal UI or live configuration.
Migration `20261001181932_website_enquiry_transaction.sql` is **UNAPPLIED**.

## Canonical compatibility and security

`client_contacts` stores the client's marketing/footer contacts, not incoming
customers. `business_development_leads` explicitly owns CG internal prospects,
not client website enquiries. Neither is repurposed across ownership boundaries.
The proposed #405 enquiry/contact/outbox/event authority is not a reporting store.
A contact is not an enquiry; repeat legitimate submissions remain distinct.

`submit_website_enquiry(intake_key,schema_key,schema_version,submission_key,
answers,attribution)` is SECURITY INVOKER with empty search path, service-role only.
Browser roles have no RPC execution or base-table grants/policies. All eight
tables enable and force RLS. Default service-role privileges are revoked before
narrow grants; acquisition enquiries/events remain append-only to runtime.
Client/Website/environment/recipient/synthetic identity comes from reviewed server
bindings, never browser claims. Migration creates zero mappings or recipients.

Activated form versions and approved recipient routes are immutable. Recovery
rejects missing field types, prevents moving approved routes to a draft config,
and prevents default grants widening runtime mutation of acquisition evidence.
Endpoint + submission key serializes before contact creation. Same payload/key
returns one receipt; changed payload conflicts. Contact/enquiry, recipient jobs
and one generate_lead event commit atomically; final-event failure rolls back all.
No sender/provider path exists. Acquisition evidence is separate from future
client lifecycle/outcome state; M2B/M2C remain unimplemented.

## Executable acceptance

`node scripts/website-enquiry-transaction-acceptance.mjs` creates a unique disposable
PostgreSQL 17 Docker container, uses no application credentials, runs six-session
concurrency and isolation/rollback/replay/grant assertions, and stops only its own
container in finally. It cannot target an existing local or production server.
The dedicated PR workflow repeats the gate; structural Node tests complement it.

## Remaining gates

Supervisor schema/security review; separate read-only live preflight; explicit CA
migration application; reviewed Website/client/form/recipient binding; M2B durable
delivery/reconciliation/webhook contract; M2C approved real-site + client-mailbox
proof. No mail send, GA4 forwarding, lifecycle mutation or activation is claimed.
