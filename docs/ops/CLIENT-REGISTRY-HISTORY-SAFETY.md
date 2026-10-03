# Client registry history safety

## Scope

Preserve existing client UUIDs and all CG Hours timesheet history. This change removes Dynamics permanent-delete UI/API helpers; archive/restore remains available. Create/rename rejects an exact trimmed, case-insensitive name collision, including archived clients. Similar names are not identity evidence and are never automatically merged.

## Database gate — not applied

`20261003085222_client_registry_identity_history_guard.sql` adds a unique normalized-name index and revokes DELETE from PUBLIC/anon/authenticated. SELECT, INSERT, UPDATE, RLS policies and service-role authority are unchanged. Concurrent writes are guarded by the database index after application. No existing rows are updated, merged, archived or deleted.

Before separately approved application, inspect normalized-name collisions across **all** clients and existing grants. Stop on a collision or unexpected caller dependent on browser DELETE. An isolated PostgreSQL 17 test now executes both the existing bridge migration and new guard: duplicate inserts/renames fail, browser DELETE is denied, SELECT/INSERT/UPDATE and service-role maintenance authority remain, and the original history fingerprints/UUIDs survive archive/restore and bridge retries. A failure must not be resolved by deleting history.

## Remaining reconciliation

The existing #404 bridge is not production-activated. Review exact existing Hours/Dynamics UUID pairs before any mapping backfill; name matches cannot authorize identity binding. Preserve Hours-only historical clients until CA decides current service scope. Do not bulk-import inactive/historical customers or operational buckets. OneDrive folder candidates require exact saved mappings before portal provisioning.

## Acceptance

Focused tests cover archived-name reservation, own-row edits, similar-name independence, database conflict feedback, absence of delete paths, and unchanged archive/restore behavior. The opt-in database test runs with `RUN_CLIENT_REGISTRY_DB_TESTS=1 node --test tests/clientRegistryDatabase.test.mjs`. It creates an exact disposable Docker container with networking disabled and no published ports, reads no production credentials, then removes that container in `finally`.

Browser acceptance must use a legitimate admin session: inspect active/archived desktop and mobile layouts; verify only Restore on archived clients, and inspect duplicate-name validation without saving. Do not mutate production to test this change. The requested CG Chrome profile currently redirects the changed preview to `/login`; no authenticated UI PASS is claimed.

The exact 59 proposed existing-client UUID pairs and 16 retained Hours-only entries are in `CLIENT-REGISTRY-RECONCILIATION-2026-10-03.md`. This is a reviewed-apply packet, not an automatic name-binding mechanism.
