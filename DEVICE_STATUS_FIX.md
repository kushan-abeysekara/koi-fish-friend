# Device Status Fix - Troubleshooting Guide

## Problem
- Feeding Dashboard shows status as "Blocked" when device is online
- Feeder Health & Safety shows all metrics as "Offline"
- Start/Stop buttons are disabled
- Backend not recognizing device as online

## Root Cause
The backend was receiving MQTT status messages but:
1. Not setting device status to "online"
2. Not creating the device in database if it doesn't exist
3. Not extracting feeding device fields from status messages

## Solution Applied

### Backend Changes (MqttService.java)

1. **handleStatusUpdate() - Now sets status to "online"**:
   - Automatically creates device if it doesn't exist
   - Sets device type to FEEDING_MANAGEMENT for feed_device_*
   - Extracts all feeding device fields (hopperLevel, plateSpeed, motorStatus, etc.)
   - Sets status to "online" when receiving status messages
   - Updates lastSeen timestamp

2. **handleSensorData() - Also sets status to "online"**:
   - Added `device.setStatus("online")` for feeding devices
   - Ensures status is updated regardless of which method processes the message

3. **Scheduled Task - Marks devices offline**:
   - Runs every 2 seconds
   - Marks device as offline if no message received in 15 seconds
   - Provides real-time offline detection

### Database Migration

Two SQL scripts created:
- `add_feeding_device_columns.sql` - Adds new columns for feeding device fields
- `create_feed_device.sql` - Manually creates feed_device_001 if needed

## Testing Steps

### 1. Run Database Migrations

```bash
# From project root
mysql -h 82.197.82.97 -u root -p koifish < database/add_feeding_device_columns.sql
mysql -h 82.197.82.97 -u root -p koifish < database/create_feed_device.sql
```

### 2. Restart Backend

```bash
cd d:\GITHUB\koi-fish-friend
.\restart-backend.bat
```

Or manually:
```bash
cd backend
mvn clean package -DskipTests
mvn spring-boot:run
```

### 3. Upload ESP32 Code (if not done yet)

Upload `Kushanesp32feedcode/Kushanesp32feedcode.ino` to your ESP32

### 4. Power On ESP32

Watch Serial Monitor (115200 baud):
```
WiFi connected
MQTT connection...connected
Time synchronized successfully!
HX711 #1 (Feed Output) Connected ✓
HX711 #2 (Tank A) Connected ✓
HX711 #3 (Tank B) Connected ✓
HX711 #4 (Tank C) Connected ✓
HX711 #5 (Tank D) Connected ✓
```

### 5. Watch Backend Logs

You should see:
```
Feeding device status updated: feed_device_001 - Status: online - Hopper: 15250g (76.3%) - Motor: STOPPED - Plate: 0 RPM
```

### 6. Check Frontend Dashboards

