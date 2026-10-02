# #513 Strategy quality Batch 3 — ZERO WRITE

Authority: [supervisor 5957232525](https://github.com/CGProductionHouse/CG-Dynamics/issues/513#issuecomment-5957232525),
[board 5957233655](https://github.com/CGProductionHouse/CG-Dynamics/issues/381#issuecomment-5957233655).
Base: current main `93bad42ef97fe975efc680a5ba44d0dd48e9685f`, including accepted
Batch 2 #643 `d8d9691cd068f7faaffc579237c8e665fe7d28ca`. No Batch 2 review repeated.

## Derived result

All ten prescribed clients have two separately reviewed monthly proposals, with no
substitution or stopped Batch 3 client. Zooz remains held and absent from selection.
The cumulative plan derives **94 reviewed / 62 amendment-needed / 32 blocked /
20 exclusions untouched / 0 approved / 0 published / 0 writes**.

These are agent-reviewed proposals, not staff approval or permission to amend.
Production retains its existing drafts. No RPC, migration, provider, shared-worker,
approval, publication or external client communication occurs in this lane.

| Exact client | Confirmed monthly format capacity | September retrospective / October forward direction |
| --- | --- | --- |
| C&L Innovations | 2 photos, 2 posters; **no recurring video** | Full piece, visible joinery and room scale / room-fit questions around a confirmed piece |
| Central Canvas | 1 video, 4 photos, 3 posters | Truck tarp vs cargo-net application clarity / staff-led truck-tarp enquiry preparation |
| Bouwer & Coetzee Attorneys | 1 video, 7 posters | Conveyancing consumer vs Deeds Office correspondent intent / general before-you-sign Q&A with separate antenuptial/correspondent lanes |
| We Ar Fuels | 1 video, 4 photos, 3 posters | Actual delivery/mobile-refuelling moment / farm/business fuel-planning questions without coverage or quantity promises |
| Novus Steel | 1 video, 4 photos, 4 posters | Actual fabrication/project stage / permitted drafting-to-fabrication example, not retail steel or engineering sign-off |
| Watch Addict | 1 video, 1 photo, 2 posters | Exact dial/wrist product recognition / confirmed model's design-to-wear story and matching website route |
| PSG Bloemfontein | 1 video, 3 posters | Local commercial vs personal insurance questions / general circumstances-change conversation, not individual advice or national investment services |
| Daisy & Co | 1 video, 3 photos, 3 posters | Actual gift/table context vs seasonal filler / confirmed shop-choice story without invented stock or ordering services |
| Supa Quick BFN | 1 video, 3 posters | Bloemfontein branch/process and alignment-vs-balancing clarity / locally confirmed in-store service question |
| Supa Quick Centurion | 1 video, 3 posters | Lifestyle tyre/wheel fitment context / vehicle/product enquiry preparation, no assumed broader service availability |

All unconfirmed numeric capacities remain null, not zero or inferred entitlement.
Older package-template counts do not override the current approved package receipt:
C&L's video exclusion and BFN's three-poster override remain authoritative.
History covers July/August and September MTD through 23 September, not a complete
September performance assessment. Exact report/post identities are cited and hashed;
no observed caption, winner, conversion, order or ROI result is invented.

## Evidence, useful context and remaining factual gates

Each proposal binds the exact dossier, substantive runtime guide with three literal
quotations, index and report history. All ten guides are present and substantive.
Sparse dossier research sections are not fabricated: useful direction comes from the
actual reviewed guide, not from a dossier's generic readiness label.

The packet records exact row/client/month identity, full live fingerprint, latest
revision receipt, strategy/seed/package hashes, notes and exact source receipts.
The plan contains current/proposed text, changed fields, approved package provenance,
staff preservation, expected revision and later idempotency key. These are guards,
not an execution instruction.

Still confirmation-gated before final creative uses mutable facts:

- C&L exact item/material/specification/buying route; no revived recovery ranges.
- Canvas repair/fitment/delivery facts and disputed named contact.
- Bouwer material legal statements and current service/website status.
- Fuels grades/coverage/quantities and current regional contact footer.
- Novus project permissions/specifications and technical scope.
- Watch exact model, price/stock/policy and website product route.
- PSG current local adviser/contact and compliance-reviewed statements.
- Daisy actual products/stock, ordering/flower/service availability and special hours.
- BFN exact branch availability/contact, Church Street address and Preller postal code.
- Centurion product/compatibility confirmation and approved footer; wider services
  remain unverified, never borrowed from another branch.

These limits do not prevent the bounded non-claiming proposals. They do prevent
inventing final offers, service promises or customer results.

## Preservation and verification

All **42 previously accepted rows** (Piek/Neshora, Batch 1, Batch 2) and all twenty
excluded records are serialized byte-identically to Batch 2. Prior packets still
build to their accepted hashes. Zooz remains blocked for both months; no guide is
invented. Staff notes/seed provenance, top-content context, calendar selections,
client direction and request notes are preserved.

Production SELECT snapshot: **2026-10-02 17:06:48.141418+00**, 114 rows / 114 latest
revision receipts; `assertNoDrift` against Batch 2 passes before authoring. All
generation takes place under local isolated artifact storage; frozen reviewed
artifacts are unchanged.

Regression coverage includes exact ten identities, paired month distinction,
held-client refusal, exact source binding/quotation/hash drift, package null/zero
capacity, client specificity, regulated/stock/safety claim rejection, foreign/internal
copy, actual cumulative compiler execution, complete staff/live/revision drift
refusal and byte-stable accepted/excluded records. No FakeSupabase logic clone.

## Durable artifacts

`artifacts/strategy-quality-amendments/issue-513/batch-3/`:

- `reviewed-copy.json`: individually authored direction keyed by exact client/month.
- `reviewed-overrides.json`: packet hash
  `181aa3a1103268d6f851499ed13195b5fd52c6ee914914e7953d6e857b9da74d`.
- `canonical-quality-amendment-plan.json`: plan hash
  `ccadbbf6db6c761929dfbf5ef62d94e81eda555ca2c0311e9eaf2b93a81afa21`.

## Reproduction and later protected action

Use a fresh SELECT snapshot in isolated local storage, retaining latest revision
`created_at::text`. Run the existing generators only with `CG_STRATEGY_ARTIFACT_DIR`
pointing to an isolated source copy, never their frozen default paths.

```text
node scripts/build-strategy-quality-batch.mjs 3
node scripts/build-strategy-quality-amendment-plan.mjs LIVE_SNAPSHOT ISOLATED_SOURCE_DIRECTORY artifacts/strategy-quality-amendments/issue-513/batch-1/reviewed-overrides.json artifacts/strategy-quality-amendments/issue-513/batch-2/reviewed-overrides.json artifacts/strategy-quality-amendments/issue-513/batch-3/reviewed-overrides.json
```

The cumulative compiler refuses any live predecessor drift before preserving its
accepted rows, and any changed accepted proposal cannot be silently replaced.
The existing `ISSUE-513-QUALITY-AMENDMENT-RUNBOOK.md` remains the later apply/readback/
rollback authority. Direct protected instruction, fresh source/live preflight and
staff review are still required. Refuse all 32 blocked rows; use only the canonical
context-amendment contract later. **No RPC is invoked here.**

No UI/runtime files change. Browser desktop/mobile product acceptance is not claimed.
Production build and exact-head Vercel preview validate bundle compatibility only;
they do not accept production strategies or authorize apply/approve/publish.

## Verification receipt

- Focused serial strategy/package/isolation regressions: 89 passed, zero failed or skipped.
- Production build (`tsc -b && vite build`): passed; existing bundle-size advisory only.
- Scoped lint: five changed JavaScript modules, zero errors or warnings.
- Diff whitespace check: passed.
- Final SELECT-only snapshot at `2026-10-02 17:21:52.438541+00`: all 114 strategy rows/latest revisions match the guarded cumulative plan; no live drift.
- Exact-head Vercel status is recorded in the draft PR and owning issue after push. No authenticated UI acceptance is claimed for this offline artifact lane.

Skills used: feature-implementer for scoped offline work; Supabase for SELECT-only
drift checks; Vercel deployments guidance for Git-triggered exact-head preview evidence.
