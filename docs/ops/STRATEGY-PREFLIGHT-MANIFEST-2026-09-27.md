# Zero-Write Production Preflight/Apply Manifest
## Frozen 92 Reviewed Fleet Rows + Neshora Exact Two-Row Amendments

**Authority**: Issue #550, PR #546 evidence, frozen reviewed fleet plan
**Status**: READ-ONLY PREFLIGHT MANIFEST — NO PRODUCTION WRITES
**Prepared**: 2026-09-27
**Plan Hash (frozen fleet)**: `4f84133b981aa449b0805fc11424c06f8acb2ec73b72cedcc0795a83502fef6b`
**Neshora Amendment Plan Hash**: `4e709c3af9aa3ba46175db2fa5527772bb03e1468f78e3389209bacd82d9ddaf`
**Source Snapshot Cutoff**: `2026-09-23T17:46:08.174Z`
**PR #546 Evidence Hash**: `376630a6efc1dc5b008b25d4808832b9f8a384226c9974fb6ff3f1c36237ec33`

---

## 1. Migration / Runtime Dependencies

### 1.1 Required Migration (Protected Gate — NOT APPLIED)
- **Migration**: `20260923193000_monthly_strategy_context_amend.sql`
- **Function**: `amend_monthly_client_strategy_with_context(uuid, date, integer, jsonb, jsonb, text, uuid, uuid)`
- **Grants**: `EXECUTE` to `authenticated`, `service_role`; **NO** `anon` grant
- **Status**: Migration file on `main`; **production application requires explicit CA approval**
- **Gate**: This migration must be applied and ledgered before any strategy amendment

### 1.2 Runtime Prerequisites
- RPC `amend_monthly_client_strategy_with_context` deployed and verified in production
- `monthly_client_strategies` table exists with `workflow_status`, `version`, `seed_context`, `staff_amended_at`
- `monthly_client_strategy_revisions` append-only table with `idempotency_key` unique constraint per `strategy_id`
- `resolve_monthly_strategy_actor` and `assert_monthly_strategy_input` helpers active
- Advisory lock namespace: `monthly-strategy:{client_id}:{strategy_month}`

---

## 2. Exact Live Preconditions (Preflight Verification)

### 2.1 Frozen Reviewed Fleet — 46 Clients / 92 Rows (Sep + Oct 2026)

| Field | Expected Value |
|-------|----------------|
| **Plan Hash** | `4f84133b981aa449b0805fc11424c06f8acb2ec73b72cedcc0795a83502fef6b` |
| **Source Snapshot** | `2026-09-23T17:46:08.174Z` |
| **Total Clients** | 46 recurring-social eligible |
| **Total Rows** | 92 (46 × Sep + 46 × Oct) |
| **Non-Applicable Rows** | 20 (10 non-social clients × 2 months) — remain unchanged |
| **All 112 Source Rows** | Draft, staff-unamended (`version = 1`, `staff_amended_at IS NULL`) at cutoff |
| **Ready Rows** | 92 — full 10-field `goldStandard`, package provenance, strategy/seed hashes |

**Preflight Check (must pass 100% before any apply):**
- [ ] Query production: `SELECT COUNT(*) FROM monthly_client_strategies WHERE strategy_month IN ('2026-09-01','2026-10-01') AND workflow_status = 'draft' AND version = 1 AND staff_amended_at IS NULL` → **112**
- [ ] Verify 92 rows match reviewed plan hash via deterministic recomputation
- [ ] Verify 20 non-applicable rows byte/fingerprint-equivalent to frozen preconditions
- [ ] Zero approved/published rows in Sep/Oct 2026

### 2.2 Neshora Oxygen — Two Existing Rows (Must Amend, NOT Create)

| Month | Strategy ID | Current Version | Current Status | Action |
|-------|-------------|-----------------|----------------|--------|
| 2026-09-01 | `345ff5dc-a669-4e71-8312-e11472a3494f` | v1 | draft | Amend to v2 |
| 2026-10-01 | `c4db3ace-ceed-4c8f-99cb-2841edf12613` | v1 | draft | Amend to v2 |

