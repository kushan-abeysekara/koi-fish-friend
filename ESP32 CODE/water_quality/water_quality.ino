#include <WiFi.h>
#include <PubSubClient.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>

// ===================== WiFi & MQTT CONFIG =====================
const char *ssid = "Dulshan Dialog 4G 643";
const char *password = "Chuki000";

// Static IP Configuration for Water Quality Device
IPAddress local_IP(192, 168, 8, 102);  // Water Quality Device IP
IPAddress gateway(192, 168, 8, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress primaryDNS(8, 8, 8, 8);
IPAddress secondaryDNS(8, 8, 4, 4);

// HiveMQ Public Broker
const char *mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
const char *mqtt_user = "";
const char *mqtt_password = "";

// Device configuration
String deviceId = "";
const char* deviceType = "WATER_QUALITY";
int assignedPondId = 0;

// MQTT Topics
String statusTopic = "";
String dataTopic = "";
String commandTopic = "";

WiFiClient espClient;
PubSubClient client(espClient);
WebSocketsServer wsServer(81);  // WebSocket on port 81 (same as boat)

// Connection tracking
int wsConnectedClients = 0;
bool mqttConnected = false;
String lastCommandSource = "none";
unsigned long lastWiFiCheck = 0;
const unsigned long WIFI_CHECK_INTERVAL = 10000;  // Check WiFi every 10 seconds

// Forward declarations
void publishStatus();
void publishStatusWithPond();
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length);
void broadcastDataToWebSocket();
void processCommand(String message);

// ===================== PIN MAPPING =====================
#define PH_PIN 32          // pH sensor analog input (GPIO 32 / ADC1_CH4)
#define DO_PIN 33          // Dissolved Oxygen sensor (GPIO 33 / ADC1_CH5) - DO in mg/L
#define TURBIDITY_PIN 34   // Turbidity sensor analog input (GPIO 34 / ADC1_CH6)

// ===================== CALIBRATION =====================
const float ADC_MAX = 4095.0;
const float V_REF = 3.3;

// pH calibration (adjust based on your sensor)
const float PH_NEUTRAL_VOLTAGE = 2.5;  // Voltage at pH 7.0 (neutral)
const float PH_STEP = 0.18;            // Voltage change per pH unit

// Turbidity calibration
const float TURBIDITY_CLEAR_WATER_VOLTAGE = 4.2;
const float TURBIDITY_MAX_NTU = 3000.0;

// ===================== VARIABLES =====================
float phValue = 7.0;
float turbidity = 0.0;
float dissolvedOxygen = 0.0;  // DO in mg/L (milligrams per liter)
String waterQualityStatus = "normal";

unsigned long lastMqttPublish = 0;
unsigned long lastStatusPublish = 0;
const unsigned long MQTT_PUBLISH_INTERVAL = 2000;      // Publish data every 2 seconds for real-time updates
const unsigned long STATUS_PUBLISH_INTERVAL = 2000;    // Publish status every 2 seconds

// ===============================================================
//                      WiFi CONNECTION
// ===============================================================
void setupWiFi()
{
    delay(10);
    Serial.println();
    Serial.println("========================================");
    Serial.println("🌐 Configuring Water Quality Device");
    Serial.println("========================================");
    
    // Configure static IP
    if (!WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS)) {
        Serial.println("❌ Static IP configuration failed");
    } else {
        Serial.println("✅ Static IP configured: 192.168.8.102");
    }
    
    Serial.print("Connecting to ");
    Serial.println(ssid);

    WiFi.begin(ssid, password);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20)
    {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.println();
        Serial.println("========================================");
        Serial.println("✅ WiFi Connected!");
        Serial.print("📍 IP Address: ");
        Serial.println(WiFi.localIP());
        Serial.print("📡 RSSI: ");
        Serial.print(WiFi.RSSI());
        Serial.println(" dBm");
        Serial.print("🔗 WebSocket: ws://");
        Serial.print(WiFi.localIP());
        Serial.println(":81");
        Serial.println("========================================");
    }
    else
    {
        Serial.println();
        Serial.println("WiFi Connection Failed!");
    }
}

// ===============================================================
//                  MQTT CALLBACK
// ===============================================================
void mqttCallback(char *topic, byte *payload, unsigned int length)
{
    String message = "";
    for (unsigned int i = 0; i < length; i++)
        message += (char)payload[i];

    Serial.print("📨 MQTT: ");
    Serial.println(message);
    
    // Mark command source
    lastCommandSource = "mqtt";
    
    // Use unified command processor
    processCommand(message);
}

