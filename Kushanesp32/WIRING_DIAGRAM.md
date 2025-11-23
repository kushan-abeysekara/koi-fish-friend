# Wiring Diagram - ESP32 Boat Control System

## Complete Wiring Connections

### Power Distribution

```
12V Battery
    ├─→ L298N Motor Driver (12V input)
    │   └─→ Motors (12V each)
    ├─→ Voltage Regulator (12V → 5V)
    │   └─→ ESP32 VIN (or use USB)
    └─→ Voltage Sensor Module (VCC)

ESP32 3.3V Pin
    ├─→ MPU-6050 VCC
    ├─→ DS3231 RTC VCC
    ├─→ HX711 VCC
    ├─→ LDR Module VCC
    └─→ HC-SR04 sensors VCC (or use 5V)

Ground (Common GND)
    ├─→ ESP32 GND
    ├─→ Battery GND
    ├─→ All sensor/module GND
    └─→ L298N GND
```

---

## 1. Voltage Sensor (MD0492)

```
Voltage Sensor Module
    VCC  →  3.3V or 5V (ESP32)
    GND  →  GND (ESP32)
    OUT  →  GPIO 34 (ESP32 Analog Input)
    
Input Terminals
    +    →  Battery Positive (12V)
    -    →  Battery Negative (GND)
```

**Notes:**
- Measures battery voltage (0-25V range)
- Use voltage divider if needed
- GPIO 34 is ADC1_CH6 (analog input)

---

## 2. Relay Module (Connected to G13)

```
Relay Module
    VCC  →  5V (ESP32 or external)
    GND  →  GND (ESP32)
    IN   →  GPIO 13 (ESP32)
    
Relay Contacts
    COM  →  Voltage Sensor Signal Line
    NO   →  Load Positive
    NC   →  Not Connected
```

**Purpose:**
- Activates when voltage < 8.6V
- Can control charger, alarm, or cutoff circuit
- GPIO 13 outputs HIGH/LOW to trigger relay

---

## 3. HX711 Load Cell Amplifier (MD0020)

```
HX711 Module
    VCC  →  3.3V (ESP32)
    GND  →  GND (ESP32)
    DT   →  GPIO 16 (DOUT)
    SCK  →  GPIO 17 (Clock)
    
Load Cell (4-wire)
    E+   →  Red wire (Excitation+)
    E-   →  Black wire (Excitation-)
    A+   →  White wire (Signal+)
    A-   →  Green wire (Signal-)
    
Connect Load Cell to HX711
    E+   →  HX711 E+
    E-   →  HX711 E-
    A+   →  HX711 A+
    A-   →  HX711 A-
```

**Notes:**
- 5KG load cell
- Calibration required (see calibration section)
- Outputs weight in kg with 2 decimal places

---

## 4. LDR Light Sensor Module (MD0222)

```
LDR Module (3-pin)
    VCC  →  3.3V (ESP32)
    GND  →  GND (ESP32)
    OUT  →  GPIO 35 (ESP32 Analog Input)
```

**Notes:**
- Analog output (0-4095 on ESP32)
- Higher value = more light
- Threshold set to 2000 for day/night detection

---

## 5. MPU-6050 Accelerometer & Gyroscope

```
MPU-6050 Module
    VCC  →  3.3V (ESP32)
    GND  →  GND (ESP32)
    SDA  →  GPIO 21 (ESP32 I2C Data)
    SCL  →  GPIO 22 (ESP32 I2C Clock)
    INT  →  Not Connected (optional)
    AD0  →  GND (I2C address 0x68)
```

**Purpose:**
- Measures acceleration (m/s²)
- Measures angular velocity (°/s)
- Calculates tilt angles
- Balance control for boat

---

## 6. L298N Motor Driver Module

```
L298N Motor Driver
    12V  →  Battery Positive (12V)
    GND  →  Battery GND + ESP32 GND (common)
    5V   →  Not Connected (remove jumper if using)
    
Left Motor Control
    IN1  →  GPIO 25 (ESP32)
    IN2  →  GPIO 26 (ESP32)
    ENA  →  GPIO 14 (ESP32 PWM)
    
Right Motor Control
    IN3  →  GPIO 27 (ESP32)
    IN4  →  GPIO 32 (ESP32)
    ENB  →  GPIO 33 (ESP32 PWM)
    
Motor Outputs
    OUT1 →  Left Motor +
    OUT2 →  Left Motor -
    OUT3 →  Right Motor +
    OUT4 →  Right Motor -
```

