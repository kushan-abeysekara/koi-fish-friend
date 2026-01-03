@echo off
REM ============================================
REM Backend Restart & Device Setup
REM ============================================

echo.
echo ========================================
echo Backend Restart for Device Status Fix
echo ========================================
echo.

REM Step 1: Run database migrations
echo [Step 1/4] Running Database Migrations...
echo.
echo Run these commands manually in MySQL:
echo.
echo mysql -h 82.197.82.97 -u root -p koifish ^< database\add_feeding_device_columns.sql
echo mysql -h 82.197.82.97 -u root -p koifish ^< database\create_feed_device.sql
echo.
pause

REM Step 2: Kill existing backend
echo.
echo [Step 2/4] Stopping existing backend...
taskkill /F /FI "WINDOWTITLE eq Koi Backend*" 2>nul
timeout /t 2

REM Step 3: Rebuild backend
echo.
echo [Step 3/4] Rebuilding backend...
cd backend
call mvn clean package -DskipTests
if errorlevel 1 (
    echo ERROR: Backend build failed!
    pause
    exit /b 1
)
cd ..
echo Backend rebuilt successfully!

REM Step 4: Start backend
echo.
echo [Step 4/4] Starting backend...
cd backend
start "Koi Backend" cmd /k "mvn spring-boot:run"
cd ..
timeout /t 5

echo.
echo ========================================
echo Backend Started!
echo ========================================
echo.
echo Next steps:
echo 1. Upload ESP32 code if not done yet
echo 2. Power on ESP32
echo 3. Watch backend logs for "Feeding device status updated"
echo 4. Check http://localhost:5173/dashboard/feeding-dashboard
echo 5. Check http://localhost:5173/dashboard/feeder-health-safety
echo.
echo The device should show as "Online" within 5 seconds
echo.
pause
