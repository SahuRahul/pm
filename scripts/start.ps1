Set-Location (Join-Path $PSScriptRoot "..")
docker compose up -d --build
Write-Host "App is running at http://localhost:8000"
