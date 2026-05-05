#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>

// ===================== LCD SETUP =====================
LiquidCrystal_I2C lcd(0x27, 20, 4);

// ===================== PREFERENCES =====================
Preferences preferences;

// ===================== TIME CONFIGURATION =====================
const char *ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800;
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
    bool daysOfWeek[7];
    char name[32];
};

#define MAX_SCHEDULES 10
PowerSchedule schedules[MAX_SCHEDULES];
int scheduleCount = 0;

// ===================== WIFI CONFIG =====================
const char *ssid = "KoiFishFriend";
const char *password = "FiberTarget255";

// ===================== SUPABASE CONFIG =====================
const char *supabase_url = "https://superbase.koifishfriend.online/pg/query";
const char *supabase_service_key =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImlhdCI6MTY0MTc2OTIwMCwiZXhwIjoxNzk5NTM1NjAwfQ."
    "Ir4JTpoRDgWovxTyAAB_SvVbEAtCo7bN8JIlCBLRRDk";

// ===================== MQTT CONFIG =====================
const char *mqtt_server = "187.77.189.5";
const int mqtt_port = 1883;
WiFiClient mqttNetClient;
PubSubClient mqttClient(mqttNetClient);
String commandTopic = "";
String statusTopic = "";

// ===================== DEVICE CONFIG =====================
String deviceId = "";
const char *deviceType = "BUDGET_MANAGEMENT";
int assignedPondId = 0;

// ===================== PIN MAPPING =====================
#define ADC_PIN 34 // New transformer voltage module
#define ACS_PIN 35 // Current sensor
#define RELAY_PIN 17

// ===================== CALIBRATION =====================
const float ADC_MAX = 4095.0;
const float V_REF = 3.3;

// New handmade transformer voltage module calibration
float voltage_calibration_factor = 1427.0;

// Current sensor calibration
float I_calibration = 30.0 / 2048.0;
float currentOffset = 2048.0;

// ===================== VOLTAGE SAFETY RANGE =====================
const float V_SAFE_MIN = 190.0;
const float V_SAFE_MAX = 250.0;

// ===================== VARIABLES =====================
float voltage = 0, current = 0, power = 0, energyWh = 0;
unsigned long lastSample = 0;
unsigned long lastDisplay = 0;
unsigned long lastSupabaseLiveUpdate = 0;
unsigned long lastSupabaseHistoryInsert = 0;
unsigned long lastWiFiCheck = 0;
unsigned long lastStatusPublish = 0;

const unsigned long SUPABASE_LIVE_INTERVAL = 5000;
const unsigned long SUPABASE_HISTORY_INTERVAL = 60000;
const unsigned long WIFI_CHECK_INTERVAL = 5000;
const unsigned long MQTT_STATUS_INTERVAL = 5000;

// ===================== RELAY CONTROL =====================
bool manualMode = false;
bool relayManualState = true;
bool scheduleMode = false;

void applyPowerCommand(const String &command);
bool connectMQTT();
void mqttCallback(char *topic, byte *payload, unsigned int length);
void publishStatus();

// ===============================================================
// SETUP
// ===============================================================
void setup()
{
    Serial.begin(115200);

    // ADC setup for new voltage module
    analogReadResolution(12);
    analogSetPinAttenuation(ADC_PIN, ADC_11db);
    analogSetPinAttenuation(ACS_PIN, ADC_11db);

    Wire.begin(21, 23);

    lcd.init();
    lcd.backlight();
    lcd.print("Initializing...");
    delay(1500);

    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW);

    loadPowerState();

    if (manualMode)
    {
        digitalWrite(RELAY_PIN, relayManualState ? HIGH : LOW);
    }
    else
    {
        digitalWrite(RELAY_PIN, LOW);
    }

    uint8_t mac[6];
    WiFi.macAddress(mac);
    deviceId = "BM_" + String(mac[3], HEX) + String(mac[4], HEX) + String(mac[5], HEX);
    deviceId.toUpperCase();
    commandTopic = "koi/sensors/" + deviceId + "/command";
    statusTopic = "koi/sensors/" + deviceId + "/status";

    setupWiFi();
    mqttClient.setServer(mqtt_server, mqtt_port);
    mqttClient.setCallback(mqttCallback);
    mqttClient.setBufferSize(1024);
    mqttClient.setKeepAlive(20);
    connectMQTT();
    initTime();
    loadSchedules();

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Testing Supabase...");
    bool testOk = executeSupabaseQuery("SELECT 1");
    lcd.setCursor(0, 1);
    lcd.print(testOk ? "Supabase OK!" : "Supabase FAIL");
    delay(1500);

    lcd.clear();
}

