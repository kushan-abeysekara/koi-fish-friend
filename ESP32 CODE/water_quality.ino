#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ===================== WiFi & MQTT CONFIG =====================
const char *ssid = "kavish99";
const char *password = "kavish99";

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

// Forward declarations
void publishStatus();
void publishStatusWithPond();

// ===================== PIN MAPPING =====================
#define PH_PIN 32          // pH sensor analog input (GPIO 32 / ADC1_CH4)
#define MQ135_PIN 33       // MQ135 ammonia sensor (GPIO 33 / ADC1_CH5) - NH3 detection
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
float ammonia = 0.0;  // NH3 in PPM
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
        Serial.println("WiFi Connected!");
        Serial.print("IP Address: ");
        Serial.println(WiFi.localIP());
        Serial.print("RSSI: ");
        Serial.println(WiFi.RSSI());
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
    Serial.print("Message arrived [");
    Serial.print(topic);
    Serial.print("] ");

    String message = "";
    for (unsigned int i = 0; i < length; i++)
        message += (char)payload[i];

    Serial.println(message);

    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, message);

    if (error)
    {
        Serial.print("JSON error: ");
        Serial.println(error.c_str());
        return;
    }

    if (!doc.containsKey("command"))
    {
        Serial.println("Missing 'command'");
        return;
    }

    const char *command = doc["command"];

    if (strcmp(command, "assign") == 0)
    {
        if (!doc.containsKey("pondId"))
        {
            Serial.println("No pondId in assign command");
            return;
        }

        assignedPondId = doc["pondId"].as<int>();
        Serial.print("✓ Assigned to Pond: ");
        Serial.println(assignedPondId);

        // Send status with pond info immediately for confirmation
        publishStatusWithPond();
    }
    else if (strcmp(command, "unassign") == 0)
    {
        assignedPondId = 0;
        Serial.println("✓ Unassigned from pond");

        // Send status with pondId=0 immediately for confirmation
        publishStatusWithPond();
    }
    else
    {
        Serial.print("Unknown command: ");
        Serial.println(command);
    }
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
        Serial.println(" Connected!");
        client.subscribe(commandTopic.c_str());
        publishStatus();
    }
    else
    {
        Serial.print(" Failed, rc=");
        Serial.println(client.state());
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
    if (assignedPondId == 0)
        return;

    StaticJsonDocument<400> doc;
    doc["deviceId"] = deviceId;
    doc["pondId"] = assignedPondId;
    doc["phValue"] = phValue;
    doc["turbidity"] = turbidity;
    doc["ammonia"] = ammonia;
    doc["waterQualityStatus"] = waterQualityStatus;
    doc["status"] = "normal";

    String json;
    serializeJson(doc, json);

    client.publish(dataTopic.c_str(), json.c_str());
    Serial.println("=====================================");
    Serial.println("✓ MQTT Data Published:");
    Serial.print("  Topic: ");
    Serial.println(dataTopic);
    Serial.print("  JSON: ");
    Serial.println(json);
    Serial.print("  pH Value: ");
    Serial.println(phValue, 3);
    Serial.print("  Turbidity: ");
    Serial.print(turbidity, 2);
    Serial.println(" NTU");
    Serial.print("  Ammonia: ");
    Serial.print(ammonia, 3);
    Serial.println(" PPM");
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

float readAmmonia(int pin, int samples = 50)
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
    
    // Convert voltage to ammonia PPM (NH3)
    // MQ135 sensor: Higher voltage = higher ammonia concentration
    // Typical range: 10-300 PPM for aquaculture
    // Safe level for koi: < 0.5 PPM (we'll scale this)
    
    // Calibration formula for MQ135 ammonia detection
    // This is a simplified linear approximation
    float ppm = (voltage / V_REF) * 5.0; // Scale to 0-5 PPM range
    
    // Sensor connection check
    if (maxRaw >= 4090 || maxRaw <= 5) {
        Serial.println("⚠️ WARNING: MQ135 Ammonia Sensor may be disconnected!");
    }
    
    return ppm;
}

String evaluateWaterQuality(float ph, float turb, float nh3)
{
    // Ideal koi pond: pH 7.0-8.5, turbidity < 50 NTU, ammonia < 0.5 PPM
    if (ph < 6.5 || ph > 9.0 || turb > 100 || nh3 > 1.0)
        return "critical";
    else if (ph < 7.0 || ph > 8.5 || turb > 50 || nh3 > 0.5)
        return "warning";
    else
        return "normal";
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
    pinMode(MQ135_PIN, INPUT);
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

    client.setServer(mqtt_server, mqtt_port);
    client.setCallback(mqttCallback);
    client.setBufferSize(512);

    Serial.println("\nSetup complete! Starting main loop...");
    Serial.println("=====================================");
}

// ===============================================================
//                      MAIN LOOP
// ===============================================================
void loop()
{
    // Maintain WiFi connection
    if (WiFi.status() != WL_CONNECTED)
    {
        Serial.println("\n! WiFi disconnected, reconnecting...");
        setupWiFi();
    }

    // Maintain MQTT connection
    if (!client.connected())
    {
        reconnectMQTT();
    }

    client.loop();

    unsigned long now = millis();

    // Read water quality sensors from actual hardware
    phValue = readPH(PH_PIN);
    turbidity = readTurbidity(TURBIDITY_PIN);
    ammonia = readAmmonia(MQ135_PIN);
    waterQualityStatus = evaluateWaterQuality(phValue, turbidity, ammonia);

    // Print to Serial Monitor only when publishing data (reduce serial spam)
    static unsigned long lastSerialPrint = 0;
    if (now - lastSerialPrint >= 2000) {
        lastSerialPrint = now;
        Serial.print("Pond: ");
        Serial.print(assignedPondId);
        Serial.print(" | pH: ");
        Serial.print(phValue, 2);
        Serial.print(" | Turb: ");
        Serial.print(turbidity, 1);
        Serial.print(" NTU | NH3: ");
        Serial.print(ammonia, 2);
        Serial.print(" PPM | ");
        Serial.println(waterQualityStatus);
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