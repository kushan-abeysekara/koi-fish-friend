# Feeding Dashboard MQTT Integration - Implementation Summary

## Overview
Successfully implemented MQTT-based remote control for the fish feeding system, allowing real-time control from the web dashboard at `http://localhost:5173/dashboard/feeding-dashboard`.

## Changes Made

### 1. Backend Changes

#### New File: `FeedingController.java`
**Location**: `backend/src/main/java/com/example/backend/controller/FeedingController.java`

**Endpoints Created**:
- `POST /api/feeding/start` - Start feeding operation
  - Parameters: `deviceId` (optional, defaults to "feed_device_001")
  - Sends MQTT command to start motors with specified parameters
  
- `POST /api/feeding/stop` - Stop feeding operation
  - Parameters: `deviceId` (optional, defaults to "feed_device_001")
  - Sends MQTT command to stop all motors and enable sleep mode
  
- `GET /api/feeding/status` - Request device status
  - Parameters: `deviceId` (optional, defaults to "feed_device_001")
  - Requests current status from feeding device

**MQTT Command Format**:
```json
{
  "command": "feeding",
  "data": {
    "action": "start",
    "stepperSpeed": 500,
    "escStartPercent": 10,
    "escTargetPercent": 45,
    "escRampTimeSeconds": 8
  }
}
```

#### Updated: `MqttConfig.java`
**Location**: `backend/src/main/java/com/example/backend/config/MqttConfig.java`

**Change**: Added subscription to feeding device status topic
```java
private static final String[] TOPICS = { 
    "koi/sensors/+/data", 
    "koi/sensors/+/status",
    "koi/devices/+/feeding/status"  // New: feeding device status
};
```

### 2. Frontend Changes

#### Updated: `FeedingDashboard.tsx`
**Location**: `frontend/src/components/FeedingDashboard.tsx`

**Key Changes**:
1. **Added MQTT Integration**: 
   - Imported `api` service for backend communication
   - Added `deviceId` state variable

2. **Updated `handleStartFeeding` Function**:
   - Now makes API call to `/api/feeding/start`
   - Sends MQTT command through backend
   - Shows success/error alerts
   - Motors start:
     - NEMA 17: Continuous rotation at speed 500
     - ESC: Ramps from 10% to 45% over 8 seconds

3. **Updated `handleStopFeeding` Function**:
   - Now makes API call to `/api/feeding/stop`
   - Sends MQTT command to stop motors
   - Motors enter sleep mode
   - Updates last feeding time

4. **Updated `handleEmergencyStop` Function**:
   - Emergency stop with immediate MQTT command
   - All motors stop immediately
   - NEMA 17 goes to sleep mode

### 3. ESP32 Firmware

#### New File: `Kushanesp32feedcode_MQTT.ino`
**Location**: `Kushanesp32feedcode/Kushanesp32feedcode_MQTT.ino`

**Key Features**:
1. **WiFi Configuration**:
   - SSID: "Dulshan Dialog 4G 643"
   - Password: "Chuki000"
   - Auto-reconnect on disconnection

2. **MQTT Configuration**:
   - Broker: broker.hivemq.com:1883 (public HiveMQ broker)
   - Device ID: feed_device_001
   - Command Topic: `koi/devices/feed_device_001/feeding/command`
   - Status Topic: `koi/devices/feed_device_001/feeding/status`

3. **Motor Control**:
   - **NEMA 17 Stepper Motor**:
     - Speed 500 (microseconds delay between steps)
     - Continuous rotation when feeding
     - Sleep mode when idle (resetSleepPin = LOW)
     - Wake mode when active (resetSleepPin = HIGH)
   
   - **ESC Motor**:
     - Smooth ramp from 10% to 45% over 8 seconds
     - Maintains 45% during feeding
     - Returns to 0% when stopped

4. **OLED Display**:
   - Shows WiFi connection status
   - Shows MQTT connection status
   - Shows current ESC percentage
   - Shows stepper status (RPM or SLEEP)
   - Shows feeding status (FEEDING or READY)
   - Shows feed count

5. **Non-blocking Operation**:
   - Stepper runs continuously without blocking
   - ESC ramps smoothly in background
   - OLED updates every 200ms

#### Documentation: `MQTT_SETUP_README.md`
**Location**: `Kushanesp32feedcode/MQTT_SETUP_README.md`

Complete setup guide including:
- Required libraries (with exact names)
- Installation instructions
- Wiring diagram reference
- Troubleshooting guide
- MQTT command format
- Serial monitor debugging

## How It Works

### Workflow: Start Feeding

1. **User Action**: User clicks "Start Feeding" button in dashboard
2. **Frontend**: Sends POST request to `http://localhost:8080/api/feeding/start`
3. **Backend**: 
   - Receives request
   - Creates MQTT command JSON
   - Publishes to `koi/devices/feed_device_001/feeding/command`
4. **ESP32**:
   - Receives MQTT command
   - Wakes up NEMA 17 (resetSleepPin = HIGH)
   - Starts continuous stepper rotation at speed 500
   - Starts ESC at 10%
   - Ramps ESC to 45% over 8 seconds
   - Maintains 45% until stop command
   - Publishes status to `koi/devices/feed_device_001/feeding/status`
5. **Display**: OLED shows motors running, ESC percentage updating

### Workflow: Stop Feeding

1. **User Action**: User clicks "Stop Feed" button
2. **Frontend**: Sends POST request to `http://localhost:8080/api/feeding/stop`
3. **Backend**: Publishes MQTT stop command
4. **ESP32**:
   - Receives stop command
   - Stops stepper rotation
   - Sets ESC to 0%
   - Puts NEMA 17 to sleep (resetSleepPin = LOW)
   - Publishes status
