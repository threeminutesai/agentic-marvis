$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$packageJsonPath = Join-Path $repoRoot "package.json"
$packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
$version = $packageJson.version

$releaseDir = Join-Path $repoRoot "release"
$bundledDataDir = Join-Path $repoRoot "data"
$portableExe = Join-Path $releaseDir ("Marvis {0}.exe" -f $version)
$zipStage = Join-Path $releaseDir "win-release-stage"
$zipPath = Join-Path $releaseDir ("Marvis-v{0}-win32-x64.zip" -f $version)

# The 'portable' electron-builder target produces a single self-extracting exe.
# All Electron runtime files are embedded inside it — no sibling DLLs needed.
if (-not (Test-Path $portableExe)) {
  throw "Portable exe not found: $portableExe. Run 'npm run dist:win' first."
}

if (-not (Test-Path (Join-Path $bundledDataDir "music-library.json"))) {
  throw "Bundled music library not found: $(Join-Path $bundledDataDir 'music-library.json')"
}

if (-not (Test-Path (Join-Path $bundledDataDir "music"))) {
  throw "Bundled music folder not found: $(Join-Path $bundledDataDir 'music')"
}

if (Test-Path $zipStage) {
  Remove-Item $zipStage -Recurse -Force
}

if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

New-Item -ItemType Directory -Path $zipStage | Out-Null

# Copy the single portable exe
Copy-Item $portableExe (Join-Path $zipStage "Marvis.exe")

# Layer bundled data and skills alongside the exe so the app finds them on first launch
New-Item -ItemType Directory -Path (Join-Path $zipStage "data") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $zipStage "skills") -Force | Out-Null
Copy-Item (Join-Path $bundledDataDir "music-library.json") (Join-Path $zipStage "data\music-library.json")
Copy-Item (Join-Path $bundledDataDir "music") (Join-Path $zipStage "data\music") -Recurse
Copy-Item (Join-Path $repoRoot "skills\agentic-marvis-brief") (Join-Path $zipStage "skills\agentic-marvis-brief") -Recurse
Copy-Item (Join-Path $repoRoot "skills\agentic-marvis-dashboard") (Join-Path $zipStage "skills\agentic-marvis-dashboard") -Recurse

Compress-Archive -Path (Join-Path $zipStage "*") -DestinationPath $zipPath
$zipSizeMb = "{0:N1}" -f ((Get-Item $zipPath).Length / 1MB)
Write-Host "Created $zipPath ($zipSizeMb MB)"
