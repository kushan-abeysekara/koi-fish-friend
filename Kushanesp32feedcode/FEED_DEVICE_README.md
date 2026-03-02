# Koi Fish Friend - Feed Device System

## Overview

This is the automatic feeding system for the Koi Fish Friend project. It uses an ESP32 board with multiple sensors and actuators for precise, monitored feeding operations. The system features load cell weight monitoring, day/night detection, and dual motor control for accurate food dispensing.

## Hardware Components

### Main Board
- **ZY-ESP32 WIFI BT 38 PIN BOARD**
  - WiFi & Bluetooth enabled
  - 38 GPIO pins
  - Dual-core processor
  - ADC1 pins for WiFi-safe analog reading

### Display
- **OLED 0.96" SSD1306 (I2C Mode - 4-pin)**
  - 128x64 pixel resolution
  - I2C interface (address 0x3C or 0x3D)
  - Low power consumption
  - Real-time status display
  - Shows weight, light level, feed count

### Weight Sensors
- **3× HX711 Load Cell Amplifiers** (for 5 load cells total)
  - 24-bit ADC precision
  - Monitor food container weight
  - Low food level detection
  - Individual and total weight display
  - Powered at 3.3V for ESP32 compatibility

### Light Sensor
- **LDR Module (Day/Night Detection)**
  - Detects ambient light level
  - Automatic day/night mode switching
  - Connected to ADC1 (WiFi-safe)
  - Adjustable threshold

### Actuators
- **HW-134A Stepper Driver + US-17HA4401S Motor**
  - Precise 30° rotation control
  - 200 steps/revolution (1.8° step angle)
  - 16× microstepping support
  - Controls feed gate position
  
- **ESC 40A + A2212 1400KV Brushless Motor**
  - Variable speed food dispensing
  - 50Hz servo-style PWM control
  - 0-100% speed control
  - External power supply required

## Pin Configuration

### OLED Display (I2C - 4-pin)
| OLED Pin | ESP32 Pin | Description |
|----------|-----------|-------------|
| VCC      | 3.3V      | Power supply (or 5V if module supports) |
| GND      | GND       | Ground |
| SDA      | GPIO 21   | I2C Data line |
| SCL      | GPIO 22   | I2C Clock line |

**I2C Address**: 0x3C (or 0x3D - check your module)

### LDR Light Sensor (Day/Night Detection)
| LDR Pin | ESP32 Pin | Description |
|---------|-----------|-------------|
| VCC     | 3.3V      | Power supply |
| GND     | GND       | Ground |
| OUT     | GPIO 36   | Analog output (ADC1_0 / VP) |

**Note**: Uses ADC1 channel - safe to use with WiFi enabled

### HX711 Load Cell Amplifiers (3 units)
| HX711 # | DT (DATA) | SCK (CLOCK) | Notes |
|---------|-----------|-------------|-------|
| HX711_1 | GPIO 39   | GPIO 32     | Input-only pin for DT |
| HX711_2 | GPIO 34   | GPIO 33     | Input-only pin for DT |
| HX711_3 | GPIO 35   | GPIO 27     | Input-only pin for DT |

**Power**: 3.3V (keeps signals ESP32-safe)  
**Note**: GPIO 34/35/39 are input-only pins - perfect for HX711 DT lines

### HW-134A Stepper Driver (US-17HA4401S Motor)
| Function | ESP32 Pin | Description |
|----------|-----------|-------------|
| STEP     | GPIO 26   | Step pulse input (PWM) |
| DIR      | GPIO 14   | Direction control |
| ENABLE   | GPIO 13   | Enable/disable (active LOW) |

**Control**: 1000Hz PWM on STEP pin for smooth motion  
**Rotation**: 267 steps for 30° (200 steps/rev × 16 microsteps × 30°/360°)

### ESC 40A + A2212 1400KV Brushless Motor
| Function | ESP32 Pin | Description |
|----------|-----------|-------------|
| ESC Signal | GPIO 25 | PWM signal (50Hz servo-style) |
| ESC GND    | ESP32 GND | Common ground (required!) |
| ESC Power  | External | DO NOT power from ESP32 |

**PWM**: 50Hz, 1000-2000µs pulse width (0-100% speed)  
**Power**: ESC has its own power path - use external battery/supply

## Features

