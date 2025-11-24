# Library Dependencies

This document lists all required Arduino libraries for the Koi Fish Friend ESP32 Boat Control System.

## Required Libraries

### 1. Wire.h (Built-in)
- **Description**: I2C communication library
- **Version**: Built-in with Arduino IDE
- **Used For**: MPU-6050 and DS3231 communication
- **Installation**: No installation needed

### 2. HX711 Library
- **Name**: HX711 Arduino Library
- **Author**: Bogdan Necula / Rob Tillaart
- **Version**: 0.7.5 or higher
- **Used For**: Load cell amplifier communication
- **Installation**: 
  - Arduino IDE: Tools → Manage Libraries → Search "HX711"
  - Or: `Arduino Library Manager` → Search "HX711" by Bogdan Necula

**GitHub**: https://github.com/bogde/HX711

### 3. MPU6050 Library
- **Name**: MPU6050
- **Author**: Electronic Cats / Jeff Rowberg
- **Version**: 0.6.0 or higher
- **Used For**: Accelerometer and gyroscope readings
- **Installation**:
  - Arduino IDE: Tools → Manage Libraries → Search "MPU6050"
  - Recommended: "MPU6050" by Electronic Cats

**Alternative**: You can also use "I2Cdevlib" by Jeff Rowberg which includes MPU6050

**GitHub**: https://github.com/ElectronicCats/mpu6050

### 4. RTClib
- **Name**: RTClib
- **Author**: Adafruit
- **Version**: 2.1.1 or higher
- **Used For**: DS3231 RTC module communication
- **Installation**:
  - Arduino IDE: Tools → Manage Libraries → Search "RTClib"
  - Install "RTClib" by Adafruit

**GitHub**: https://github.com/adafruit/RTClib

### 5. Adafruit GFX Library
- **Name**: Adafruit GFX Library
- **Author**: Adafruit
- **Version**: 1.11.0 or higher
- **Used For**: Graphics core library for OLED display
- **Installation**:
  - Arduino IDE: Tools → Manage Libraries → Search "Adafruit GFX"
  - Install "Adafruit GFX Library" by Adafruit

**GitHub**: https://github.com/adafruit/Adafruit-GFX-Library

### 6. Adafruit SSD1306
- **Name**: Adafruit SSD1306
- **Author**: Adafruit
- **Version**: 2.5.0 or higher
- **Used For**: OLED display (SSD1306 controller) communication
- **Installation**:
  - Arduino IDE: Tools → Manage Libraries → Search "Adafruit SSD1306"
  - Install "Adafruit SSD1306" by Adafruit

**GitHub**: https://github.com/adafruit/Adafruit_SSD1306

**Note**: OLED libraries are optional. System will work without them, but display features will be unavailable.

---

## Installation Instructions

### Method 1: Arduino IDE Library Manager (Recommended)

1. Open Arduino IDE
2. Go to **Sketch** → **Include Library** → **Manage Libraries...**
3. In the search box, type the library name
4. Click **Install** for each library

**Step-by-step for each library:**

```
1. Search: "HX711"
   Install: HX711 by Bogdan Necula

2. Search: "MPU6050"
   Install: MPU6050 by Electronic Cats

3. Search: "RTClib"
   Install: RTClib by Adafruit

4. Search: "Adafruit GFX" (For OLED)
   Install: Adafruit GFX Library by Adafruit

5. Search: "Adafruit SSD1306" (For OLED)
   Install: Adafruit SSD1306 by Adafruit
```

### Method 2: Manual Installation

1. Download the library from GitHub (ZIP file)
2. Arduino IDE → **Sketch** → **Include Library** → **Add .ZIP Library...**
3. Select the downloaded ZIP file
4. Restart Arduino IDE

---

## Library Verification

To verify libraries are installed correctly:

1. Go to **Sketch** → **Include Library**
2. Check if the following appear in the list:
   - HX711
   - MPU6050
   - RTClib
   - Wire (should be in "Built-in Libraries")

---

## Version Compatibility

| Library | Minimum Version | Tested Version | Status |
|---------|----------------|----------------|--------|
| Wire.h | Built-in | Built-in | ✅ Stable |
| HX711 | 0.7.0 | 0.7.5 | ✅ Stable |
| MPU6050 | 0.5.0 | 0.6.0 | ✅ Stable |
| RTClib | 2.0.0 | 2.1.1 | ✅ Stable |
| Adafruit GFX | 1.10.0 | 1.11.0 | ✅ Stable |
| Adafruit SSD1306 | 2.4.0 | 2.5.0 | ✅ Stable |

---

## Dependency Issues & Solutions

### Issue 1: MPU6050 Library Not Found

**Solution:**
- Make sure you installed "MPU6050" library, not just "I2Cdev"
- If using I2Cdevlib, you need both I2Cdev and MPU6050 folders
- Alternative: Install "MPU6050" by Electronic Cats (simpler)

