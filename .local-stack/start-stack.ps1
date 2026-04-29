# Start the local-dev stack natively (no Docker required).
#   - Verifies Postgres service is running
#   - Boots MinIO server (background)
#   - Creates the photos bucket via mc client
#
# Run from the repo root:  pwsh ./.local-stack/start-stack.ps1
# (or: .\.local-stack\start-stack.ps1 if PowerShell is your default)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Postgres service check
Write-Host "[1/3] Checking Postgres service..." -ForegroundColor Cyan
$svc = Get-Service postgresql* -ErrorAction SilentlyContinue
if (-not $svc) {
    Write-Error "PostgreSQL service not found. Install PostgreSQL 17+ first."
    exit 1
}
if ($svc.Status -ne 'Running') {
    Write-Host "  Starting service..." -ForegroundColor Yellow
    Start-Service $svc.Name
    Start-Sleep -Seconds 2
}
Write-Host "  ✔ $($svc.Name) is $($svc.Status)" -ForegroundColor Green

# 2. MinIO
Write-Host "[2/3] Starting MinIO..." -ForegroundColor Cyan
$dataDir = Join-Path $here 'data'
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null

# Stop any old instance
Get-Process minio -ErrorAction SilentlyContinue | Stop-Process -Force

$env:MINIO_ROOT_USER = 'mapapp'
$env:MINIO_ROOT_PASSWORD = 'mapapp_dev_only'

$minioLog = Join-Path $here 'minio.log'
$minioExe = Join-Path $here 'minio.exe'
Start-Process -FilePath $minioExe -ArgumentList @(
    'server', $dataDir, '--console-address', ':9001'
) -WindowStyle Hidden -RedirectStandardOutput $minioLog -RedirectStandardError "$minioLog.err"

# Wait for MinIO to come up
$ready = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $r = Invoke-WebRequest -Uri 'http://localhost:9000/minio/health/live' -UseBasicParsing -TimeoutSec 1
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
}
if (-not $ready) {
    Write-Error "MinIO did not come up within 10s. Check $minioLog"
    exit 1
}
Write-Host "  ✔ MinIO listening on :9000 (console :9001)" -ForegroundColor Green

# 3. Bucket bootstrap
Write-Host "[3/3] Creating bucket..." -ForegroundColor Cyan
$mcExe = Join-Path $here 'mc.exe'
& $mcExe alias set local http://localhost:9000 mapapp mapapp_dev_only 2>&1 | Out-Null
& $mcExe mb -p local/fcfm-photos-dev 2>&1 | Out-Null
Write-Host "  ✔ Bucket fcfm-photos-dev ready" -ForegroundColor Green

Write-Host ""
Write-Host "Local stack up:" -ForegroundColor Green
Write-Host "  Postgres : postgresql://mapapp:mapapp_dev_only@localhost:5432/mapapp_dev"
Write-Host "  MinIO    : http://localhost:9000     (console: http://localhost:9001 — login mapapp / mapapp_dev_only)"
Write-Host ""
Write-Host "If this is your first time, run the Postgres bootstrap once:"
Write-Host "  & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -h localhost -U postgres -f infra/local-postgres-bootstrap.sql" -ForegroundColor Yellow
