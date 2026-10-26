[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$SourceRoot,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$OutputDirectory,

    [ValidateRange(0, 109951162777600)]
    [long]$HashBudgetBytes = 0,

    [ValidateRange(1, 10000000)]
    [int]$MaximumItems = 1000000
)

$ErrorActionPreference = 'Stop'

function Test-IsWithinPath {
    param(
        [Parameter(Mandatory = $true)][string]$Candidate,
        [Parameter(Mandatory = $true)][string]$Parent
    )

    $candidatePath = [System.IO.Path]::GetFullPath($Candidate).TrimEnd('\') + '\'
    $parentPath = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
    return $candidatePath.StartsWith($parentPath, [System.StringComparison]::OrdinalIgnoreCase)
}

$source = (Resolve-Path -LiteralPath $SourceRoot).Path
$output = [System.IO.Path]::GetFullPath($OutputDirectory)

if (Test-IsWithinPath -Candidate $output -Parent $source) {
    throw 'OutputDirectory must be outside SourceRoot so the inventory never writes to the media being audited.'
}

$sourceQualifier = Split-Path -Qualifier $source
if ($sourceQualifier -match '^[A-Za-z]:\\?$') {
    $sourceDriveLetter = $sourceQualifier.Substring(0, 1)
    $sourceVolume = Get-Volume -DriveLetter $sourceDriveLetter -ErrorAction Stop
    $sourceOperationalStatus = @($sourceVolume.OperationalStatus | ForEach-Object { [string]$_ })
    if ($sourceVolume.HealthStatus -ne 'Healthy' -or $sourceOperationalStatus -notcontains 'OK') {
        throw ("Source volume {0}: is not safe for a recursive inventory. HealthStatus={1}; OperationalStatus={2}. Stop and review recovery/backup options before further reads." -f `
            $sourceDriveLetter, $sourceVolume.HealthStatus, ($sourceOperationalStatus -join ', '))
    }
}

New-Item -ItemType Directory -Path $output -Force | Out-Null

$sourceItem = Get-Item -LiteralPath $source -Force
if (-not $sourceItem.PSIsContainer) {
    throw 'SourceRoot must be a directory or volume root.'
}

$inventoryId = [guid]::NewGuid().ToString()
$capturedAt = (Get-Date).ToUniversalTime().ToString('o')
$manifestPath = Join-Path $output 'media-manifest.csv'
$summaryPath = Join-Path $output 'media-manifest-summary.json'
$errorsPath = Join-Path $output 'media-manifest-errors.csv'

$beforeSource = Get-Item -LiteralPath $source -Force
$writer = [System.IO.StreamWriter]::new($manifestPath, $false, [System.Text.UTF8Encoding]::new($true))
$errorRows = [System.Collections.Generic.List[object]]::new()
$extensionBytes = @{}
$extensionCounts = @{}
$fileCount = 0L
$directoryCount = 0L
$totalBytes = 0L
$hashedBytes = 0L
$hashedFiles = 0L
$truncated = $false

try {
    $header = 'inventory_id,item_type,relative_path,size_bytes,last_write_utc,extension,sha256,hash_status'
    $writer.WriteLine($header)

    Get-ChildItem -LiteralPath $source -Force -Recurse -ErrorAction SilentlyContinue -ErrorVariable +scanErrors |
        Select-Object -First ($MaximumItems + 1) |
        ForEach-Object {
            if (($fileCount + $directoryCount) -ge $MaximumItems) {
                $truncated = $true
                return
            }

            $relativePath = $_.FullName.Substring($source.Length).TrimStart('\')
            $escapedPath = '"' + $relativePath.Replace('"', '""') + '"'

            if ($_.PSIsContainer) {
                $directoryCount++
                $writer.WriteLine(('{0},directory,{1},0,{2},,,not_applicable' -f $inventoryId, $escapedPath, $_.LastWriteTimeUtc.ToString('o')))
                return
            }

            $fileCount++
            $size = [long]$_.Length
            $totalBytes += $size
            $extension = $_.Extension.ToLowerInvariant()
            if (-not $extension) { $extension = '[none]' }
            $extensionCounts[$extension] = 1L + [long]($extensionCounts[$extension])
            $extensionBytes[$extension] = $size + [long]($extensionBytes[$extension])

            $sha256 = ''
            $hashStatus = 'not_requested'
            if ($HashBudgetBytes -gt 0 -and ($hashedBytes + $size) -le $HashBudgetBytes) {
                try {
                    $sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
                    $hashStatus = 'verified'
                    $hashedBytes += $size
                    $hashedFiles++
                }
                catch {
                    $hashStatus = 'error'
                    $errorRows.Add([pscustomobject]@{
                        path = $relativePath
                        operation = 'sha256'
                        error = $_.Exception.Message
                    })
                }
            }
            elseif ($HashBudgetBytes -gt 0) {
                $hashStatus = 'budget_exhausted'
            }

            $escapedExtension = '"' + $extension.Replace('"', '""') + '"'
            $writer.WriteLine(('{0},file,{1},{2},{3},{4},{5},{6}' -f $inventoryId, $escapedPath, $size,
                $_.LastWriteTimeUtc.ToString('o'), $escapedExtension, $sha256, $hashStatus))
        }

    if ($scanErrors) {
        foreach ($scanError in $scanErrors) {
            $errorRows.Add([pscustomobject]@{
                path = $source
                operation = 'enumerate'
                error = $scanError.Exception.Message
            })
        }
    }
}
finally {
    $writer.Dispose()
}

if ($errorRows.Count -gt 0) {
    $errorRows | Export-Csv -LiteralPath $errorsPath -NoTypeInformation -Encoding UTF8
}

$topExtensions = @($extensionBytes.Keys | ForEach-Object {
    [pscustomobject]@{
        extension = $_
        file_count = [long]$extensionCounts[$_]
        total_bytes = [long]$extensionBytes[$_]
    }
} | Sort-Object total_bytes -Descending | Select-Object -First 50)

$afterSource = Get-Item -LiteralPath $source -Force
$summary = [ordered]@{
    schema_version = 1
    inventory_id = $inventoryId
    captured_at_utc = $capturedAt
    read_only_source = $true
    source_root = $source
    output_directory = $output
    source_last_write_utc_before = $beforeSource.LastWriteTimeUtc.ToString('o')
    source_last_write_utc_after = $afterSource.LastWriteTimeUtc.ToString('o')
    file_count = $fileCount
    directory_count = $directoryCount
    total_bytes = $totalBytes
    hash_budget_bytes = $HashBudgetBytes
    hashed_file_count = $hashedFiles
    hashed_bytes = $hashedBytes
    maximum_items = $MaximumItems
    truncated = $truncated
    error_count = $errorRows.Count
    top_extensions_by_bytes = $topExtensions
    classification = [ordered]@{
        volume_id = $null
        intended_role = 'UNCLASSIFIED_PENDING_SYDNEY_REVIEW'
        canonical_client_id = $null
        content_run_id = $null
        deliverable_id = $null
        planner_task_id = $null
        backup_state = 'UNVERIFIED'
    }
}

$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $summaryPath -Encoding UTF8

[pscustomobject]@{
    manifest = $manifestPath
    summary = $summaryPath
    errors = if (Test-Path -LiteralPath $errorsPath) { $errorsPath } else { $null }
    file_count = $fileCount
    directory_count = $directoryCount
    total_bytes = $totalBytes
    hashed_files = $hashedFiles
    truncated = $truncated
}
