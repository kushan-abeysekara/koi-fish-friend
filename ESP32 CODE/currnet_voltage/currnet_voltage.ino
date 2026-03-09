#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
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

// ===================== WiFi CONFIG =====================
const char *ssid = "KoiFishFriend";
const char *password = "FiberTarget255";

// ===================== SUPABASE CONFIG =====================
// Same endpoint the water-quality device uses — ESP32 → HTTPS → Supabase directly
const char *supabase_url = "https://superbase.koifishfriend.online/pg/query";
const char *supabase_service_key =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwK"
    "ICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ."
    "DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q";

// Device configuration
String deviceId = "";
const char *deviceType = "BUDGET_MANAGEMENT";
int assignedPondId = 0;

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
const float V_SAFE_MIN = 190.0;
const float V_SAFE_MAX = 250.0;

// ===================== VARIABLES =====================
float voltage = 0, current = 0, power = 0, energyWh = 0;
unsigned long lastSample = 0;
unsigned long lastDisplay = 0;
unsigned long lastSupabaseLiveUpdate = 0;
unsigned long lastSupabaseHistoryInsert = 0;
unsigned long lastCommandPoll = 0;
unsigned long lastWiFiCheck = 0;
const unsigned long SUPABASE_LIVE_INTERVAL = 5000;     // UPSERT energydb every 5 s
const unsigned long SUPABASE_HISTORY_INTERVAL = 60000; // INSERT energy_history every 60 s
const unsigned long COMMAND_POLL_INTERVAL = 5000;      // Poll energy_commands every 5 s
const unsigned long WIFI_CHECK_INTERVAL = 5000;

// ===================== RELAY CONTROL =====================
bool manualMode = false;      // Manual control mode flag
bool relayManualState = true; // Manual relay state (true = ON, false = OFF)
bool scheduleMode = false;    // Schedule control mode flag

void setup()
{
    Serial.begin(115200);
    Wire.begin(21, 23);

    lcd.init();
    lcd.backlight();
    lcd.print("Initializing...");
    delay(1500);

    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW);
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
        digitalWrite(RELAY_PIN, LOW); // Start in ON state for AUTO mode
        Serial.println("Starting in AUTO mode");
    }

    // Generate device ID with BM prefix (Budget Management)
    uint8_t mac[6];
    WiFi.macAddress(mac);
    deviceId = "BM_" + String(mac[3], HEX) + String(mac[4], HEX) + String(mac[5], HEX);
    deviceId.toUpperCase();

    setupWiFi();

    // Initialize time from NTP
    initTime();

    // Load saved schedules
    loadSchedules();

    // Test Supabase connection
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Testing Supabase...");
    bool testOk = executeSupabaseQuery("SELECT 1");
    lcd.setCursor(0, 1);
    lcd.print(testOk ? "Supabase OK!" : "Supabase FAIL");
    delay(1500);

    lcd.clear();
}

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
//              SUPABASE HTTP HELPER
// ===============================================================
/**
 * Execute a raw SQL query against the Supabase pg/query endpoint.
 * Uses HTTPS with service_role JWT — same approach as water_quality.ino.
 * Returns true on HTTP 200.
 */
bool executeSupabaseQuery(String sql)
{
    if (WiFi.status() != WL_CONNECTED)
        return false;

    WiFiClientSecure secureClient;
    secureClient.setInsecure(); // Skip cert validation for self-hosted Supabase

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

// ===============================================================
//              UPSERT energydb (live — one row per device)
// ===============================================================
void upsertEnergyLive()
{
    String relayState = (digitalRead(RELAY_PIN) == HIGH) ? "ON" : "OFF";
    String controlMode = manualMode ? "manual" : (scheduleMode ? "schedule" : "auto");
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
                                    "voltage = EXCLUDED.voltage, current = EXCLUDED.current, "
                                    "power = EXCLUDED.power, energy_wh = EXCLUDED.energy_wh, "
                                    "status = EXCLUDED.status, rssi = EXCLUDED.rssi, "
                                    "ip_address = EXCLUDED.ip_address, updated_at = NOW()";

    bool ok = executeSupabaseQuery(sql);
    if (ok)
    {
        Serial.print("[Supabase] energydb upserted: V=");
        Serial.print(voltage, 1);
        Serial.print(" I=");
        Serial.print(current, 2);
        Serial.print(" P=");
        Serial.print(power, 1);
        Serial.print("W E=");
        Serial.print(energyWh, 1);
        Serial.println("Wh");
    }
}

// ===============================================================
//              INSERT energy_history (1 row per minute)
// ===============================================================
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

    bool ok = executeSupabaseQuery(sql);
    if (ok)
        Serial.println("[Supabase] energy_history inserted (1/min)");
}

