# Koi Fish Friend - ESP32 Boat Control System

## Project Overview

This is a simplified ESP32-based autonomous boat control system featuring essential sensors, motors, and real-time monitoring capabilities. The system is designed for the **ZY-ESP32 WIFI BT 38 PIN BOARD** and controls a dual-propeller boat with motion tracking and obstacle avoidance.

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

2. **MPU-6050 Accelerometer & Gyroscope**
   - 6-axis motion tracking
   - Measures linear acceleration (m/s²)
   - Measures angular velocity (°/s)
   - Calculates tilt angles
   - Used for boat balance control

3. **L298N Motor Driver Module**
   - Dual H-bridge motor driver
   - Controls 2x 12V DC motors (propellers)
   - PWM speed control

4. **HC-SR04 Ultrasonic Sensors (4 units)**
   - Front, back, left, and right obstacle detection
   - Range: 2-400 cm
   - 360° awareness for comprehensive obstacle avoidance

5. **OLED Display 0.96" (SSD1306)**
   - 128x64 pixel resolution
   - I2C interface
   - Real-time sensor data visualization
   - Low power consumption

6. **Relay Module**
   - Connected to GPIO 13
   - Controls external devices based on voltage
   - Activates when voltage < 8.6V

## Features

### 1. Voltage Monitoring & Control
- Continuously monitors battery voltage
- Automatically activates relay when voltage drops below 8.6V
- Prevents over-discharge of battery
- Displays voltage in volts (V)

### 2. Motion & Balance Control
- **Linear Acceleration**: Measures acceleration in m/s²
- **Angular Velocity**: Measures rotation rate in °/s
- **Tilt Detection**: Calculates X and Y axis angles
- **Auto-Balance**: Adjusts motor speeds to maintain stability
- **Temperature Monitoring**: MPU-6050 internal temperature

### 3. Autonomous Navigation
- **Y-axis Movement**: Forward/backward propulsion
- **X-axis Movement**: Left/right turning
- **Balance Maintenance**: Corrects tilt using differential motor control
- **Obstacle Avoidance**: Detects and avoids obstacles from all directions

### 4. Motor Control
- Dual propeller control via L298N
- Independent speed control for each motor
- PWM-based speed regulation (0-255)
- Forward, backward, left, and right movements

### 5. Obstacle Detection
- **4 ultrasonic sensors**: Front, back, left, and right
- **360° coverage**: Complete surrounding awareness
- Detects obstacles within 30 cm
- Intelligent evasive maneuvers based on all sensor data
- Real-time distance monitoring from all directions

### 6. OLED Display (0.96" SSD1306)
- **Real-time visualization** of sensor data
- **128x64 resolution** for clear display
- Shows voltage, distances, angles, temperature
- Low power consumption
- I2C interface for fast updates

## Technical Specifications

### Power Requirements
- **ESP32**: 3.3V (regulated)
- **Motors**: 12V DC
- **Sensors**: 3.3V / 5V (depending on module)
- **Logic Level**: 3.3V

### Communication Protocols
- **I2C**: MPU-6050, OLED Display (SSD1306)
- **Analog**: Voltage sensor
- **Digital**: Ultrasonic sensors, relay, motor control
- **PWM**: Motor drivers (L298N)

### Sampling Rates
- **Sensor Reading**: 100ms (10 Hz)
- **Display Update**: 500ms (2 Hz)
- **Motor Control**: Real-time (as needed)

### Thresholds & Calibration
- **Voltage Threshold**: 8.6V
- **Obstacle Distance**: 30 cm
- **Balance Angle**: ±15 degrees

## Pin Configuration

### Analog Pins
| Pin | Function | Module |
|-----|----------|--------|
| GPIO 34 | Voltage Sensor Input | MD0492 |

### Digital Pins
| Pin | Function | Module |
|-----|----------|--------|
| GPIO 13 | Relay Control | Relay Module |

### I2C Pins (Shared Bus)
| Pin | Function | Modules |
|-----|----------|---------|
| GPIO 21 | SDA | MPU-6050, OLED Display |
| GPIO 22 | SCL | MPU-6050, OLED Display |

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
| Pin | Function | Sensor | Status |
|-----|----------|--------|--------|
| GPIO 18 | Front Trigger | Front HC-SR04 | ✅ Working |
| GPIO 19 | Front Echo | Front HC-SR04 | ✅ Working |
| GPIO 0 | Back Trigger | Back HC-SR04 | ✅ Working |
| GPIO 35 | Back Echo | Back HC-SR04 | ✅ Working |
| GPIO 25 | Left Trigger | Left HC-SR04 | ✅ Working |
| GPIO 39 | Left Echo | Left HC-SR04 | ✅ Working |
| GPIO 15 | Right Trigger | Right HC-SR04 | ✅ Working |
| GPIO 12 | Right Echo | Right HC-SR04 | ✅ Working |

