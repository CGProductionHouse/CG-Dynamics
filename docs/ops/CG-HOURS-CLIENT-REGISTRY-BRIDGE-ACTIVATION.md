# CG Hours → CG Dynamics client-registry bridge activation

Status: **OFF by default**. Merging the implementation PRs does not authorize any production activation step.

Scope: Dynamics #404 / PR #411 and CG Hours #7 / PR #8 only. Staff Logger PR #3 and Dynamics #376 are outside this runbook.

## Safety contract while OFF

- Leave `VITE_CLIENT_REGISTRY_BRIDGE_ENABLED` unset or set to `false` in CG Hours.
- The CG Hours browser must not query `client_registry_outbox`, render registry status, or invoke the registry worker.
- Existing client creation and commission/package behavior must continue unchanged.
- The scheduled worker must return HTTP 200 with `enabled: false` before reading auth, bridge configuration, or Supabase.
- Do not apply either migration, deploy the Dynamics bridge function, configure bridge secrets, or enqueue the three-client backfill merely because the PRs are merged.

## Activation prerequisites

Before step 1, record one approved change window and one named operator/reviewer. Confirm both PRs are merged, all checks are green, production backups and rollback access are available, and the bridge flag is still OFF. Capture baseline counts for CG Hours clients, Dynamics clients, registry mappings, Auth users, and staff profiles. Stop if the counts or exact client identities are unclear.

Generate one high-entropy shared bridge secret out of band. Never place it in Git, issue/PR comments, browser-visible `VITE_*` variables, command output, or screenshots.

## Ordered production activation

Perform these steps in order. Do not advance when a verification fails.

### 1. Apply the Dynamics migration

With explicit production-migration approval, apply only:

`supabase/migrations/20260918120000_cg_hours_client_registry_bridge.sql`

Verify the mapping/request schema, constraints, RLS, grants, and ensure-client RPC match the reviewed migration. Confirm there are no unexpected mapping or request rows and no existing Dynamics client or Auth user changed. Do not run a backfill.

### 2. Configure and deploy the Dynamics endpoint

Set `CG_HOURS_BRIDGE_SECRET` as a server-side Supabase Edge Function secret, then deploy only `ensure-client-from-cg-hours`.

Verify an unauthenticated request returns 401. With the shared secret, verify an invalid payload returns 400 without creating a client or mapping. Confirm function logs contain no secret or client credential material.

### 3. Apply the CG Hours migration

With separate explicit production-migration approval, apply only:

`supabase/migrations/20260918120000_client_registry_outbox.sql`

Verify the outbox schema, insert trigger, claim/update RPCs, RLS, and grants match the reviewed migration. Confirm existing clients were not automatically backfilled and no client, time, payroll, or Staff Logger record changed.

### 4. Configure CG Hours while still disabled

Set these server-side production variables:

- `CG_DYNAMICS_CLIENT_REGISTRY_URL` — the deployed Dynamics `ensure-client-from-cg-hours` URL.
- `CG_DYNAMICS_CLIENT_REGISTRY_SECRET` — the same shared secret from step 2.
- `CRON_SECRET` — the Vercel cron authentication secret.

Keep `VITE_CLIENT_REGISTRY_BRIDGE_ENABLED=false` (or unset), then redeploy CG Hours. Verify ordinary client creation still follows the pre-bridge path, no registry column is visible, no browser request reads the outbox, and both manual worker and daily cron return the disabled HTTP 200 response without configuration or database errors.

### 5. Enable the CG Hours bridge

Only after steps 1–4 are green, set `VITE_CLIENT_REGISTRY_BRIDGE_ENABLED=true` exactly and redeploy CG Hours. The production cron is intentionally daily (`0 3 * * *`) for Vercel Hobby compatibility; immediate delivery is attempted after client creation and from the authorized Clients page, with the daily worker as durable retry recovery.

Verify the registry column is visible only to the existing authorized owner/admin audience, the worker still requires the existing owner/admin session, the cron requires `CRON_SECRET`, and no outbox row exists for historical clients.

### 6. Run the explicit three-client backfill

This step requires fresh, explicit approval after the bridge is enabled. The only approved initial identities are:

| Exact CG Hours client | CG Hours UUID |
| --- | --- |
| JFJ Electrical | `94dc9b9f-d9d6-45ea-9ddc-ef055bb237f4` |
| Neshora Oxygen | `1b16e052-b145-410d-94a1-49909b2aa920` |
| VCS Cleaning Solutions | `c45ae65c-a151-47b9-a9f2-324ec799b381` |

Before enqueueing each client, verify the UUID and exact name occur once in CG Hours, there is no existing mapping for that Hours UUID, and there is no conflicting exact-normalized Dynamics name. Stop for human reconciliation on any collision, name drift, missing identity, or duplicate.

Enqueue only those three stable Hours UUIDs through the reviewed outbox mechanism. Record each generated request UUID in the protected change record, run the worker, and retain each returned Dynamics UUID. Do not guess a short code or match fuzzily.

### 7. Verify and close the activation window

For each of the three clients, verify one outbox row is `mapped`, one Hours UUID maps to one exact Dynamics UUID, and replaying the same request is idempotent. Confirm there are no duplicate Dynamics clients, duplicate mappings, new Auth users, client-name mutations, or cross-client access.

Recheck staff/admin login, normal CG Hours client creation, time logging, payroll data, and Staff Logger behavior. Compare all baseline counts and inspect both platforms' logs for 401, 409, 5xx, retry storms, secret leakage, or unexpected writes. Record the final evidence on the two owning issues.

## Kill switch and stop conditions

For any identity ambiguity, duplicate, unexpected mutation, authorization anomaly, or repeated delivery failure, set `VITE_CLIENT_REGISTRY_BRIDGE_ENABLED=false`, redeploy CG Hours, and stop. This hides the UI and makes browser/manual/cron processing inert; it does not delete outbox rows or mappings. Preserve those durable records for reconciliation and do not re-enable until the cause is reviewed.

