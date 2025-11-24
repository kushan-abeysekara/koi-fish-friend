# Koi Fish Friend - ESP32 Boat Control System

## Project Overview

This is a comprehensive ESP32-based autonomous boat control system featuring multiple sensors, motors, and real-time monitoring capabilities. The system is designed for the **ZY-ESP32 WIFI BT 38 PIN BOARD** and controls a dual-propeller boat with advanced sensor integration.

## Hardware Components

### Main Board
- **ZY-ESP32 WIFI BT 38 PIN BOARD**
  - WiFi & Bluetooth enabled
  - 38 GPIO pins
  - Dual-core processor

### Sensors & Modules

1. **Voltage Sensor Detection Module (MD0492)**
   - Monitors battery voltage
   - Triggers relay based on voltage threshold
   - Range: 0-25V DC

2. **HX711 Load Cell Amplifier (MD0020)**
   - 24-bit ADC for precise weight measurement
   - Connected to 5KG load cell
   - Output format: X.XX kg (2 decimal places)

3. **LDR Light Sensor Module (MD0222)**
   - 3-pin module
   - Detects day/night conditions
   - Analog output

4. **MPU-6050 Accelerometer & Gyroscope**
   - 6-axis motion tracking
   - Measures linear acceleration (m/s²)
   - Measures angular velocity (°/s)
   - Calculates tilt angles
   - Used for boat balance control

5. **L298N Motor Driver Module**
   - Dual H-bridge motor driver
   - Controls 2x 12V DC motors (propellers)
   - PWM speed control

6. **HC-SR04 Ultrasonic Sensors (4 units)**
   - Front, back, left, and right obstacle detection
   - Range: 2-400 cm
   - 360° awareness for comprehensive obstacle avoidance

7. **DS3231 RTC Module**
   - Real-time clock with date & time
   - Built-in temperature sensor
   - Battery backup for timekeeping

8. **Relay Module**
   - Connected to GPIO 13
   - Controls external devices based on voltage
   - Activates when voltage < 8.6V

9. **OLED Display 0.96" (SSD1306)**
   - 128x64 pixel resolution
   - SPI interface (7-pin module)
   - Real-time sensor data visualization
   - Low power consumption

10. **Fish Feeding System**
   - **A2212/5T 2450KV Brushless Motor**
   - Drives feeding plate to spread fish feed
   - ESC (Electronic Speed Controller) required
   - Controlled via PWM signal from backend

11. **A4988 Stepper Motor Driver**
   - Controls stepper motor for precise movements
   - Microstepping capability (up to 1/16 step)
   - Backend controlled for automated operations
   - Enable/disable functionality

## Features

### 1. Voltage Monitoring & Control
- Continuously monitors battery voltage
- Automatically activates relay when voltage drops below 8.6V
- Prevents over-discharge of battery
- Displays voltage in volts (V)

### 2. Weight Measurement
- Precise weight measurement using HX711 and load cell
- Calibrated for accurate readings
- Displays weight in kg with 2 decimal places
- Range: 0-5 kg

### 3. Day/Night Detection
- Uses LDR sensor to detect ambient light
- Determines day or night condition
- Can be used for automatic lighting control

### 4. Motion & Balance Control
- **Linear Acceleration**: Measures acceleration in m/s²
- **Angular Velocity**: Measures rotation rate in °/s
- **Tilt Detection**: Calculates X and Y axis angles
- **Auto-Balance**: Adjusts motor speeds to maintain stability
- **Temperature Monitoring**: MPU-6050 internal temperature

### 5. Autonomous Navigation
- **Y-axis Movement**: Forward/backward propulsion
- **X-axis Movement**: Left/right turning
- **Balance Maintenance**: Corrects tilt using differential motor control
- **Obstacle Avoidance**: Detects and avoids obstacles on both sides

### 6. Motor Control
- Dual propeller control via L298N
- Independent speed control for each motor
- PWM-based speed regulation (0-255)
- Forward, backward, left, and right movements

### 7. Obstacle Detection
- **4 ultrasonic sensors**: Front, back, left, and right
- **360° coverage**: Complete surrounding awareness
- Detects obstacles within 30 cm
- Intelligent evasive maneuvers based on all sensor data
- Real-time distance monitoring from all directions

### 8. Real-Time Clock
- Maintains accurate date and time
- Temperature monitoring from RTC module
- Battery backup ensures time persistence
- Logs system events with timestamps

### 9. OLED Display (0.96" SSD1306)
- **Real-time visualization** of sensor data
- **128x64 resolution** for clear display
- Shows voltage, weight, distances, angles
- Low power consumption
- SPI interface for fast updates

### 10. Automated Fish Feeding System
- **Brushless motor** (A2212 2450KV) drives feeding plate
- **Spreads fish feed** across pond surface
- **Stepper motor** for precise feed dispensing
- **Backend controlled** for scheduled feeding
- **ESC control** for smooth motor operation
- **A4988 driver** for stepper accuracy

