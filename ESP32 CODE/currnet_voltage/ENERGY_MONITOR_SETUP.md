# ⚡ Energy Monitor ESP32 - Setup & Troubleshooting Guide

## 📋 Overview

This ESP32 device monitors voltage, current, power consumption, and tracks cumulative energy usage for your pond equipment.

## 🔧 Hardware Setup

### Required Components:

- ESP32 Development Board
- ZMPT101B AC Voltage Sensor Module (connected to GPIO 34)
- ACS712 Current Sensor Module (connected to GPIO 35)
- Relay Module (connected to GPIO 17)
- 20x4 LCD Display with I2C (SDA: GPIO 21, SCL: GPIO 23)

### Wiring:

```
ESP32          Component
------         ---------
GPIO 34   →    ZMPT101B (Voltage Sensor)
GPIO 35   →    ACS712 (Current Sensor)
GPIO 17   →    Relay Module
GPIO 21   →    LCD SDA
GPIO 23   →    LCD SCL
3.3V      →    Sensors VCC
GND       →    Sensors GND
```

## 🌐 Network Configuration

### WiFi Settings (in code):

```cpp
const char *ssid = "kavish99";
const char *password = "kavish99";
```

### MQTT Broker:

```cpp
const char *mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
```

## 🆔 Device Identification

The device auto-generates a unique ID based on its MAC address:

- **Format**: `BM_XXXXXX` (BM = Budget Management)
- **Example**: `BM_A1B2C3`

To find your device ID:

1. Upload code to ESP32
2. Open Serial Monitor (115200 baud)
3. Look for the generated device ID in the startup logs
4. Write it down - you'll need it for assignment

## 🔗 Device Assignment Process

### Step 1: Start the Backend

```bash
cd backend
./mvnw spring-boot:run
```

### Step 2: Start the Frontend

```bash
cd frontend
npm run dev
```

### Step 3: Find Your Device

1. Power on the ESP32
2. Wait for WiFi connection (LCD shows "WiFi Connected!")
3. Wait for MQTT connection (LCD shows "MQTT Connected")
4. Note the device ID from the LCD display

### Step 4: Assign Device to Pond

#### Option A: Using curl command

```bash
curl -X POST "http://localhost:8080/api/sensors/BM_XXXXXX/assign" \
  -H "Content-Type: application/json" \
  -d "{\"pondId\": 1}"
```

#### Option B: Using Frontend

1. Open browser to `http://localhost:5173`
2. Navigate to "Devices" or "Settings" page
3. Find your device in the device list
4. Click "Assign to Pond"
5. Select the pond from dropdown
6. Click "Assign"

### Step 5: Verify Assignment

1. Check LCD display - should show "Pond: 1" (or your pond number)
2. Open Energy Monitor page in frontend
3. Select your pond from dropdown
4. You should see real-time voltage, current, and power data

## 📊 Data Publishing

The ESP32 publishes data on two topics:

### 1. Status Topic (every 5 seconds)

**Topic**: `koi/sensors/BM_XXXXXX/status`

```json
{
  "deviceId": "BM_XXXXXX",
  "deviceType": "BUDGET_MANAGEMENT",
  "status": "online",
  "ipAddress": "192.168.x.x",
  "rssi": -45,
  "energyWh": 1234.5
}
```

### 2. Data Topic (every 3 seconds, only if assigned to pond)

**Topic**: `koi/sensors/BM_XXXXXX/data`

```json
{
  "deviceId": "BM_XXXXXX",
  "pondId": 1,
  "voltage": 230.5,
  "current": 2.3,
  "power": 529.15,
  "energyWh": 1234.5,
  "status": "normal"
}
```

## 🔍 Troubleshooting

### Issue: Device not showing in frontend

**Check:**

1. ✅ ESP32 is powered on
2. ✅ LCD shows "WiFi Connected"
3. ✅ LCD shows "MQTT Connected"
4. ✅ Backend is running on port 8080
5. ✅ Check backend console logs for MQTT messages

**Solution:**

```bash
# Check if backend is receiving MQTT
# Look for logs like:
# "Received MQTT message on topic: koi/sensors/BM_XXXXXX/status"
```

### Issue: No data in Energy Monitor page

**Check:**

1. ✅ Device is assigned to a pond (LCD shows "Pond: X")
2. ✅ Select the correct pond in Energy Monitor dropdown
3. ✅ Check browser console for errors (F12)

