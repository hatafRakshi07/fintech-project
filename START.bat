@echo off
echo ============================================
echo   Bissi App - Start Script (Docker-less PGlite)
echo ============================================
echo.

REM Set local Node path
set PATH=%~dp0.node;%PATH%

REM Step 1: Start PGlite Database Server
echo [1/2] Starting PGlite Database Server...
start "Bissi Database (PGlite)" cmd /k "cd /d "%~dp0" && node pg-local.mjs"
timeout /t 5 /nobreak >nul

REM Step 2: Start API Server (serving both API and Frontend in Production)
echo [2/2] Starting Bissi Production Server on port 5001...
set DATABASE_URL=postgresql://postgres@127.0.0.1:5432/bissi_db
set PORT=5001
set NODE_ENV=production
start "Bissi API Server" cmd /k "cd /d "%~dp0artifacts\api-server" && node --enable-source-maps --env-file=.env .\dist\index.mjs"
timeout /t 2 /nobreak >nul

echo.
echo ============================================
echo   All services started!
echo.
echo   App URL    : http://localhost:5001
echo   Collector  : http://localhost:5001/collector
echo.
echo   Login credentials:
echo     Username : admin
echo     Password : admin123
echo ============================================
echo.
pause
