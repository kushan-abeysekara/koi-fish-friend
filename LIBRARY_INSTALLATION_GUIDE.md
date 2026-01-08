# 📚 Required Arduino Libraries Installation

## Quick Install Guide

### Method 1: Arduino IDE Library Manager (Recommended)

1. **Open Arduino IDE**
2. **Go to**: Tools → Manage Libraries... (or Ctrl+Shift+I)
3. **Install these libraries:**

#### 1. WebSocketsServer
```
Search: "websockets"
Library: WebSocketsServer by Markus Sattler
Version: 2.3.6 or later
Click: Install
```

#### 2. ArduinoJson
```
Search: "arduinojson"
Library: ArduinoJson by Benoit Blanchon
Version: 6.21.3 or later (NOT version 7.x)
Click: Install
```

#### 3. Verify Existing Libraries

These should already be installed:
- ✅ WiFi (built-in with ESP32)
- ✅ Wire (built-in)
- ✅ PubSubClient (should be installed already)
- ✅ Adafruit_SSD1306
- ✅ Adafruit_GFX
- ✅ MPU6050

---

## Installation Screenshots Guide

### Step 1: Open Library Manager
```
Arduino IDE → Tools → Manage Libraries
or press: Ctrl + Shift + I
```

### Step 2: Search for WebSocketsServer
```
1. Type "websockets" in search box
2. Find "WebSocketsServer by Markus Sattler"
3. Select version 2.3.6 or later
4. Click "Install"
5. Wait for "Installed" message
```

### Step 3: Search for ArduinoJson
```
1. Type "arduinojson" in search box
2. Find "ArduinoJson by Benoit Blanchon"
3. ⚠️ IMPORTANT: Select version 6.x (NOT 7.x)
   Version 6.21.3 recommended
4. Click "Install"
5. Wait for "Installed" message
```

---

## Method 2: Manual Installation (If Library Manager Fails)

### WebSocketsServer Manual Install:

1. Download: https://github.com/Links2004/arduinoWebSockets/releases
2. Get latest release ZIP (e.g., `2.3.6.zip`)
3. Arduino IDE → Sketch → Include Library → Add .ZIP Library
4. Select downloaded ZIP file
5. Restart Arduino IDE

### ArduinoJson Manual Install:

1. Download: https://github.com/bblanchon/ArduinoJson/releases
2. Get version 6.21.3 ZIP (NOT 7.x)
3. Arduino IDE → Sketch → Include Library → Add .ZIP Library
4. Select downloaded ZIP file
5. Restart Arduino IDE

---

## Verification

### Check if Libraries are Installed:

1. **Arduino IDE → Sketch → Include Library**
2. Look for:
   - ✅ WebSocketsServer
   - ✅ ArduinoJson
   - ✅ PubSubClient
   - ✅ Adafruit SSD1306
   - ✅ Adafruit GFX Library
   - ✅ MPU6050

### Test Compile:

1. Open: `Kushanesp32/Kushanesp32.ino`
2. Click: Verify ✓ button (don't upload yet)
3. Should compile without errors

**Expected Output:**
```
Compiling...
Sketch uses XXXXX bytes (XX%) of program storage space.
Global variables use XXXXX bytes (XX%) of dynamic memory.
```

**If you see errors**, check "Troubleshooting" below.

---

## Troubleshooting

### Error: "WebSocketsServer.h: No such file or directory"

**Solution:**
```
1. Reinstall WebSocketsServer library
2. Restart Arduino IDE
3. Make sure you selected the correct board (ESP32 Dev Module)
```

### Error: "ArduinoJson.h: No such file or directory"

**Solution:**
```
1. Reinstall ArduinoJson library
2. Restart Arduino IDE
3. Ensure version 6.x (NOT 7.x)
```

### Error: "StaticJsonDocument was not declared"

**Solution:**
```
Wrong ArduinoJson version (you have 7.x, need 6.x)

1. Tools → Manage Libraries
2. Search "ArduinoJson"
3. Uninstall current version
4. Install version 6.21.3
5. Restart Arduino IDE
```

### Error: Compilation fails with WebSocket errors

**Check ESP32 Board Package:**
```
1. File → Preferences
2. Additional Board Manager URLs:
   https://dl.espressif.com/dl/package_esp32_index.json
3. Tools → Board → Boards Manager
4. Search "esp32"
5. Install "ESP32 by Espressif Systems" version 2.0.0 or later
```

### Library Version Conflicts

**If you see strange errors:**
```
1. Remove all ESP32 libraries:
   - Windows: C:\Users\YourName\Documents\Arduino\libraries\
   - Mac: ~/Documents/Arduino/libraries/
   - Linux: ~/Arduino/libraries/
   
2. Reinstall one by one via Library Manager
3. Restart Arduino IDE between installations
```

---

## After Installation

### Next Steps:

1. ✅ Libraries installed
2. ✅ Arduino IDE restarted
3. ✅ Test compile succeeded
4. ➡️ Upload to ESP32
5. ➡️ Open Serial Monitor (115200 baud)
6. ➡️ Watch for "WebSocket server started"

### Serial Monitor Expected Output:

```
Koi Fish Friend - ESP32 Boat Control System
Initializing...
Motor PWM initialized (LEDC)
Initializing MPU-6050...
MPU-6050 connection successful!
✓ WiFi Connected!
IP Address: 192.168.1.100
✓ WebSocket server started on port 81
  Local access: ws://192.168.1.100
✓ MQTT Connected!
Subscribed to: koifish/boat/command
Hybrid Mode: MQTT + WebSocket (local network)
Safety: Watchdog enabled (4s timeout)
========================================
```

### If You See This - Success! ✅

The hybrid communication system is ready to use!

---

## Quick Reference

| Library | Version | Purpose |
|---------|---------|---------|
| WebSocketsServer | 2.3.6+ | Local network communication |
| ArduinoJson | 6.21.3 | JSON parsing for commands |
| PubSubClient | 2.8+ | MQTT communication |
| WiFi | Built-in | ESP32 WiFi connection |
| Adafruit_SSD1306 | Latest | OLED display |
| Adafruit_GFX | Latest | Graphics library |
| MPU6050 | Latest | Gyroscope/accelerometer |

---

## Need Help?

### Library Manager Issues:
- Restart Arduino IDE
- Check internet connection
- Try manual ZIP installation

### Compilation Errors:
- Check board is "ESP32 Dev Module"
- Verify all libraries installed
- Check ArduinoJson is version 6.x

### Still Having Problems?
1. Check Serial Monitor for specific error
2. Copy error message
3. Search error online with "ESP32" keyword
4. Check ESP32 board package is installed

---

**Once all libraries are installed, you're ready to upload the hybrid communication code!** 🚀
