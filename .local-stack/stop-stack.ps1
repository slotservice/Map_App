# Stop the local-dev stack. Postgres stays running (it's a Windows service);
# only MinIO needs explicit shutdown.

Get-Process minio -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Stopping MinIO (PID $($_.Id))..." -ForegroundColor Cyan
    Stop-Process -Id $_.Id -Force
}
Write-Host "✔ Local stack stopped." -ForegroundColor Green
