/*
  ESP32 Feed Device Control System with MQTT
  - ESC control for feed distribution with smooth ramping
  - A4988 Stepper Motor (NEMA 17) for feed output control
  - OLED Display (SSD1306) for real-time monitoring
  - WiFi and MQTT for remote control
  - Motor sleep mode when idle
  Compatible with ESP32 Arduino Core 3.x
  
  Required Libraries:
  - Adafruit GFX Library
  - Adafruit SSD1306
  - HX711 Arduino Library
  - PubSubClient
  - ArduinoJson
*/

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <HX711.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>

// WiFi Credentials
const char* ssid = "Dulshan Dialog 4G 643";
const char* password = "Chuki000";

// MQTT Configuration - Self-hosted EMQX on VPS
const char* mqtt_server = "187.77.189.5";
const int mqtt_port = 1883;
const char* device_id = "feed_device_001";

// MQTT Topics
String commandTopic = "koi/devices/" + String(device_id) + "/feeding/command";
String statusTopic = "koi/devices/" + String(device_id) + "/feeding/status";
String scheduleTopic = "koi/devices/" + String(device_id) + "/feeding/schedule";

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// OLED Display Configuration
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// I2C Pins
#define I2C_SDA 21
#define I2C_SCL 22

// HX711 Load Cell Pins
#define HX711_DT 39   // Data pin (input-only GPIO) - Feed Output (1kg)
#define HX711_SCK 16  // Clock pin (safe GPIO)

#define HX711_TANK_A_DT 34   // Tank Sensor A - FOUR 5kg load cells (20kg total)
#define HX711_TANK_A_SCK 17

/*
 * IMPORTANT WIRING FOR FOUR LOAD CELLS ON ONE HX711:
 * ==================================================
 * Each load cell has 4 wires (typical colors):
 *   E+ (Excitation+) = RED
 *   E- (Excitation-) = BLACK
 *   S+ (Signal+)     = WHITE
 *   S- (Signal-)     = GREEN
 * 
 * CORRECT PARALLEL WIRING TO HX711:
 * ---------------------------------
 * ALL Cell 1-4 RED wires    → HX711 E+
 * ALL Cell 1-4 BLACK wires  → HX711 E-
 * ALL Cell 1-4 WHITE wires  → HX711 A+ (or S+)
 * ALL Cell 1-4 GREEN wires  → HX711 A- (or S-)
 * 
 * ALL 4 WIRES OF SAME COLOR FROM ALL 4 CELLS MUST BE CONNECTED TOGETHER!
 * This creates a parallel connection where the HX711 reads the combined weight.
 * 
 * WRONG WIRING:
 * ------------
 * ❌ Connecting only some cells' signal wires
 * ❌ Mixing up signal wires between cells
 * ❌ Not connecting all E+ together and all E- together
 * 
 * TROUBLESHOOTING:
 * ---------------
 * 1. Test each cell individually first
 * 2. Connect all 4 cells in parallel using above wiring
 * 3. Check Serial Monitor for raw values (should be large numbers)
 * 4. All cells should contribute to total weight
 */

// HX711 Objects and Calibration
HX711 scale;           // Feed output scale (1kg)
HX711 scaleTankA;      // Tank sensor A - FOUR 5kg load cells (20kg total)

float calibrationFactor = -2520.0;        // Feed output calibration
float calibrationFactorTankA = -115.0;  // Tank A calibration (FOUR 5kg cells = 20kg)

float currentWeight = 0.0;        // Feed output weight
float tankWeightA = 0.0;          // Tank A weight (FOUR 5kg cells = 20kg total)
float totalTankWeight = 0.0;      // Total tank weight (same as tankWeightA)
const float maxTankCapacity = 20000.0;  // 20kg = 4x5kg load cells on one HX711
float targetWeight = 0.0;           // Target weight in grams
bool weightBasedFeeding = false;    // Enable weight-based feeding mode
unsigned long lastWeightCheck = 0;
const unsigned long weightCheckInterval = 500; // Check weight every 500ms

// ESC Motor Pins (Feed Distribution)
const int escPin = 25;   // ESC signal

// ESC parameters
const int pwmFreq = 50;       // 50Hz (servo/ESC)
const int pwmResolution = 16; // 16-bit
const int minUs = 1000;       // Min throttle
const int maxUs = 1750;       // Max throttle

// Variable Resistor for ESC Speed Control
const int variableResistorPin = 36;  // GPIO 36 (ADC1_0)
int escSpeedFromPot = 0;             // 0-100% from potentiometer

// Stepper Motor Pins (Feed Output Control - NEMA 17)
const int stepPin = 26;       // STEP pin
const int dirPin = 27;        // DIR pin
const int resetSleepPin = 12; // RESET + SLEEP (shorted together)

// Stepper Motor Parameters
const int stepsPerRevolution = 200; // NEMA 17 typical (1.8° per step)

