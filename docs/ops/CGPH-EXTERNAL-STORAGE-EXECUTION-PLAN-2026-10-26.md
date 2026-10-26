# External storage execution plan — 26 October 2026

Owning lane: #894 / PR #895. This plan uses three completed metadata inventories, not assumed drive labels. Keep the original media trees intact until each proposed transfer is concrete and verified.

## Proposed drive roles

| Physical drive | Current file bytes | Free filesystem bytes | Proposed role |
| --- | ---: | ---: | --- |
| Expansion1, Seagate NT17S7GK | 9,939,981,360,176 | 40,633,630,720 | Recurring client master archive; currently too full for incoming batches |
| Expansion2, Seagate NT17Z4LA | 7,962,889,651,107 | 2,018,628,599,808 | Once-off/event archive, complete wedding archive during consolidation, and temporary intake from the smaller drive |
| StoreJet V174E32A2GXW-DW | 2,328,533,364,052 | 1,661,639,589,888 | Dedicated weddings if verified unique weddings fit with at least 10% capacity headroom; otherwise an active-wedding subset, with complete wedding archive retained on Expansion2 |

These are proposals, not an instruction to rename current client/project folders. The smaller disk is nominal 4 TB, not the previously expected 6 TB. Its final wedding capacity must be calculated from actual unique files. Main Expansion2 wedding subtree alone is 2,585,609,133,905 bytes; it cannot be added wholesale to StoreJet's current free space. Other wedding-labelled folders exist outside that subtree and across all three drives.

## How transfers work

Connect the source and destination to the same laptop at the same time. Windows may assign E: and F: differently each time; identify both by serial/unique ID before writing. Transfer directly from one external to the other. The laptop stores only small manifests, hash checkpoints and receipts, not a temporary copy of multi-terabyte footage.

Use the already installed rclone client's `copy` operation for a scoped batch, preserving the original relative paths under a new intake folder. Do not use `sync`, `move`, `--delete-*`, `--ignore-existing` or overwrite a different destination file. Copy into a new batch destination. Restrict initial concurrency to one file and record errors. Existing Google Drive access is for control documents and selected exceptions; its 331.6 GB free capacity is insufficient for wholesale media migration.

Before any source removal: compare source/destination file lists and counts, compute/check full SHA-256 for both copies, open representative clips/photos and test the original Adobe project against the new media location. A source copied successfully by filename alone is insufficient. Keep an exact original-path-to-retained-path receipt. An unverified cloud placeholder is not a retained copy.

CA declined obtaining a spare disk for a full backup. Work can still begin with read-only duplicate proof, classification and direct copy/verification between existing drives. Source removal remains a separate exact-batch decision: the first transfer should be reviewed with its receipt before reclaiming its original space. The resulting retained copy is not an independent second backup once the source is removed.

## Execution order

1. **Now, with Expansion2 attached:** collect resumable SHA-256 evidence for duplicate candidates. Start with a bounded pilot and use the measured throughput to size later runs. Write all ledgers to the laptop and Google audit folder. Stop on read errors or a changed disk identity. No source media alteration.
2. **Produce the classification ledger:** separate recurring clients, weddings, other paid events, internal/architecture, originals, projects and exports. Folder names generate review candidates; ambiguous people/event folders are not silently classified as weddings or clients. Preserve the 185 Premiere projects and 25 After Effects projects present on Expansion2, including their dependencies.
3. **Connect StoreJet alongside Expansion2:** compare its candidate hashes, then copy non-wedding work to new intake batches on Expansion2. Current obvious review areas are StoreJet `Clients` (200.43 GB), `ARCHITECTURE` (54.40 GB), and the named Be Human/Econo event folders (388.05 GB combined). The combined 642.88 GB review set fits Expansion2's current 2.019 TB free space. These are proposed transfers, not permission to discard originals.
4. **Review and verify that first transfer batch:** retain all project/media paths and write a source-to-destination map; test Adobe relinks. Only after the reviewed source removal is approved does it create real headroom on StoreJet.
5. **Resolve duplicate groups:** compare byte size plus full SHA-256 across drives and within drives. Keep project dependencies and any intentional backup placement visible. Exact byte identity proves equal contents, not that deleting a referenced path is harmless. Revalidate the retained copy immediately before any removal. Review StoreJet's 197.6 GB Recycle Bin separately; do not empty it automatically.
6. **Calculate wedding unique bytes:** only if the complete reviewed wedding set fits StoreJet with 10% headroom, copy it there in verified batches. If it does not fit, retain the complete archive on Expansion2 and put the active subset on StoreJet. Do not force all weddings onto an undersized disk.
7. **Connect Expansion1 alongside Expansion2:** consolidate recurring clients and move reviewed once-off work to the archive only after capacity is available. Use the same scoped copy/hash/relink/receipt workflow. Avoid one huge merge or broad folder renaming.
8. **Finish the catalogue:** maintain a client/event/date index and original-path map in the shared Sheet. Link canonical Dynamics client/Content Run IDs only when authoritative IDs have been reconciled. No live Dynamics writes are part of this storage plan.

