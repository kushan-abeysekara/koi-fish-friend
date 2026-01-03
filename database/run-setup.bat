@echo off
echo ========================================
echo Setup Feeding Device in Database
echo ========================================
echo.
echo This will:
echo 1. Create sensor_devices table if needed
echo 2. Add feeding device columns if needed
echo 3. Insert feed_device_001
echo.
echo Press any key to continue or Ctrl+C to cancel...
pause > nul
echo.
echo Running SQL script...
echo.

mysql -h 82.197.82.97 -u root -pChuki000 koifish < setup_feed_device.sql

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo SUCCESS! Device created in database
    echo ========================================
    echo.
    echo Refresh your frontend dashboard to see changes.
    echo The device should now show as "offline" instead of "Blocked"
    echo.
) else (
    echo.
    echo ========================================
    echo ERROR! Setup failed
    echo ========================================
    echo.
    echo Possible reasons:
    echo 1. MySQL client not installed
    echo 2. Wrong database credentials
    echo 3. Network connection issue
    echo.
    echo Please check the error above or install MySQL:
    echo https://dev.mysql.com/downloads/mysql/
    echo.
)

echo.
echo Press any key to exit...
pause > nul
