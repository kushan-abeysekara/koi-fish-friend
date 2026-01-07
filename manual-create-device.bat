@echo off
echo.
echo ============================================
echo Quick Fix: Manually Create Feed Device
echo ============================================
echo.
echo This will create feed_device_001 in the database
echo so the frontend can display it (even as offline)
echo.
echo To connect with MySQL, run this command:
echo.
echo mysql -h 82.197.82.97 -u root -p koifish
echo.
echo Then paste this SQL:
echo.
echo INSERT INTO sensor_devices 
echo (device_id, device_type, status, hopper_capacity, hopper_level, hopper_percentage, 
echo  plate_speed, motor_status, feeding_active, created_at, last_seen)
echo VALUES 
echo ('feed_device_001', 'FEEDING_MANAGEMENT', 'offline', 20000, 0, 0, 
echo  0, 'STOPPED', FALSE, NOW(), NOW())
echo ON DUPLICATE KEY UPDATE 
echo   device_type = 'FEEDING_MANAGEMENT',
echo   hopper_capacity = 20000,
echo   last_seen = NOW();
echo.
echo SELECT * FROM sensor_devices WHERE device_id='feed_device_001';
echo.
echo.
echo After running this, refresh your browser with Ctrl+Shift+R
echo The device will show as "Blocked" (offline) until ESP32 connects
echo.
pause