// ===============================================================
//              POLL energy_commands (bidirectional control)
// ===============================================================
// Frontend / backend writes a row to energy_commands:
//   { device_id, command, executed: false }
// ESP32 polls this table, executes the command, marks executed = true.
void pollEnergyCommands()
{
    String sql =
        "SELECT id, command FROM energy_commands "
        "WHERE device_id = '" +
        deviceId + "' AND executed = false "
                   "ORDER BY created_at ASC LIMIT 1";

    if (WiFi.status() != WL_CONNECTED)
        return;

    WiFiClientSecure secureClient;
    secureClient.setInsecure();
    HTTPClient http;
    http.begin(secureClient, supabase_url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", supabase_service_key);
    http.addHeader("Authorization", String("Bearer ") + supabase_service_key);
    http.setTimeout(5000);

    StaticJsonDocument<256> reqDoc;
    reqDoc["query"] = sql;
    String body;
    serializeJson(reqDoc, body);

    int httpCode = http.POST(body);
    if (httpCode != 200)
    {
        http.end();
        return;
    }

    String resp = http.getString();
    http.end();

    StaticJsonDocument<512> respDoc;
    if (deserializeJson(respDoc, resp) != DeserializationError::Ok)
        return;

    JsonArray rows = respDoc.isNull() ? JsonArray() : (respDoc.is<JsonArray>() ? respDoc.as<JsonArray>() : (respDoc.containsKey("rows") ? respDoc["rows"].as<JsonArray>() : JsonArray()));

    if (!rows || rows.size() == 0)
        return;

    int cmdId = rows[0]["id"].as<int>();
    String command = rows[0]["command"].as<const char *>();

    // Execute command
    if (command == "power_on")
    {
        manualMode = true;
        relayManualState = true;
        digitalWrite(RELAY_PIN, HIGH);
        savePowerState();
        Serial.println("[CMD] power_on");
    }
    else if (command == "power_off")
    {
        manualMode = true;
        relayManualState = false;
        digitalWrite(RELAY_PIN, LOW);
        savePowerState();
        Serial.println("[CMD] power_off");
    }
    else if (command == "auto_mode")
    {
        manualMode = false;
        scheduleMode = false;
        savePowerState();
        Serial.println("[CMD] auto_mode");
    }
    else if (command == "schedule_mode")
    {
        manualMode = false;
        scheduleMode = true;
        savePowerState();
        Serial.println("[CMD] schedule_mode");
    }
    else if (command == "reset_energy")
    {
        energyWh = 0;
        Serial.println("[CMD] reset_energy");
    }

    // Mark command as executed
    String markSql = "UPDATE energy_commands SET executed = true WHERE id = " + String(cmdId);
    executeSupabaseQuery(markSql);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("CMD: ");
    lcd.print(command.substring(0, 15));
    delay(800);
}

// ===============================================================
//                  MQTT CALLBACK (REMOVED)
// ===============================================================
// Commands now arrive via Supabase energy_commands table (pollEnergyCommands).
// This stub exists only in case old code references it — it is never called.
void mqttCallback(char * /*topic*/, byte * /*payload*/, unsigned int /*length*/)
{
    // no-op — MQTT removed, using Supabase direct HTTPS
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

// ===============================================================
//                      MAIN LOOP
// ===============================================================
void loop()
{
    unsigned long now = millis();

    // -- Maintain WiFi --
    if (now - lastWiFiCheck >= WIFI_CHECK_INTERVAL)
    {
        lastWiFiCheck = now;
        if (WiFi.status() != WL_CONNECTED)
        {
            Serial.println("WiFi lost — reconnecting...");
            setupWiFi();
        }
    }
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

    // -- UPSERT energydb every 5 s (real-time dashboard data) --
    if (now - lastSupabaseLiveUpdate >= SUPABASE_LIVE_INTERVAL)
    {
        lastSupabaseLiveUpdate = now;
        upsertEnergyLive();
    }

    // -- INSERT energy_history every 60 s (chart/trend data) --
    if (now - lastSupabaseHistoryInsert >= SUPABASE_HISTORY_INTERVAL)
    {
        lastSupabaseHistoryInsert = now;
        insertEnergyHistory();
    }

    // -- Poll energy_commands every 5 s (power control from frontend) --
    if (now - lastCommandPoll >= COMMAND_POLL_INTERVAL)
    {
        lastCommandPoll = now;
        pollEnergyCommands();
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