bool connectMQTT()
{
    if (WiFi.status() != WL_CONNECTED)
        return false;

    if (mqttClient.connected())
        return true;

    String clientId = "ESP32_BM_" + deviceId + "_" + String(random(0xffff), HEX);
    if (!mqttClient.connect(clientId.c_str()))
    {
        Serial.print("[MQTT] Connect failed, rc=");
        Serial.println(mqttClient.state());
        return false;
    }

    if (mqttClient.subscribe(commandTopic.c_str()))
    {
        Serial.print("[MQTT] Subscribed: ");
        Serial.println(commandTopic);
    }
    else
    {
        Serial.println("[MQTT] Subscribe failed");
    }

    publishStatus();
    return true;
}

void publishStatus()
{
    if (!mqttClient.connected())
        return;

    StaticJsonDocument<384> doc;
    doc["deviceId"] = deviceId;
    doc["status"] = "online";
    doc["relayState"] = digitalRead(RELAY_PIN) == HIGH ? "ON" : "OFF";
    doc["controlMode"] = manualMode ? "manual" : (scheduleMode ? "schedule" : "auto");
    doc["scheduleCount"] = scheduleCount;
    doc["ipAddress"] = WiFi.localIP().toString();
    doc["rssi"] = WiFi.RSSI();
    doc["energyWh"] = energyWh;

    String payload;
    serializeJson(doc, payload);
    mqttClient.publish(statusTopic.c_str(), payload.c_str(), true);
}

void applyPowerCommand(const String &command)
{
    if (command == "power_on")
    {
        manualMode = true;
        scheduleMode = false;
        relayManualState = true;
        digitalWrite(RELAY_PIN, HIGH);
        savePowerState();
    }
    else if (command == "power_off")
    {
        manualMode = true;
        scheduleMode = false;
        relayManualState = false;
        digitalWrite(RELAY_PIN, LOW);
        savePowerState();
    }
    else if (command == "auto_mode")
    {
        manualMode = false;
        scheduleMode = false;
        savePowerState();
    }
    else if (command == "schedule_mode")
    {
        manualMode = false;
        scheduleMode = true;
        savePowerState();
    }
    else if (command == "reset_energy")
    {
        energyWh = 0;
    }
}

void mqttCallback(char *topic, byte *payload, unsigned int length)
{
    if (String(topic) != commandTopic)
        return;

    String message;
    message.reserve(length + 1);
    for (unsigned int i = 0; i < length; i++)
    {
        message += (char)payload[i];
    }

    StaticJsonDocument<2048> doc;
    DeserializationError err = deserializeJson(doc, message);
    if (err)
    {
        Serial.print("[MQTT] JSON parse failed: ");
        Serial.println(err.c_str());
        return;
    }

    if (!doc.containsKey("command"))
        return;

    String command = doc["command"].as<const char *>();
    Serial.print("[MQTT] Command: ");
    Serial.println(command);

    if (command == "sync_schedules")
    {
        JsonArray in = doc["schedules"].as<JsonArray>();
        int index = 0;

        for (JsonObject sch : in)
        {
            if (index >= MAX_SCHEDULES)
                break;

            schedules[index].enabled = sch["enabled"] | true;
            schedules[index].startHour = sch["startHour"] | 0;
            schedules[index].startMinute = sch["startMinute"] | 0;
            schedules[index].endHour = sch["endHour"] | 0;
            schedules[index].endMinute = sch["endMinute"] | 0;

            JsonArray days = sch["daysOfWeek"].as<JsonArray>();
            for (int d = 0; d < 7; d++)
            {
                schedules[index].daysOfWeek[d] = (d < days.size()) ? (bool)days[d] : false;
            }

            const char *name = sch["name"] | "Schedule";
            strncpy(schedules[index].name, name, sizeof(schedules[index].name) - 1);
            schedules[index].name[sizeof(schedules[index].name) - 1] = '\0';

            index++;
        }

        scheduleCount = index;
        saveSchedules();
    }
    else
    {
        applyPowerCommand(command);
    }

    publishStatus();
}