5. **Display**: OLED shows "SLEEP" for stepper, "0%" for ESC

## Power Saving Features

1. **NEMA 17 Sleep Mode**:
   - When not feeding, resetSleepPin is set LOW
   - Driver enters sleep mode, reducing power consumption
   - Motor stays cool and saves energy
   - Instantly wakes when needed (10ms delay)

2. **ESC Zero Throttle**:
   - When not feeding, ESC is set to 0%
   - Motor doesn't consume power
   - No unnecessary spinning

## Testing Steps

### 1. Upload ESP32 Firmware
```bash
# Arduino IDE
1. Open Kushanesp32feedcode_MQTT.ino
2. Install required libraries (see MQTT_SETUP_README.md)
3. Select ESP32 Dev Module board
4. Select correct COM port
5. Upload
6. Open Serial Monitor (115200 baud)
7. Verify WiFi and MQTT connection
```

### 2. Start Backend
```bash
cd D:\GITHUB\koi-fish-friend\backend
mvn spring-boot:run
```

### 3. Start Frontend
```bash
cd D:\GITHUB\koi-fish-friend\frontend
npm run dev
```

### 4. Test Feeding Control
1. Open browser: `http://localhost:5173/dashboard/feeding-dashboard`
2. Click "Start Feeding" button
3. Observe:
   - Backend console: MQTT command sent
   - ESP32 Serial Monitor: Command received, motors starting
   - OLED Display: Status changes to "FEEDING"
   - Motors: NEMA 17 spinning, ESC ramping up
4. Click "Stop Feeding" button
5. Observe:
   - Motors stop
   - OLED shows "SLEEP" and "0%"

## Required Libraries for ESP32

Install via Arduino IDE Library Manager:
1. **Adafruit GFX Library** (by Adafruit)
2. **Adafruit SSD1306** (by Adafruit)
3. **HX711 Arduino Library** (by Bogdan Necula)
4. **PubSubClient** (by Nick O'Leary)
5. **ArduinoJson** (by Benoit Blanchon) - Version 6.x

## MQTT Topics Structure

```
koi/
├── devices/
│   └── feed_device_001/
│       └── feeding/
│           ├── command    (subscribe) - Receives commands from backend
│           └── status     (publish)   - Sends status to backend
└── sensors/
    └── [deviceId]/
        ├── data
        └── status
```

## Configuration Summary

| Component | Setting | Value |
|-----------|---------|-------|
| WiFi SSID | - | "Dulshan Dialog 4G 643" |
| WiFi Password | - | "Chuki000" |
| MQTT Broker | - | broker.hivemq.com |
| MQTT Port | - | 1883 |
| Device ID | - | feed_device_001 |
| Stepper Speed | microseconds delay | 500 |
| ESC Start | percentage | 10% |
| ESC Target | percentage | 45% |
| ESC Ramp Time | seconds | 8 |

## Motor Specifications

### NEMA 17 Stepper Motor
- Steps per revolution: 200
- Step delay: 500 microseconds
- Direction: Clockwise (HIGH)
- Sleep pin: GPIO 12
- Active: resetSleepPin = HIGH
- Sleep: resetSleepPin = LOW

### ESC Motor
- PWM Frequency: 50 Hz
- Min pulse: 1000 μs (0% throttle)
- Max pulse: 2000 μs (100% throttle)
- Start speed: 10%
- Target speed: 45%
- Ramp duration: 8 seconds

## Benefits of This Implementation

1. **Remote Control**: Control feeding from anywhere via web dashboard
2. **Smooth Operation**: ESC ramps smoothly, preventing motor stress
3. **Power Efficient**: Motors sleep when not in use
4. **Real-time Status**: OLED display shows live system status
5. **Reliable**: Auto-reconnect for WiFi and MQTT
6. **Scalable**: Easy to add more feeding devices
7. **Safe**: Emergency stop feature for immediate halt
8. **Monitored**: Backend receives status updates from device

## Future Enhancements (Optional)

1. Add scheduling for automatic feeding times
2. Implement feed weight monitoring during operation
3. Add multiple device support for different ponds
4. Create feeding history logs
5. Add mobile app support
6. Implement OTA (Over-The-Air) firmware updates

## Troubleshooting

### Motors don't respond
- Check WiFi connection (OLED display)
- Check MQTT connection (OLED display)
- Verify backend is running
- Check Serial Monitor for errors
- Verify wiring connections

### ESC doesn't ramp smoothly
- Check ESC calibration
- Verify power supply voltage
- Check ESC signal wire connection
- Ensure proper ESC initialization in setup()

### NEMA 17 doesn't wake from sleep
- Check resetSleepPin connection (GPIO 12)
- Verify A4988 driver power
- Check wiring to RESET and SLEEP pins (should be shorted together)

## Success Indicators

✅ OLED shows "WiFi: OK"  
✅ OLED shows "MQTT: OK"  
✅ Backend logs show MQTT command sent  
✅ ESP32 Serial Monitor shows command received  
✅ Motors start when "Start Feeding" clicked  
✅ ESC ramps from 10% to 45% over 8 seconds  
✅ NEMA 17 rotates continuously at speed 500  
✅ Motors stop when "Stop Feeding" clicked  
✅ OLED shows "SLEEP" when motors idle  

## Files Modified/Created

### Created:
1. `backend/src/main/java/com/example/backend/controller/FeedingController.java`
2. `Kushanesp32feedcode/Kushanesp32feedcode_MQTT.ino`
3. `Kushanesp32feedcode/MQTT_SETUP_README.md`
4. This summary document

### Modified:
1. `backend/src/main/java/com/example/backend/config/MqttConfig.java`
2. `frontend/src/components/FeedingDashboard.tsx`

All changes are focused on the feeding dashboard functionality as requested!
