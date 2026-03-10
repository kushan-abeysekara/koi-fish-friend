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
#include <EEPROM.h>

// ===================== WiFi CONFIG =====================
const char *ssid = "KoiFishFriend";
const char *password = "FiberTarget255";

// Static IP disabled — using DHCP like the feed device (which works reliably)
// If you need a fixed IP, set a DHCP reservation on the router instead.
// IPAddress local_IP(192, 168, 8, 102);
// IPAddress gateway(192, 168, 8, 1);
// IPAddress subnet(255, 255, 255, 0);
// IPAddress primaryDNS(192, 168, 8, 1);
// IPAddress secondaryDNS(8, 8, 8, 8);

// ===================== SUPABASE CONFIG =====================
// Same connection approach as the working feed device (Kushanesp32feedcode)
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
const float PH_NEUTRAL_VOLTAGE = 2.8;
const float PH_STEP = 0.18;

// Turbidity calibration
const float TURBIDITY_CLEAR_WATER_VOLTAGE = 4.2;
const float TURBIDITY_MAX_NTU = 3000.0;

// ===================== MQ135 GAS CALIBRATION =====================
#define MQ135_RL 10.0      // Load resistor in kΩ (module standard)
#define MQ135_R0 29.3      // Your calibrated R0 value
#define MQ135_CLEAN_AIR_RATIO 3.6  // Rs/R0 in clean air (baseline)
#define EEPROM_SIZE 64
#define EEPROM_R0_ADDR 0   // EEPROM address to store R0
#define EEPROM_R0_MAGIC_ADDR 4 // Magic byte to verify valid R0
#define EEPROM_R0_MAGIC 0xA5

float mq135_R0 = MQ135_R0; // Active R0 value (loaded from EEPROM or default)

// ===================== SENSOR VARIABLES =====================
float phValue = 7.0;
float turbidity = 0.0;
float co2Level = 0.0;
float ammonia = 0.0;
float rainLevel = 0.0;
bool rainDetected = false;
String rainStatus = "dry";
String waterQualityStatus = "normal";

// ===================== AIR QUALITY INDEX & GAS STATUS =====================
float co2PPM = 400.0;
float ammoniaPPM = 0.0;
int airQualityIndex = 0;       // 0–500 scale (0=good, 500=hazardous)
String gasStatus = "normal";   // normal / warning / critical

// ===================== GAS SMOOTHING (EMA filter) =====================
const float SMOOTH_ALPHA = 0.15;  // Smoothing factor (0.0–1.0, lower = smoother)
float smoothedCO2 = 400.0;
float smoothedNH3 = 0.0;
bool smoothingInitialized = false;

// ===================== TOXIC GAS ALERT =====================
bool toxicAlertSent = false;
unsigned long lastToxicAlertTime = 0;
const unsigned long TOXIC_ALERT_COOLDOWN = 300000; // 5 min cooldown between alerts

// ===================== MQ135 WARMUP =====================
unsigned long bootTime = 0;
const unsigned long MQ135_WARMUP_MS = 300000;  // 5 min warmup (ideal: 10 min)
bool mq135WarmedUp = false;

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

    // Using DHCP (no static IP) — matches the working feed device config
    // Static IP + WiFi.config() on ESP32 core 3.x breaks DNS/SSL

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
/**
 * Execute a SQL query on Supabase via the pg/query endpoint.
 * Uses service_role key for full write access.
 * Same pattern as the working feed device (Kushanesp32feedcode).
 * Returns true on success.
 */
