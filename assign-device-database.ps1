$deviceId = "WQ_000"
$pondId = 3

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Assigning Water Quality Device to Pond" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Device ID: $deviceId" -ForegroundColor Yellow
Write-Host "Pond ID: $pondId" -ForegroundColor Yellow
Write-Host ""

# Database connection details (update these if needed)
$server = "localhost"
$database = "koi_farm_db"
$username = "root"
$password = "Chuki000"

# SQL Update query
$query = "UPDATE sensor_device SET pond_id = $pondId, status = 'online' WHERE device_id = '$deviceId' AND device_type = 'WATER_QUALITY';"

try {
    # Using MySQL command line
    $mysqlCmd = "mysql -h $server -u $username -p$password $database -e `"$query`""
    
    Write-Host "Executing SQL update..." -ForegroundColor Green
    Invoke-Expression $mysqlCmd
    
    Write-Host ""
    Write-Host "✅ Device assigned successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Check Serial Monitor - you should see:" -ForegroundColor White
    Write-Host "   🏊 Pond: 3 | pH: X.XX | Turbidity: X.XX NTU | DO: X.XX mg/L" -ForegroundColor Gray
    Write-Host "2. Device should now publish data via MQTT + WebSocket" -ForegroundColor White
    Write-Host "3. Dashboard should show LIVE data within seconds" -ForegroundColor White
    Write-Host ""
}
catch {
    Write-Host "❌ Error updating database: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual SQL command:" -ForegroundColor Yellow
    Write-Host $query -ForegroundColor Gray
}

Write-Host "========================================" -ForegroundColor Cyan
pause
