# Approved client-registry activation receipt — 3 October 2026

Authority: CA explicitly approved the two existing bridge migrations, new history safeguard, bridge-only config/deployment and the exact 59 existing-client bindings reviewed in PR #654. PR #654 merged as `af07b8130996faf1696ff327c2c20d8c71468035`; its production Vercel check passed.

## Applied scope

1. Dynamics `20260918120000_cg_hours_client_registry_bridge.sql`.
2. Dynamics `20261003085222_client_registry_identity_history_guard.sql`.
3. Hours `20260918120000_client_registry_outbox.sql`.
4. Exactly 59 distinct Hours UUIDs bound to 59 distinct existing Dynamics UUIDs; 59 mapped immutable Dynamics request receipts and corresponding mapped Hours outbox receipts, zero outstanding work. Receipt provenance is `ca_reviewed_existing_binding`; there was no client creation/name-derived adoption. Initial Hours seed statement failed on an ambiguous PL/pgSQL alias and rolled back completely; corrected statement succeeded after empty-outbox/baseline re-verification.
5. Existing `ensure-client-from-cg-hours` deployed with accepted custom-secret authentication and `verify_jwt=false`; current version 2 after secret provisioning, ACTIVE, byte-exact two-file source parity. Bundle SHA256 `9bbb167ce5cba2e128643e3bcc23946ce7ed049729851fcc786050212f94323e`.
6. Only bridge-specific configuration provisioned: Dynamics `CG_HOURS_BRIDGE_SECRET`; Hours production `CG_DYNAMICS_CLIENT_REGISTRY_URL`, sensitive `CG_DYNAMICS_CLIENT_REGISTRY_SECRET`, independent sensitive `CRON_SECRET`, and `VITE_CLIENT_REGISTRY_BRIDGE_ENABLED`. Secrets generated cryptographically in memory, never printed/committed; the ACL-restricted temporary Supabase provisioning file was removed immediately.
7. Hours rebuilt OFF, accepted, then enabled and rebuilt from unchanged production source `10bfba9bded6c92b0d6905cd5fcdbd31efc11f7f`. Final production deployment `dpl_4cLasaVUGakyLgSJGgaBSDm9xP3L`, READY, alias `cg-hours.vercel.app`. Existing `/api/client-registry/cron` cadence remains `0 3 * * *`; no scheduler change.

## Runtime and data verification

- OFF cron: HTTP 200, enabled false, processed 0.
- Bridge without secret: 401. Correct private authentication with invalid empty payload: 400 `invalid_hours_client_id`.
- Replay of an already recorded exact request: 200, original exact client IDs, no new receipt/client.
- Enabled cron without credential: 401. Authenticated empty queue: 200, ok true, processed 0, empty results. Unauthenticated manual worker: 401.
- Dynamics: 60 total / 59 active clients unchanged, fingerprint `82631124cf8b710f14223ce5978d376a`.
- Hours: 130 total / 75 active clients unchanged, fingerprint `c63b4b63e7e67690d63c82f6bba8b1ee`.
- All 4,211 time entries unchanged: `4173fbebb88a2403a0cdb15cc26c5686`; all 3,260 timesheet rows unchanged: `2a894f0a6be08365354c4044079f71c6`.
- Mapping/receipt RLS and FORCE RLS enabled; no browser table grants. Ensure/claim RPCs service-only. Hours outbox browser writes denied, existing owner/admin read policy retained. Dynamics browser DELETE revoked, SELECT/INSERT/UPDATE preserved. No global privilege widening.
- Requested CG Chrome production session authenticated as CG Production House Admin: 59 active rows, archived Braize Promotions retained with Restore only, no Delete controls. Desktop and 375px body overflow false; captured console errors empty. Add form inspected then cancelled, no test saves. CG Hours Chrome session requires sign-in; authenticated Hours UI acceptance is not claimed.

## Code verification

11 focused registry/bridge tests passed, isolated PostgreSQL contract test passed (disposable container removed); broad regression run 3,549 passed / 17 skipped / 0 failed. Unrelated `sesSetupScript.test.mjs` excluded because its Bash subprocess hung on Windows. TypeScript/Vite build, scoped ESLint and diff check passed. Exact-head and merged-main Vercel green. The database test proves duplicate name/rename rejection, browser-delete denial, retained history, idempotent replay and cross-client conflict denial.

## Remaining boundaries / rollback

No approval for JFJ Electrical/VCS Cleaning Solutions creation, the other Hours-only history, OneDrive folder bindings/writes or portal provisioning. The 16 Hours-only rows remain intact. No provider mappings, external publishing or unrelated config changed. OneDrive physical candidates are not saved exact bindings.

If runtime identity/auth/idempotency contradicts this receipt: set only `VITE_CLIENT_REGISTRY_BRIDGE_ENABLED=false` and rebuild the same Hours source. Do not delete mappings/receipts, undo history protection, rename/merge clients or rotate unrelated credentials. OFF reference deployment is `dpl_G6WRVf2xVHUNQw2xH29EmWe4w4uw`; runtime flag/config must be checked rather than assuming an old deployment inherits old environment values.