// Feeding State Variables
bool feedingActive = false;
bool stepperActive = false;
int stepperSpeed = 900; // Delay in microseconds
int currentESCPercent = 0;
int targetESCPercent = 25;
const int ESC_MAX_PERCENT = 34;       // ⚠ SAFETY: Never exceed 34% - damage risk!
unsigned long escRampStartTime = 0;
unsigned long escRampDuration = 8000; // 8 seconds

// ESC Feeding Phase State Machine (vibration → ramp → auto-stop)
enum ESCPhase {
  ESC_PHASE_IDLE,
  ESC_PHASE_VIBRATION,   // First 4 seconds: rapid on/off pulses to shake stuck feed
  ESC_PHASE_RAMP         // Next 6 seconds: smooth ramp 25% → 34%
};
ESCPhase escPhase = ESC_PHASE_IDLE;
unsigned long escPhaseStartTime = 0;
const unsigned long ESC_VIBRATION_DURATION = 4000;  // 4 seconds vibration
const unsigned long ESC_RAMP_DURATION = 6000;       // 6 seconds ramp
const int ESC_VIBRATION_POWER = 31;                 // 31% power pulses
const unsigned long ESC_VIBRATION_ON_MS = 120;      // Pulse ON duration (ms)
const unsigned long ESC_VIBRATION_OFF_MS = 80;      // Pulse OFF duration (ms)

// ESC Auto-Stop Variables (for weight-based feeding)
bool escAutoStopEnabled = false;      // Flag to enable ESC auto-stop after weight drops
unsigned long escStopTimer = 0;       // Timer for 3-second delay
bool escStopTimerStarted = false;     // Flag to track if timer has started
const float weightThreshold = 20.0;   // Stop ESC when weight < 20g
const unsigned long escStopDelay = 3000; // 3 seconds delay

// Homing Variables
long currentStepPosition = 0; // Track current position
bool isHoming = false; // Flag for homing mode

// Display update
unsigned long lastDisplayUpdate = 0;
const unsigned long displayUpdateInterval = 200;
int feedCount = 0;

// RPM Tracking
float stepperRPM = 0.0;

// Feed Statistics
float totalGramsFed = 0.0;

// NTP Time Configuration
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800;       // Sri Lanka GMT+5:30 (5.5 hours = 19800 seconds)
const int daylightOffset_sec = 0;       // Daylight saving offset (not used in Sri Lanka)
bool timeInitialized = false;

// Schedule System
struct FeedSchedule {
  String time;        // Format: "HH:MM"
  float amount;       // Grams
  bool enabled;
  String pondId;
  int lastExecutedDay;  // Day of month when last executed
};

FeedSchedule schedules[10];  // Support up to 10 schedules
int scheduleCount = 0;

// Function prototypes for new features
void setupNTP();
void printLocalTime();
String getCurrentTime();
int getCurrentHour();
int getCurrentMinute();
int getCurrentDay();
void checkScheduledFeedings();
void readESCSpeedFromPotentiometer();
void startWeightBasedFeeding(float targetGrams);
void checkWeightAndControl();
void runESCFeedingPhase();

// Convert microseconds to duty (ESC)
uint32_t usToDuty(int us) {
  const int periodUs = 20000; // 50Hz = 20ms
  uint32_t maxDuty = (1 << pwmResolution) - 1;
  return (uint32_t)((uint64_t)us * maxDuty / periodUs);
}

// Set ESC throttle by percentage (0-34% max for safety)
void setESCPercent(int percent) {
  percent = constrain(percent, 0, ESC_MAX_PERCENT);  // ⚠ SAFETY CAP: max 34%
  int pulseUs = map(percent, 0, 100, minUs, maxUs);
  ledcWrite(escPin, usToDuty(pulseUs));
  currentESCPercent = percent;
}

// Enable/Disable Stepper Motor
void setStepperEnabled(bool enabled) {
  digitalWrite(resetSleepPin, enabled ? HIGH : LOW);
  delay(10); // Give driver time to wake up/sleep
}

// Calculate Stepper RPM
float calculateStepperRPM(int delayMicros) {
  if (delayMicros == 0) return 600.0; // Max RPM
  float timePerStepUs = delayMicros + 500.0;
  float stepsPerSecond = 1000000.0 / timePerStepUs;
  float rpm = (stepsPerSecond * 60.0) / stepsPerRevolution;
  return rpm;
}

// Continuous stepper rotation (non-blocking)
void runStepperContinuous() {
  static unsigned long lastStepTime = 0;
  
  if (stepperActive && (micros() - lastStepTime >= stepperSpeed)) {
    digitalWrite(stepPin, HIGH);
    delayMicroseconds(2);
    digitalWrite(stepPin, LOW);
    lastStepTime = micros();
    
    // Track position
    currentStepPosition++;
    if (currentStepPosition >= stepsPerRevolution) {
      currentStepPosition = 0; // Reset after full rotation
    }
    
    // Check if homing is complete
    if (isHoming && currentStepPosition == 187) {
      stepperActive = false;
      isHoming = false;
      setStepperEnabled(false);
      Serial.println("Homing complete - at position 187");
      publishStatus("homing_complete");
    }
  }
}

