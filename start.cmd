@echo off
cd /d "%~dp0"
if not exist "offline\index.html" (
  echo Please run npm run build:offline first.
  pause
  exit /b 1
)
start "" "offline\index.html"
