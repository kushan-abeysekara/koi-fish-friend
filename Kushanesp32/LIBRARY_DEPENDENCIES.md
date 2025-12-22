# Library Dependencies - Koi Fish Friend (Simplified System)

This document lists all required Arduino libraries for the simplified Koi Fish Friend ESP32 Boat Control System.

---

## Required Libraries (3 Total)

### 1. Wire.h (Built-in)
- **Description**: I2C communication library
- **Version**: Built-in with Arduino IDE
- **Used For**: MPU-6050 and OLED display communication
- **Installation**: No installation needed
- **I2C Pins**: GPIO 21 (SDA), GPIO 22 (SCL)

### 2. MPU6050 Library
- **Name**: MPU6050
- **Author**: Electronic Cats
- **Version**: 0.6.0 or higher
- **Used For**: Accelerometer and gyroscope readings (motion tracking & balance control)
- **I2C Address**: 0x68
- **Installation**:
  - Arduino IDE: Tools → Manage Libraries → Search "MPU6050"
  - Install: **"MPU6050" by Electronic Cats**

**GitHub**: https://github.com/ElectronicCats/mpu6050

### 3. Adafruit GFX Library
- **Name**: Adafruit GFX Library
- **Author**: Adafruit
- **Version**: 1.11.0 or higher
- **Used For**: Graphics core library for OLED display
- **Installation**:
  - Arduino IDE: Tools → Manage Libraries → Search "Adafruit GFX"
  - Install: **"Adafruit GFX Library" by Adafruit**

**GitHub**: https://github.com/adafruit/Adafruit-GFX-Library

### 4. Adafruit SSD1306
- **Name**: Adafruit SSD1306
- **Author**: Adafruit
- **Version**: 2.5.0 or higher
- **Used For**: OLED display (SSD1306 controller) communication via I2C
- **I2C Address**: 0x3C (default)
- **Installation**:
  - Arduino IDE: Tools → Manage Libraries → Search "Adafruit SSD1306"
  - Install: **"Adafruit SSD1306" by Adafruit**

**GitHub**: https://github.com/adafruit/Adafruit_SSD1306

---

## Quick Installation Guide

### Step-by-Step Installation

1. Open Arduino IDE
2. Go to **Tools** → **Manage Libraries** (or Ctrl+Shift+I)
3. Install each library by searching and clicking **Install**:

```
Search: "MPU6050"
→ Install: MPU6050 by Electronic Cats

Search: "Adafruit GFX"
→ Install: Adafruit GFX Library by Adafruit

Search: "Adafruit SSD1306"
→ Install: Adafruit SSD1306 by Adafruit
```

4. Wait for "INSTALLED" confirmation for each
5. Restart Arduino IDE (recommended)

**Installation time**: ~2 minutes for all libraries

---

## Library Verification

### Check Installed Libraries

1. Go to **Sketch** → **Include Library**
2. Verify these appear in the list:
   - ✅ MPU6050
   - ✅ Adafruit GFX Library
   - ✅ Adafruit SSD1306
   - ✅ Wire (in "Built-in Libraries" section)

### Test Compilation

1. Open `Kushanesp32.ino`
2. Click **Verify** (✓ icon)
3. Should compile without errors

---

## Version Compatibility

| Library | Minimum Version | Tested Version | ESP32 Core | Status |
|---------|----------------|----------------|------------|--------|
| Wire.h | Built-in | Built-in | All | ✅ Stable |
| MPU6050 | 0.5.0 | 0.6.0 | 2.x, 3.x | ✅ Stable |
| Adafruit GFX | 1.10.0 | 1.11.0 | 2.x, 3.x | ✅ Stable |
| Adafruit SSD1306 | 2.4.0 | 2.5.0 | 2.x, 3.x | ✅ Stable |

**Recommended ESP32 Core**: 2.0.14 or 3.0.0+

---

## ESP32 Board Support

### Installation Steps

Before installing libraries, ensure ESP32 board support is installed:

