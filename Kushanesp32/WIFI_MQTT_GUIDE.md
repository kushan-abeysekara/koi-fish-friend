# WiFi & MQTT Integration Guide (Future Feature)

## Overview

This guide prepares you for adding WiFi and MQTT connectivity to your ESP32 Boat Control System. The hardware is already configured with reserved GPIO pins for future expansion.

## Reserved Hardware Pins

The following GPIO pins are reserved and available for future use:

| GPIO Pin | Type | Purpose | Notes |
|----------|------|---------|-------|
| GPIO 36 | Input only | Analog sensor | ADC1_CH0 (VP) |
| GPIO 39 | Input only | Analog sensor | ADC1_CH3 (VN) |

**Note**: GPIO 0 is now used for Back Ultrasonic Echo (GPIO 5 not available on 38-pin board)

**WiFi Hardware**: Built into ESP32 chip (no external pins required)

---

## Current Pin Usage Summary

### Used Pins (Do Not Modify)
- GPIO 34, 35: Analog sensors
- GPIO 13: Relay control
- GPIO 16, 17: HX711 load cell
- GPIO 21, 22: I2C bus (MPU-6050, DS3231)
- GPIO 25, 26, 14: Left motor control
- GPIO 27, 32, 33: Right motor control
- GPIO 18, 19: Front ultrasonic
- GPIO 23, 0: Back ultrasonic
- GPIO 4, 15: Left ultrasonic
- GPIO 2, 12: Right ultrasonic

### Available for Future Expansion
- GPIO 36: Input only (analog capable)
- GPIO 39: Input only (analog capable)

### Unavailable Pins on 38-Pin Board
- GPIO 5: Not broken out on this board variant

---

## WiFi Setup (Future Implementation)

### Step 1: Add WiFi Library

Already included in ESP32 core:
```cpp
#include <WiFi.h>
```

### Step 2: Define WiFi Credentials

Add to your code:
```cpp
// WiFi Configuration
const char* WIFI_SSID = "YourNetworkName";
const char* WIFI_PASSWORD = "YourPassword";
```

### Step 3: WiFi Connection Function

```cpp
void setupWiFi() {
  Serial.println("Connecting to WiFi...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi Connection Failed!");
  }
}
```

### Step 4: Add to Setup

```cpp
void setup() {
  // ... existing setup code ...
  
  // Initialize WiFi
  setupWiFi();
  
  // ... rest of setup ...
}
```

---

## MQTT Setup (Future Implementation)

### Required Library

Install via Library Manager:
- **PubSubClient** by Nick O'Leary

### Installation Steps

1. Arduino IDE → Sketch → Include Library → Manage Libraries
2. Search for "PubSubClient"
3. Install "PubSubClient" by Nick O'Leary

### MQTT Broker Options

#### Option 1: Cloud MQTT Broker
- **HiveMQ Cloud**: https://www.hivemq.com/mqtt-cloud-broker/
- **CloudMQTT**: https://www.cloudmqtt.com/
- **AWS IoT Core**: https://aws.amazon.com/iot-core/

#### Option 2: Self-Hosted Broker
- **Mosquitto**: https://mosquitto.org/
- **EMQX**: https://www.emqx.io/

### MQTT Implementation Code