**Solution:**

- If device shows "Pond: 0" → Device not assigned, follow assignment steps
- If assigned but no data → Check backend logs for data saving errors

### Issue: Stale or old data

**Check:**

1. ✅ ESP32 LCD is updating every second
2. ✅ Data timestamp in frontend is recent

**Solution:**

- If ESP32 frozen → Power cycle the ESP32
- If backend not receiving → Check MQTT broker connection

### Issue: Incorrect voltage/current readings

**Calibration needed:**

```cpp
// Adjust these values in the code:
float V_calibration = 0.374;      // Adjust for 220V/230V
float I_calibration = 30.0 / 2048.0; // Adjust based on ACS712 model
float currentOffset = 2048.0;      // Zero-point offset
```

**Calibration procedure:**

1. Measure actual voltage with multimeter
2. Compare with ESP32 reading
3. Adjust `V_calibration` = (actual_voltage / displayed_voltage) \* current_calibration
4. Reupload code

## 🔐 Safety Features

### Voltage Protection

- **Safe Range**: 210V - 250V
- **Action**: Relay turns OFF if voltage outside range
- **Protection**: Prevents equipment damage from voltage spikes/drops

### Relay Control

- **Normal operation**: Relay ON (equipment powered)
- **Over/Under voltage**: Relay OFF (equipment protected)
- **GPIO Pin**: 17

## 🎛️ Available Commands

The device listens on: `koi/sensors/BM_XXXXXX/command`

### 1. Assign to Pond

```json
{
  "command": "assign",
  "pondId": 1
}
```

### 2. Unassign from Pond

```json
{
  "command": "unassign"
}
```

### 3. Reset Energy Counter

```json
{
  "command": "reset_energy"
}
```

## 📈 Monitoring Energy Usage

### Frontend Features:

1. **Real-time Metrics**

   - Voltage (V)
   - Current (A)
   - Power (W)
   - Cumulative Energy (Wh)

2. **Cost Calculation**

   - Set your electricity rate (LKR/kWh)
   - Automatic cost calculation based on energy consumed

3. **Historical Analysis**
   - View energy usage over time (1, 6, 12, 24 hours)
   - Average power consumption
   - Total energy consumed in period

## 🔄 Data Flow

```
ESP32 Sensors
    ↓ (reads every 80ms)
ESP32 Processing
    ↓ (publishes every 3s)
MQTT Broker (HiveMQ)
    ↓ (subscribes)
Spring Boot Backend
    ↓ (saves to database)
PostgreSQL Database
    ↓ (queries every 10s)
React Frontend
    ↓ (displays)
User Dashboard
```

## 📝 Important Notes

1. **Pond Assignment Required**: Device MUST be assigned to a pond before data is saved to database
2. **Data Retention**: Only data from last hour is displayed by default to avoid stale data
3. **Update Frequency**: Frontend polls backend every 10 seconds for new data
4. **Energy Counter**: Cumulative energy resets only when explicitly commanded or device restarted

## 🆘 Getting Help

If you encounter issues:

1. Check Serial Monitor output (115200 baud)
2. Check LCD display messages
3. Review backend console logs
4. Check browser console (F12 → Console)
5. Verify device assignment in database

## 📞 Quick Reference Commands

```bash
# Check device status via API
curl http://localhost:8080/api/sensors/BM_XXXXXX

# Get latest energy data for pond
curl http://localhost:8080/api/sensor-data/pond/1/latest/energy

# Assign device to pond
curl -X POST http://localhost:8080/api/sensors/BM_XXXXXX/assign \
  -H "Content-Type: application/json" \
  -d '{"pondId": 1}'

# Reset energy counter
curl -X POST http://localhost:8080/api/sensors/BM_XXXXXX/reset-energy
```

## ✅ System Health Checklist

- [ ] ESP32 powered and LCD displaying data
- [ ] WiFi connected (LCD shows IP address)
- [ ] MQTT connected (backend receiving status messages)
- [ ] Device assigned to pond (LCD shows "Pond: X" where X > 0)
- [ ] Backend running and responding on port 8080
- [ ] Frontend loaded and showing pond selection
- [ ] Real-time data updating in Energy Monitor page
- [ ] Sensors reading reasonable values (V: 200-240, I: 0-30A)

---

**Last Updated**: January 2026
**Device Type**: BUDGET_MANAGEMENT
**Protocol**: MQTT over TCP