**Feeding Dashboard** (http://localhost:5173/dashboard/feeding-dashboard):
- Status should show "Ready" (green) or "Feeding" (blue)
- Hopper Feed Level should show actual kg (not 0 kg)
- Battery Level should show 87% (mock data)
- Start/Stop buttons should be enabled

**Feeder Health & Safety** (http://localhost:5173/dashboard/feeder-health-safety):
- All 6 metrics should show real data (not "Offline")
- Hopper Feed Level: Shows kg and percentage
- Connection: Shows "Online" (green)
- Plate Speed: Shows RPM
- Motor Status: Shows "STOPPED" or "RUNNING"
- Feeding Status: Shows "Idle" or "Active"
- Temperature: Shows 24°C

## Expected Behavior

### When Device is ONLINE (ESP32 connected):
- Frontend shows "Ready" or "Feeding"
- All metrics display real-time data
- Buttons are enabled
- Updates every 3-5 seconds
- Backend logs: "Feeding device status updated... Status: online"

### When Device is OFFLINE (ESP32 disconnected):
- Frontend shows "Blocked" status
- All metrics show "Offline"
- Buttons are disabled
- Backend logs: "Device marked offline due to timeout"

## Troubleshooting

### Issue: Device still shows as "Blocked"

**Check 1: Is ESP32 connected to WiFi?**
- Open Serial Monitor
- Look for "WiFi connected" message
- Check IP address is displayed

**Check 2: Is MQTT connected?**
- Serial Monitor should show "MQTT connection...connected"
- Look for "Published status: ..." messages

**Check 3: Is backend receiving messages?**
- Check backend logs for "Feeding device status updated"
- If not appearing, check MQTT broker connectivity

**Check 4: Is device in database?**
```sql
SELECT * FROM sensor_devices WHERE device_id = 'feed_device_001';
```
- Should show status = 'online' when ESP32 is running
- Should show status = 'offline' when ESP32 is off

**Check 5: Check lastSeen timestamp**
```sql
SELECT device_id, status, last_seen FROM sensor_devices WHERE device_id = 'feed_device_001';
```
- last_seen should update every few seconds when online
- If last_seen is old, backend is not receiving messages

### Issue: Frontend shows old/stale data

**Solution**: Clear browser cache and reload
```
Ctrl + Shift + R (hard reload)
```

### Issue: Start/Stop buttons disabled

This happens when:
1. Device status is not "Ready" or "Feeding"
2. Device is offline
3. Frontend hasn't received device status yet

**Solution**: Wait 5 seconds for frontend to fetch device status

### Issue: Backend not starting

**Check Java version**:
```bash
java -version
```
Should be Java 21 or higher

**Check port 8080**:
```powershell
Test-NetConnection -ComputerName localhost -Port 8080
```
Should fail if backend is not running

**Check backend logs for errors**:
Look for:
- Database connection errors
- MQTT connection errors
- Port already in use errors

### Issue: MQTT messages not arriving

**Check MQTT broker**:
- Using broker.hivemq.com (public broker)
- No authentication required
- Topics: 
  - `koi/devices/feed_device_001/feeding/command` (commands TO device)
  - `koi/devices/feed_device_001/feeding/status` (status FROM device)
  - `koi/devices/feed_device_001/feeding/schedule` (schedules TO device)

**Test with MQTT client**:
```bash
# Subscribe to status topic
mosquitto_sub -h broker.hivemq.com -t "koi/devices/feed_device_001/feeding/status"
```

## Verification Checklist

- [ ] Database migrations applied successfully
- [ ] Backend compiles without errors
- [ ] Backend starts and connects to database
- [ ] Backend connects to MQTT broker
- [ ] ESP32 code uploaded
- [ ] ESP32 connects to WiFi
- [ ] ESP32 connects to MQTT
- [ ] Backend logs show "Feeding device status updated"
- [ ] Device status = 'online' in database
- [ ] Frontend Feeding Dashboard shows "Ready"
- [ ] Frontend Health & Safety shows real data
- [ ] Start/Stop buttons are enabled
- [ ] Can start feeding manually
- [ ] Real-time updates working (3-5 second refresh)

## Quick Test Procedure

1. **Power on ESP32** - wait 10 seconds
2. **Check backend logs** - should see status updates
3. **Open Feeding Dashboard** - should show "Ready"
4. **Open Health & Safety** - should show real metrics
5. **Click Start Feeding** - should start feeding cycle
6. **Watch real-time updates** - values should change every 3-5 seconds
7. **Power off ESP32** - should show "Offline" within 15 seconds
8. **Power on ESP32** - should show "Online" within 5 seconds

## Success Indicators

✅ Backend logs: "Feeding device status updated: feed_device_001 - Status: online"
✅ Feeding Dashboard: Status shows "Ready" (green badge)
✅ Hopper Feed Level: Shows actual kg from load cells
✅ Health & Safety: All 6 metrics show real data
✅ Connection: Shows "Online" (green)
✅ Start/Stop buttons: Enabled (not grayed out)
✅ Real-time updates: Values change every 3-5 seconds

## Support Commands

### Check device status via API:
```bash
curl http://localhost:8080/api/sensor-devices/feed_device_001
```

### Check all devices:
```bash
curl http://localhost:8080/api/sensor-devices
```

### Query database directly:
```sql
-- Check device record
SELECT * FROM sensor_devices WHERE device_id = 'feed_device_001';

-- Check recent status updates
SELECT device_id, status, last_seen, hopper_level, hopper_percentage, motor_status
FROM sensor_devices 
WHERE device_id = 'feed_device_001';

-- Force device online (for testing)
UPDATE sensor_devices 
SET status = 'online', last_seen = NOW() 
WHERE device_id = 'feed_device_001';
```

---

**Last Updated**: January 3, 2026
**Status**: Ready for testing
