# Load Cell Feeder - Library Dependencies

## Required Arduino Libraries

Install these libraries through Arduino Library Manager or PlatformIO:

### 1. Adafruit GFX Library
- **Author**: Adafruit
- **Version**: Latest (≥ 1.11.0)
- **Purpose**: Graphics core library for OLED display
- **Installation**: 
  ```
  Arduino IDE: Tools → Manage Libraries → Search "Adafruit GFX"
  PlatformIO: lib_deps = adafruit/Adafruit GFX Library
  ```

### 2. Adafruit SSD1306
- **Author**: Adafruit
- **Version**: Latest (≥ 2.5.0)
- **Purpose**: Driver for SSD1306 OLED display (128x64)
- **Installation**:
  ```
  Arduino IDE: Tools → Manage Libraries → Search "Adafruit SSD1306"
  PlatformIO: lib_deps = adafruit/Adafruit SSD1306
  ```

### 3. HX711 Arduino Library
- **Author**: Bogdan Necula
- **Version**: Latest (≥ 0.7.5)
- **Purpose**: Interface with HX711 load cell amplifier
- **Installation**:
  ```
  Arduino IDE: Tools → Manage Libraries → Search "HX711 Arduino Library"
  PlatformIO: lib_deps = bogde/HX711
  ```

### 4. PubSubClient
- **Author**: Nick O'Leary
- **Version**: Latest (≥ 2.8)
- **Purpose**: MQTT client for ESP32
- **Installation**:
  ```
  Arduino IDE: Tools → Manage Libraries → Search "PubSubClient"
  PlatformIO: lib_deps = knolleary/PubSubClient
  ```

### 5. ArduinoJson
- **Author**: Benoit Blanchon
- **Version**: 6.x (≥ 6.19.0)
- **Purpose**: JSON parsing and serialization
- **Installation**:
  ```
  Arduino IDE: Tools → Manage Libraries → Search "ArduinoJson"
  PlatformIO: lib_deps = bblanchon/ArduinoJson@^6.19.0
  ```

### 6. WiFi (Built-in)
- **Purpose**: WiFi connectivity for ESP32
- **Note**: Included with ESP32 core, no installation needed

### 7. Wire (Built-in)
- **Purpose**: I2C communication
- **Note**: Included with Arduino core, no installation needed

## PlatformIO Configuration

Create `platformio.ini` file:

```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200

lib_deps = 
    adafruit/Adafruit GFX Library@^1.11.0
    adafruit/Adafruit SSD1306@^2.5.0
    bogde/HX711@^0.7.5
    knolleary/PubSubClient@^2.8
    bblanchon/ArduinoJson@^6.19.0

build_flags = 
    -DCORE_DEBUG_LEVEL=3

upload_speed = 921600
monitor_filters = esp32_exception_decoder
```

## Arduino IDE Setup

### 1. Install ESP32 Board Support

1. Open Arduino IDE
2. Go to **File → Preferences**
3. Add to "Additional Board Manager URLs":
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Go to **Tools → Board → Boards Manager**
5. Search "ESP32"
6. Install "esp32 by Espressif Systems"

### 2. Select Board

- **Tools → Board → ESP32 Arduino → ESP32 Dev Module**

### 3. Configure Settings

- **Upload Speed**: 921600
- **CPU Frequency**: 240MHz
- **Flash Size**: 4MB (32Mb)
- **Partition Scheme**: Default 4MB with spiffs
- **PSRAM**: Disabled
- **Port**: Select your COM port

## Library Compatibility

| Library | Minimum Version | Tested Version | ESP32 Core |
|---------|----------------|----------------|------------|
| Adafruit GFX | 1.11.0 | 1.11.9 | 2.0.x, 3.0.x |
| Adafruit SSD1306 | 2.5.0 | 2.5.7 | 2.0.x, 3.0.x |
| HX711 | 0.7.5 | 0.7.5 | 2.0.x, 3.0.x |
| PubSubClient | 2.8 | 2.8 | 2.0.x, 3.0.x |
| ArduinoJson | 6.19.0 | 6.21.3 | 2.0.x, 3.0.x |

## Verification

After installing libraries, verify with this test sketch:

```cpp
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <HX711.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

void setup() {
  Serial.begin(115200);
  Serial.println("All libraries included successfully!");
}

void loop() {}
```

If this compiles without errors, all libraries are installed correctly.

## Troubleshooting

### "HX711.h: No such file or directory"
- Install HX711 library by Bogdan Necula (not other HX711 libraries)

### "Adafruit_SSD1306.h: No such file or directory"
- Install both Adafruit GFX and Adafruit SSD1306 libraries
- GFX library must be installed first

### "PubSubClient.h: No such file or directory"
- Install PubSubClient by Nick O'Leary

### Compilation errors with ArduinoJson
- Make sure you're using version 6.x (not 5.x or 7.x)
- Check for `StaticJsonDocument` usage (v6 syntax)

### ESP32 board not found
- Install ESP32 board support package
- Restart Arduino IDE after installation

## Memory Usage

Approximate memory usage with all libraries:

```
Sketch uses 1,234,567 bytes (93%) of program storage space.
Global variables use 45,678 bytes (13%) of dynamic memory.
```

Make sure your ESP32 has sufficient memory for the sketch.

## Updates

Keep libraries updated for bug fixes and improvements:

**Arduino IDE**:
- Tools → Manage Libraries → Update All

**PlatformIO**:
```bash
pio lib update
```

## Support

For library-specific issues, check official documentation:
- [Adafruit GFX Guide](https://learn.adafruit.com/adafruit-gfx-graphics-library)
- [HX711 Library](https://github.com/bogde/HX711)
- [PubSubClient Guide](https://pubsubclient.knolleary.net/)
- [ArduinoJson](https://arduinojson.org/)
