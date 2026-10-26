[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('cg-storage-audit-test-' + [guid]::NewGuid().ToString('n'))
$source = Join-Path $testRoot 'source'
$output = Join-Path $testRoot 'output'

try {
    New-Item -ItemType Directory -Path (Join-Path $source 'camera\DCIM') -Force | Out-Null
    [System.IO.File]::WriteAllBytes((Join-Path $source 'camera\DCIM\clip01.bin'), [byte[]](0..255))
    Set-Content -LiteralPath (Join-Path $source 'notes.txt') -Value 'synthetic test only' -Encoding UTF8

    $before = Get-ChildItem -LiteralPath $source -File -Recurse | Sort-Object FullName | ForEach-Object {
        [pscustomobject]@{
            path = $_.FullName.Substring($source.Length)
            length = $_.Length
            sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
        }
    }

    $result = & (Join-Path $scriptRoot 'New-CGMediaManifest.ps1') `
        -SourceRoot $source `
        -OutputDirectory $output `
        -HashBudgetBytes 1048576 `
        -MaximumItems 100

    $after = Get-ChildItem -LiteralPath $source -File -Recurse | Sort-Object FullName | ForEach-Object {
        [pscustomobject]@{
            path = $_.FullName.Substring($source.Length)
            length = $_.Length
            sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
        }
    }

    if (($before | ConvertTo-Json -Compress) -ne ($after | ConvertTo-Json -Compress)) {
        throw 'Source files changed during the manifest test.'
    }

    if (-not (Test-Path -LiteralPath $result.manifest)) { throw 'Manifest was not created.' }
    if (-not (Test-Path -LiteralPath $result.summary)) { throw 'Summary was not created.' }

    $summary = Get-Content -LiteralPath $result.summary -Raw | ConvertFrom-Json
    if ($summary.file_count -ne 2) { throw "Expected 2 files, found $($summary.file_count)." }
    if ($summary.directory_count -ne 2) { throw "Expected 2 directories, found $($summary.directory_count)." }
    if ($summary.hashed_file_count -ne 2) { throw "Expected both files to be hashed, found $($summary.hashed_file_count)." }
    if ($summary.truncated) { throw 'Synthetic manifest was unexpectedly truncated.' }
    if ($summary.classification.intended_role -ne 'UNCLASSIFIED_PENDING_SYDNEY_REVIEW') {
        throw 'The safe unclassified default was not preserved.'
    }

    $nestedOutput = Join-Path $source 'should-not-write-here'
    $guardPassed = $false
    try {
        & (Join-Path $scriptRoot 'New-CGMediaManifest.ps1') -SourceRoot $source -OutputDirectory $nestedOutput | Out-Null
    }
    catch {
        $guardPassed = $_.Exception.Message -like '*outside SourceRoot*'
    }
    if (-not $guardPassed) { throw 'Output-inside-source guard did not fail closed.' }

    $comparisonInputA = Join-Path $testRoot 'comparison-a.csv'
    $comparisonInputB = Join-Path $testRoot 'comparison-b.csv'
    @(
        [pscustomobject]@{ inventory_id = 'A'; item_type = 'file'; relative_path = 'exact-a.mov'; size_bytes = 10; last_write_utc = ''; extension = '.mov'; sha256 = ('a' * 64); hash_status = 'verified' }
        [pscustomobject]@{ inventory_id = 'A'; item_type = 'file'; relative_path = 'needs-hash-a.jpg'; size_bytes = 20; last_write_utc = ''; extension = '.jpg'; sha256 = ''; hash_status = 'not_requested' }
        [pscustomobject]@{ inventory_id = 'A'; item_type = 'file'; relative_path = 'different-a.mp4'; size_bytes = 30; last_write_utc = ''; extension = '.mp4'; sha256 = ('b' * 64); hash_status = 'verified' }
    ) | Export-Csv -LiteralPath $comparisonInputA -NoTypeInformation -Encoding UTF8
    @(
        [pscustomobject]@{ inventory_id = 'B'; item_type = 'file'; relative_path = 'exact-b.mov'; size_bytes = 10; last_write_utc = ''; extension = '.mov'; sha256 = ('a' * 64); hash_status = 'verified' }
        [pscustomobject]@{ inventory_id = 'B'; item_type = 'file'; relative_path = 'needs-hash-b.jpg'; size_bytes = 20; last_write_utc = ''; extension = '.jpg'; sha256 = ''; hash_status = 'not_requested' }
        [pscustomobject]@{ inventory_id = 'B'; item_type = 'file'; relative_path = 'different-b.mp4'; size_bytes = 30; last_write_utc = ''; extension = '.mp4'; sha256 = ('c' * 64); hash_status = 'verified' }
    ) | Export-Csv -LiteralPath $comparisonInputB -NoTypeInformation -Encoding UTF8
    $comparisonOutput = Join-Path $testRoot 'comparison-output'
    & (Join-Path $scriptRoot 'Compare-CGMediaManifests.ps1') `
        -ManifestPath @($comparisonInputA, $comparisonInputB) `
        -OutputDirectory $comparisonOutput | Out-Null
    $comparisonSummary = Get-Content -LiteralPath (Join-Path $comparisonOutput 'manifest-comparison-summary.json') -Raw |
        ConvertFrom-Json
    if ($comparisonSummary.verified_exact_group_count -ne 1) {
        throw 'Expected exactly one SHA-256-proven duplicate group.'
    }
    if ($comparisonSummary.verified_exact_reclaim_bytes -ne 10) {
        throw 'Verified duplicate reclaim bytes were calculated incorrectly.'
    }
    if ($comparisonSummary.unresolved_candidate_file_count -ne 4) {
        throw 'Same-size files without matching verified hashes were not kept unresolved.'
    }
    $duplicateManifestGuardPassed = $false
    try {
        & (Join-Path $scriptRoot 'Compare-CGMediaManifests.ps1') `
            -ManifestPath @($comparisonInputA, $comparisonInputA) `
            -OutputDirectory (Join-Path $testRoot 'duplicate-manifest-output') | Out-Null
    }
    catch {
        $duplicateManifestGuardPassed = $_.Exception.Message -like '*supplied more than once*'
    }
    if (-not $duplicateManifestGuardPassed) {
        throw 'Supplying one manifest twice did not fail closed.'
    }
    $sameInventoryCopy = Join-Path $testRoot 'same-inventory-copy.csv'
    Copy-Item -LiteralPath $comparisonInputA -Destination $sameInventoryCopy
    $duplicateInventoryGuardPassed = $false
    try {
        & (Join-Path $scriptRoot 'Compare-CGMediaManifests.ps1') `
            -ManifestPath @($comparisonInputA, $sameInventoryCopy) `
            -OutputDirectory (Join-Path $testRoot 'duplicate-inventory-output') | Out-Null
    }
    catch { $duplicateInventoryGuardPassed = $_.Exception.Message -like '*Inventory supplied more than once*' }
    if (-not $duplicateInventoryGuardPassed) { throw 'An original plus enriched copy of one inventory was counted twice.' }

    $readinessOutput = Join-Path $testRoot 'readiness'
    & (Join-Path $scriptRoot 'Get-CGStorageHostReadiness.ps1') `
        -OutputDirectory $readinessOutput `
        -SkipStorageReliability | Out-Null
    $readinessReport = Get-Content -LiteralPath (Join-Path $readinessOutput 'host-readiness.json') -Raw |
        ConvertFrom-Json
    $readinessSummary = Get-Content -LiteralPath (Join-Path $readinessOutput 'host-readiness.txt') -Raw
    $expectedWarningVolumes = @($readinessReport.volumes | Where-Object {
        $_.Size -gt 0 -and ($_.HealthStatus -ne 'Healthy' -or @($_.OperationalStatus) -notcontains 'OK')
    }).Count
    if ($readinessSummary -notmatch ("Warning media volumes: {0}" -f $expectedWarningVolumes)) {
        throw 'Readiness warning-volume summary does not match the JSON receipt.'
    }

    $warningVolumeGuard = 'NOT_APPLICABLE_SYNTHETIC_HEALTHY_VOLUME'
    $warningVolume = Get-Volume | Where-Object {
        $_.DriveLetter -and $_.Size -gt 0 -and
            ($_.HealthStatus -ne 'Healthy' -or @($_.OperationalStatus) -notcontains 'OK')
    } | Select-Object -First 1
    if ($warningVolume) {
        $warningOutput = Join-Path $testRoot 'warning-volume-output'
        $warningGuardPassed = $false
        try {
            & (Join-Path $scriptRoot 'New-CGMediaManifest.ps1') `
                -SourceRoot ("{0}:\" -f $warningVolume.DriveLetter) `
                -OutputDirectory $warningOutput `
                -MaximumItems 1 | Out-Null
        }
        catch {
            $warningGuardPassed = $_.Exception.Message -like '*not safe for a recursive inventory*'
        }
        if (-not $warningGuardPassed) { throw 'Warning-volume guard did not fail closed.' }
        $warningVolumeGuard = 'PASS'
    }

    [pscustomobject]@{
        status = 'PASS'
        source_unchanged = $true
        files_verified = 2
        output_inside_source_guard = 'PASS'
        duplicate_proof_guard = 'PASS'
        duplicate_manifest_guard = 'PASS'
        duplicate_inventory_guard = 'PASS'
        readiness_warning_count = 'PASS'
        warning_volume_guard = $warningVolumeGuard
    }
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
