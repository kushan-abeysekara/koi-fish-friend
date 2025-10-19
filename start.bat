@echo off
REM Koi Fish Friend - Start Script (Batch Version)
REM This batch file starts both backend and frontend

color 0B
echo ========================================
echo    Koi Fish Friend - Starting...
echo ========================================
echo.

echo Starting Backend...
start "Backend" cmd /k "cd /d %~dp0backend && mvnw.cmd spring-boot:run"

echo Waiting for backend to initialize...
timeout /t 15 /nobreak

echo.
echo Starting Frontend...
start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo    Both services are starting!
echo ========================================
echo.
echo Access Points:
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8080
echo.
echo Demo Credentials:
echo   Username: admin
echo   Password: admin123
echo.
echo Press any key to exit...
pause >nul
