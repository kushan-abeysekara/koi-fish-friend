# Load Cell Feeder - Quick Start Guide

## ⚡ Quick Setup (15 Minutes)

### Prerequisites
- ESP32 Development Board
- HX711 Load Cell Amplifier + Load Cell
- NEMA 17 Stepper Motor + A4988 Driver
- ESC + Brushless Motor
- 10kΩ Variable Resistor (103)
- OLED Display (SSD1306, 128x64)
- 12V Power Supply
- Arduino IDE or PlatformIO

## 🔌 Step 1: Hardware Connections (5 min)

### Minimal Wiring for Testing

```
HX711 → ESP32:
  DT  → GPIO 39
  SCK → GPIO 32
  VCC → 3.3V
  GND → GND

OLED → ESP32:
  SDA → GPIO 21
  SCL → GPIO 22
  VCC → 3.3V
  GND → GND

A4988 → ESP32:
  STEP  → GPIO 26
  DIR   → GPIO 27
  SLEEP → GPIO 12
  (Connect RESET to SLEEP on A4988)

ESC:
  Signal → GPIO 25
  GND    → GND

Potentiometer:
  Wiper  → GPIO 36
  End 1  → 3.3V
  End 2  → GND
```

## 💻 Step 2: Install Software (5 min)

### Option A: Arduino IDE

1. **Install ESP32 Support**:
   - File → Preferences
   - Add URL: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Tools → Board Manager → Install "esp32"

2. **Install Libraries** (Tools → Manage Libraries):
   - Adafruit GFX Library
   - Adafruit SSD1306
   - HX711 Arduino Library (by Bogdan Necula)
   - PubSubClient
   - ArduinoJson (v6)

3. **Open Sketch**:
   - Open `LoadCellFeeder.ino`

### Option B: PlatformIO

1. **Install PlatformIO** (VS Code extension)

2. **Create platformio.ini**:
   ```ini
   [env:esp32dev]
   platform = espressif32
   board = esp32dev
   framework = arduino
   lib_deps = 
       adafruit/Adafruit GFX Library
       adafruit/Adafruit SSD1306
       bogde/HX711
       knolleary/PubSubClient
       bblanchon/ArduinoJson@^6.19.0
   ```

3. **Open Project**: File → Open Folder

## ⚙️ Step 3: Configure & Upload (3 min)

1. **Edit WiFi Credentials** in `LoadCellFeeder.ino`:
   ```cpp
   const char* ssid = "YOUR_WIFI_NAME";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```

2. **Select Board**:
   - Tools → Board → ESP32 Dev Module

3. **Select Port**:
   - Tools → Port → (your COM port)

4. **Upload**:
   - Click Upload button ➡️

## 🎯 Step 4: Test System (2 min)

### Serial Monitor Test

1. Open Serial Monitor (115200 baud)
2. You should see:
   ```
   ESP32 Load Cell Smart Feeder
   Initializing HX711 Load Cell...
   Load Cell Ready!
   WiFi Connected!
   MQTT Connected!
   System Ready!
   ```

### OLED Display Test

Display should show:
```
=SMART FEEDER v2.0=
WiFi:OK MQTT:OK
Weight: 0.0g
ESC: 0% (Pot:0%)
Status: READY
```

### Load Cell Test

1. Place weight on load cell
2. Check OLED display for reading
3. If incorrect, calibrate (see below)

## 🔧 Step 5: Calibration (Optional)

### Load Cell Calibration

1. **Tare the scale** (set to zero):
   ```bash
   curl -X POST "http://localhost:8080/api/feeding/tare?deviceId=feed_device_001"
   ```
   
   Or use Serial Monitor:
   - Send command via MQTT topic

2. **Place known weight** (e.g., 100g)

3. **Adjust calibration factor** in code:
   ```cpp
   float calibrationFactor = -7050.0;  // Adjust this value
   ```
   - If reading is too high, increase the absolute value
   - If reading is too low, decrease the absolute value

4. **Re-upload and test**

## 🚀 Step 6: First Feed Test

### Using Frontend

1. **Start Backend**:
   ```bash
   cd backend
   mvn spring-boot:run
   ```

2. **Start Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Access Dashboard**:
   - Open browser: `http://localhost:5173`
   - Navigate to "Feeding Schedule"

4. **Create Schedule**:
   - Click "Add New Schedule"
   - Time: 10:00
   - Amount: 100 (grams)
   - Pond: Pond A
   - Click "Create Schedule"

