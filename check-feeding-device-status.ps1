# Quick Status Check for Feeding Device
# Run this to see if device is online or offline

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "   Feeding Device Status Check" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

# Check backend
Write-Host "[1] Checking Backend..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8081/api/sensors/device/feed_device_001" -TimeoutSec 3
    
    if ($response.success -and $response.data) {
        $device = $response.data
        
        Write-Host "✓ Backend: RUNNING" -ForegroundColor Green
        Write-Host "`n[2] Device Information:" -ForegroundColor Yellow
        Write-Host "   Device ID: $($device.deviceId)"
        
        # Status
        if ($device.status -eq "online") {
            Write-Host "   Status: ONLINE ✓" -ForegroundColor Green
            Write-Host "`n   Frontend will show: READY" -ForegroundColor Green
        } else {
            Write-Host "   Status: OFFLINE ✗" -ForegroundColor Red
            Write-Host "`n   Frontend will show: BLOCKED" -ForegroundColor Red
        }
        
        Write-Host "   Hopper Level: $($device.hopperLevel) g"
        Write-Host "   Feeding Active: $($device.feedingActive)"
        Write-Host "   Last Seen: $($device.lastSeen)"
        
        # Recommendations
        Write-Host "`n[3] Recommendations:" -ForegroundColor Yellow
        if ($device.status -eq "online") {
            Write-Host "   • Everything looks good!" -ForegroundColor Green
            Write-Host "   • If browser shows 'Blocked', refresh with Ctrl+Shift+R" -ForegroundColor Cyan
        } else {
            Write-Host "   • Quick Fix: Run fix-blocked-status.bat" -ForegroundColor Cyan
            Write-Host "   • Permanent Fix: Upload ESP32 code" -ForegroundColor Cyan
            Write-Host "   • Guide: See BLOCKED_STATUS_COMPLETE_FIX.md" -ForegroundColor Cyan
        }
        
    } else {
        Write-Host "✗ Device NOT FOUND in database" -ForegroundColor Red
        Write-Host "`n[2] Solution:" -ForegroundColor Yellow
        Write-Host "   • Run: fix-blocked-status.bat" -ForegroundColor Cyan
        Write-Host "   • Or upload ESP32 code" -ForegroundColor Cyan
    }
    
} catch {
    Write-Host "✗ Backend NOT RUNNING" -ForegroundColor Red
    Write-Host "`nError: $($_.Exception.Message)" -ForegroundColor DarkGray
    Write-Host "`n[2] Solution:" -ForegroundColor Yellow
    Write-Host "   • Start backend:" -ForegroundColor Cyan
    Write-Host "     cd backend" -ForegroundColor White
    Write-Host "     .\mvnw.cmd spring-boot:run" -ForegroundColor White
}

# Check frontend
Write-Host "`n[4] Frontend Status:" -ForegroundColor Yellow
if (Test-NetConnection -ComputerName localhost -Port 5173 -InformationLevel Quiet -WarningAction SilentlyContinue) {
    Write-Host "   ✓ Frontend RUNNING: http://localhost:5173" -ForegroundColor Green
} else {
    Write-Host "   ✗ Frontend NOT RUNNING" -ForegroundColor Red
    Write-Host "   • Start with: cd frontend; npm run dev" -ForegroundColor Cyan
}

Write-Host "`n================================================`n" -ForegroundColor Cyan
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