## Technical Specifications

### Power Requirements
- **ESP32**: 3.3V (regulated)
- **Motors**: 12V DC
- **Sensors**: 3.3V / 5V (depending on module)
- **Logic Level**: 3.3V

### Communication Protocols
- **I2C**: MPU-6050, DS3231
- **SPI**: OLED Display (SSD1306)
- **Analog**: Voltage sensor, LDR
- **Digital**: Ultrasonic sensors, relay, motor control, stepper driver
- **PWM**: Motor drivers (L298N), ESC (feeding motor)

### Sampling Rates
- **Sensor Reading**: 100ms (10 Hz)
- **RTC Reading**: 1000ms (1 Hz)
- **Motor Control**: Real-time (as needed)

### Thresholds & Calibration
- **Voltage Threshold**: 8.6V
- **LDR Day Threshold**: 2000 (analog value)
- **Obstacle Distance**: 30 cm
- **Balance Angle**: ±15 degrees
- **HX711 Calibration Factor**: -7050.0 (adjust after testing)

## Pin Configuration

### Analog Pins
| Pin | Function | Module |
|-----|----------|--------|
| GPIO 34 | Voltage Sensor Input | MD0492 |
| GPIO 35 | LDR Light Sensor | MD0222 |

### Digital Pins
| Pin | Function | Module |
|-----|----------|--------|
| GPIO 13 | Relay Control | Relay Module |
| GPIO 16 | HX711 DOUT | Load Cell Amp |
| GPIO 17 | HX711 SCK | Load Cell Amp |

### I2C Pins (Shared Bus)
| Pin | Function | Modules |
|-----|----------|---------|
| GPIO 21 | SDA | MPU-6050, DS3231 |
| GPIO 22 | SCL | MPU-6050, DS3231 |

### Motor Control Pins (L298N)
| Pin | Function | Motor |
|-----|----------|-------|
| GPIO 25 | Left Motor IN1 | Left Propeller |
| GPIO 26 | Left Motor IN2 | Left Propeller |
| GPIO 14 | Left Motor EN (PWM) | Left Propeller |
| GPIO 27 | Right Motor IN1 | Right Propeller |
| GPIO 32 | Right Motor IN2 | Right Propeller |
| GPIO 33 | Right Motor EN (PWM) | Right Propeller |

### Ultrasonic Sensors (4 Units)
| Pin | Function | Sensor |
|-----|----------|--------|
| GPIO 18 | Front Trigger | Front HC-SR04 |
| GPIO 19 | Front Echo | Front HC-SR04 |
| GPIO 23 | Back Trigger | Back HC-SR04 |
| GPIO 0 | Back Echo | Back HC-SR04 |
| GPIO 4 | Left Trigger | Left HC-SR04 |
| GPIO 15 | Left Echo | Left HC-SR04 |
| GPIO 2 | Right Trigger | Right HC-SR04 |
| GPIO 12 | Right Echo | Right HC-SR04 |

### OLED Display (SPI)
| Pin | Function | Module |
|-----|----------|--------|
| GPIO 3 | MOSI (SDA) | SSD1306 OLED |
| GPIO 1 | CLK (SCK) | SSD1306 OLED |
| GPIO 36 | Data/Command | SSD1306 OLED |
| GPIO 39 | Chip Select | SSD1306 OLED |

### Fish Feeding System
| Pin | Function | Module |
|-----|----------|--------|
| GPIO 9 | ESC PWM Signal | A2212 Brushless Motor |
| GPIO 10 | Step Pulse | A4988 Stepper Driver |
| GPIO 11 | Direction | A4988 Stepper Driver |
| GPIO 8 | Enable | A4988 Stepper Driver |

**Note**: WiFi uses internal ESP32 hardware (no external pins required)  
**Important**: GPIO 5 is NOT available on ESP32 38-pin development board  
**Backend Control**: Feeding motor and stepper are controlled via backend API (functions ready)

## Software Architecture

### Main Components

1. **Sensor Management**
   - Periodic sensor readings
   - Data filtering and validation
   - Threshold monitoring

2. **Control Systems**
   - Balance control algorithm
   - Obstacle avoidance logic
   - Motor speed regulation

3. **Data Logging**
   - Serial monitor output
   - Timestamp integration
   - Sensor data formatting

### Control Flow

```
Initialize Hardware
    ↓
Read Sensors (100ms interval)
    ├─ Voltage Sensor
    ├─ Load Cell (HX711)
    ├─ LDR Sensor
    ├─ MPU-6050 (Accel/Gyro)
    └─ Ultrasonic Sensors
    ↓
Process Data
    ├─ Calculate angles
    ├─ Determine day/night
    └─ Measure distances
    ↓
Control Actions
    ├─ Relay Control (voltage-based)
    ├─ Balance Control (angle-based)
    └─ Obstacle Avoidance (distance-based)
    ↓
Update Motors
    ├─ Calculate speeds
    └─ Set PWM outputs
    ↓
Display Data (1s interval)
    └─ Serial Monitor Output
```

