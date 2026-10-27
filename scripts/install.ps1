#Requires -Version 5.1
<#
.SYNOPSIS
  Install Mitsu's Python and frontend dependencies on Windows.

.DESCRIPTION
  Creates a local virtual environment, installs the backend requirements, and
  installs the frontend packages. Pass -Build to also create the production
  build used by `python run.py --prod`.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/install.ps1
  powershell -ExecutionPolicy Bypass -File scripts/install.ps1 -Build
#>
param([switch]$Build)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Stop-WithHint([string]$message) {
    Write-Host ""
    Write-Host $message -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Stop-WithHint "Python 3.11 or newer is required. Install it from https://www.python.org/downloads/ and tick 'Add python.exe to PATH'."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Stop-WithHint "Node.js 20 or newer is required. Install it from https://nodejs.org/."
}

Write-Host "`n  mitsu installer`n" -ForegroundColor Magenta

# ---- Python ----
if (-not (Test-Path ".venv")) {
    Write-Host "  creating .venv ..." -ForegroundColor DarkGray
    python -m venv .venv
}

$python = Join-Path $root ".venv\Scripts\python.exe"
& $python -m pip install --upgrade pip --quiet
Write-Host "  installing backend requirements ..." -ForegroundColor DarkGray
& $python -m pip install -r backend/requirements.txt --quiet

# ---- Frontend ----
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "  enabling pnpm via corepack ..." -ForegroundColor DarkGray
    try {
        corepack enable
        corepack prepare pnpm@9.12.3 --activate
    } catch {
        npm install -g pnpm@9.12.3
    }
}

Write-Host "  installing frontend packages ..." -ForegroundColor DarkGray
pnpm install

if ($Build) {
    Write-Host "  building the production frontend ..." -ForegroundColor DarkGray
    pnpm build
}

Write-Host ""
Write-Host "  Ready. Start Mitsu with:" -ForegroundColor Green
if ($Build) {
    Write-Host "    .venv\Scripts\python.exe run.py --prod"
} else {
    Write-Host "    .venv\Scripts\python.exe run.py"
}
Write-Host ""
