# Koi Fish Friend - Wiring Diagram (Simplified System)

## System Overview

**ESP32 Only** - All sensors connected directly to ESP32 board. No secondary controllers needed.

---

## Complete Wiring Guide

### Power Distribution

```
12V Battery
    ├─── L298N Motor Driver (12V Input)
    ├─── Voltage Sensor (VIN)
    └─── ESP32 (via voltage regulator to 3.3V)

Common Ground (GND)
    ├─── ESP32 GND
    ├─── L298N GND
    ├─── All Sensors GND
    └─── Battery Negative (-)
```

**Important**: All components must share a common ground!

---

## 1. Voltage Sensor (MD0492)

| Sensor Pin | ESP32 Pin | Wire Color (suggested) |
|------------|-----------|------------------------|
| VCC        | 3.3V      | Red                    |
| GND        | GND       | Black                  |
| S (Signal) | GPIO 34   | Yellow                 |

**Note**: Connect voltage divider between battery and sensor input.

---

## 2. Relay Module

| Relay Pin | ESP32 Pin | Wire Color (suggested) |
|-----------|-----------|------------------------|
| VCC       | 3.3V      | Red                    |
| GND       | GND       | Black                  |
| IN        | GPIO 13   | Yellow                 |
| COM       | Load      | -                      |
| NO/NC     | Load      | -                      |

---

## 3. MPU-6050 Accelerometer & Gyroscope (I2C)

| MPU-6050 Pin | ESP32 Pin | Wire Color (suggested) |
|--------------|-----------|------------------------|
| VCC          | 3.3V      | Red                    |
| GND          | GND       | Black                  |
| SDA          | GPIO 21   | Blue                   |
| SCL          | GPIO 22   | Green                  |

**I2C Address**: 0x68

---

## 4. OLED Display 0.96" SSD1306 (SPI Mode)

| OLED Pin | ESP32 Pin | Wire Color (suggested) |
|----------|-----------|------------------------|
| VCC      | 3.3V      | Red                    |
| GND      | GND       | Black                  |
| D0 (SCK) | GPIO 16   | Purple                 |
| D1 (MOSI)| GPIO 17   | Blue                   |
| RES      | Not connected | -                  |
| DC       | GPIO 5    | Orange                 |
| CS       | GPIO 23   | Green                  |

**Interface**: SPI (7-pin module)

**Note**: RES (Reset) pin can be left unconnected (code uses -1).

---

## 5. L298N Motor Driver

### Power Connections
| L298N Pin | Connection        | Wire Gauge    |
|-----------|-------------------|---------------|
| +12V      | Battery Positive  | 18 AWG        |
| GND       | Battery Negative  | 18 AWG        |
| +5V       | Not connected     | -             |

### Motor Connections
| L298N Output | Motor              |
|--------------|--------------------|
| OUT1         | Left Motor (+)     |
| OUT2         | Left Motor (-)     |
| OUT3         | Right Motor (+)    |
| OUT4         | Right Motor (-)    |

### Control Connections (Left Motor)
| L298N Pin | ESP32 Pin | Function         |
|-----------|-----------|------------------|
| IN1       | GPIO 25   | Direction 1      |
| IN2       | GPIO 26   | Direction 2      |
| ENA       | GPIO 14   | Speed (PWM)      |

### Control Connections (Right Motor)
| L298N Pin | ESP32 Pin | Function         |
|-----------|-----------|------------------|
| IN3       | GPIO 27   | Direction 1      |
| IN4       | GPIO 32   | Direction 2      |
| ENB       | GPIO 33   | Speed (PWM)      |

**Important**: Remove jumpers from ENA and ENB for PWM speed control.

---

## 6. HC-SR04 Ultrasonic Sensors (4 Units)

### Front Sensor
| HC-SR04 Pin | ESP32 Pin | Wire Color (suggested) |
|-------------|-----------|------------------------|
| VCC         | 5V        | Red                    |
| GND         | GND       | Black                  |
| TRIG        | GPIO 18   | Orange                 |
| ECHO        | GPIO 19   | Yellow                 |

### Back Sensor
| HC-SR04 Pin | ESP32 Pin | Wire Color (suggested) |
|-------------|-----------|------------------------|
| VCC         | 5V        | Red                    |
| GND         | GND       | Black                  |
| TRIG        | GPIO 0    | Orange                 |
| ECHO        | GPIO 35   | Yellow                 |

### Left Sensor
| HC-SR04 Pin | ESP32 Pin | Wire Color (suggested) |
|-------------|-----------|------------------------|
| VCC         | 5V        | Red                    |
| GND         | GND       | Black                  |
| TRIG        | GPIO 4    | Orange                 |
| ECHO        | GPIO 15   | Yellow                 |

### Right Sensor
| HC-SR04 Pin | ESP32 Pin | Wire Color (suggested) |
|-------------|-----------|------------------------|
| VCC         | 5V        | Red                    |
| GND         | GND       | Black                  |
| TRIG        | GPIO 2    | Orange                 |
| ECHO        | GPIO 12   | Yellow                 |

**Note**: HC-SR04 sensors require 5V power but output 5V logic. ESP32 GPIOs are 5V tolerant on input pins.

---

## Complete Pin Summary

