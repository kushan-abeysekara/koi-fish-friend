# SOLUTION: Device Showing "Blocked"

## Problem
Device `feed_device_001` does NOT exist in the database yet. The backend returns 404 (Not Found), which causes the frontend to show "Blocked" status.

## Root Cause
The ESP32 is either:
1. Not powered on
2. Not running the code
3. Not connected to WiFi
4. Not connected to MQTT broker
5. Not publishing status messages

The backend only creates the device in the database when it receives the FIRST MQTT status message from the ESP32.

## SOLUTION - Choose One:

### Option 1: Upload and Run ESP32 Code (RECOMMENDED)

1. **Open Arduino IDE**
2. **Select ESP32 Board**: Tools → Board → ESP32 Dev Module
3. **Select COM Port**: Tools → Port → (your ESP32 port)
4. **Open File**: `Kushanesp32feedcode/Kushanesp32feedcode.ino`
5. **Upload Code**: Click Upload button
6. **Open Serial Monitor**: Tools → Serial Monitor (115200 baud)

**Watch for these messages:**
```
WiFi connected
IP address: 192.168.x.x
MQTT connection...connected
Subscribed to: koi/devices/feed_device_001/feeding/command
Published status: {"deviceId":"feed_device_001",...}
```

**Within 5 seconds**, the backend will:
- Receive the MQTT message
- Create the device in database
- Set status to "online"
- Frontend will show "Ready" status

---

### Option 2: Manually Create Device in Database (TEMPORARY FIX)

If ESP32 is not available right now, you can manually create the device:

```sql
-- Connect to database
mysql -h 82.197.82.97 -u root -p koifish

-- Create the device manually
INSERT INTO sensor_devices 
(device_id, device_type, status, hopper_capacity, hopper_level, hopper_percentage, 
 plate_speed, motor_status, feeding_active, created_at, last_seen)
VALUES 
('feed_device_001', 'FEEDING_MANAGEMENT', 'offline', 20000, 0, 0, 
 0, 'STOPPED', FALSE, NOW(), NOW());

-- Verify
SELECT device_id, status, last_seen FROM sensor_devices WHERE device_id='feed_device_001';
```

**Then refresh the frontend:**
- Press Ctrl+Shift+R to hard refresh
- Status will change from "Blocked" to "Ready" (if you set status='online') or show real offline status

---

## Quick Verification Steps

### 1. Check Backend Logs
Look for:
- ✅ `MQTT connection...connected` (backend connected to broker)
- ✅ `Feeding device status updated: feed_device_001 - Status: online` (receiving ESP32 messages)
- ❌ No messages = ESP32 not publishing

### 2. Check Device in Database
```sql
SELECT device_id, status, device_type, last_seen 
FROM sensor_devices 
WHERE device_id='feed_device_001';
```

**If no rows returned**: Device doesn't exist (ESP32 never connected)
**If status='offline'**: Device was online before but hasn't sent messages recently
**If status='online'**: Device is working! Frontend issue or needs refresh

### 3. Check Frontend Console
Press F12 in browser, check Console tab for errors:
- ✅ `GET http://localhost:8080/api/sensor-devices/feed_device_001` → 200 OK (device found)
- ❌ `GET http://localhost:8080/api/sensor-devices/feed_device_001` → 404 Not Found (device doesn't exist)

---

## Expected Flow

1. **ESP32 Powers On**
   ```
   → Connects to WiFi
   → Connects to MQTT broker
   → Publishes status message every few seconds
   ```

2. **Backend Receives MQTT**
   ```
   → handleStatusUpdate() called
   → Creates device if doesn't exist
   → Sets status="online"
   → Saves to database
   → Logs: "Feeding device status updated..."
   ```

3. **Frontend Fetches Status**
   ```
   → GET /api/sensor-devices/feed_device_001
   → Receives device with status="online"
   → Shows "Ready" (green badge)
   → Enables Start/Stop buttons
   ```

---

## Troubleshooting

### Issue: ESP32 Code Won't Upload
- Check COM port selection
- Install CP2102 or CH340 USB driver
- Press BOOT button during upload if needed

### Issue: ESP32 Won't Connect to WiFi
Check `Kushanesp32feedcode.ino` line 26-27:
```cpp
const char* ssid = "Dulshan Dialog 4G 643";
const char* password = "Chuki000";
```
- Verify WiFi name is correct
- Verify password is correct
- Ensure 2.4GHz network (ESP32 doesn't support 5GHz)

### Issue: ESP32 Connects to WiFi But Not MQTT
Serial Monitor shows:
```
WiFi connected
Attempting MQTT connection...failed, rc=-2
```
- Check internet connection
- Try different MQTT broker (broker.hivemq.com is public and free)
- Firewall might be blocking MQTT port 1883

### Issue: Backend Not Receiving MQTT Messages
- Check backend logs: should see "MQTT InboundChannel connected"
- Restart backend if needed
- Check MQTT broker connectivity

### Issue: Frontend Still Shows "Blocked" After ESP32 Online
1. Hard refresh: Ctrl+Shift+R
2. Clear browser cache
3. Check API endpoint manually:
   ```
   http://localhost:8080/api/sensor-devices/feed_device_001
   ```
4. Verify response shows `"status": "online"`

---

## Quick Test Commands

**Check backend:**
```powershell
Test-NetConnection localhost -Port 8080
```

**Check device API:**
```powershell
Invoke-RestMethod "http://localhost:8080/api/sensor-devices/feed_device_001"
```

**Check all devices:**
```powershell
Invoke-RestMethod "http://localhost:8080/api/sensor-devices"
```

**Force device online (testing only):**
```sql
UPDATE sensor_devices 
SET status='online', last_seen=NOW() 
WHERE device_id='feed_device_001';
```

---

## Current Status

✅ Backend is RUNNING (port 8080 responding)
❌ Device does NOT exist in database (404 error)
❌ ESP32 has never connected and published status

**ACTION REQUIRED**: Upload and run ESP32 code to create the device!

---

## Files Reference

- ESP32 Code: `Kushanesp32feedcode/Kushanesp32feedcode.ino`
- Backend Service: `backend/src/main/java/com/example/backend/service/MqttService.java`
- Database Setup: `database/create_feed_device.sql`
- Troubleshooting: `DEVICE_STATUS_FIX.md`