1. Open Arduino IDE
2. Go to **File** → **Preferences**
3. In "Additional Board Manager URLs", add:
   ```
   https://dl.espressif.com/dl/package_esp32_index.json
   ```
4. Go to **Tools** → **Board** → **Boards Manager**
5. Search for **"ESP32"**
6. Install **"esp32" by Espressif Systems**
7. Select **Tools** → **Board** → **ESP32 Arduino** → **ESP32 Dev Module**

---

## Library Documentation

### MPU6050
- **Documentation**: https://github.com/ElectronicCats/mpu6050
- **Datasheet**: https://invensense.tdk.com/products/motion-tracking/6-axis/mpu-6050/
- **API Functions**:
  - `mpu.initialize()` - Initialize sensor
  - `mpu.testConnection()` - Check I2C connection
  - `mpu.getMotion6()` - Read accel & gyro data
  - `mpu.getTemperature()` - Read internal temperature

### Adafruit GFX
- **Documentation**: https://learn.adafruit.com/adafruit-gfx-graphics-library
- **API Reference**: https://adafruit.github.io/Adafruit-GFX-Library/html/class_adafruit___g_f_x.html
- **Common Functions**:
  - `display.print()` - Print text
  - `display.setCursor(x, y)` - Set cursor position
  - `display.setTextSize(n)` - Set text size
  - `display.drawPixel(x, y, color)` - Draw single pixel

### Adafruit SSD1306
- **Documentation**: https://learn.adafruit.com/monochrome-oled-breakouts/arduino-library-and-examples
- **API Reference**: https://adafruit.github.io/Adafruit_SSD1306/html/class_adafruit___s_s_d1306.html
- **Common Functions**:
  - `display.begin()` - Initialize OLED
  - `display.clearDisplay()` - Clear screen buffer
  - `display.display()` - Update screen
  - `display.dim(true/false)` - Dim/brighten display

---

## Troubleshooting

### ❌ Library Not Found During Compilation

**Error**: `fatal error: MPU6050.h: No such file or directory`

**Solution**:
1. Go to **Tools** → **Manage Libraries**
2. Search for the missing library name
3. Click **Install**
4. Restart Arduino IDE
5. Try compiling again

---

### ❌ Multiple Library Versions Installed

**Error**: `Multiple libraries found for "XXX.h"`

**Solution**:
1. Go to Arduino libraries folder:
   - Windows: `Documents\Arduino\libraries\`
   - Mac: `~/Documents/Arduino/libraries/`
   - Linux: `~/Arduino/libraries/`
2. Delete duplicate library folders
3. Keep only the latest version
4. Restart Arduino IDE

---

### ❌ MPU6050 Connection Failed

**Error**: `MPU6050 connection failed!` in Serial Monitor

**Solution**:
- Check wiring: SDA → GPIO 21, SCL → GPIO 22
- Verify 3.3V power to MPU-6050
- Check I2C address (should be 0x68)
- Run I2C scanner sketch to detect device

**I2C Scanner Code**:
```cpp
#include <Wire.h>
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  Serial.println("I2C Scanner");
}
void loop() {
  for(byte i = 1; i < 127; i++) {
    Wire.beginTransmission(i);
    if(Wire.endTransmission() == 0) {
      Serial.print("Found: 0x");
      Serial.println(i, HEX);
    }
  }
  delay(5000);
}
```

---

### ❌ OLED Display Not Working

**Error**: `SSD1306 allocation failed!` in Serial Monitor

**Solution**:
- Check wiring: SDA → GPIO 21, SCL → GPIO 22
- Verify OLED is **I2C version** (not SPI)
- Check I2C address (0x3C or 0x3D)
- Try changing `SCREEN_ADDRESS` in code:
  ```cpp
  #define SCREEN_ADDRESS 0x3C  // or try 0x3D
  ```
- Ensure OLED has power (3.3V or 5V depending on model)

---

### ❌ ESP32 Board Not Found

**Error**: Board selection shows no ESP32 boards

**Solution**:
1. Reinstall ESP32 board support
2. Check board manager URL is correct
3. Verify internet connection during installation
4. Try removing and re-adding the URL
5. Restart Arduino IDE

---

## Library Update Procedure

### Check for Updates

1. Go to **Tools** → **Manage Libraries**
2. Filter by **"Updatable"**
3. Click **Update** for each outdated library
4. Wait for completion
5. Restart Arduino IDE

### When to Update

- ✅ Bug fixes released
- ✅ New features needed
- ✅ Compatibility issues with ESP32 core
- ⚠️ Avoid updating if system is working fine

---

## Testing Libraries

### Quick Test Sketch

Use this to verify all libraries are working:

```cpp
#include <Wire.h>
#include <MPU6050.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C

