@echo off
echo.
echo ============================================
echo Device Status Fix - Set Device to Online
echo ============================================
echo.
echo This script will fix the "Blocked" status issue by:
echo 1. Ensuring the device exists in the database
echo 2. Setting the status to 'online'
echo.
echo IMPORTANT: This is a temporary fix!
echo.
echo FOR PERMANENT FIX:
echo - Make sure ESP32 is powered on
echo - Upload the feeding code to ESP32
echo - ESP32 will automatically maintain 'online' status
echo.
pause

echo.
echo [1] Connecting to database...
mysql -h 82.197.82.97 -u u626686198_fishfeedu -p"FrevCf&1:2" u626686198_fishfeed < fix-device-status.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo SUCCESS! Device status updated to ONLINE
    echo ============================================
    echo.
    echo Next steps:
    echo 1. Refresh your browser (Ctrl + Shift + R)
    echo 2. Status should now show "Ready" instead of "Blocked"
    echo.
    echo NOTE: Status will change back to "Blocked" after 10 seconds
    echo       if ESP32 is not sending MQTT messages.
    echo.
    echo TO KEEP STATUS ONLINE:
    echo - Power on ESP32
    echo - Upload Kushanesp32feedcode.ino
    echo - ESP32 will publish status every 5 seconds
    echo.
) else (
    echo.
    echo ============================================
    echo ERROR: Failed to update device status
    echo ============================================
    echo.
    echo Possible reasons:
    echo 1. Database connection failed
    echo 2. Wrong credentials
    echo 3. Network issue
    echo.
    echo Please check:
    echo - Internet connection
    echo - Database credentials in script
    echo.
)

pause
