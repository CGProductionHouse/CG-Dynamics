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
