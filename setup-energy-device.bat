@echo off
REM ============================================
REM Energy Monitor ESP32 - Device Setup Helper
REM ============================================

echo.
echo ================================================
echo   Energy Monitor ESP32 - Setup Helper
echo ================================================
echo.

REM Check if backend is running
echo [1] Checking Backend Status...
powershell -Command "if ((Test-NetConnection -ComputerName localhost -Port 8080 -InformationLevel Quiet)) { Write-Host 'Backend: RUNNING on port 8080' -ForegroundColor Green } else { Write-Host 'Backend: NOT RUNNING - Please start backend first!' -ForegroundColor Red; exit 1 }"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Backend is not running!
    echo.
    echo Please start the backend first:
    echo   cd backend
    echo   mvnw spring-boot:run
    echo.
    pause
    exit /b 1
)

echo.
echo [2] List All Sensor Devices...
curl -s http://localhost:8080/api/sensors | python -m json.tool
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Could not fetch devices. Check if backend is running.
)

echo.
echo.
echo ================================================
echo   Device Assignment Instructions
echo ================================================
echo.
echo To assign your energy monitoring device to a pond:
echo.
echo 1. Find your device ID from the list above
echo    - Should start with "BM_" (e.g., BM_A1B2C3)
echo    - Or check the ESP32 LCD display
echo.
echo 2. Run this command (replace BM_XXXXXX with your device ID):
echo.
echo    curl -X POST http://localhost:8080/api/sensors/BM_XXXXXX/assign -H "Content-Type: application/json" -d "{\"pondId\": 1}"
echo.
echo 3. Verify assignment:
echo    - Check ESP32 LCD - should show "Pond: 1"
echo    - Check Energy Monitor page in frontend
echo.
echo ================================================
echo.

set /p deviceId="Enter your device ID (or press Enter to skip): "
if "%deviceId%"=="" goto :end

echo.
set /p pondId="Enter pond ID to assign (default is 1): "
if "%pondId%"=="" set pondId=1

echo.
echo Assigning device %deviceId% to pond %pondId%...
curl -X POST "http://localhost:8080/api/sensors/%deviceId%/assign" ^
  -H "Content-Type: application/json" ^
  -d "{\"pondId\": %pondId%}"

echo.
echo.
echo Verifying assignment...
timeout /t 2 /nobreak > nul
curl -s "http://localhost:8080/api/sensors/%deviceId%" | python -m json.tool

:end
echo.
echo ================================================
echo   Setup complete!
echo ================================================
echo.
echo Next steps:
echo 1. Check ESP32 LCD display - should show assigned pond
echo 2. Open Energy Monitor page in frontend
echo 3. Select your pond from dropdown
echo 4. You should see real-time voltage/current/power data
echo.
pause
