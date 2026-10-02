# #389 Entitlement Resolution Queue — protected acceptance runbook

Prepared only. Neither migration, entitlement verification nor production cleanup has been executed by this work. The accepted 57 × 7 audit is not repeated. Source authority: [#389 queue contract](https://github.com/CGProductionHouse/CG-Dynamics/issues/389#issuecomment-5954161898), [accepted matrix](https://github.com/CGProductionHouse/CG-Dynamics/issues/389#issuecomment-5954064518).

## Apply gate and order

CA must explicitly authorise the exact production target and these two migrations before an operator applies anything. Do not use a broad `db push` that might apply unrelated pending migrations.

1. `20261002124434_client_service_entitlements.sql` (existing #635 foundation, no seed).
2. `20261002140843_client_entitlement_resolution_queue.sql` (admin/manager-only stable read RPC, no seed).

Repeat the read-only dependency preflight immediately before apply; the previous preflight is not proof of current schema. Check all referenced tables/columns, existing functions with these signatures, canonical Operations / CLIENT REQUESTS routing, current ledger, live Planner triggers and role policies. Stop on drift or any already-existing conflicting function. Do not change provider setup, packages or social eligibility.

## Migration readback

Use the approved SQL read tool, without selecting credential-bearing columns:

```sql
select version from supabase_migrations.schema_migrations
where version in ('20261002124434','20261002140843') order by version;
select tablename, rowsecurity from pg_tables
where schemaname='public' and tablename='client_service_entitlements';
select policyname, roles, cmd, qual, with_check from pg_policies
where schemaname='public' and tablename='client_service_entitlements';
select proname, pg_get_function_identity_arguments(p.oid), prosecdef,
       provolatile, proconfig, proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and proname in (
 'verify_client_service_entitlement','get_my_client_service_entitlements',
 'submit_client_service_expansion_request','record_client_service_surface',
 'get_client_service_expansion_review','get_admin_entitlement_resolution_queue');
```

Require both ledger entries, RLS enabled, exact active manager/admin evidence policy, fixed empty search paths, no PUBLIC/anon execution, and all six expected function signatures. Compare function bodies to committed migrations. Client roles must not gain direct evidence/Planner-table writes. Queue must return only active clients, seven connection states, exact-client evidence and no provider identifiers/tokens. Connection is configuration evidence, not successful metrics/freshness.

## Read-only UI acceptance before verification

As an actual active admin/manager, open Package Master. Confirm fleet count against a fresh active-client count, not hard-coded 57. Test all five filters; only one service editor may open. Reviewed unknown remains unresolved. Missing RPC/schema/read failures show an admin diagnostic with no verification editor. Ready examples require the original exact client ID, confirmed receipt, source and unchanged wording; no form is prefilled to included. Client UI must remain hidden while all states are unknown, or reads fail.

## One exact verification — separate protected data gate

Do not perform this merely because migrations were authorised. Obtain explicit approval for one exact verification and retention/rollback method. Suggested accepted evidence example:

- Red Oak: `cdb11a82-339e-4b46-9b09-bde1a23efeaf`, service `instagram`, state `included`.
- Re-read `clients.active`, canonical confirmed package receipt and current service row/revision immediately beforehand.
- Exact approved wording: “Posters are supplied as requested. Daily specials are published to Instagram Story and as an actual Facebook post.”
- Exact source: `https://github.com/CGProductionHouse/CG-Dynamics/issues/504#issuecomment-5796095876`.
- An actual active admin/manager submits through `verify_client_service_entitlement`, with the **read current revision** (0 only when no row exists). Verify the single returned/read-back row, revision increment, approved provenance and audit metadata. Never impersonate a guessed profile, mass confirm, or promote remaining generic social scope.

For a non-retained SQL acceptance, an explicitly authorised operator may run that one verification inside `BEGIN` / `ROLLBACK`, switching authenticated roles with **pre-verified real profile IDs** inside the same transaction only. A rollback-only harness proves contracts but is not persistent portal acceptance. Retained UI acceptance requires real authenticated client sessions and the separate data approval above.

## Safe client read and horizontal denial

Use Red Oak's actual active client-role session, resolved from `profiles.client_id` server-side. If none exists, stop and report the identity gate; do not create one for this acceptance. `get_my_client_service_entitlements()` must return seven safe states, only Instagram newly included, remaining missing rows unknown, connection needed **not** an upsell, and no package evidence, provider IDs/tokens or internal request IDs. Performance shows the verified included service; Overview shows no opportunity unless a genuine explicit `not_included` agreement exists. Do not invent an exclusion for testing.

Use another actual active client's session: their safe read must remain their own projection, with no Red Oak evidence/receipt. Direct evidence SELECT reveals no internal rows under RLS. `get_admin_entitlement_resolution_queue()` and `verify_client_service_entitlement(...)` must fail with insufficient privilege for both client sessions. Also test anon, inactive manager and ordinary staff. For failed permission calls capture only error codes, never tokens. Re-read as admin to prove denied calls changed nothing.

## Rollback / cleanup

- Local disposable acceptance always stops its uniquely named PostgreSQL container; no production configuration is read.
- A rollback-only production harness ends with `ROLLBACK` even on a failed check. Verify afterwards that the exact row/revision matches its baseline. This does not roll back migration DDL already separately applied.
- A retained correct, approved entitlement is real evidence, not disposable data. Do not delete it or audit history. If the operator separately approves reverting that exact evidence, re-read revision and use the same canonical verification RPC to explicitly mark `unknown` with a truthful rollback note; preserve provenance/history. Never blind DELETE, decrement revisions, mutate packages, or bulk clean up.
- If migration rollout must be withdrawn, prefer an approved forward fix. Emergency permission rollback requires separate authorisation: revoke authenticated EXECUTE on the exact affected RPCs (signatures from readback), preserving tables/evidence/audit. Client RPC failure remains fail-closed; queue read failure becomes an admin diagnostic. Do not drop shared provider objects or replay obsolete phase scripts.

## Still protected / unresolved

Migration application, every retained verification and permission cleanup remain unexecuted approval gates. Rusoord Website requires its genuine active client-role identity before client-safe acceptance. Website-only agreement does not prove SEO/AEO/GEO, analytics or update quota. The accepted audit had 3 evidence-ready included hints and 396 unknown cells, no proven exclusions or N/A; those remaining decisions need exact service agreements. No provider/OAuth, Website/#405 or master handover work is included.

## Reproducible local proof

`node --test --test-concurrency=1 tests/entitlementResolution.test.mjs tests/clientServiceExpansion.test.mjs`

`node scripts/client-service-expansion-acceptance.mjs` applies both actual migrations over disposable canonical dependency DDL and real Planner triggers; exercises RLS/revision/idempotency/atomic rollback/concurrency plus admin-only active-client keyset pagination beyond 1,000.

`node scripts/entitlement-resolution-browser.mjs` uses actual components/helpers with isolated local network/auth fixtures; set `CG_PLAYWRIGHT_MODULE` to the approved local Playwright module. It makes no production calls. Repeat original `scripts/client-service-expansion-browser.mjs` to prove client fail-closed behaviour remains intact.
