$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$packageJsonPath = Join-Path $repoRoot "package.json"
$packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
$version = $packageJson.version

$releaseDir = Join-Path $repoRoot "release"
$bundledDataDir = Join-Path $repoRoot "release pack\data"
$sourceExe = Join-Path $releaseDir ("Marvis {0}.exe" -f $version)
$zipStage = Join-Path $releaseDir "win-release-stage"
$zipPath = Join-Path $releaseDir ("Marvis-v{0}-win32-x64.zip" -f $version)

if (-not (Test-Path $sourceExe)) {
  throw "Portable EXE not found: $sourceExe"
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
New-Item -ItemType Directory -Path (Join-Path $zipStage "data") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $zipStage "skills") | Out-Null

# Copy only Marvis.exe (DLLs are bundled inside Marvis.exe or in resources folder that Electron needs)
$unpackedDir = Join-Path $repoRoot "release\win-unpacked"
$sourcePath = Join-Path $unpackedDir "Marvis.exe"
if (Test-Path $sourcePath) {
  Copy-Item $sourcePath (Join-Path $zipStage "Marvis.exe")
}
Copy-Item (Join-Path $bundledDataDir "music-library.json") (Join-Path $zipStage "data\music-library.json")
Copy-Item (Join-Path $bundledDataDir "music") (Join-Path $zipStage "data\music") -Recurse
Copy-Item (Join-Path $repoRoot "skills\agentic-marvis-brief") (Join-Path $zipStage "skills\agentic-marvis-brief") -Recurse
Copy-Item (Join-Path $repoRoot "skills\agentic-marvis-dashboard") (Join-Path $zipStage "skills\agentic-marvis-dashboard") -Recurse

Compress-Archive -Path (Join-Path $zipStage "*") -DestinationPath $zipPath
Write-Host "Created $zipPath"