**Note**: WiFi uses internal ESP32 hardware (no external pins required)

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

3. **Data Display**
   - OLED real-time display
   - Serial monitor output
   - Sensor data formatting

### Control Flow

```
Initialize Hardware
    ↓
Read Sensors (100ms interval)
    ├─ Voltage Sensor
    ├─ MPU-6050 (Accel/Gyro)
    └─ Ultrasonic Sensors (4x)
    ↓
Process Data
    ├─ Calculate angles
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
Update Display (500ms interval)
    ├─ OLED Display
    └─ Serial Monitor Output
```

## Installation

### Required Libraries

Install these libraries via Arduino IDE Library Manager:

```
- Wire.h (Built-in)
- MPU6050.h (by Electronic Cats)
- Adafruit_GFX.h (by Adafruit)
- Adafruit_SSD1306.h (by Adafruit)
```

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

### Voltage Sensor Calibration

1. Measure battery voltage with multimeter
2. Compare with sensor reading
3. Adjust `VOLTAGE_DIVIDER_RATIO` in code if needed

## Usage

### Serial Monitor Output

The system displays data every 500ms:

```
========== Sensor Readings ==========
Voltage: 12.45 V | Relay: OFF

--- MPU-6050 ---
Accel (m/s²): X=0.05 Y=0.12 Z=9.78
Gyro (°/s): X=0.23 Y=-0.15 Z=0.08
Angles: X=1.25° Y=-0.89°
MPU Temp: 28.50 °C

--- Ultrasonic (4 Sensors) ---
Front: 45.2 cm | Back: 38.7 cm
Left: 52.3 cm | Right: 41.8 cm

--- Motors ---
Left Speed: 150 | Right Speed: 150
=====================================
```

### OLED Display

The OLED shows:
- Line 1: "Koi Fish Friend"
- Line 2: Voltage and status
- Line 3: Tilt angles (X, Y)
- Line 4: Temperature
- Line 5: Front and back distances
- Line 6: Left and right distances
- Line 7: Motor speeds

## Troubleshooting

### Common Issues

1. **MPU-6050 Connection Failed**
   - Check I2C wiring (SDA, SCL)
   - Verify 3.3V power supply
   - Ensure I2C address is 0x68

2. **OLED Not Working**
   - Check I2C wiring
   - Verify I2C address is 0x3C
   - Ensure Adafruit libraries installed

3. **Motors Not Running**
   - Check L298N connections
   - Verify 12V power supply
   - Test PWM pins with LED

4. **Ultrasonic Wrong Readings**
   - Check trigger/echo wiring
   - Ensure clear line of sight
   - Verify 5V power

5. **ESP32 Boot Issues**
   - GPIO 0 may interfere with boot if held LOW
   - Consider moving back echo to GPIO 5
   - Disconnect ultrasonic during upload if needed

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

## Total GPIO Usage

### ESP32 Pins Used (18 pins)

| GPIO | Function              |
|------|-----------------------|
| 34   | Voltage Sensor (ADC)  |
| 13   | Relay                 |
| 21   | I2C SDA (shared)      |
| 22   | I2C SCL (shared)      |
| 25   | Motor Left IN1        |
| 26   | Motor Left IN2        |
| 14   | Motor Left EN         |
| 27   | Motor Right IN1       |
| 32   | Motor Right IN2       |
| 33   | Motor Right EN        |
| 18   | Ultrasonic Front TRIG |
| 19   | Ultrasonic Front ECHO |
| 23   | Ultrasonic Back TRIG  |
| 5    | Ultrasonic Back ECHO  |
| 4    | Ultrasonic Left TRIG  |
| 15   | Ultrasonic Left ECHO  |
| 2    | Ultrasonic Right TRIG |
| 12   | Ultrasonic Right ECHO |

## Future Enhancements

- [ ] WiFi connectivity for remote monitoring
- [ ] MQTT protocol for IoT integration
- [ ] GPS module for location tracking
- [ ] Web interface for configuration
- [ ] Bluetooth app control
- [ ] Automatic waypoint navigation
- [ ] Solar panel integration
- [ ] Water quality sensors

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
Date: December 22, 2025

---

**Note**: This is a working prototype. Always test in a controlled environment before deploying in open water.
