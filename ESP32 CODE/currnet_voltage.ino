#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ===================== LCD SETUP =====================
LiquidCrystal_I2C lcd(0x27, 20, 4);

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
const char* deviceType = "BUDGET_MANAGEMENT";
int assignedPondId = 0;

// MQTT Topics
String statusTopic = "";
String dataTopic = "";
String commandTopic = "";

WiFiClient espClient;
PubSubClient client(espClient);

// Forward declaration
void publishStatus();

// ===================== PIN MAPPING =====================
#define ZMPT_PIN 34
#define ACS_PIN 35
#define RELAY_PIN 25

// ===================== CALIBRATION =====================
const float ADC_MAX = 4095.0;
const float V_REF = 3.3;
float V_calibration = 230.0 / 2048.0;
float voltageOffset = 0.0;
float I_calibration = 30.0 / 2048.0;
float currentOffset = 2048.0;

// ===================== VOLTAGE SAFETY RANGE =====================
const float V_SAFE_MIN = 210.0;
const float V_SAFE_MAX = 250.0;

// ===================== VARIABLES =====================
float voltage = 0, current = 0, power = 0, energyWh = 0;
unsigned long lastSample = 0;
unsigned long lastDisplay = 0;
unsigned long lastMqttPublish = 0;
unsigned long lastStatusPublish = 0;
const unsigned long MQTT_PUBLISH_INTERVAL = 3000;
const unsigned long STATUS_PUBLISH_INTERVAL = 5000; // Publish status every 5 seconds

// ===============================================================
//                      WiFi CONNECTION
// ===============================================================
void setupWiFi()
{
    delay(10);
    Serial.println();
    Serial.print("Connecting to ");
    Serial.println(ssid);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Connecting WiFi...");

    WiFi.begin(ssid, password);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20)
    {
        delay(500);
        lcd.setCursor(attempts % 20, 1);
        lcd.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED)
    {
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("WiFi Connected!");
        lcd.setCursor(0, 1);
        lcd.print(WiFi.localIP());
        delay(2000);
    }
    else
    {
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("WiFi Failed!");
        delay(3000);
    }
}

// ===============================================================
//                  MQTT CALLBACK (FIXED)
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
            Serial.println("No pondId");
            return;
        }

        assignedPondId = doc["pondId"].as<int>();
        Serial.print("Assigned to Pond: ");
        Serial.println(assignedPondId);

        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Assigned Pond:");
        lcd.setCursor(0, 1);
        lcd.print(assignedPondId);
        delay(1000);

        // Send status with pond info immediately for confirmation
        publishStatusWithPond();
    }
    else if (strcmp(command, "reset_energy") == 0)
    {
        energyWh = 0;
        Serial.println("Energy counter reset");

        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Energy Reset");
        delay(1000);
        
        publishStatus();
    }
    else if (strcmp(command, "unassign") == 0)
    {
        assignedPondId = 0;
        Serial.println("Unassigned from pond");

        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Unassigned");
        delay(1000);

        // Send status with pondId=0 immediately for confirmation
        publishStatusWithPond();
    }
    else
    {
        Serial.println("Unknown command");
    }
}

