#requires -Version 7.0
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('cg-candidate-hash-test-' + [guid]::NewGuid().ToString('n'))
$source = Join-Path $testRoot 'source'
$output = Join-Path $testRoot 'hashes'
try {
    New-Item -ItemType Directory -Path $source -Force | Out-Null
    [System.IO.File]::WriteAllBytes((Join-Path $source 'copy-a.bin'), [byte[]](0..255))
    [System.IO.File]::WriteAllBytes((Join-Path $source 'copy-b.bin'), [byte[]](0..255))
    [System.IO.File]::WriteAllBytes((Join-Path $source 'different.bin'), [byte[]](255..0))
    $longDirectory = $source
    1..6 | ForEach-Object { $longDirectory = Join-Path $longDirectory ('long-preview-directory-' + ('x' * 30)) }
    [System.IO.Directory]::CreateDirectory($longDirectory) | Out-Null
    [System.IO.File]::WriteAllBytes((Join-Path $longDirectory 'long-path.bin'), [byte[]](0..255))
    $manifestResult = & (Join-Path $scriptRoot 'New-CGMediaManifest.ps1') -SourceRoot $source -OutputDirectory (Join-Path $testRoot 'inventory')
    $candidatePath = Join-Path $testRoot 'candidates.csv'
    Import-Csv -LiteralPath $manifestResult.manifest | Export-Csv -LiteralPath $candidatePath -NoTypeInformation -Encoding UTF8
    $letter = (Split-Path -Qualifier $source).Substring(0, 1)
    $identity = (Get-Partition -DriveLetter $letter | Get-Disk).UniqueId
    $hashArguments = @{
        SourceRoot = $source
        ExpectedDiskUniqueId = $identity
        ManifestPath = $manifestResult.manifest
        CandidatePath = $candidatePath
        OutputDirectory = $output
        HashBudgetBytes = 1024
        MaximumSeconds = 60
    }
    $first = & (Join-Path $scriptRoot 'Invoke-CGMediaCandidateHashes.ps1') @hashArguments
    if ($first.hashed_files -ne 4 -or $first.error) { throw 'Initial hashing including the long path failed.' }
    $rows = @(Import-Csv -LiteralPath $first.manifest)
    $copyA = $rows | Where-Object relative_path -eq 'copy-a.bin'
    $copyB = $rows | Where-Object relative_path -eq 'copy-b.bin'
    $different = $rows | Where-Object relative_path -eq 'different.bin'
    if ($copyA.sha256 -ne $copyB.sha256 -or $copyA.sha256 -eq $different.sha256) {
        throw 'Same-size but different content was not distinguished.'
    }
    $second = & (Join-Path $scriptRoot 'Invoke-CGMediaCandidateHashes.ps1') @hashArguments
    if ($second.hashed_files -ne 0) { throw 'Resume reread files already verified.' }
    [System.IO.File]::WriteAllBytes((Join-Path $source 'copy-b.bin'), [byte[]](255..0))
    [System.IO.File]::SetLastWriteTimeUtc((Join-Path $source 'copy-b.bin'), (Get-Date).ToUniversalTime().AddSeconds(3))
    $third = & (Join-Path $scriptRoot 'Invoke-CGMediaCandidateHashes.ps1') @hashArguments
    $changed = Import-Csv -LiteralPath $third.manifest | Where-Object relative_path -eq 'copy-b.bin'
    if ($changed.hash_status -ne 'changed_since_inventory' -or $changed.sha256) {
        throw 'Changed source retained a stale verified digest.'
    }
    $wrongIdentityPassed = $false
    try {
        $hashArguments.ExpectedDiskUniqueId = 'NOT-THE-EXPECTED-DISK'
        & (Join-Path $scriptRoot 'Invoke-CGMediaCandidateHashes.ps1') @hashArguments | Out-Null
    }
    catch { $wrongIdentityPassed = $_.Exception.Message -like '*identity does not match*' }
    if (-not $wrongIdentityPassed) { throw 'Wrong disk identity did not fail closed.' }
    [pscustomobject]@{ status = 'PASS'; hash_distinguishes_content = $true; long_paths = $true; resume = $true; changed_file_guard = $true; wrong_disk_guard = $true }
}
finally {
    $resolvedTestRoot = [System.IO.Path]::GetFullPath($testRoot)
    $resolvedTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolvedTestRoot.StartsWith($resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase) -or
        (Split-Path -Leaf $resolvedTestRoot) -notlike 'cg-candidate-hash-test-*') {
        throw 'Disposable cleanup target did not pass the temp-path guard.'
    }
    if (Test-Path -LiteralPath $resolvedTestRoot) { Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force }
}