**Preflight Check (must pass 100% before any apply):**
- [ ] Both rows exist in production with exact IDs above
- [ ] Both are `workflow_status = 'draft'`, `version = 1`, `approved_at IS NULL`, `published_at IS NULL`
- [ ] Zero duplicate Neshora rows for Sep/Oct 2026
- [ ] Package verified: **1 professional video / 4 photo posts / 4 design posters** confirmed
- [ ] `PACKAGE_UNVERIFIED` blocker absent
- [ ] PR #546 evidence hash `376630a6efc1dc5b008b25d4808832b9f8a384226c9974fb6ff3f1c36237ec33` preserved in `seed_context.intelligence_evidence`

---

## 3. Deterministic Idempotency Keys

### 3.1 Frozen Fleet (92 Rows) — One Key Per Amendment
**Algorithm**: `SHA-256("reviewed-fleet-amend:{client_id}:{strategy_month}:{plan_hash}")` → UUIDv4 format

**Example (Client `abc...`, Sep 2026):**
```
Input: "reviewed-fleet-amend:abc123...:2026-09-01:4f84133b981aa449b0805fc11424c06f8acb2ec73b72cedcc0795a83502fef6b"
SHA-256: a1b2c3d4e5f6...
Key:   a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5
```

**Properties:**
- Derived from immutable plan hash + client + month → **deterministic, replay-safe**
- Unique per `(client_id, strategy_month)` — no collisions across fleet
- Stored in `monthly_client_strategy_revisions.idempotency_key`
- Replay returns `{replayed: true, ...}` without mutation

### 3.2 Neshora Oxygen (2 Rows) — One Key Per Amendment
**Algorithm**: `SHA-256("neshora-amend:{strategy_id}:{evidence_hash}")` → UUIDv4 format

| Month | Strategy ID | Idempotency Key (Deterministic) |
|-------|-------------|----------------------------------|
| 2026-09-01 | `345ff5dc-a669-4e71-8312-e11472a3494f` | `SHA-256("neshora-amend:345ff5dc-a669-4e71-8312-e11472a3494f:376630a6efc1dc5b008b25d4808832b9f8a384226c9974fb6ff3f1c36237ec33")` → `b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6` |
| 2026-10-01 | `c4db3ace-ceed-4c8f-99cb-2841edf12613` | `SHA-256("neshora-amend:c4db3ace-ceed-4c8f-99cb-2841edf12613:376630a6efc1dc5b008b25d4808832b9f8a384226c9974fb6ff3f1c36237ec33")` → `c3d4e5f6-a7b8-4c9d-0e1f-a2b3c4d5e6f7` |

**Properties:**
- Bound to **exact existing strategy ID** + **immutable evidence hash** — prevents duplicate creation
- Replay-safe: re-running with same key returns existing receipt

---

## 4. Order of Operations (Atomic Per-Row, Sequential Fleet)

### Phase 0: Preflight Verification (Read-Only)
1. Verify migration `20260923193000_monthly_strategy_context_amend.sql` applied in production
2. Verify RPC `amend_monthly_client_strategy_with_context` executable by `authenticated`/`service_role`
3. Run full preflight checks (§2.1, §2.2) — **abort on any mismatch**
4. Verify zero approved/published rows in Sep/Oct 2026

### Phase 1: Frozen Fleet — 92 Rows (Batch, Deterministic Order)
**Order**: Sort by `client_id` ASC, then `strategy_month` ASC (Sep before Oct per client)

For each of the 92 rows:
1. Acquire advisory lock: `pg_advisory_xact_lock(hashtextextended('monthly-strategy:' || client_id || ':' || strategy_month, 0))`
2. `SELECT * FROM monthly_client_strategies WHERE client_id = ? AND strategy_month = ? FOR UPDATE`
3. Verify `version = 1`, `workflow_status = 'draft'`, `staff_amended_at IS NULL`
4. Compute `request_fingerprint` = `MD5({client_id, strategy_month, expected_version=1, strategy_data, seed_context, internal_notes})`
5. Check `monthly_client_strategy_revisions` for existing `idempotency_key`:
   - If exists with **same fingerprint** → return replay receipt, continue
   - If exists with **different fingerprint** → **ABORT** (idempotency collision)
