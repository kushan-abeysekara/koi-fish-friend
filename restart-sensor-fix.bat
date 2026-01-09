@echo off
echo ========================================
echo Sensor Data Fix - Quick Restart
echo ========================================
echo.

echo Step 1: Stopping all services...
docker-compose down
echo.

echo Step 2: Rebuilding backend with fixes...
cd backend
call mvnw.cmd clean package -DskipTests
cd ..
echo.

echo Step 3: Starting all services...
docker-compose up --build -d
echo.

echo Step 4: Waiting for services to start (30 seconds)...
timeout /t 30 /nobreak > nul
echo.

echo Step 5: Checking backend logs...
echo ========================================
echo Looking for sensor data messages...
echo ========================================
docker-compose logs -f backend | findstr /C:"Energy data" /C:"Device status" /C:"MQTT message"

pause
