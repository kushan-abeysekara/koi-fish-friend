@echo off
echo ========================================
echo Water Quality Device Status Checker
echo ========================================
echo.

echo [1/5] Checking if Backend is running...
tasklist /FI "IMAGENAME eq java.exe" 2>NUL | find /I /N "java.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo     ✓ Backend is running
) else (
    echo     ✗ Backend NOT running - start with: cd backend ^&^& mvnw.cmd spring-boot:run
    goto :end
)
echo.

echo [2/5] Checking if Frontend is running...
netstat -ano | findstr ":5173" >NUL
if "%ERRORLEVEL%"=="0" (
    echo     ✓ Frontend is running on port 5173
) else (
    echo     ✗ Frontend NOT running - start with: cd frontend ^&^& npm run dev
)
echo.

echo [3/5] Testing connection to MQTT broker (EMQX)...
powershell -Command "try { $result = Test-NetConnection -ComputerName 187.77.189.5 -Port 1883 -InformationLevel Quiet -WarningAction SilentlyContinue; if ($result) { Write-Host '    ✓ MQTT broker reachable (EMQX @ 187.77.189.5:1883)' } else { Write-Host '    ✗ Cannot reach MQTT broker' } } catch { Write-Host '    ✗ Error testing MQTT broker connection' }"
echo.

echo [4/5] Pinging ESP32 Water Quality Device...
ping -n 1 -w 1000 192.168.8.102 >NUL
if "%ERRORLEVEL%"=="0" (
    echo     ✓ ESP32 is online at 192.168.8.102
) else (
    echo     ✗ ESP32 NOT responding at 192.168.8.102
    echo       - Check if device is powered on
    echo       - Verify WiFi connection
    echo       - Check Serial Monitor for IP address
)
echo.

echo [5/5] Testing WebSocket connection...
powershell -Command "$ws = New-Object System.Net.WebSockets.ClientWebSocket; $cts = New-Object System.Threading.CancellationTokenSource; $cts.CancelAfter(3000); try { $task = $ws.ConnectAsync('ws://192.168.8.102:81', $cts.Token); $task.Wait(); if ($ws.State -eq 'Open') { Write-Host '    ✓ WebSocket server is running on port 81'; $ws.CloseAsync(1000, 'Test', $cts.Token).Wait() } else { Write-Host '    ✗ WebSocket connection failed' } } catch { Write-Host '    ✗ Cannot connect to WebSocket (ws://192.168.8.102:81)' } finally { $ws.Dispose(); $cts.Dispose() }"
echo.

echo ========================================
echo Status Check Complete
echo ========================================
echo.
echo Next Steps:
echo 1. Open Serial Monitor at 115200 baud
echo 2. Check for "MQTT: ✓" and "WS: X clients"
echo 3. Open browser console (F12) 
echo 4. Navigate to Water Quality Dashboard
echo 5. Look for stable WebSocket connection
echo.
echo For detailed troubleshooting, see:
echo WATER_QUALITY_CONNECTION_FIX.md
echo.

:end
pause