```cpp
#include <WiFi.h>
#include <PubSubClient.h>

// MQTT Configuration
const char* MQTT_BROKER = "broker.hivemq.com";  // Or your broker
const int MQTT_PORT = 1883;
const char* MQTT_CLIENT_ID = "KoiFishBoat_001";
const char* MQTT_USERNAME = "";  // If required
const char* MQTT_PASSWORD = "";  // If required

// MQTT Topics
const char* TOPIC_SENSORS = "koi/boat/sensors";
const char* TOPIC_MOTORS = "koi/boat/motors";
const char* TOPIC_CONTROL = "koi/boat/control";
const char* TOPIC_STATUS = "koi/boat/status";

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// MQTT Callback for incoming messages
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("]: ");
  
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);
  
  // Handle control commands
  if (String(topic) == TOPIC_CONTROL) {
    handleControlCommand(message);
  }
}

// Connect to MQTT Broker
void connectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT broker...");
    
    if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD)) {
      Serial.println("Connected!");
      
      // Subscribe to control topic
      mqttClient.subscribe(TOPIC_CONTROL);
      
      // Publish status
      mqttClient.publish(TOPIC_STATUS, "online");
    } else {
      Serial.print("Failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" Retrying in 5 seconds...");
      delay(5000);
    }
  }
}

// Setup MQTT
void setupMQTT() {
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  connectMQTT();
}

// Publish sensor data
void publishSensorData() {
  if (!mqttClient.connected()) {
    connectMQTT();
  }
  mqttClient.loop();
  
  // Create JSON payload
  String payload = "{";
  payload += "\"voltage\":" + String(voltage, 2) + ",";
  payload += "\"weight\":" + String(weight, 2) + ",";
  payload += "\"light\":" + String(ldrValue) + ",";
  payload += "\"accelX\":" + String(accelX, 2) + ",";
  payload += "\"accelY\":" + String(accelY, 2) + ",";
  payload += "\"accelZ\":" + String(accelZ, 2) + ",";
  payload += "\"angleX\":" + String(angleX, 2) + ",";
  payload += "\"angleY\":" + String(angleY, 2) + ",";
  payload += "\"distanceFront\":" + String(distanceFront, 1) + ",";
  payload += "\"distanceBack\":" + String(distanceBack, 1) + ",";
  payload += "\"distanceLeft\":" + String(distanceLeft, 1) + ",";
  payload += "\"distanceRight\":" + String(distanceRight, 1);
  payload += "}";
  
  mqttClient.publish(TOPIC_SENSORS, payload.c_str());
}

// Handle control commands from MQTT
void handleControlCommand(String command) {
  if (command == "FORWARD") {
    moveForward(200);
  } else if (command == "BACKWARD") {
    moveBackward(200);
  } else if (command == "LEFT") {
    turnLeft();
  } else if (command == "RIGHT") {
    turnRight();
  } else if (command == "STOP") {
    stopMotors();
  } else {
    Serial.println("Unknown command: " + command);
  }
}
```

### Add to Setup and Loop

```cpp
void setup() {
  // ... existing setup code ...
  
  // Initialize WiFi and MQTT
  setupWiFi();
  setupMQTT();
  
  // ... rest of setup ...
}

void loop() {
  // ... existing loop code ...
  
  // MQTT maintenance
  if (!mqttClient.connected()) {
    connectMQTT();
  }
  mqttClient.loop();
  
  // Publish sensor data every 5 seconds
  static unsigned long lastPublish = 0;
  if (millis() - lastPublish > 5000) {
    lastPublish = millis();
    publishSensorData();
  }
}
```

---

## MQTT Topic Structure

### Publishing Topics (Boat → Cloud)

| Topic | Description | Format | Example |
|-------|-------------|--------|---------|
| `koi/boat/sensors` | All sensor data | JSON | `{"voltage":12.5,"weight":1.12,...}` |
| `koi/boat/status` | Boat status | String | `online` / `offline` |
| `koi/boat/gps` | GPS coordinates | JSON | `{"lat":37.7749,"lon":-122.4194}` |
| `koi/boat/alert` | Emergency alerts | String | `Low Battery` |

### Subscribing Topics (Cloud → Boat)

| Topic | Description | Commands | Example |
|-------|-------------|----------|---------|
| `koi/boat/control` | Motor control | FORWARD, BACKWARD, LEFT, RIGHT, STOP | `FORWARD` |
| `koi/boat/config` | Configuration | JSON settings | `{"threshold":8.5}` |
| `koi/boat/command` | Special commands | CALIBRATE, RESET, REBOOT | `CALIBRATE` |

---

## Security Considerations

### WiFi Security
```cpp
// Use WPA2 encryption for WiFi
// Avoid public/open networks
// Use strong passwords (minimum 12 characters)
```

### MQTT Security
```cpp
// Use TLS/SSL encryption (port 8883)
WiFiClientSecure espClient;  // Instead of WiFiClient

// Set CA certificate
const char* CA_CERT = \
"-----BEGIN CERTIFICATE-----\n" \
"YOUR_CA_CERTIFICATE_HERE\n" \
"-----END CERTIFICATE-----\n";

espClient.setCACert(CA_CERT);
```

### Credentials Management
```cpp
// Don't hardcode credentials!
// Option 1: Store in EEPROM
// Option 2: Use ESP32 Preferences library
// Option 3: WiFi Manager for runtime configuration

#include <Preferences.h>

Preferences preferences;

void saveCredentials(String ssid, String password) {
  preferences.begin("wifi", false);
  preferences.putString("ssid", ssid);
  preferences.putString("password", password);
  preferences.end();
}

void loadCredentials(String &ssid, String &password) {
  preferences.begin("wifi", true);
  ssid = preferences.getString("ssid", "");
  password = preferences.getString("password", "");
  preferences.end();
}
```

---

