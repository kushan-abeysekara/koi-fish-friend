# 🔧 ESP32 Boat Connection Troubleshooting Guide

## ⚠️ Issue: "Boat is disconnected! Please wait for reconnection."

### Quick Diagnostics Checklist

#### 1️⃣ **Is the ESP32 Powered On?**
- [ ] Check if ESP32 board has power LED lit
- [ ] Check USB cable is connected (if using USB power)
- [ ] Check battery voltage (should be > 8.5V)
- [ ] Look for OLED display showing data

#### 2️⃣ **Is ESP32 Code Uploaded?**
- [ ] Open Arduino IDE or PlatformIO
- [ ] Open: `Kushanesp32/Kushanesp32.ino`
- [ ] Select correct board: "ESP32 Dev Module"
- [ ] Select correct COM port
- [ ] Click Upload (➡️ button)
- [ ] Wait for "Done uploading" message

#### 3️⃣ **Check Serial Monitor**
Open Serial Monitor (Ctrl+Shift+M) at 115200 baud and look for:

**✅ Good Output:**
```
Koi Fish Friend - ESP32 Boat Control System
Initializing...
✓ WiFi Connected!
IP Address: 192.168.x.x
✓ MQTT Connected!
Safety: Watchdog enabled (3s timeout)
💓 Heartbeat sent
```

**❌ Bad Output - WiFi Failed:**
```
Connecting to WiFi...
........
✗ WiFi Connection Failed
```
**Fix:** Check WiFi credentials in code (lines 77-78)

**❌ Bad Output - MQTT Failed:**
```
✓ WiFi Connected!
Connecting to MQTT... Failed, rc=-2
```
**Fix:** Check internet connection or MQTT broker

#### 4️⃣ **Verify WiFi Settings**

Current settings in code:
```cpp
const char* ssid = "Dulshan Dialog 4G 643";
const char* password = "Chuki000";
```

**To Change WiFi:**
1. Open `Kushanesp32/Kushanesp32.ino`
2. Find lines 77-78
3. Update to your WiFi name and password
4. Re-upload to ESP32

#### 5️⃣ **Check MQTT Broker Connection**

Test if broker is accessible:

**On Windows PowerShell:**
```powershell
Test-NetConnection -ComputerName broker.hivemq.com -Port 1883
```

**Expected Output:**
```
TcpTestSucceeded : True
```

If False, check your internet connection.

#### 6️⃣ **Frontend Connection Test**

Open browser console (F12) on the boat navigation page:

**✅ Good Output:**
```
✓ Connected to MQTT broker
✓ Subscribed to boat topics
```

**❌ Bad Output:**
```
⚠️ MQTT Error: Connection refused
WebSocket connection failed
```

---

## 🔍 Common Issues & Solutions

### Issue 1: ESP32 Won't Connect to WiFi
**Symptoms:** Serial shows "✗ WiFi Connection Failed"

