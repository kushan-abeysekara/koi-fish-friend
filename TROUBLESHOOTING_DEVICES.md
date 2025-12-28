# Device Not Showing - Troubleshooting Guide

## Issue Fixed ✅
I've updated both the backend and ESP32 code to properly handle device types.

## Changes Made:

### 1. Backend (`MqttService.java`)
- Added `deviceType` field handling in status messages
- Now accepts both `"type"` and `"deviceType"` fields for compatibility
- Properly sets the device type enum (WATER_QUALITY, BUDGET_MANAGEMENT, etc.)

### 2. ESP32 (`water_quality.ino`)
- Changed `"type"` to `"deviceType"` in status messages
- Added missing `"ipAddress"` field
- Added missing `"rssi"` field  
- Added `"energyWh"` field (set to 0 for water quality sensors)

## Steps to Get Devices Showing:

### Step 1: Kill the Process on Port 8080
Since the backend failed to start because port 8080 is already in use, run this in PowerShell:

```powershell
# Find the process using port 8080
netstat -ano | findstr :8080

# Kill the process (replace PID with the actual number)
taskkill /PID <PID> /F
```

Or use this one-liner to kill it automatically:
```powershell
$process = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess; if($process) { Stop-Process -Id $process -Force }
```

### Step 2: Start the Backend
```bash
cd backend
mvn spring-boot:run
```

Wait for the message: `Started BackendApplication`

### Step 3: Upload Updated ESP32 Code
1. Open Arduino IDE
2. Load `water_quality.ino`
3. Verify WiFi credentials are correct:
   - SSID: `kavish99`
   - Password: `kavish99`
4. Select your ESP32 board and COM port
5. Click Upload

### Step 4: Monitor ESP32 Serial Output
Open Serial Monitor (115200 baud) and you should see:
```
✓ WiFi connected
IP: 192.168.x.x
MQTT connected
Status published
```

### Step 5: Check Backend Logs
In the backend terminal, you should see:
```
Received MQTT message on topic: koi/sensors/WQ_XXXXXX/status
Device status updated: WQ_XXXXXX
```

### Step 6: Start Frontend
```bash
cd frontend
npm run dev
```

### Step 7: View Device in Browser
1. Navigate to `http://localhost:5173`
2. Login with your credentials
3. Go to "Device Management"
4. Your ESP32 should appear under "Unassigned Devices" as "Water Quality Monitor"

## Common Issues:

### Device Not Appearing
- **Check WiFi**: Ensure ESP32 is connected to `kavish99` WiFi
- **Check MQTT Broker**: HiveMQ public broker must be accessible
- **Check Backend**: Ensure backend is running and connected to MQTT
- **Check Serial Monitor**: Look for error messages

### Device Shows Offline
- **15 Second Timeout**: Device goes offline if no status message for 15 seconds
- **WiFi Signal**: Check RSSI value (should be > -70 dBm)
- **MQTT Connection**: Device should reconnect automatically

### Wrong Device Type
- **Re-upload Code**: Ensure the updated code with `deviceType` field is uploaded
- **Database**: May need to delete old device entries if they have wrong type

## Testing MQTT Messages

You can test MQTT messages using MQTT Explorer or mosquitto_pub:

**Test Status Message:**
```bash
mosquitto_pub -h broker.hivemq.com -t "koi/sensors/TEST_123/status" -m '{"deviceId":"TEST_123","deviceType":"WATER_QUALITY","status":"online","ipAddress":"192.168.1.100","rssi":-45,"energyWh":0,"pondId":0}'
```

## Required Libraries for ESP32:
1. **WiFi** (Built-in)
2. **PubSubClient** (Install via Arduino Library Manager)
3. **ArduinoJson** (Install via Arduino Library Manager)

## Backend Dependencies Check:
Ensure `pom.xml` has:
- spring-boot-starter-integration
- spring-integration-mqtt
- spring-boot-starter-data-jpa

## Database Check:
The device will be saved to the `sensor_devices` table with columns:
- `id`, `device_id`, `device_type`, `status`, `ip_address`, `rssi`, `energy_wh`, `last_seen`, `pond_id`