// Display Functions
void updateDisplay() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  // Title
  display.setCursor(0, 0);
  display.println("== FEED SYSTEM ==");
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
  
  // WiFi/MQTT or Time Status
  display.setCursor(0, 14);
  if (timeInitialized) {
    display.print("Time: ");
    display.println(getCurrentTime());
  } else {
    display.print("WiFi: ");
    display.print(WiFi.status() == WL_CONNECTED ? "OK" : "NO");
    display.print(" MQTT: ");
    display.println(mqttClient.connected() ? "OK" : "NO");
  }
  
  // ESC Motor Status with Time
  display.setCursor(0, 24);
  display.print("ESC: ");
  display.print(currentESCPercent);
  display.print("% || T:");
  display.println(getCurrentTime());
  
  // Stepper Motor Status
  display.setCursor(0, 34);
  display.print("Stepper: ");
  if (stepperActive) {
    display.print(calculateStepperRPM(stepperSpeed), 0);
    display.println(" RPM");
  } else {
    display.println("SLEEP");
  }
  
  // Feeding Status
  display.setCursor(0, 44);
  display.print("Status: ");
  display.println(feedingActive ? "FEEDING" : "READY");
  
  // Weight and Feed Count
  display.setCursor(0, 54);
  if (weightBasedFeeding) {
    display.print("W:");
    display.print(currentWeight, 0);
    display.print("/");
    display.print(targetWeight, 0);
    display.println("g");
  } else {
    display.print("Feeds:");
    display.print(feedCount);
    display.print(" T:");
    display.print(totalGramsFed, 0);
    display.println("g");
  }
  display.print("TNK:");
  display.print(totalTankWeight/1000);
  display.display();
}

// WiFi Setup
void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("");
    Serial.println("WiFi connected");
    Serial.println("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("");
    Serial.println("WiFi connection failed!");
  }
}