**Notes:**
- ENA and ENB must have PWM signal for speed control
- Remove 5V jumper if ESP32 has separate power
- Common ground is essential

---

## 7. HC-SR04 Ultrasonic Sensors (4 units)

### Front Sensor
```
HC-SR04 Front
    VCC   →  5V (ESP32 or external)
    GND   →  GND (ESP32)
    TRIG  →  GPIO 18 (ESP32)
    ECHO  →  GPIO 19 (ESP32)
```

### Back Sensor
```
HC-SR04 Back
    VCC   →  5V (ESP32 or external)
    GND   →  GND (ESP32)
    TRIG  →  GPIO 23 (ESP32)
    ECHO  →  GPIO 0 (ESP32)
```

**Note**: GPIO 5 is NOT available on ESP32 38-pin board, using GPIO 0 instead.

### Left Sensor
```
HC-SR04 Left
    VCC   →  5V (ESP32 or external)
    GND   →  GND (ESP32)
    TRIG  →  GPIO 4 (ESP32)
    ECHO  →  GPIO 15 (ESP32)
```

### Right Sensor
```
HC-SR04 Right
    VCC   →  5V (ESP32 or external)
    GND   →  GND (ESP32)
    TRIG  →  GPIO 2 (ESP32)
    ECHO  →  GPIO 12 (ESP32)
```

**Notes:**
- HC-SR04 works best with 5V
- ECHO pin outputs 5V but ESP32 is 3.3V tolerant
- For safety, use voltage divider on ECHO pins (optional)
- Range: 2-400 cm
- 4 sensors provide 360° coverage (front, back, left, right)

---

## 8. DS3231 RTC Module

```
DS3231 Module
    VCC  →  3.3V or 5V (ESP32)
    GND  →  GND (ESP32)
    SDA  →  GPIO 21 (ESP32 I2C Data - shared with MPU)
    SCL  →  GPIO 22 (ESP32 I2C Clock - shared with MPU)
```

**Notes:**
- I2C address 0x68 (same as MPU-6050)
- Both can share the same I2C bus
- Has backup battery for timekeeping
- Built-in temperature sensor

---

## 9. WiFi & MQTT (Reserved for Future)

**WiFi Module:**
```
Built-in ESP32 WiFi
    - No external wiring required
    - Uses internal antenna
    - 2.4 GHz WiFi support
    - Controlled via software only
```

**Reserved GPIO Pins:**
```
GPIO 36 - Reserved for expansion (input only, ADC)
GPIO 39 - Reserved for expansion (input only, ADC)
```

**Unavailable Pins on 38-Pin Board:**
```
GPIO 5  - Not available on this board variant
```

**Notes:**
- WiFi functionality built into ESP32 chip
- No external pins needed for WiFi/Bluetooth
- MQTT will use WiFi connection (software-based)
- Reserved pins available for future sensors or controls
- GPIO 36 & 39 are input-only (good for additional analog sensors)

**Future MQTT Setup:**
- Connect to WiFi network
- Configure MQTT broker (e.g., HiveMQ, Mosquitto)
- Publish sensor data to topics
- Subscribe to control commands

---

## Complete Pin Mapping Table

| ESP32 GPIO | Function | Connected To | Type |
|------------|----------|--------------|------|
| 34 | Voltage Sensor | MD0492 OUT | Analog In |
| 35 | LDR Sensor | MD0222 OUT | Analog In |
| 13 | Relay Control | Relay Module IN | Digital Out |
| 16 | HX711 Data | HX711 DT | Digital In |
| 17 | HX711 Clock | HX711 SCK | Digital Out |
| 21 | I2C SDA | MPU-6050, DS3231 | I2C Data |
| 22 | I2C SCL | MPU-6050, DS3231 | I2C Clock |
| 25 | Left Motor IN1 | L298N IN1 | Digital Out |
| 26 | Left Motor IN2 | L298N IN2 | Digital Out |
| 14 | Left Motor EN | L298N ENA | PWM Out |
| 27 | Right Motor IN1 | L298N IN3 | Digital Out |
| 32 | Right Motor IN2 | L298N IN4 | Digital Out |
| 33 | Right Motor EN | L298N ENB | PWM Out |
| 18 | Front US Trigger | HC-SR04 TRIG | Digital Out |
| 19 | Front US Echo | HC-SR04 ECHO | Digital In |
| 23 | Back US Trigger | HC-SR04 TRIG | Digital Out |
| 0 | Back US Echo | HC-SR04 ECHO | Digital In |
| 4 | Left US Trigger | HC-SR04 TRIG | Digital Out |
| 15 | Left US Echo | HC-SR04 ECHO | Digital In |
| 2 | Right US Trigger | HC-SR04 TRIG | Digital Out |
| 12 | Right US Echo | HC-SR04 ECHO | Digital In |
| 36 | Reserved | Future Expansion | Reserved (Input Only) |
| 39 | Reserved | Future Expansion | Reserved (Input Only) |