6. Execute `amend_monthly_client_strategy_with_context` with:
   - `p_expected_version = 1`
   - `p_strategy_data` = reviewed plan `strategyData` (10-field goldStandard)
   - `p_seed_context` = reviewed plan `seedContext` (includes package provenance, evidence hash)
   - `p_internal_notes` = `Reviewed fleet amendment per plan 4f84133b...`
   - `p_actor_profile_id` = authorized staff/system profile
   - `p_idempotency_key` = deterministic key from §3.1
7. Capture receipt: verify `replayed = false`, `version = 2`, `workflow_status = 'draft'`, `staff_amended_at` set
8. Verify revision row inserted with `event_kind = 'amended'`, `record_version = 2`

### Phase 2: Neshora Oxygen — 2 Rows (Exact IDs, Exact Evidence)
**Order**: Sep 2026 first, then Oct 2026

For each row:
1. Acquire advisory lock on exact `strategy_id`
2. `SELECT * FROM monthly_client_strategies WHERE id = ? FOR UPDATE`
3. Verify exact `strategy_id` matches §2.2 table
4. Verify `version = 1`, `workflow_status = 'draft'`
5. Compute `request_fingerprint` per RPC spec (includes `seed_context` with PR #546 evidence hash)
6. Check revision table for idempotency key from §3.2 — replay or abort on collision
7. Execute `amend_monthly_client_strategy_with_context` with:
   - `p_strategy_data` = Neshora reviewed amendment (10/10 goldStandard fields)
   - `p_seed_context` = updated with PR #546 evidence hash, package provenance (1 video/4 photo/4 design)
   - `p_internal_notes` = `Neshora Oxygen amendment per PR #546 reviewed intelligence`
   - `p_idempotency_key` = deterministic key from §3.2
8. Capture receipt: verify `version = 2`, `workflow_status = 'draft'`, `PACKAGE_UNVERIFIED` absent
9. Verify revision row with `event_kind = 'amended'`, evidence hash preserved

### Phase 3: Post-Write Proof (Read-Only Verification)
Run after all 94 amendments complete:

| Check | Expected | Query Pattern |
|-------|----------|---------------|
| Total Sep/Oct rows | 114 | `COUNT(*) WHERE strategy_month IN ('2026-09-01','2026-10-01')` |
| Staff-amended v2 (fleet) | 92 | `COUNT(*) WHERE version = 2 AND staff_amended_at IS NOT NULL AND client_id IN (fleet_46)` |
| Staff-amended v2 (Neshora) | 2 | `COUNT(*) WHERE id IN ('345ff5dc...','c4db3ace...') AND version = 2` |
| Non-applicable unchanged | 20 | `COUNT(*) WHERE version = 1 AND staff_amended_at IS NULL AND client_id IN (non_social_10)` |
| Approved rows | 0 | `COUNT(*) WHERE approved_at IS NOT NULL` |
| Published rows | 0 | `COUNT(*) WHERE published_at IS NOT NULL` |
| Fleet strategy_data hashes | Match plan | Recompute hash per row → equals reviewed plan |
| Fleet seed_context hashes | Match plan | Recompute hash per row → equals reviewed plan |
| Neshora evidence hash | `376630a6...` | `seed_context->'intelligence_evidence'` contains hash |
| Neshora package provenance | 1 video/4 photo/4 design | `seed_context->'sources'->'package_verification_confirmed_at'` present |
| Revision receipts (fleet) | 92 `amended` | `COUNT(*) FROM revisions WHERE event_kind='amended' AND strategy_month IN (...)` |
| Revision receipts (Neshora) | 2 `amended` | `COUNT(*) FROM revisions WHERE strategy_id IN (...)` |
| Idempotency keys verified | 94 unique | All 94 keys present in revisions, no collisions |

---

## 5. Stop Conditions (Hard Abort Triggers)

**Any single failure aborts the entire apply — no partial commits:**

| Condition | Action |
|-----------|--------|
| Migration not applied in production | **ABORT** — require CA approval to apply migration first |
| RPC missing or permission denied | **ABORT** |
| Preflight row count mismatch (§2.1, §2.2) | **ABORT** — investigate drift |
| Any row not `draft`/`version=1` (fleet) or not matching exact ID (Neshora) | **ABORT** |
| Idempotency key collision with different fingerprint | **ABORT** — data integrity violation |
| Version conflict (`expected_version` mismatch) | **ABORT** — concurrent modification detected |
| `PACKAGE_UNVERIFIED` blocker present on any target row | **ABORT** — package must be confirmed first |
| Any `approved_at` or `published_at` non-null in Sep/Oct 2026 | **ABORT** — approval/publication is separate gate |
| Revision insert fails (append-only trigger) | **ABORT** |
| Post-write proof mismatch (any check in §4 Phase 3) | **ABORT** — rollback not possible; requires manual investigation |

---

## 6. Post-Write Proof Artifacts (Durable Evidence)

Upon successful completion, the following **must exist and be verifiable**:

1. **92 Fleet Amendment Receipts** — one per row in `monthly_client_strategy_revisions` with:
   - `event_kind = 'amended'`, `record_version = 2`
   - `before_strategy_data` = frozen v1, `after_strategy_data` = reviewed v2
   - `idempotency_key` matches §3.1 deterministic derivation
   - `request_fingerprint` matches computed hash

2. **2 Neshora Amendment Receipts** — same structure with:
   - `strategy_id` = exact UUIDs from §2.2
   - `seed_context` preserves PR #546 evidence hash `376630a6efc1dc5b008b25d4808832b9f8a384226c9974fb6ff3f1c36237ec33`
   - Package provenance: `package_verification_confirmed_at`, `package_source_references` populated

3. **Strategy Data Integrity** — for all 94 amended rows:
   - `strategy_data` JSON hash = reviewed plan hash (fleet) / Neshora amendment hash
   - `seed_context` JSON hash = reviewed plan seed hash (fleet) / Neshora seed hash
   - All 10 `goldStandard` fields non-empty, exact-client sourced

4. **Zero State Drift** — 20 non-applicable rows:
   - Byte-for-byte identical to `2026-09-23T17:46:08.174Z` snapshot
   - `version = 1`, `staff_amended_at IS NULL`, `workflow_status = 'draft'`

5. **Approval/Publication Gate Intact** — zero rows with `approved_at` or `published_at` set

---

## 7. Scope Discipline — What This Manifest Does NOT Cover

| Excluded | Reason |
|----------|--------|
| Migration application | Protected gate — separate CA approval required |
| Strategy approval (`draft` → `approved`) | Separate protected gate per handover |
| Strategy publication (`approved` → `published`) | Separate protected gate per handover |
| #540 runtime parity deployment | Separate deployment gate |
| Any client beyond 46 fleet + Neshora | Frozen plan is closed set |
| Backfill of historical months | Not in scope — Sep/Oct 2026 only |
| Client portal visibility changes | Separate contract (PR #192) |
| Microsoft/Outlook sync | Read-only coexistence (#325) |

---

## 8. Supervisor Review Checklist (PR Gate)

Before merge, supervisor must verify:

- [ ] Manifest file exists at `docs/ops/STRATEGY-PREFLIGHT-MANIFEST-2026-09-27.md`
- [ ] All IDs, hashes, keys match issue #550 and PR #546 evidence exactly
- [ ] No production write commands in manifest (read-only verification queries only)
- [ ] Migration dependency explicitly called out as unapplied protected gate
- [ ] Idempotency keys are deterministic, replay-safe, collision-resistant
- [ ] Stop conditions are hard aborts — no partial apply path
- [ ] Post-write proof covers all 94 rows + 20 unchanged rows
- [ ] Neshora rows use exact existing UUIDs — no CREATE path
- [ ] PR #546 evidence hash `376630a6efc1dc5b008b25d4808832b9f8a384226c9974fb6ff3f1c36237ec33` preserved
- [ ] Plan hash `4f84133b981aa449b0805fc11424c06f8acb2ec73b72cedcc0795a83502fef6b` governs fleet
- [ ] No approval/publication logic included

---

## 9. Next Step (After Supervisor Approval)

**This manifest is the complete preflight/apply runbook.**  
Upon supervisor review approval:
1. CA provides explicit authorization for migration apply + amendment execution
2. Migration `20260923193000_monthly_strategy_context_amend.sql` applied to production
3. Same-hash preflight re-verified against live production
4. Exact 94-row amendment executed per Phase 1 → Phase 2 order
5. Phase 3 post-write proof captured and attached to #513/#550
6. **Approval/publication remains a separate future gate**

---

**End of Manifest** — Zero-write. No production mutations performed. Ready for supervisor review.