bool executeSupabaseQuery(String sql)
{
    if (WiFi.status() != WL_CONNECTED)
        return false;

    WiFiClientSecure secureClient;
    secureClient.setInsecure();  // Skip certificate validation for self-hosted Supabase

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
                 "air_quality_index, gas_status, "
                 "status, rssi, updated_at) VALUES ('" +
                 deviceId + "', " +
                 String(phValue, 2) + ", " +
                 String(turbidity, 1) + ", " +
                 String(co2Level, 0) + ", " +
                 String(ammonia, 3) + ", '" +
                 waterQualityStatus + "', " +
                 String(rainLevel, 1) + ", " +
                 String(rainDetected ? "true" : "false") + ", '" +
                 rainStatus + "', " +
                 String(airQualityIndex) + ", '" +
                 gasStatus + "', 'normal', " +
                 String(WiFi.RSSI()) + ", NOW()) "
                 "ON CONFLICT (device_id) DO UPDATE SET "
                 "ph_value = EXCLUDED.ph_value, turbidity = EXCLUDED.turbidity, "
                 "co2_level = EXCLUDED.co2_level, ammonia = EXCLUDED.ammonia, "
                 "water_quality_status = EXCLUDED.water_quality_status, "
                 "rain_level = EXCLUDED.rain_level, rain_detected = EXCLUDED.rain_detected, "
                 "rain_status = EXCLUDED.rain_status, "
                 "air_quality_index = EXCLUDED.air_quality_index, gas_status = EXCLUDED.gas_status, "
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
                 "air_quality_index, gas_status, "
                 "status, recorded_at) VALUES ('" +
                 deviceId + "', " +
                 String(phValue, 2) + ", " +
                 String(turbidity, 1) + ", " +
                 String(co2Level, 0) + ", " +
                 String(ammonia, 3) + ", '" +
                 waterQualityStatus + "', " +
                 String(rainLevel, 1) + ", " +
                 String(rainDetected ? "true" : "false") + ", '" +
                 rainStatus + "', " +
                 String(airQualityIndex) + ", '" +
                 gasStatus + "', 'normal', NOW())";

    bool ok = executeSupabaseQuery(sql);

    if (ENABLE_SERIAL && ok)
    {
        Serial.println("sensor_history inserted (1/min)");
    }
}

// ===============================================================
//                  MQ135 GAS HELPER FUNCTIONS
// ===============================================================

float mq135ReadVoltage(int pin)
{
    int adc = analogRead(pin);
    if (adc < 1) adc = 1;  // prevent divide-by-zero
    return adc * (V_REF / ADC_MAX);
}

float mq135ReadRs(int pin)
{
    float v = mq135ReadVoltage(pin);
    if (v < 0.01) v = 0.01;           // sensor shorted or disconnected (low)
    if (v > (V_REF - 0.01)) v = V_REF - 0.01; // sensor open or disconnected (high)
    return ((V_REF - v) / v) * MQ135_RL;
}

float mq135ReadRatio(int pin, int samples)
{
    float rs = 0;
    for (int i = 0; i < samples; i++)
    {
        rs += mq135ReadRs(pin);
        delay(5);
    }
    rs /= samples;
    if (mq135_R0 < 1.0) return MQ135_CLEAN_AIR_RATIO; // R0 invalid → assume clean air
    float ratio = rs / mq135_R0;
    if (isnan(ratio) || isinf(ratio)) return MQ135_CLEAN_AIR_RATIO;
    return ratio;
}

// ===============================================================
//                EEPROM R0 AUTO-SAVE
// ===============================================================

void loadR0FromEEPROM()
{
    uint8_t magic = EEPROM.read(EEPROM_R0_MAGIC_ADDR);
    if (magic == EEPROM_R0_MAGIC)
    {
        float storedR0;
        EEPROM.get(EEPROM_R0_ADDR, storedR0);
        if (storedR0 > 1.0 && storedR0 < 500.0) // sanity check
        {
            mq135_R0 = storedR0;
            if (ENABLE_SERIAL)
            {
                Serial.print("[EEPROM] Loaded R0 = ");
                Serial.println(mq135_R0, 2);
            }
            return;
        }
    }
    // No valid R0 stored (or stored value was corrupt/zero), use default
    mq135_R0 = MQ135_R0;
    if (ENABLE_SERIAL)
    {
        Serial.print("[EEPROM] No valid R0 saved, using default = ");
        Serial.println(mq135_R0, 2);
    }
}

void saveR0ToEEPROM(float r0)
{
    if (r0 < 1.0 || r0 > 500.0) return; // sanity check
    EEPROM.put(EEPROM_R0_ADDR, r0);
    EEPROM.write(EEPROM_R0_MAGIC_ADDR, EEPROM_R0_MAGIC);
    EEPROM.commit();
    if (ENABLE_SERIAL)
    {
        Serial.print("[EEPROM] Saved R0 = ");
        Serial.println(r0, 2);
    }
}

