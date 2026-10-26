# CG storage audit scripts

These scripts support the read-only inventory phase of issue #894. They do not create SMB shares, users, firewall rules, drive letters, folders on source media, or Dynamics records.

## 1. Quick host readiness capture

Run on the machine being audited. Write the output to its internal system disk or another approved non-media location.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ops\storage-audit\Get-CGStorageHostReadiness.ps1 `
  -OutputDirectory "$env:TEMP\cg-storage-host-readiness"
```

The result records disks, volumes, active adapters, negotiated link speed, network profiles, current SMB state and visible remote-access services. It changes none of them.

## 2. Media manifest

Only run after the physical volume and output location are confirmed. The output directory must be outside the source media tree.

Metadata only:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ops\storage-audit\New-CGMediaManifest.ps1 `
  -SourceRoot 'X:\' `
  -OutputDirectory 'C:\CG-Storage-Audit\DRIVE-001'
```

Bounded hashing, for example the first 20 GiB encountered:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ops\storage-audit\New-CGMediaManifest.ps1 `
  -SourceRoot 'X:\' `
  -OutputDirectory 'C:\CG-Storage-Audit\DRIVE-001' `
  -HashBudgetBytes 21474836480
```

The manifest never treats matching filenames as duplicate proof. Only rows with `hash_status=verified` have a verified SHA-256. Physical roles and CG IDs remain blank/unclassified until Sydney and the owner reconcile them.

## 3. Self-test

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ops\storage-audit\Test-CGStorageAudit.ps1
```

The test uses disposable files under the Windows temp directory, verifies source bytes are unchanged and proves the script refuses to write its report inside the source tree.

## Host-side order when Nolan's PC is free

1. Run the readiness capture only.
2. Confirm the actual Nolan hostname, wired IPv4, gateway, Private/Public network category and negotiated Ethernet rate.
3. Identify the attached 10 TB drive by model, serial, unique volume ID, filesystem, used/free space and health. Do not accept Windows format or repair prompts.
4. With Sydney present, run the metadata manifest to an internal output folder. Add bounded hashes only after the volume reads cleanly.
5. Separately inspect existing authorised shares and remote-management paths. Do not enable RDP, WinRM, SSH, Guest, Everyone, SMB1, admin shares or firewall exceptions.
6. If a protected least-privilege SMB pilot needs new Windows settings or credentials, show the exact change and obtain owner approval first. Use a new disposable synthetic folder, never an existing media folder.