// ===============================================================
// TIME
// ===============================================================
void initTime()
{
    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Syncing time...");

    int attempts = 0;
    while (!getLocalTime(&timeinfo) && attempts < 10)
    {
        delay(500);
        attempts++;
    }

    lcd.setCursor(0, 1);
    lcd.print(attempts < 10 ? "Time synced!" : "Time sync failed");
    delay(1000);
}

// ===============================================================
// SAVE / LOAD SCHEDULES
// ===============================================================
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
}

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
}

bool checkSchedules()
{
    if (!getLocalTime(&timeinfo))
        return false;

    int currentHour = timeinfo.tm_hour;
    int currentMinute = timeinfo.tm_min;
    int currentDay = timeinfo.tm_wday;
    int currentTime = currentHour * 60 + currentMinute;

    for (int i = 0; i < scheduleCount; i++)
    {
        if (!schedules[i].enabled)
            continue;
        if (!schedules[i].daysOfWeek[currentDay])
            continue;

        int startTime = schedules[i].startHour * 60 + schedules[i].startMinute;
        int endTime = schedules[i].endHour * 60 + schedules[i].endMinute;

        if (endTime < startTime)
        {
            if (currentTime >= startTime || currentTime < endTime)
                return true;
        }
        else
        {
            if (currentTime >= startTime && currentTime < endTime)
                return true;
        }
    }

    return false;
}

// ===============================================================
// SAVE / LOAD POWER STATE
// ===============================================================
void savePowerState()
{
    preferences.begin("power", false);
    preferences.putBool("manual", manualMode);
    preferences.putBool("state", relayManualState);
    preferences.putBool("schedule", scheduleMode);
    preferences.end();
}

void loadPowerState()
{
    preferences.begin("power", true);
    manualMode = preferences.getBool("manual", false);
    relayManualState = preferences.getBool("state", false);
    scheduleMode = preferences.getBool("schedule", false);
    preferences.end();
}

// ===============================================================
// WIFI
// ===============================================================
void setupWiFi()
{
    WiFi.begin(ssid, password);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Connecting WiFi...");

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20)
    {
        delay(500);
        lcd.setCursor(attempts % 20, 1);
        lcd.print(".");
        attempts++;
    }

    lcd.clear();
    lcd.setCursor(0, 0);

    if (WiFi.status() == WL_CONNECTED)
    {
        lcd.print("WiFi Connected!");
        lcd.setCursor(0, 1);
        lcd.print(WiFi.localIP());
    }
    else
    {
        lcd.print("WiFi Failed!");
    }

    delay(2000);
}

