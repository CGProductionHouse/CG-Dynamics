param(
    [switch]$Install,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$source = Join-Path $repoRoot '.agents\skills\cg-video-story-editor'
$codexRoot = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$destination = Join-Path $codexRoot 'skills\cg-video-story-editor'

function Get-SkillManifest([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) { return @() }
    @(Get-ChildItem -LiteralPath $path -Recurse -File |
        Where-Object { $_.FullName -notmatch '__pycache__|\.pyc$' } |
        ForEach-Object {
            $relative = $_.FullName.Substring($path.Length + 1).Replace('\', '/')
            "$relative $((Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash)"
        } | Sort-Object)
}

if (-not (Test-Path -LiteralPath (Join-Path $source 'SKILL.md'))) {
    throw "Canonical skill missing: $source"
}
$sourceManifest = Get-SkillManifest $source
$installedManifest = Get-SkillManifest $destination
$same = ($sourceManifest -join "`n") -eq ($installedManifest -join "`n")
if ($same) {
    Write-Output "CURRENT: $destination matches $source"
    exit 0
}
if (-not $Install) {
    Write-Output "DIFFERENT: $destination does not match $source. Review then run -Install."
    exit 2
}
if ((Test-Path -LiteralPath $destination) -and -not $Force) {
    throw "Existing skill differs. Review it; rerun with -Install -Force to back it up and install the repository copy."
}
if (Test-Path -LiteralPath $destination) {
    $backup = "$destination.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Move-Item -LiteralPath $destination -Destination $backup
    Write-Output "BACKUP: $backup"
}
New-Item -ItemType Directory -Force -Path $destination | Out-Null
Get-ChildItem -LiteralPath $source -Recurse -File |
    Where-Object { $_.FullName -notmatch '__pycache__|\.pyc$' } |
    ForEach-Object {
        $relative = $_.FullName.Substring($source.Length + 1)
        $target = Join-Path $destination $relative
        New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
        Copy-Item -LiteralPath $_.FullName -Destination $target
    }
if (($sourceManifest -join "`n") -ne ((Get-SkillManifest $destination) -join "`n")) {
    throw 'Installed skill hash manifest does not match canonical copy.'
}
Write-Output "INSTALLED: $destination matches $source"
