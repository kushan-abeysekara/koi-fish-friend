/*
  ESP32 Water Quality Monitor - Supabase Direct (No MQTT)
  ========================================================
  Reads pH, Turbidity, CO2, Ammonia, Rain sensors and pushes data
  directly to Supabase via HTTPS REST (pg/query endpoint).

  Data flow:
    ESP32 -> HTTPS POST -> Supabase sensor_live  (UPSERT every 5 s)
    ESP32 -> HTTPS POST -> Supabase sensor_history (INSERT every 60 s)

  Backend continuously polls sensor_live -> broadcasts via WebSocket.
  Frontend subscribes to Supabase Realtime on sensor_live table.

  Required Libraries:
    - ArduinoJson  (v6+)
    - WiFi         (built-in ESP32 core)
    - HTTPClient   (built-in ESP32 core)
    - WiFiClientSecure (built-in ESP32 core)
*/

#include "soc/soc.h"              // Brownout detector disable
#include "soc/rtc_cntl_reg.h"     // RTC control register
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ===================== WiFi CONFIG =====================
const char *ssid = "KoiFishFriend";
const char *password = "FiberTarget255";

// Static IP Configuration for Water Quality Device
IPAddress local_IP(192, 168, 8, 102);
IPAddress gateway(192, 168, 8, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress primaryDNS(8, 8, 8, 8);
IPAddress secondaryDNS(8, 8, 4, 4);

// ===================== SUPABASE CONFIG =====================
// Self-hosted Supabase - pg/query endpoint for SQL UPSERT/INSERT
const char *supabase_url = "https://superbase.koifishfriend.online/pg/query";
const char *supabase_service_key =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwK"
    "ICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ."
    "DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q";

// Device configuration
String deviceId = "";
const char *deviceType = "WATER_QUALITY";
int assignedPondId = 3; // Default Pond 3

// Timing
unsigned long lastSensorLiveUpdate = 0;
const unsigned long SENSOR_LIVE_INTERVAL = 5000;     // UPSERT sensor_live every 5 s (reduced from 2s to prevent brownout)
unsigned long lastSensorHistoryInsert = 0;
const unsigned long SENSOR_HISTORY_INTERVAL = 60000;  // INSERT sensor_history every 60 s
unsigned long lastWiFiCheck = 0;
const unsigned long WIFI_CHECK_INTERVAL = 5000;

// Serial toggle: set to true ONLY for debugging with Serial Monitor
#define ENABLE_SERIAL true

// ===================== PIN MAPPING =====================
#define PH_PIN 32           // pH sensor analog input (GPIO 32 / ADC1_CH4)
#define MQ135_PIN 33        // MQ135 gas sensor for CO2 and NH3 (GPIO 33 / ADC1_CH5)
#define RAIN_ANALOG_PIN 34  // Rain sensor analog input (GPIO 34 / ADC1_CH6)
#define TURBIDITY_PIN 35    // Turbidity sensor analog input (GPIO 35 / ADC1_CH7) ← original pin
#define RAIN_DIGITAL_PIN 26 // Rain sensor digital output (GPIO 26) HIGH=dry, LOW=rain

// ===================== CALIBRATION =====================
const float ADC_MAX = 4095.0;
const float V_REF = 3.3;

// pH calibration
const float PH_NEUTRAL_VOLTAGE = 2.5;
const float PH_STEP = 0.18;

// Turbidity calibration
const float TURBIDITY_CLEAR_WATER_VOLTAGE = 4.2;
const float TURBIDITY_MAX_NTU = 3000.0;

// ===================== SENSOR VARIABLES =====================
float phValue = 7.0;
float turbidity = 0.0;
float co2Level = 0.0;
float ammonia = 0.0;
float rainLevel = 0.0;
bool rainDetected = false;
String rainStatus = "dry";
String waterQualityStatus = "normal";

// ===============================================================
//                      WiFi CONNECTION
// ===============================================================
void setupWiFi()
{
    delay(10);
    if (ENABLE_SERIAL)
    {
        Serial.println();
        Serial.println("========================================");
        Serial.println("Water Quality Device - WiFi Setup");
        Serial.println("========================================");
    }

    if (!WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS))
    {
        if (ENABLE_SERIAL)
            Serial.println("Static IP configuration failed");
    }
    else
    {
        if (ENABLE_SERIAL)
            Serial.println("Static IP configured: 192.168.8.102");
    }

    if (ENABLE_SERIAL)
    {
        Serial.print("Connecting to ");
        Serial.println(ssid);
    }

    WiFi.setSleep(false);           // Disable WiFi modem sleep for stable connection
    WiFi.setTxPower(WIFI_POWER_17dBm); // Reduce TX power to lower current draw
    WiFi.begin(ssid, password);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 40)
    {
        delay(250);
        if (ENABLE_SERIAL) Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED)
    {
        if (ENABLE_SERIAL)
        {
            Serial.println();
            Serial.println("========================================");
            Serial.println("WiFi Connected!");
            Serial.print("IP Address: ");
            Serial.println(WiFi.localIP());
            Serial.print("RSSI: ");
            Serial.print(WiFi.RSSI());
            Serial.println(" dBm");
            Serial.println("========================================");
        }
    }
    else
    {
        if (ENABLE_SERIAL)
        {
            Serial.println();
            Serial.println("WiFi Connection Failed!");
        }
    }
}

