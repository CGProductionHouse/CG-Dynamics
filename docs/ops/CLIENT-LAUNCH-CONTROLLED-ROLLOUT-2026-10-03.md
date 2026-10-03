# Controlled client launch rollout — 3 October 2026

CA's direct reply to the bounded #389/#451/#513 apply packet authorized this rollout. This receipt supersedes earlier statements that these three packets remain wholly unapplied. It does not authorize strategy approval/publication, provider changes, contract inference or unrelated activation.

## Applied service authority (#389)

| Accepted repository migration | Actual production ledger version/name |
| --- | --- |
| `20261002124434_client_service_entitlements.sql` | `20261003133345_client_service_entitlements` |
| `20261002140843_client_entitlement_resolution_queue.sql` | `20261003133433_client_entitlement_resolution_queue` |

The management migration tool assigned actual execution timestamps. No ledger rewrite occurred. Post-apply checks proved RLS, admin/manager SELECT policy, authenticated SELECT-only table privileges, anon denial, explicit RPC role checks and restricted search paths. Queue RPC is STABLE. No entitlements were seeded or inferred.

Authenticated production Package displays 61 active clients, 427 unresolved client/service decisions, 3 evidence-ready hints, 424 needing exact agreements, 0 reviewed. Connections and generic social scope are explicitly non-decisive. Missing remains unknown, not zero or absent service. Exact agreement review remains required; this is not 427 broken provider connections.

## Applied reviewed copy (#513)

Accepted plan hash `bb50da38748b62ef26e4bf73f618ea223629fc7edde3e687b5b0a121b60542c1`; packet hash `e55b6f0f7de7bf0809c65f10224aa2cf7163f3a0969ce0ba11e24220ac4ca118`.

All 114 rows/latest revisions passed the existing no-drift guard. Exactly 72 draft v2 rows were individually amended to draft v3 through `amend_monthly_client_strategy_with_context`, with exact reviewed payloads, optimistic versions and deterministic receipt keys. Existing approved admin `info@cgproductionhouse.com` provided canonical attribution. Privileged exact-row read/lock checks preceded the established authenticated RPC role switch; no grant widening/direct UPDATE. One preliminary permission failure rolled back without mutation, then the corrected existing authority pattern succeeded.

Readback proved all 72 durable revisions, payload equality, unchanged package/seed/staff notes across 114 rows, 22 blocked v2 rows unchanged, 20 excluded v1 rows unchanged. Zero approved, zero published. Per-row audited receipts: `artifacts/strategy-quality-amendments/issue-513/remediation-a/applied-2026-10-03.json`. This is a receipt, not another strategy store.

Production Daisy September Admin Client Preview now shows useful October draft direction about genuine gifts/table moments rather than canonical-client/evidence boilerplate. Clear reviewed draft status; client publication remains blocked. Existing September published Facebook metrics/coverage unchanged. Desktop 1536 and mobile 375 body/root match viewport; captured errors empty. Screenshots saved locally as `daisy-reviewed-strategy-desktop.jpg` and `daisy-reviewed-strategy-375.jpg`. Admin Preview is not actual client-role login acceptance.

## Freshness rollout (#451/#623)

Deployed full current-main runtime closures from `fea080ee3ccfd5cf6e2c4ae3fae1d506f3c6f781`, preserving original auth/import-map contracts:

| Function | Verified version | JWT | EZBR after first rollout |
| --- | --- | --- | --- |
| microsoft-transition-sync | 50 | true, captured root map preserved | `60c3002158e4c39bc92bd263961f3c927af951f138def94a627e9ecf77b360ce` |
| background-worker | 38 | false, existing internal auth | `4b764a7b4646864ffbaba18575350a6193622567c60564c8089d70336721b0c9` |
| meta-connection-status | 44 | false, existing role auth | `4a6ca2cdc9d7f1aafc45f641c84d39e578f2bb48a8121f00d80b04adbb3e5ab3` |