## Data Rate Optimization

### Reduce MQTT Traffic

```cpp
// Only publish when values change significantly
float lastVoltage = 0;
const float VOLTAGE_THRESHOLD = 0.1;

if (abs(voltage - lastVoltage) > VOLTAGE_THRESHOLD) {
  publishVoltage(voltage);
  lastVoltage = voltage;
}

// Use different publish intervals for different sensors
#define PUBLISH_INTERVAL_FAST 1000   // 1 second (critical data)
#define PUBLISH_INTERVAL_MEDIUM 5000  // 5 seconds (normal data)
#define PUBLISH_INTERVAL_SLOW 30000   // 30 seconds (status data)
```

---

## Testing MQTT Connection

### Using MQTT Explorer (Desktop Tool)

1. Download: http://mqtt-explorer.com/
2. Configure connection to your broker
3. Subscribe to `koi/boat/#` (all topics)
4. Publish test messages to `koi/boat/control`

### Using Mosquitto Command Line

```bash
# Subscribe to all topics
mosquitto_sub -h broker.hivemq.com -t "koi/boat/#" -v

# Publish test command
mosquitto_pub -h broker.hivemq.com -t "koi/boat/control" -m "FORWARD"
```

### Using Python Script

```python
import paho.mqtt.client as mqtt

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")
    client.subscribe("koi/boat/#")

def on_message(client, userdata, msg):
    print(f"{msg.topic}: {msg.payload.decode()}")

client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

client.connect("broker.hivemq.com", 1883, 60)
client.loop_forever()
```

---

## Power Consumption Considerations

WiFi and MQTT increase power consumption:

| Mode | Current Draw | Notes |
|------|--------------|-------|
| WiFi Off | ~80 mA | Current configuration |
| WiFi On (idle) | ~120 mA | Connected, no data |
| WiFi Transmitting | ~200-300 mA | Sending MQTT data |

**Battery Life Impact:**
- 12V 10Ah battery
- Without WiFi: ~5-6 hours
- With WiFi: ~3-4 hours

**Optimization Strategies:**
1. Use WiFi sleep mode when not needed
2. Reduce MQTT publish frequency
3. Implement deep sleep between transmissions
4. Use larger battery or solar panel

---

## Web Dashboard (Optional)

Create a simple web dashboard to visualize boat data:

### Node-RED (Recommended)
- Visual MQTT dashboard
- Drag-and-drop interface
- Real-time charts
- Installation: https://nodered.org/

### Custom Web Page
```html
<!DOCTYPE html>
<html>
<head>
  <title>Koi Fish Boat Monitor</title>
  <script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>
</head>
<body>
  <h1>Boat Status</h1>
  <p>Voltage: <span id="voltage">--</span> V</p>
  <p>Weight: <span id="weight">--</span> kg</p>
  <p>Distance Front: <span id="distFront">--</span> cm</p>
  
  <script>
    const client = mqtt.connect('ws://broker.hivemq.com:8000/mqtt');
    
    client.on('connect', () => {
      client.subscribe('koi/boat/sensors');
    });
    
    client.on('message', (topic, message) => {
      const data = JSON.parse(message.toString());
      document.getElementById('voltage').innerText = data.voltage;
      document.getElementById('weight').innerText = data.weight;
      document.getElementById('distFront').innerText = data.distanceFront;
    });
  </script>
</body>
</html>
```

---

## Future Integration Checklist

- [ ] Install PubSubClient library
- [ ] Configure WiFi credentials
- [ ] Set up MQTT broker (cloud or local)
- [ ] Test WiFi connection
- [ ] Test MQTT publish/subscribe
- [ ] Implement control commands
- [ ] Set up dashboard (Node-RED or custom)
- [ ] Test remote control
- [ ] Implement security (TLS/SSL)
- [ ] Optimize power consumption
- [ ] Document API endpoints
- [ ] Create mobile app (optional)

---

## Troubleshooting

### WiFi Won't Connect
- Check SSID and password
- Ensure 2.4 GHz network (ESP32 doesn't support 5 GHz)
- Check signal strength
- Verify router settings

### MQTT Connection Fails
- Check broker address and port
- Verify internet connection
- Test broker with MQTT Explorer
- Check firewall settings

### High Power Consumption
- Reduce publish frequency
- Use WiFi sleep mode
- Implement deep sleep
- Check for connection loops

---

**Document Version:** 1.0  
**Date:** November 24, 2025  
**Author:** Koi Fish Friend Team

**Note:** This is a planning document. WiFi/MQTT features are not yet implemented in the main code.
