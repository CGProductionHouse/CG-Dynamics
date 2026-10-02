# #513 targeted Wave A quality review — ZERO WRITE

Authority: [supervisor overnight order](https://github.com/CGProductionHouse/CG-Dynamics/issues/513#issuecomment-5958838698). This is not Batch 5, staff approval, publication, report recovery or production application.

## Exact scope and readback

Only Bat Hill Royale and All Around PVC, September and October 2026. Both months are reviewed separately: September is retrospective using stored, incomplete history; October proposes distinct forward creative choices without inventing current offers or scheduled work.

- Evidence cutoff: `2026-10-02 18:21:47.231952+00`; accepted Wave A SELECT source hash `39dcf9c7809afe9ced5c855d383ab1b3ba3bfff1607ac86d2ad88f75acb4226e`.
- Fresh strategy SELECT cutoff: `2026-10-02 18:43:14.563827+00`; all 114 identities/revisions pass the predecessor drift check.
- Bat Hill: July unavailable; August 20 stored identities; September 25, of which four fall after the published report's September 23 cutoff. Flexible recurring social scope remains flexible: no fixed format allocations.
- PVC: July unavailable; August one exact Pacific-month identity (September 1 UTC is still August); September 14 stored identities is not proof of a complete published month. Exact capacity remains one video, three photo posts, three design posters; other unknown capacities stay disabled.
- Canonical cumulative proposal plan: 94 rows / 47 clients; **72 amendment-needed, 22 blocked**; all 68 accepted predecessors byte-stable, all 20 non-applicable exclusions untouched; zero approved/published/writes.
- Packet hash: `e55b6f0f7de7bf0809c65f10224aa2cf7163f3a0969ce0ba11e24220ac4ca118`.
- Plan hash: `bb50da38748b62ef26e4bf73f618ea223629fc7edde3e687b5b0a121b60542c1`.

The isolated `artifacts/strategy-quality-amendments/issue-513/remediation-a/` directory contains exact SELECT evidence, reviewed creative copy, the compiler packet, cumulative plan and remaining blocked inventory. Frozen reviewed dossier/manifest/proposal artifacts are never regenerated in place.

## Reproduce and verify

1. Obtain a SELECT-only snapshot of exact active September/October canonical strategy rows and latest durable revisions using the predecessor #638 runbook. No amendment RPC, sync or report generation.
2. Copy the frozen dossier directory into isolated artifact storage. Run the existing mutation dry-run and #567 quality generators against that copy with `CG_STRATEGY_ARTIFACT_DIR` pointing there, never at frozen storage.
3. Run `node scripts/build-strategy-quality-remediation.mjs SELECT_SNAPSHOT ISOLATED_REGENERATED_DIRECTORY`. The script has no credentials, network or apply path. It refuses predecessor row/revision/package/provenance drift before compilation.
4. Run `node --test tests/strategyQualityRemediation.test.mjs tests/strategyQualityBatch4.test.mjs tests/strategyQualityBatch3.test.mjs tests/strategyQualityBatch2.test.mjs tests/strategyQualityBatch.test.mjs tests/strategyQualityAmendmentPlan.test.mjs`, full serial regressions with existing test-only Supabase environment, scoped ESLint, `npm run build`, `git diff --check`, then exact-head Vercel preview.
5. Inspect the exact diff and hashes. Preserve older batch packet bytes, client-owned notes/seed context and all exclusions. Merging these offline artifacts does not activate or apply anything.

## Protected later action

Any later production amendment requires separate CA authority and the existing canonical amendment/readback/rollback runbook. Re-read the exact row/revision, reviewed hash, package verification receipt, original provenance and source hashes immediately before a separately authorised action. Use the plan's exact expected-version/fingerprint/idempotency guards; refuse any drift rather than rebasing over staff edits. No approval or publication is implied. This PR does not invoke that RPC or create another strategy/report store.

Held clients remain held. Missing post/report evidence is unavailable, never zero performance. Future mutable service/offer/contact/technical claims require exact current client confirmation; historical posts and provider mappings cannot supply it.