// Recalibrate R0 in clean air (call after 24h burn-in in fresh air)
void calibrateMQ135R0(int pin, int samples = 50)
{
    float rs = 0;
    for (int i = 0; i < samples; i++)
    {
        rs += mq135ReadRs(pin);
        delay(50);
    }
    rs /= samples;
    // In clean air, Rs/R0 ratio ≈ 3.6 for MQ135
    float newR0 = rs / 3.6;
    if (newR0 < 1.0 || newR0 > 500.0 || isnan(newR0))
    {
        if (ENABLE_SERIAL)
        {
            Serial.print("[Calibration] FAILED — got R0 = ");
            Serial.print(newR0, 2);
            Serial.println(" (invalid). Keeping previous R0.");
            Serial.println("  → Check MQ135 wiring: VCC=5V, AOUT→GPIO33, GND→GND");
        }
        // Keep previous R0 (from EEPROM or default)
        if (mq135_R0 < 1.0) mq135_R0 = MQ135_R0; // fallback to compile-time default
        return;
    }
    mq135_R0 = newR0;
    saveR0ToEEPROM(newR0);
    if (ENABLE_SERIAL)
    {
        Serial.print("[Calibration] New R0 = ");
        Serial.println(newR0, 2);
    }
}

// ===============================================================
//              GAS SMOOTHING FILTER (EMA)
// ===============================================================

float applySmoothing(float current, float previous, float alpha)
{
    return alpha * current + (1.0 - alpha) * previous;
}

// ===============================================================
//           TOXIC GAS ALERT → SUPABASE
// ===============================================================

void checkAndSendToxicAlert(float co2, float nh3)
{
    bool isToxic = (co2 > 2000 || nh3 > 1.0);
    unsigned long now = millis();

    if (isToxic && (!toxicAlertSent || (now - lastToxicAlertTime > TOXIC_ALERT_COOLDOWN)))
    {
        String alertType = "";
        if (co2 > 2000 && nh3 > 1.0)
            alertType = "HIGH_CO2_AND_NH3";
        else if (co2 > 2000)
            alertType = "HIGH_CO2";
        else
            alertType = "HIGH_NH3";

        String sql = "INSERT INTO notifications "
                     "(device_id, notification_type, title, message, severity, pond_id, created_at) VALUES ('"
                     + deviceId + "', '" + alertType + "', "
                     "'Toxic Gas Alert', "
                     "'" + alertType + ": CO2=" + String(co2, 0) + " ppm, NH3=" + String(nh3, 2) + " ppm. "
                     "Check pond " + String(assignedPondId) + " immediately!', "
                     "'critical', " + String(assignedPondId) + ", NOW())";

        bool ok = executeSupabaseQuery(sql);
        if (ok)
        {
            toxicAlertSent = true;
            lastToxicAlertTime = now;
            if (ENABLE_SERIAL)
            {
                Serial.println("[ALERT] Toxic gas notification sent to Supabase!");
                Serial.print("  Type: "); Serial.println(alertType);
                Serial.print("  CO2: "); Serial.print(co2, 0); Serial.println(" PPM");
                Serial.print("  NH3: "); Serial.print(nh3, 2); Serial.println(" PPM");
            }
        }
    }
    else if (!isToxic)
    {
        toxicAlertSent = false; // Reset when levels return to normal
    }
}

// ===============================================================
//         AIR QUALITY INDEX (AQI) CALCULATION
// ===============================================================

// Map a gas PPM value to a 0–500 sub-index using breakpoints
int gasSubIndex(float ppm, float good, float moderate, float unhealthy, float hazardous)
{
    if (ppm <= good)       return (int)map(ppm * 100, 0, good * 100, 0, 50);
    if (ppm <= moderate)   return (int)map(ppm * 100, good * 100, moderate * 100, 51, 100);
    if (ppm <= unhealthy)  return (int)map(ppm * 100, moderate * 100, unhealthy * 100, 101, 200);
    if (ppm <= hazardous)  return (int)map(ppm * 100, unhealthy * 100, hazardous * 100, 201, 300);
    return (int)constrain(map(ppm * 100, hazardous * 100, hazardous * 200, 301, 500), 301, 500);
}