// ===============================================================
//                SUPABASE HTTP FUNCTIONS
// ===============================================================

/**
 * Execute a SQL query on Supabase via the pg/query endpoint.
 * Uses service_role key for full write access.
 * Returns true on success.
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

    // Build JSON body with the SQL query
    StaticJsonDocument<2048> doc;
    doc["query"] = sql;
    String body;
    serializeJson(doc, body);

    int httpCode = http.POST(body);
    bool success = (httpCode == 200);

    if (ENABLE_SERIAL)
    {
        if (success)
        {
            Serial.println("[Supabase] Query OK");
        }
        else
        {
            Serial.print("[Supabase] HTTP ");
            Serial.print(httpCode);
            Serial.print(": ");
            Serial.println(http.getString().substring(0, 200));
        }
    }

    http.end();
    return success;
}

/**
 * UPSERT current sensor data into Supabase sensor_live table.
 * Called every 2 seconds - provides real-time data via Supabase Realtime.
 */
void upsertSensorLive()
{
    String sql = "INSERT INTO sensor_live "
                 "(device_id, ph_value, turbidity, co2_level, ammonia, "
                 "water_quality_status, rain_level, rain_detected, rain_status, "
                 "status, rssi, updated_at) VALUES ('" +
                 deviceId + "', " +
                 String(phValue, 2) + ", " +
                 String(turbidity, 1) + ", " +
                 String(co2Level, 0) + ", " +
                 String(ammonia, 3) + ", '" +
                 waterQualityStatus + "', " +
                 String(rainLevel, 1) + ", " +
                 String(rainDetected ? "true" : "false") + ", '" +
                 rainStatus + "', 'normal', " +
                 String(WiFi.RSSI()) + ", NOW()) "
                 "ON CONFLICT (device_id) DO UPDATE SET "
                 "ph_value = EXCLUDED.ph_value, turbidity = EXCLUDED.turbidity, "
                 "co2_level = EXCLUDED.co2_level, ammonia = EXCLUDED.ammonia, "
                 "water_quality_status = EXCLUDED.water_quality_status, "
                 "rain_level = EXCLUDED.rain_level, rain_detected = EXCLUDED.rain_detected, "
                 "rain_status = EXCLUDED.rain_status, "
                 "status = EXCLUDED.status, rssi = EXCLUDED.rssi, updated_at = NOW()";

    bool ok = executeSupabaseQuery(sql);

    if (ENABLE_SERIAL && ok)
    {
        Serial.print("sensor_live upserted: pH=");
        Serial.print(phValue, 2);
        Serial.print(" Turb=");
        Serial.print(turbidity, 1);
        Serial.print(" CO2=");
        Serial.print(co2Level, 0);
        Serial.print(" NH3=");
        Serial.print(ammonia, 3);
        Serial.print(" Rain=");
        Serial.print(rainLevel, 1);
        Serial.print("% (");
        Serial.print(rainStatus);
        Serial.println(")");
    }
}

/**
 * INSERT one reading per minute into sensor_history table.
 * Provides historical data for charts.
 */