## Installation

### Required Libraries

Install these libraries via Arduino IDE Library Manager:

```
- Wire.h (Built-in)
- HX711.h (by Bogdan Necula)
- MPU6050.h (by Electronic Cats)
- RTClib.h (by Adafruit)
- Adafruit_GFX.h (by Adafruit) - For OLED
- Adafruit_SSD1306.h (by Adafruit) - For OLED Display
```

**Note**: OLED display libraries are optional for initial testing. The system will work without them, but display features will be unavailable.

### Arduino IDE Setup

1. **Install ESP32 Board Support**
   - Open Arduino IDE
   - Go to File → Preferences
   - Add to "Additional Board Manager URLs":
     ```
     https://dl.espressif.com/dl/package_esp32_index.json
     ```
   - Go to Tools → Board → Boards Manager
   - Search for "ESP32" and install

2. **Select Board**
   - Tools → Board → ESP32 Arduino → ESP32 Dev Module

3. **Configure Upload Settings**
   - Upload Speed: 921600
   - CPU Frequency: 240MHz
   - Flash Frequency: 80MHz
   - Flash Mode: QIO
   - Flash Size: 4MB
   - Partition Scheme: Default

4. **Select Port**
   - Connect ESP32 via USB
   - Tools → Port → Select COM port

### Uploading Code

1. Open `Kushanesp32.ino` in Arduino IDE
2. Click Verify (✓) to compile
3. Click Upload (→) to flash to ESP32
4. Open Serial Monitor (115200 baud) to view output

## Calibration

### HX711 Load Cell Calibration

1. **Tare the Scale**
   ```cpp
   scale.tare();  // Already in setup()
   ```

2. **Find Calibration Factor**
   - Place a known weight (e.g., 1.00 kg)
   - Read the raw value
   - Calculate: `calibration_factor = raw_value / known_weight`
   - Update `CALIBRATION_FACTOR` in code

3. **Verify**
   - Place different known weights
   - Check if readings match

### LDR Threshold Calibration

1. Test in daylight and darkness
2. Note analog values
3. Set `LDR_DAY_THRESHOLD` between day/night values

### Voltage Sensor Calibration

1. Measure battery voltage with multimeter
2. Compare with sensor reading
3. Adjust `VOLTAGE_DIVIDER_RATIO` if needed

## Usage

### Serial Monitor Output

The system displays data every second:

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

--- Ultrasonic ---
Left: 45.2 cm | Right: 38.7 cm

--- Motors ---
Left Speed: 150 | Right Speed: 150

--- Feeding System ---
Feed Motor: OFF | Speed: 0
Stepper: DISABLED | Position: 0

========== RTC Information ==========
Date: 2025/11/24
Time: 14:35:22
RTC Temperature: 27.25 °C
=====================================
```

## Troubleshooting

### Common Issues

1. **MPU-6050 Connection Failed**
   - Check I2C wiring (SDA, SCL)
   - Verify 3.3V power supply
   - Ensure I2C address is 0x68

2. **HX711 Not Ready**
   - Check wiring (DOUT, SCK)
   - Verify load cell connections
   - Run tare command

3. **RTC Not Found**
   - Check I2C wiring
   - Verify 3.3V/5V power
   - Ensure battery is installed

4. **Motors Not Running**
   - Check L298N connections
   - Verify 12V power supply
   - Test PWM pins with LED

5. **Ultrasonic Wrong Readings**
   - Check trigger/echo wiring
   - Ensure clear line of sight
   - Verify 5V power

## Safety Considerations

1. **Water Protection**
   - Use waterproof enclosure for electronics
   - Seal all cable entries
   - Keep battery compartment dry

2. **Battery Management**
   - Monitor voltage regularly
   - Don't discharge below 8.6V
   - Use appropriate fuse/circuit breaker

3. **Motor Safety**
   - Secure propellers properly
   - Keep hands away from moving parts
   - Emergency stop mechanism recommended

## Future Enhancements

- [ ] **WiFi connectivity** for remote monitoring (pins reserved)
- [ ] **MQTT protocol** for IoT integration (pins reserved)
- [ ] GPS module for location tracking
- [ ] SD card logging for data storage
- [ ] Web interface for configuration
- [ ] Bluetooth app control
- [ ] Automatic waypoint navigation
- [ ] Solar panel integration
- [ ] Water quality sensors
- [ ] Cloud data synchronization via MQTT

## Support

For issues or questions:
- Check wiring diagram
- Review pin configuration
- Verify library versions
- Check serial monitor for errors

## License

MIT License - Free for personal and commercial use

## Author

**Koi Fish Friend Team**  
Date: November 24, 2025

---

**Note**: This is a working prototype. Always test in a controlled environment before deploying in open water.