### Issue 2: HX711 Compilation Error

**Solution:**
- Update to latest version (0.7.5+)
- Check that you're using ESP32 board definition
- Verify `#include <HX711.h>` is in your code

### Issue 3: RTClib Conflicts

**Solution:**
- Uninstall any other RTC libraries
- Use only Adafruit's RTClib
- Clear Arduino cache and reinstall

### Issue 4: Wire.h Not Found

**Solution:**
- Wire.h is built-in, should always be available
- Reinstall ESP32 board support
- Check Arduino IDE installation

---

## ESP32 Board Support

Before installing libraries, ensure ESP32 board support is installed:

### Installation Steps:

1. Open Arduino IDE
2. Go to **File** → **Preferences**
3. In "Additional Board Manager URLs", add:
   ```
   https://dl.espressif.com/dl/package_esp32_index.json
   ```
4. Go to **Tools** → **Board** → **Boards Manager**
5. Search for "ESP32"
6. Install "esp32" by Espressif Systems
7. Select **Tools** → **Board** → **ESP32 Arduino** → **ESP32 Dev Module**

---

## Complete Setup Checklist

- [ ] Arduino IDE installed (1.8.19+ or 2.x)
- [ ] ESP32 board support installed
- [ ] HX711 library installed
- [ ] MPU6050 library installed
- [ ] RTClib library installed
- [ ] Adafruit GFX library installed (for OLED)
- [ ] Adafruit SSD1306 library installed (for OLED)
- [ ] Board selected: ESP32 Dev Module
- [ ] USB driver installed (CP210x or CH340)
- [ ] Port selected in Tools → Port
- [ ] Baud rate set to 115200 for Serial Monitor

---

## Library Documentation Links

### HX711
- **Documentation**: https://github.com/bogde/HX711/blob/master/README.md
- **Examples**: Arduino IDE → File → Examples → HX711

### MPU6050
- **Documentation**: https://github.com/ElectronicCats/mpu6050/blob/master/README.md
- **Datasheet**: https://invensense.tdk.com/wp-content/uploads/2015/02/MPU-6000-Datasheet1.pdf

### RTClib
- **Documentation**: https://adafruit.github.io/RTClib/html/index.html
- **Tutorial**: https://learn.adafruit.com/ds3231-precision-rtc-breakout

### ESP32
- **Documentation**: https://docs.espressif.com/projects/arduino-esp32/en/latest/
- **API Reference**: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/

---

## Additional Recommended Libraries (Optional)

These are not required but can enhance functionality:

### WiFi & Networking
- **WiFi.h** (Built-in with ESP32)
- **WebServer.h** (Built-in with ESP32)
- **ESPAsyncWebServer** (for advanced web interface)

### Data Logging
- **SD.h** (Built-in) - For SD card logging
- **SPIFFS.h** (Built-in) - For file system

### Bluetooth
- **BluetoothSerial.h** (Built-in with ESP32)

---

## Library Update Procedure

To update libraries:

1. Go to **Sketch** → **Include Library** → **Manage Libraries**
2. Filter by "Updatable"
3. Click **Update** next to outdated libraries
4. Restart Arduino IDE after updates

---

## Troubleshooting Compilation Errors

### Error: "HX711.h: No such file or directory"
```
Solution: Install HX711 library via Library Manager
```

### Error: "MPU6050 was not declared in this scope"
```
Solution: 
1. Install MPU6050 library
2. Check #include <MPU6050.h> is present
3. Verify library is in Arduino/libraries folder
```

### Error: "RTClib.h: No such file or directory"
```
Solution: Install RTClib by Adafruit via Library Manager
```

### Error: "Compilation error: Wire.h not found"
```
Solution: 
1. Reinstall ESP32 board support
2. Verify Arduino IDE installation
3. Check Tools → Board is set to ESP32
```

---

## Testing Libraries

To test if libraries are working:

### Test HX711
```cpp
#include <HX711.h>
HX711 scale;
void setup() {
  Serial.begin(115200);
  scale.begin(16, 17);
  Serial.println("HX711 OK");
}
void loop() {}
```

### Test MPU6050
```cpp
#include <MPU6050.h>
MPU6050 mpu;
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  mpu.initialize();
  Serial.println(mpu.testConnection() ? "MPU6050 OK" : "Failed");
}
void loop() {}
```

### Test RTClib
```cpp
#include <RTClib.h>
RTC_DS3231 rtc;
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  Serial.println(rtc.begin() ? "RTC OK" : "Failed");
}
void loop() {}
```

---

## Contact & Support

If you encounter library issues:
1. Check GitHub issues for the specific library
2. Verify ESP32 board support is up to date
3. Try reinstalling Arduino IDE
4. Check Arduino forum: https://forum.arduino.cc/

---

**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Maintained By:** Koi Fish Friend Team
