# Nolan Assistant storage setup — laptop preflight, 26 October 2026

Issue: #894

Status: **laptop preflight complete; Nolan host inventory and SMB pilot pending host access**

## Actual tested from CA's laptop

- Host: `CA-MSICYBORG15`, Windows workgroup machine.
- Wired adapter: Realtek PCIe GbE, IPv4 `192.168.0.76`, gateway `192.168.0.1`, Private network profile.
- Wired negotiated rate: **100 Mbps**. This is below the existing Gigabit-switch target and is not suitable evidence of expected large-media performance.
- Wi-Fi was also active on the same `192.168.0.x` subnet at the time of capture. No routing, adapter or profile setting was changed.
- No mapped SMB connections or non-administrative local SMB shares were present on the laptop.
- RDP was disabled. No installed/running AnyDesk, TeamViewer, RustDesk, Parsec, Tailscale, ZeroTier, VNC, Splashtop, ScreenConnect, Chrome Remote Desktop or OpenSSH server was found by the read-only software/service check.
- One Windows neighbour answered NetBIOS as `DESKTOP-M1VHEJF`, but its identity was not proven as Nolan's PC. Bounded checks found no reachable SMB, WinRM, RDP or SSH listener on the discovered candidates. It was not controlled or authenticated against.
- The laptop has only its internal 1 TB NVMe visible. No 10 TB or 6 TB external is attached here, so no external-drive content, health or capacity claim is possible from this machine.

## Cloud identity and capacity verified read-only

- The authorised rclone remote `cg_info_personal_ro:` is the personal `info@cgproductionhouse.com` OneDrive used for CG media access.
- Reported capacity: **12,099,996,614,656 bytes total; 11,778,196,190,004 bytes used; 321,800,424,652 bytes free**.
- The connected SharePoint/OneDrive app independently identifies this as a **personal** OneDrive drive for `info@cgproductionhouse.com`.
- The laptop also has two distinct CG Production House business OneDrive sync accounts configured locally. Personal and business stores must remain separate inventory sources; a local synced folder or placeholder is not proof of a complete restorable cloud copy.
- No OneDrive file was moved, deleted, renamed, downloaded for cleanup, shared or permission-changed.

## Dynamics and Microsoft integration evidence

- CG Dynamics returned **62 active canonical client records** through the company-admin read path. This is the current Dynamics client identity source available to the integration; the historical CG Hours reconciliation ledger remains draft and cannot silently rename or merge clients.
- The current October/November scheduled-date read returned only five legacy-looking rows from the old `2025 CLIENTS SCHEDULE` plan. It is not a complete active-work inventory.
- Microsoft reconciliation was fresh but **PARTIAL**: source fetches were complete, with 84 conflicts. Live Microsoft remains the authority for Microsoft-backed work.
- Current Content Run reads expose durable `client_id`, `content_run_id`, `calendar_event_id` and guideline IDs where present, but sampled runs report their OneDrive mapping as `unmapped`. Storage indexing must preserve these IDs and must not invent a run folder or change Brand Hub/portal links.

## Prepared implementation assets

- `scripts/ops/storage-audit/Get-CGStorageHostReadiness.ps1` — read-only host, disk, volume, network, SMB and remote-service receipt.
- `scripts/ops/storage-audit/New-CGMediaManifest.ps1` — source metadata manifest with optional bounded SHA-256 hashing; output is forced outside the source tree.
- `scripts/ops/storage-audit/Test-CGStorageAudit.ps1` — disposable self-test that verifies source bytes remain unchanged and the source-write guard fails closed.

The manifest intentionally leaves `volume_id`, intended role, canonical client, Content Run, deliverable, Planner task and backup state unclassified. Those fields are reconciled later from exact authorities rather than fuzzy folder names.

## Not tested / blocked

- Nolan PC hostname, real wired IPv4, gateway, network profile and negotiated rate.
- Whether the first 10 TB drive is attached, readable and healthy; its model, serial, filesystem, volume ID, used/free bytes and source tree.
- Sydney's classification of historical client, event and wedding folders.
- Cross-drive and OneDrive duplicate/unique-byte coverage.
- An authenticated least-privilege SMB share and second-machine read/write/rename/delete/throughput test.
- Independent backup and restore proof.

