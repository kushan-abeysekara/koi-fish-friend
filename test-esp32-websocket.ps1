# Simple ESP32 WebSocket Test
$esp32IP = "192.168.8.100"
$wsPort = 81

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "ESP32 WebSocket Connection Test" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Test 1: Ping
Write-Host "`n[1] Pinging ESP32..." -ForegroundColor Yellow
$ping = Test-Connection -ComputerName $esp32IP -Count 2 -Quiet
if ($ping) {
    Write-Host "    OK - ESP32 is reachable" -ForegroundColor Green
} else {
    Write-Host "    FAILED - ESP32 not reachable" -ForegroundColor Red
    Write-Host "    Check: WiFi connection" -ForegroundColor Red
    exit
}

# Test 2: Port Check
Write-Host "`n[2] Checking WebSocket port..." -ForegroundColor Yellow
$client = New-Object System.Net.Sockets.TcpClient
try {
    $result = $client.BeginConnect($esp32IP, $wsPort, $null, $null)
    $success = $result.AsyncWaitHandle.WaitOne(2000)
    if ($success -and $client.Connected) {
        Write-Host "    OK - Port $wsPort is OPEN" -ForegroundColor Green
        Write-Host "    WebSocket server is running!" -ForegroundColor Green
    } else {
        Write-Host "    FAILED - Port $wsPort is CLOSED" -ForegroundColor Red
        Write-Host "    WebSocket server NOT running on ESP32" -ForegroundColor Red
        Write-Host "    Action: Upload Kushanesp32.ino to ESP32" -ForegroundColor Yellow
    }
    $client.Close()
} catch {
    Write-Host "    FAILED - Cannot connect" -ForegroundColor Red
    $client.Close()
}

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "WebSocket URL: ws://${esp32IP}:${wsPort}" -ForegroundColor White
Write-Host "============================================`n" -ForegroundColor Cyan
