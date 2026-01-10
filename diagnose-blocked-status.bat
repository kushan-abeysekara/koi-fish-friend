@echo off
echo.
echo ============================================
echo Feeding Device Status - Quick Diagnostics
echo ============================================
echo.

REM Check if backend is running
echo [1/5] Checking Backend Status...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8081/api/sensors/device/feed_device_001' -TimeoutSec 2 -UseBasicParsing; if ($response.StatusCode -eq 200) { Write-Host 'Backend: RUNNING' -ForegroundColor Green; $json = $response.Content | ConvertFrom-Json; Write-Host 'Device Status:' $json.data.status -ForegroundColor $(if($json.data.status -eq 'online'){'Green'}else{'Red'}); exit 0 } else { Write-Host 'Backend: ERROR' -ForegroundColor Red; exit 1 } } catch { Write-Host 'Backend: NOT RUNNING (Start with: cd backend; .\mvnw.cmd spring-boot:run)' -ForegroundColor Red; exit 1 }"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [2/5] Device Found! Checking Details...
    powershell -Command "$response = Invoke-RestMethod -Uri 'http://localhost:8081/api/sensors/device/feed_device_001'; $device = $response.data; Write-Host 'Device ID:' $device.deviceId; Write-Host 'Status:' $device.status -ForegroundColor $(if($device.status -eq 'online'){'Green'}else{'Red'}); Write-Host 'Hopper Level:' $device.hopperLevel 'g'; Write-Host 'Last Seen:' $device.lastSeen; Write-Host 'Feeding Active:' $device.feedingActive"
    
    echo.
    echo [3/5] Diagnosis:
    powershell -Command "$response = Invoke-RestMethod -Uri 'http://localhost:8081/api/sensors/device/feed_device_001'; if($response.data.status -eq 'online') { Write-Host 'Status: ONLINE - Frontend should show READY' -ForegroundColor Green; Write-Host 'Action: Refresh browser (Ctrl+Shift+R)' -ForegroundColor Yellow } else { Write-Host 'Status: OFFLINE - Frontend will show BLOCKED' -ForegroundColor Red; Write-Host 'Action: Upload ESP32 code or run fix-blocked-status.bat' -ForegroundColor Yellow }"
) else (
    echo.
    echo [2/5] Device NOT FOUND in database
    echo.
    echo [3/5] Diagnosis:
    echo Status: Device does not exist - Frontend will show BLOCKED
    echo.
    echo SOLUTION OPTIONS:
    echo.
    echo A. Quick Fix (Temporary):
    echo    Run: fix-blocked-status.bat
    echo    This will create the device and set status to online
    echo    Device will go offline again after 10 seconds if ESP32 is not running
    echo.
    echo B. Permanent Fix (Recommended):
    echo    1. Open Arduino IDE
    echo    2. Upload Kushanesp32feedcode/Kushanesp32feedcode.ino to ESP32
    echo    3. Open Serial Monitor (115200 baud)
    echo    4. Look for "MQTT connection...connected" and "Published status"
    echo    5. Backend will automatically create device and set online
    echo.
)

echo.
echo [4/5] Quick Fixes:
echo.
echo • Frontend showing Blocked but API shows Online?
echo   → Clear browser cache and refresh (Ctrl+Shift+R)
echo   → Check browser console (F12) for errors
echo.
echo • Need temporary fix?
echo   → Run: fix-blocked-status.bat
echo   → Device will be online for 10 seconds
echo.
echo • Need permanent fix?
echo   → Upload ESP32 code (see BLOCKED_STATUS_COMPLETE_FIX.md)
echo.

echo [5/5] Checking Frontend...
powershell -Command "if ((Test-NetConnection -ComputerName localhost -Port 5173 -InformationLevel Quiet)) { Write-Host 'Frontend: RUNNING on http://localhost:5173' -ForegroundColor Green } else { Write-Host 'Frontend: NOT RUNNING (Start with: cd frontend; npm run dev)' -ForegroundColor Red }"

echo.
echo ============================================
echo For detailed instructions, see:
echo BLOCKED_STATUS_COMPLETE_FIX.md
echo ============================================
echo.
pause
