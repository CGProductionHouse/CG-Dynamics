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
        warning_volume_guard = $warningVolumeGuard
    }
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
