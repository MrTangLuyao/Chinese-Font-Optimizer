# Repack the extension into all_harmonybrains.crx
# Usage: powershell -ExecutionPolicy Bypass -File pack.ps1
#
# Reuses all_harmonybrains.pem if present so the CRX keeps the same
# extension ID across rebuilds (required for Chrome to treat it as
# the same extension and preserve settings).

$ErrorActionPreference = 'Stop'

$root    = $PSScriptRoot
$src     = Join-Path $root 'src'
$crxOut  = Join-Path $root 'all_harmonybrains.crx'
$pemOut  = Join-Path $root 'all_harmonybrains.pem'

$chromeCandidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chrome = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw "chrome.exe not found in standard locations." }

# Clean previous build artifacts (keep .pem so the extension ID is stable)
$tmpCrx = Join-Path $root 'src.crx'
$tmpPem = Join-Path $root 'src.pem'
if (Test-Path $tmpCrx) { Remove-Item $tmpCrx -Force }
if (Test-Path $tmpPem) { Remove-Item $tmpPem -Force }
if (Test-Path $crxOut) { Remove-Item $crxOut -Force }

$args = @("--pack-extension=$src", "--no-message-box")
if (Test-Path $pemOut) {
    $args += "--pack-extension-key=$pemOut"
} else {
    Write-Host "No existing key found — Chrome will generate a new one." -ForegroundColor Yellow
}

& $chrome @args | Out-Null
if ($LASTEXITCODE -ne 0) { throw "chrome.exe exited with code $LASTEXITCODE" }

if (Test-Path $tmpCrx) { Move-Item $tmpCrx $crxOut -Force }
if (Test-Path $tmpPem) { Move-Item $tmpPem $pemOut -Force }

if (-not (Test-Path $crxOut)) { throw "Pack failed — $crxOut not produced." }
$kb = [math]::Round((Get-Item $crxOut).Length / 1KB, 1)
Write-Host "Built: $crxOut ($kb KB)" -ForegroundColor Green
