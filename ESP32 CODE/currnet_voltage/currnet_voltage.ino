#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>

// ===================== LCD SETUP =====================
LiquidCrystal_I2C lcd(0x27, 20, 4);

// ===================== PREFERENCES (PERSISTENT STORAGE) =====================
Preferences preferences;

// ===================== TIME CONFIGURATION =====================
const char *ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800; // GMT+5:30 for Sri Lanka (change as needed)
const int daylightOffset_sec = 0;
struct tm timeinfo;

// ===================== SCHEDULE STRUCTURE =====================
struct PowerSchedule
{
    bool enabled;
    int startHour;
    int startMinute;
    int endHour;
    int endMinute;
    bool daysOfWeek[7]; // 0=Sunday, 6=Saturday
    char name[32];
};

#define MAX_SCHEDULES 10
PowerSchedule schedules[MAX_SCHEDULES];
int scheduleCount = 0;

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
const char *deviceType = "BUDGET_MANAGEMENT";
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
#define ZMPT_PIN 34
#define ACS_PIN 35
#define RELAY_PIN 17

// ===================== CALIBRATION =====================
const float ADC_MAX = 4095.0;
const float V_REF = 3.3;
float V_calibration = 0.374; // Calibrated for 220V AC (adjusted from 230.0/2048.0)
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

// ===================== RELAY CONTROL =====================
bool manualMode = false;      // Manual control mode flag
bool relayManualState = true; // Manual relay state (true = ON, false = OFF)
bool scheduleMode = false;    // Schedule control mode flag

// ===================== HELPER FUNCTIONS =====================
// Initialize time from NTP server
void initTime()
{
    Serial.println("Initializing NTP time...");
    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Syncing time...");

    int attempts = 0;
    while (!getLocalTime(&timeinfo) && attempts < 10)
    {
        delay(500);
        attempts++;
        Serial.print(".");
    }

    if (attempts < 10)
    {
        Serial.println("\nTime synchronized!");
        lcd.setCursor(0, 1);
        lcd.print("Time synced!");
        delay(1000);
    }
    else
    {
        Serial.println("\nFailed to sync time");
        lcd.setCursor(0, 1);
        lcd.print("Time sync failed");
        delay(1000);
    }
}

// Save schedules to persistent storage
void saveSchedules()
{
    preferences.begin("schedules", false);
    preferences.putInt("count", scheduleCount);

    for (int i = 0; i < scheduleCount; i++)
    {
        String key = "sch" + String(i);
        preferences.putBytes(key.c_str(), &schedules[i], sizeof(PowerSchedule));
    }

    preferences.end();
    Serial.println("Schedules saved to flash");
}

// Load schedules from persistent storage
void loadSchedules()
{
    preferences.begin("schedules", true);
    scheduleCount = preferences.getInt("count", 0);

    if (scheduleCount > MAX_SCHEDULES)
        scheduleCount = MAX_SCHEDULES;

    for (int i = 0; i < scheduleCount; i++)
    {
        String key = "sch" + String(i);
        preferences.getBytes(key.c_str(), &schedules[i], sizeof(PowerSchedule));
    }

    preferences.end();
    Serial.print("Loaded ");
    Serial.print(scheduleCount);
    Serial.println(" schedules from flash");
}

// Check if current time matches any enabled schedule
bool checkSchedules()
{
    if (!getLocalTime(&timeinfo))
    {
        return false; // Can't check without valid time
    }

    int currentHour = timeinfo.tm_hour;
    int currentMinute = timeinfo.tm_min;
    int currentDay = timeinfo.tm_wday; // 0=Sunday
    int currentTime = currentHour * 60 + currentMinute;

    for (int i = 0; i < scheduleCount; i++)
    {
        if (!schedules[i].enabled)
            continue;
        if (!schedules[i].daysOfWeek[currentDay])
            continue;

        int startTime = schedules[i].startHour * 60 + schedules[i].startMinute;
        int endTime = schedules[i].endHour * 60 + schedules[i].endMinute;

        // Handle schedules that cross midnight
        if (endTime < startTime)
        {
            if (currentTime >= startTime || currentTime < endTime)
            {
                return true; // Within active schedule
            }
        }
        else
        {
            if (currentTime >= startTime && currentTime < endTime)
            {
                return true; // Within active schedule
            }
        }
    }

    return false; // No active schedules
}

// Save power control state to persistent storage
void savePowerState()
{
    preferences.begin("power", false);
    preferences.putBool("manual", manualMode);
    preferences.putBool("state", relayManualState);
    preferences.putBool("schedule", scheduleMode);
    preferences.end();
    Serial.println("Power state saved to flash");
}

