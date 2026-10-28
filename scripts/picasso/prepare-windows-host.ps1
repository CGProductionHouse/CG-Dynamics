param(
    [ValidateSet('Check', 'Install')]
    [string]$Mode = 'Check',
    [string]$Destination = (Join-Path $env:LOCALAPPDATA 'CGProductionHouse\PICASSO\runtime-0.3.13')
)

$ErrorActionPreference = 'Stop'
$source = $PSScriptRoot
$model = Join-Path $source 'models\face_detection_yunet_2026may.onnx'
$expectedModelHash = 'EBAFCE4E3C118D6554634BE5C27AB333B4C047A9A8C3FAF1D7CF93101C22F0F0'
$portableFiles = @(
    'picasso.py', 'shoot_index.py', 'assemble_gallery_revision.py',
    'delivery_consistency_audit.py', 'event_quality_review.py', 'sanitize_editor_jpeg.py',
    'verify_gallery_download.py', 'SKILL.md', 'requirements-windows.txt',
    'references\event-quality-gate.md', 'references\large-shoot.md',
    'models\face_detection_yunet_2026may.onnx', 'models\LICENSE-YuNet.txt'
)
if (-not (Test-Path -LiteralPath $model -PathType Leaf)) { throw 'PICASSO model is missing from the checkout.' }
if ((Get-FileHash -LiteralPath $model -Algorithm SHA256).Hash -ne $expectedModelHash) {
    throw 'PICASSO model hash does not match the reviewed source.'
}

if ($Mode -eq 'Install') {
    if (-not (Get-Command py -ErrorAction SilentlyContinue)) { throw 'Python launcher is required on this Windows host.' }
    $destinationFull = [System.IO.Path]::GetFullPath($Destination)
    $localAppDataFull = [System.IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd('\') + '\'
    if (-not $destinationFull.StartsWith($localAppDataFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Install destination must be below this Windows user LocalAppData folder.'
    }
    New-Item -ItemType Directory -Path (Join-Path $destinationFull 'models') -Force | Out-Null
    foreach ($helper in @('picasso.py', 'shoot_index.py', 'assemble_gallery_revision.py',
        'delivery_consistency_audit.py', 'event_quality_review.py', 'sanitize_editor_jpeg.py',
        'verify_gallery_download.py')) {
        Copy-Item -LiteralPath (Join-Path $source $helper) -Destination $destinationFull -Force
    }
    New-Item -ItemType Directory -Path (Join-Path $destinationFull 'references') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $source 'references\event-quality-gate.md') -Destination (Join-Path $destinationFull 'references') -Force
    Copy-Item -LiteralPath (Join-Path $source 'references\large-shoot.md') -Destination (Join-Path $destinationFull 'references') -Force
    Copy-Item -LiteralPath (Join-Path $source 'SKILL.md') -Destination $destinationFull -Force
    Copy-Item -LiteralPath (Join-Path $source 'requirements-windows.txt') -Destination $destinationFull -Force
    Copy-Item -LiteralPath $model -Destination (Join-Path $destinationFull 'models') -Force
    Copy-Item -LiteralPath (Join-Path $source 'models\LICENSE-YuNet.txt') -Destination (Join-Path $destinationFull 'models') -Force
    $venvPython = Join-Path $destinationFull '.venv\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $venvPython)) {
        & py -3.13 -m venv (Join-Path $destinationFull '.venv')
        if ($LASTEXITCODE -ne 0) { throw 'Python 3.13 virtual environment creation failed.' }
    }
    & $venvPython -m pip install --disable-pip-version-check -r (Join-Path $destinationFull 'requirements-windows.txt')
    if ($LASTEXITCODE -ne 0) { throw 'PICASSO free Python dependency installation failed.' }
    $runner = Join-Path $destinationFull 'picasso.py'
    $indexer = Join-Path $destinationFull 'shoot_index.py'
    $downloadVerifier = Join-Path $destinationFull 'verify_gallery_download.py'
    $model = Join-Path $destinationFull 'models\face_detection_yunet_2026may.onnx'
} else {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCommand) { throw 'Python is not available on this Windows host.' }
    $venvPython = $pythonCommand.Source
    $runner = Join-Path $source 'picasso.py'
    $indexer = Join-Path $source 'shoot_index.py'
    $downloadVerifier = Join-Path $source 'verify_gallery_download.py'
}

$probe = @'
import json, platform, sys
from pathlib import Path
import cv2, numpy, PIL
assert sys.version_info[:2] == (3, 13), 'Reviewed Windows runtime uses Python 3.13'
assert cv2.__version__ == '5.0.0', 'Unexpected OpenCV version'
assert numpy.__version__ == '2.5.1', 'Unexpected NumPy version'
assert PIL.__version__ == '12.2.0', 'Unexpected Pillow version'
assert hasattr(cv2, 'FaceDetectorYN'), 'OpenCV FaceDetectorYN unavailable'
print(json.dumps({'python': platform.python_version(), 'opencv': cv2.__version__,
                  'numpy': numpy.__version__, 'pillow': PIL.__version__,
                  'architecture': platform.machine()}))
'@
$runtime = $probe | & $venvPython -
if ($LASTEXITCODE -ne 0) { throw 'PICASSO host runtime check failed.' }
& $venvPython $runner --help | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'PICASSO runner cannot start.' }
& $venvPython $indexer --help | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'PICASSO large-shoot indexer cannot start.' }
& $venvPython $downloadVerifier --help | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'PICASSO gallery download verifier cannot start.' }
if ((Get-FileHash -LiteralPath $model -Algorithm SHA256).Hash -ne $expectedModelHash) {
    throw 'Installed PICASSO model hash differs from reviewed source.'
}
if ($Mode -eq 'Install') {
    $runtimeDetails = $runtime | ConvertFrom-Json
    $runtimeManifest = [ordered]@{
        schema_version = 1
        runtime_version = '0.3.13'
        python = $runtimeDetails.python
        opencv = $runtimeDetails.opencv
        numpy = $runtimeDetails.numpy
        pillow = $runtimeDetails.pillow
        architecture = $runtimeDetails.architecture
        files = @($portableFiles | ForEach-Object {
            $installedFile = Join-Path $destinationFull $_
            if (-not (Test-Path -LiteralPath $installedFile -PathType Leaf)) {
                throw "Installed PICASSO runtime is missing $_"
            }
            [ordered]@{
                path = $_.Replace('\', '/')
                sha256 = (Get-FileHash -LiteralPath $installedFile -Algorithm SHA256).Hash.ToLowerInvariant()
            }
        })
    }
    $manifestJson = $runtimeManifest | ConvertTo-Json -Depth 4
    $manifestPath = Join-Path $destinationFull 'runtime-manifest.json'
    [System.IO.File]::WriteAllText($manifestPath, $manifestJson + [Environment]::NewLine,
        [System.Text.UTF8Encoding]::new($false))
    Write-Output "Runtime manifest: $manifestPath"
}
Write-Output $runtime
Write-Output "PICASSO host $Mode passed; runner=$runner"
Write-Output 'No photo folders, credentials, remote device, or ChatGPT account were changed by this check.'