void insertSensorHistory()
{
    String sql = "INSERT INTO sensor_history "
                 "(device_id, ph_value, turbidity, co2_level, ammonia, "
                 "water_quality_status, rain_level, rain_detected, rain_status, "
                 "status, recorded_at) VALUES ('" +
                 deviceId + "', " +
                 String(phValue, 2) + ", " +
                 String(turbidity, 1) + ", " +
                 String(co2Level, 0) + ", " +
                 String(ammonia, 3) + ", '" +
                 waterQualityStatus + "', " +
                 String(rainLevel, 1) + ", " +
                 String(rainDetected ? "true" : "false") + ", '" +
                 rainStatus + "', 'normal', NOW())";

    bool ok = executeSupabaseQuery(sql);

    if (ENABLE_SERIAL && ok)
    {
        Serial.println("sensor_history inserted (1/min)");
    }
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

    // CALIBRATED formula: shifted by -2.3 based on real measurement
    float ph = 7.0 + ((PH_NEUTRAL_VOLTAGE - voltage) / PH_STEP) - 2.3;

    if (ph < 0) ph = 0;
    if (ph > 14) ph = 14;

    // Debug every 10 seconds
    static unsigned long lastDebug = 0;
    if (millis() - lastDebug > 10000)
    {
        lastDebug = millis();
        if (ENABLE_SERIAL)
        {
            Serial.print("pH Debug - Raw ADC: ");
            Serial.print(avgReading, 0);
            Serial.print(" | Voltage: ");
            Serial.print(voltage, 3);
            Serial.print("V | pH: ");
            Serial.println(ph, 2);
        }
    }

    if (maxRaw >= 4090 || maxRaw <= 5)
    {
        if (ENABLE_SERIAL)
            Serial.println("WARNING: pH Sensor may be disconnected!");
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

    float ntu = 0;
    if (voltage > 2.5)
    {
        ntu = -1120.4 * voltage * voltage + 5742.3 * voltage - 4352.9;
    }
    else
    {
        ntu = 3000.0;
    }

    if (ntu < 0) ntu = 0;
    if (ntu > TURBIDITY_MAX_NTU) ntu = TURBIDITY_MAX_NTU;

    if (maxRaw >= 4090 || maxRaw <= 5)
    {
        if (ENABLE_SERIAL)
            Serial.println("WARNING: Turbidity Sensor may be disconnected!");
    }

    return ntu;
}

float readCO2(int pin, int samples = 50)
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

    float ppm = 400.0;
    if (voltage > 0.4)
    {
        ppm = 116.6020682 * exp((voltage - 2.462) / -0.263);
    }

    ppm += 300.0;
    if (ppm < 400) ppm = 400;
    if (ppm > 5000) ppm = 5000;

    if (maxRaw >= 4090 || maxRaw <= 5)
    {
        if (ENABLE_SERIAL)
            Serial.println("WARNING: MQ135 Sensor may be disconnected!");
    }

    return ppm;
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

    float ppm = 0.0;

    if (voltage < 1.0)
    {
        ppm = 10.0;
    }
    else if (voltage < 2.0)
    {
        ppm = 5.0 * exp((2.0 - voltage) / 0.4);
    }
    else if (voltage < 2.5)
    {
        ppm = (2.5 - voltage) * 2.0;
    }
    else
    {
        ppm = max(0.0, (2.8 - voltage) * 0.5);
    }

    if (ppm < 0) ppm = 0;
    if (ppm > 10.0) ppm = 10.0;

    // Debug every 5 seconds
    static unsigned long lastAmmoniaDebug = 0;
    if (millis() - lastAmmoniaDebug > 5000)
    {
        lastAmmoniaDebug = millis();
        if (ENABLE_SERIAL)
        {
            Serial.print("NH3 Debug - Raw: ");
            Serial.print(avgReading, 0);
            Serial.print(" | Voltage: ");
            Serial.print(voltage, 3);
            Serial.print("V | NH3: ");
            Serial.print(ppm, 2);
            Serial.println(" PPM");
        }
    }

    return ppm;
}

// ===============================================================
//              RAIN SENSOR READ FUNCTION
// ===============================================================
float readRainLevel(int pin, int samples = 20)
{
    unsigned long sum = 0;

    for (int i = 0; i < samples; i++)
    {
        int reading = analogRead(pin);
        sum += reading;
        delay(5);
    }

    float avgReading = sum / (float)samples;
    float rainPercent = ((ADC_MAX - avgReading) / ADC_MAX) * 100.0;

    if (rainPercent < 0) rainPercent = 0;
    if (rainPercent > 100) rainPercent = 100;

    // Debug every 10 seconds
    static unsigned long lastRainDebug = 0;
    if (millis() - lastRainDebug > 10000)
    {
        lastRainDebug = millis();
        if (ENABLE_SERIAL)
        {
            Serial.print("Rain Debug - Raw ADC: ");
            Serial.print(avgReading, 0);
            Serial.print(" | Rain Level: ");
            Serial.print(rainPercent, 1);
            Serial.println("%");
        }
    }

    return rainPercent;
}

String evaluateRainStatus(float level, bool detected)
{
    if (!detected && level < 5.0) return "dry";
    else if (level < 25.0) return "light";
    else if (level < 60.0) return "moderate";
    else return "heavy";
}