// MQTT Callback
void mqtt_callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);
  
  // Parse JSON command
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.print("JSON parse failed: ");
    Serial.println(error.c_str());
    return;
  }
  
  // Handle feeding commands
  if (doc.containsKey("command") && String(doc["command"].as<const char*>()) == "feeding") {
    JsonObject data = doc["data"];
    String action = data["action"].as<String>();
    
    if (action == "start") {
      // Check if weight-based feeding
      if (data.containsKey("targetWeight")) {
        float targetGrams = data["targetWeight"];
        startWeightBasedFeeding(targetGrams);
      } else {
        // Manual feeding with ramping
        Serial.println("Starting manual feeding...");
        feedCount++;
        feedingActive = true;
        
        // Get parameters
        stepperSpeed = data.containsKey("stepperSpeed") ? data["stepperSpeed"].as<int>() : 500;
        int escStart = data.containsKey("escStartPercent") ? data["escStartPercent"].as<int>() : 10;
        targetESCPercent = data.containsKey("escTargetPercent") ? data["escTargetPercent"].as<int>() : ESC_MAX_PERCENT;
        if (targetESCPercent > ESC_MAX_PERCENT) targetESCPercent = ESC_MAX_PERCENT;  // Safety cap
        escRampDuration = data.containsKey("escRampTimeSeconds") ? data["escRampTimeSeconds"].as<int>() * 1000 : 8000;
        
        // Enable stepper motor
        setStepperEnabled(true);
        digitalWrite(dirPin, HIGH); // Set direction
        stepperActive = true;
        isHoming = false; // Not in homing mode
        
        // Start ESC ramp
        setESCPercent(escStart);
        escRampStartTime = millis();
        
        publishStatus("feeding_started");
      }
      
    } else if (action == "stop") {
      Serial.println("Stopping feeding immediately...");
      feedingActive = false;
      stepperActive = false;
      isHoming = false;
      weightBasedFeeding = false;
      escPhase = ESC_PHASE_IDLE;
      escAutoStopEnabled = false;
      escStopTimerStarted = false;
      
      // Stop ESC immediately
      setESCPercent(0);
      
      // Cut off NEMA 17 power immediately - set pin 12 LOW
      digitalWrite(resetSleepPin, LOW);
      Serial.println("Motor sleep mode activated (Pin 12 LOW)");
      
      publishStatus("feeding_stopped");
      
    } else if (action == "status") {
      publishStatus("status_report");
    } else if (action == "tare") {
      scale.tare();
      Serial.println("Load cell tared (zeroed)");
      publishStatus("tared");
    } else if (action == "calibrate") {
      if (data.containsKey("factor")) {
        calibrationFactor = data["factor"];
        scale.set_scale(calibrationFactor);
        Serial.print("Calibration factor set to: ");
        Serial.println(calibrationFactor);
        publishStatus("calibrated");
      }
    }
    // ─── Diagnostic commands for individual motor control ───
    else if (action == "diag_stepper_on") {
      int speed = data.containsKey("stepperSpeed") ? data["stepperSpeed"].as<int>() : 500;
      stepperSpeed = speed;
      setStepperEnabled(true);
      digitalWrite(dirPin, HIGH);
      stepperActive = true;
      isHoming = false;
      Serial.println("[DIAG] Stepper ON, speed=" + String(speed));
      publishStatus("diag_stepper_on");
    }
    else if (action == "diag_stepper_off") {
      stepperActive = false;
      setStepperEnabled(false);
      digitalWrite(resetSleepPin, LOW);
      Serial.println("[DIAG] Stepper OFF");
      publishStatus("diag_stepper_off");
    }
    else if (action == "diag_esc_on") {
      int percent = data.containsKey("escPercent") ? data["escPercent"].as<int>() : 25;
      if (percent > ESC_MAX_PERCENT) percent = ESC_MAX_PERCENT;  // Safety cap at 34%
      setESCPercent(percent);
      Serial.println("[DIAG] ESC ON, percent=" + String(percent) + " (max " + String(ESC_MAX_PERCENT) + "%)");
      publishStatus("diag_esc_on");
    }
    else if (action == "diag_esc_off") {
      setESCPercent(0);
      Serial.println("[DIAG] ESC OFF");
      publishStatus("diag_esc_off");
    }
    else if (action == "diag_all_stop") {
      feedingActive = false;
      stepperActive = false;
      isHoming = false;
      weightBasedFeeding = false;
      escPhase = ESC_PHASE_IDLE;
      escAutoStopEnabled = false;
      escStopTimerStarted = false;
      setESCPercent(0);
      setStepperEnabled(false);
      digitalWrite(resetSleepPin, LOW);
      Serial.println("[DIAG] ALL MOTORS STOPPED");
      publishStatus("diag_all_stop");
    }
    else if (action == "diag_report") {
      // Send a detailed diagnostic report
      publishStatus("diag_report");
    }
  }
  
  // Handle schedule topic
  if (String(topic) == scheduleTopic) {
    JsonArray schedulesArray = doc["schedules"].as<JsonArray>();
    scheduleCount = 0;
    
    for (JsonObject scheduleObj : schedulesArray) {
      if (scheduleCount >= 10) break;  // Max 10 schedules
      
      schedules[scheduleCount].time = scheduleObj["time"].as<String>();
      schedules[scheduleCount].amount = scheduleObj["amount"];
      schedules[scheduleCount].enabled = scheduleObj["enabled"];
      schedules[scheduleCount].pondId = scheduleObj.containsKey("pondId") ? 
                                       scheduleObj["pondId"].as<String>() : "default";
      schedules[scheduleCount].lastExecutedDay = -1;
      
      Serial.print("Schedule ");
      Serial.print(scheduleCount);
      Serial.print(": ");
      Serial.print(schedules[scheduleCount].time);
      Serial.print(" - ");
      Serial.print(schedules[scheduleCount].amount);
      Serial.println("g");
      
      scheduleCount++;
    }
    
    // Display success message on OLED
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("== FEED SYSTEM ==");
    display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
    
    display.setTextSize(2);
    display.setCursor(10, 20);
    display.println("SCHEDULE");
    display.setCursor(25, 40);
    display.println("SYNCED!");
    
    display.setTextSize(1);
    display.setCursor(0, 56);
    display.print("Count: ");
    display.print(scheduleCount);
    display.print(" schedules");
    
    display.display();
    delay(3000);  // Show message for 3 seconds
    
    Serial.print("✓ Schedule sync success! Total schedules: ");
    Serial.println(scheduleCount);
    
    publishStatus("schedules_updated");
  }
}

// Publish status to MQTT
void publishStatus(String status) {
  StaticJsonDocument<768> doc;
  doc["deviceId"] = device_id;
  doc["status"] = status;
  doc["feedingActive"] = feedingActive;
  doc["stepperActive"] = stepperActive;
  doc["stepperSpeed"] = stepperSpeed;
  doc["escPercent"] = currentESCPercent;
  doc["escPotPercent"] = escSpeedFromPot;
  doc["feedCount"] = feedCount;
  doc["weight"] = currentWeight;
  doc["targetWeight"] = targetWeight;
  doc["totalGrams"] = totalGramsFed;
  doc["timeInitialized"] = timeInitialized;
  doc["currentTime"] = getCurrentTime();
  doc["scheduleCount"] = scheduleCount;
  doc["hopperLevel"] = totalTankWeight;
  doc["hopperCapacity"] = maxTankCapacity;
  doc["hopperPercentage"] = (totalTankWeight / maxTankCapacity) * 100.0;
  doc["plateSpeed"] = calculateStepperRPM(stepperSpeed);
  doc["motorStatus"] = stepperActive ? "RUNNING" : "STOPPED";
  doc["rssi"] = WiFi.RSSI();
  doc["ipAddress"] = WiFi.localIP().toString();
  doc["uptimeMs"] = millis();
  
  char buffer[768];
  serializeJson(doc, buffer);
  mqttClient.publish(statusTopic.c_str(), buffer);
  Serial.print("Published status: ");
  Serial.println(buffer);
}

