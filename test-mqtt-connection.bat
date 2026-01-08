@echo off
echo ========================================
echo ESP32 Boat MQTT Diagnostics
echo ========================================
echo.
echo Checking if MQTT messages are being published...
echo.
echo This will subscribe to all boat topics for 10 seconds
echo You should see messages if ESP32 is connected
echo.
echo Expected messages:
echo   - koifish/boat/status (heartbeat every 1s)
echo   - koifish/boat/sensor (sensor data every 500ms)
echo.
pause
echo.
echo Listening... (Press Ctrl+C to stop)
echo.

REM Try using mosquitto_sub if available
where mosquitto_sub >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    mosquitto_sub -h broker.hivemq.com -t "koifish/boat/#" -v
) else (
    echo mosquitto_sub not found!
    echo.
    echo Install with: choco install mosquitto
    echo Or download from: https://mosquitto.org/download/
    echo.
    echo Alternative: Use MQTT Explorer
    echo Download: http://mqtt-explorer.com/
    echo.
    pause
)
