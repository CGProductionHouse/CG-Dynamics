param(
    [ValidateSet('Check', 'Install')]
    [string]$Mode = 'Check',
    [string]$Destination = (Join-Path $env:LOCALAPPDATA 'CGProductionHouse\PICASSO\runtime-0.3.9')
)

$ErrorActionPreference = 'Stop'
$source = $PSScriptRoot
$model = Join-Path $source 'models\face_detection_yunet_2026may.onnx'
$expectedModelHash = 'EBAFCE4E3C118D6554634BE5C27AB333B4C047A9A8C3FAF1D7CF93101C22F0F0'
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
    Copy-Item -LiteralPath (Join-Path $source 'picasso.py') -Destination $destinationFull -Force
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
    $model = Join-Path $destinationFull 'models\face_detection_yunet_2026may.onnx'
} else {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCommand) { throw 'Python is not available on this Windows host.' }
    $venvPython = $pythonCommand.Source
    $runner = Join-Path $source 'picasso.py'
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
if ((Get-FileHash -LiteralPath $model -Algorithm SHA256).Hash -ne $expectedModelHash) {
    throw 'Installed PICASSO model hash differs from reviewed source.'
}
Write-Output $runtime
Write-Output "PICASSO host $Mode passed; runner=$runner"
Write-Output 'No photo folders, credentials, remote device, or ChatGPT account were changed by this check.'