## Current implementation

`Invoke-CGMediaCandidateHashes.ps1` uses Windows/.NET SHA-256, validates the actual disk unique ID and healthy volume, restricts candidates to the matching inventory, checks source size/timestamp, denies writers while hashing and checkpoints every verified file. It resumes without rereading unchanged completed files, emits a separate enriched manifest for the existing comparison tool, and has byte/file/runtime limits. Runtime is checked between files, not a guarantee against an unresponsive USB read. No software installation or purchase is required.

The three-drive size screening contains 39,574 groups / 95,333 candidate files. Its 4.270 TB theoretical excess is not verified reclaim space. The attached Expansion2 has 41,196 candidate files totalling 3.184 TB, with 7,252 groups repeated within that drive. Full verification is substantial I/O; the initial pilot establishes real results and throughput before expanding it. Hashing progress survives disconnects and restarts through the internal checkpoint, but the correct drive must be reconnected for further source reads.

### First actual results and connection interruption

The first completed comparison proved four exact groups (nine member files, 2,601,274,004 redundant bytes) using full SHA-256. Examples include a wedding clip present in three separate folders and a second wedding clip with an `_1` copy. No source file was removed or renamed; project-path dependencies still need review before reclaiming those bytes.

Checkpoint testing then resumed the original 11 completed digests without rereading them. The second substantive pass completed ten more files before Expansion2 disappeared from Windows at about 18:24 SAST. Windows logged Disk event153 (I/O retry) at18:24:16. The failed file received no verified hash. Total completed ledger entries are22, including one small resume-check file. The physical disk is currently absent, so the reason could be an unplug or a connection failure; physical hardware failure is not established. Stop further source reads until the exact disk is reconnected and its connection/volume status rechecked. The stable volume GUID binding prevented a replacement drive letter from becoming the hash source. A partial run preserves evidence and now returns an explicit failure after writing its summary.

The final local comparison of the checkpointed Expansion2 inventory proves **seven exact groups, fifteen matching member files and 4,123,916,504 redundant bytes**. Total fingerprinted file bytes are10,434,664,868 across22files. This is content proof only; **zero space has been reclaimed**. All other drive hashes and unverified candidates remain outstanding. Checkpoint receipts and the exact-group report are uploaded to the shared audit folder, and the Google Sheet's new `Execution Plan` tab contains the action order.

**Exact next physical action:** reconnect Expansion2 using its matched power supply and a stable direct USB data connection. Keep it connected, then connect StoreJet to another laptop USB port so both are available concurrently. Re-identify serials before starting the scoped copy pilot. If USB interruption repeats, resolve the cable/port/power path before migration; do not turn repeated retries into a cleanup loop.

Shared control: [Google register](https://docs.google.com/spreadsheets/d/19ioPaVakVo9KuUH4IWeXkEw1s13TKx5ytjCcZXqqD5w/edit), [audit manifests and receipts](https://drive.google.com/drive/folders/15EZiX1VfM5vDkscoGMkSuf9jQcxQ26df).
