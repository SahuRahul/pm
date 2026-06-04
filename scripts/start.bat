@echo off
cd /d "%~dp0\.."
docker compose up -d --build
echo App is running at http://localhost:8000