// ===============================================================
//                    MQTT RECONNECT (NON-BLOCKING)
// ===============================================================
unsigned long lastMqttAttempt = 0;
const unsigned long MQTT_RETRY_INTERVAL = 5000;

void reconnectMQTT()
{
    unsigned long now = millis();
    
    // Only attempt reconnection every 5 seconds to avoid blocking
    if (now - lastMqttAttempt < MQTT_RETRY_INTERVAL) {
        return;
    }
    
    lastMqttAttempt = now;
    Serial.print("Connecting to MQTT...");

    String clientId = "ESP32-" + deviceId;

    String willTopic = statusTopic;
    String willMsg = "{\"deviceId\":\"" + deviceId +
                     "\",\"deviceType\":\"WATER_QUALITY\",\"status\":\"offline\"}";

    if (client.connect(clientId.c_str(), mqtt_user, mqtt_password,
                       willTopic.c_str(), 1, true, willMsg.c_str()))
    {
        Serial.println(" ✅ MQTT Connected!");
        mqttConnected = true;
        client.subscribe(commandTopic.c_str());
        publishStatus();
    }
    else
    {
        Serial.print(" ❌ MQTT Failed, rc=");
        Serial.println(client.state());
        mqttConnected = false;
    }
}

// ===============================================================
//                    PUBLISH STATUS
// ===============================================================
void publishStatus()
{
    StaticJsonDocument<300> doc;
    doc["deviceId"] = deviceId;
    doc["deviceType"] = deviceType;
    // Don't send pondId in regular status - backend manages assignments
    // Only send it immediately after receiving assign/unassign commands
    doc["status"] = "online";
    doc["ipAddress"] = WiFi.localIP().toString();
    doc["rssi"] = WiFi.RSSI();

    String json;
    serializeJson(doc, json);

    client.publish(statusTopic.c_str(), json.c_str(), true);
    Serial.print("✓ Status published: ");
    Serial.println(json);
}

// Publish status with pond assignment info (only after assign/unassign commands)
void publishStatusWithPond()
{
    StaticJsonDocument<300> doc;
    doc["deviceId"] = deviceId;
    doc["deviceType"] = deviceType;
    doc["pondId"] = assignedPondId;
    doc["status"] = "online";
    doc["ipAddress"] = WiFi.localIP().toString();
    doc["rssi"] = WiFi.RSSI();

    String json;
    serializeJson(doc, json);

    client.publish(statusTopic.c_str(), json.c_str(), true);
    Serial.print("✓ Status with pond assignment sent: ");
    Serial.println(json);
}

// ===============================================================
//                 PUBLISH SENSOR DATA
// ===============================================================
void publishSensorData()
{
    if (assignedPondId == 0) {
        Serial.println("⚠️  Not publishing - device not assigned to pond");
        return;
    }

    StaticJsonDocument<400> doc;
    doc["deviceId"] = deviceId;
    doc["pondId"] = assignedPondId;
    doc["phValue"] = phValue;
    doc["turbidity"] = turbidity;
    doc["dissolvedOxygen"] = dissolvedOxygen;
    doc["waterQualityStatus"] = waterQualityStatus;
    doc["status"] = "normal";

    String json;
    serializeJson(doc, json);

    // Publish via MQTT (only if connected)
    if (mqttConnected && client.connected()) {
        bool published = client.publish(dataTopic.c_str(), json.c_str());
        if (!published) {
            Serial.println("❌ MQTT publish failed!");
        }
    }
    
    // Also broadcast via WebSocket for real-time dashboard
    broadcastDataToWebSocket();
    
    Serial.println("=====================================");
    Serial.println("✓ Data Published (MQTT + WebSocket):");
    Serial.print("  MQTT: ");
    Serial.print(mqttConnected ? "✅" : "❌");
    Serial.print(" | WS Clients: ");
    Serial.println(wsConnectedClients);
    Serial.print("  pH: ");
    Serial.print(phValue, 2);
    Serial.print(" | Turbidity: ");
    Serial.print(turbidity, 1);
    Serial.print(" NTU | DO: ");
    Serial.print(dissolvedOxygen, 2);
    Serial.println(" mg/L");
    Serial.println("=====================================");
}