// Reconnect to MQTT
void reconnect() {
  // Try to reconnect every 5 seconds
  static unsigned long lastAttempt = 0;
  if (millis() - lastAttempt < 5000) {
    return;
  }
  lastAttempt = millis();
  
  Serial.print("Attempting MQTT connection...");
  
  String clientId = "ESP32-Feed-" + String(device_id);
  if (mqttClient.connect(clientId.c_str())) {
    Serial.println("connected");
    mqttClient.subscribe(commandTopic.c_str());
    mqttClient.subscribe(scheduleTopic.c_str());
    Serial.print("Subscribed to: ");
    Serial.println(commandTopic);
    Serial.print("Subscribed to: ");
    Serial.println(scheduleTopic);
    publishStatus("online");
  } else {
    Serial.print("failed, rc=");
    Serial.print(mqttClient.state());
    Serial.println(" try again in 5 seconds");
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  
  Serial.println("=================================");
  Serial.println("Feed Control System with MQTT");
  Serial.println("=================================");

  // ===== I2C & OLED Setup =====
  Serial.println("\n[Display Setup]");
  Wire.begin(I2C_SDA, I2C_SCL);
  
  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println("SSD1306 allocation failed!");
  } else {
    Serial.println("OLED Display Initialized ✓");
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("Initializing...");
    display.display();
  }

  // ===== HX711 Load Cell Setup =====
  Serial.println("\n[Load Cell Setup]");
  
  // Feed Output Scale (1kg)
  scale.begin(HX711_DT, HX711_SCK);
  if (scale.is_ready()) {
    Serial.println("HX711 #1 (Feed Output) Connected ✓");
    scale.set_scale(calibrationFactor);
    // DO NOT auto-tare on startup - display actual weight
    // Use MQTT command 'tare' to manually zero when needed
    Serial.println("HX711 #1 Ready ✓ (No auto-tare)");
  } else {
    Serial.println("⚠ HX711 #1 NOT RESPONDING!");
  }
  
  // Tank Sensor A (FOUR 5kg load cells - ALL connected to one HX711)
  scaleTankA.begin(HX711_TANK_A_DT, HX711_TANK_A_SCK);
  if (scaleTankA.is_ready()) {
    Serial.println("HX711 #2 (Tank A - FOUR 5kg cells) Connected ✓");
    Serial.println("  → All 4 load cells wired in parallel");
    scaleTankA.set_scale(calibrationFactorTankA);
    // DO NOT auto-tare on startup - display actual weight
    // Use MQTT command 'tare' to manually zero when needed
    Serial.println("HX711 #2 Ready ✓ (No auto-tare)");
  } else {
    Serial.println("⚠ HX711 #2 NOT RESPONDING!");
  }

  // ===== ESC Setup =====
  Serial.println("\n[ESC Motor Setup]");
  ledcAttach(escPin, pwmFreq, pwmResolution);
  
  // Arm ESC
  Serial.println("Arming ESC...");
  ledcWrite(escPin, usToDuty(minUs));
  delay(3000);
  Serial.println("ESC Armed ✓");

  // ===== Stepper Motor Setup =====
  Serial.println("\n[Stepper Motor Setup]");
  pinMode(stepPin, OUTPUT);
  pinMode(dirPin, OUTPUT);
  pinMode(resetSleepPin, OUTPUT);
  
  digitalWrite(stepPin, LOW);
  digitalWrite(dirPin, HIGH);
  setStepperEnabled(false); // Start in sleep mode
  
  Serial.println("NEMA 17 Ready (Sleep Mode) ✓");

  // ===== WiFi Setup =====
  Serial.println("\n[WiFi Setup]");
  setup_wifi();

  // ===== NTP Time Sync Setup =====
  Serial.println("\n[NTP Time Sync]");
  setupNTP();

  // ===== MQTT Setup =====
  Serial.println("\n[MQTT Setup]");
  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setCallback(mqtt_callback);
  mqttClient.setBufferSize(512);
  
  Serial.println("\n=================================");
  Serial.println("System Ready");
  Serial.println("=================================\n");
}

