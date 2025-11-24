# Quick Start Guide - ESP32 Boat Control System

## Prerequisites

Before you begin, ensure you have:

- ✅ ZY-ESP32 WIFI BT 38 PIN BOARD
- ✅ All sensors and modules (see components list)
- ✅ Arduino IDE installed
- ✅ USB cable for ESP32
- ✅ 12V battery for motors
- ✅ Jumper wires
- ✅ Computer with Windows/Mac/Linux

---

## Step 1: Install Arduino IDE (5 minutes)

1. Download Arduino IDE from: https://www.arduino.cc/en/software
2. Install Arduino IDE 1.8.19+ or 2.x
3. Open Arduino IDE

---

## Step 2: Install ESP32 Board Support (5 minutes)

1. Open Arduino IDE
2. Go to **File → Preferences**
3. In "Additional Board Manager URLs", paste:
   ```
   https://dl.espressif.com/dl/package_esp32_index.json
   ```
4. Click **OK**
5. Go to **Tools → Board → Boards Manager**
6. Search for "ESP32"
7. Install **"esp32" by Espressif Systems**
8. Wait for installation to complete

---

## Step 3: Install Required Libraries (5 minutes)

1. Go to **Sketch → Include Library → Manage Libraries**
2. Search and install each library:

### Library 1: HX711
- Search: `HX711`
- Install: **HX711 by Bogdan Necula**

### Library 2: MPU6050
- Search: `MPU6050`
- Install: **MPU6050 by Electronic Cats**

### Library 3: RTClib
- Search: `RTClib`
- Install: **RTClib by Adafruit**

### Library 4: Adafruit GFX (For OLED)
- Search: `Adafruit GFX`
- Install: **Adafruit GFX Library by Adafruit**

### Library 5: Adafruit SSD1306 (For OLED)
- Search: `Adafruit SSD1306`
- Install: **Adafruit SSD1306 by Adafruit**

3. Close Library Manager

**Note**: OLED libraries are optional for initial testing

---

## Step 4: Hardware Connections (30 minutes)

### Important: Common Ground!
Connect all GND pins together (ESP32, sensors, battery, motor driver).

### Quick Connection Checklist:

#### Power
- [ ] 12V Battery → L298N 12V input
- [ ] 5V Regulator → ESP32 VIN (or use USB)
- [ ] ESP32 3.3V → Sensor modules VCC

#### I2C Bus (Shared)
- [ ] ESP32 GPIO 21 → MPU-6050 SDA + DS3231 SDA
- [ ] ESP32 GPIO 22 → MPU-6050 SCL + DS3231 SCL

#### Analog Sensors
- [ ] ESP32 GPIO 34 → Voltage Sensor OUT
- [ ] ESP32 GPIO 35 → LDR OUT

#### Digital Sensors
- [ ] ESP32 GPIO 13 → Relay IN
- [ ] ESP32 GPIO 16 → HX711 DT
- [ ] ESP32 GPIO 17 → HX711 SCK
- [ ] ESP32 GPIO 18 → Front Ultrasonic TRIG
- [ ] ESP32 GPIO 19 → Front Ultrasonic ECHO
- [ ] ESP32 GPIO 23 → Back Ultrasonic TRIG
- [ ] ESP32 GPIO 0 → Back Ultrasonic ECHO (GPIO 5 not available)
- [ ] ESP32 GPIO 4 → Left Ultrasonic TRIG
- [ ] ESP32 GPIO 15 → Left Ultrasonic ECHO
- [ ] ESP32 GPIO 2 → Right Ultrasonic TRIG
- [ ] ESP32 GPIO 12 → Right Ultrasonic ECHO

#### Motor Driver (L298N)
- [ ] ESP32 GPIO 25 → L298N IN1 (Left Motor)
- [ ] ESP32 GPIO 26 → L298N IN2 (Left Motor)
- [ ] ESP32 GPIO 14 → L298N ENA (Left Motor PWM)
- [ ] ESP32 GPIO 27 → L298N IN3 (Right Motor)
- [ ] ESP32 GPIO 32 → L298N IN4 (Right Motor)
- [ ] ESP32 GPIO 33 → L298N ENB (Right Motor PWM)

