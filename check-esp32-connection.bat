@echo off
echo ========================================
echo ESP32 Connection Diagnostic
echo ========================================
echo.
echo Checking if ESP32 is connected and publishing...
echo.

echo 1. Checking backend API status...
powershell -Command "try { $device = Invoke-RestMethod 'http://localhost:8080/api/sensors/device/feed_device_001'; Write-Host 'Device Status:' $device.data.status -ForegroundColor $(if($device.data.status -eq 'online'){'Green'}else{'Red'}); Write-Host 'Last Seen:' $device.data.lastSeen; Write-Host 'Hopper Level:' $device.data.hopperLevel'g' } catch { Write-Host 'Error: Cannot reach backend API' -ForegroundColor Red }"

echo.
echo 2. Current time: 
powershell -Command "Get-Date -Format 'yyyy-MM-dd HH:mm:ss'"

echo.
echo ========================================
echo If Status is OFFLINE, please check:
echo ========================================
echo.
echo ESP32 Serial Monitor should show:
echo   [OK] WiFi connected
echo   [OK] IP address: 192.168.x.x  
echo   [OK] MQTT connection...connected
echo   [OK] Subscribed to: koi/devices/feed_device_001/feeding/command
echo   [OK] Published status: {"deviceId":"feed_device_001",...}
echo.
echo If you DON'T see these messages:
echo   1. Check ESP32 is powered on
echo   2. Check USB cable is connected
echo   3. Open Serial Monitor (115200 baud)
echo   4. Press EN/RESET button on ESP32
echo   5. Watch for connection messages
echo.
echo Common Issues:
echo   - Wrong WiFi credentials in code
echo   - ESP32 not connected to 2.4GHz network
echo   - Firewall blocking MQTT port 1883
echo   - ESP32 stuck in boot loop (check Serial Monitor)
echo.
pause