void loop() {
  // ===== WiFi Check =====
  if (WiFi.status() != WL_CONNECTED) {
    setup_wifi();
  }
  
  // ===== MQTT Connection =====
  if (!mqttClient.connected()) {
    reconnect();
  }
  mqttClient.loop();
  
  // ===== Load Cell Weight Reading =====
  static unsigned long lastWeightRead = 0;
  if (millis() - lastWeightRead > 1000) {
    Serial.println("========== HX711 READINGS ==========");
    
    // Read HX711 #1 - Feed output weight
    if (scale.is_ready()) {
      long rawValue1 = scale.read();
      currentWeight = scale.get_units(3);
      if (currentWeight < 0) currentWeight = 0;
      Serial.print("HX711 #1 [Feed Output 1kg]: ");
      Serial.print(currentWeight, 2);
      Serial.print(" g (Raw: ");
      Serial.print(rawValue1);
      Serial.println(")");
    } else {
      Serial.println("HX711 #1 [Feed Output]: NOT READY");
    }
    
    // Read HX711 #2 - Tank sensor A (FOUR 5kg cells)
    if (scaleTankA.is_ready()) {
      long rawValue2 = scaleTankA.read();
      tankWeightA = scaleTankA.get_units(3);
      if (tankWeightA < 0) tankWeightA = 0;
      Serial.print("HX711 #2 [Tank A - FOUR 5kg cells]: ");
      Serial.print(tankWeightA, 2);
      Serial.print(" g (Raw: ");
      Serial.print(rawValue2);
      Serial.println(")");
      
      // DIAGNOSTIC: Warn if reading is suspiciously low
      if (rawValue2 > -100000 && rawValue2 < 100000) {
        Serial.println("  ⚠ WARNING: Raw value too low! Check wiring:");
        Serial.println("  - Are ALL FOUR load cells connected?");
        Serial.println("  - Are ALL RED wires (4 cells) connected to E+?");
        Serial.println("  - Are ALL BLACK wires (4 cells) connected to E-?");
        Serial.println("  - Are ALL WHITE wires (4 cells) connected to A+?");
        Serial.println("  - Are ALL GREEN wires (4 cells) connected to A-?");
      }
    } else {
      Serial.println("HX711 #2 [Tank A]: NOT READY");
    }
    
    // Calculate total tank weight (all 4 cells on one HX711)
    totalTankWeight = tankWeightA;
    Serial.println("------------------------------------");
    Serial.print("TOTAL TANK WEIGHT: ");
    Serial.print(totalTankWeight, 2);
    Serial.print(" g / ");
    Serial.print(maxTankCapacity, 0);
    Serial.print(" g (");
    Serial.print((totalTankWeight / maxTankCapacity) * 100.0, 1);
    Serial.println("%)");
    Serial.println("====================================\n");
    
    lastWeightRead = millis();
  }
  
  // ===== Read ESC Speed from Potentiometer =====
  readESCSpeedFromPotentiometer();
  
  // ===== Check Weight-Based Feeding =====
  if (weightBasedFeeding && feedingActive) {
    checkWeightAndControl();
  }
  
  // ===== Run ESC Feeding Phase (vibration → ramp) =====
  if (escPhase != ESC_PHASE_IDLE && feedingActive) {
    runESCFeedingPhase();
  }
  
  // ===== Check ESC Auto-Stop (after ESC phase completes) =====
  checkESCAutoStop();
  
  // ===== Check Scheduled Feedings =====
  checkScheduledFeedings();
  
  // ===== Feeding Control =====
  if (feedingActive) {
    // Run stepper continuously (only when not in weight-based mode or when weight not reached)
    runStepperContinuous();
    
    // ESC ramp control (ONLY run ESC when NOT in weight-based mode)
    // In weight-based mode, ESC uses the phase state machine (vibration→ramp)
    if (!weightBasedFeeding) {
      unsigned long elapsed = millis() - escRampStartTime;
      if (elapsed < escRampDuration) {
        // Ramp from 10% to target% over escRampDuration (capped at 34%)
        int escStart = 10;
        int target = min(targetESCPercent, ESC_MAX_PERCENT);
        int escRange = target - escStart;
        int newPercent = escStart + (escRange * elapsed / escRampDuration);
        if (newPercent != currentESCPercent) {
          setESCPercent(newPercent);
        }
      } else if (currentESCPercent != min(targetESCPercent, ESC_MAX_PERCENT)) {
        // Ensure we're at target percent (capped)
        setESCPercent(min(targetESCPercent, ESC_MAX_PERCENT));
      }
    }
  }
  
  // ===== Periodic MQTT Status Publish (every 2 seconds) =====
  static unsigned long lastMqttPublish = 0;
  if (millis() - lastMqttPublish > 2000) {
    if (mqttClient.connected()) {
      publishStatus(feedingActive ? "feeding" : "online");
    }
    lastMqttPublish = millis();
  }
  
  // ===== Update OLED Display =====
  if (millis() - lastDisplayUpdate > displayUpdateInterval) {
    updateDisplay();
    lastDisplayUpdate = millis();
  }
  
  delay(1); // Small delay for stability
}

// ==================== NEW FUNCTIONS: NTP Time Synchronization ====================
void setupNTP() {
  Serial.println("Initializing NTP time synchronization...");
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  
  // Wait for time to be set
  int attempts = 0;
  while (!timeInitialized && attempts < 20) {
    struct tm timeinfo;
    if (getLocalTime(&timeinfo)) {
      timeInitialized = true;
      Serial.println("Time synchronized successfully!");
      printLocalTime();
      break;
    }
    Serial.print(".");
    delay(500);
    attempts++;
  }
  
  if (!timeInitialized) {
    Serial.println("\nFailed to sync time with NTP server");
  }
}

void printLocalTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
    return;
  }
  Serial.print("Current Time: ");
  Serial.println(&timeinfo, "%A, %B %d %Y %H:%M:%S");
}

String getCurrentTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "00:00";
  }
  char timeStr[6];
  sprintf(timeStr, "%02d:%02d", timeinfo.tm_hour, timeinfo.tm_min);
  return String(timeStr);
}

int getCurrentHour() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return -1;
  }
  return timeinfo.tm_hour;
}

int getCurrentMinute() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return -1;
  }
  return timeinfo.tm_min;
}

int getCurrentDay() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return -1;
  }
  return timeinfo.tm_mday;
}

// ==================== NEW FUNCTION: Schedule Checking ====================
void checkScheduledFeedings() {
  static unsigned long lastCheck = 0;
  if (millis() - lastCheck < 30000) return;  // Check every 30 seconds
  lastCheck = millis();
  
  if (!timeInitialized) return;              // Wait for time sync
  if (WiFi.status() != WL_CONNECTED) return;
  if (feedingActive) return;                  // Don't start if already feeding
  
  int currentHour = getCurrentHour();
  int currentMinute = getCurrentMinute();
  int currentDay = getCurrentDay();
  
  if (currentHour < 0 || currentMinute < 0 || currentDay < 0) return;
  
  // Check each schedule
  for (int i = 0; i < scheduleCount; i++) {
    if (!schedules[i].enabled) continue;
    if (schedules[i].lastExecutedDay == currentDay) continue;
    
    // Parse schedule time (format: "HH:MM")
    int schedHour = schedules[i].time.substring(0, 2).toInt();
    int schedMinute = schedules[i].time.substring(3, 5).toInt();
    
    // Check if it's time to feed (match hour and minute)
    if (currentHour == schedHour && currentMinute == schedMinute) {
      Serial.print("Schedule triggered: ");
      Serial.print(schedules[i].time);
      Serial.print(" - ");
      Serial.print(schedules[i].amount);
      Serial.println("g");
      
      startWeightBasedFeeding(schedules[i].amount);
      schedules[i].lastExecutedDay = currentDay;
      
      publishStatus("schedule_executed");
      break;  // Execute only one schedule per check
    }
  }
}

// ==================== NEW FUNCTION: Read Potentiometer ====================
void readESCSpeedFromPotentiometer() {
  static unsigned long lastRead = 0;
  if (millis() - lastRead < 200) return;  // Read every 200ms
  
  int rawValue = analogRead(variableResistorPin);
  escSpeedFromPot = map(rawValue, 0, 4095, 0, 100);  // ESP32 ADC is 12-bit (0-4095)
  
  lastRead = millis();
}

// ==================== NEW FUNCTION: Weight-Based Feeding ====================
void startWeightBasedFeeding(float targetGrams) {
  Serial.print("Starting weight-based feeding: ");
  Serial.print(targetGrams);
  Serial.println("g");

  targetWeight = targetGrams;
  weightBasedFeeding = true;
  feedingActive = true;
  feedCount++;
  
  // Tare the scale to start from zero
  scale.tare();
  currentWeight = 0;
  
  // Start NEMA17 stepper motor ONLY (ESC starts after weight reached)
  stepperActive = true;
  setStepperEnabled(true);
  digitalWrite(dirPin, HIGH);
  isHoming = false;
  
  // DO NOT start ESC yet - it will start after NEMA17 finishes
  setESCPercent(0);
  currentESCPercent = 0;
  
  Serial.println("NEMA17 started - Dispensing food...");
  Serial.println("ESC will start after target weight reached");
  
  publishStatus("weight_feeding_started");
}

// ==================== NEW FUNCTION: Check Weight and Stop ====================
void checkWeightAndControl() {
  // Check weight every 500ms
  if (millis() - lastWeightCheck < weightCheckInterval) {
    return;
  }
  lastWeightCheck = millis();
  
  // Real-time Serial print of load cell value
  Serial.print("Load Cell: ");
  Serial.print(currentWeight, 2);
  Serial.print("g / Target: ");
  Serial.print(targetWeight, 2);
  Serial.println("g");

  // Check if target weight reached
  if (currentWeight >= targetWeight) {
    Serial.println("✓✓✓ TARGET WEIGHT REACHED! ✓✓✓");
    Serial.println("Stopping NEMA17...");
    
    // Stop NEMA17 stepper motor
    stepperActive = false;
    setStepperEnabled(false);
    weightBasedFeeding = false;
    
    Serial.println("Starting ESC vibration anti-jam phase...");
    
    // Start ESC feeding phase: vibration (4s) → ramp (6s)
    escPhase = ESC_PHASE_VIBRATION;
    escPhaseStartTime = millis();
    setESCPercent(0);  // Start with ESC off, vibration logic handles pulses
    
    // Set target for ramp phase (capped at 34%)
    int escSpeed = escSpeedFromPot > 0 ? min(escSpeedFromPot, ESC_MAX_PERCENT) : ESC_MAX_PERCENT;
    targetESCPercent = escSpeed;
    
    // Enable ESC auto-stop monitoring (will kick in after ramp phase)
    escAutoStopEnabled = true;
    escStopTimerStarted = false;
    
    // Update statistics
    totalGramsFed += currentWeight;
    
    // feedingActive stays TRUE so ESC phase runs
    publishStatus("nema17_stopped_vibration_started");
    
    Serial.println("Phase 1: Vibration anti-jam (4s) at 31% pulses");
    Serial.println("Phase 2: Ramp 25% -> 34% (6s)");
    Serial.println("ESC will auto-stop 3 seconds after weight < 20g");
  }
}

