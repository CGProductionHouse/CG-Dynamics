#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$SourceRoot,
    [Parameter(Mandatory = $true)][string]$ExpectedDiskUniqueId,
    [Parameter(Mandatory = $true)][string]$ManifestPath,
    [Parameter(Mandatory = $true)][string]$CandidatePath,
    [Parameter(Mandatory = $true)][string]$OutputDirectory,
    [ValidateRange(1, 109951162777600)][long]$HashBudgetBytes = 5368709120,
    [ValidateRange(1, 10000000)][int]$MaximumFiles = 1000,
    [ValidateRange(1, 86400)][int]$MaximumSeconds = 180,
    [ValidateRange(1, 109951162777600)][long]$MaximumFileBytes = 536870912
)

$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $SourceRoot).Path.TrimEnd('\') + '\'
$output = [System.IO.Path]::GetFullPath($OutputDirectory).TrimEnd('\') + '\'
if ($output.StartsWith($source, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'OutputDirectory must be outside SourceRoot.'
}
$letter = (Split-Path -Qualifier $source).Substring(0, 1)
$disk = Get-Partition -DriveLetter $letter | Get-Disk
if ($disk.UniqueId -ne $ExpectedDiskUniqueId) { throw 'Disk identity does not match the approved source.' }
$volume = Get-Volume -DriveLetter $letter
if ($volume.HealthStatus -ne 'Healthy' -or @($volume.OperationalStatus) -notcontains 'OK') {
    throw 'Source volume is not healthy/OK; hashing stopped.'
}
$volumeRoot = [string]$volume.UniqueId
if (-not $volumeRoot.StartsWith('\\?\Volume{', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'A stable volume GUID path is required for source reads.'
}

$manifest = @(Import-Csv -LiteralPath $ManifestPath)
$inventoryIds = @($manifest.inventory_id | Sort-Object -Unique)
if ($inventoryIds.Count -ne 1) { throw 'Expected one inventory identity in the manifest.' }
$inventoryId = $inventoryIds[0]
$candidates = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
Import-Csv -LiteralPath $CandidatePath | Where-Object inventory_id -eq $inventoryId | ForEach-Object {
    [void]$candidates.Add($_.relative_path)
}
$eligible = @($manifest | Where-Object {
    $_.item_type -eq 'file' -and $candidates.Contains($_.relative_path) -and
        [long]$_.size_bytes -gt 0 -and [long]$_.size_bytes -le $MaximumFileBytes
})
$localSizeCounts = @{}
foreach ($row in $eligible) { $localSizeCounts[$row.size_bytes] = 1 + $localSizeCounts[$row.size_bytes] }
$eligible = @($eligible | Sort-Object @{Expression = { $localSizeCounts[$_.size_bytes] -gt 1 }; Descending = $true},
    @{Expression = { [long]$_.size_bytes }; Descending = $true}, relative_path)

New-Item -ItemType Directory -Path $output -Force | Out-Null
$statePath = Join-Path $output 'hash-state.json'
$ledgerPath = Join-Path $output 'verified-hashes.csv'
$enrichedPath = Join-Path $output 'media-manifest-with-hashes.csv'
$summaryPath = Join-Path $output 'candidate-hash-summary.json'
if (Test-Path -LiteralPath $statePath) {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    if ($state.inventory_id -ne $inventoryId -or $state.disk_unique_id -ne $ExpectedDiskUniqueId) {
        throw 'Existing checkpoint belongs to another disk or inventory.'
    }
}
elseif (Test-Path -LiteralPath $ledgerPath) { throw 'Hash ledger has no identity receipt; stopped.' }
else {
    [ordered]@{ inventory_id = $inventoryId; disk_unique_id = $ExpectedDiskUniqueId } |
        ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
}
$proof = @{}
if (Test-Path -LiteralPath $ledgerPath) {
    Import-Csv -LiteralPath $ledgerPath | Where-Object {
        $_.inventory_id -eq $inventoryId -and $_.disk_unique_id -eq $ExpectedDiskUniqueId -and
            $_.sha256 -match '^[a-fA-F0-9]{64}$'
    } | ForEach-Object { $proof[$_.relative_path] = $_ }
}

$watch = [System.Diagnostics.Stopwatch]::StartNew()
$hashedBytes = 0L
$hashedFiles = 0
$reused = 0
$changed = 0
$errorMessage = $null
foreach ($row in $eligible) {
    if ($hashedFiles -ge $MaximumFiles -or $watch.Elapsed.TotalSeconds -ge $MaximumSeconds) { break }
    if (-not $proof.ContainsKey($row.relative_path) -and
        $hashedBytes + [long]$row.size_bytes -gt $HashBudgetBytes) { continue }
    $path = [System.IO.Path]::GetFullPath((Join-Path $source $row.relative_path))
    if (-not $path.StartsWith($source, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Manifest path escapes the source directory.'
    }
    # Read through the bound volume GUID so a replacement E: cannot become this source.
    # .NET/PowerShell 7 also handles the long Adobe preview/cache paths in real archives.
    $readPath = $volumeRoot + $path.Substring(3)
    $file = [System.IO.FileInfo]::new($readPath)
    if (-not $file.Exists) { $errorMessage = 'Inventoried candidate is missing or unavailable: ' + $row.relative_path; break }
    if (($file.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Reparse-point candidates require separate review.'
    }
    if ($file.Length -ne [long]$row.size_bytes -or $file.LastWriteTimeUtc.ToString('o') -ne $row.last_write_utc) {
        $proof.Remove($row.relative_path)
        $row.hash_status = 'changed_since_inventory'
        $row.sha256 = ''
        $changed++
        continue
    }
    if ($proof.ContainsKey($row.relative_path) -and
        [long]$proof[$row.relative_path].size_bytes -eq $file.Length -and
        $proof[$row.relative_path].last_write_utc -eq $row.last_write_utc) {
        $reused++
        continue
    }
    if ($hashedFiles -ge $MaximumFiles -or $watch.Elapsed.TotalSeconds -ge $MaximumSeconds) { break }
    if ($hashedBytes + $file.Length -gt $HashBudgetBytes) { continue }

    $stream = $null
    $algorithm = $null
    try {
        # Deny writers while reading so a changing file cannot receive a verified digest.
        $stream = [System.IO.File]::Open($readPath, [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
        $algorithm = [System.Security.Cryptography.SHA256]::Create()
        $digest = [System.BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant()
        $stream.Dispose()
        $stream = $null
        $after = [System.IO.FileInfo]::new($readPath)
        if ($after.Length -ne $file.Length -or $after.LastWriteTimeUtc -ne $file.LastWriteTimeUtc) {
            throw 'File metadata changed while hashing.'
        }
        $evidence = [pscustomobject]@{
            inventory_id = $inventoryId
            disk_unique_id = $ExpectedDiskUniqueId
            relative_path = $row.relative_path
            size_bytes = $file.Length
            last_write_utc = $row.last_write_utc
            sha256 = $digest
            verified_at_utc = (Get-Date).ToUniversalTime().ToString('o')
        }
        $evidence | Export-Csv -LiteralPath $ledgerPath -NoTypeInformation -Encoding UTF8 -Append
        $proof[$row.relative_path] = $evidence
        $hashedFiles++
        $hashedBytes += $file.Length
    }
    catch {
        $errorMessage = $_.Exception.Message
        break
    }
    finally {
        if ($stream) { $stream.Dispose() }
        if ($algorithm) { $algorithm.Dispose() }
    }
}

foreach ($row in $manifest) {
    if ($proof.ContainsKey($row.relative_path) -and
        [long]$proof[$row.relative_path].size_bytes -eq [long]$row.size_bytes -and
        $proof[$row.relative_path].last_write_utc -eq $row.last_write_utc) {
        $row.sha256 = $proof[$row.relative_path].sha256
        $row.hash_status = 'verified'
    }
}
$manifest | Export-Csv -LiteralPath $enrichedPath -NoTypeInformation -Encoding UTF8
$summary = [ordered]@{
    captured_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    disk_unique_id = $ExpectedDiskUniqueId
    inventory_id = $inventoryId
    eligible_candidate_count = $eligible.Count
    new_hashed_files = $hashedFiles
    new_hashed_bytes = $hashedBytes
    reused_verified_files = $reused
    changed_since_inventory = $changed
    total_verified_files = @($manifest | Where-Object hash_status -eq 'verified').Count
    elapsed_seconds = [Math]::Round($watch.Elapsed.TotalSeconds, 2)
    error = $errorMessage
    source_read_only = $true
    deletion_authorised = $false
    runtime_note = 'Time limit checked between files; individual reads may exceed it.'
}
$summary | ConvertTo-Json | Set-Content -LiteralPath $summaryPath -Encoding UTF8
[pscustomobject]@{ summary = $summaryPath; manifest = $enrichedPath; hashed_files = $hashedFiles; hashed_bytes = $hashedBytes; error = $errorMessage }
if ($errorMessage) { throw "Candidate hashing stopped; checkpoint retained at $summaryPath. $errorMessage" }
