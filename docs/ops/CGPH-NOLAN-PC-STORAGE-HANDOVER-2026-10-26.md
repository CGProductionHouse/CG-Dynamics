# Nolan PC storage handover — 26 October 2026

Owning issue: [#894](https://github.com/CGProductionHouse/CG-Dynamics/issues/894). Existing PR: [#895](https://github.com/CGProductionHouse/CG-Dynamics/pull/895). Branch: `codex/nolan-storage-audit-894`. Continue this lane; do not create a competing storage implementation. User is transferring all three externals from CA's laptop to Nolan's PC. Do not continue laptop source reads after this handoff.

## Read first

1. Repository `AGENTS.md` and its mandatory continuity reads.
2. Latest #894 handover comment, PR #895 and `docs/ops/CG-DYNAMICS-OPS-HANDOVER.md`.
3. `CGPH-EXTERNAL-STORAGE-EXECUTION-PLAN-2026-10-26.md` for the actual move order and capacity limits.
4. `CGPH-NOLAN-STORAGE-LAPTOP-PREFLIGHT-2026-10-26.md` for measured inventory/repair evidence.
5. `scripts/ops/storage-audit/README.md` for tested commands.

Existing Nolan Studio #875, Premiere craft #859/#862 and PICASSO #879 are separate owners. Preserve verified Premiere tools and client projects. Do not interrupt, restart or log out another staff member's session. No hosting, production SQL, live Dynamics data, Windows security/share/firewall change or software purchase/install is authorised by this storage handoff.

## Exact physical identities

Drive letters and Windows disk numbers are temporary. Re-identify these devices on the new PC before any operation.

| Stable audit identity | Physical drive / serial | Disk unique ID | Physical bytes | Last known free filesystem bytes |
| --- | --- | --- | ---: | ---: |
| `CG-EXT-SEAGATE-10TB-001` | Expansion1 / `NT17S7GK` | `3E5431375337474B` | 10,000,831,348,224 | 40,633,630,720 |
| `CG-EXT-SEAGATE-10TB-002` | Expansion2 / `NT17Z4LA` | `3E5431375A344C41` | 10,000,831,348,224 | 2,018,628,599,808 |
| `CG-EXT-UNASSIGNED-001` | StoreJet/Transcend / `V174E32A2GXW-DW` | `5000000000000001` | 4,000,787,030,016 | 1,661,639,589,888 |

Seagate raw serials can include leading spaces and `00000000`. The StoreJet unique ID is weak/generic: match its serial AND capacity as well. All three filesystems are exFAT. A separate zero-byte Generic Mass-Storage device was a no-media shell, not another media disk. **No actual 6 TB device was seen.** Do not allocate the nominal 4 TB StoreJet as if it has 6 TB.

Match each Seagate to its own power supply. Prefer direct USB data connections; do not assume a passive hub can sustain three disks. If only two can be connected reliably, work in pairs. Nolan's hostname, drive letters, wired IP/link speed and simultaneous USB performance are not yet measured.

## Current state and last failure

- Complete metadata inventories exist for all three drives: **300,852 files, 5,159 directories, 20,231,404,375,335 file bytes**. All three original scans had zero enumeration errors and no truncation.
- StoreJet and Expansion2 initially had dirty flags/Warning/Full Repair Needed. CA explicitly requested proceeding without a backup. CHKDSK verification found no filesystem problems; the documented exFAT `/markclean` option cleared each flag. Both then reported Healthy/OK/NOT Dirty and unchanged used/free space. No `/f`, `/r`, format or full physical surface test occurred. Do not call this physical-drive reliability proof.
- Expansion2 subsequently **disappeared during hashing at about 18:24 SAST**. Windows logged Disk153/I/O retry at18:24:16; the failed read said device does not exist. A later disk enumeration still found only the zero-byte generic shell. Cause could be an unplug or a cable/USB/power problem; it is not a proven disk failure diagnosis.
- Hashing stopped on that error. **22 completed SHA-256 proofs / 10,434,664,868 bytes** are checkpointed. Failed file is not marked verified.
- Latest local comparison proves **7 exact groups / 15 matching member files / 4,123,916,504 redundant bytes** within Expansion2. **Zero bytes have been reclaimed. No media was copied, moved, renamed or deleted.**
- The larger three-drive size screening lists39,574groups/95,333candidates/4.270TB theoretical excess. Most are unverified. Do not confuse this upper bound with reclaimable space. The older `verified-pilot` comparison has only4groups and is superseded by Expansion2's `verified-duplicates` report.

## Portable control pack and shared controls

Use the **latest handover comment on #894** for the private Google Drive ZIP link and its SHA-256. The pack contains only metadata, hash checkpoints, reports, scripts and these handover documents. It contains no source footage/photos, passwords, tokens, rclone config or client media backup.

- [Google audit folder](https://drive.google.com/drive/folders/15EZiX1VfM5vDkscoGMkSuf9jQcxQ26df).
- [Native Google register and Execution Plan](https://docs.google.com/spreadsheets/d/19ioPaVakVo9KuUH4IWeXkEw1s13TKx5ytjCcZXqqD5w/edit#gid=89400026).
- The native Google Sheet is current. The original local XLSX/builder under the laptop's untracked `outputs/` is historical and must not overwrite the current Sheet.

Download the ZIP to an internal disk, verify its archive SHA-256 against #894, and extract into a **new** handoff-import directory. Do not extract over an existing audit without checking for conflicts. `bundle-index.csv` lists each included file's relative path/size/SHA-256. Verify every indexed file after extraction. The `audit/` subtree mirrors the useful `C:\CG-Storage-Audit` directories; copy those into a new host-local audit root or preserve the import root and adjust command paths. Existing source_manifest fields may contain CA laptop paths; resolve by inventory ID, not those obsolete host paths.

The hash checkpoint directory MUST retain `hash-state.json` and `verified-hashes.csv` together. They bind to inventory ID and physical disk unique ID; volume GUID/drive letter may legitimately change on the new PC. Do not regenerate the original inventory and lose checkpoint identity. If source metadata no longer matches a row, report it and reconcile changes rather than silently reusing a stale digest.

## First host-side actions

1. Inspect git status/open ownership. Fetch/reuse the existing PR branch in an isolated worktree; do not reset another agent's files or switch its active checkout. Read the source from the newest branch, not stale main-only scripts.
2. Restore/verify the control pack locally and run the two synthetic storage tests. Candidate hashing requires PowerShell7/modern .NET for long Adobe filenames; use the existing Codex bundled shell. Windows PowerShell5.1 hit an actual long-path error on this footage. Do not change Windows long-path/security settings or install another runtime just to work around it.
3. Run the read-only host receipt from the storage branch:

```powershell
& .\scripts\ops\storage-audit\Get-CGStorageHostReadiness.ps1 `
  -OutputDirectory 'C:\CG-Storage-Audit\NOLAN-HOST-PREFLIGHT' `
  -SkipStorageReliability
```

`-SkipStorageReliability` avoids an observed slow USB reliability query; the omission is explicit and not a SMART acceptance. Re-identify all serials/unique IDs, capture current health/free space and inspect recent Disk events. Do not assume E:/F:/G: mappings. If a volume is dirty, run status verification first; do not blindly repeat repair operations or clear errors while USB reads are failing.

4. Establish that Expansion2 stays connected through one bounded read/hash batch. Use the restored original Expansion2 manifest, restored global candidate CSV, current root for the exact disk and restored `hash-progress` directory. The hasher recomputes the host volume GUID and resumes unchanged completed proofs. Example, **replace `X:\` with the verified current root**:

```powershell
& .\scripts\ops\storage-audit\Invoke-CGMediaCandidateHashes.ps1 `
  -SourceRoot 'X:\' -ExpectedDiskUniqueId '3E5431375A344C41' `
  -ManifestPath 'C:\CG-Storage-Audit\SEAGATE-3E5431375A344C41\media-manifest.csv' `
  -CandidatePath 'C:\CG-Storage-Audit\COMPARISON-3DRIVES-20261026\unresolved-size-candidates.csv' `
  -OutputDirectory 'C:\CG-Storage-Audit\SEAGATE-3E5431375A344C41\hash-progress' `
  -HashBudgetBytes 5368709120 -MaximumSeconds 120
```

Byte/file/runtime limits exist; runtime is checked between files and cannot guarantee a hard timeout on an unresponsive USB read. Stop on a repeat I/O error, preserve checkpoints, and diagnose matched power/cable/port. Do not retry-loop or proclaim hardware healthy from a clean filesystem.

5. If the connection is stable, continue hashes in measured batches, screen project dependencies and prepare the first scoped direct-drive copy pilot. Both source and destination must be present concurrently. Use installed rclone if already available or Windows native copy tools; do not install software without approval. Copy to a new intake batch, preserve relative paths, compare complete source/destination hashes, open sample media and test Adobe relinks before any original-source removal. No broad sync/delete operation.

## Capacity and proposed first move

Proposed roles: Expansion1 recurring client master; Expansion2 events and complete wedding archive during consolidation; StoreJet dedicated weddings only if verified unique bytes fit with10%headroom. StoreJet's existing non-wedding review set is about642.89GB: Clients200.43GB, ARCHITECTURE54.40GB, named Be Human/Econo event folders388.05GB combined. Expansion2's last known2.019TB free can hold those intake batches. Choose a small first copy pilot, then expand after its receipt verifies.

The Expansion2 main wedding subtree is2.586TB plus other wedding folders. It cannot be added wholesale to StoreJet's present1.662TB free. Calculate unique wedding contents first. If all reviewed weddings cannot fit on4TB with headroom, keep the complete archive on Expansion2 and the active subset on StoreJet. StoreJet's197.6GB Recycle Bin remains review-only; do not empty it automatically.

CA has authorised implementing sorting and explicitly declined a spare full-backup requirement. This permits progress on fingerprints, classification and copy/verification using existing drives. It is not permission for guessed duplicate deletion, destructive overwrite, formatting, permanent file destruction or breaking live Adobe links. A copied file becomes a single retained copy after its original is removed, not an independent backup. Prepare exact source-removal paths and verify dependencies/retained bytes before that decision.

## Separate office/network work still outstanding

Nolan remote access/SMB has not been set up or accepted. CA's laptop wired link negotiated100Mbps; no evidence yet of a gigabit media-share path. Earlier Nolan hostname/IP guesses were unproven. Storage work can run locally on Nolan without SMB. Keep networking secondary until USB access is stable. A later synthetic least-privilege SMB pilot still needs exact Windows/account/firewall approval before changing settings. No remote takeover of the designer's session.

OneDrive personal info@cgproductionhouse.com is distinct from the business tenants. Earlier read-only quota showed321.8GB free; authorised Google archive remote showed331.6GB free. Neither can stage multi-terabyte migrations. Existing canonical Dynamics client IDs/Content Runs are read-only integration evidence; do not invent IDs or rewrite client folder mappings from names.

## Validation and write-back

Laptop source/tool baseline `14bccc9c`: both storage tests pass; tests cover false size matches, repeated manifests/inventories, source guards, native hash identity, long paths, resume, source changes and wrong-disk refusal. Actual22file evidence and7exact groups are saved; repo TypeScript/Vite build passed. No production migration/data/security change or Vercel operation.

After each meaningful batch update #894, PR #895, the Google register and ops handover. Update #381 if lane ownership/blockers change. Record actual host acceptance separately; laptop results do not establish Nolan-PC acceptance. GitHub is the full brief; CA should only need to point the next agent to this issue and handover.
