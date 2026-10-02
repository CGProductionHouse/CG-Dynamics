# #513 quality amendments — evidence only, NOT apply authorisation

## Captured truth and isolated artifacts

Base main: `820d1bd98a4b6576500da779a0ba2e496fb86b10`.
Production SELECT snapshot: **2026-10-02 14:47:42.384012+00**. Read project:
`ehtjfntukiwbgptqgbzy`. No mutation, migration, transition or provider operation.

The new offline compiler is `scripts/build-strategy-quality-amendment-plan.mjs`.
It has no network or apply mode. It refuses the frozen reviewed directory,
including resolved symlink targets. All generators were run with
`CG_STRATEGY_ARTIFACT_DIR` pointing to isolated storage. The existing #567
artifact is regenerated, not silently reclassified or rewritten in place.

Durable review files are under `artifacts/strategy-quality-amendments/issue-513/`:

- `canonical-quality-amendment-plan.json`: exact 94-row before/after plan;
- `issue-567-regenerated-quality-readiness.json`: unchanged generator's result.

Raw live snapshots remain local at
`C:/Users/chris/.codex/artifacts/issue-513/2026-10-02-quality-plan/`.
They are not an application store or a new strategy authority.

The plan explicitly separates the committed #567 candidate hash from the final
proposal hash. **4 amendment-needed / 0 already-quality-equal / 90 blocked**.
All 94 live strategy/provenance hashes match the original reviewed manifest;
114 latest revision records corroborate 94 amended v2 / 20 excluded v1.
Approved and published counts remain zero.

Piek's two corrections use its existing operational guide, not generated research:
four distinct Piek/Engen/Sasol/Get Together modes, branch/partner separation,
restaurant rather than convenience-stop positioning, four videos/twelve posters,
and no invented offers, contacts or allocations. This is a **new proposed quality
correction requiring review**, not a claim that #567's original generic caption
guidance was adequate.

Neshora's two amendments only remove internal evidence terminology from six
copy fields. Preserve #546 hash
`376630a6efc1dc5b008b25d4808832b9f8a384226c9974fb6ff3f1c36237ec33`,
the full live seed context and staff notes, **1 video / 4 photos / 4 posters**,
and unknown/null reel/animated/campaign quantities. No new facts or scope.

The other 90 rows are **rejected candidates, not client-safe approved copy**.
#567's jargon regex and caption-process directions do not demonstrate useful
client-specific monthly strategy. Each row contains exact blockers and diffs;
some additionally contain internal or foreign-client wording. Do not auto-clear
them, run a rename-based template repair, or apply the fleet wholesale.

## Reproduce without production access

1. Copy the frozen `artifacts/client-strategy-dossiers/issue-513` directory into
   a new isolated directory. Never overwrite that frozen source.
2. Set `CG_STRATEGY_ARTIFACT_DIR` to the isolated copy; run the existing
   `build-client-strategy-mutation-dry-run.mjs` and
   `build-issue-567-strategy-quality-readiness.mjs` generators.
3. Supply a separately obtained authorised read-only snapshot, including exact
   Sep/Oct rows, client names/active flags, package settings, and latest revision
   identities. Run:

   ```text
   node scripts/build-strategy-quality-amendment-plan.mjs LIVE_WITH_REVISIONS_JSON ISOLATED_DIRECTORY
   ```

4. Verify every regenerated candidate hash against the committed #567 artifact.
   The compiler blocks proposal drift; it does not assume regeneration proves
   authority. Review Piek/Neshora's separately recorded corrections.
5. Pin the resulting `plan_hash`. Never use this artifact with the old original
   `apply-reviewed-client-strategies.mjs` runner: its v1→v2 contract is different.

## Later guarded apply — separate protected approval REQUIRED

This session must NOT execute any of these steps. No apply runner is introduced.

1. Supervisor reviews exact before/after copy and package receipt for each
   specifically selected row, then CA explicitly authorises the exact artifact
   hash and row IDs. Blocked rows are ineligible. Approval/publication remains
   a different gate; this authorises draft amendment only.
2. Confirm the real actor profile exists and satisfies the existing canonical
   `resolve_monthly_strategy_actor` authority. Never fabricate a service actor.
3. Freshly re-read all 114 rows plus latest revisions and exact packages. Invoke
   offline `assertNoDrift(plan, freshSnapshot)` with the pinned plan. Any added,
   missing, duplicated, changed revision/row/package/provenance/note/status or
   protected-row fingerprint stops the whole operation for reconciliation.
4. For ONE reviewed eligible row, build the existing
   `amend_monthly_client_strategy_with_context` request from the pinned artifact:

   | RPC argument | Exact plan source |
   | --- | --- |
   | `p_client_id` | `row.client_id` |
   | `p_strategy_month` | `row.strategy_month` |
   | `p_expected_version` | `row.later_guard.expected_version` (2) |
   | `p_strategy_data` | `row.proposed_strategy_data` |
   | `p_seed_context` | unchanged `row.later_guard.seed_context` |
   | `p_internal_notes` | unchanged `row.later_guard.internal_notes` |
   | `p_actor_profile_id` | separately verified authorised actor |
   | `p_idempotency_key` | `row.later_guard.idempotency_key` |

5. Re-read immediately. Require exact row/client/month, draft version **3**,
   proposed strategy SHA-256, identical seed-context hash and internal notes,
   null approval/publication and published payload. Require the exact amended
   revision ID/key/actor/version and before/after strategy plus receipt provenance.
   Check all 20 non-applicable fingerprints again. Any failure stops immediately.
6. After an ambiguous timeout, inspect the durable revision by exact strategy
   ID + deterministic key. Retry only the IDENTICAL request, including original
   expected version. The RPC checks idempotency before version and returns the
   same receipt with `replayed=true`; never generate another key to mask failure.
7. Continue only through explicitly approved IDs. Track each receipt separately;
   the RPC is atomic per row, **not a fleet transaction**. Stop on any failure.

## Rollback / cleanup — separately approved compensating amendment only

1. Never delete audit rows, reset versions, run direct UPDATEs, or restore a
   stale fleet snapshot. Record exactly which authorised rows committed.
2. Fresh-read one committed row. Require draft v3, the pinned proposed hash,
   unchanged provenance/notes/package and no later staff edit. If any state
   drifted, STOP; do not overwrite staff work.
3. After explicit rollback approval, use the same canonical amendment RPC with
   expected version **3**, `current_strategy_data` from the pinned plan, unchanged
   captured seed context/notes, verified actor, and a new deterministic key
   derived from `513-quality-rollback:<plan_hash>:<row_id>:3:<original_hash>`.
4. Re-read draft **v4**, restored original payload hash, identical provenance
   and notes, and its compensating revision receipt. Versions/timestamps and
   history intentionally advance; this is not byte-for-byte history erasure.
5. Reconfirm 20 exclusions unchanged and approved/published zero. Keep both
   receipts. A retry uses the same rollback request/key; no destructive cleanup.

## Limits

No browser or device acceptance is relevant to an offline-only compiler and
runbook; no application UI or runtime was changed. The four proposal candidates
still require human quality acceptance. Ninety rows require client-specific
monthly direction, not another blanket quality-pass assertion. Production,
Content Autopilot flags, providers, entitlement UI, Website and master handover
remain untouched.
