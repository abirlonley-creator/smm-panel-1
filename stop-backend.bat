@echo off
echo ============================================================
echo   Stopping AuraSMM Backend and Background Worker...
echo ============================================================

:: 1. Kill processes listening on port 3000 (Next.js server)
echo [INFO] Terminating Next.js web server on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo [INFO] Found process PID %%a on port 3000. Terminating...
    taskkill /F /PID %%a >nul 2>&1
)

:: 2. Kill Worker Daemon window if running
echo [INFO] Terminating background worker daemon...
taskkill /F /FI "WINDOWTITLE eq AuraSMM Worker Daemon*" >nul 2>&1

echo.
echo [OK] AuraSMM services have been safely stopped.
echo ============================================================
pause
