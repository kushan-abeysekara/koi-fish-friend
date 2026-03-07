# ESP32 Boat MQTT Diagnostics
# PowerShell script to test MQTT connection

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ESP32 Boat MQTT Diagnostics" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check MQTT broker connectivity
Write-Host "1. Testing MQTT Broker Connection..." -ForegroundColor Yellow
$brokerTest = Test-NetConnection -ComputerName 187.77.189.5 -Port 1883 -WarningAction SilentlyContinue

if ($brokerTest.TcpTestSucceeded) {
    Write-Host "   ✓ MQTT Broker (EMQX @ 187.77.189.5:1883) is REACHABLE" -ForegroundColor Green
} else {
    Write-Host "   ✗ MQTT Broker is NOT REACHABLE" -ForegroundColor Red
    Write-Host "   Check your internet connection" -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "2. Frontend MQTT Test..." -ForegroundColor Yellow
Write-Host "   Open browser console (F12) on http://localhost:5173/dashboard/boat-navigation" -ForegroundColor White
Write-Host "   Look for: '✓ Connected to MQTT broker'" -ForegroundColor White
Write-Host ""

Write-Host "3. ESP32 Serial Monitor Check..." -ForegroundColor Yellow
Write-Host "   Open Arduino IDE - Tools - Serial Monitor - 115200 baud" -ForegroundColor White
Write-Host "   Expected output:" -ForegroundColor White
Write-Host "     WiFi Connected!" -ForegroundColor Green
Write-Host "     MQTT Connected!" -ForegroundColor Green
Write-Host "     Heartbeat sent" -ForegroundColor Green
Write-Host ""

Write-Host "4. Check if mosquitto_sub is available..." -ForegroundColor Yellow
$mosquittoPath = Get-Command mosquitto_sub -ErrorAction SilentlyContinue

if ($mosquittoPath) {
    Write-Host "   ✓ mosquitto_sub found at: $($mosquittoPath.Source)" -ForegroundColor Green
    Write-Host ""
    Write-Host "5. Starting MQTT listener for boat topics..." -ForegroundColor Yellow
    Write-Host "   Listening to: koifish/boat/#" -ForegroundColor White
    Write-Host "   Expected messages:" -ForegroundColor White
    Write-Host "     - koifish/boat/status (every 1s)" -ForegroundColor Gray
    Write-Host "     - koifish/boat/sensor (every 500ms)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Press Ctrl+C to stop" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   If you see NO messages, ESP32 is NOT connected to MQTT!" -ForegroundColor Red
    Write-Host "   If you see messages, ESP32 IS connected!" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    & mosquitto_sub -h 187.77.189.5 -t "koifish/boat/#" -v
} else {
    Write-Host "   ✗ mosquitto_sub not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "   To listen to MQTT messages, install mosquitto:" -ForegroundColor Yellow
    Write-Host "   1. Using Chocolatey:" -ForegroundColor White
    Write-Host "      choco install mosquitto" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   2. Or download MQTT Explorer (GUI):" -ForegroundColor White
    Write-Host "      http://mqtt-explorer.com/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   3. Or use online MQTT client:" -ForegroundColor White
    Write-Host "      http://mqtt-explorer.com/ (or any MQTT client)" -ForegroundColor Cyan
    Write-Host "      Host: 187.77.189.5" -ForegroundColor Gray
    Write-Host "      Port: 1883 (TCP) or 8083 (WebSocket)" -ForegroundColor Gray
    Write-Host "      Subscribe to: koifish/boat/#" -ForegroundColor Gray
    Write-Host ""
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Quick Fixes if Disconnected:" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. Restart ESP32 (unplug and replug power)" -ForegroundColor White
Write-Host "2. Re-upload Arduino code" -ForegroundColor White
Write-Host "3. Check Serial Monitor for error messages" -ForegroundColor White
Write-Host "4. Verify WiFi credentials in code" -ForegroundColor White
Write-Host "5. Hard refresh browser (Ctrl+Shift+R)" -ForegroundColor White
Write-Host ""
