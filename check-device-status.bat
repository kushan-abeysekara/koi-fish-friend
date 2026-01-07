@echo off
echo.
echo ============================================
echo ESP32 & Device Status Checker
echo ============================================
echo.

echo [1] Checking Backend Status...
powershell -Command "if ((Test-NetConnection -ComputerName localhost -Port 8080 -InformationLevel Quiet)) { Write-Host 'Backend: RUNNING (port 8080)' -ForegroundColor Green } else { Write-Host 'Backend: NOT RUNNING' -ForegroundColor Red }"

echo.
echo [2] Testing Device API Endpoint...
curl -s http://localhost:8080/api/sensor-devices/feed_device_001 > temp_device.json
if exist temp_device.json (
    echo Device API Response:
    type temp_device.json
    del temp_device.json
) else (
    echo ERROR: Could not fetch device data
)

echo.
echo [3] Quick Setup Instructions:
echo.
echo IF DEVICE SHOWS OFFLINE:
echo.
echo A. Is ESP32 Powered On?
echo    - Check power supply
echo    - Look for LED lights on ESP32
echo.
echo B. Is ESP32 Code Uploaded?
echo    - Open Arduino IDE
echo    - Upload Kushanesp32feedcode.ino
echo    - Open Serial Monitor (115200 baud)
echo.
echo C. Check Serial Monitor for:
echo    - "WiFi connected"
echo    - "MQTT connection...connected"
echo    - "Published status: ..."
echo.
echo D. If ESP32 is running but still showing offline:
echo    - Check backend logs for "Feeding device status updated"
echo    - Run: mysql -h 82.197.82.97 -u root -p koifish
echo    - Query: SELECT device_id, status, last_seen FROM sensor_devices WHERE device_id='feed_device_001';
echo.
pause
