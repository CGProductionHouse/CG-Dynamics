# #513 strategy quality Batch 1 — zero writes, not staff approval

Authority: supervisor comment 5955302997, main `cbf21ca5cbcb699bd09fb2d8341f7127b4415caa` (#638).
Read-only production snapshot: 2026-10-02 15:17:53.743095+00.
All 114 live row/package fingerprints and 94 durable amendment receipts match
the #638 baseline. Timestamp text in the revision SELECT uses `created_at::text`
to preserve the baseline's exact representation; no drift guard was relaxed.

## Selection and actual monthly review

Exactly ten previously blocked clients qualify with confirmed package receipts,
ready exact-client dossiers/guides, three frozen Jul/Aug/Sep reports, and useful
product/service/brand constraints. Rank frozen post identity coverage descending,
UUID as tie-breaker. Coverage ranks evidence availability, NOT creative success.
`reviewed-overrides.json` records the qualifying ranking and selected exact IDs.

| Client | Frozen Jul/Aug/Sep post identities | September review | October forward intent |
| --- | --- | --- | --- |
| Bloem Marble & Granite | 108 / 110 / 59 | Slab/veining versus finished-room clarity | Worktop and vanity quotation conversations |
| Cape Lumber | 47 / 35 / 33 | Supply/specification clarity, not contracting | Timber-list and board-specification enquiries |
| SecuriForce | 27 / 46 / 34 | Separate guarding, monitoring and technical service context | Service-specific question and handoff stories |
| Madison Wear | 35 / 32 / 24 | Actual garment/outfit versus general retail presentation | Real outfit details and in-store assistance |
| Case Bloemfontein | 45 / 16 / 26 | Machine/application, local parts and historical-event distinction | Application-led machinery/parts enquiry sequence |
| Germoparts | 28 / 34 / 23 | Part identification and branch-route clarity | Vehicle/part-number questions and exact branch handoff |
| Wiseman Group | 25 / 22 / 27 | Real group people/office context, not child-business offers | One coherent group office/team story |
| Emmanuel Funerals | 24 / 20 / 15 | Helpful next steps versus sympathy slogans | Calm documentation/arrangement explanations |
| Dulux Paint & Paper Bloemfontein | 20 / 18 / 14 | Room/light colour context, without digital-match claims | Physical swatch and surface-preparation questions |
| TBS Brokers | 17 / 21 / 11 | Retirement and useful broker questions, not advice/returns | Office-contents questions and approved broker conversation |

September report history is **MTD as of 23 September**, not a complete month.
Frozen included-post IDs establish existence and coverage; they do not contain
reliable captions, format classification, winners, conversions or ROI. Counts
are platform post identities, not monthly deliverable quantities. Proposals
therefore ask for classification/comparable available response rather than
inventing previous performance. Historical models, offers, prices and events
are never carried forward as current stock, availability or recurring events.

The authored `batch-1/reviewed-copy.json` contains twenty separately reviewed
directions: objective, audience/intent, message, pillars/hooks, format rationale,
test/success signals, game plan, client actions, constraints and action items.
This is agent quality review only, not client/staff sign-off or publication.
Concept lists fit confirmed capacities; shorter lists are focus angles, not
a claim that the remaining package slots were scheduled or removed.
TBS's flexible design-to-video swap remains flexible: no fixed video entitlement.

## Deterministic artifacts and guards

New artifacts live ONLY under `artifacts/strategy-quality-amendments/issue-513/batch-1/`:

- `reviewed-copy.json`: human-readable reviewed copy, exact client + month.
- `reviewed-overrides.json`: deterministic twenty-row source/identity/guard packet.
- `canonical-quality-amendment-plan.json`: complete 94-row current/proposed diff.

Derived plan: **24 amendment-needed / 70 blocked / 0 already-equal**, 20 excluded
fingerprints unchanged, 0 approved / 0 published. The original #638 four accepted
Piek/Neshora proposal rows remain byte-for-byte equal. Neshora #546, exact 1/4/4,
all unknown/null/zero/flexible scope, staff notes and seed provenance are intact.

Pinned plan hash: `9ebcae3ea26a7201fb6856157b03b5d8199836629f604817804e055318493716`.
Pinned override packet: `96d5b773358c20b3c58829474da7575f68f3bc1e6f43eaf1c6020c97cca3724b`.
Post-verification SELECT readback confirms 114/114 strategy, package and exact
client identity fingerprints unchanged; no protected write was performed.

The remaining 70 rows are not accepted copy. Their exact stop reasons remain
in the full plan: mandatory client-specific quality review, plus any existing
internal/foreign-copy defects. No rename-based blanket blocker removal.

The compiler consumes an optional pinned packet, checks packet/row/source hashes,
literal guide references, paired exact months, meaningful monthly distinction,
client-specific anchors, patch-field whitelist and package capacities. Existing
live hash/revision/provenance guards still run; full-row/package/notes/revision
drift refuses overrides. Unreviewed rows retain their blocker. No runtime code,
provider, calendar, reporting or strategy store is added.
Source file digests normalise CRLF to LF for reproducible Windows/CI content
identity; semantic changes still fail the digest check.

## Reproduction (offline)

1. `node scripts/build-strategy-quality-batch.mjs` regenerates the packet from
   the committed exact copy, #638 baseline and frozen cited sources.
2. Copy the frozen dossier directory into NEW isolated storage. Set
   `CG_STRATEGY_ARTIFACT_DIR` to that copy. Run the existing mutation dry-run and
   #567 quality generators there. Never overwrite any frozen reviewed artifact.
3. Obtain an authorised SELECT-only snapshot in the existing #638 input shape.
   Run `assertNoDrift` against the baseline before compilation. Include the
   latest exact revision receipts with `created_at::text`.
4. Run:

   ```text
   node scripts/build-strategy-quality-amendment-plan.mjs LIVE_SNAPSHOT ISOLATED_DIRECTORY artifacts/strategy-quality-amendments/issue-513/batch-1/reviewed-overrides.json
   ```

5. Inspect real derived counts and pin `plan_hash`. A changed source, package or
   staff row requires a new supervised review, never automatic rebasing.

## Later protected apply / readback / rollback

The exact existing [#638 guarded runbook](ISSUE-513-QUALITY-AMENDMENT-RUNBOOK.md)
remains the contract. Substitute THIS batch plan's pinned hash and specifically
authorised eligible row IDs. Do not run its steps in this zero-write lane.

Before any separately authorised amendment, fresh-read all 114 rows, revisions,
packages and client identity; require `assertNoDrift(batchPlan, freshSnapshot)`.
Use only `amend_monthly_client_strategy_with_context` with the plan's exact
client/month, expected v2, full proposed payload, unchanged notes/seed context,
verified real actor and deterministic row-specific idempotency key. Read back
draft v3, exact proposed hash and revision receipt, nil approval/publication,
unchanged excluded fingerprints. A timeout requires exact receipt lookup before
identical retry. Stop the batch on any failure or later staff edit.

Rollback is separately authorised, one exact compensating amendment at expected
v3 with the original captured payload and a distinct deterministic rollback key;
never direct UPDATE/delete, version reset or wholesale stale restore. Preserve
the durable audit and verify draft v4/readback. Approval/publication are separate
protected actions; no operation here invokes an amendment RPC or write tool.

## Verification

- 72/72 tests: exact batch compiler integration, monthly distinction, source
  readback, specificity/internal-copy refusal, package/unknown/zero/flexible
  truth, exact client/month isolation, staff/revision drift, unchanged accepted
  corrections and exclusions, #567, #546 and canonical strategy contracts.
- `npm run build`: TypeScript and Vite 7 production build green; existing
  >500 kB bundle warning remains, no production dependency/runtime change.
- Scoped ESLint for all five changed Node modules/tests: zero warnings/errors
  using Node globals (repo default lint scope covers TypeScript only).
- `git diff --check` clean; original frozen artifacts untouched.
- No desktop/mobile interaction performed: offline evidence/compiler only,
  no UI, routes or authenticated product flow changed. Vercel preview status
  is reported on the PR, not claimed as live draft acceptance or DB rollout.