int calculateAirQualityIndex(float co2, float nh3)
{
    // CO2 breakpoints (ppm): good<600, moderate<1000, unhealthy<2000, hazardous<5000
    int co2Index = gasSubIndex(co2, 600.0, 1000.0, 2000.0, 5000.0);

    // NH3 breakpoints (ppm): good<0.25, moderate<0.5, unhealthy<1.0, hazardous<5.0
    int nh3Index = gasSubIndex(nh3, 0.25, 0.5, 1.0, 5.0);

    // AQI = worst of all sub-indices
    int aqi = max(co2Index, nh3Index);
    return constrain(aqi, 0, 500);
}

String evaluateGasStatus(int aqi)
{
    if (aqi <= 100)  return "normal";
    if (aqi <= 200)  return "warning";
    return "critical";
}

// ===============================================================
//                  SENSOR READ FUNCTIONS
// ===============================================================
float readPH(int pin, int samples = 20)
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
        delay(2);
    }

    float avgReading = sum / (float)samples;

    // Allow probe voltage to settle after sampling
    delay(800);

    float voltage = (avgReading / ADC_MAX) * V_REF;

    // Only treat as disconnected if readings are REALLY stuck (flat signal at extremes)
    bool disconnected = (maxRaw - minRaw < 3) && (avgReading > 4090 || avgReading < 5);

    // CALIBRATED formula: shifted by -2.3 based on real measurement
    float ph = 7.0 + ((PH_NEUTRAL_VOLTAGE - voltage) / PH_STEP);

    if (ph < 0) ph = 0;
    if (ph > 14) ph = 14;

    // If sensor disconnected, preserve last valid reading instead of forcing 7.0
    static float lastValidPH = 7.0;

    if (disconnected)
    {
        static unsigned long lastWarn = 0;
        if (millis() - lastWarn > 10000)
        {
            lastWarn = millis();
            if (ENABLE_SERIAL)
                Serial.println("WARNING: pH Sensor disconnected -> using last valid pH");
        }
        return lastValidPH;
    }

    lastValidPH = ph;

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

    return ph;
}

float readTurbidity(int pin, int samples = 20)
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
        delay(2);
    }

    float avgReading = sum / (float)samples;
    float voltage = (avgReading / ADC_MAX) * V_REF;

    // Check if sensor is disconnected
    bool disconnected = (maxRaw >= 4090 || maxRaw <= 5);
    if (disconnected)
    {
        static unsigned long lastWarn = 0;
        if (millis() - lastWarn > 10000)
        {
            lastWarn = millis();
            if (ENABLE_SERIAL)
                Serial.println("WARNING: Turbidity Sensor disconnected -> using default 0.0 NTU");
        }
        return 0.0; // Clear water default
    }

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

    return ntu;
}

float readCO2(int pin, int samples = 20)
{
    float ratio = mq135ReadRatio(pin, samples);

    // CO2 curve from MQ135 datasheet (log scale)
    if (isnan(ratio) || ratio <= 0) return 400.0; // sensor error → safe default

    // If ratio is unreasonably low (<0.1), R0 is miscalibrated — return safe default
    if (ratio < 0.1)
    {
        static unsigned long lastWarn = 0;
        if (millis() - lastWarn > 10000)
        {
            lastWarn = millis();
            if (ENABLE_SERIAL)
                Serial.println("CO2: Ratio too low (bad R0) -> default 400 PPM");
        }
        return 400.0;
    }

    float ppm = 116.6020682 * pow(ratio, -2.769034857);

    if (isnan(ppm) || ppm < 400) ppm = 400;      // atmospheric minimum
    if (ppm > 5000) ppm = 5000;

    // Debug
    static unsigned long lastDebug = 0;
    if (millis() - lastDebug > 5000)
    {
        lastDebug = millis();
        if (ENABLE_SERIAL)
        {
            Serial.print("CO2 Debug | Ratio: ");
            Serial.print(ratio, 3);
            Serial.print(" | CO2: ");
            Serial.print(ppm, 0);
            Serial.println(" PPM");
        }
    }

    return ppm;
}

