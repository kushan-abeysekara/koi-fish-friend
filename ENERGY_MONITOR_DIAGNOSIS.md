# 🔍 Energy Monitor - Root Cause Analysis

## ❌ ISSUE: No Real-time Data in Frontend

### 🔎 Investigation Results

#### ✅ Backend Status: RUNNING

- **Port**: 8081 ✅
- **Status**: Online and responding
- **Database**: Connected

#### ✅ Frontend Status: RUNNING

- **Port**: 5173 ✅
- **API Configuration**: Correctly pointing to port 8081 ✅

#### ✅ API Endpoints: WORKING

- **Endpoint**: `GET /api/sensor-data/pond/1/latest/energy` ✅
- **Response**: Returning data successfully ✅

#### ⚠️ Device Status: PARTIALLY ONLINE

- **Device ID**: `BM_000`
- **Type**: `BUDGET_MANAGEMENT` ✅
- **Pond Assignment**: Pond 1 ✅
- **Status**: "online"
- **Last Seen**: 2026-01-08T02:52:44 (recent)
- **Energy Counter**: 315.56 Wh

#### ❌ DATA FRESHNESS: STALE

- **Last Data Timestamp**: 2026-01-08T01:20:51
- **Age**: ~92 minutes old
- **Expected**: Updates every 3 seconds
- **Problem**: ESP32 stopped sending sensor data

---

## 🎯 ROOT CAUSE

The ESP32 device (`BM_000`) is:

1. ✅ Connected to WiFi
2. ✅ Connected to MQTT (status messages arriving)
3. ✅ Assigned to Pond 1
4. ❌ **NOT sending sensor data** (voltage/current/power)

### Why Status Shows "Online" But No Data?

The backend marks device as "online" when it receives **status messages** (every 5 seconds).
But **sensor data** is published separately (every 3 seconds) on a different topic.

**Status Topic**: `koi/sensors/BM_000/status` ✅ (working)
**Data Topic**: `koi/sensors/BM_000/data` ❌ (not publishing)

---

## 🔧 SOLUTION

### The ESP32 device needs to be checked:

1. **Check ESP32 Serial Monitor**

   - Open Arduino IDE
   - Connect to ESP32
   - Set baud rate: 115200
   - Look for: "Sensor data published: {..."

2. **Verify Pond Assignment on ESP32**

   - Check LCD display
   - Should show: "Pond: 1"
   - If shows "Pond: 0" → Not assigned, won't publish data

3. **Check ESP32 is Reading Sensors**

   - LCD should show voltage (V:), current (I:), power (P:)
   - If all show 0.0 → Sensor connection problem

4. **Verify Data Publishing in Code**
   - Check `publishSensorData()` function is being called
   - Check `assignedPondId` is set correctly
   - Data only publishes if `assignedPondId > 0`

---

## 📋 ESP32 Code Check

In `currnet_voltage.ino`, the ESP32 only publishes data if assigned:

```cpp
void publishSensorData()
{
    if (assignedPondId == 0)  // ← THIS IS THE BLOCKER
        return;

    // ... publish data
}
```

**If `assignedPondId` is 0 on ESP32, no data will be sent!**

---

## 🚀 Quick Fix Steps

### Option 1: Re-assign Device via API

Even though backend shows assigned, ESP32 might have restarted:

```powershell
Invoke-WebRequest -Uri "http://localhost:8081/api/sensors/BM_000/assign" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"pondId": 1}'
```

This sends MQTT command to ESP32 to set `assignedPondId = 1`.

### Option 2: Power Cycle ESP32

1. Unplug ESP32
2. Wait 5 seconds
3. Plug back in
4. Wait for "WiFi Connected" on LCD
5. Wait for "MQTT Connected" on LCD
6. Re-assign via API (Option 1)

### Option 3: Check Physical Connections

If sensors not reading:

- **ZMPT101B** → GPIO 34 (voltage sensor)
- **ACS712** → GPIO 35 (current sensor)
- **Power supply** → Sensors need proper AC voltage input

---

## 🔄 Verification Steps

After fixing:

1. **Check ESP32 Serial Monitor**:

   ```
   Sensor data published: {"deviceId":"BM_000","pondId":1,"voltage":230.5,...}
   ```

2. **Check Backend Logs**:

   ```
   ⚡ Energy data received: BM_000 - Pond: 1 - V:230.5 I:2.3 P:529.15W E:315.56Wh
   ✅ Sensor data saved to database for device: BM_000
   ```

3. **Check API Returns Fresh Data**:

   ```powershell
   Invoke-WebRequest -Uri "http://localhost:8081/api/sensor-data/pond/1/latest/energy"
   ```

   Timestamp should be within last 10 seconds.

4. **Check Frontend**:
   - Open Energy Monitor page
   - Select Pond 1
   - Data should update every 10 seconds

---

## 🎯 Summary

| Component            | Status        | Issue                                |
| -------------------- | ------------- | ------------------------------------ |
| Backend              | ✅ Working    | None                                 |
| Frontend             | ✅ Working    | None                                 |
| API Endpoints        | ✅ Working    | None                                 |
| Device Connection    | ✅ Online     | None                                 |
| Device Assignment    | ✅ Assigned   | None                                 |
| **Sensor Data Flow** | ❌ **BROKEN** | **ESP32 not publishing sensor data** |

**The problem is NOT in the frontend or backend code.**  
**The problem is the ESP32 device is not sending sensor data to MQTT.**

---

## 💡 Most Likely Causes

1. **ESP32 restarted** and lost `assignedPondId` (stored in RAM, not persistent)
2. **Sensor hardware issue** (disconnected or faulty)
3. **MQTT data topic** not publishing (check ESP32 code logic)
4. **Network issue** preventing data packets (but not status packets)

---

## 🔍 Diagnostic Commands

```powershell
# 1. Check device status
Invoke-WebRequest -Uri "http://localhost:8081/api/sensors/BM_000" -UseBasicParsing

# 2. Check latest energy data
Invoke-WebRequest -Uri "http://localhost:8081/api/sensor-data/pond/1/latest/energy" -UseBasicParsing

# 3. Re-assign device
Invoke-WebRequest -Uri "http://localhost:8081/api/sensors/BM_000/assign" `
  -Method POST -ContentType "application/json" -Body '{"pondId": 1}'

# 4. Check if data starts coming in (wait 10 seconds then check)
Start-Sleep -Seconds 10
Invoke-WebRequest -Uri "http://localhost:8081/api/sensor-data/pond/1/latest/energy" -UseBasicParsing
```

---

**Action Required**: Check ESP32 physical device and re-assign to pond.
**Expected Result**: Real-time data will start flowing once ESP32 publishes to data topic.
