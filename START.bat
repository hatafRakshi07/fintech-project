@echo off
echo ============================================
echo   Bissi App - Start Script
echo ============================================
echo.

REM Step 1: Start Docker Desktop and wait
echo [1/4] Starting Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
timeout /t 20 /nobreak >nul

REM Switch to Linux containers context
docker context use desktop-linux >nul 2>&1

REM Wait until Docker daemon is ready (up to 60 seconds)
set /a tries=0
:wait_docker
docker ps >nul 2>&1
if %errorlevel%==0 goto docker_ready
set /a tries+=1
if %tries%==12 (
    echo ERROR: Docker did not start in time. Please open Docker Desktop manually and run this script again.
    pause
    exit /b 1
)
echo   Waiting for Docker... (%tries%/12)
timeout /t 5 /nobreak >nul
goto wait_docker

:docker_ready
echo   Docker is ready!

REM Step 2: Start PostgreSQL container
echo [2/4] Starting PostgreSQL...
docker start bissi-postgres >nul 2>&1
if %errorlevel% neq 0 (
    echo   Creating new PostgreSQL container...
    docker run -d --name bissi-postgres ^
      -e POSTGRES_PASSWORD=postgres123 ^
      -e POSTGRES_DB=bissi_db ^
      -p 5432:5432 ^
      postgres:16-alpine
)
timeout /t 3 /nobreak >nul
echo   PostgreSQL running on port 5432!

REM Step 3: Start API Server (port 5001)
echo [3/4] Starting API Server on port 5001...
set DATABASE_URL=postgres://postgres:postgres123@localhost:5432/bissi_db
set PORT=5001
start "Bissi API Server" cmd /k "cd /d C:\Users\iSN_kota_T52\Desktop\File-Processor\artifacts\api-server && node --enable-source-maps --env-file=.env .\dist\index.mjs"
timeout /t 2 /nobreak >nul

REM Step 4: Start Frontend (port 5000)
echo [4/4] Starting Frontend on port 5000...
start "Bissi Frontend" cmd /k "cd /d C:\Users\iSN_kota_T52\Desktop\File-Processor && set PORT=5000 && pnpm --filter @workspace/bissi-app run dev"

echo.
echo ============================================
echo   All services started!
echo.
echo   Admin App  : http://localhost:5000
echo   API Server : http://localhost:5001
echo.
echo   Login with:
echo     Username : admin
echo     Password : admin123
echo ============================================
echo.
pause
