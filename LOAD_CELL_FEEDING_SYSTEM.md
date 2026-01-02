# Load Cell Weight-Based Smart Feeding System

## 🎯 Overview

This system implements an intelligent automatic feeding device with precise weight control using a load cell. The device automatically dispenses a specific amount of feed (in grams) using a NEMA 17 stepper motor, while an ESC-controlled motor distributes the feed. The system monitors the weight in real-time and stops automatically when the target weight is reached.

## 🔧 Hardware Components

### 1. HX711 Load Cell Amplifier
- **Purpose**: Measures the weight of dispensed feed with high precision
- **Connections**:
  - DT (Data): GPIO 39 (Input-only pin)
  - SCK (Clock): GPIO 32
- **Calibration Factor**: -7050.0 (adjustable)
- **Weight Range**: 0-100g (or higher depending on your load cell)

### 2. NEMA 17 Stepper Motor (with A4988 Driver)
- **Purpose**: Rotates to dispense feed from the hopper
- **Connections**:
  - STEP: GPIO 26
  - DIR: GPIO 27
  - RESET+SLEEP: GPIO 12 (shorted together)
- **Steps per Revolution**: 200 (1.8° per step)
- **Speed**: Adjustable via `stepperSpeed` parameter (default: 500µs delay)

### 3. ESC Motor (Electronic Speed Controller)
- **Purpose**: Distributes the dispensed feed across the pond
- **Connection**: GPIO 25 (PWM signal)
- **Control**: 
  - PWM Frequency: 50Hz
  - Pulse Width: 1000-2000µs
  - Speed Range: 0-100%

### 4. Variable Resistor (Potentiometer)
- **Purpose**: Manual control of ESC motor speed
- **Connection**: GPIO 36 (ADC1_0)
- **Type**: 10kΩ (103) variable resistor
- **Reading**: 0-4095 (12-bit ADC) mapped to 0-100%

### 5. OLED Display (SSD1306)
- **Purpose**: Real-time status monitoring
- **Connections**:
  - SDA: GPIO 21
  - SCL: GPIO 22
- **Display Info**:
  - WiFi/MQTT connection status
  - Current weight
  - Target weight
  - ESC speed (actual & pot setting)
  - Feeding status

## 📋 Features

### Weight-Based Automatic Feeding
- Set a target weight in grams (e.g., 100g)
- System automatically:
  1. Tares (zeros) the scale
  2. Starts NEMA 17 motor to dispense feed
  3. Monitors weight via HX711 load cell
  4. Stops motor when target weight is reached
  5. Activates ESC motor to distribute feed

### Scheduled Feeding
- Configure multiple feeding schedules
- Each schedule includes:
  - Time of day (HH:MM format)
  - Amount in grams
  - Pond/Zone identification
  - Enable/Disable status
- Schedules sync from backend to ESP32 device
- Automatic execution at specified times

### Manual Control
- Feed immediately with specific weight
- Adjustable ESC speed via potentiometer
- Manual start/stop capability
- Real-time weight monitoring

### Safety Features
- Automatic timeout (5 minutes max)
- Negative weight prevention
- Motor sleep mode when idle
- Error handling and status reporting

## 🔌 Wiring Diagram

```
ESP32 Pin Connections:
====================

HX711 Load Cell:
  GPIO 39 (Input-only) -----> DT (Data)
  GPIO 32 --------------> SCK (Clock)
  3.3V -----------------> VCC
  GND ------------------> GND

A4988 Stepper Driver:
  GPIO 26 --------------> STEP
  GPIO 27 --------------> DIR
  GPIO 12 --------------> RESET + SLEEP (shorted)
  12V ------------------> VMOT
  GND ------------------> GND
  
  NEMA 17 Connections:
  A4988 1A/1B ---------> Coil A
  A4988 2A/2B ---------> Coil B

ESC Motor:
  GPIO 25 --------------> Signal (Yellow/White)
  GND ------------------> GND (Black/Brown)
  Battery+ -------------> Power (Red)

Variable Resistor (10kΩ):
  GPIO 36 --------------> Wiper (Middle pin)
  3.3V -----------------> One end
  GND ------------------> Other end

OLED Display (I2C):
  GPIO 21 --------------> SDA
  GPIO 22 --------------> SCL
  3.3V -----------------> VCC
  GND ------------------> GND
```

## 💻 Software Architecture

### ESP32 Firmware (Arduino)

**File**: `LoadCellFeeder.ino`

Key Functions:
- `startWeightBasedFeeding(float targetGrams)` - Initiates weight-controlled feeding
- `checkWeightAndControl()` - Monitors weight and stops when target reached
- `readESCSpeedFromPotentiometer()` - Reads pot value for ESC control
- `publishStatus(String event)` - Sends status updates via MQTT