// ===============================================================
//                  SENSOR READ FUNCTIONS
// ===============================================================
float readPH(int pin, int samples = 50)
{
    unsigned long sum = 0;
    int minRaw = 4095;
    int maxRaw = 0;
    
    for (int i = 0; i < samples; i++)
    {
        int reading = analogRead(pin);
        sum += reading;
        if (reading < minRaw) minRaw = reading;
        if (reading > maxRaw) maxRaw = reading;
        delay(10);
    }
    
    float avgReading = sum / (float)samples;
    float voltage = (avgReading / ADC_MAX) * V_REF;
    
    // Convert voltage to pH using calibrated formula
    float ph = 7.0 + ((PH_NEUTRAL_VOLTAGE - voltage) / PH_STEP);
    
    // Constrain to valid pH range
    if (ph < 0) ph = 0;
    if (ph > 14) ph = 14;
    
    // Sensor connection check
    if (maxRaw >= 4090 || maxRaw <= 5) {
        Serial.println("⚠️ WARNING: pH Sensor may be disconnected!");
    }
    
    return ph;
}

float readTurbidity(int pin, int samples = 50)
{
    unsigned long sum = 0;
    int minRaw = 4095;
    int maxRaw = 0;
    
    for (int i = 0; i < samples; i++)
    {
        int reading = analogRead(pin);
        sum += reading;
        if (reading < minRaw) minRaw = reading;
        if (reading > maxRaw) maxRaw = reading;
        delay(10);
    }
    
    float avgReading = sum / (float)samples;
    float voltage = (avgReading / ADC_MAX) * V_REF;
    
    // Convert voltage to NTU (Nephelometric Turbidity Units)
    // Lower voltage = higher turbidity (cloudier water)
    float ntu = 0;
    
    if (voltage > 2.5) {
        ntu = -1120.4 * voltage * voltage + 5742.3 * voltage - 4352.9;
    } else {
        ntu = 3000.0; // Very turbid water
    }
    
    // Clamp NTU to valid range
    if (ntu < 0) ntu = 0;
    if (ntu > TURBIDITY_MAX_NTU) ntu = TURBIDITY_MAX_NTU;
    
    // Sensor connection check
    if (maxRaw >= 4090 || maxRaw <= 5) {
        Serial.println("⚠️ WARNING: Turbidity Sensor may be disconnected!");
    }
    
    return ntu;
}

float readDissolvedOxygen(int pin, int samples = 50)
{
    unsigned long sum = 0;
    int minRaw = 4095;
    int maxRaw = 0;
    
    for (int i = 0; i < samples; i++)
    {
        int reading = analogRead(pin);
        sum += reading;
        if (reading < minRaw) minRaw = reading;
        if (reading > maxRaw) maxRaw = reading;
        delay(10);
    }
    
    float avgReading = sum / (float)samples;
    float voltage = (avgReading / ADC_MAX) * V_REF;
    
    // Convert voltage to Dissolved Oxygen mg/L
    // DO sensor: Higher voltage = higher dissolved oxygen
    // Typical range: 0-20 mg/L for aquaculture
    // Ideal for koi: 6-8 mg/L
    // Critical low: < 5 mg/L
    
    // Calibration formula for DO sensor (linear approximation)
    // Voltage range 0-3.3V maps to 0-20 mg/L
    float mgL = (voltage / V_REF) * 20.0; // Scale to 0-20 mg/L range
    
    // Constrain to valid range
    if (mgL < 0) mgL = 0;
    if (mgL > 20) mgL = 20;
    
    // Sensor connection check
    if (maxRaw >= 4090 || maxRaw <= 5) {
        Serial.println("⚠️ WARNING: DO Sensor may be disconnected!");
    }
    
    return mgL;
}

String evaluateWaterQuality(float ph, float turb, float doLevel)
{
    // Ideal koi pond: pH 7.0-8.5, turbidity < 50 NTU, DO 6-8 mg/L
    // Critical: pH < 6.5 or > 9.0, turbidity > 100 NTU, DO < 5 mg/L
    if (ph < 6.5 || ph > 9.0 || turb > 100 || doLevel < 5.0)
        return "critical";
    else if (ph < 7.0 || ph > 8.5 || turb > 50 || doLevel < 6.0 || doLevel > 10.0)
        return "warning";
    else
        return "normal";
}

