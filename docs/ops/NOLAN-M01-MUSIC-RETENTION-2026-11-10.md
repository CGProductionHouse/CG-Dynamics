# Nolan M01 — source-bound soundtrack retention (10 November 2026)

## Verified change
Owner's rule: a soundtrack may be reused in an explicitly approved revision of the **same exact job**, but never automatically in another client's or another video's edit, and never after an owner rejection. A live Nolan Desktop guard previously accepted an arbitrary existing file with matching SHA under `retention_evidence` to waive already-used music. A hash of arbitrary bytes is not approval evidence.

The repaired Nolan Desktop `nolan_guard.py` now calls `validated_retention(plan, old)` from [nolan_retention.py](../../scripts/video-editing/studio-phase2/research/2026-11-10-nolan-retention/nolan_retention.py) instead of the loose `evidence(plan.get('retention_evidence'))` shortcut. Existing reservation verification is preserved. The exception requires exactly: same canonical client ID/job ID, exact original 64-hex SHA256, exact prior history-event ID, `retain_revision` mode, a hash-bound structured keep-decision receipt, a second source-evidence file with hash, a non-empty source reference and decision excerpt, explicit single-job scope, and an offset-aware record timestamp. A known rejection still overrides all retention evidence. This is **structural verification**, not validation that a purported chat excerpt was actually written by the owner; its source must still be reviewed.

## Actual desktop acceptance
- **21/21** new tests passed: source matching, changed source, tampered receipt, cross-client/job, wrong prior record, unapproved/ambiguous status, rejection override, missing/invalid date, loose file negative control, and a real *read-only* CG historical ledger check against owner-rejected Mixkit 371 via an alternate official asset URL/renamed title.
- **49/49** existing Nolan quality guard tests passed; the old unsafe `test_same_job_with_valid_retention` fixture was replaced by an explicit source-bound decision fixture.
- **11/11** existing atomic music reservation tests passed.
- Python compilation passed. **81/81 relevant functional checks**, with fixture-level evidence and one live history *identity* check, NOT actual music listening/approval or full-client release.
- Existing shared `NOLAN-MUSIC-USE-AND-REJECTIONS.csv` SHA256 `fd5239257e851e40fe72f52a4c7cead79a83574956082e9f6903c97cc3e7976e` and `NOLAN-MEDIA-EVENTS.json` SHA256 `fedb5fb4ba222e30dbc8904cc6db5ca739a8a332ede46d5762f4848af720a1a6` were read but not modified.
- No new selected/reserved music, no customer send, no new paid service, no UI takeover, no Katana/MSI changes or deployment.

The versioned source and tests are in existing OneDrive research:
`CG Production House/Video Editing System/research/2026-11-10-Overall-Nolan-Development/`
- `M01-RETENTION-REPAIR-20261110.md`
- `Nolan-Music-Retention-R01-Source-and-Tests.zip` (19,769 bytes; SHA256 `4dac83f151827d314f20ba2223a6bc0bc8d0f24e9214328a3ad6c9ef7b29e57a`; extracted and six implementation/test source SHA values compared with live runtime successfully).

This is an additive contribution to the existing 53-family Nolan and [draft PR #910](https://github.com/CGProductionHouse/CG-Dynamics/pull/910), not a new client database/editor. The full historical-used-music roster is still incomplete and autonomous musical taste is not solved by matching or classification. M04 audio-identity, M06 listening, M08 native editor and reference videos remain independently gated. Follow existing queue without restarting completed technical checks.