MQTT Topics:
- Command: `koi/devices/feed_device_001/feeding/command`
- Status: `koi/devices/feed_device_001/feeding/status`
- Schedule: `koi/devices/feed_device_001/feeding/schedule`

### Backend API (Spring Boot)

**Controller**: `FeedingController.java`

Endpoints:

1. **Start Feeding** - `POST /api/feeding/start`
   - Parameters:
     - `deviceId` (optional): Device identifier
     - `targetWeight` (optional): Weight in grams
     - `stepperSpeed` (optional): Motor speed (default: 500)
     - `escPercent` (optional): ESC speed percentage
   
   Example:
   ```bash
   POST /api/feeding/start?deviceId=feed_device_001&targetWeight=100&stepperSpeed=500
   ```

2. **Stop Feeding** - `POST /api/feeding/stop`
   - Parameters:
     - `deviceId` (optional): Device identifier
   
   Example:
   ```bash
   POST /api/feeding/stop?deviceId=feed_device_001
   ```

3. **Get Status** - `GET /api/feeding/status`
   - Returns current device status
   
4. **Tare Load Cell** - `POST /api/feeding/tare`
   - Zeros the scale
   
5. **Calibrate Load Cell** - `POST /api/feeding/calibrate`
   - Parameters:
     - `calibrationFactor`: Calibration value
   
6. **Send Schedules** - `POST /api/feeding/schedule`
   - Body: JSON array of schedules
   ```json
   {
     "schedules": [
       {
         "time": "10:00",
         "amount": 100,
         "enabled": true,
         "pondId": "Pond A"
       }
     ]
   }
   ```

### Frontend (React/TypeScript)

**Component**: `FeedingSchedule.tsx`

Features:
- Create/Edit/Delete feeding schedules
- Set feed amount in grams
- Enable/Disable schedules
- Sync schedules to ESP32 device
- Manual "Feed Now" button for immediate feeding
- Real-time status display

## 🚀 Setup Instructions

### 1. Hardware Assembly

1. **Mount Load Cell**:
   - Attach load cell to a stable platform
   - Place a plate on top for feed measurement
   - Connect HX711 amplifier to load cell

2. **Connect NEMA 17**:
   - Wire stepper motor to A4988 driver
   - Connect driver to ESP32
   - Attach motor to feed dispensing mechanism

3. **Setup ESC Motor**:
   - Connect ESC to battery power supply
   - Wire ESC signal to ESP32 GPIO 25
   - Attach motor to feed distribution mechanism

4. **Install Potentiometer**:
   - Wire 10kΩ pot to GPIO 36
   - Use for manual ESC speed control

5. **Connect OLED**:
   - Wire I2C display to ESP32
   - Verify I2C address (usually 0x3C)

### 2. ESP32 Firmware Installation

1. **Install Required Libraries** (Arduino IDE or PlatformIO):
   ```
   - Adafruit GFX Library
   - Adafruit SSD1306
   - HX711 Arduino Library (by Bogdan Necula)
   - PubSubClient
   - ArduinoJson (v6)
   ```

2. **Configure WiFi**:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```

3. **Calibrate Load Cell**:
   - Place known weight on scale
   - Adjust `calibrationFactor` until reading is accurate
   - Default: -7050.0

4. **Upload Firmware**:
   - Open `LoadCellFeeder.ino`
   - Select ESP32 board
   - Upload code

### 3. Backend Setup

1. **Verify Dependencies** in `pom.xml`:
   ```xml
   <dependency>
       <groupId>org.springframework.boot</groupId>
       <artifactId>spring-boot-starter-web</artifactId>
   </dependency>
   ```

2. **Configure MQTT** in `application.properties`:
   ```properties
   mqtt.broker.url=tcp://broker.hivemq.com:1883
   mqtt.client.id=koi-backend
   ```

3. **Build and Run**:
   ```bash
   cd backend
   mvn clean install
   mvn spring-boot:run
   ```

### 4. Frontend Setup

1. **Install Dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Configure API Endpoint** in `src/services/api.ts`:
   ```typescript
   const api = axios.create({
     baseURL: 'http://localhost:8080'
   });
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

## 📖 Usage Guide

### Creating a Feeding Schedule

1. Navigate to **Feeding Schedule** page
2. Click **"Add New Schedule"**
3. Fill in details:
   - **Pond**: Select pond
   - **Time**: Set feeding time (e.g., 10:00)
   - **Feed Amount**: Enter grams (e.g., 100)
   - **Fish Stage**: Select stage
   - **Rule Note**: Add description
4. Click **"Create Schedule"**
5. Click **"Sync to Device"** to send to ESP32

### Manual Feeding

1. Go to **Feeding Schedule** page
2. Find desired schedule
3. Click **green play button** (Feed Now)
4. Confirm the feeding amount
5. System will:
   - Start NEMA 17 motor
   - Monitor weight via load cell
   - Stop at target weight
   - Activate ESC for distribution

