@echo off
setlocal

title AuraSMM Backend and Worker Launcher

echo ============================================================
echo   AuraSMM Production Backend and Worker Launcher
echo   Platform: Windows RDP Server
echo ============================================================
echo.

REM 1. Check Node.js prerequisite
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js LTS 18+ from https://nodejs.org/
    pause
    exit /b 1
)

REM 2. Check npm prerequisite
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm is not found in PATH!
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do echo [OK] Node.js version: %%v
for /f "tokens=*" %%v in ('npm -v') do echo [OK] npm version: %%v
echo.

REM 3. Check for .env file
if exist .env goto :env_ready
if exist .env.example (
    echo [INFO] Copying .env.example to .env
    copy .env.example .env >nul
    echo [OK] Created .env file
)
:env_ready

REM 4. Check or Generate Prisma Client
echo [INFO] Checking Prisma client...
if exist "node_modules\.prisma\client\query_engine-windows.dll.node" (
    echo [OK] Prisma client is already generated and ready.
) else (
    echo [INFO] Generating Prisma client...
    call npx prisma generate
    if %ERRORLEVEL% neq 0 (
        echo [WARNING] Prisma generate encountered a lock. Retrying...
        timeout /t 2 /nobreak >nul
        call npx prisma generate
    )
)

REM 5. Ensure production build exists
if exist ".next" goto :build_ready
echo [INFO] Next.js production build not found. Compiling now...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Application build failed!
    pause
    exit /b 1
)
:build_ready

REM 6. Free port 3000 if occupied to prevent EADDRINUSE
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo [INFO] Freeing occupied port 3000 PID %%p
    taskkill /F /PID %%p >nul 2>&1
)

echo.
echo ============================================================
echo   Starting Backend Web Server on Port 3000...
echo   Starting Continuous Background Worker Daemon...
echo ============================================================
echo.
echo Web Server: http://localhost:3000
echo Health Check: http://localhost:3000/api/health
echo Background Worker: Launching in dedicated window
echo.
echo Run stop-backend.bat to terminate both services safely.
echo ============================================================
echo.

REM 7. Launch Background Worker in separate window
start "AuraSMM Worker Daemon" cmd /k "npm run worker"

REM 8. Launch Next.js production server in current window
call npm run start