// Load power control state from persistent storage
void loadPowerState()
{
    preferences.begin("power", true);                       // Read-only mode
    manualMode = preferences.getBool("manual", false);      // Default: AUTO mode
    relayManualState = preferences.getBool("state", false); // Default: OFF
    scheduleMode = preferences.getBool("schedule", false);  // Default: OFF
    preferences.end();

    Serial.print("Power state loaded: Mode=");
    Serial.print(manualMode ? "MANUAL" : (scheduleMode ? "SCHEDULE" : "AUTO"));
    Serial.print(", State=");
    Serial.println(relayManualState ? "ON" : "OFF");
}

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
    else if (strcmp(command, "power_on") == 0)
    {
        manualMode = true;
        relayManualState = true;
        digitalWrite(RELAY_PIN, HIGH);
        savePowerState(); // Save to flash
        Serial.println("Power turned ON manually");

        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("POWER: ON");
        lcd.setCursor(0, 1);
        lcd.print("(Manual Mode)");
        delay(1000);

        publishStatus();
    }
    else if (strcmp(command, "power_off") == 0)
    {
        manualMode = true;
        relayManualState = false;
        digitalWrite(RELAY_PIN, LOW);
        savePowerState(); // Save to flash
        Serial.println("Power turned OFF manually");

        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("POWER: OFF");
        lcd.setCursor(0, 1);
        lcd.print("(Manual Mode)");
        delay(1000);

        publishStatus();
    }
    else if (strcmp(command, "auto_mode") == 0)
    {
        manualMode = false;
        scheduleMode = false;
        savePowerState(); // Save to flash
        Serial.println("Switched to AUTO mode (voltage-based)");

        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("AUTO Mode");
        lcd.setCursor(0, 1);
        lcd.print("Voltage Control");
        delay(1000);

        publishStatus();
    }
    else if (strcmp(command, "schedule_mode") == 0)
    {
        manualMode = false;
        scheduleMode = true;
        savePowerState(); // Save to flash
        Serial.println("Switched to SCHEDULE mode");

        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("SCHEDULE Mode");
        lcd.setCursor(0, 1);
        lcd.print("Time-based Control");
        delay(1000);

        publishStatus();
    }
    else if (strcmp(command, "sync_schedules") == 0)
    {
        if (!doc.containsKey("schedules"))
        {
            Serial.println("No schedules array");
            return;
        }

        JsonArray schedulesArray = doc["schedules"].as<JsonArray>();
        scheduleCount = 0;

        for (JsonObject schedObj : schedulesArray)
        {
            if (scheduleCount >= MAX_SCHEDULES)
                break;

            schedules[scheduleCount].enabled = schedObj["enabled"] | false;
            schedules[scheduleCount].startHour = schedObj["startHour"] | 0;
            schedules[scheduleCount].startMinute = schedObj["startMinute"] | 0;
            schedules[scheduleCount].endHour = schedObj["endHour"] | 0;
            schedules[scheduleCount].endMinute = schedObj["endMinute"] | 0;

            const char *name = schedObj["name"] | "Schedule";
            strncpy(schedules[scheduleCount].name, name, 31);
            schedules[scheduleCount].name[31] = '\0';

            JsonArray days = schedObj["daysOfWeek"].as<JsonArray>();
            for (int i = 0; i < 7; i++)
            {
                schedules[scheduleCount].daysOfWeek[i] = (i < days.size()) ? days[i].as<bool>() : false;
            }

            scheduleCount++;
        }

        saveSchedules();
        Serial.print("Synced ");
        Serial.print(scheduleCount);
        Serial.println(" schedules");

        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Schedules Synced");
        lcd.setCursor(0, 1);
        lcd.print("Count: ");
        lcd.print(scheduleCount);
        delay(1000);

        publishStatus();
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
    doc["relayState"] = digitalRead(RELAY_PIN) == HIGH ? "ON" : "OFF";
    doc["controlMode"] = manualMode ? "manual" : (scheduleMode ? "schedule" : "auto");
    doc["scheduleCount"] = scheduleCount;

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

    // Load saved power state from flash
    loadPowerState();

    // Apply loaded state to relay
    if (manualMode)
    {
        digitalWrite(RELAY_PIN, relayManualState ? HIGH : LOW);
        Serial.print("Restored manual mode: ");
        Serial.println(relayManualState ? "ON" : "OFF");
    }
    else
    {
        digitalWrite(RELAY_PIN, HIGH); // Start in ON state for AUTO mode
        Serial.println("Starting in AUTO mode");
    }

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

    // Initialize time from NTP
    initTime();

    // Load saved schedules
    loadSchedules();

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

    // Relay control: Manual mode overrides automatic voltage-based control
    if (manualMode)
    {
        digitalWrite(RELAY_PIN, relayManualState ? HIGH : LOW);
    }
    else if (scheduleMode)
    {
        // Schedule-based control
        bool shouldBeOn = checkSchedules();
        digitalWrite(RELAY_PIN, shouldBeOn ? HIGH : LOW);
    }
    else
    {
        // Automatic voltage-based control
        if (voltage < V_SAFE_MIN || voltage > V_SAFE_MAX)
            digitalWrite(RELAY_PIN, LOW);
        else
            digitalWrite(RELAY_PIN, HIGH);
    }

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
        lcd.print("Pond:");
        lcd.print(assignedPondId);
        lcd.print(" ");

        // Show power mode and relay state
        if (manualMode)
        {
            lcd.print(relayManualState ? "[ON]" : "[OFF]");
        }
        else if (scheduleMode)
        {
            lcd.print("[SCH]");
        }
        else
        {
            lcd.print("[AUTO]");
        }
        lcd.print("   ");

        lcd.setCursor(0, 1);
        lcd.print("V:");
        lcd.print(voltage, 1);
        lcd.print(" I:");
        lcd.print(current, 1);
        lcd.print("    ");

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