**Note**: GPIO 5 is NOT available on ESP32 38-pin development board

---

## I2C Bus Configuration

```
ESP32 I2C Bus (Wire)
    SDA (GPIO 21)
        ├─→ MPU-6050 SDA (0x68)
        └─→ DS3231 SDA (0x68)
    
    SCL (GPIO 22)
        ├─→ MPU-6050 SCL
        └─→ DS3231 SCL
```

**Note:** MPU-6050 and DS3231 have the same I2C address (0x68), but they have different registers and can coexist on the same bus.

---

## Power Supply Recommendations

### Option 1: Separate Power
```
12V Battery
    ├─→ Buck Converter (12V → 5V) → ESP32 VIN
    └─→ L298N 12V input → Motors
```

### Option 2: USB + Battery
```
USB Cable → ESP32 USB port (for programming & power)
12V Battery → L298N only (for motors)
```

### Option 3: All-in-One
```
12V Battery
    ├─→ Buck Converter (12V → 5V) → ESP32 VIN + Sensors
    └─→ L298N 12V input → Motors
```

---

## Safety Considerations

1. **Common Ground**: Always connect all GND pins together
2. **Voltage Levels**: ESP32 is 3.3V logic, be careful with 5V modules
3. **Power Rating**: Ensure power supply can handle motor current
4. **Decoupling Capacitors**: Add 100µF capacitor near ESP32 VIN
5. **Motor Noise**: Add capacitors (100nF) across motor terminals
6. **Fuse**: Use appropriate fuse on battery positive line

---

## Physical Layout Suggestions

```
Boat Layout (Top View) - 360° Sensor Coverage

              [Front HC-SR04]
                    |
    [Left HC-SR04]  |  [Right HC-SR04]
           |        |        |
    ===========================================
    |                                         |
    |  [MPU-6050]      [ESP32]      [RTC]    |
    |                                         |
    |  [HX711]    [Voltage Sensor]   [Relay] |
    |                                         |
    |       [L298N Motor Driver]              |
    |                                         |
    |  [Left Motor]           [Right Motor]   |
    ===========================================
           |        |        |
       Propeller    |    Propeller
              [Back HC-SR04]

**4 Ultrasonic Sensors provide 360° coverage:**
- Front: Forward obstacle detection
- Back: Reverse obstacle detection  
- Left: Port side monitoring
- Right: Starboard side monitoring
```

---

## Testing Checklist

- [ ] Check all connections with multimeter
- [ ] Verify 3.3V on sensor VCC pins
- [ ] Test each sensor individually
- [ ] Verify I2C communication (MPU & RTC)
- [ ] Test motors without propellers first
- [ ] Calibrate HX711 load cell
- [ ] Adjust LDR threshold
- [ ] Verify ultrasonic sensor distances
- [ ] Test relay operation
- [ ] Monitor serial output for errors

---

## Troubleshooting Guide

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| ESP32 won't boot | Insufficient power | Use adequate power supply (min 500mA) |
| I2C device not found | Wrong wiring | Check SDA/SCL connections |
| Motors not spinning | No 12V power | Check battery and L298N connections |
| HX711 unstable | Poor connections | Use short wires, add capacitor |
| Wrong ultrasonic readings | Timing issues | Check trigger/echo pins |
| Relay not switching | Low current | Check relay signal voltage |

---

## Cable Length Recommendations

- **I2C Bus**: Keep under 30cm for stability
- **Motor Wires**: Use thick gauge (16-18 AWG)
- **Sensor Wires**: 22-24 AWG acceptable
- **Power Lines**: Use thick gauge (14-16 AWG)
- **Ground**: Always use thick wire

---

## Color Coding Suggestions

- **Red**: Positive power (+3.3V, +5V, +12V)
- **Black**: Ground (GND)
- **Yellow**: Signal/Data lines
- **Green**: I2C SDA
- **Blue**: I2C SCL
- **White**: PWM signals
- **Orange**: Trigger signals

---

**Document Version:** 1.0  
**Date:** November 24, 2025  
**Author:** Koi Fish Friend Team