**Solutions:**
1. Verify WiFi name is EXACTLY correct (case-sensitive)
2. Verify password is correct
3. Check if WiFi is 2.4GHz (ESP32 doesn't support 5GHz)
4. Move ESP32 closer to router
5. Restart ESP32 after code upload

### Issue 2: ESP32 Connects to WiFi but Not MQTT
**Symptoms:** Serial shows "Connected to MQTT... Failed, rc=-2"

**MQTT Error Codes:**
- `-1`: Connection timeout
- `-2`: Connection refused - Server unavailable
- `-3`: Connection refused - Bad protocol
- `-4`: Connection refused - Bad credentials

**Solutions:**
1. Check internet connection
2. Try different MQTT broker: `test.mosquitto.org`
3. Disable firewall temporarily
4. Check if port 1883 is blocked

### Issue 3: Frontend Shows Disconnected
**Symptoms:** Website shows "Boat is disconnected"

**Check These:**
1. Is ESP32 running? (Check serial monitor)
2. Is ESP32 connected to MQTT? (Check serial output)
3. Is frontend connected? (Check browser console F12)
4. Are you using the same MQTT broker? (broker.hivemq.com)
5. Are topics correct? (koifish/boat/*)

### Issue 4: Intermittent Disconnections
**Symptoms:** Connects then disconnects repeatedly

**Solutions:**
1. Check WiFi signal strength (RSSI should be > -70 dBm)
2. Move ESP32 closer to router
3. Check power supply (low voltage can cause resets)
4. Reduce MQTT publish rate
5. Check for WiFi interference

---

## 🚀 Step-by-Step Connection Process

### Step 1: Upload Code to ESP32

```bash
# 1. Open Arduino IDE
# 2. File → Open → Kushanesp32/Kushanesp32.ino
# 3. Tools → Board → ESP32 Dev Module
# 4. Tools → Port → Select your COM port
# 5. Click Upload button (→)
```

### Step 2: Monitor Serial Output

```bash
# 1. Tools → Serial Monitor
# 2. Set baud rate: 115200
# 3. Watch for connection messages
```

Expected output timeline:
```
[0s]    Koi Fish Friend - ESP32 Boat Control System
[1s]    Initializing...
[2s]    ✓ WiFi Connected!
[3s]    IP Address: 192.168.1.100
[4s]    ✓ MQTT Connected!
[5s]    Subscribed to: koifish/boat/command
[6s]    💓 Heartbeat sent
[7s]    ========== Sensor Readings ==========
```

### Step 3: Verify Frontend Connection

```bash
# 1. Open http://localhost:5173/dashboard/boat-navigation
# 2. Press F12 to open browser console
# 3. Look for MQTT connection messages
```

Expected console output:
```
✓ Connected to MQTT broker
✓ Subscribed to boat topics
✓ Sent command: HEARTBEAT
```

### Step 4: Test Control

1. Check status indicator shows "Connected" (green)
2. Click any control button (Forward, Left, Right, etc.)
3. Watch Serial Monitor - should show: "📨 MQTT: {command:...}"
4. Motors should respond

---

## 🔧 Manual Testing Commands

### Test MQTT from Computer

Install MQTT client:
```powershell
# Install mosquitto client
choco install mosquitto
```

Subscribe to sensor data:
```bash
mosquitto_sub -h broker.hivemq.com -t "koifish/boat/#" -v
```

Send test command:
```bash
mosquitto_pub -h broker.hivemq.com -t "koifish/boat/command" -m '{"command":"STOP","speed":0}'
```

---

## 📊 Connection Status Indicators

### Serial Monitor Indicators
- `✓` = Success
- `✗` = Failure
- `⚠️` = Warning
- `💓` = Heartbeat
- `📨` = Message received

### Frontend Indicators
- 🟢 **Green "Connected"** = Everything working
- 🔴 **Red "Disconnected"** = No connection
- **Signal Quality:**
  - Excellent: -30 to -50 dBm
  - Good: -50 to -60 dBm
  - Fair: -60 to -70 dBm
  - Poor: -70 to -80 dBm

---

## 🆘 Emergency Reset Procedure

If nothing works:

1. **Power cycle ESP32:**
   - Unplug power
   - Wait 10 seconds
   - Reconnect power

2. **Re-upload code:**
   - Open Arduino IDE
   - Upload code again
   - Watch serial monitor

3. **Restart frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

4. **Restart router:**
   - Sometimes WiFi needs a reset
   - Wait 30 seconds before reconnecting

---

## 📝 Quick Checklist

Before reporting issues, verify:

- [ ] ESP32 is powered on (LED lit)
- [ ] Code uploaded successfully
- [ ] Serial monitor shows "✓ WiFi Connected"
- [ ] Serial monitor shows "✓ MQTT Connected"
- [ ] Browser console shows "Connected to MQTT"
- [ ] WiFi credentials are correct
- [ ] Using 2.4GHz WiFi (not 5GHz)
- [ ] MQTT broker is accessible (test.mosquitto.org works)
- [ ] Frontend is running (localhost:5173)
- [ ] Both using same MQTT topics (koifish/boat/*)

---

## 📞 Getting Help

When asking for help, provide:

1. **Serial Monitor Output** (copy/paste first 20 lines)
2. **Browser Console Output** (F12, copy errors in red)
3. **ESP32 Board Model** (e.g., "ZY-ESP32 WIFI BT 38 PIN")
4. **WiFi Type** (2.4GHz or 5GHz)
5. **Error Messages** (exact text)

---

## ✅ Success Indicators

You're connected when you see:

### Serial Monitor:
```
✓ WiFi Connected!
✓ MQTT Connected!
💓 Heartbeat sent
📨 MQTT: {"command":"HEARTBEAT"}
```

### Frontend:
- Green "Connected" indicator
- Signal quality showing (e.g., "Good (-55 dBm)")
- Sensor data updating every second
- Commands work when buttons clicked

---

**🎯 Most Common Fix:** Re-upload the code to ESP32 and restart it!
