# Water Quality Connection Fix

## Issues Fixed

### 1. MQTT Always Showing Offline
**Root Cause**: 
- `client.loop()` was called AFTER checking connection status, preventing keepalive packets from being processed
- Missing MQTT keepalive configuration
- Device might not be assigned to a pond (won't publish data)

**Fixes Applied**:
- ✅ Moved `client.loop()` BEFORE connection check in loop()
- ✅ Added `client.setKeepAlive(15)` - sends keepalive every 15 seconds
- ✅ Added better error logging in publishSensorData()
- ✅ Added check for successful MQTT publish

### 2. WebSocket Connecting/Disconnecting Repeatedly
**Root Cause**: 
- Frontend WebSocket useEffect had `[selectedPond, ponds]` dependencies
- Every time pond selection changed, WebSocket disconnected and reconnected
- No cleanup of stale connections

**Fixes Applied**:
- ✅ Changed WebSocket useEffect to empty deps `[]` - connects once on mount
- ✅ Used refs (`selectedPondRef`, `pondsRef`) to access latest values without re-rendering
- ✅ Added `isSubscribed` flag for proper cleanup
- ✅ Added WebSocket ping/pong handling in ESP32 for keepalive

## Updated Files

### ESP32 Code (`water_quality.ino`)
```cpp
// Line ~570: Added MQTT keepalive
client.setKeepAlive(15);  // Send MQTT keepalive every 15 seconds

// Line ~605: Reordered loop() to process keepalive first
client.loop();  // Process keepalive BEFORE checking connection

if (!client.connected()) {
    mqttConnected = false;
    reconnectMQTT();
} else {
    mqttConnected = true;
}

// Line ~325: Added ping/pong handling
case WStype_PING:
case WStype_PONG:
    // Handled automatically by WebSocketsServer

// Line ~237: Better error logging
if (assignedPondId == 0) {
    Serial.println("⚠️  Not publishing - device not assigned to pond");
    return;
}

bool published = client.publish(dataTopic.c_str(), json.c_str());
if (!published) {
    Serial.println("❌ MQTT publish failed!");
}
```

### Frontend (`WaterQualityDashboard.tsx`)
```tsx
// Line ~42: Added refs for stable WebSocket
const selectedPondRef = useRef<number | null>(null);
const pondsRef = useRef<Pond[]>([]);

// Keep refs updated
useEffect(() => {
    selectedPondRef.current = selectedPond;
    pondsRef.current = ponds;
}, [selectedPond, ponds]);

// Line ~52: Changed WebSocket to connect once
useEffect(() => {
    let isSubscribed = true;
    
    const connectWebSocket = () => {
        if (!isSubscribed) return;
        // ... connection logic using refs
    };
    
    connectWebSocket();
    
    return () => {
        isSubscribed = false;
        // cleanup only on unmount
    };
}, []); // Empty deps - never disconnect unless unmount
```

## Testing Steps

### 1. Upload ESP32 Code
```bash
# Open Arduino IDE
# Select: Tools > Board > ESP32 Dev Module
# Select: Tools > Port > (your COM port)
# Click Upload
```

### 2. Monitor Serial Output
Open Serial Monitor at **115200 baud** and look for:

✅ **Good Signs**:
```
✅ Static IP configured: 192.168.8.102
✅ WiFi Connected!
✅ MQTT Connected!
✅ WebSocket server started on port 81
📡 MQTT: ✅ | ⚡ WS: 1 clients | 📍 IP: 192.168.8.102
✓ Data Published (MQTT + WebSocket):
  MQTT: ✅ | WS Clients: 1
```

❌ **Problem Signs**:
```
❌ MQTT Failed, rc=-2         // Network error
❌ MQTT Failed, rc=-4         // Connection timeout
⚠️  Not publishing - device not assigned to pond  // Not assigned
❌ MQTT publish failed!       // Publish error
```

### 3. Check Device Assignment
```bash
# In your browser, navigate to:
http://localhost:5173/dashboard

# Go to "Sensor Care & Calibration" or admin panel
# Find device with ID starting with "WQ_"
# Make sure it's:
#   - Status: ONLINE
#   - Assigned to a pond (Pond ID should not be null)
```

### 4. Verify Backend MQTT Connection
```bash
# Check backend logs for:
grep "MQTT" backend-logs.txt

# Should see:
✅ Received MQTT message on topic: koi/sensors/WQ_XXX/status
✅ Received MQTT message on topic: koi/sensors/WQ_XXX/data
```

### 5. Test Frontend WebSocket
```bash
# Open browser console (F12)
# Navigate to Water Quality Dashboard
# Look for:

✅ 🔌 Connecting to Water Quality WebSocket: ws://192.168.8.102:81
✅ ✅ WebSocket connected to water quality device
✅ 📊 Real-time water quality data: {deviceId: "WQ_...", ...}

# Should NOT see repeated connect/disconnect cycles
```

## Troubleshooting

### MQTT Still Offline

**Check 1: WiFi Connection**
```cpp
// Serial Monitor should show:
✅ WiFi Connected!
📍 IP Address: 192.168.8.102
```

**Check 2: MQTT Broker Reachable**
```bash
# From Windows PowerShell:
Test-NetConnection broker.hivemq.com -Port 1883

# Should show:
TcpTestSucceeded : True
```

**Check 3: Device Assignment**
- Device MUST be assigned to a pond
- Check in database or admin panel
- If not assigned, use backend API or admin panel to assign

**Check 4: MQTT Publish Buffer**
```cpp
// In setup(), verify:
client.setBufferSize(512);  // At least 512 bytes
```

### WebSocket Keeps Disconnecting

**Check 1: ESP32 WebSocket Server Running**
```cpp
// Serial Monitor should show:
✅ WebSocket server started on port 81
[WS] ⚡ Client #0 connected from 192.168.8.X
```

**Check 2: Network Stability**
```bash
# Ping test from PC:
ping -t 192.168.8.102

# Should show consistent <10ms latency
```

**Check 3: Browser Console**
```javascript
// Should see stable connection:
✅ WebSocket connected
// NO repeated disconnections
```

**Check 4: Firewall/Antivirus**
- Temporarily disable firewall
- Check if Windows Defender is blocking WebSocket
- Add exception for port 81

### Device Not Publishing Data

**Check 1: Pond Assignment**
```cpp
// Serial Monitor:
⚠️  Not publishing - device not assigned to pond

// Solution: Assign device to pond via admin panel or API
```

**Check 2: Sensor Wiring**
```cpp
// Check sensor connections:
#define PH_PIN 32          // pH sensor
#define MQ135_PIN 33       // Ammonia sensor  
#define TURBIDITY_PIN 34   // Turbidity sensor

// Serial Monitor should show readings:
pH: 6.81 | Turbidity: 3000.0 NTU | NH3: 0.00 PPM
```

**Check 3: MQTT Connected**
```cpp
// Serial Monitor:
📡 MQTT: ✅  // Must be ✅ not ❌
```

## Expected Behavior After Fix

### ESP32 Serial Monitor
```
========================================
✅ Setup complete! Hybrid Mode Active
   MQTT + WebSocket for real-time data
========================================

📡 MQTT: ✅ | ⚡ WS: 1 clients | 📍 IP: 192.168.8.102 | Signal: -45 dBm
🏊 Pond: 3 | pH: 6.81 | Turbidity: 3000.0 NTU | NH3: 0.00 PPM | Status: critical

=====================================
✓ Data Published (MQTT + WebSocket):
  MQTT: ✅ | WS Clients: 1
  pH: 6.81 | Turbidity: 3000.0 NTU | NH3: 0.00 PPM
=====================================
```

### Frontend Dashboard
- **WebSocket Status**: Green "⚡ WebSocket Live" box
- **MQTT Status**: Blue "🌐 MQTT Active" box
- **Last Updated**: Shows "LIVE" badge with "2s ago"
- **Streaming Indicator**: Green pulsing "STREAMING" text
- **No repeated connection messages** in console

### Backend Logs
```
Received MQTT message on topic: koi/sensors/WQ_XXX/status
Payload: {"deviceId":"WQ_XXX","deviceType":"WATER_QUALITY","status":"online",...}

Received MQTT message on topic: koi/sensors/WQ_XXX/data  
Payload: {"deviceId":"WQ_XXX","pondId":3,"phValue":6.81,...}
Saved sensor data to database
```

## Network Diagram

```
┌─────────────────┐
│  ESP32 Water    │  Static IP: 192.168.8.102
│  Quality Device │  WebSocket Port: 81
└────────┬────────┘
         │
         ├──── WiFi: "Dulshan Dialog 4G 643"
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐  ┌─────────────┐
│ MQTT  │  │  WebSocket  │
│broker │  │   ws://     │
│hivemq │  │192.168.8.102│
└───┬───┘  └──────┬──────┘
    │             │
    │    ┌────────┴────────┐
    │    │                 │
    ▼    ▼                 ▼
┌────────────┐      ┌──────────┐
│  Backend   │      │ Frontend │
│ Spring Boot│      │  React   │
│ Port: 8080 │      │Port: 5173│
└────────────┘      └──────────┘
```

## Quick Command Reference

### Restart Backend
```powershell
cd d:\GITHUB\koi-fish-friend\backend
.\mvnw.cmd spring-boot:run
```

### Restart Frontend
```powershell
cd d:\GITHUB\koi-fish-friend\frontend
npm run dev
```

### Check Device Status
```powershell
# Using curl or Invoke-RestMethod
Invoke-RestMethod http://localhost:8080/api/sensor-devices | ConvertTo-Json
```

### Assign Device to Pond (Example)
```powershell
# Via MQTT (publish to command topic)
# Topic: koi/sensors/WQ_XXX/command
# Payload: {"command":"assign","pondId":3}
```

## Additional Notes

1. **Device ID Generation**: ESP32 generates ID from MAC address (e.g., `WQ_A1B2C3`)
2. **Data Publish Interval**: Every 2 seconds (configurable)
3. **Status Publish Interval**: Every 2 seconds (configurable)
4. **WebSocket Reconnect**: Auto-retry every 5 seconds on disconnect
5. **MQTT Reconnect**: Auto-retry every 5 seconds on disconnect
6. **Keep-alive**: MQTT 15 seconds, WebSocket native ping/pong

## Next Steps

1. ✅ Upload fixed ESP32 code
2. ✅ Refresh frontend (Ctrl+F5 to clear cache)
3. ✅ Check Serial Monitor for connection status
4. ✅ Verify device is assigned to pond
5. ✅ Monitor browser console for stable WebSocket
6. ✅ Confirm data appearing in dashboard

If issues persist after these fixes, provide Serial Monitor output for further diagnosis.