// ===============================================================
//                    WEBSOCKET FUNCTIONS
// ===============================================================
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            Serial.printf("[WS] Client #%u disconnected\n", num);
            wsConnectedClients = max(0, wsConnectedClients - 1);
            Serial.printf("[WS] Active clients: %d\n", wsConnectedClients);
            break;
            
        case WStype_PING:
            // WebSocket ping received, respond with pong automatically
            Serial.printf("[WS] Ping from #%u\n", num);
            break;
            
        case WStype_PONG:
            // WebSocket pong received
            Serial.printf("[WS] Pong from #%u\n", num);
            break;
            
        case WStype_CONNECTED: {
            IPAddress ip = wsServer.remoteIP(num);
            Serial.printf("[WS] ⚡ Client #%u connected from %d.%d.%d.%d\n", num, ip[0], ip[1], ip[2], ip[3]);
            wsConnectedClients++;
            Serial.printf("[WS] Active clients: %d\n", wsConnectedClients);
            
            // Send initial status
            String status = "{\"status\":\"connected\",\"deviceId\":\"" + deviceId + 
                          "\",\"ip\":\"" + WiFi.localIP().toString() + 
                          "\",\"pondId\":" + String(assignedPondId) + "}";
            wsServer.sendTXT(num, status);
            break;
        }
            
        case WStype_TEXT: {
            String message = String((char*)payload);
            Serial.printf("[WS] Command from #%u: %s\n", num, message.c_str());
            
            // Mark command source
            lastCommandSource = "websocket";
            
            // Process command
            processCommand(message);
            
            // Send acknowledgment
            String ack = "{\"ack\":true,\"deviceId\":\"" + deviceId + "\"}";
            wsServer.sendTXT(num, ack);
            break;
        }
    }
}

void broadcastDataToWebSocket() {
    if (wsConnectedClients == 0) return;
    
    StaticJsonDocument<400> doc;
    doc["deviceId"] = deviceId;
    doc["pondId"] = assignedPondId;
    doc["phValue"] = phValue;
    doc["turbidity"] = turbidity;
    doc["dissolvedOxygen"] = dissolvedOxygen;
    doc["ammonia"] = ammonia;
    doc["waterQualityStatus"] = waterQualityStatus;
    doc["timestamp"] = millis();
    doc["rssi"] = WiFi.RSSI();
    
    String json;
    serializeJson(doc, json);
    
    wsServer.broadcastTXT(json);
}

// Unified command processor for both MQTT and WebSocket
void processCommand(String message) {
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, message);

    if (error) {
        Serial.print("JSON error: ");
        Serial.println(error.c_str());
        return;
    }

    if (!doc.containsKey("command")) {
        Serial.println("Missing 'command'");
        return;
    }

    const char *command = doc["command"];

    if (strcmp(command, "assign") == 0) {
        if (!doc.containsKey("pondId")) {
            Serial.println("No pondId in assign command");
            return;
        }

        assignedPondId = doc["pondId"].as<int>();
        Serial.print("✓ Assigned to Pond: ");
        Serial.print(assignedPondId);
        Serial.print(" [");
        Serial.print(lastCommandSource);
        Serial.println("]");

        // Send status with pond info immediately for confirmation
        publishStatusWithPond();
        
        // Also broadcast to WebSocket clients
        if (wsConnectedClients > 0) {
            String response = "{\"status\":\"assigned\",\"pondId\":" + String(assignedPondId) + "}";
            wsServer.broadcastTXT(response);
        }
    }
    else if (strcmp(command, "unassign") == 0) {
        assignedPondId = 0;
        Serial.print("✓ Unassigned from pond [");
        Serial.print(lastCommandSource);
        Serial.println("]");

        // Send status with pondId=0 immediately for confirmation
        publishStatusWithPond();
        
        // Also broadcast to WebSocket clients
        if (wsConnectedClients > 0) {
            String response = "{\"status\":\"unassigned\",\"pondId\":0}";
            wsServer.broadcastTXT(response);
        }
    }
    else {
        Serial.print("Unknown command: ");
        Serial.println(command);
    }
}