### Monitoring Status

- **OLED Display** shows:
  - Current weight
  - Target weight (during feeding)
  - ESC speed
  - Potentiometer value
  - Connection status
  
- **MQTT Status Messages**:
  - `feeding_started` - Feeding initiated
  - `weight_target_reached` - Target achieved
  - `feeding_stopped` - Manually stopped
  - `feeding_timeout` - Safety timeout

### Load Cell Calibration

1. **Tare the Scale**:
   ```bash
   POST /api/feeding/tare?deviceId=feed_device_001
   ```

2. **Calibrate with Known Weight**:
   - Place known weight (e.g., 100g)
   - Adjust calibration factor
   ```bash
   POST /api/feeding/calibrate?deviceId=feed_device_001&calibrationFactor=-7050
   ```

3. **Verify Accuracy**:
   - Check OLED display
   - Test with multiple weights

## 🔍 Troubleshooting

### Load Cell Issues

**Problem**: Incorrect weight readings
- Check wiring (DT and SCK pins)
- Verify calibration factor
- Tare the scale
- Ensure stable mounting

**Problem**: Negative weights
- Adjust calibration factor sign
- Check load cell polarity

### Motor Issues

**Problem**: NEMA 17 not rotating
- Verify A4988 connections
- Check power supply (12V)
- Ensure RESET/SLEEP is HIGH
- Test with manual commands

**Problem**: ESC motor not responding
- Check PWM signal (GPIO 25)
- Verify ESC calibration
- Ensure proper battery voltage
- Test potentiometer reading

### Connectivity Issues

**Problem**: WiFi not connecting
- Verify SSID and password
- Check signal strength
- Restart ESP32

**Problem**: MQTT not working
- Verify broker address
- Check firewall settings
- Monitor Serial output

### Weight Control Issues

**Problem**: Doesn't stop at target weight
- Calibrate load cell
- Check feed flow consistency
- Adjust stepper speed
- Verify weight check interval

## 📊 MQTT Message Formats

### Command Message (Backend → ESP32)
```json
{
  "action": "start",
  "targetWeight": 100,
  "stepperSpeed": 500,
  "escPercent": 35
}
```

### Status Message (ESP32 → Backend)
```json
{
  "deviceId": "feed_device_001",
  "event": "weight_target_reached",
  "timestamp": 123456789,
  "weight": 100.5,
  "targetWeight": 100.0,
  "feedingActive": false,
  "stepperActive": false,
  "escPercent": 35,
  "escPotPercent": 40,
  "totalFeeds": 15,
  "totalGrams": 1500.0,
  "wifiConnected": true,
  "mqttConnected": true
}
```

### Schedule Message (Backend → ESP32)
```json
{
  "schedules": [
    {
      "time": "10:00",
      "amount": 100,
      "enabled": true,
      "pondId": "Pond A"
    },
    {
      "time": "16:00",
      "amount": 150,
      "enabled": true,
      "pondId": "Pond A"
    }
  ]
}
```

## 🎓 Technical Details

### Weight Measurement Process

1. **Initialization**:
   - Load cell tared to zero
   - Calibration factor applied
   
2. **During Feeding**:
   - Weight sampled every 500ms
   - Average of 5 readings for stability
   - Real-time display on OLED
   
3. **Stop Condition**:
   - `currentWeight >= targetWeight`
   - Safety timeout (5 minutes)
   - Manual stop command

### Motor Control

**NEMA 17 Stepper**:
- Pulse generation: `digitalWrite()` on STEP pin
- Delay between steps: `stepperSpeed` microseconds
- Direction: Fixed (set by DIR pin)
- Sleep mode when idle (saves power)

**ESC Motor**:
- PWM signal: 50Hz (20ms period)
- Pulse width: 1000-2000µs
- Controlled by potentiometer or command
- Speed range: 0-100%

### Power Management

- **Idle Mode**: Stepper in sleep, ESC at 0%
- **Feeding Mode**: Full operation
- **Post-Feed**: Return to idle after 2 seconds

## 🔐 Safety Features

1. **Maximum Feed Time**: 5 minutes timeout
2. **Weight Validation**: Prevents negative values
3. **Motor Protection**: Sleep mode when idle
4. **Error Reporting**: Status messages via MQTT
5. **Manual Override**: Stop command always works

## 📝 License

This system is part of the Koi Fish Friend project.

## 🤝 Support

For issues or questions:
1. Check OLED display for error messages
2. Monitor Serial output (115200 baud)
3. Review MQTT status messages
4. Verify hardware connections

---

**Version**: 2.0  
**Last Updated**: 2026-01-02  
**Compatible with**: ESP32, Arduino Core 3.x