Older accepted rollback labels 39/27/33 differed from live labels 46/34/41, but exact file sets, LF-normalized contents, EZBR hashes, JWT and root-map configuration matched the accepted captures before deployment. All 44 full closure files matched accepted targets. Post-deploy complete source reads proved file/JWT/map parity. No other functions/cron/secrets/flags changed or manual trigger invoked.

### Real apply failure reproduced and repaired

Existing scheduler completed job `eac5b134-7e64-451d-9a65-02d1c6e26232` at 13:56:03 UTC: 6/6 sources, 7,575 records, zero pending details. Counts: Calendar 134, To Do 816, Master 182, CG Socials 497, July Client Socials 339, Client Schedule 5,607. This is fetch completeness, NOT terminal apply success.

Automatic run insertion omitted production's required `snapshot_exported_by` (text NOT NULL without default), causing HTTP 500 before any apply run. The tiny repair persists the canonical snapshot exporter and configured system requester, consistent with the existing manual contract. No schema changes. A production-NOT-NULL mock reproduced failure before the fix, then passed. Missing exporter fails closed with no run/RPC/mirror write. Crash/replay preserves original attribution and unique run/item audit semantics.

Read-only 14:00–14:10 observation: ten successful one-minute dispatches, zero fleet bootstrap batches/empty batches. Red Oak terminal permission cooldown expires 14:56:06 UTC; reads do not extend it. Permission blockage remains non-green. Dynamic fleet: 42 mapped assets, 66 checkpoints, 2,438 facts. No manual sync or access recovery performed.

Protected fingerprints at 13:54 and 14:12 unchanged:

| Scope | Count | SHA-256 |
| --- | --- | --- |
| monthly_deliverables | 3654 | `f18c14fd380427512ea5d71e13fa22f84cbd93e01f708118aa72a00189ae2de2` |
| native Planner | 4150 | `a76dcb6cc88b5b07315e1e58963b85e25972e795c9c450116de6629ab300489d` |
| native Calendar | 57 | `59139cec2f9dfff470472c27e5783f866a12f1c84a640ba5893a28841affcc00` |
| July manual runs | 10 | `d9e9ebd29b2c953d220f06f23a7f91968ea352c536d7849c2ce066cf11410d70` |

July manual applying run `1eb1aedc-e37e-4483-aab1-f0f3c3b29378` remains separate/not adopted. Bounded 13:57–14:03 logs showed zero new 546/CPU errors, but three Microsoft 500 responses for the insertion defect. Not a freshness PASS.

## Verification of narrow runtime repair

- 125 focused Microsoft/runtime/recovery/durability/schedule/freshness tests PASS.
- Full release suite: 3,587 total, 3,570 PASS, 17 skipped, zero failures. Existing Windows-hanging SES Bash fixture excluded/not claimed passed. Test-only loopback Supabase variables and installed Git OpenSSL PATH used; no production credentials.
- TypeScript/Vite 7.3.6 build PASS, 356 application modules; CG Dynamics application strings present in emitted chunks.
- Scoped ESLint and diff check PASS. Deno 2.9.6 Microsoft entrypoint/full local import type-check PASS with temporary check-only SDK/env declarations, removed afterward. Worker/status closure checks passed during initial rollout.
- Independent repository reviewer checklist: required insert attribution only; no other authority, data schema, upstream write or UI changes.

## Remaining genuine release gates

Terminal Microsoft apply must be observed after repaired helper is deployed; conflicts must remain partial, not forced green. The 22 blocked strategy rows need genuine evidence; approvals/publication remain separately authorized. 61 exact-client service agreements need review before premium service entitlements become authoritative. Provider owner/consent gates remain CA's #505 lane. Actual client-role browser acceptance needs legitimate client login, never admin/token substitution. #405 Website owner/DNS actions and parked onboarding are separate, not silently activated here.

No Microsoft writes occurred.