### 1. Real-Time Weight Monitoring
- **3 HX711 amplifiers** for up to 5 load cells
- **24-bit precision** weight measurements
- **Individual & total weight** display
- **Low food level detection**
- **Tare function** for zero calibration
- **Calibration support** for accuracy

### 2. Day/Night Detection
- **LDR sensor** for ambient light monitoring
- **Automatic mode switching** (day/night)
- **Adjustable threshold** (default: 2000 ADC value)
- **WiFi-safe ADC1 channel**
- **Real-time light level** display

### 3. Precise Feed Control
- **Stepper motor**: 30° precise rotation for gate control
- **Brushless motor**: Variable speed (0-100%) for dispensing
- **Coordinated operation**: Gate opens → Food dispenses → Gate closes
- **PWM speed control** for smooth operation

### 4. OLED Display
- **System status** (Ready/Feeding/Error)
- **Total weight** from all load cells
- **Individual load cell** readings
- **Light level** and day/night mode
- **Feed count** tracking
- **Real-time updates** every 1 second

### 5. Serial Control
- **F** - Execute feed cycle
- **S** - Display detailed status
- **T** - Tare all load cells (zero calibration)
- **C** - Show calibration information
- **E** - Test ESC motor (5 seconds at 30%)
- **M** - Test stepper motor (30° rotation)

### 6. Feed Cycle Operation
1. **Rotate stepper 30°** (open feed gate)
2. **Activate brushless motor** at 50% speed
3. **Dispense for 5 seconds**
4. **Stop brushless motor**
5. **Return stepper to home** (close gate)
6. **Update statistics** and display

## Display Layout

```
=== FEED SYSTEM ===
Status: Ready
Weight: 523.4 g
LC:174 175 174g
Light: 3245 (DAY)
Feeds: 12
```

**Display Information:**
- **Line 1**: Title bar
- **Line 2**: System status (Ready/Feeding/Taring/Error)
- **Line 3**: Total weight from all load cells
- **Line 4**: Individual load cell readings (LC1, LC2, LC3)
- **Line 5**: Light level (0-4095) and mode (DAY/NIGHT)
- **Line 6**: Total feed count since power-on

## Installation & Setup

### Step 1: Install Required Libraries

Open Arduino IDE and install these libraries via Library Manager (**Tools → Manage Libraries**):