5. **Test Immediately**:
   - Click green ▶️ "Feed Now" button
   - Confirm: "Feed 100g now?"
   - Watch system:
     - NEMA 17 starts rotating
     - Weight increases on OLED
     - Stops at 100g
     - ESC distributes feed

### Using API (Alternative)

```bash
# Start feeding 100g
curl -X POST "http://localhost:8080/api/feeding/start?targetWeight=100&deviceId=feed_device_001"

# Check status
curl -X GET "http://localhost:8080/api/feeding/status?deviceId=feed_device_001"

# Stop feeding
curl -X POST "http://localhost:8080/api/feeding/stop?deviceId=feed_device_001"
```

## 📊 Monitoring

### OLED Display

Real-time information:
- WiFi/MQTT status
- Current weight
- Target weight (during feeding)
- ESC speed (% from potentiometer)
- Feeding status

### Serial Monitor

Detailed logging:
```
Current Weight: 23.5g / Target: 100.0g
Current Weight: 47.2g / Target: 100.0g
Current Weight: 78.9g / Target: 100.0g
Current Weight: 100.3g / Target: 100.0g
✓ Target weight reached!
```

### MQTT Messages

Subscribe to status topic:
```bash
mosquitto_sub -h broker.hivemq.com -t "koi/devices/feed_device_001/feeding/status"
```

## ⚠️ Troubleshooting

### Issue: OLED is blank
**Solution**: 
- Check I2C connections (SDA/SCL)
- Verify I2C address (usually 0x3C)
- Try I2C scanner sketch

### Issue: Load cell shows 0.0g always
**Solution**:
- Check HX711 connections
- Verify DT pin (GPIO 39 is input-only)
- Wait for "Load Cell Ready!" message
- Try different calibration factor

### Issue: Stepper motor not rotating
**Solution**:
- Check A4988 connections
- Ensure 12V power supply connected
- Verify RESET/SLEEP pin is HIGH
- Check motor wiring (4 wires)

### Issue: ESC motor not responding
**Solution**:
- Calibrate ESC (hold throttle high, power on, wait for beeps)
- Check signal wire (GPIO 25)
- Verify battery voltage
- Test potentiometer reading

### Issue: WiFi not connecting
**Solution**:
- Double-check SSID and password
- Ensure 2.4GHz network (not 5GHz)
- Move closer to router
- Check Serial Monitor for error messages

### Issue: Weight doesn't stop at target
**Solution**:
- Calibrate load cell properly
- Adjust `weightCheckInterval` (default 500ms)
- Reduce stepper speed for better control
- Ensure stable load cell mounting

## 📝 Default Values

```cpp
// WiFi
SSID: "YOUR_WIFI_NAME"
Password: "YOUR_WIFI_PASSWORD"

// MQTT
Broker: broker.hivemq.com
Port: 1883
Device ID: feed_device_001

// Calibration
Load Cell Factor: -7050.0

// Motors
Stepper Speed: 500 (microseconds)
ESC Range: 0-100%

// Safety
Max Feed Time: 5 minutes
Weight Check: Every 500ms
```

## 🎓 Next Steps

1. **Fine-tune calibration** for accurate weight measurement
2. **Adjust motor speeds** for optimal feed dispensing
3. **Create feeding schedules** in the dashboard
4. **Set up automatic scheduling** with time sync (NTP)
5. **Monitor statistics** (total feeds, grams dispensed)

## 📚 Additional Resources

- Full Documentation: `LOAD_CELL_FEEDING_SYSTEM.md`
- Library Guide: `LOADCELL_LIBRARY_DEPENDENCIES.md`
- Wiring Diagram: See main documentation
- API Reference: See backend documentation

## 🆘 Getting Help

1. **Check Serial Monitor** (115200 baud) for error messages
2. **Watch OLED Display** for status information
3. **Monitor MQTT messages** for system events
4. **Verify hardware connections** with multimeter
5. **Test components individually** before full integration

## ✅ Success Checklist

- [ ] ESP32 connects to WiFi
- [ ] MQTT connection established
- [ ] OLED displays information
- [ ] Load cell reads weight accurately
- [ ] NEMA 17 rotates when commanded
- [ ] ESC motor responds to potentiometer
- [ ] System stops at target weight
- [ ] Frontend can send commands
- [ ] Schedules sync to device

---

**Congratulations! Your Load Cell Smart Feeder is ready!** 🎉

For advanced features and customization, refer to the full documentation.

**Estimated Total Setup Time**: 15 minutes  
**Difficulty Level**: Intermediate  
**Support**: Check documentation or create an issue
