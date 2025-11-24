# Two-Board System: ESP32 + Arduino Pro Mini

## Why Two Boards?

**Problem:** GPIO 8, 9, 10, 11 on ESP32 are **flash memory pins** and GPIO 0, 1, 3 cause **boot conflicts**. Using them crashes the system.

**Solution:** Move problematic components to Arduino Pro Mini and communicate via **I2C**.

---

## System Architecture

```
┌─────────────────────────────────────┐
│         ESP32 (Main Controller)      │
│  ✅ Voltage Sensor (GPIO 34)         │
│  ✅ HX711 Load Cell (GPIO 16,17)     │
│  ✅ LDR Sensor (GPIO 35)             │
│  ✅ MPU-6050 (I2C: GPIO 21,22)       │
│  ✅ L298N Motors (GPIO 25,26,14...)  │
│  ✅ Front Ultrasonic (GPIO 18,19)    │
│  ✅ Left Ultrasonic (GPIO 4,15)      │
│  ✅ Right Ultrasonic (GPIO 2,12)     │
│  ✅ DS3231 RTC (I2C: GPIO 21,22)     │
│  ✅ Relay (GPIO 13)                  │
│  ✅ WiFi/Bluetooth (built-in)        │
└─────────────────────────────────────┘
            │ I2C (SDA, SCL)
            ↓
┌─────────────────────────────────────┐
│    Arduino Pro Mini (Secondary)      │
│  ✅ OLED Display (D10,D9,D8,D7)      │
│  ✅ Back Ultrasonic (D2,D3)          │
│  ✅ Feeding Motor ESC (D6)           │
│  ✅ Stepper Driver (D4,D5)           │
│  ✅ I2C Slave (A4,A5) - Address 0x08 │
└─────────────────────────────────────┘
```

---

## I2C Connection (3 Wires)

| ESP32          | Arduino Pro Mini | Description          |
|----------------|------------------|----------------------|
| GPIO 21 (SDA)  | A4 (SDA)         | I2C Data             |
| GPIO 22 (SCL)  | A5 (SCL)         | I2C Clock            |
| GND            | GND              | Common Ground        |

**Note:** Both boards share the I2C bus with MPU-6050 and DS3231 RTC.

---

## Arduino Pro Mini Wiring

### OLED Display (SSD1306 0.96" SPI)
| OLED Pin | Arduino Pin | Description       |
|----------|-------------|-------------------|
| VCC      | 3.3V        | Power             |
| GND      | GND         | Ground            |
| MOSI/SDA | D10         | SPI Data          |
| SCK/SCL  | D9          | SPI Clock         |
| DC       | D8          | Data/Command      |
| CS       | D7          | Chip Select       |
| RES      | Not used    | Reset (optional)  |

### Back Ultrasonic Sensor (HC-SR04)
| HC-SR04 Pin | Arduino Pin |
|-------------|-------------|
| VCC         | 5V          |
| GND         | GND         |
| TRIG        | D2          |
| ECHO        | D3          |

### Feeding Motor (A2212 Brushless + ESC)
| ESC Wire    | Arduino Pin   |
|-------------|---------------|
| Signal      | D6 (PWM)      |
| VCC (Red)   | 12V Battery   |
| GND (Black) | Common GND    |

### Stepper Motor (A4988 Driver)
| A4988 Pin | Arduino Pin | Notes                   |
|-----------|-------------|-------------------------|
| STEP      | D4          | Step pulse              |
| DIR       | D5          | Direction               |
| EN        | GND         | Always enabled          |
| VMOT      | 12V         | Motor power             |
| GND       | GND         | Ground                  |
| MS1,MS2,MS3| Floating   | Full step mode          |
| 1A,1B,2A,2B| Stepper    | Motor coils             |

### Power Supply
- **Arduino Pro Mini**: 5V from ESP32 or external regulator
- **Motors**: 12V battery
- **Common Ground**: All GND connected together

---

## Communication Protocol

### ESP32 → Arduino (Send Commands)
```cpp
// Set feeding motor speed (0-180)
sendArduinoCommand("FEED:90");

// Step motor forward 100 steps
sendArduinoCommand("STEP:100");

// Set stepper direction (1=forward, 0=backward)
sendArduinoCommand("DIR:1");

// Update OLED display lines
sendArduinoCommand("DISP1:Voltage: 12.5V");
sendArduinoCommand("DISP2:Weight: 2.34kg");
sendArduinoCommand("DISP3:Temp: 25.5C");
sendArduinoCommand("DISP4:Status: OK");
```

