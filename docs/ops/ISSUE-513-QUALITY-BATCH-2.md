# #513 Strategy quality Batch 2 — zero-write review

Authority: supervisor [5956328254](https://github.com/CGProductionHouse/CG-Dynamics/issues/513#issuecomment-5956328254), Batch 1 merged main `2ce29344a78bcef5d4a96fd27a87a7a2699fb2ee`.

This is an offline reviewed proposal, **not staff approval or permission to apply**.
No amendment RPC, approval, publication, migration, provider or runtime action.

## Derived result

All ten prescribed identities assessed; nine clients have both months quality-reviewed.
Zooz Lifestyle WFF is stopped for both months, without substitution.
Full plan: **94 reviewed / 42 amendment-needed / 52 blocked / 20 exclusions untouched /
0 approved / 0 published / 0 writes**. The anticipated 44/50 is not forced.

Live SELECT snapshot: 2026-10-02 16:23:25.212492+00, 114 rows and 114 latest revision
receipts. Full row/revision checks match the accepted Batch 1 plan before drafting.
September history is frozen MTD through September 23, not a claim of complete month
coverage. Post identities are not creative-performance proof or package capacity.

| Exact client | Frozen Jul/Aug/Sep post identities | Confirmed monthly scope | September review / October forward intent |
| --- | --- | --- | --- |
| The Staffordshire | 20 / 15 / 12 | 4 video, 4 photo, 4 poster; extra posters on request without count; current specials Story + Facebook post | Expired announcements vs real venue/table/function context / distinct table and private-function invitation |
| Delta Gas | 13 / 15 / 12 | 1 video, 3 photo, 3 poster | Contents vs tare clarity / requirement-led cylinder enquiry |
| CG Production House | 15 / 16 / 9 | 4 video, 8 photo, 4 poster; 4 studio collaborations **within** 8 photos | Actual brief/production relationship / practical first-brief questions |
| RC-Polypipe | 13 / 14 / 12 | 1 video, 3 photo, 4 poster | Application and comparative-claim limits / field-context enquiry with qualified guidance |
| Zooz Lifestyle WFF | 37 total exact frozen identities | Recurring social confirmed, all fixed quantities unknown | **Both stopped**: absent exact runtime guide; dossier research observations have no exact findings |
| Peyper Bonds | 10 / 17 / 10 | 1 video, 3 photo, 3 poster | Originator/lender role boundary / better application-preparation questions, no advice or approval promise |
| Loraclox | 12 / 11 / 8 | 3 photo, 3 poster; video unknown | Current CCTV vs historical services / privacy-safe workmanship and specific system questions |
| Tobich Optics | 14 / 9 / 6 | 4 photo, 4 poster; video unknown | Exact Otjiwarongo frame identity vs performance assumptions / frame-choice and appointment enquiry |
| AV Event Life | 8 / 8 / 6 | 4 photo, 4 poster; management/captions included; video unknown | Actual technical contribution in past job / sound, visual and operator requirement questions |
| Braize | 8 / 2 / 12 | 4 photo, 4 poster; video unknown | Actual staffing task vs implied guarantees / organiser's concrete role requirement |

## Evidence and limitations

Each reviewed row binds exact dossier + substantive runtime guide + index + frozen
report history with normalized source hashes and literal quotations. Package receipt,
source references, original provenance, staff notes and full live revision guards are
captured in the 94-row plan. The packet records exact report IDs and post-list hashes.

Zooz dossier is present at
`artifacts/client-strategy-dossiers/issue-513/zooz-lifestyle-wff.md`; its package explicitly
confirms flexible recurring social management/content. This is **not** no-service or
zero-output truth. However, there is no
`runtime-guides/zooz-lifestyle-wff.md`, no substantive exact-client observations, and no
current brand/product/programme or event brief to resolve the requested creative
review. Stop both months until approved exact-client brand/voice and current
programme/event constraints exist. Do not improvise that guide or start new client
research here. Gap receipts are in the packet; no override exists for Zooz.

The other clients' unresolved mutable facts remain constraints, not invented facts:
Staffy menus/specials/events; Delta sizes/exchange/delivery/safety; RC units and
comparisons; Peyper current contacts/roles/banks; Loraclox contact conflict and historic
services; Tobich stock/specs/clinical modalities; AV footprint/inventory/events;
Braize availability/training/mobile-bar/contact freshness. These do not prevent the
bounded non-claiming directions, but factual final artwork needs current confirmation.

## Preservation and implementation

- Batch 1's 20 accepted rows and all four Piek/Neshora rows are byte-identical to the
  accepted Batch 1 plan. All 20 excluded fingerprints are identical.
- Top content, client direction, calendar selections, client request notes, seed
  context and internal notes remain untouched. Only the existing five reviewed
  creative fields can differ; no extra store or runtime strategy path.
- Existing builder supports bounded batch 2 and cumulative packets. Prior packet
  hashes remain attached to their original rows, so cumulative compilation does not
  silently re-sign Batch 1.
- Exactly 18 new overrides plus the two explicit gap months account for the ten
  requested clients. The exception is exact and cannot become arbitrary skipped rows.
- Conservative unsupported-claim regression gate supplements human source review;
  it is not a general claim-verification engine or a substitute for staff review.

## Artifacts and hashes

Directory: `artifacts/strategy-quality-amendments/issue-513/batch-2/`.

- Reviewed copy hash: `d8ae25beeb8dc650a51a29b785ca3a1d926c7d7813cf6f84c2ec65df96fae3c5`
- Batch 2 packet: `e30210b55ba1d328bfd69b55daa10944cb1faebd03088f2c0b57ea8b5b9f648a`
- Full cumulative plan: `336979000c9074496bfbcead8f55653349a2fd84e902b23aa3dfebcadd7bb518`
- Unchanged Batch 1 packet: `96d5b773358c20b3c58829474da7575f68f3bc1e6f43eaf1c6020c97cca3724b`

## Reproduction and later protected gates

Use an isolated source-copy directory outside frozen reviewed artifacts. Set
`CG_STRATEGY_ARTIFACT_DIR` to that directory for the existing dry-run and #567 generators;
never run their defaults against frozen reviewed storage.

```text
node scripts/build-strategy-quality-batch.mjs 2
node scripts/build-strategy-quality-amendment-plan.mjs LIVE_SNAPSHOT ISOLATED_SOURCE_DIRECTORY artifacts/strategy-quality-amendments/issue-513/batch-1/reviewed-overrides.json artifacts/strategy-quality-amendments/issue-513/batch-2/reviewed-overrides.json
```

Use a fresh authorized SELECT snapshot, including database fingerprint and latest
revision receipt with `created_at::text`; keep raw snapshot in local isolated artifact
storage, not GitHub. Run `assertNoDrift` against the accepted predecessor and the
generated plan. Any staff, identity, package, provenance, status or source change stops
the affected review; no automatic rebase.

The existing `ISSUE-513-QUALITY-AMENDMENT-RUNBOOK.md` remains the later guarded
apply/readback/rollback authority. Its explicit protected-action gate is unchanged.
**Do not invoke the RPC from this batch.** A later authorized execution must refuse
all 52 blocked rows, use exact expected version/idempotency receipts, re-read every
changed row and prove all excluded/accepted protected rows untouched. No approval or
publication is implied by quality-review status.

No client routes or UI changed; desktop/mobile browser acceptance is not claimed.
Build and exact-head Vercel preview verify the unchanged application still bundles;
they do not accept production data or authorize application.

Local verification: 80/80 focused strategy/package/isolation regressions; scoped
Node ESLint across five changed modules/tests, 0 errors/0 warnings; production build
(`tsc -b && vite build`) and diff check pass. Second production SELECT at
2026-10-02 16:44:31.453547+00 passes full plan `assertNoDrift` for all 114 rows and
latest receipts. No live strategy change detected.

The branch was fast-forward reconciled with subsequent main
`2c27e74fe0d798fdffff877d358a0fa13f355292`. Its Meta worker fix is inherited only;
this PR edits no provider/shared-worker file. Final tests/build are rerun on that base.