// ===============================================================
// SUPABASE HELPER
// ===============================================================
bool executeSupabaseQuery(String sql)
{
    if (WiFi.status() != WL_CONNECTED)
        return false;

    WiFiClientSecure secureClient;
    secureClient.setInsecure();

    HTTPClient http;
    http.begin(secureClient, supabase_url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", supabase_service_key);
    http.addHeader("Authorization", String("Bearer ") + supabase_service_key);
    http.setTimeout(5000);

    StaticJsonDocument<2048> doc;
    doc["query"] = sql;

    String body;
    serializeJson(doc, body);

    int httpCode = http.POST(body);
    bool success = (httpCode == 200);

    if (!success)
    {
        Serial.print("[Supabase] HTTP ");
        Serial.print(httpCode);
        Serial.print(": ");
        Serial.println(http.getString().substring(0, 200));
    }

    http.end();
    return success;
}

void upsertEnergyLive()
{
    String status = "normal";

    String sql =
        "INSERT INTO energydb "
        "(device_id, voltage, current, power, energy_wh, status, rssi, ip_address, updated_at) "
        "VALUES ('" +
        deviceId + "', " +
        String(voltage, 2) + ", " +
        String(current, 3) + ", " +
        String(power, 1) + ", " +
        String(energyWh, 3) + ", '" +
        status + "', " +
        String(WiFi.RSSI()) + ", '" +
        WiFi.localIP().toString() + "', NOW()) "
                                    "ON CONFLICT (device_id) DO UPDATE SET "
                                    "voltage = EXCLUDED.voltage, "
                                    "current = EXCLUDED.current, "
                                    "power = EXCLUDED.power, "
                                    "energy_wh = EXCLUDED.energy_wh, "
                                    "status = EXCLUDED.status, "
                                    "rssi = EXCLUDED.rssi, "
                                    "ip_address = EXCLUDED.ip_address, "
                                    "updated_at = NOW()";

    executeSupabaseQuery(sql);
}

void insertEnergyHistory()
{
    String sql =
        "INSERT INTO energy_history "
        "(device_id, voltage, current, power, energy_wh, status, recorded_at) "
        "VALUES ('" +
        deviceId + "', " +
        String(voltage, 2) + ", " +
        String(current, 3) + ", " +
        String(power, 1) + ", " +
        String(energyWh, 3) + ", 'normal', NOW())";

    executeSupabaseQuery(sql);
}

// ===============================================================
// SENSOR READ FUNCTIONS
// ===============================================================
float readNewVoltageModule()
{
    const int sample_count = 200;
    float sum = 0;
    float sum_sq = 0;

    for (int i = 0; i < sample_count; i++)
    {
        int raw = analogRead(ADC_PIN);
        float adc_voltage = (raw / ADC_MAX) * V_REF;
        sum += adc_voltage;
        delayMicroseconds(200);
    }

    float offset = sum / sample_count;

    for (int i = 0; i < sample_count; i++)
    {
        int raw = analogRead(ADC_PIN);
        float adc_voltage = (raw / ADC_MAX) * V_REF;

        float ac = adc_voltage - offset;
        sum_sq += ac * ac;

        delayMicroseconds(200);
    }

    float rms = sqrt(sum_sq / sample_count);
    float mains_voltage = rms * voltage_calibration_factor;

    return mains_voltage;
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
// MAIN LOOP
// ===============================================================
void loop()
{
    unsigned long now = millis();

    if (now - lastWiFiCheck >= WIFI_CHECK_INTERVAL)
    {
        lastWiFiCheck = now;
        if (WiFi.status() != WL_CONNECTED)
        {
            setupWiFi();
        }
    }

    if (!mqttClient.connected())
    {
        connectMQTT();
    }
    mqttClient.loop();

    float deltaT = (now - lastSample) / 1000.0;
    lastSample = now;

    voltage = readNewVoltageModule();
    current = readCurrent(ACS_PIN, I_calibration);

    power = voltage * current;
    energyWh += (power * deltaT) / 3600.0;

    if (manualMode)
    {
        digitalWrite(RELAY_PIN, relayManualState ? HIGH : LOW);
    }
    else if (scheduleMode)
    {
        bool shouldBeOn = checkSchedules();
        digitalWrite(RELAY_PIN, shouldBeOn ? HIGH : LOW);
    }
    else
    {
        if (voltage < V_SAFE_MIN || voltage > V_SAFE_MAX)
        {
            digitalWrite(RELAY_PIN, LOW);
        }
        else
        {
            digitalWrite(RELAY_PIN, HIGH);
        }
    }

    if (now - lastSupabaseLiveUpdate >= SUPABASE_LIVE_INTERVAL)
    {
        lastSupabaseLiveUpdate = now;
        upsertEnergyLive();
    }

    if (now - lastSupabaseHistoryInsert >= SUPABASE_HISTORY_INTERVAL)
    {
        lastSupabaseHistoryInsert = now;
        insertEnergyHistory();
    }

    if (now - lastStatusPublish >= MQTT_STATUS_INTERVAL)
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

        if (manualMode)
        {
            lcd.print(relayManualState ? "[ON] " : "[OFF]");
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