| # | Library | Author | Install Name | Purpose |
|---|---------|--------|-------------|---------|
| 1 | **Wire.h** | Arduino | Built-in (ESP32 core) | I2C communication for OLED & sensors |
| 2 | **Adafruit_GFX.h** | Adafruit Industries | **Adafruit GFX Library** | Core graphics library (dependency for SSD1306) |
| 3 | **Adafruit_SSD1306.h** | Adafruit Industries | **Adafruit SSD1306** | OLED display driver (0.96" 128x64) |
| 4 | **HX711.h** | Bogdan Necula | **HX711 Arduino Library** | Load cell amplifier (24-bit ADC) |
| 5 | **WiFi.h** | Espressif | Built-in (ESP32 core) | WiFi connectivity |
| 6 | **PubSubClient.h** | Nick O'Leary | **PubSubClient** | MQTT client for broker communication |
| 7 | **ArduinoJson.h** | Benoit Blanchon | **ArduinoJson** | JSON parsing & serialization |
| 8 | **time.h** | C Standard Library | Built-in (ESP32 core) | NTP time sync for scheduling |

**Libraries to install manually** (5 total — the rest are built-in):
1. **Adafruit GFX Library** by *Adafruit*
2. **Adafruit SSD1306** by *Adafruit*
3. **HX711 Arduino Library** by *Bogdan Necula*
4. **PubSubClient** by *Nick O'Leary*
5. **ArduinoJson** by *Benoit Blanchon*

### Step 2: Hardware Connections

⚠️ **IMPORTANT**: All components must share a common ground (GND)!

#### OLED Display (I2C - 4-pin)
```
OLED VCC  → ESP32 3.3V (or 5V if module supports)
OLED GND  → ESP32 GND
OLED SDA  → ESP32 GPIO 21
OLED SCL  → ESP32 GPIO 22
```

#### LDR Light Sensor
```
LDR VCC   → ESP32 3.3V
LDR GND   → ESP32 GND
LDR OUT   → ESP32 GPIO 36 (ADC1_0)
```

#### HX711 Load Cell Amplifiers (3 units)
```
HX711 #1:
  VCC → 3.3V
  GND → GND
  DT  → GPIO 39 (input-only pin)
  SCK → GPIO 32

HX711 #2:
  VCC → 3.3V
  GND → GND
  DT  → GPIO 34 (input-only pin)
  SCK → GPIO 33

HX711 #3:
  VCC → 3.3V
  GND → GND
  DT  → GPIO 35 (input-only pin)
  SCK → GPIO 27
```

**Load Cell Connection**: Each HX711 can connect 1-2 load cells  
- Red: E+ (Excitation+)
- Black: E- (Excitation-)
- White: S+ (Signal+)
- Green: S- (Signal-)

#### HW-134A Stepper Driver
```
Driver STEP → GPIO 26
Driver DIR  → GPIO 14
Driver EN   → GPIO 13
Driver GND  → ESP32 GND
Driver VCC  → External 12V/24V supply

Motor A+/A- → Stepper motor coil 1
Motor B+/B- → Stepper motor coil 2
```

⚠️ **Power stepper driver with external supply, NOT from ESP32!**

#### ESC 40A + A2212 Brushless Motor
```
ESC Signal Wire (usually white/yellow) → GPIO 25
ESC GND (usually black/brown)         → ESP32 GND
ESC Power (red)                       → External Battery (11.1V-14.8V LiPo)

ESC Motor Wires → A2212 Motor (any order, swap to reverse direction)
```

⚠️ **NEVER power ESC from ESP32! Use external LiPo battery.**

### Step 3: Board Configuration

In Arduino IDE:
- **Board**: ESP32 Dev Module
- **Upload Speed**: 921600
- **CPU Frequency**: 240MHz
- **Flash Frequency**: 80MHz
- **Flash Size**: 4MB
- **Port**: Select your COM port

### Step 4: Upload Code

1. Open `Kushanesp32feedcode.ino`
2. Select correct board and port
3. Click Upload
4. Open Serial Monitor (115200 baud)

### Step 5: Test the System

1. **Power on** - Should see splash screen for 3 seconds
2. **Check display** - Shows "Ready" status
3. **Press button** - Triggers manual feed
4. **Serial commands** - Type 'F' to feed, 'S' for status

## Troubleshooting

### OLED Display Not Working

**Problem**: "SSD1306 allocation failed" message

**Solutions**:
1. Check I2C connections (SDA: GPIO21, SCL: GPIO22)
2. Verify power supply (3.3V or 5V depending on module)
3. Try changing address from 0x3C to 0x3D in code
4. Confirm OLED is I2C mode (4-pin), not SPI (7-pin)
5. Test I2C bus with scanner sketch

### HX711 Not Responding

**Problem**: Weight reads 0 or NaN

**Solutions**:
1. Check DT and SCK connections
2. Verify 3.3V power to HX711 modules
3. Ensure load cells are properly wired (E+, E-, S+, S-)
4. Run tare command: Type 'T' in serial monitor
5. Check calibration factors in code
6. Test each HX711 individually

### Load Cell Calibration

**Problem**: Weight readings inaccurate

**Steps**:
1. Remove all weight from load cells
2. Send 'T' command to tare (zero)
3. Place known weight (e.g., 100g)
4. Note the raw reading in serial monitor
5. Calculate: `calibration_factor = raw_reading / known_weight`
6. Update `CALIBRATION_FACTOR_X` constants in code
7. Re-upload and test

### Stepper Motor Not Moving

**Problem**: No rotation when commanded

**Solutions**:
1. Check STEP, DIR, EN connections (GPIO 26, 14, 13)
2. Verify external power to driver (12V/24V)
3. Check motor wiring to A+/A-/B+/B- terminals
4. Ensure EN pin is LOW to enable (active LOW)
5. Test with 'M' command in serial monitor
6. Verify microstepping jumper settings on driver

### ESC Not Arming

**Problem**: Brushless motor doesn't respond

**Solutions**:
1. Check ESC signal wire on GPIO 25
2. Verify common ground between ESP32 and ESC
3. Ensure ESC has external power (LiPo battery)
4. Wait for ESC initialization (2 second delay in setup)
5. Check ESC calibration (see ESC manual)
6. Test with 'E' command (5-sec test at 30%)
7. Verify battery voltage (11.1V-14.8V recommended)

### LDR Always Shows Night/Day

**Problem**: Light sensor stuck in one mode

**Solutions**:
1. Check LDR connection to GPIO 36 (ADC1_0)
2. Verify 3.3V power to LDR module
3. Adjust `LIGHT_THRESHOLD` in code (default: 2000)
4. Check actual ADC value in status (type 'S')
5. LDR might be covered/exposed - adjust physically
6. Test in different lighting conditions

## Technical Specifications

### Sensors
- **HX711**: 24-bit ADC, 10Hz/80Hz sampling
- **LDR**: 0-4095 ADC range (12-bit)
- **OLED**: 128×64 pixels, I2C at 100kHz

### Motors
- **Stepper**: 200 steps/rev, 16× microstepping = 3200 steps/rev
- **ESC/Brushless**: 50Hz PWM, 1000-2000µs pulse width

### Timing
- **Sensor Update**: 500ms (2 Hz)
- **Display Update**: 1000ms (1 Hz)
- **Feed Duration**: 5000ms (5 seconds)
- **30° Rotation**: ~267 steps at 1000Hz = 267ms

### Power Consumption (ESP32 only)
- **ESP32**: ~160mA (WiFi off), ~240mA (WiFi on)
- **OLED**: ~20mA
- **HX711 (×3)**: ~4.5mA (1.5mA each)
- **Total**: ~185mA @ 3.3V (without motors)

**Motors powered separately!**

### Memory Usage
- **Sketch**: ~280KB
- **RAM**: ~80KB
- **Flash**: ~350KB

## Serial Monitor Output

### Startup Sequence
```
===========================================
Koi Fish Friend - Feed Device System
===========================================
Initializing hardware...

✓ I2C initialized (SDA: GPIO21, SCL: GPIO22)
✓ LDR initialized (GPIO36 - ADC1_0)

Initializing HX711 Load Cells...
✓ HX711 #1 ready (DT:GPIO39, SCK:GPIO32)
✓ HX711 #2 ready (DT:GPIO34, SCK:GPIO33)
✓ HX711 #3 ready (DT:GPIO35, SCK:GPIO27)
✓ Stepper driver initialized (STEP:GPIO26, DIR:GPIO14, EN:GPIO13)
✓ ESC initialized (GPIO25, 50Hz PWM)
  Sending idle signal (1000us)...

Initializing OLED Display (I2C)...
✓ OLED initialized successfully!
✓ Splash screen displayed

===========================================
Initialization Complete!
===========================================
Commands: F=Feed, S=Status, T=Tare, C=Calibrate
===========================================
```

### Feed Cycle Output
```
>>> Manual Feed Command Received

========================================
Feed Cycle Started!
========================================
Step 1: Rotating to dispense position...

--- Rotating Stepper 30° ---
✓ Rotated 267 steps (30°)

Step 2: Dispensing food...
ESC Speed set to: 50%
ESC stopped

Step 3: Returning to home position...

--- Rotating Stepper 30° ---
✓ Rotated 267 steps (30°)

========================================
Feed Cycle Complete!
========================================
```

### Status Display (S command)
```
========================================
         FEED SYSTEM STATUS
========================================
System Status: Ready
Uptime: 1847 seconds
Total Feeds: 5

--- Light Sensor ---
Light Level: 3245 / 4095 (79%)
Mode: DAY
Threshold: 2000

--- Load Cells (Weight) ---
Load Cell 1: 174.23 g
Load Cell 2: 175.45 g
Load Cell 3: 173.89 g
Total Weight: 523.57 g

--- Motors ---
Stepper: DISABLED
ESC: Ready

========================================
Commands:
  F - Feed cycle
  S - Status (this screen)
  T - Tare load cells
  C - Calibration info
  E - ESC test
  M - Stepper test
========================================
```

## Usage Examples

### Basic Operation

1. **Power on system**
   - Watch initialization sequence
   - Verify all sensors initialize successfully
   - Check OLED splash screen

2. **Tare load cells** (first time use)
   ```
   Type: T
   ```
   - Removes any offset
   - Sets current weight to zero
   - Do this with empty container

3. **Check system status**
   ```
   Type: S
   ```
   - View all sensor readings
   - Check day/night mode
   - Verify weight measurements

4. **Perform manual feed**
   ```
   Type: F
   ```
   - Opens feed gate (30° rotation)
   - Dispenses food for 5 seconds
   - Closes gate
   - Updates feed counter

### Testing Individual Components

**Test ESC motor only:**
```
Type: E
```
- Runs at 30% speed for 5 seconds
- Good for checking motor direction
- Verify motor stops after test

**Test stepper motor only:**
```
Type: M
```
- Rotates 30° in current direction
- Check for smooth movement
- Verify no missed steps

### Calibration Procedure

1. **Remove all weight**
   - Empty food container
   - Remove any load

2. **Tare sensors**
   ```
   Type: T
   ```

3. **Place known weight** (e.g., 100g)
   - Use calibrated weight
   - Place on center of load cells

4. **Check reading**
   ```
   Type: S
   ```
   - Note the displayed weight
   - If incorrect, adjust calibration factors

5. **Update calibration factors** in code:
   ```cpp
   #define CALIBRATION_FACTOR_1 -7050.0  // Adjust this
   #define CALIBRATION_FACTOR_2 -7050.0  // And this
   #define CALIBRATION_FACTOR_3 -7050.0  // And this
   ```

6. **Re-upload and verify**
   - Upload modified code
   - Repeat weight test
   - Fine-tune as needed

### Adjusting Feed Parameters

**Change feed duration** (food dispensing time):
```cpp
#define FEED_DURATION_MS 5000  // 5 seconds (adjust as needed)
```

**Change rotation angle** (gate opening):
```cpp
// For 45° instead of 30°:
#define STEPS_FOR_30_DEG ((STEPS_PER_REV * MICROSTEPS * 45) / 360)
```

**Adjust ESC speed** during feed:
```cpp
// In performFeedCycle() function:
setESCSpeed(50);  // Change 50 to 30-70% as needed
```

**Change day/night threshold**:
```cpp
#define LIGHT_THRESHOLD 2000  // Increase for more sensitivity
```

## Code Structure

### Main Components
1. **Setup Function**
   - Initialize I2C communication
   - Configure GPIO pins
   - Initialize OLED display
   - Display splash screen

2. **Main Loop**
   - Check button state
   - Update display periodically
   - Process serial commands
   - Execute feeding operations

3. **Display Functions**
   - `displaySplashScreen()` - Initial welcome screen
   - `updateDisplay()` - Real-time status updates

4. **Feeding Functions**
   - `manualFeed()` - Execute feeding cycle
   - `checkButton()` - Button debouncing and detection

5. **Utility Functions**
   - `getTimeString()` - Format uptime
   - `printStatus()` - Serial status report
   - `serialEvent()` - Process serial commands

## Future Enhancements

### Planned Features
- ⏰ RTC module for accurate scheduling
- 📅 Multiple daily feeding times
- 📊 Feed amount customization
- 🌐 WiFi remote control interface
- 📱 Bluetooth mobile app
- 📈 Feed history logging
- ⚠️ Low feed level alerts
- 🔋 Battery level monitoring

### Hardware Additions
- DS3231 RTC module
- Feed level sensor (ultrasonic or load cell)
- WiFi remote control
- Battery backup system

## Safety Features

1. **Debounced Button**: Prevents multiple triggers
2. **Status Feedback**: Visual and serial confirmation
3. **Error Handling**: Continues operation if OLED fails
4. **Servo Protection**: External power supply recommended

## Usage Tips

1. **Reset Daily Counter**: Send 'R' command at start of each day
2. **Monitor Status**: Use 'S' command to check statistics
3. **Test Feeding**: Use 'F' command for remote testing
4. **Adjust Feed Amount**: Modify `FEED_AMOUNT_DEFAULT` constant
5. **Change Feed Duration**: Adjust `FEED_DURATION_MS` constant

## Project Information

- **Project**: Koi Fish Friend
- **Module**: Feed Device System
- **Version**: 1.0
- **Date**: December 25, 2025
- **Author**: Koi Fish Friend Team
- **License**: Open Source

## Support & Resources

- **Project Repository**: [GitHub/koi-fish-friend]
- **Main System**: See boat control system documentation
- **Board Reference**: ZY-ESP32 38-pin pinout diagram
- **Libraries**: Adafruit GFX & SSD1306 documentation

---

**Happy Feeding! 🐟🎣**