#### OLED Display (SPI)
- [ ] ESP32 GPIO 3 → OLED MOSI (D1)
- [ ] ESP32 GPIO 1 → OLED CLK (D0)
- [ ] ESP32 GPIO 36 → OLED DC
- [ ] ESP32 GPIO 39 → OLED CS
- [ ] OLED VCC → 3.3V, GND → GND

#### Fish Feeding System
- [ ] ESP32 GPIO 9 → ESC Signal (A2212 Motor)
- [ ] ESP32 GPIO 10 → A4988 STEP
- [ ] ESP32 GPIO 11 → A4988 DIR
- [ ] ESP32 GPIO 8 → A4988 EN
- [ ] ESC: Red→12V, Black→GND, Signal→GPIO 9
- [ ] A4988: VMOT→12V, GND→GND

**Full details**: See `WIRING_DIAGRAM.md`

---

## Step 5: Upload Code (5 minutes)

1. Open `Kushanesp32.ino` in Arduino IDE
2. Configure board settings:
   - **Tools → Board → ESP32 Arduino → ESP32 Dev Module**
   - **Tools → Upload Speed → 921600**
   - **Tools → CPU Frequency → 240MHz**
   - **Tools → Flash Frequency → 80MHz**
   - **Tools → Flash Size → 4MB**
   
3. Connect ESP32 to computer via USB
4. **Tools → Port** → Select COM port (Windows) or /dev/ttyUSB0 (Linux) or /dev/cu.* (Mac)
5. Click **Upload** button (→)
6. Wait for "Done uploading" message

---

## Step 6: Test & Monitor (10 minutes)

1. Open **Serial Monitor** (Tools → Serial Monitor)
2. Set baud rate to **115200**
3. Press **Reset** button on ESP32
4. You should see:
   ```
   Koi Fish Friend - ESP32 Boat Control System
   Initializing...
   Initializing HX711...
   HX711 initialized!
   Initializing MPU-6050...
   MPU-6050 connection successful!
   Initializing DS3231 RTC...
   RTC initialized!
   Initialization complete!
   ```

---

## Step 7: Calibrate Sensors (20 minutes)

### 7.1 Calibrate HX711 Load Cell

1. Remove all weight from load cell
2. The scale will auto-tare on startup
3. Place a known weight (e.g., 1.00 kg)
4. Check reading in Serial Monitor
5. If incorrect, adjust `CALIBRATION_FACTOR` in code
6. See `CALIBRATION_GUIDE.md` for detailed steps

### 7.2 Adjust LDR Threshold (Optional)

1. Note LDR value during daytime
2. Note LDR value during nighttime
3. Adjust `LDR_DAY_THRESHOLD` between these values

### 7.3 Test Voltage Sensor

1. Measure battery voltage with multimeter
2. Compare with sensor reading
3. Adjust `VOLTAGE_DIVIDER_RATIO` if needed

---

## Step 8: Test Individual Components

### Test 1: Motors (No Propellers!)
1. Remove propellers for safety
2. Motors should respond to tilt
3. Check both motors spin correctly

### Test 2: Ultrasonic Sensors (4 Units)
1. Place hand in front of each sensor
2. Check distance readings in Serial Monitor
3. Verify all 4 sensors: Front, Back, Left, Right
4. Ensure 360° coverage is working

### Test 3: MPU-6050
1. Tilt the board
2. Check angle readings change
3. Verify X and Y axis values

### Test 4: RTC
1. Check date/time in Serial Monitor
2. Verify temperature reading
3. Adjust time if needed (see code comments)

### Test 5: Relay
1. Reduce voltage below 8.6V (or change threshold temporarily)
2. Relay should click ON
3. Increase voltage above 8.6V
4. Relay should click OFF

---

## Expected Serial Output

Every second you should see:

```
========== Sensor Readings ==========
Voltage: 12.45 V | Relay: OFF
Weight: 1.12 kg
Light: 3500 | DAY

--- MPU-6050 ---
Accel (m/s²): X=0.05 Y=0.12 Z=9.78
Gyro (°/s): X=0.23 Y=-0.15 Z=0.08
Angles: X=1.25° Y=-0.89°
MPU Temp: 28.50 °C

--- Ultrasonic (4 Sensors) ---
Front: 52.3 cm | Back: 78.9 cm
Left: 45.2 cm | Right: 38.7 cm

--- Motors ---
Left Speed: 0 | Right Speed: 0

========== RTC Information ==========
Date: 2025/11/24
Time: 14:35:22
RTC Temperature: 27.25 °C
=====================================
```

