# Test WebSocket Connection to ESP32
# Run this to verify ESP32 WebSocket server is accessible

Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "ESP32 WebSocket Connection Test" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

$esp32IP = "192.168.8.100"
$wsPort = 81

# Test 1: Ping ESP32
Write-Host "[1] Testing Network Connection..." -ForegroundColor Yellow
$pingResult = Test-Connection -ComputerName $esp32IP -Count 2 -Quiet
if ($pingResult) {
    Write-Host "    ✓ ESP32 is reachable at $esp32IP" -ForegroundColor Green
} else {
    Write-Host "    ✗ ESP32 NOT reachable at $esp32IP" -ForegroundColor Red
    Write-Host "    → Check if ESP32 is powered on" -ForegroundColor Red
    Write-Host "    → Check if WiFi 'Dulshan Dialog 4G 643' is active" -ForegroundColor Red
    exit 1
}

# Test 2: Check if WebSocket port is open
Write-Host "[2] Testing WebSocket Port $wsPort..." -ForegroundColor Yellow
$tcpClient = New-Object System.Net.Sockets.TcpClient
try {
    $connect = $tcpClient.BeginConnect($esp32IP, $wsPort, $null, $null)
    $wait = $connect.AsyncWaitHandle.WaitOne(3000, $false)
    
    if ($wait -and $tcpClient.Connected) {
        Write-Host "    ✓ WebSocket port $wsPort is OPEN" -ForegroundColor Green
        $tcpClient.Close()
    } else {
        Write-Host "    ✗ WebSocket port $wsPort is CLOSED" -ForegroundColor Red
        Write-Host "    → ESP32 WebSocket server is NOT running" -ForegroundColor Red
        Write-Host "    → Upload the updated code to ESP32" -ForegroundColor Red
        $tcpClient.Close()
        exit 1
    }
}
catch {
    Write-Host "    ✗ Cannot connect to port $wsPort" -ForegroundColor Red
    $tcpClient.Close()
    exit 1
}

# Test 3: Try WebSocket handshake
Write-Host "[3] Testing WebSocket Handshake..." -ForegroundColor Yellow
try {
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = New-Object System.Threading.CancellationToken
    $uri = [System.Uri]::new("ws://${esp32IP}:${wsPort}")
    
    $connectTask = $ws.ConnectAsync($uri, $ct)
    $timeout = [System.TimeSpan]::FromSeconds(5)
    
    if ($connectTask.Wait($timeout)) {
        if ($ws.State -eq 'Open') {
            Write-Host "    ✓ WebSocket connection SUCCESSFUL!" -ForegroundColor Green
            Write-Host "    ✓ Hybrid mode is READY!" -ForegroundColor Green
            $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Test", $ct).Wait(1000) | Out-Null
        } else {
            Write-Host "    ✗ WebSocket state: $($ws.State)" -ForegroundColor Red
        }
    } else {
        Write-Host "    ✗ WebSocket connection TIMEOUT" -ForegroundColor Red
        Write-Host "    → Check ESP32 Serial Monitor output" -ForegroundColor Red
    }
    $ws.Dispose()
} catch {
    Write-Host "    ⚠️ WebSocket test failed: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "    → This may be normal if using older PowerShell" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "ESP32 IP: $esp32IP" -ForegroundColor White
Write-Host "WebSocket URL: ws://${esp32IP}:${wsPort}" -ForegroundColor White
Write-Host ""
Write-Host "If port 81 is CLOSED:" -ForegroundColor Yellow
Write-Host "  1. Open ESP32 Serial Monitor (115200 baud)" -ForegroundColor White
Write-Host "  2. Look for: WebSocket server started on port 81" -ForegroundColor White
Write-Host "  3. If NOT found, re-upload Kushanesp32.ino" -ForegroundColor White
Write-Host ""
Write-Host "If port 81 is OPEN but frontend still disconnects:" -ForegroundColor Yellow
Write-Host "  1. Restart frontend: cd frontend && npm run dev" -ForegroundColor White
Write-Host "  2. Open browser DevTools (F12) and check Console" -ForegroundColor White
Write-Host "  3. Look for WebSocket connected messages" -ForegroundColor White
Write-Host ""
