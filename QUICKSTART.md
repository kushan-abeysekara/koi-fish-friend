# Quick Start Guide - Koi Fish Friend

## Overview

This guide will help you get your Koi Fish Friend boat system up and running quickly using only the ESP32 board.

---

## What You Need

### Hardware
- ✅ ESP32 Development Board (ZY-ESP32 38-pin)
- ✅ MD0492 Voltage Sensor
- ✅ MPU-6050 Accelerometer/Gyroscope
- ✅ L298N Motor Driver
- ✅ 4x HC-SR04 Ultrasonic Sensors
- ✅ 0.96" OLED Display (SSD1306, I2C)
- ✅ Relay Module
- ✅ 2x 12V DC Motors
- ✅ 12V Battery
- ✅ USB Cable for programming
- ✅ Jumper wires
- ✅ Breadboard (for testing)

### Software
- Arduino IDE (1.8.x or 2.x)
- USB-to-Serial drivers (CP210x or CH340)

---

## Step 1: Install Arduino IDE

1. Download from https://www.arduino.cc/en/software
2. Install on your computer
3. Open Arduino IDE

---

## Step 2: Install ESP32 Board Support

1. Open Arduino IDE
2. Go to **File → Preferences**
3. In "Additional Board Manager URLs", add:
   ```
   https://dl.espressif.com/dl/package_esp32_index.json
   ```
4. Click **OK**
5. Go to **Tools → Board → Boards Manager**
6. Search for **"ESP32"**
7. Install **"esp32" by Espressif Systems**
8. Wait for installation to complete

---

## Step 3: Install Required Libraries

1. Go to **Tools → Manage Libraries** (or Ctrl+Shift+I)
2. Search and install these libraries:

### Required Libraries:
| Library Name | Author | Version |
|--------------|--------|---------|
| MPU6050 | Electronic Cats | Latest |
| Adafruit GFX Library | Adafruit | Latest |
| Adafruit SSD1306 | Adafruit | Latest |

**How to install**:
- Type library name in search box
- Click "Install" button
- Wait for "INSTALLED" confirmation

---

## Step 4: Configure Arduino IDE

1. **Select Board**:
   - Tools → Board → ESP32 Arduino → **ESP32 Dev Module**

2. **Configure Settings**:
   - Upload Speed: **921600**
   - CPU Frequency: **240MHz**
   - Flash Frequency: **80MHz**
   - Flash Mode: **QIO**
   - Flash Size: **4MB (32Mb)**
   - Partition Scheme: **Default**

3. **Select Port**:
   - Connect ESP32 via USB
   - Tools → Port → Select your COM port (e.g., COM3, COM5)

---

## Step 5: Upload Test Code

1. Open **File → Examples → WiFi → WiFiScan**
2. Click **Upload** button (→)
3. Wait for "Done uploading" message
4. Open **Serial Monitor** (Ctrl+Shift+M)
5. Set baud rate to **115200**
6. You should see WiFi networks scanning

✅ **If this works, your ESP32 is ready!**

---

## Step 6: Wire the Hardware

Follow the [WIRING_DIAGRAM.md](WIRING_DIAGRAM.md) to connect all components.

### Quick Connection Checklist:

- [ ] **Power**: 12V battery to L298N and voltage regulator
- [ ] **Ground**: All GND pins connected together
- [ ] **Voltage Sensor**: S pin to GPIO 34
- [ ] **Relay**: IN pin to GPIO 13
- [ ] **MPU-6050**: SDA to GPIO 21, SCL to GPIO 22
- [ ] **OLED Display**: SDA to GPIO 21, SCL to GPIO 22 (shared)
- [ ] **L298N**: IN1-4 to GPIOs 25,26,27,32, ENA/ENB to GPIOs 14,33
- [ ] **Front Ultrasonic**: TRIG to GPIO 18, ECHO to GPIO 19
- [ ] **Back Ultrasonic**: TRIG to GPIO 23, ECHO to GPIO 5
- [ ] **Left Ultrasonic**: TRIG to GPIO 4, ECHO to GPIO 15
- [ ] **Right Ultrasonic**: TRIG to GPIO 2, ECHO to GPIO 12

---

## Step 7: Upload Main Code

1. Open **Kushanesp32.ino** from the project folder
2. Click **Verify** (✓) to compile
   - Check for errors
   - Fix any library issues
3. Click **Upload** (→)
4. Wait for upload to complete

---

## Step 8: Test the System

### 1. Open Serial Monitor
- Click **Serial Monitor** icon (top right)
- Set baud rate to **115200**
- Select **"Both NL & CR"**

### 2. Check Initialization Messages
You should see:
```
Koi Fish Friend - ESP32 Boat Control System
Initializing...
Initializing MPU-6050...
MPU-6050 connection successful!
Initializing OLED Display...
OLED initialized!
Initialization complete!
```

### 3. Verify Sensor Readings
Every 500ms you should see:
```
========== Sensor Readings ==========
Voltage: 12.XX V | Relay: OFF

--- MPU-6050 ---
Accel (m/s²): X=X.XX Y=X.XX Z=X.XX
Gyro (°/s): X=X.XX Y=X.XX Z=X.XX
Angles: X=X.XX° Y=X.XX°
MPU Temp: XX.XX °C

--- Ultrasonic (4 Sensors) ---
Front: XX.X cm | Back: XX.X cm
Left: XX.X cm | Right: XX.X cm

--- Motors ---
Left Speed: 0 | Right Speed: 0
=====================================
```