String evaluateWaterQuality(float ph, float turb, float co2, float nh3)
{
    if (ph < 6.5 || ph > 9.0 || turb > 40 || co2 > 2000 || nh3 > 1.0)
        return "critical";
    else if (ph < 7.0 || ph > 8.5 || turb > 25 || co2 > 1000 || nh3 > 0.5)
        return "warning";
    else
        return "normal";
}

// ===============================================================
//                       SETUP
// ===============================================================
void setup()
{
    // *** Disable brownout detector to prevent crash loop ***
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

    delay(1000); // Let power stabilize before WiFi/HTTPS

    Serial.begin(115200);

    if (ENABLE_SERIAL)
    {
        Serial.println("\n\n=====================================");
        Serial.println("Water Quality Monitor - Supabase Mode");
        Serial.println("=====================================");
    }

    // Configure ADC
    analogSetAttenuation(ADC_11db);
    analogReadResolution(12);

    // Configure pins
    pinMode(PH_PIN, INPUT);
    pinMode(MQ135_PIN, INPUT);
    pinMode(TURBIDITY_PIN, INPUT);
    pinMode(RAIN_ANALOG_PIN, INPUT);
    pinMode(RAIN_DIGITAL_PIN, INPUT_PULLUP);

    // Generate device ID with WQ_ prefix
    uint8_t mac[6];
    WiFi.macAddress(mac);
    deviceId = "WQ_" + String(mac[3], HEX) + String(mac[4], HEX) + String(mac[5], HEX);
    deviceId.toUpperCase();

    if (ENABLE_SERIAL)
    {
        Serial.print("Device ID: ");
        Serial.println(deviceId);
        Serial.println("Mode: Supabase Direct HTTPS (no MQTT)");
        Serial.print("Supabase: ");
        Serial.println(supabase_url);
    }

    setupWiFi();

    if (ENABLE_SERIAL)
    {
        Serial.println("\n========================================");
        Serial.println("Setup complete! Supabase Mode Active");
        Serial.println("  Writing directly to sensor_live table");
        Serial.println("  History stored every 60 seconds");
        Serial.println("========================================");
    }
}

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
            if (ENABLE_SERIAL)
                Serial.println("\nWiFi disconnected, reconnecting...");
            setupWiFi();
        }
    }

    // -- Read all sensors (fast sampling for real-time) --
    phValue = readPH(PH_PIN, 30);
    turbidity = readTurbidity(TURBIDITY_PIN, 30);
    co2Level = readCO2(MQ135_PIN, 30);
    ammonia = readAmmonia(MQ135_PIN, 30);
    rainLevel = readRainLevel(RAIN_ANALOG_PIN, 20);
    rainDetected = (digitalRead(RAIN_DIGITAL_PIN) == LOW);
    rainStatus = evaluateRainStatus(rainLevel, rainDetected);
    waterQualityStatus = evaluateWaterQuality(phValue, turbidity, co2Level, ammonia);

    // -- Serial logging --
    if (ENABLE_SERIAL)
    {
        static unsigned long lastSerialPrint = 0;
        if (now - lastSerialPrint >= 2000)
        {
            lastSerialPrint = now;

            Serial.print("WiFi: ");
            Serial.print(WiFi.status() == WL_CONNECTED ? "OK" : "FAIL");
            Serial.print(" | IP: ");
            Serial.print(WiFi.localIP());
            Serial.print(" | Signal: ");
            Serial.print(WiFi.RSSI());
            Serial.println(" dBm");

            Serial.print("Pond: ");
            Serial.print(assignedPondId);
            Serial.print(" | pH: ");
            Serial.print(phValue, 2);
            Serial.print(" | Turbidity: ");
            Serial.print(turbidity, 1);
            Serial.print(" NTU | CO2: ");
            Serial.print(co2Level, 0);
            Serial.print(" PPM | NH3: ");
            Serial.print(ammonia, 2);
            Serial.print(" PPM | Rain: ");
            Serial.print(rainLevel, 1);
            Serial.print("% (");
            Serial.print(rainStatus);
            Serial.print(") | Status: ");
            Serial.println(waterQualityStatus);
            Serial.println();
        }
    }

    // -- UPSERT sensor_live every 2 seconds (real-time dashboard data) --
    if (now - lastSensorLiveUpdate >= SENSOR_LIVE_INTERVAL)
    {
        lastSensorLiveUpdate = now;
        upsertSensorLive();
    }

    // -- INSERT sensor_history every 60 seconds (chart/trend data) --
    if (now - lastSensorHistoryInsert >= SENSOR_HISTORY_INTERVAL)
    {
        lastSensorHistoryInsert = now;
        insertSensorHistory();
    }

    delay(50);
}
