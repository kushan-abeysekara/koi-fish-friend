@echo off
echo ========================================
echo Assigning Water Quality Device to Pond
echo ========================================
echo.
echo Device ID: WQ_000
echo Pond ID: 3 (sggs pond)
echo.

echo Sending MQTT command via backend API...
echo.

curl -X POST http://localhost:8080/api/mqtt/publish ^
  -H "Content-Type: application/json" ^
  -d "{\"topic\":\"koi/sensors/WQ_000/command\",\"message\":\"{\\\"command\\\":\\\"assign\\\",\\\"pondId\\\":3}\"}"

echo.
echo.
echo ========================================
echo Device should now be assigned to pond 3
echo Check Serial Monitor for confirmation
echo ========================================
pause
