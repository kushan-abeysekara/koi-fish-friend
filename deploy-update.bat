@echo off
REM ============================================
REM System Update Deployment Script
REM 4x5kg Load Cells + Real-time Monitoring
REM ============================================

echo.
echo ========================================
echo System Update Deployment
echo ========================================
echo.

REM Step 1: Database Migration
echo [Step 1/3] Running Database Migration...
echo.
echo Please run this command manually:
echo mysql -h 82.197.82.97 -u root -p koifish ^< database\add_feeding_device_columns.sql
echo.
pause

REM Step 2: Backend Restart
echo.
echo [Step 2/3] Restarting Backend...
cd backend
call mvn clean install
if errorlevel 1 (
    echo ERROR: Backend build failed!
    pause
    exit /b 1
)
echo Backend built successfully!
echo.
echo Starting backend server...
start "Koi Backend" cmd /k mvn spring-boot:run
echo Backend started in new window
cd ..
timeout /t 10

REM Step 3: Frontend Restart
echo.
echo [Step 3/3] Restarting Frontend...
cd frontend
start "Koi Frontend" cmd /k npm run dev
echo Frontend started in new window
cd ..

echo.
echo ========================================
echo Deployment Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Upload ESP32 code (Kushanesp32feedcode.ino)
echo 2. Wire Tank C to GPIO 32/33
echo 3. Wire Tank D to GPIO 14/15
echo 4. Open http://localhost:5173/dashboard/feeding-dashboard
echo 5. Open http://localhost:5173/dashboard/feeder-health-safety
echo.
echo See SYSTEM_UPDATE_4x5KG_LOAD_CELLS.md for full instructions
echo.
pause