// ===============================================================
//                    MQTT RECONNECT
// ===============================================================
void reconnectMQTT()
{
    while (!client.connected())
    {
        Serial.print("Trying MQTT...");
        lcd.setCursor(0, 0);
        lcd.print("Connecting MQTT...");

        String clientId = "ESP32-" + deviceId;

        String willTopic = statusTopic;
        String willMsg = "{\"deviceId\":\"" + deviceId +
                         "\",\"status\":\"offline\"}";

        if (client.connect(clientId.c_str(), mqtt_user, mqtt_password,
                           willTopic.c_str(), 1, true, willMsg.c_str()))
        {
            lcd.setCursor(0, 0);
            lcd.print("MQTT Connected");

            client.subscribe(commandTopic.c_str());
            publishStatus();
            delay(1000);
        }
        else
        {
            lcd.setCursor(0, 0);
            lcd.print("MQTT Failed");
            delay(3000);
        }
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
    doc["energyWh"] = energyWh;

    String json;
    serializeJson(doc, json);

    client.publish(statusTopic.c_str(), json.c_str(), true);
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
    doc["energyWh"] = energyWh;

    String json;
    serializeJson(doc, json);

    client.publish(statusTopic.c_str(), json.c_str(), true);
    Serial.println("Status with pond assignment sent: " + json);
}

// ===============================================================
//                 PUBLISH SENSOR DATA
// ===============================================================
void publishSensorData()
{
    if (assignedPondId == 0)
        return;

    StaticJsonDocument<300> doc;
    doc["deviceId"] = deviceId;
    doc["pondId"] = assignedPondId;
    doc["voltage"] = voltage;
    doc["current"] = current;
    doc["power"] = power;
    doc["energyWh"] = energyWh;
    doc["status"] = "normal"; // Add status field for backend

    String json;
    serializeJson(doc, json);

    client.publish(dataTopic.c_str(), json.c_str());
    Serial.println("Sensor data published: " + json);
}

// ===============================================================
//                  SENSOR READ FUNCTIONS
// ===============================================================
float readVoltage(int pin, float scale, int samples = 10)
{
    long sum = 0;
    for (int i = 0; i < samples; i++)
    {
        sum += analogRead(pin);
        delay(2);
    }
    return abs((sum / samples - 2048.0) * scale);
}

float readCurrent(int pin, float scale, int samples = 10)
{
    long sum = 0;
    for (int i = 0; i < samples; i++)
    {
        sum += analogRead(pin);
        delay(2);
    }
    return abs((sum / samples - currentOffset) * scale);
}

// ===============================================================
//                       SETUP
// ===============================================================
void setup()
{
    Serial.begin(115200);
    Wire.begin(21, 23);

    lcd.init();
    lcd.backlight();
    lcd.print("Initializing...");
    delay(1500);

    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, HIGH);

    // Generate device ID with BM prefix (Budget Management)
    uint8_t mac[6];
    WiFi.macAddress(mac);
    deviceId = "BM_" + String(mac[3], HEX) + String(mac[4], HEX) + String(mac[5], HEX);
    deviceId.toUpperCase();

    statusTopic = "koi/sensors/" + deviceId + "/status";
    dataTopic = "koi/sensors/" + deviceId + "/data";
    commandTopic = "koi/sensors/" + deviceId + "/command";

    setupWiFi();

    client.setServer(mqtt_server, mqtt_port);
    client.setCallback(mqttCallback);
    client.setBufferSize(512);

    lcd.clear();
}

// ===============================================================
//                      MAIN LOOP
// ===============================================================
void loop()
{
    if (WiFi.status() != WL_CONNECTED)
        setupWiFi();

    if (!client.connected())
        reconnectMQTT();

    client.loop();

    unsigned long now = millis();
    float deltaT = (now - lastSample) / 1000.0;
    lastSample = now;

    voltage = readVoltage(ZMPT_PIN, V_calibration);
    current = readCurrent(ACS_PIN, I_calibration);
    power = voltage * current;
    energyWh += (power * deltaT) / 3600.0;

    if (voltage < V_SAFE_MIN || voltage > V_SAFE_MAX)
        digitalWrite(RELAY_PIN, LOW);
    else
        digitalWrite(RELAY_PIN, HIGH);

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

    if (now - lastDisplay >= 1000)
    {
        lastDisplay = now;

        lcd.setCursor(0, 0);
        lcd.print("Pond: ");
        lcd.print(assignedPondId);
        lcd.print("     ");

        lcd.setCursor(0, 1);
        lcd.print("V:");
        lcd.print(voltage, 1);
        lcd.print(" I:");
        lcd.print(current, 1);

        lcd.setCursor(0, 2);
        lcd.print("P:");
        lcd.print(power, 1);
        lcd.print("W      ");

        lcd.setCursor(0, 3);
        lcd.print("E:");
        lcd.print(energyWh, 1);
        lcd.print("Wh     ");
    }

    delay(80);
}