// ===============================================================
//                       SETUP
// ===============================================================
void setup()
{
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("\n\n=====================================");
    Serial.println("Water Quality Monitor Starting...");
    Serial.println("=====================================");

    // Configure ADC for sensor readings
    // Set ADC attenuation to 11dB for ~0V to 3.6V range
    analogSetAttenuation(ADC_11db);
    
    // Set ADC resolution to 12 bits (0-4095)
    analogReadResolution(12);
    
    // Configure ADC pins
    pinMode(PH_PIN, INPUT);
    pinMode(DO_PIN, INPUT);
    pinMode(TURBIDITY_PIN, INPUT);

    // Generate device ID with WQ prefix (Water Quality)
    uint8_t mac[6];
    WiFi.macAddress(mac);
    deviceId = "WQ_" + String(mac[3], HEX) + String(mac[4], HEX) + String(mac[5], HEX);
    deviceId.toUpperCase();

    Serial.print("Device ID: ");
    Serial.println(deviceId);

    statusTopic = "koi/sensors/" + deviceId + "/status";
    dataTopic = "koi/sensors/" + deviceId + "/data";
    commandTopic = "koi/sensors/" + deviceId + "/command";

    Serial.println("\nMQTT Topics:");
    Serial.print("  Status: ");
    Serial.println(statusTopic);
    Serial.print("  Data: ");
    Serial.println(dataTopic);
    Serial.print("  Command: ");
    Serial.println(commandTopic);

    setupWiFi();

    // Initialize MQTT
    client.setServer(mqtt_server, mqtt_port);
    client.setCallback(mqttCallback);
    client.setBufferSize(512);
    client.setKeepAlive(15);  // Send MQTT keepalive every 15 seconds
    
    // Initialize WebSocket Server
    wsServer.begin();
    wsServer.onEvent(webSocketEvent);
    Serial.println("✅ WebSocket server started on port 81");
    Serial.print("   Connect at: ws://");
    Serial.print(WiFi.localIP());
    Serial.println(":81");

    Serial.println("\n========================================");
    Serial.println("✅ Setup complete! Hybrid Mode Active");
    Serial.println("   MQTT + WebSocket for real-time data");
    Serial.println("========================================");
}

// ===============================================================
//                      MAIN LOOP
// ===============================================================
void loop()
{
    unsigned long now = millis();
    
    // WebSocket server loop - handle local connections
    wsServer.loop();
    
    // Maintain WiFi connection with periodic checks
    if (now - lastWiFiCheck >= WIFI_CHECK_INTERVAL) {
        lastWiFiCheck = now;
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("\n⚠️ WiFi disconnected, reconnecting...");
            setupWiFi();
            mqttConnected = false;
        }
    }

    // Maintain MQTT connection - call client.loop() first to process keepalive
    client.loop();
    
    if (!client.connected())
    {
        mqttConnected = false;
        reconnectMQTT();
    } else {
        mqttConnected = true;
    }

    // Read water quality sensors from actual hardware
    phValue = readPH(PH_PIN);
    turbidity = readTurbidity(TURBIDITY_PIN);
    dissolvedOxygen = readDissolvedOxygen(DO_PIN);
    waterQualityStatus = evaluateWaterQuality(phValue, turbidity, dissolvedOxygen);

    // Print to Serial Monitor with connection status
    static unsigned long lastSerialPrint = 0;
    if (now - lastSerialPrint >= 2000) {
        lastSerialPrint = now;
        
        // Connection Status Display
        Serial.print("📡 MQTT: ");
        Serial.print(mqttConnected ? "✅" : "❌");
        Serial.print(" | ⚡ WS: ");
        Serial.print(wsConnectedClients);
        Serial.print(" clients | 📍 IP: ");
        Serial.print(WiFi.localIP());
        Serial.print(" | Signal: ");
        Serial.print(WiFi.RSSI());
        Serial.println(" dBm");
        
        // Sensor Data
        Serial.print("🏊 Pond: ");
        Serial.print(assignedPondId);
        Serial.print(" | pH: ");
        Serial.print(phValue, 2);
        Serial.print(" | Turbidity: ");
        Serial.print(turbidity, 1);
        Serial.print(" NTU | DO: ");
        Serial.print(dissolvedOxygen, 2);
        Serial.print(" mg/L | Status: ");
        Serial.println(waterQualityStatus);
        Serial.println();
    }

    // Publish sensor data periodically (only if assigned to a pond)
    if (now - lastMqttPublish >= MQTT_PUBLISH_INTERVAL)
    {
        lastMqttPublish = now;
        publishSensorData();
    }

    // Publish status periodically to keep device online
    if (now - lastStatusPublish >= STATUS_PUBLISH_INTERVAL)
    {
        lastStatusPublish = now;
        publishStatus();
    }

    delay(200);  // Reduced delay for faster loop cycles
}