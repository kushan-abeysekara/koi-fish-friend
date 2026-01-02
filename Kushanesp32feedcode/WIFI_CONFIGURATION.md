# ESP32 WiFi Configuration

## Current WiFi Credentials

```cpp
const char* ssid = "Dulshan Dialog 4G 643";
const char* password = "Chuki000";
```

## Location in Code
File: `Kushanesp32feedcode/Kushanesp32feedcode_MQTT.ino`  
Lines: 23-24

## How to Change WiFi Credentials

### Method 1: Edit in Arduino IDE
1. Open `Kushanesp32feedcode_MQTT.ino`
2. Find lines 23-24:
   ```cpp
   const char* ssid = "Dulshan Dialog 4G 643";
   const char* password = "Chuki000";
   ```
3. Replace with your WiFi details:
   ```cpp
   const char* ssid = "Your_WiFi_Name";
   const char* password = "Your_WiFi_Password";
   ```
4. Save and upload to ESP32

### Method 2: Multiple WiFi Support (Optional)
To support multiple WiFi networks:

```cpp
// Add before setup()
const char* ssid_list[] = {
  "Dulshan Dialog 4G 643",
  "Home_WiFi",
  "Office_WiFi"
};

const char* password_list[] = {
  "Chuki000",
  "home_password",
  "office_password"
};

// In setup_wifi(), try each network:
void setup_wifi() {
  int network_count = sizeof(ssid_list) / sizeof(ssid_list[0]);
  
  for (int i = 0; i < network_count; i++) {
    Serial.print("Trying: ");
    Serial.println(ssid_list[i]);
    
    WiFi.begin(ssid_list[i], password_list[i]);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nConnected!");
      return;
    }
  }
  
  Serial.println("\nAll networks failed!");
}
```

## WiFi Connection Verification

### Check on Serial Monitor
After uploading, open Serial Monitor (115200 baud) and look for:

```
[WiFi Setup]
Connecting to Dulshan Dialog 4G 643
..........
WiFi connected
IP address: 
192.168.1.xxx
```

### Check on OLED Display
The display will show:
```
WiFi: OK    ← Should show "OK" if connected
WiFi: NO    ← Shows "NO" if disconnected
```

## Troubleshooting

### WiFi Not Connecting

#### Issue: "WiFi connection failed!"
**Solutions**:
1. Check SSID is exactly correct (case-sensitive)
2. Check password is correct
3. Ensure ESP32 is within WiFi range
4. Check if WiFi is 2.4GHz (ESP32 doesn't support 5GHz)
5. Verify WiFi router is powered on

#### Issue: Connects then disconnects
**Solutions**:
1. Check WiFi signal strength
2. Move ESP32 closer to router
3. Reduce interference from other devices
4. Check power supply to ESP32 is stable

#### Issue: IP address not shown
**Solutions**:
1. WiFi may not be assigning DHCP
2. Check router DHCP settings
3. Try static IP (see below)

### Static IP Configuration (Optional)

To use a static IP instead of DHCP:

```cpp
// Add after #include statements
IPAddress local_IP(192, 168, 1, 100);  // Your desired IP
IPAddress gateway(192, 168, 1, 1);     // Your router IP
IPAddress subnet(255, 255, 255, 0);
IPAddress primaryDNS(8, 8, 8, 8);      // Google DNS
IPAddress secondaryDNS(8, 8, 4, 4);    // Google DNS

// In setup_wifi(), before WiFi.begin():
void setup_wifi() {
  // Configure static IP
  if (!WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS)) {
    Serial.println("Static IP Failed to configure");
  }
  
  WiFi.begin(ssid, password);
  // ... rest of code
}
```

## WiFi Status Codes

| Status | Meaning |
|--------|---------|
| WL_CONNECTED | Connected to WiFi ✅ |
| WL_NO_SHIELD | WiFi shield not present |
| WL_IDLE_STATUS | WiFi is idle |
| WL_NO_SSID_AVAIL | SSID not found |
| WL_SCAN_COMPLETED | Scan completed |
| WL_CONNECT_FAILED | Connection failed |
| WL_CONNECTION_LOST | Connection lost |
| WL_DISCONNECTED | Disconnected from network |

## Network Requirements

### For Feeding System to Work:
- ✅ **2.4 GHz WiFi** (not 5 GHz)
- ✅ **Internet access** (for MQTT broker connection)
- ✅ **No enterprise authentication** (WPA/WPA2-Personal only)
- ✅ **Stable connection** (minimize interference)

### Router Settings to Check:
- DHCP enabled (or use static IP)
- 2.4 GHz band enabled
- WPA2-Personal security (most compatible)
- SSID broadcast enabled (not hidden)
- No MAC address filtering (or add ESP32 MAC)

## Getting ESP32 MAC Address

To find your ESP32's MAC address for router whitelisting:

```cpp
// In setup(), add:
Serial.print("ESP32 MAC Address: ");
Serial.println(WiFi.macAddress());
```

Example output: `AA:BB:CC:DD:EE:FF`

## Testing WiFi Connection

### Simple Test Code
```cpp
void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi: Connected");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal Strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("WiFi: Disconnected");
    setup_wifi(); // Try to reconnect
  }
  
  delay(5000); // Check every 5 seconds
}
```

## Signal Strength Guide

| RSSI (dBm) | Quality | Status |
|------------|---------|--------|
| -30 to -50 | Excellent | Perfect signal |
| -50 to -60 | Good | Works well |
| -60 to -70 | Fair | May drop occasionally |
| -70 to -80 | Weak | Frequent drops |
| -80 to -90 | Very Weak | Unusable |

Check signal strength on Serial Monitor:
```cpp
Serial.print("RSSI: ");
Serial.println(WiFi.RSSI());
```

## Auto-Reconnect Feature

The code includes automatic reconnection:

```cpp
void loop() {
  // Auto-reconnect WiFi
  if (WiFi.status() != WL_CONNECTED) {
    setup_wifi();
  }
  
  // Auto-reconnect MQTT
  if (!mqttClient.connected()) {
    reconnect();
  }
  
  // ... rest of code
}
```

This ensures the system stays connected even if WiFi drops temporarily.

## Current Network Details

- **SSID**: Dulshan Dialog 4G 643
- **Type**: Likely a mobile hotspot (Dialog 4G)
- **Password**: Chuki000
- **Band**: Should be 2.4 GHz
- **Security**: WPA2-Personal (assumed)

## Important Notes

⚠️ **Security Warning**: The WiFi password is hardcoded in the firmware. Anyone with access to the ESP32 can extract it. For production use, consider:
1. Using WiFi Manager library for dynamic configuration
2. Storing credentials in encrypted EEPROM
3. Using WPA2-Enterprise with certificates

✅ **For Testing**: Current setup is fine for development and testing purposes.

## Quick Reference

| Setting | Value |
|---------|-------|
| SSID | Dulshan Dialog 4G 643 |
| Password | Chuki000 |
| MQTT Broker | broker.hivemq.com |
| MQTT Port | 1883 |
| Device ID | feed_device_001 |

## File Location

**Main Code**: `Kushanesp32feedcode/Kushanesp32feedcode_MQTT.ino`

**Configuration Lines**:
- Line 23: WiFi SSID
- Line 24: WiFi Password
- Line 27: MQTT Broker
- Line 28: MQTT Port
- Line 29: Device ID
