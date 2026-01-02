# ESP32 Feeding System with MQTT Control

## Overview
This system provides remote control of the fish feeding system via MQTT, allowing the frontend dashboard to start/stop feeding operations.

## Features
- **WiFi Connectivity**: Connects to "Dulshan Dialog 4G 643"
- **MQTT Communication**: Uses HiveMQ public broker for command and status messages
- **Motor Control**:
  - NEMA 17 Stepper Motor: Runs continuously at speed 500 (microseconds delay)
  - ESC Motor: Smoothly ramps from 10% to 45% over 8 seconds
- **Sleep Mode**: Motors go to sleep when not in use to save power
- **Real-time Display**: OLED shows WiFi, MQTT, and motor status

## MQTT Topics
- **Command**: `koi/devices/feed_device_001/feeding/command`
- **Status**: `koi/devices/feed_device_001/feeding/status`

## Command Format (JSON)
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

To stop feeding:
```json
{
  "command": "feeding",
  "data": {
    "action": "stop"
  }
}
```

## Required Libraries
Install these libraries in Arduino IDE:
1. **Adafruit GFX Library** (by Adafruit)
2. **Adafruit SSD1306** (by Adafruit)
3. **HX711 Arduino Library** (by Bogdan Necula)
4. **PubSubClient** (by Nick O'Leary)
5. **ArduinoJson** (by Benoit Blanchon) - Version 6.x

## Installation Steps

### 1. Install Arduino IDE and ESP32 Support
1. Download and install Arduino IDE from https://www.arduino.cc/en/software
2. Add ESP32 board support:
   - Go to File → Preferences
   - Add this URL to "Additional Board Manager URLs":
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Go to Tools → Board → Boards Manager
   - Search for "ESP32" and install "ESP32 by Espressif Systems"

### 2. Install Required Libraries
In Arduino IDE:
1. Go to Sketch → Include Library → Manage Libraries
2. Search and install each library listed above

### 3. Configure and Upload
1. Open `Kushanesp32feedcode_MQTT.ino` in Arduino IDE
2. Select your ESP32 board: Tools → Board → ESP32 Arduino → ESP32 Dev Module
3. Select the COM port: Tools → Port → (your ESP32 port)
4. Click Upload button

### 4. WiFi Credentials
The code is already configured with:
- **SSID**: "Dulshan Dialog 4G 643"
- **Password**: "Chuki000"

To change WiFi credentials, edit these lines:
```cpp
const char* ssid = "Your_WiFi_Name";
const char* password = "Your_WiFi_Password";
```

## How It Works

### Start Feeding
1. User clicks "Start Feeding" button in dashboard (http://localhost:5173/dashboard/feeding-dashboard)
2. Frontend sends POST request to backend `/api/feeding/start`
3. Backend publishes MQTT command to `koi/devices/feed_device_001/feeding/command`
4. ESP32 receives command and:
   - Wakes up NEMA 17 stepper motor (resetSleepPin = HIGH)
   - Starts continuous rotation at speed 500
   - Starts ESC at 10%
   - Ramps ESC to 45% over 8 seconds
   - Maintains 45% speed

### Stop Feeding
1. User clicks "Stop Feed" button in dashboard
2. Frontend sends POST request to backend `/api/feeding/stop`
3. Backend publishes MQTT stop command
4. ESP32 receives command and:
   - Stops stepper motor rotation
   - Sets ESC to 0%
   - Puts NEMA 17 to sleep (resetSleepPin = LOW)

## Wiring Diagram
Refer to the original wiring diagram in the project. Key connections:
- **Stepper Motor (A4988)**:
  - STEP → GPIO 26
  - DIR → GPIO 27
  - RESET+SLEEP → GPIO 12 (shorted together)
  
- **ESC Motor**:
  - Signal → GPIO 25

- **OLED Display**:
  - SDA → GPIO 21
  - SCL → GPIO 22

- **HX711 Load Cell**:
  - DT → GPIO 39
  - SCK → GPIO 16

## Troubleshooting

### WiFi Not Connecting
- Check SSID and password are correct
- Ensure ESP32 is within range of WiFi router
- Check serial monitor for connection status

### MQTT Not Connecting
- Ensure WiFi is connected first
- Check internet connectivity
- HiveMQ public broker might be down (try again later)

### Motors Not Running
- Check wiring connections
- Verify power supply to motors
- Check serial monitor for error messages
- Ensure feeding command is being received (check serial output)

### Display Not Working
- Check I2C connections (SDA/SCL)
- Verify display address is 0x3C
- Try scanning I2C bus with I2C scanner sketch

## Serial Monitor Output
To see system status and debug information:
1. Open Serial Monitor (Tools → Serial Monitor)
2. Set baud rate to 115200
3. You should see:
   - System initialization
   - WiFi connection status
   - MQTT connection status
   - Incoming commands
   - Motor status updates

## Backend API Endpoints
The backend provides these endpoints:
- **POST** `/api/feeding/start` - Start feeding operation
- **POST** `/api/feeding/stop` - Stop feeding operation
- **GET** `/api/feeding/status` - Get device status

## Notes
- NEMA 17 motor sleep mode saves power when not feeding
- ESC smooth ramp prevents sudden motor startup stress
- System automatically reconnects to WiFi and MQTT if connection drops
- Feed count is tracked and displayed on OLED
