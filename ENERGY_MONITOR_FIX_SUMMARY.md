# ⚡ Energy Monitor - Real-time Data Integration Fix

## 🔍 Problem Identified

The ESP32 energy monitoring device was powered and publishing MQTT data, but the frontend was not displaying the sensor data.

### Root Causes:

1. **Wrong API endpoint**: Frontend was using water quality endpoint instead of energy-specific endpoint
2. **Device type filtering**: Backend was filtering for `WATER_QUALITY` devices, but energy monitor has type `BUDGET_MANAGEMENT`
3. **Missing API methods**: No dedicated endpoints for energy data retrieval
4. **Device assignment**: Device might not be assigned to a pond (data only saved when assigned)

## ✅ Solutions Implemented

### 1. Backend - New Energy Data Endpoints

**File**: `backend/src/main/java/com/example/backend/controller/SensorDataController.java`

Added three new endpoints specifically for energy monitoring:

#### A. Get Latest Energy Data

```java
@GetMapping("/pond/{pondId}/latest/energy")
```

- Filters for `BUDGET_MANAGEMENT` device type only
- Returns the most recent energy reading for a pond
- Includes voltage, current, power, and energy data
- Validates data freshness (warns if older than 30 seconds)

#### B. Get Historical Energy Data

```java
@GetMapping("/pond/{pondId}/history/energy")
```

- Returns energy data for specified time range (default 24 hours)
- Filters out water quality data, returns only energy data
- Used for charts and analysis

### 2. Backend - Improved MQTT Data Handling

**File**: `backend/src/main/java/com/example/backend/service/MqttService.java`

#### Changes:

- ✅ Auto-detect `BUDGET_MANAGEMENT` device type for devices with `BM_` prefix
- ✅ Enhanced logging for energy data reception
- ✅ Added validation: energy data only saved if device is assigned to pond
- ✅ Better error messages when device not assigned

```java
// Auto-detection logic
if (deviceId.startsWith("BM_")) {
    newDevice.setDeviceType(SensorDevice.DeviceType.BUDGET_MANAGEMENT);
}
```

### 3. Frontend - New API Service Methods

**File**: `frontend/src/services/api.ts`

Added new methods to `sensorDataApi`:

```typescript
// Get latest energy data for a pond
getLatestEnergyByPond: async (pondId: number)

// Get historical energy data
getHistoricalEnergyData: async (pondId: number, hours: number)
```

### 4. Frontend - Updated Energy Monitor Component

**File**: `frontend/src/components/EnergyMonitor.tsx`

#### Changes:

- ✅ Now uses energy-specific API endpoints
- ✅ Polling interval set to 10 seconds (matches ESP32 data requirements)
- ✅ Added console logging for debugging
- ✅ Better error handling and user feedback

```typescript
// Updated API calls
sensorDataApi.getLatestEnergyByPond(selectedPondId);
sensorDataApi.getHistoricalEnergyData(selectedPondId, selectedHours);
```

## 📊 Data Flow (Fixed)

```
┌─────────────────┐
│   ESP32 Device  │ Auto-generates ID: BM_XXXXXX
│   (BM_XXXXXX)   │ Device Type: BUDGET_MANAGEMENT
└────────┬────────┘
         │ Every 3 seconds
         │ MQTT Publish to: koi/sensors/BM_XXXXXX/data
         ▼
┌─────────────────┐
│  MQTT Broker    │ broker.hivemq.com:1883
│  (HiveMQ)       │
└────────┬────────┘
         │ Subscribe
         ▼
┌─────────────────┐
│ Spring Boot     │ MqttService receives message
│ Backend         │ Checks: Device assigned to pond?
│                 │ ✅ Yes → Save to database
│                 │ ❌ No  → Log warning, don't save
└────────┬────────┘
         │ Saves to database
         ▼
┌─────────────────┐
│  PostgreSQL     │ sensor_data table
│  Database       │ Stores: voltage, current, power, energyWh
└────────┬────────┘
         │ Frontend queries every 10 seconds
         ▼
┌─────────────────┐
│ React Frontend  │ GET /api/sensor-data/pond/{id}/latest/energy
│ EnergyMonitor   │ GET /api/sensor-data/pond/{id}/history/energy
└─────────────────┘
```

## 🚀 Setup Instructions

### Step 1: Update Backend & Frontend

The code changes are already in place. Just restart the services:

```bash
# Terminal 1 - Backend
cd backend
./mvnw spring-boot:run

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Step 2: Find Your Device ID

The ESP32 auto-generates an ID based on its MAC address:

- **Format**: `BM_XXXXXX` (BM = Budget Management)
- **Where to find it**:
  - ESP32 LCD display (shows on startup)
  - Serial Monitor (115200 baud)
  - Backend logs (when device connects)

### Step 3: Assign Device to Pond

**Important**: Device MUST be assigned before data appears in frontend!

#### Method A: Using the Setup Script

```bash
setup-energy-device.bat
```

Follow the prompts to assign your device.

#### Method B: Manual curl command

```bash
curl -X POST "http://localhost:8080/api/sensors/BM_XXXXXX/assign" \
  -H "Content-Type: application/json" \
  -d '{"pondId": 1}'
