# AuraSMM Windows PowerShell Backend Launcher
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   AuraSMM Production Backend & Worker Launcher (PowerShell)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Prerequisite checks
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not installed or not in PATH!" -ForegroundColor Red
    Exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] npm is not found in PATH!" -ForegroundColor Red
    Exit 1
}

$nodeVersion = node -v
$npmVersion = npm -v
Write-Host "[OK] Node.js $nodeVersion and npm $npmVersion detected." -ForegroundColor Green

# 2. Check environment configuration
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Write-Host "[INFO] .env not found. Copying .env.example to .env..." -ForegroundColor Yellow
        Copy-Item ".env.example" ".env"
    } else {
        Write-Host "[WARN] Neither .env nor .env.example found. Proceeding with defaults." -ForegroundColor Yellow
    }
}

# 3. Prisma client generation
Write-Host "[INFO] Verifying database schema and Prisma Client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Prisma generation failed!" -ForegroundColor Red
    Exit 1
}

# 4. Check production build
if (-not (Test-Path ".next")) {
    Write-Host "[INFO] Next.js build not detected. Compiling production bundle..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Application build failed!" -ForegroundColor Red
        Exit 1
    }
}

# 5. Free port 3000 if currently occupied
$occupiedPort = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($occupiedPort) {
    Write-Host "[INFO] Freeing occupied port 3000 (PID $($occupiedPort.OwningProcess))..." -ForegroundColor Yellow
    Stop-Process -Id $occupiedPort.OwningProcess -Force -ErrorAction SilentlyContinue
}

# 6. Launch Services
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "   Starting Backend Web Server on Port 3000..." -ForegroundColor Green
Write-Host "   Starting Continuous Background Worker Daemon..." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Web Server: http://localhost:3000" -ForegroundColor Gray
Write-Host "Health Check: http://localhost:3000/api/health" -ForegroundColor Gray
Write-Host "Worker Daemon: Launching in separate PowerShell window...`n" -ForegroundColor Gray

Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run worker"

npm run start