| ESP32 GPIO | Function                    | Module               |
|------------|-----------------------------|----------------------|
| 34         | Voltage Sensor (Analog)     | MD0492               |
| 13         | Relay Control               | Relay Module         |
| 21         | I2C SDA                     | MPU-6050             |
| 22         | I2C SCL                     | MPU-6050             |
| 16         | OLED D0 (SCK)               | SSD1306 OLED         |
| 17         | OLED D1 (MOSI)              | SSD1306 OLED         |
| 5          | OLED DC                     | SSD1306 OLED         |
| 23         | OLED CS                     | SSD1306 OLED         |
| 25         | Left Motor IN1              | L298N                |
| 26         | Left Motor IN2              | L298N                |
| 14         | Left Motor Enable (PWM)     | L298N                |
| 27         | Right Motor IN1             | L298N                |
| 32         | Right Motor IN2             | L298N                |
| 33         | Right Motor Enable (PWM)    | L298N                |
| 18         | Front Ultrasonic TRIG       | HC-SR04 #1           |
| 19         | Front Ultrasonic ECHO       | HC-SR04 #1           |
| 0          | Back Ultrasonic TRIG        | HC-SR04 #2           |
| 35         | Back Ultrasonic ECHO        | HC-SR04 #2           |
| 4          | Left Ultrasonic TRIG        | HC-SR04 #3           |
| 15         | Left Ultrasonic ECHO        | HC-SR04 #3           |
| 2          | Right Ultrasonic TRIG       | HC-SR04 #4           |
| 12         | Right Ultrasonic ECHO       | HC-SR04 #4           |

**Total Pins Used**: 22 out of 38 available

---

## Physical Layout Suggestions

```
                    [FRONT]
                  
            [Front Ultrasonic]
                  
    [Left]  [ESP32 + OLED]  [Right]
    [Ultra]  [MPU-6050]     [Ultra]
    
    [Motor]   [L298N]   [Motor]
     Left               Right
     
            [Back Ultrasonic]
            
                    [BACK]
                    
    [Battery]  [Voltage Sensor]
    [12V]      [Relay Module]
```

---

## Mounting Guidelines

1. **ESP32**: Center of boat, in waterproof enclosure
2. **MPU-6050**: Close to ESP32, firmly mounted (avoid vibration)
3. **OLED Display**: Visible through clear window
4. **Ultrasonic Sensors**: 
   - Front: Facing forward direction
   - Back: Facing backward direction
   - Left: 90° left from forward
   - Right: 90° right from forward
5. **Motors**: Bottom of boat, sealed propeller shafts
6. **L298N**: Close to motors, good ventilation
7. **Battery**: Lowest point for stability, waterproof
8. **Voltage Sensor**: Near battery
9. **Relay**: Accessible for load connection

---

## Cable Management

- **Power Cables**: 18 AWG for motors, 22 AWG for logic
- **Signal Cables**: 24-26 AWG, twisted pairs for I2C
- **Length**: Keep sensor cables < 30cm to reduce noise
- **Labeling**: Label all connections clearly
- **Waterproofing**: Use heat shrink and silicone sealant
- **Strain Relief**: Cable ties at entry/exit points

---

## Safety Checklist

- [ ] All GND connections tied together
- [ ] No short circuits between power rails
- [ ] Motor driver heatsink installed
- [ ] Battery fuse/circuit breaker installed
- [ ] Waterproof enclosure tested
- [ ] All solder joints insulated
- [ ] Cable routing prevents chafing
- [ ] Emergency power disconnect accessible

---

## Testing Procedure

1. **Power Test**: Measure voltages (3.3V, 5V, 12V)
2. **LED Test**: ESP32 built-in LED blinks
3. **I2C Test**: MPU-6050 and OLED detected
4. **Motor Test**: Both motors spin (no propellers yet)
5. **Sensor Test**: All 4 ultrasonic sensors read distances
6. **Voltage Test**: Relay activates below 8.6V
7. **Display Test**: OLED shows sensor data
8. **Integration Test**: Full system running for 10 minutes

---

## Troubleshooting Wiring Issues

### MPU-6050 Not Detected
- Check SDA/SCL connections (GPIO 21/22)
- Verify 3.3V power
- Try I2C scanner sketch

### OLED Blank Screen
- Check I2C address (0x3C vs 0x3D)
- Verify SDA/SCL shared with MPU-6050
- Check contrast setting in code

### Motors Not Running
- Check L298N 12V power
- Verify ENA/ENB jumpers removed
- Test with multimeter on IN1-IN4

### Ultrasonic Sensors Return 0
- Check 5V power supply
- Verify TRIG/ECHO wiring
- Ensure clear line of sight

### Voltage Sensor Wrong Reading
- Check voltage divider resistors
- Adjust VOLTAGE_DIVIDER_RATIO in code
- Verify connection to GPIO 34

---

## Wire Color Convention (Optional)

| Color  | Purpose              |
|--------|----------------------|
| Red    | +3.3V / +5V / +12V   |
| Black  | Ground (GND)         |
| Yellow | Analog Signal        |
| Orange | Digital Signal       |
| Blue   | I2C SDA              |
| Green  | I2C SCL              |
| White  | PWM Signal           |

---

**Created**: December 22, 2025  
**System**: ESP32 Single-Board Configuration  
**Author**: Koi Fish Friend Team
