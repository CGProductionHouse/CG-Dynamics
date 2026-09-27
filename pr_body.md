## Summary

Production-safe apply-readiness for the exact nine-client portal batch from #519 reconciliation.

**Nine-client batch:**
- **2 link-existing-profile**: Braize (5c140f94-663e-4c72-ba31-c7d0d4537bf0), CG Production House (6cdff3c8-bbe8-48f8-9f1f-399c0e249d12) — each has 1 active client profile, 0 portal mappings, published reports
- **7 provision-new under #399 flow**: All Around PVC, Bat Hill Royale, Case Bloemfontein, HMHI, The Staffordshire, Vrystaat Kunstefees, Zooz Lifestyle WFF — each has 0 active profiles, 0 mappings, published reports

**Safety guarantees:**
- Deterministic dry-run anchored to #519 reconciliation hash
- Preconditions verified: zero inactive profiles, exact-client isolation (9 unique client_ids), no duplicate-profile creation, all active eligible clients, published reports establish portal need
- Deterministic idempotency keys (UUIDv5) tied to reconciliation hash
- Documented stop conditions (drift detection, duplicate mapping refusal, inactive client check)
- Documented rollback evidence (zero writes, preflight fingerprints, idempotency, non-target isolation, post-apply verification)
- Post-apply verification plan: re-read 9 target rows, verify client_portal_access + profiles counts, verify username uniqueness, verify zero cross-client leakage, verify idempotency receipts
- **Zero production writes**; no credentials exposed; no invites sent; no handover edits

**Files added:**
- `scripts/build-nine-client-portal-apply-readiness.mjs` — generates `artifacts/client-portal-access/issue-539/nine-client-portal-apply-readiness.json`
- `tests/nineClientPortalApplyReadiness.test.mjs` — 14 assertions covering all safety requirements

**Verification:**
- `npm run build` pass
- `npm run lint` pass (0 errors, pre-existing warnings only)
- `node --test tests/nineClientPortalApplyReadiness.test.mjs` pass (14/14)
- `node --test tests/clientPortalAccess.test.mjs tests/clientPortalReconciliation.test.mjs` pass (11/11)

Supervisor will separately authorize any protected live apply.