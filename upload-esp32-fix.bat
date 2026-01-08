@echo off
echo ========================================
echo ESP32 Energy Sensor - Upload Fix
echo ========================================
echo.
echo This will upload the updated firmware to your ESP32 energy monitoring device.
echo.
echo IMPORTANT: Make sure your ESP32 is connected via USB and Arduino IDE or PlatformIO is installed!
echo.
pause

echo.
echo Please complete these steps manually:
echo.
echo ARDUINO IDE METHOD:
echo 1. Open Arduino IDE
echo 2. Open file: ESP32 CODE\currnet_voltage\currnet_voltage.ino
echo 3. Select Tools ^> Board ^> ESP32 Dev Module
echo 4. Select Tools ^> Port ^> [Your COM Port]
echo 5. Click the Upload button (right arrow icon)
echo 6. Wait for "Done uploading" message
echo.
echo PLATFORMIO METHOD (if using VS Code):
echo 1. Open folder: ESP32 CODE\currnet_voltage
echo 2. Run: pio run --target upload
echo 3. Wait for upload to complete
echo.
echo ========================================
echo.
echo After uploading, you should see in Serial Monitor (115200 baud):
echo - "Sensor data published: ..." every 3 seconds
echo - Voltage, current, power, energyWh values
echo.
echo Then check your frontend at:
echo http://localhost:3000/dashboard/energy-monitor
echo.
echo Data should start updating every 20 seconds!
echo.
echo ========================================
pause
