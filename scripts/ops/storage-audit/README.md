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

The manifest also refuses a local source volume unless Windows reports both `HealthStatus=Healthy` and `OperationalStatus=OK`. A dirty volume, repair-needed state or other warning must be reviewed before a recursive walk or hashing pass.

## 3. Cross-drive duplicate comparison

After every physical drive has its own manifest, compare them without touching source media:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ops\storage-audit\Compare-CGMediaManifests.ps1 `
  -ManifestPath @(
    'C:\CG-Storage-Audit\DRIVE-001\media-manifest.csv',
    'C:\CG-Storage-Audit\DRIVE-002\media-manifest.csv'
  ) `
  -OutputDirectory 'C:\CG-Storage-Audit\COMPARISON-001'
```

The comparison deliberately separates three states:

- `same-size-candidates-unverified.csv` is a screening list, never deletion proof;
- `unresolved-size-candidates.csv` still needs hashing or has different hashes despite equal size;
- `verified-exact-duplicates.csv` contains only equal-size files with the same verified SHA-256.

This script does not hash, copy, move, rename or delete media. Candidate-only hashes should be collected after all drives are inventoried, then the comparison is rerun. A verified exact duplicate is still not approval to delete it: the retained copy needs a successful destination copy, checksum verification, independent backup/restore evidence and an application relink test first.

## 4. Resumable candidate-only hashing

Run the candidate hasher from PowerShell 7 (the existing Codex bundled shell), not Windows PowerShell 5.1. It requires modern .NET long-path support for Adobe cache/preview filenames. Use the exact connected disk unique ID. This reads media through a bound volume GUID, stores checkpoints internally and emits a separate enriched manifest for the comparison tool:

```powershell
& .\scripts\ops\storage-audit\Invoke-CGMediaCandidateHashes.ps1 `
  -SourceRoot 'E:\' `
  -ExpectedDiskUniqueId '3E5431375A344C41' `
  -ManifestPath 'C:\CG-Storage-Audit\SEAGATE-3E5431375A344C41\media-manifest.csv' `
  -CandidatePath 'C:\CG-Storage-Audit\COMPARISON-3DRIVES-20261026\unresolved-size-candidates.csv' `
  -OutputDirectory 'C:\CG-Storage-Audit\SEAGATE-3E5431375A344C41\hash-progress' `
  -HashBudgetBytes 5368709120 -MaximumSeconds 120
```

Each completed file is checkpointed. Reuse the same output directory to resume; wrong disk/inventory identities fail closed. The source must still match its inventory size and timestamp. Writes are denied while reading each file. Time limits are checked between files; an individual blocked USB read can exceed them. A checkpoint proves the hash when recorded, not future hardware health or permission to delete a referenced path. Revalidate retained files at removal time.

Pass the enriched manifest **instead of**, not alongside, its original manifest when comparing drives, so the same physical inventory is not counted twice.

## 5. Self-test

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ops\storage-audit\Test-CGStorageAudit.ps1
& .\scripts\ops\storage-audit\Test-CGMediaCandidateHashes.ps1
```

The test uses disposable files under the Windows temp directory, verifies source bytes are unchanged and proves the script refuses to write its report inside the source tree.

## Host-side order when Nolan's PC is free

1. Run the readiness capture only.
2. Confirm the actual Nolan hostname, wired IPv4, gateway, Private/Public network category and negotiated Ethernet rate.
3. Identify the attached 10 TB drive by model, serial, unique volume ID, filesystem, used/free space and health. Do not accept Windows format or repair prompts.
4. With Sydney present, run the metadata manifest to an internal output folder. Add bounded hashes only after the volume reads cleanly.
5. Separately inspect existing authorised shares and remote-management paths. Do not enable RDP, WinRM, SSH, Guest, Everyone, SMB1, admin shares or firewall exceptions.
6. If a protected least-privilege SMB pilot needs new Windows settings or credentials, show the exact change and obtain owner approval first. Use a new disposable synthetic folder, never an existing media folder.
