# ⚡ Manual Power Control Feature - Budget Management System

## 📋 Overview

Added manual power ON/OFF control functionality to the Energy Monitor system, allowing users to remotely control equipment power through the frontend dashboard. The system supports both **MANUAL** and **AUTO** control modes.

## ✨ Features Added

### 1. **ESP32 Firmware Updates**

- **Manual Mode**: Override automatic voltage-based relay control
- **Power Commands**: Remote power ON/OFF via MQTT
- **Control Mode Switching**: Toggle between Manual and Auto modes
- **Status Reporting**: Relay state and control mode included in status messages

### 2. **Backend API Endpoints**

Three new REST API endpoints for power control:

| Method | Endpoint                            | Description                         |
| ------ | ----------------------------------- | ----------------------------------- |
| POST   | `/api/sensors/{deviceId}/power-on`  | Turn power ON manually              |
| POST   | `/api/sensors/{deviceId}/power-off` | Turn power OFF manually             |
| POST   | `/api/sensors/{deviceId}/auto-mode` | Switch to AUTO mode (voltage-based) |

### 3. **Frontend UI Components**

- **Power Control Panel**: Beautiful UI with 3 control buttons
- **Visual Feedback**: Color-coded buttons (Green=ON, Red=OFF, Blue=AUTO)
- **Mode Information**: Clear explanation of each control mode
- **Loading States**: Disabled buttons during API calls
- **Confirmation Dialogs**: Safety prompt before powering OFF

## 🔧 How It Works

### Control Modes

#### **MANUAL Mode** (User-controlled)

- User explicitly turns power ON or OFF via dashboard
- Relay state controlled by user commands
- Overrides automatic voltage protection
- Use for scheduled maintenance or testing

#### **AUTO Mode** (Voltage-based)

- Automatic relay control based on voltage readings
- **Safe Range**: 210V - 250V
- **Protection Logic**:
  - If voltage < 210V → Relay OFF (equipment protected)
  - If voltage > 250V → Relay OFF (equipment protected)
  - If 210V ≤ voltage ≤ 250V → Relay ON (equipment powered)
- Default mode on ESP32 startup

### Data Flow

```
┌──────────────┐
│   Frontend   │ User clicks "POWER ON"
│  Dashboard   │
└──────┬───────┘
       │ POST /api/sensors/BM_XXX/power-on
       ▼
┌──────────────┐
│   Backend    │ Validates device type & sends MQTT command
│  Spring Boot │
└──────┬───────┘
       │ MQTT: koi/sensors/BM_XXX/command
       │ {"command": "power_on"}
       ▼
┌──────────────┐
│  MQTT Broker │ HiveMQ Public Broker
│ broker.hivemq│
└──────┬───────┘
       │ Subscribe: koi/sensors/BM_XXX/command
       ▼
┌──────────────┐
│  ESP32 Device│ Receives command
│  BM_XXXXXX   │ Sets: manualMode = true
└──────┬───────┘      relayManualState = true
       │              digitalWrite(RELAY_PIN, HIGH)
       ▼
   Equipment Powers ON!
```

## 🎮 Usage Guide

### Turning Power ON

1. Open Energy Monitor page
2. Select your pond from dropdown
3. Click **"POWER ON"** button (green)
4. ✅ Confirmation message appears
5. ESP32 LCD shows "POWER: ON (Manual Mode)"
6. Equipment receives power

### Turning Power OFF

1. Click **"POWER OFF"** button (red)
2. ⚠️ Confirmation dialog appears
3. Confirm to proceed
4. ✅ Success message appears
5. ESP32 LCD shows "POWER: OFF (Manual Mode)"
6. Equipment power is cut

### Switching to AUTO Mode

1. Click **"AUTO MODE"** button (blue)
2. ✅ Confirmation message appears
3. ESP32 LCD shows "AUTO Mode - Voltage Control"
4. System automatically controls power based on voltage

## 📡 MQTT Commands

### Command Topic

```
koi/sensors/BM_XXXXXX/command
```

### Power ON Command

```json
{
  "command": "power_on"
}
```

### Power OFF Command

```json
{
  "command": "power_off"
}
```

### AUTO Mode Command

```json
{
  "command": "auto_mode"
}
```

## 📊 Status Reporting

The ESP32 now includes relay state and control mode in status messages:

```json
{
  "deviceId": "BM_A1B2C3",
  "deviceType": "BUDGET_MANAGEMENT",
  "status": "online",
  "ipAddress": "192.168.1.100",
  "rssi": -45,
  "energyWh": 1234.5,
  "relayState": "ON",
  "controlMode": "manual"
}
```

**Fields:**

- `relayState`: "ON" or "OFF" - Current relay state
- `controlMode`: "manual" or "auto" - Current control mode

## 🛡️ Safety Features

### 1. Device Type Validation

- Power control only available for `BUDGET_MANAGEMENT` devices
- Backend validates device type before sending commands
- Error returned if wrong device type

### 2. Confirmation Dialogs

- **Power OFF**: Requires user confirmation
- **Power ON**: Direct action (safe)
- **Auto Mode**: Direct action (safe)

### 3. Voltage Protection in AUTO Mode

- Protects equipment from voltage spikes
- Protects equipment from low voltage
- Safe range: 210V - 250V

### 4. Manual Override

- Manual commands override voltage-based control
- Useful for maintenance or testing
- Can be reverted to AUTO mode anytime

## 🔍 Troubleshooting

### Issue: Power button not responding

**Check:**