MPU6050 mpu;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  
  // Test MPU6050
  mpu.initialize();
  if (mpu.testConnection()) {
    Serial.println("✅ MPU6050 OK");
  } else {
    Serial.println("❌ MPU6050 Failed");
  }
  
  // Test OLED
  if(display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println("✅ OLED OK");
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("All Libraries OK!");
    display.display();
  } else {
    Serial.println("❌ OLED Failed");
  }
}

void loop() {
  // Do nothing
}
```

**Expected Output**:
```
✅ MPU6050 OK
✅ OLED OK
```

---

## Complete Setup Checklist

- [ ] Arduino IDE installed (1.8.19+ or 2.x)
- [ ] ESP32 board support installed (2.0.14+ or 3.0.0+)
- [ ] MPU6050 library installed
- [ ] Adafruit GFX library installed
- [ ] Adafruit SSD1306 library installed
- [ ] Board selected: **ESP32 Dev Module**
- [ ] USB driver installed (CP210x or CH340)
- [ ] Port selected in **Tools** → **Port**
- [ ] Upload speed: **921600**
- [ ] Serial Monitor baud rate: **115200**

---

## Alternative Libraries (Not Recommended)

These libraries can work but are **not supported** in this project:

### For MPU6050
- ❌ I2Cdevlib (complex setup)
- ❌ Adafruit MPU6050 (different API)
- ❌ MPU6050_tockn (limited features)

**Stick with "MPU6050" by Electronic Cats**

### For OLED
- ❌ U8g2 library (different API)
- ❌ SSD1306 by Lexus (limited features)

**Stick with Adafruit libraries**

---

## Library File Locations

### Windows
```
C:\Users\<YourName>\Documents\Arduino\libraries\
├── MPU6050\
├── Adafruit_GFX_Library\
└── Adafruit_SSD1306\
```

### Mac
```
~/Documents/Arduino/libraries/
├── MPU6050/
├── Adafruit_GFX_Library/
└── Adafruit_SSD1306/
```

### Linux
```
~/Arduino/libraries/
├── MPU6050/
├── Adafruit_GFX_Library/
└── Adafruit_SSD1306/
```

---

## Support & Resources

### Official Documentation
- **Arduino Libraries**: https://www.arduino.cc/en/guide/libraries
- **ESP32 Arduino Core**: https://docs.espressif.com/projects/arduino-esp32/

### Community Support
- **Arduino Forum**: https://forum.arduino.cc/
- **ESP32 Forum**: https://www.esp32.com/
- **Adafruit Forum**: https://forums.adafruit.com/

### GitHub Issues
- **MPU6050**: https://github.com/ElectronicCats/mpu6050/issues
- **Adafruit GFX**: https://github.com/adafruit/Adafruit-GFX-Library/issues
- **Adafruit SSD1306**: https://github.com/adafruit/Adafruit_SSD1306/issues

---

## Summary

**Total Libraries Required**: 3 (plus 1 built-in)

1. ✅ Wire.h (built-in)
2. ✅ MPU6050 (Electronic Cats)
3. ✅ Adafruit GFX Library
4. ✅ Adafruit SSD1306

**Installation Time**: ~2 minutes  
**Disk Space**: ~5 MB total  
**Compatibility**: ESP32 Arduino Core 2.x and 3.x

---

**Document Version**: 2.0 (Simplified System)  
**Last Updated**: December 22, 2025  
**Maintained By**: Koi Fish Friend Team
