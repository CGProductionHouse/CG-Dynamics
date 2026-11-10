# Nolan Desktop motion entrypoint. Owner-authorised system extension, 10 Nov 2026.
# The existing client/story/audio/release workflow remains authoritative.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('lint','check','snapshot','timeline','info','render')]
  [string]$Command,
  [Parameter(Mandatory=$true)][string]$Project,
  [string]$Output,
  [ValidateSet('mp4','mov','webm')][string]$Format='mp4',
  [string]$At,
  [string]$Runtime=$env:NOLAN_MOTION_RUNTIME,
  [string]$Python=$env:NOLAN_EDITOR_PYTHON
)
$ErrorActionPreference='Stop'
if (-not $Runtime) {
  if ($env:COMPUTERNAME -ne 'DESKTOP-M1VHEJF') {
    throw 'This device is not qualified. Supply independently verified runtime paths; do not infer a Katana installation.'
  }
  $Runtime=Join-Path $env:USERPROFILE 'Documents\Codex\2026-10-27\n\work\tools\nolan-browser-motion'
}
if (-not $Python) {
  $Python=Join-Path (Split-Path $Runtime -Parent) 'editor-python\Scripts\python.exe'
}
$Runner=Join-Path $Runtime 'nolan_system.py'
foreach ($Path in @($Python,$Runner,(Join-Path $Project 'NOLAN-JOB.json'))) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing required local file: $Path" }
}
if ($Command -eq 'render' -and -not $Output) { throw 'Render requires a new --Output; overwriting existing media is forbidden.' }
$ArgsList=@($Runner,$Command,$Project)
if ($Output) { $ArgsList+=@('--output',$Output) }
if ($Command -eq 'render') { $ArgsList+=@('--format',$Format) }
if ($At) { $ArgsList+=@('--at',$At) }
# This entrypoint never logs into providers, publishes, renders in a cloud, or opens an employee browser.
# The pinned runtime invokes the original Nolan story preflight for real client jobs.
& $Python @ArgsList
if ($LASTEXITCODE -ne 0) { throw "Nolan local engine failed with exit $LASTEXITCODE. Read its saved qualification receipt." }
