@echo off
echo ============================================================
echo   SHREE KRISHNA ASSOCIATION - FINTECH PROJECT AUTOMATION
echo ============================================================
echo.

REM Step 1: Check & Start Docker / PostgreSQL
echo [1/4] Checking PostgreSQL Database Service...
docker ps >nul 2>&1
if %errorlevel%==0 (
    echo   [OK] Docker Daemon is running!
    docker start bissi-postgres >nul 2>&1
    if %errorlevel% neq 0 (
        echo   Creating new PostgreSQL container...
        docker run -d --name bissi-postgres ^
          -e POSTGRES_PASSWORD=postgres123 ^
          -e POSTGRES_DB=bissi_db ^
          -p 5432:5432 ^
          postgres:16-alpine >nul 2>&1
    )
    echo   [OK] PostgreSQL Database ready on port 5432!
) else (
    echo   [NOTICE] Docker Desktop is not running. API Server will use PGLite / local DB fallback.
)

REM Step 2: Start API Server (Port 5001)
echo.
echo [2/4] Starting API Server on Port 5001...
set DATABASE_URL=postgres://postgres:postgres123@localhost:5432/bissi_db
set PORT=5001
start "Fintech API Server (Port 5001)" cmd /k "cd /d "%~dp0artifacts\api-server" && pnpm run dev"

REM Step 3: Start Admin App & Customer Portal (Port 5000)
echo.
echo [3/4] Starting Admin Panel & Customer Portal on Port 5000...
start "Admin App & Customer Portal (Port 5000)" cmd /k "cd /d "%~dp0" && set PORT=5000 && pnpm --filter @workspace/bissi-app run dev"

REM Step 4: Start Collector App (Port 5002)
echo.
echo [4/4] Starting Field Collector App on Port 5002...
start "Collector App (Port 5002)" cmd /k "cd /d "%~dp0" && set PORT=5002 && pnpm --filter @workspace/collector-app run dev"

REM Wait 5 seconds for dev servers to initialize
timeout /t 5 /nobreak >nul

REM Step 5: Automatically Open Browser Portals
echo.
echo Launching Portals in Web Browser...
start "" "http://localhost:5000"
start "" "http://localhost:5002/collector/"

echo.
echo ============================================================
echo   ALL FINTECH SERVICES AUTOMATED & STARTED SUCCESSFULLY!
echo ============================================================
echo   - Admin & Customer Portal : http://localhost:5000
echo   - Field Collector App    : http://localhost:5002/collector/
echo   - Backend API Server     : http://localhost:5001/api/health
echo ============================================================
echo.
pause
