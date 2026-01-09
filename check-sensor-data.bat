@echo off
echo ========================================
echo Sensor Data Flow Diagnostic
echo ========================================
echo.

echo Checking system status...
echo.

echo [1/5] Checking if services are running...
docker-compose ps
echo.

echo [2/5] Checking last 10 MQTT messages...
docker-compose logs --tail=10 backend | findstr /C:"MQTT" /C:"Energy data" /C:"sensor"
echo.

echo [3/5] Checking for recent sensor data saves...
docker-compose logs --tail=20 backend | findstr /C:"Energy data saved" /C:"data saved"
echo.

echo [4/5] Checking device status...
docker-compose logs --tail=10 backend | findstr /C:"Device status updated"
echo.

echo [5/5] Testing API endpoint...
echo Fetching latest sensor data from API...
curl -s http://localhost:8081/api/sensors/data/pond/1/latest
echo.
echo.

echo ========================================
echo Diagnostic Complete!
echo ========================================
echo.
echo If you see "Energy data saved" messages above,
echo your sensor data is flowing correctly! ✅
echo.
echo If not, check:
echo 1. ESP32 is powered on and WiFi connected
echo 2. ESP32 LCD shows voltage/current readings
echo 3. Backend service is running (docker-compose ps)
echo.
pause