1. ✅ ESP32 is online (green indicator)
2. ✅ Device assigned to pond
3. ✅ Backend running and connected to MQTT
4. ✅ Browser console for errors (F12)

**Solution:**

```bash
# Test API endpoint directly
curl -X POST http://localhost:8081/api/sensors/BM_XXXXXX/power-on
```

### Issue: Power state not changing

**Check:**

1. ✅ ESP32 LCD shows new state
2. ✅ Check Serial Monitor (115200 baud)
3. ✅ Verify relay wiring (GPIO 17)

**Solution:**

- Power cycle ESP32
- Check relay module connections
- Verify relay is working (test LED or multimeter)

### Issue: Stuck in manual mode

**Solution:**
Click **"AUTO MODE"** button to reset to voltage-based control

## 📝 Code Changes Summary

### ESP32 Firmware (`currnet_voltage.ino`)

```cpp
// New variables
bool manualMode = false;
bool relayManualState = true;

// New command handlers
- power_on: Sets manualMode=true, relay=HIGH
- power_off: Sets manualMode=true, relay=LOW
- auto_mode: Sets manualMode=false

// Updated relay logic
if (manualMode) {
    digitalWrite(RELAY_PIN, relayManualState ? HIGH : LOW);
} else {
    // Automatic voltage-based control
}
```

### Backend Controller (`SensorDeviceController.java`)

```java
@PostMapping("/{deviceId}/power-on")
@PostMapping("/{deviceId}/power-off")
@PostMapping("/{deviceId}/auto-mode")
```

### Frontend API (`api.ts`)

```typescript
powerOn: async (deviceId: string)
powerOff: async (deviceId: string)
setAutoMode: async (deviceId: string)
```

### Frontend Component (`EnergyMonitor.tsx`)

```typescript
// New handlers
handlePowerOn()
handlePowerOff()
handleAutoMode()

// New UI panel
Power Control Panel with 3 buttons
```

## 🎯 Use Cases

### 1. **Scheduled Maintenance**

Turn off power manually before performing equipment maintenance:

```
1. Click "POWER OFF"
2. Perform maintenance
3. Click "POWER ON" when done
```

### 2. **Testing Equipment**

Test equipment without voltage fluctuations affecting it:

```
1. Click "POWER ON"
2. Test equipment functionality
3. Click "AUTO MODE" to resume normal operation
```

### 3. **Energy Saving**

Manually turn off equipment during off-hours:

```
1. Evening: Click "POWER OFF"
2. Equipment remains off
3. Morning: Click "POWER ON"
```

### 4. **Emergency Shutdown**

Quickly cut power in emergency situations:

```
1. Click "POWER OFF"
2. Power immediately cut
3. Equipment safe
```

## ⚙️ Technical Specifications

### Hardware

- **Relay Module**: Connected to GPIO 17
- **Control**: Active HIGH (3.3V to turn ON)
- **Max Load**: Depends on relay rating (typically 10A @ 250VAC)

### Timing

- **Command Response**: < 1 second
- **Status Update**: Every 5 seconds
- **UI Refresh**: Every 10 seconds

### Network

- **Protocol**: MQTT over TCP
- **Broker**: broker.hivemq.com:1883
- **QoS**: 1 (At least once delivery)

## 📈 Future Enhancements

### Planned Features:

1. **Scheduled Power Control**: Set timers for automatic ON/OFF
2. **Power Logging**: Track power state changes over time
3. **Multi-Device Control**: Control multiple devices simultaneously
4. **Mobile Notifications**: Alert when power state changes
5. **Voice Control**: Integration with voice assistants

## ✅ Testing Checklist

- [ ] Power ON command turns relay ON
- [ ] Power OFF command turns relay OFF
- [ ] AUTO mode enables voltage-based control
- [ ] ESP32 LCD displays current mode
- [ ] Frontend buttons work correctly
- [ ] Confirmation dialog appears for Power OFF
- [ ] Backend logs show command sent
- [ ] Status updates include relay state
- [ ] Manual mode persists across data updates
- [ ] Auto mode responds to voltage changes

## 🔒 Security Notes

1. **Device Type Restriction**: Only BUDGET_MANAGEMENT devices support power control
2. **No Authentication**: Current implementation uses public MQTT broker (add auth for production)
3. **Command Validation**: Backend validates device existence before sending commands
4. **User Confirmation**: Power OFF requires explicit user confirmation

## 📞 API Testing

### cURL Examples:

```bash
# Power ON
curl -X POST "http://localhost:8081/api/sensors/BM_000/power-on"

# Power OFF
curl -X POST "http://localhost:8081/api/sensors/BM_000/power-off"

# AUTO Mode
curl -X POST "http://localhost:8081/api/sensors/BM_000/auto-mode"
```

### Expected Response:

```json
{
  "success": true,
  "message": "Power ON command sent successfully",
  "data": null
}
```

## 🎉 Summary

The manual power control feature provides users with full control over equipment power through an intuitive dashboard interface. With support for both manual and automatic control modes, the system offers flexibility while maintaining safety through voltage-based protection.

**Key Benefits:**

- ⚡ Remote power control from anywhere
- 🛡️ Voltage-based automatic protection
- 🎮 Easy-to-use dashboard interface
- 📊 Real-time status monitoring
- 🔒 Safe with confirmation dialogs

---

**Status**: ✅ FEATURE COMPLETE
**Date**: January 8, 2026
**Version**: 1.0
**Compatibility**: ESP32 + Spring Boot + React