---

## Troubleshooting

### ESP32 Not Detected
- **Solution**: Install CP210x or CH340 USB driver
- **Windows**: Check Device Manager for COM port
- **Mac**: Check /dev/cu.* ports
- **Linux**: Add user to dialout group: `sudo usermod -a -G dialout $USER`

### Compilation Errors
- **Solution**: Verify all libraries are installed
- Check: Sketch → Include Library → check for HX711, MPU6050, RTClib

### MPU-6050 Connection Failed
- **Solution**: Check I2C wiring (SDA to GPIO 21, SCL to GPIO 22)
- Verify 3.3V power
- Try I2C scanner sketch

### HX711 Not Ready
- **Solution**: Check wiring (DT to GPIO 16, SCK to GPIO 17)
- Verify load cell connections (Red, Black, White, Green)

### RTC Not Found
- **Solution**: Check I2C wiring (same bus as MPU-6050)
- Ensure RTC has backup battery installed

### Motors Not Running
- **Solution**: 
  - Verify 12V power to L298N
  - Check all 6 motor control pins
  - Remove 5V jumper on L298N if ESP32 has separate power
  - Test with manual motor control code

### Wrong Sensor Readings
- **Solution**: Run calibration procedures
- Check voltage dividers
- Verify analog pin connections

---

## Safety Reminders

⚠️ **Before Water Testing:**

1. ✅ Waterproof all electronics
2. ✅ Seal cable entries
3. ✅ Test in bathtub first
4. ✅ Have emergency shut-off
5. ✅ Remove propellers until tested
6. ✅ Monitor battery voltage
7. ✅ Stay within safe distance

---

## Next Steps

1. ✅ Complete all tests
2. ✅ Calibrate all sensors
3. ✅ Install in waterproof enclosure
4. ✅ Attach propellers
5. ✅ Test in controlled environment
6. ✅ Fine-tune balance control
7. ✅ Deploy in open water

---

## Useful Commands

### Upload Code
```
Ctrl + U (Windows/Linux)
Cmd + U (Mac)
```

### Open Serial Monitor
```
Ctrl + Shift + M (Windows/Linux)
Cmd + Shift + M (Mac)
```

### Verify Code
```
Ctrl + R (Windows/Linux)
Cmd + R (Mac)
```

---

## Documentation Quick Links

- **Complete Wiring**: `WIRING_DIAGRAM.md`
- **Calibration**: `CALIBRATION_GUIDE.md`
- **Libraries**: `LIBRARY_DEPENDENCIES.md`
- **Full Documentation**: `README.md`

---

## Support

If you encounter issues:

1. Check wiring against diagram
2. Verify library installation
3. Read troubleshooting section
4. Check Serial Monitor for error messages
5. Review component datasheets

---

## Development Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Hardware Assembly | 30 min | ⬜ Not Started |
| Software Setup | 15 min | ⬜ Not Started |
| Code Upload | 5 min | ⬜ Not Started |
| Component Testing | 20 min | ⬜ Not Started |
| Calibration | 20 min | ⬜ Not Started |
| Integration Testing | 30 min | ⬜ Not Started |
| Water Testing | 1 hour | ⬜ Not Started |

**Total Time**: ~2.5 hours

---

## Checklist Summary

**Software Setup**
- [ ] Arduino IDE installed
- [ ] ESP32 board support installed
- [ ] All 3 libraries installed
- [ ] Code uploaded successfully

**Hardware Setup**
- [ ] All power connections complete
- [ ] All sensor connections complete
- [ ] Motor driver connected
- [ ] Common ground verified

**Testing**
- [ ] Serial Monitor shows data
- [ ] All sensors reading correctly
- [ ] Motors respond to commands
- [ ] Calibration complete

**Ready for Deployment**
- [ ] Waterproofing complete
- [ ] Battery fully charged
- [ ] Emergency stop functional
- [ ] Safety checks passed

---

**You're ready to go! 🚤**

**Good luck with your Koi Fish Friend boat!**

---

**Version:** 1.0  
**Date:** November 24, 2025  
**Author:** Koi Fish Friend Team