// ==================== NEW FUNCTION: ESC Feeding Phase State Machine ====================
// Phase 1 (0-4s):  Vibration anti-jam — rapid ON/OFF pulses at 31% to shake stuck feed
// Phase 2 (4-10s): Smooth ramp from 25% → 34% for distribution
void runESCFeedingPhase() {
  unsigned long elapsed = millis() - escPhaseStartTime;
  
  if (escPhase == ESC_PHASE_VIBRATION) {
    // ── Phase 1: Vibration anti-jam (first 4 seconds) ──
    if (elapsed < ESC_VIBRATION_DURATION) {
      // Create rapid ON/OFF pulses to generate vibration without continuous rotation
      unsigned long cycleTime = ESC_VIBRATION_ON_MS + ESC_VIBRATION_OFF_MS;  // ~200ms cycle
      unsigned long cyclePos = elapsed % cycleTime;
      
      if (cyclePos < ESC_VIBRATION_ON_MS) {
        // Pulse ON at 31% — enough to jolt but not spin continuously
        if (currentESCPercent != ESC_VIBRATION_POWER) {
          setESCPercent(ESC_VIBRATION_POWER);
        }
      } else {
        // Pulse OFF — motor stops briefly, creating jerky vibration
        if (currentESCPercent != 0) {
          setESCPercent(0);
        }
      }
    } else {
      // Transition to ramp phase
      Serial.println("Vibration phase complete → Starting ESC ramp phase");
      escPhase = ESC_PHASE_RAMP;
      escPhaseStartTime = millis();  // Reset timer for ramp phase
      setESCPercent(25);  // Start ramp at 25%
      publishStatus("esc_ramp_started");
    }
    
  } else if (escPhase == ESC_PHASE_RAMP) {
    // ── Phase 2: Smooth ramp 25% → 34% over 6 seconds ──
    if (elapsed < ESC_RAMP_DURATION) {
      int startPercent = 25;
      int endPercent = min(targetESCPercent, ESC_MAX_PERCENT);  // Cap at 34%
      int range = endPercent - startPercent;
      int newPercent = startPercent + (int)((long)range * elapsed / ESC_RAMP_DURATION);
      newPercent = constrain(newPercent, startPercent, endPercent);
      
      if (newPercent != currentESCPercent) {
        setESCPercent(newPercent);
      }
    } else {
      // ── 10 seconds complete (4s vibration + 6s ramp) — STOP ESC ──
      Serial.println("✓ ESC 10-second sequence complete — STOPPING ESC");
      setESCPercent(0);
      escPhase = ESC_PHASE_IDLE;
      feedingActive = false;
      escAutoStopEnabled = false;
      escStopTimerStarted = false;
      
      Serial.println("Feeding cycle complete!");
      publishStatus("esc_sequence_complete");
    }
  }
}

// ==================== NEW FUNCTION: ESC Auto-Stop Monitor ====================
void checkESCAutoStop() {
  if (!escAutoStopEnabled) return;
  if (!feedingActive) return;
  
  // Don't auto-stop during vibration phase (weight hasn't dropped yet)
  if (escPhase == ESC_PHASE_VIBRATION) return;
  
  // Check if weight has dropped below threshold
  if (currentWeight < weightThreshold) {
    if (!escStopTimerStarted) {
      // Start the 3-second timer
      escStopTimer = millis();
      escStopTimerStarted = true;
      Serial.print("⚠ Weight below ");
      Serial.print(weightThreshold, 0);
      Serial.println("g - ESC will stop in 3 seconds...");
    } else {
      // Check if 3 seconds have passed
      if (millis() - escStopTimer >= escStopDelay) {
        Serial.println("✓ ESC Auto-Stop: 3 seconds elapsed");
        Serial.println("Stopping ESC motor...");
        
        // Stop ESC and reset phase
        setESCPercent(0);
        feedingActive = false;
        escAutoStopEnabled = false;
        escStopTimerStarted = false;
        escPhase = ESC_PHASE_IDLE;
        
        Serial.println("Feeding cycle complete!");
        publishStatus("esc_auto_stopped");
      }
    }
  } else {
    // Weight is above threshold, reset timer if it was started
    if (escStopTimerStarted) {
      escStopTimerStarted = false;
      Serial.println("Weight increased - ESC stop timer reset");
    }
  }
}