### 4. Check OLED Display
The OLED should show:
- Title: "Koi Fish Friend"
- Voltage reading
- Tilt angles
- Temperature
- Distance readings
- Motor speeds

---

## Step 9: Test Individual Components

### Test MPU-6050 (Tilt Sensor)
1. Tilt the board left/right
2. Watch "Angles: X=" value change
3. Tilt forward/backward
4. Watch "Angles: Y=" value change

✅ **Working if angles respond to tilt**

### Test Ultrasonic Sensors
1. Place hand 10cm in front of each sensor
2. Watch distance readings change
3. Test all 4 sensors (front, back, left, right)

✅ **Working if distances change from ~300cm to ~10cm**

### Test Motors (REMOVE PROPELLERS FIRST!)
1. The motors should automatically adjust based on tilt
2. Tilt the board - motors should respond
3. Place obstacle near sensor - motors should react

✅ **Working if motors spin when tilted or obstacle detected**

### Test Voltage Sensor
1. Measure battery voltage with multimeter
2. Compare with voltage reading in Serial Monitor
3. Should be within ±0.5V

✅ **Working if readings match multimeter**

### Test Relay
1. Lower battery voltage below 8.6V (or change threshold in code)
2. Relay should click ON
3. Serial Monitor shows "Relay: ON"

✅ **Working if relay clicks and LED lights up**

---

## Step 10: Calibration

### Voltage Sensor Calibration
If voltage reading is incorrect:

1. Measure actual battery voltage with multimeter: **V_actual**
2. Note ESP32 reading: **V_esp32**
3. Calculate correction: `new_ratio = old_ratio * (V_actual / V_esp32)`
4. Update `VOLTAGE_DIVIDER_RATIO` in code (line ~62)
5. Default is 5.0, adjust as needed

### MPU-6050 Calibration (Optional)
MPU-6050 is factory calibrated, but if readings drift:

1. Place board on flat surface
2. Let it sit for 30 seconds
3. Note X and Y angle readings
4. If not near 0°, add offset in `readMPU6050()` function

---

## Troubleshooting

### ❌ "ESP32 not detected"
- Check USB cable (must be data cable, not just power)
- Install CP210x or CH340 drivers
- Try different USB port
- Press BOOT button while uploading

### ❌ "MPU-6050 connection failed"
- Check wiring: SDA→21, SCL→22
- Verify 3.3V power to MPU-6050
- Check I2C address (should be 0x68)
- Try restarting ESP32

### ❌ "SSD1306 allocation failed"
- Check wiring: SDA→21, SCL→22
- Verify OLED is I2C version (not SPI)
- Check I2C address (usually 0x3C)
- Install Adafruit_SSD1306 library

### ❌ "Motors not running"
- Check L298N 12V power connection
- Remove ENA/ENB jumpers on L298N
- Verify motor wiring (OUT1-4)
- Test with multimeter on IN1-IN4 pins

### ❌ "Ultrasonic returns 0"
- Check 5V power to sensor
- Verify TRIG and ECHO wiring
- Ensure no obstacles <2cm from sensor
- Test one sensor at a time

### ❌ "Compilation errors"
- Install all required libraries
- Update Arduino IDE to latest version
- Check ESP32 board support version
- Close and reopen Arduino IDE

---

## Next Steps

### ✅ System Working? Great!

1. **Test Balance Control**:
   - Tilt the system and observe motor response
   - Adjust `BALANCE_ANGLE_THRESHOLD` if needed (line ~64)

2. **Test Obstacle Avoidance**:
   - Place obstacles near sensors
   - Observe motor evasive actions
   - Adjust `OBSTACLE_DISTANCE_CM` if needed (line ~63)

3. **Waterproofing**:
   - Use waterproof enclosure for electronics
   - Seal all cable entry points
   - Test in shallow water first

4. **Optional Features**:
   - Add WiFi connectivity for remote monitoring
   - Implement MQTT for IoT integration
   - Add GPS for location tracking

---

## Safety Reminders

⚠️ **IMPORTANT**:
- Remove propellers during testing
- Keep hands away from moving parts
- Test in shallow, controlled water first
- Monitor battery voltage always
- Use emergency stop mechanism
- Never leave system unattended in water

---

## Support

### Documentation
- [README.md](Kushanesp32/README.md) - Full system documentation
- [WIRING_DIAGRAM.md](WIRING_DIAGRAM.md) - Detailed wiring guide

### Need Help?
- Check Serial Monitor for error messages
- Verify wiring against diagram
- Test components individually
- Check library versions

---

## Quick Reference

### Upload Settings
```
Board: ESP32 Dev Module
Upload Speed: 921600
CPU Frequency: 240MHz
Flash Size: 4MB
Serial Monitor: 115200 baud
```

### Pin Summary
```
Voltage: GPIO 34 (Analog)
Relay: GPIO 13
I2C: GPIO 21 (SDA), 22 (SCL)
Motors: GPIO 25,26,14 (Left), 27,32,33 (Right)
Ultrasonic: Front(18,19), Back(23,5), Left(4,15), Right(2,12)
```

---

**You're now ready to sail!** 🚤

**Date**: December 22, 2025  
**Author**: Koi Fish Friend Team