### Arduino → ESP32 (Send Data)
```cpp
// Read back ultrasonic distance (automatic every 1 second)
readArduinoProMini();  // Updates distanceBack variable
```

---

## Upload Instructions

### 1. Upload to Arduino Pro Mini
1. Connect **FTDI adapter** to Arduino Pro Mini (TX→RX, RX→TX, GND→GND, 5V→VCC)
2. Select: **Tools → Board → Arduino Pro or Pro Mini**
3. Select: **Tools → Processor → ATmega328P (5V, 16MHz)**
4. Select correct **COM port**
5. Upload `ArduinoProMini_Secondary.ino`

### 2. Upload to ESP32
1. **Unplug ESP32** from female headers
2. Connect via USB
3. Select: **Tools → Board → ESP32 Dev Module**
4. Upload `Kushanesp32.ino`
5. Disconnect USB
6. **Plug ESP32 back** into female headers

### 3. Connect I2C
- Wire GPIO 21 (ESP32) to A4 (Arduino)
- Wire GPIO 22 (ESP32) to A5 (Arduino)
- Connect GND between both boards

### 4. Power On
- ESP32 should boot successfully
- Arduino Pro Mini will show "Koi Fish Friend" on OLED
- Serial Monitor (115200 baud) shows all sensor data

---

## Testing Commands

Add these functions to ESP32 code to test the feeding system:

```cpp
void testFeedingSystem() {
  // Test feeding motor
  sendArduinoCommand("FEED:0");    // Stop
  delay(1000);
  sendArduinoCommand("FEED:90");   // Medium speed
  delay(2000);
  sendArduinoCommand("FEED:180");  // Full speed
  delay(2000);
  sendArduinoCommand("FEED:0");    // Stop
  
  // Test stepper
  sendArduinoCommand("DIR:1");     // Forward
  sendArduinoCommand("STEP:200");  // 200 steps forward
  delay(1000);
  sendArduinoCommand("DIR:0");     // Backward
  sendArduinoCommand("STEP:200");  // 200 steps backward
  
  // Update display
  sendArduinoCommand("DISP1:Feed Test OK");
  sendArduinoCommand("DISP2:Stepper OK");
}
```

---

## Troubleshooting

### ESP32 Still Boot Looping
- Make sure OLED, feeding motor, and stepper are commented out in ESP32 code
- Verify GPIO 8,9,10,11 are NOT used by ESP32

### Arduino Pro Mini Not Responding
- Check I2C connections (SDA, SCL, GND)
- Use I2C scanner to verify address 0x08
- Ensure 5V power to Arduino

### OLED Not Working
- Check SPI wiring (MOSI, CLK, DC, CS)
- Verify Adafruit_SSD1306 library installed
- Try changing I2C address in OLED setup

### Back Ultrasonic Returns 0
- Check TRIG and ECHO connections
- Verify 5V power to sensor
- Ensure sensor faces backward with no obstructions

---

## Advantages of This Setup

✅ **ESP32 boots reliably** (no flash pin conflicts)  
✅ **All sensors work** (OLED, feeding system, 4 ultrasonic)  
✅ **Simple I2C communication** (only 3 wires)  
✅ **Display always visible** (Arduino handles OLED independently)  
✅ **No soldering changes needed** (just add Arduino + 3 wires)  
✅ **Easy to debug** (each board can be tested separately)  
✅ **Expandable** (Arduino can handle more sensors if needed)

---

## Total Pin Usage

### ESP32 (28 pins used)
| GPIO | Function              |
|------|-----------------------|
| 34   | Voltage Sensor (ADC)  |
| 35   | LDR Sensor (ADC)      |
| 13   | Relay                 |
| 16   | HX711 DOUT            |
| 17   | HX711 SCK             |
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
| 4    | Ultrasonic Left TRIG  |
| 15   | Ultrasonic Left ECHO  |
| 2    | Ultrasonic Right TRIG |
| 12   | Ultrasonic Right ECHO |
| 23   | Ultrasonic Back TRIG (unused) |

### Arduino Pro Mini (11 pins used)
| Pin  | Function              |
|------|-----------------------|
| D10  | OLED MOSI             |
| D9   | OLED CLK              |
| D8   | OLED DC               |
| D7   | OLED CS               |
| D2   | Back Ultrasonic TRIG  |
| D3   | Back Ultrasonic ECHO  |
| D6   | Feeding Motor ESC PWM |
| D4   | Stepper STEP          |
| D5   | Stepper DIR           |
| A4   | I2C SDA               |
| A5   | I2C SCL               |

---

You now have a **fully functional two-board system!** 🎉
