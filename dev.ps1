# Run dev server without relying on PATH (use after fresh Node install)
$nodeDir = "C:\Program Files\nodejs"
if (-not (Test-Path "$nodeDir\npm.cmd")) {
  Write-Error "Node.js not found at $nodeDir. Install from https://nodejs.org/"
  exit 1
}
$env:Path = "$nodeDir;" + [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
Set-Location $PSScriptRoot
& "$nodeDir\npm.cmd" run dev