No Windows security setting, account, firewall rule, share, drive label/letter, media path, Dynamics record, Planner task or OneDrive object was changed.

## Exact Nolan host-side step when the PC is available

Open a local Codex/PowerShell session on Nolan's PC without taking over the designer's session, use the issue #894 worktree/branch, and run only:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ops\storage-audit\Get-CGStorageHostReadiness.ps1 `
  -OutputDirectory 'C:\CG-Storage-Audit\HOST-PREFLIGHT'
```

Then stop and review the receipt with the owner before any security, sharing or credential change. If the external volume is healthy and Sydney is present, run the metadata-only manifest with its exact drive root and an internal `C:\CG-Storage-Audit\<physical-volume-id>` output. Do not run hashing, create the SMB pilot or assign hot/archive/wedding roles until the real volume and capacity are reviewed.

The first practical fault to resolve is the laptop's 100 Mbps wired negotiation: test a known-good Cat5e/Cat6 cable and another confirmed gigabit switch port, then re-read `Get-NetAdapter`. This is a physical-link check, not permission to change router, firewall or Windows security configuration.

## External-drive arrival check — 26 October 2026, 17:00 SAST

Two USB devices were physically connected to CA's laptop, but Windows exposed only one real media disk:

- StoreJet/Transcend, serial `V174E32A2GXW-DW`, exact size `4,000,787,030,016` bytes (nominal **4 TB**, 3.64 TiB), GPT, USB, online. Windows assigned disk number 2 initially and disk number 1 after reconnect, confirming why the serial/capacity pair—not the temporary disk number—is the safe identity.
- Volume E: exFAT, `4,000,634,109,952` bytes total, `1,661,639,589,888` bytes free and about 2.13 TiB used.
- Windows reports volume E as **Warning / Full Repair Needed** and `fsutil dirty query E:` confirms the volume is dirty.
- The Windows System log contains repeated Disk 51/153 I/O retry warnings and a Disk 11 controller error on 26 October. USB bridges can obscure disk numbering across reconnects, so the events are evidence of a storage-path problem but are not attributed to a specific physical mechanism without further recovery diagnostics.
- A read-only top-level listing succeeded and showed `ARCHITECTURE`, `Clients`, `ONCE OFFS`, utility/system folders and no weddings-only structure. No recursive walk or hash pass was started.
- A generic mass-storage/card-reader-style device previously presented as `No Media`, zero bytes. After disconnect/reconnect and a host-storage-cache refresh, Windows still exposed only the 4 TB StoreJet as real media. No 6 TB or 10 TB disk was visible.

This does **not** match the expected connected 6 TB + 10 TB inventory. The current E: volume must not be repaired, formatted, relabelled, reorganised or used as the weddings destination yet. First verify its physical label and original cable/power arrangement. The expected 10 TB needs its matched power supply and a direct USB 3.x data connection checked before another read-only detection pass.

## First 10 TB inventory — 26 October 2026, 17:19 SAST

The first actual 10 TB drive was subsequently connected by itself and identified without relying on its temporary Windows disk number or drive letter:

- CG inventory identity: `CG-EXT-SEAGATE-10TB-001`.
- Seagate Expansion HDD, serial `NT17S7GK`, unique disk ID `3E5431375337474B`.
- Exact physical size: `10,000,831,348,224` bytes (9.10 TiB).
- Volume `Expansion1`, exFAT, healthy/OK and not dirty at capture time.
- Used: `9,959,801,356,288` bytes (about 9.06 TiB). Free: `40,633,630,720` bytes (about 37.8 GiB).
- Completed metadata inventory: 144,712 files, 2,929 directories, 9,939,981,360,176 file bytes, zero scan errors and no truncation.
- Largest first-level areas: `Clients` 7.92 TiB (87.6%); `Once-Off` 1.00 TiB (11.1%); recovered folders about 65.3 GiB; `CG Production House` about 45.4 GiB.
- Largest second-level client area: `Clients\Econo` at 2.44 TiB.
- Dominant media type: 50,563 MP4 files totalling about 8.28 TiB. The drive also contains 87,285 JPG files, 1,746 CR3 files and 451 MOV files.

A size-only screening pass found 13,490 candidate groups across 27,745 files and at most about 0.884 TiB of theoretical duplicate excess. This is explicitly **not duplicate proof**. No hash, copy, move, rename, repair or deletion was performed on the source drive.

The full manifest, summaries and unverified candidate list were copied to the authorised Google Drive `CG Storage Audit` folder. The native Google Sheet `CG External Drive Register and Migration Tracker` records both inspected physical drives, the 10 TB content summary and the blocked migration queue. Local source receipts remain under `C:\CG-Storage-Audit\SEAGATE-3E5431375337474B`.

## Duplicate and cleanup decision rule

The safe process is deliberately staged:

1. inventory each physical drive by serial/unique ID and capture every relative path, byte size and timestamp;
2. compare manifests to reduce hashing to same-size candidates;
3. hash candidate files with SHA-256 and classify an exact duplicate only when both size and verified hash match;
4. keep edits, proxies, transcodes, exports, burst variants and visually similar media outside the exact-duplicate bucket, even when filenames are similar;
5. decide the canonical retained copy from client/project context rather than path age alone;
6. copy to the approved destination, verify the destination hash, prove an independent backup/restore path and test Adobe/project relinking;
7. prepare a deletion proposal with exact paths and recoverability; delete nothing without explicit approval.

`Compare-CGMediaManifests.ps1` implements the proof boundary and emits separate unverified and SHA-256-verified reports. It performs no media mutation.

## StoreJet filesystem warning cleared; full inventory — 26 October 2026, 17:56 SAST

CA explicitly requested proceeding without a backup after the repair risk and lack of a spare destination were explained. The exact StoreJet serial `V174E32A2GXW-DW` and 4,000,787,030,016-byte physical size were revalidated before the operation. Volume serial reported by CHKDSK: `6447-B694`.

1. `chkdsk E:` completed with exit code 0 and reported no filesystem problems, 16,812 files, 940 indexes and 0 KB in bad sectors. Its initial output included `Access is denied`, but the verification completed; this initial status-only run was not used as evidence that the dirty flag was cleared.
2. Because verification found no corruption, `chkdsk E: /markclean` was used instead of a repairing `/f` or sector-reading `/r` pass. Microsoft documents `/markclean` for FAT/FAT32/exFAT when no corruption is detected. It completed with exit code 0 and the same file/index/space report.
3. `fsutil dirty query E:` then returned **NOT Dirty**. `Get-Volume` returned **Healthy / OK**. Used/free bytes remained unchanged. No new Disk-provider events were returned for the operation's recent time window.

This clears the filesystem warning. It does not establish physical hardware reliability or a full surface-read result. No damaged chain repair, media deletion, media move, format, Windows security change or backup was performed. The earlier warning state remains historical evidence, rather than the current block.

The healthy-volume guard then admitted the complete metadata inventory: **16,812 files, 939 directories, 2,328,533,364,052 file bytes, zero enumeration errors, no truncation and no file hashes**. Local receipts: `C:\CG-Storage-Audit\STOREJET-V174E32A2GXW-DW`. Google Drive holds the full manifest, summary and first/second-level summaries; the shared Google register is updated.

First-level file bytes:

- `ONCE OFFS`: 10,858 files / 1,875,983,988,851 bytes;
- `Clients`: 978 files / 200,432,466,268 bytes;
- `$RECYCLE.BIN`: 156 files / 197,598,154,871 bytes; retained for explicit review;
- `ARCHITECTURE`: 4,736 files / 54,403,022,903 bytes;
- remaining utility/system files: under 0.13 GB.

The two-drive metadata comparison now contains 161,505 nonempty files, 18,086 size-candidate groups and 38,828 candidate files, with 1,488,051,345,222 theoretical excess bytes. Exact verified groups remain **zero pending hashes**. This is neither proof of duplicate files nor approved reclaim space. Remaining physical drives still require inventory before candidate hashing and migration decisions.

References: [Microsoft CHKDSK parameters](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/chkdsk), [Microsoft repair prerequisites](https://learn.microsoft.com/en-us/troubleshoot/windows-server/backup-and-storage/troubleshoot-data-corruption-and-disk-errors).