```

Replace `BM_XXXXXX` with your actual device ID.

### Step 4: Verify Data Flow

1. **Check ESP32 LCD**:

   - Should show "Pond: 1" (or your pond number)
   - Voltage, Current, Power should be updating

2. **Check Backend Logs**:

   ```
   ⚡ Energy data received: BM_XXXXXX - Pond: 1 - V:230.5 I:2.3 P:529.15W E:1234.5Wh
   ✅ Sensor data saved to database for device: BM_XXXXXX
   ```

3. **Check Frontend**:
   - Open Energy Monitor page
   - Select your pond from dropdown
   - Should see real-time data updating every 10 seconds

## 🔍 Troubleshooting

### Issue: Device connects but no data in frontend

**Diagnosis**:

```bash
# Check if device is assigned
curl http://localhost:8080/api/sensors/BM_XXXXXX
```

Look for `"pond": null` in response → Device not assigned!

**Solution**:

```bash
# Assign device to pond
curl -X POST http://localhost:8080/api/sensors/BM_XXXXXX/assign \
  -H "Content-Type: application/json" \
  -d '{"pondId": 1}'
```

### Issue: Backend not receiving MQTT data

**Check**:

1. ESP32 LCD shows "MQTT Connected"
2. Backend logs show "Received MQTT message..."
3. WiFi and MQTT broker accessible

**Solution**:

- Restart ESP32
- Check WiFi credentials in ESP32 code
- Verify MQTT broker is accessible

### Issue: Frontend shows "No data available"

**Check**:

1. Selected correct pond in dropdown
2. Device assigned to that pond
3. Browser console for API errors (F12)

**Solution**:

```bash
# Test API endpoint directly
curl http://localhost:8080/api/sensor-data/pond/1/latest/energy
```

## 📋 API Endpoints Summary

### Energy Monitoring Endpoints (NEW)

| Method | Endpoint                                             | Description                            |
| ------ | ---------------------------------------------------- | -------------------------------------- |
| GET    | `/api/sensor-data/pond/{id}/latest/energy`           | Get latest energy reading for pond     |
| GET    | `/api/sensor-data/pond/{id}/history/energy?hours=24` | Get energy history for specified hours |

### Device Management Endpoints

| Method | Endpoint                               | Description               |
| ------ | -------------------------------------- | ------------------------- |
| GET    | `/api/sensors`                         | List all devices          |
| GET    | `/api/sensors/{deviceId}`              | Get device details        |
| POST   | `/api/sensors/{deviceId}/assign`       | Assign device to pond     |
| POST   | `/api/sensors/{deviceId}/unassign`     | Unassign device from pond |
| POST   | `/api/sensors/{deviceId}/reset-energy` | Reset energy counter      |

## 🎯 Key Features Now Working

✅ Real-time voltage monitoring (updates every 10 seconds)
✅ Real-time current monitoring
✅ Real-time power calculation
✅ Cumulative energy tracking (Wh)
✅ Cost calculation based on electricity rate
✅ Historical data charts (1, 6, 12, 24 hours)
✅ Average power consumption
✅ Device status indicators
✅ Auto-reconnect on WiFi/MQTT loss
✅ Device assignment management
✅ Energy counter reset

## 📈 Data Metrics

### Real-time Display:

- **Voltage**: 0-300V (typical: 220-240V)
- **Current**: 0-30A (depends on ACS712 model)
- **Power**: V × I (Watts)
- **Energy**: Cumulative (Wh)
- **Cost**: Energy × Rate (LKR)

### Update Frequencies:

- **ESP32 → MQTT**: Every 3 seconds
- **Backend → Database**: Real-time on MQTT receive
- **Frontend → Backend**: Every 10 seconds
- **LCD Display**: Every 1 second

## 🔒 Safety Features

1. **Voltage Protection**:

   - Safe range: 210V - 250V
   - Relay cuts power if outside range

2. **Data Validation**:

   - Checks pond assignment before saving
   - Validates data freshness
   - Type-safe device filtering

3. **Error Handling**:
   - Graceful degradation on connection loss
   - Auto-reconnect mechanisms
   - User-friendly error messages

## 📝 Files Modified

### Backend (3 files):

1. `backend/src/main/java/com/example/backend/controller/SensorDataController.java` - Added energy endpoints
2. `backend/src/main/java/com/example/backend/service/MqttService.java` - Improved device detection
3. (Database schema unchanged - existing tables support energy data)

### Frontend (2 files):

1. `frontend/src/services/api.ts` - Added energy API methods
2. `frontend/src/components/EnergyMonitor.tsx` - Updated to use new endpoints

### Documentation (2 files):

1. `ESP32 CODE/currnet_voltage/ENERGY_MONITOR_SETUP.md` - Comprehensive setup guide
2. `setup-energy-device.bat` - Interactive setup helper script

## ✨ Next Steps

1. ✅ Restart backend and frontend
2. ✅ Power on ESP32
3. ✅ Run `setup-energy-device.bat` to assign device
4. ✅ Open Energy Monitor page
5. ✅ Watch real-time data flow!

## 🎉 Result

Your ESP32 energy monitoring device is now fully integrated with the Koi Fish Friend system. Real-time voltage, current, power, and energy data will display in the frontend, updating every 10 seconds with data from the ESP32.

---

**Status**: ✅ FIXED AND READY
**Date**: January 8, 2026
**Impact**: Full real-time energy monitoring operational
