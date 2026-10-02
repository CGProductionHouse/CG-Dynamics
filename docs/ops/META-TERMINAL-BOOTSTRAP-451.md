# #451 Meta terminal-bootstrap backoff — code-only repair

Base: `7ff12f492003c89ad164da42b2c92495560bd4ce` (#639 accepted Microsoft CPU repair).
Reconciled without conflict onto `2ce29344a78bcef5d4a96fd27a87a7a2699fb2ee`;
accepted #513 additions are unchanged and outside this repair.
This lane does not deploy Microsoft or run reconciliation. No master handover changes.

## Reproduction / root cause

Read-only production observation on 2 October 2026, 16:23:25 UTC: **20 failed
fleet items in 10 distinct batches in ten minutes**, all exact mapped Page
preflight failures (HTTP 400 / Meta code 10 / `pages_read_engagement`). All 20
still had both platform stages pending and **zero cooldown receipts**. First
failure in the window: 16:14:17 UTC; latest: 16:23:06 UTC. This is not a retrying
lease: every minute makes a new September + October bootstrap batch.

The scheduler treats a missing checkpoint as due and only deduplicates queued /
running asset-month work. Page preflight fails before a platform checkpoint can
write its normal failure/next-due receipt. Once the item settles failed it falls
out of active dedupe, leaving the missing checkpoint bootstrap due again.

The pre-fix executable test invokes the actual scheduler with that durable
receipt. It failed with **two inserts rather than zero** (batch + items).

## Contract

- No migration: use existing item ID, batch ID/source, exact asset/client/month,
  platform states, error, `finished_at`, `cooldown_until`, mapping `updated_at`,
  exact linked connection `last_connected_at`, and successful checkpoints.
- The production item table has **no `updated_at` column**. The status endpoint's
  old recovery select/order silently lost that evidence; use real terminal
  `finished_at` and stable creation/ID ordering instead.
- **One-hour maximum access cooldown**, measured from the terminal receipt,
  never refreshed by reads. This matches the existing failed-platform checkpoint
  RPC's one-hour backoff. Healthy verified checkpoints retain their six-hour
  schedule. Existing shorter item cooldowns are respected; long ones cannot
  extend the terminal-access window.
- Only the latest exact automatic `fleet_freshness` failure counts. Shared
  connector classification identifies permission/auth codes; known worker
  permission-blocked outcomes retain their explicit platform prefix. No blanket
  HTTP 400/403, generic schema/contract failure, timeout or rate-limit matching.
- A Page preflight can block pending Page-dependent stages. A platform-specific
  error blocks only that failed stage. Completed/not-applicable stages are never
  reclassified. A combined asset-month item is held only when **all due stages**
  are access-blocked: independent client/assets and healthy sibling work proceed.
- Cooldown expiry, an updated exact mapping, a newer genuine reconnect receipt
  for that linked connection, or successful/new complete checkpoint permits an
  attempt. Unrelated reconnects and token-validation `updated_at` changes do not.
- Queue reads paginate with deterministic ordering. Unknown/error queue evidence
  holds new fleet enqueue; all-suppressed clients create **no empty batch**.
- Failed access remains **STALE without successful evidence / PARTIAL with old
  verified evidence**, with an explicit blocker. Old values/watermarks/success
  ages are unchanged. A newer successful checkpoint supersedes old failed history.
  Unavailable inventory/checkpoint/recovery reads cannot become a green status.
- Existing retries, rate-limit refunds, cursors, fencing, leases, report/post
  idempotency, queue RPCs and scheduler cadence are unchanged. Type-only corrections
  use concrete `SupabaseClient` and `PromiseLike` for the existing thenable
  pagination boundary, allowing full touched-Edge type checking without runtime
  changes or dependency/config edits.

## Verification / protected follow-up

Executable fixtures cover minute-by-minute suppression, exact expiry, recovery,
source isolation, same-asset healthy sibling work, >1,000 history rows, transient
negative controls, active-work dedupe, unchanged fact ages, truthful health and
new checkpoint precedence. Run all Meta/worker/freshness tests, full suite,
TypeScript/Vite build, touched Edge type check, scoped lint and diff check before
push. Record final counts and exact-head Vercel in the PR / #451 / #623 / #381.

The Edge type check uses Deno 2.9.6 with an external local import-map config
mapping `@supabase/supabase-js` to the repository's JSR package and a type-only
`ImportMeta.env` declaration for shared frontend imports. Neither is deployed.

After supervisor review, CA must separately authorize deployment of
`background-worker` and `meta-connection-status` with their existing auth/JWT
contracts. No schema, cron, flags, secrets or provider changes are needed for
this repair. Read back suppressed enqueue evidence over successive scheduler
ticks, unchanged healthy-platform progress, and degraded permission-blocked health.
Do not claim production churn is fixed from a Vercel preview: the worker/status
Edge functions remain unchanged until the protected deployment.

Owner access / narrow re-consent remains a separate protected provider gate. No
permission/identity substitution, sync trigger or access write is included. The
Microsoft #639 rollout/reconciliation also remains separately protected.

No production writes, migrations, Edge deploys, provider calls or access/config
changes were performed by this repair. No Microsoft writes occurred.
