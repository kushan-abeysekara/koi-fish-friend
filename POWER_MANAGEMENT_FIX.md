# Power Management IoT Control Fix

## 🎯 Overview

Fixed the PowerManagement screen to properly control IoT devices by:

1. ✅ Tracking actual device state from MQTT messages
2. ✅ Adding relay state and control mode display
3. ✅ Implementing retry logic for failed commands
4. ✅ Syncing UI with real device state
5. ✅ Preventing command conflicts with command-in-progress flag

## 🔧 Changes Made

### Frontend Updates (`PowerManagement.tsx`)

1. **Extended Device State Interface**

   - Added `DeviceState` interface with `relayState`, `controlMode`, and `scheduleCount`
   - Tracks actual ESP32 state instead of just local UI state

2. **Improved Power Control Functions**

   - Added `commandInProgress` flag to prevent duplicate commands
   - Implemented optimistic UI updates for instant feedback
   - Added 1-second delay for ESP32 processing time
   - Auto-refresh device state after commands
   - Better error messages with device status hints

3. **Enhanced UI**
   - Buttons show active state based on actual device state
   - Device card displays current relay state and control mode
   - Disabled buttons during command execution
   - Visual indicators for active modes (colored rings)

### Backend Updates

1. **SensorDevice Entity** (`SensorDevice.java`)

   - Added `relayState` column (stores "ON" or "OFF")
   - Added `controlMode` column (stores "manual", "auto", or "schedule")
   - Added `scheduleCount` column (number of synced schedules)

2. **MQTT Service** (`MqttService.java`)

   - Updated to parse and save `relayState` from ESP32 status messages
   - Updated to parse and save `controlMode` from ESP32 status messages
   - Updated to parse and save `scheduleCount` from ESP32 status messages

3. **Database Migration**
   - Created `add_power_management_columns.sql`
   - Adds new columns to `sensor_devices` table
   - Sets default values for existing devices

## 📋 Setup Instructions

### Step 1: Run Database Migration

```bash
cd e:\koi-fish-friend\database
run-power-management-migration.bat
```

Or manually run:

```bash
psql -U postgres -d koi_management -f add_power_management_columns.sql
```

### Step 2: Rebuild Backend

```bash
cd e:\koi-fish-friend\backend
mvnw clean install
```

### Step 3: Restart Services

```bash
# Stop current services
cd e:\koi-fish-friend
docker-compose down

# Rebuild and start
docker-compose up --build
```

### Step 4: Test ESP32 Connection

1. Make sure your ESP32 device is online
2. Check device appears in device list with "online" status
3. Verify IP address is shown in the device card

## 🧪 Testing the Fix

### Test Manual Control

1. Open PowerManagement screen
2. Select your pond
3. Verify device status shows "online"
4. Click "POWER ON" button

   - ✅ Should show success alert
   - ✅ Button should show "🟢 ACTIVE" badge
   - ✅ Device card should show "Relay State: ON"
   - ✅ Device card should show "Control Mode: MANUAL"

5. Click "POWER OFF" button
   - ✅ Should show confirmation dialog
   - ✅ Should show success alert
   - ✅ Button should show "🔴 ACTIVE" badge
   - ✅ Relay State should change to "OFF"

### Test AUTO Mode

1. Click "AUTO MODE" button
2. Verify:
   - ✅ Success alert appears
   - ✅ Control Mode changes to "AUTO"
   - ✅ Button shows "🔵 ACTIVE" badge
   - ✅ ESP32 LCD shows "AUTO Mode"

### Test SCHEDULE Mode

1. Click "SCHEDULE" button
2. Verify:
   - ✅ Success alert appears
   - ✅ Control Mode changes to "SCHEDULE"
   - ✅ Button shows "🟣 ACTIVE" badge

## 🔍 Troubleshooting

### Device Shows Offline

**Problem:** Device status shows "offline" or no device found

**Solutions:**

1. Check ESP32 WiFi connection
2. Verify MQTT broker is running
3. Check ESP32 serial monitor for connection errors
4. Restart ESP32 device
5. Check device registration in database:
   ```sql
   SELECT * FROM sensor_devices WHERE device_id = 'YOUR_DEVICE_ID';
   ```

