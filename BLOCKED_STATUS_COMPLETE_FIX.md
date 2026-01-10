# BLOCKED STATUS FIX - Step by Step Guide

## Problem
The Feeding Dashboard shows **"Blocked"** status even though MQTT device is connected successfully.

## Root Cause
The "Blocked" status appears when:
1. **Device doesn't exist in database** OR
2. **Device status is not "online"** in the database

The device status is set to "online" only when:
- ESP32 is powered on
- ESP32 code is uploaded and running
- ESP32 is connected to WiFi
- ESP32 is publishing MQTT status messages every 5 seconds
- Backend receives these messages and updates the database

## Solution Options

### 🎯 Option 1: Quick Fix (Temporary - 10 seconds)

This will manually set the device to "online" in the database:

```bash
# Windows
fix-blocked-status.bat

# Or manually via MySQL
mysql -h 82.197.82.97 -u u626686198_fishfeedu -p u626686198_fishfeed < fix-device-status.sql
```

**Note:** Status will revert to "Blocked" after 10 seconds if ESP32 is not running.

### ✅ Option 2: Permanent Fix (Recommended)

Upload and run the ESP32 code:

#### Step 1: Open Arduino IDE
- Launch Arduino IDE on your computer

#### Step 2: Configure ESP32
- **Board:** Tools → Board → ESP32 Dev Module
- **Port:** Tools → Port → (select your ESP32 COM port)
- **Upload Speed:** 115200

#### Step 3: Open ESP32 Code
- File → Open → `Kushanesp32feedcode/Kushanesp32feedcode.ino`

#### Step 4: Verify WiFi and MQTT Settings
Check these lines in the code:
```cpp
const char* ssid = "your_wifi_name";
const char* password = "your_wifi_password";
const char* mqtt_server = "broker.hivemq.com";
const char* device_id = "feed_device_001";
```

#### Step 5: Upload Code
- Click **Upload** button (→)
- Wait for "Done uploading" message

#### Step 6: Monitor ESP32
- Tools → Serial Monitor (115200 baud)
- Look for these messages:

```
WiFi connected
IP address: 192.168.x.x
MQTT connection...connected
Subscribed to: koi/devices/feed_device_001/feeding/command
Published status: {"deviceId":"feed_device_001","status":"online",...}
```

#### Step 7: Verify Backend
Check backend terminal for:
```
✓ Device updated: feed_device_001 - Status: online - Hopper: 0g
```

#### Step 8: Check Frontend
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Look for:
```
Device status response: {success: true, data: {status: "online", ...}}
Device feed_device_001: status=online, isOnline=true, feedingActive=false
```

4. Refresh page (Ctrl + Shift + R)
5. Status should now show **"Ready"** ✅

## Troubleshooting

### Backend Not Running
```bash
cd backend
.\mvnw.cmd spring-boot:run
```
Expected port: 8081

### Frontend Not Running
```bash
cd frontend
npm run dev
```
Expected port: 5173

### Check Device Status via API
```powershell
Invoke-RestMethod -Uri "http://localhost:8081/api/sensors/device/feed_device_001" | ConvertTo-Json
```

Expected response:
```json
{
  "success": true,
  "data": {
    "deviceId": "feed_device_001",
    "status": "online",
    "hopperLevel": 0,
    "feedingActive": false
  }
}
```

### Device Not Found (404 Error)
The device doesn't exist in the database. Run:
```bash
fix-blocked-status.bat
```

### Device Shows "offline"
- ESP32 hasn't sent status message in 10 seconds
- Check ESP32 Serial Monitor
- Verify MQTT connection
- Check WiFi connection

### Browser Shows "Blocked" but API Shows "online"
- Clear browser cache (Ctrl + Shift + Delete)
- Hard refresh (Ctrl + Shift + R)
- Check browser console for errors (F12)

## How the System Works

### Status Flow
1. **ESP32** publishes status every 5 seconds:
   - Topic: `koi/devices/feed_device_001/feeding/status`
   - Payload: `{"deviceId":"feed_device_001","hopperLevel":0,...}`

2. **Backend** receives MQTT message:
   - Updates `sensor_devices` table
   - Sets `status = 'online'`
   - Sets `last_seen = NOW()`

3. **Scheduler** checks every 2 seconds:
   - If `last_seen` > 10 seconds ago → set `status = 'offline'`

4. **Frontend** polls every 5 seconds:
   - Calls `/api/sensors/device/feed_device_001`
   - If `status == 'online'` → shows "Ready"
   - If `status != 'online'` → shows "Blocked"

## Quick Reference

| Status | Meaning | Cause |
|--------|---------|-------|
| **Ready** | Device online, ready to feed | ESP32 sending status messages |
| **Feeding** | Active feeding in progress | Motor running, dispensing feed |
| **Blocked** | Device offline | No status messages for 10+ seconds |

## Files Modified
- ✅ `frontend/src/components/FeedingDashboard.tsx` - Added logging and tooltip
- ✅ `fix-blocked-status.bat` - Quick fix script
- ✅ `fix-device-status.sql` - Database fix query

## Next Steps
1. ✅ Apply frontend changes
2. ✅ Test with ESP32 powered off (should show "Blocked")
3. ✅ Upload ESP32 code
4. ✅ Test with ESP32 running (should show "Ready")
5. ✅ Test feeding functionality
