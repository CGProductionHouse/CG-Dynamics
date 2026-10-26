[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateCount(1, 100)]
    [string[]]$ManifestPath,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'

$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

$sizeGroups = [System.Collections.Generic.Dictionary[long, System.Collections.Generic.List[object]]]::new()
$seenManifests = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$inventorySources = @{}
$fileCount = 0L
foreach ($inputPath in $ManifestPath) {
    $resolvedManifest = (Resolve-Path -LiteralPath $inputPath).Path
    if (-not $seenManifests.Add($resolvedManifest)) {
        throw "Manifest was supplied more than once: $resolvedManifest"
    }
    Import-Csv -LiteralPath $resolvedManifest | Where-Object {
        $_.item_type -eq 'file' -and [long]$_.size_bytes -gt 0
    } | ForEach-Object {
        if ($inventorySources.ContainsKey($_.inventory_id) -and $inventorySources[$_.inventory_id] -ne $resolvedManifest) {
            throw 'Inventory supplied more than once through different manifests; use the enriched OR original manifest.'
        }
        $inventorySources[$_.inventory_id] = $resolvedManifest
        $size = [long]$_.size_bytes
        if (-not $sizeGroups.ContainsKey($size)) {
            $sizeGroups[$size] = [System.Collections.Generic.List[object]]::new()
        }
        $sizeGroups[$size].Add([pscustomobject]@{
            source_manifest = $resolvedManifest
            inventory_id = $_.inventory_id
            relative_path = $_.relative_path
            size_bytes = $size
            sha256 = ([string]$_.sha256).ToLowerInvariant()
            hash_status = $_.hash_status
        })
        $fileCount++
    }
}

$sameSizeRows = [System.Collections.Generic.List[object]]::new()
$unverifiedRows = [System.Collections.Generic.List[object]]::new()
$exactRows = [System.Collections.Generic.List[object]]::new()
$sameSizeGroupCount = 0
$unverifiedGroupCount = 0
$exactGroupCount = 0
$potentialSizeOnlyBytes = 0L
$verifiedExactBytes = 0L

$candidateSizes = @($sizeGroups.Keys | Where-Object { $sizeGroups[$_].Count -gt 1 } | Sort-Object)
foreach ($sizeKey in $candidateSizes) {
    $sameSizeGroupCount++
    $members = @($sizeGroups[$sizeKey])
    $size = [long]$sizeKey
    $potentialReclaim = $size * ($members.Count - 1)
    $potentialSizeOnlyBytes += $potentialReclaim
    $sizeGroupId = 'SIZE-{0:D8}' -f $sameSizeGroupCount

    foreach ($member in $members) {
        $sameSizeRows.Add([pscustomobject]@{
            candidate_group = $sizeGroupId
            size_bytes = $size
            member_count = $members.Count
            potential_reclaim_bytes = $potentialReclaim
            source_manifest = $member.source_manifest
            inventory_id = $member.inventory_id
            relative_path = $member.relative_path
            sha256 = $member.sha256
            hash_status = $member.hash_status
            duplicate_status = 'UNVERIFIED_SIZE_MATCH_ONLY'
        })
    }

    $verifiedMembers = @($members | Where-Object {
        $_.hash_status -eq 'verified' -and $_.sha256 -match '^[a-f0-9]{64}$'
    })
    $verifiedMemberKeys = @{}
    foreach ($verifiedMember in $verifiedMembers) {
        $verifiedMemberKeys[('{0}|{1}|{2}' -f $verifiedMember.source_manifest, $verifiedMember.inventory_id, $verifiedMember.relative_path)] = $true
    }

    $verifiedExactMemberKeys = @{}
    foreach ($hashGroup in @($verifiedMembers | Group-Object sha256 | Where-Object Count -gt 1)) {
        $exactGroupCount++
        $exactGroupId = 'EXACT-{0:D8}' -f $exactGroupCount
        $hashMembers = @($hashGroup.Group)
        $exactReclaim = $size * ($hashMembers.Count - 1)
        $verifiedExactBytes += $exactReclaim

        foreach ($member in $hashMembers) {
            $memberKey = '{0}|{1}|{2}' -f $member.source_manifest, $member.inventory_id, $member.relative_path
            $verifiedExactMemberKeys[$memberKey] = $true
            $exactRows.Add([pscustomobject]@{
                exact_group = $exactGroupId
                size_bytes = $size
                member_count = $hashMembers.Count
                verified_reclaim_bytes = $exactReclaim
                sha256 = $member.sha256
                source_manifest = $member.source_manifest
                inventory_id = $member.inventory_id
                relative_path = $member.relative_path
                duplicate_status = 'VERIFIED_EXACT_SHA256'
            })
        }
    }

    $unverifiedMembers = @($members | Where-Object {
        $memberKey = '{0}|{1}|{2}' -f $_.source_manifest, $_.inventory_id, $_.relative_path
        -not $verifiedExactMemberKeys.ContainsKey($memberKey)
    })
    if ($unverifiedMembers.Count -gt 0) {
        $unverifiedGroupCount++
        foreach ($member in $unverifiedMembers) {
            $unverifiedRows.Add([pscustomobject]@{
                candidate_group = $sizeGroupId
                size_bytes = $size
                group_member_count = $members.Count
                source_manifest = $member.source_manifest
                inventory_id = $member.inventory_id
                relative_path = $member.relative_path
                sha256 = $member.sha256
                hash_status = $member.hash_status
                reason = if (-not $verifiedMemberKeys.ContainsKey(('{0}|{1}|{2}' -f $member.source_manifest, $member.inventory_id, $member.relative_path))) {
                    'HASH_REQUIRED'
                }
                else {
                    'HASH_DIFFERS_FROM_OTHER_SAME_SIZE_FILES'
                }
            })
        }
    }
}

$sameSizePath = Join-Path $outputRoot 'same-size-candidates-unverified.csv'
$unverifiedPath = Join-Path $outputRoot 'unresolved-size-candidates.csv'
$exactPath = Join-Path $outputRoot 'verified-exact-duplicates.csv'
$summaryPath = Join-Path $outputRoot 'manifest-comparison-summary.json'

$sameSizeRows | Export-Csv -LiteralPath $sameSizePath -NoTypeInformation -Encoding UTF8
$unverifiedRows | Export-Csv -LiteralPath $unverifiedPath -NoTypeInformation -Encoding UTF8
$exactRows | Export-Csv -LiteralPath $exactPath -NoTypeInformation -Encoding UTF8

$summary = [ordered]@{
    schema_version = 1
    generated_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    read_only_inputs = $true
    manifest_count = $ManifestPath.Count
    file_count = $fileCount
    same_size_candidate_group_count = $sameSizeGroupCount
    same_size_candidate_file_count = $sameSizeRows.Count
    potential_reclaim_bytes_unverified = $potentialSizeOnlyBytes
    unresolved_candidate_group_count = $unverifiedGroupCount
    unresolved_candidate_file_count = $unverifiedRows.Count
    verified_exact_group_count = $exactGroupCount
    verified_exact_file_count = $exactRows.Count
    verified_exact_reclaim_bytes = $verifiedExactBytes
    proof_rule = 'Only equal size plus a matching verified SHA-256 is an exact duplicate.'
    deletion_authorised = $false
}
$summary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $summaryPath -Encoding UTF8

[pscustomobject]@{
    summary = $summaryPath
    same_size_candidates = $sameSizePath
    unresolved_candidates = $unverifiedPath
    verified_exact_duplicates = $exactPath
    verified_exact_group_count = $exactGroupCount
    verified_exact_reclaim_bytes = $verifiedExactBytes
}