float readAmmonia(int pin, int samples = 20)
{
    float ratio = mq135ReadRatio(pin, samples);

    // If ratio is unreasonably low (<0.1), R0 is miscalibrated — return safe default
    if (ratio < 0.1)
    {
        static unsigned long lastWarn = 0;
        if (millis() - lastWarn > 10000)
        {
            lastWarn = millis();
            if (ENABLE_SERIAL)
                Serial.println("NH3: Ratio too low (bad R0) -> default 0.00 PPM");
        }
        return 0.0;
    }

    // In clean air Rs/R0 ≈ 3.6. NH3 gas causes ratio to DROP.
    // If ratio is at or above clean-air baseline → no NH3 present.
    if (ratio >= MQ135_CLEAN_AIR_RATIO)
    {
        // Debug
        static unsigned long lastCleanDebug = 0;
        if (millis() - lastCleanDebug > 5000)
        {
            lastCleanDebug = millis();
            if (ENABLE_SERIAL)
            {
                Serial.print("NH3 Debug | Ratio: ");
                Serial.print(ratio, 3);
                Serial.println(" | Clean air → 0.00 PPM");
            }
        }
        return 0.0;
    }

    // NH3 curve from MQ135 datasheet, with clean-air baseline subtracted
    if (isnan(ratio) || ratio <= 0) return 0.0; // sensor error → safe default
    float ppm = 102.2 * pow(ratio, -2.473);
    float baseline = 102.2 * pow(MQ135_CLEAN_AIR_RATIO, -2.473);
    ppm = ppm - baseline;

    if (isnan(ppm) || ppm < 0.05) ppm = 0;   // Dead zone to suppress noise
    if (ppm > 100) ppm = 100;

    // Debug
    static unsigned long lastDebug = 0;
    if (millis() - lastDebug > 5000)
    {
        lastDebug = millis();
        if (ENABLE_SERIAL)
        {
            Serial.print("NH3 Debug | Ratio: ");
            Serial.print(ratio, 3);
            Serial.print(" | NH3: ");
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

    // Initialize EEPROM and load saved R0
    EEPROM.begin(EEPROM_SIZE);
    loadR0FromEEPROM();

    // Configure ADC
    analogSetAttenuation(ADC_11db);
    analogReadResolution(12);

    // Configure pins
    pinMode(PH_PIN, INPUT);
    pinMode(MQ135_PIN, INPUT);
    pinMode(TURBIDITY_PIN, INPUT);
    pinMode(RAIN_ANALOG_PIN, INPUT);
    pinMode(RAIN_DIGITAL_PIN, INPUT_PULLUP);

    bootTime = millis();

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
        Serial.print("\n[Network] WiFi IP: ");
        Serial.println(WiFi.localIP());
        Serial.print("[Network] DNS: ");
        Serial.println(WiFi.dnsIP());
    }

    // Test connection with a simple query (same as feed device)
    if (ENABLE_SERIAL)
    {
        Serial.println("[Setup] Testing Supabase connection...");
    }
    bool testOk = executeSupabaseQuery("SELECT 1");
    if (ENABLE_SERIAL)
    {
        Serial.print("[Setup] Supabase test: ");
        Serial.println(testOk ? "OK" : "FAILED");
    }

    // *** AUTO-CALIBRATE R0 IN CLEAN AIR ***
    // Only calibrate if NO valid R0 is saved in EEPROM yet.
    // MQ135 needs 5+ minutes warmup for accurate R0; 10s is NOT enough.
    // After first calibration, R0 is saved to EEPROM and reused on every boot.
    {
        uint8_t magic = EEPROM.read(EEPROM_R0_MAGIC_ADDR);
        float storedR0;
        EEPROM.get(EEPROM_R0_ADDR, storedR0);
        bool hasValidR0 = (magic == EEPROM_R0_MAGIC && storedR0 > 1.0 && storedR0 < 500.0);

        if (!hasValidR0)
        {
            // First boot ever — wait 10s and calibrate (place in clean air!)
            if (ENABLE_SERIAL)
                Serial.println("[Calibration] No saved R0 — waiting 10s for MQ135 heater...");
            delay(10000);
            calibrateMQ135R0(MQ135_PIN, 100);
        }
        else
        {
            if (ENABLE_SERIAL)
            {
                Serial.print("[Calibration] Using saved R0 from EEPROM: ");
                Serial.println(mq135_R0, 2);
                Serial.println("[Calibration] Skipping re-calibration (delete EEPROM to force recalibrate)");
            }
        }
    }
    if (ENABLE_SERIAL)
    {
        Serial.print("[Calibration] R0 after calibration: ");
        Serial.println(mq135_R0, 2);
    }

    if (ENABLE_SERIAL)
    {
        Serial.println("\n========================================");
        Serial.println("Setup complete! Supabase Mode Active");
        Serial.println("  Writing directly to sensor_live table");
        Serial.println("  History stored every 60 seconds");
        Serial.print("  MQ135 R0: ");
        Serial.println(mq135_R0, 2);
        Serial.println("  MQ135 warmup: 5 min (readings may drift until warmed up)");
        Serial.print("  Free heap: ");
        Serial.print(ESP.getFreeHeap());
        Serial.println(" bytes");
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

    // -- Check MQ135 warmup status --
    if (!mq135WarmedUp && (now - bootTime >= MQ135_WARMUP_MS))
    {
        mq135WarmedUp = true;
        if (ENABLE_SERIAL)
            Serial.println("[MQ135] Warmup complete - readings are now stable");
    }

    // -- Read all sensors (fast sampling for real-time) --
    phValue = readPH(PH_PIN, 30);
    turbidity = readTurbidity(TURBIDITY_PIN, 30);

    // Debug: print raw MQ135 ratio so you can verify calibration
    {
        static unsigned long lastRatioDebug = 0;
        if (now - lastRatioDebug >= 5000)
        {
            lastRatioDebug = now;
            float debugRatio = mq135ReadRatio(MQ135_PIN, 10);
            if (ENABLE_SERIAL)
            {
                Serial.print("[MQ135] R0=");
                Serial.print(mq135_R0, 2);
                Serial.print(" | Ratio=");
                Serial.print(debugRatio, 3);
                Serial.print(" | Expected clean-air: ~3.6");
                if (debugRatio < 0.5)
                    Serial.println(" ⚠️ RATIO TOO LOW — R0 needs recalibration!");
                else if (debugRatio > 5.0)
                    Serial.println(" ⚠️ RATIO TOO HIGH — check wiring");
                else
                    Serial.println(" ✅");
            }
        }
    }

    // Read CO2 and NH3 from MQ135 (Rs/R0 ratio method)
    float rawCO2 = readCO2(MQ135_PIN, 30);
    float rawNH3 = readAmmonia(MQ135_PIN, 30);

    // Apply EMA smoothing filter for stable graphs
    if (!smoothingInitialized)
    {
        smoothedCO2 = rawCO2;
        smoothedNH3 = rawNH3;
        smoothingInitialized = true;
    }
    else
    {
        smoothedCO2 = applySmoothing(rawCO2, smoothedCO2, SMOOTH_ALPHA);
        smoothedNH3 = applySmoothing(rawNH3, smoothedNH3, SMOOTH_ALPHA);
    }

    co2Level = smoothedCO2;
    ammonia = smoothedNH3;

    // Final NaN safety net — never send nan to Supabase
    if (isnan(co2Level))  co2Level  = 400.0;
    if (isnan(ammonia))   ammonia   = 0.0;
    if (isnan(phValue))   phValue   = 7.0;
    if (isnan(turbidity)) turbidity = 0.0;
    if (isnan(rainLevel)) rainLevel = 0.0;

    co2PPM = co2Level;
    ammoniaPPM = ammonia;

    // Calculate Air Quality Index from gas readings
    airQualityIndex = calculateAirQualityIndex(co2PPM, ammoniaPPM);
    gasStatus = evaluateGasStatus(airQualityIndex);

    rainLevel = readRainLevel(RAIN_ANALOG_PIN, 20);
    rainDetected = (digitalRead(RAIN_DIGITAL_PIN) == LOW);
    rainStatus = evaluateRainStatus(rainLevel, rainDetected);
    waterQualityStatus = evaluateWaterQuality(phValue, turbidity, co2Level, ammonia);

    // -- Check for toxic gas levels and send alert --
    if (mq135WarmedUp)
    {
        checkAndSendToxicAlert(co2Level, ammonia);
    }

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
            Serial.print(" PPM | AQI: ");
            Serial.print(airQualityIndex);
            Serial.print(" (");
            Serial.print(gasStatus);
            Serial.print(") | Rain: ");
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