### Commands Not Working

**Problem:** Clicking buttons does nothing or shows error

**Solutions:**

1. Verify device is "online" (check status badge)
2. Check browser console for errors (F12)
3. Verify backend is running: `http://localhost:8081/api/sensors`
4. Check MQTT broker logs
5. Verify ESP32 is subscribed to command topic
6. Check ESP32 serial monitor for received commands

### State Not Updating

**Problem:** UI doesn't reflect actual device state

**Solutions:**

1. Wait 5 seconds (auto-refresh interval)
2. Manually refresh the page
3. Check MQTT service is processing status messages
4. Verify ESP32 is publishing status updates
5. Check backend logs for MQTT message processing

### Database Errors

**Problem:** Migration fails or columns missing

**Solutions:**

1. Check PostgreSQL is running
2. Verify database connection credentials
3. Manually run migration:
   ```sql
   psql -U postgres -d koi_management
   \i e:/koi-fish-friend/database/add_power_management_columns.sql
   ```
4. Check if columns exist:
   ```sql
   \d sensor_devices
   ```

## 📊 How It Works

### State Flow

```
ESP32 Device
    ↓ (MQTT Status)
Backend MQTT Service
    ↓ (Parse & Save)
Database (sensor_devices table)
    ↓ (REST API)
Frontend (PowerManagement.tsx)
    ↓ (Display)
User Interface
```

### Command Flow

```
User Clicks Button
    ↓
Frontend validates device status
    ↓
API call to backend
    ↓
Backend sends MQTT command
    ↓
ESP32 receives command
    ↓
ESP32 executes action
    ↓
ESP32 publishes status update
    ↓
Backend saves new state
    ↓
Frontend refreshes device data
    ↓
UI updates to show new state
```

## 🎨 UI Features

### Active Mode Indicators

- 🟢 **Manual ON**: Green ring + "ACTIVE" badge
- 🔴 **Manual OFF**: Red ring + "ACTIVE" badge
- 🔵 **AUTO Mode**: Blue ring + "ACTIVE" badge
- 🟣 **SCHEDULE Mode**: Purple ring + "ACTIVE" badge

### Device Status Card

Shows real-time information:

- Device ID
- Online/Offline status
- IP Address
- Current Relay State (ON/OFF)
- Current Control Mode (manual/auto/schedule)

### Error Handling

- Disabled buttons when device is offline
- Command-in-progress prevents duplicate requests
- Clear error messages with troubleshooting hints
- Automatic device state refresh after commands

## 📱 Mobile Responsive

- All features work on mobile devices
- Touch-friendly button sizes
- Responsive grid layout for control buttons
- Optimized for tablets and phones

## 🔐 Safety Features

- Confirmation dialog for POWER OFF command
- Prevents commands when device is offline
- Command-in-progress lock prevents conflicts
- Persistent state saved to ESP32 flash memory
- Auto-recovery on ESP32 reboot

## 🚀 Performance

- 5-second auto-refresh interval
- Optimistic UI updates for instant feedback
- 1-second delay for ESP32 processing
- Efficient MQTT communication
- Minimal backend database queries

## 📝 Next Steps

1. **Monitor the System**

   - Watch backend logs for MQTT messages
   - Check ESP32 serial output for command processing
   - Verify device states update correctly

2. **Create Schedules** (Optional)

   - Switch to "Time Schedules" tab
   - Create power schedules for automated control
   - Sync schedules to ESP32 device

3. **Set Up Automation**
   - Use AUTO mode for voltage-based control (210-250V)
   - Use SCHEDULE mode for time-based control
   - Combine both for optimal power management

## ✅ Success Indicators

Your system is working correctly when:

- ✅ Device shows "online" status
- ✅ Buttons respond immediately
- ✅ Success alerts appear after commands
- ✅ Relay state updates in UI
- ✅ Control mode shows current state
- ✅ ESP32 LCD displays mode changes
- ✅ State persists after ESP32 reboot

## 📞 Support

If issues persist:

1. Check all logs (backend, frontend, ESP32)
2. Verify all services are running
3. Test MQTT broker connectivity
4. Review database migration results
5. Restart entire system if needed

Good luck! Your IoT power management system should now work perfectly! 🎉
