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

// WiFi Credentials
const char* ssid = "Dulshan Dialog 4G 643";
const char* password = "Chuki000";

// MQTT Configuration
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
const char* device_id = "feed_device_001";

// MQTT Topics
String commandTopic = "koi/devices/" + String(device_id) + "/feeding/command";
String statusTopic = "koi/devices/" + String(device_id) + "/feeding/status";

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
#define HX711_DT 39   // Data pin (input-only GPIO)
#define HX711_SCK 16  // Clock pin (safe GPIO)

// HX711 Object and Calibration
HX711 scale;
float calibrationFactor = -7050.0;
float currentWeight = 0.0;

// ESC Motor Pins (Feed Distribution)
const int escPin = 25;   // ESC signal

// ESC parameters
const int pwmFreq = 50;       // 50Hz (servo/ESC)
const int pwmResolution = 16; // 16-bit
const int minUs = 1000;       // Min throttle
const int maxUs = 2000;       // Max throttle

// Stepper Motor Pins (Feed Output Control - NEMA 17)
const int stepPin = 26;       // STEP pin
const int dirPin = 27;        // DIR pin
const int resetSleepPin = 12; // RESET + SLEEP (shorted together)

// Stepper Motor Parameters
const int stepsPerRevolution = 200; // NEMA 17 typical (1.8° per step)

// Feeding State Variables
bool feedingActive = false;
bool stepperActive = false;
int stepperSpeed = 500; // Delay in microseconds
int currentESCPercent = 0;
int targetESCPercent = 35;
unsigned long escRampStartTime = 0;
unsigned long escRampDuration = 8000; // 8 seconds

// Homing Variables
long currentStepPosition = 0; // Track current position
bool isHoming = false; // Flag for homing mode

// Display update
unsigned long lastDisplayUpdate = 0;
const unsigned long displayUpdateInterval = 200;
int feedCount = 0;

// RPM Tracking
float stepperRPM = 0.0;

// Convert microseconds to duty (ESC)
uint32_t usToDuty(int us) {
  const int periodUs = 20000; // 50Hz = 20ms
  uint32_t maxDuty = (1 << pwmResolution) - 1;
  return (uint32_t)((uint64_t)us * maxDuty / periodUs);
}

// Set ESC throttle by percentage (0-100%)
void setESCPercent(int percent) {
  percent = constrain(percent, 0, 100);
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
  
  // WiFi Status
  display.setCursor(0, 14);
  display.print("WiFi: ");
  display.println(WiFi.status() == WL_CONNECTED ? "OK" : "NO");
  
  // MQTT Status
  display.setCursor(70, 14);
  display.print("MQTT: ");
  display.println(mqttClient.connected() ? "OK" : "NO");
  
  // ESC Motor Status
  display.setCursor(0, 24);
  display.print("ESC: ");
  display.print(currentESCPercent);
  display.println("%");
  
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
  
  // Feed Count
  display.setCursor(0, 54);
  display.print("Feeds: ");
  display.println(feedCount);
  
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
      Serial.println("Starting feeding...");
      feedCount++;
      feedingActive = true;
      
      // Get parameters
      stepperSpeed = data.containsKey("stepperSpeed") ? data["stepperSpeed"].as<int>() : 500;
      int escStart = data.containsKey("escStartPercent") ? data["escStartPercent"].as<int>() : 10;
      targetESCPercent = data.containsKey("escTargetPercent") ? data["escTargetPercent"].as<int>() : 35;
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
      
    } else if (action == "stop") {
      Serial.println("Stopping feeding immediately...");
      feedingActive = false;
      stepperActive = false;
      isHoming = false;
      
      // Stop ESC immediately
      setESCPercent(0);
      
      // Cut off NEMA 17 power immediately - set pin 12 LOW
      digitalWrite(resetSleepPin, LOW);
      Serial.println("Motor sleep mode activated (Pin 12 LOW)");
      
      publishStatus("feeding_stopped");
      
    } else if (action == "status") {
      publishStatus("status_report");
    }
  }
}

// Publish status to MQTT
void publishStatus(String status) {
  StaticJsonDocument<256> doc;
  doc["deviceId"] = device_id;
  doc["status"] = status;
  doc["feedingActive"] = feedingActive;
  doc["stepperActive"] = stepperActive;
  doc["stepperSpeed"] = stepperSpeed;
  doc["escPercent"] = currentESCPercent;
  doc["feedCount"] = feedCount;
  doc["weight"] = currentWeight;
  
  char buffer[256];
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
    Serial.print("Subscribed to: ");
    Serial.println(commandTopic);
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
  scale.begin(HX711_DT, HX711_SCK);
  
  if (scale.is_ready()) {
    Serial.println("HX711 Connected ✓");
    scale.set_scale(calibrationFactor);
    scale.tare(10);
    Serial.println("HX711 Ready ✓");
  } else {
    Serial.println("⚠ HX711 NOT RESPONDING!");
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
    if (scale.is_ready()) {
      currentWeight = scale.get_units(3);
      if (currentWeight < 0) currentWeight = 0;
    }
    lastWeightRead = millis();
  }
  
  // ===== Feeding Control =====
  if (feedingActive) {
    // Run stepper continuously
    runStepperContinuous();
    
    // ESC ramp control
    unsigned long elapsed = millis() - escRampStartTime;
    if (elapsed < escRampDuration) {
      // Ramp from 10% to target% over escRampDuration
      int escStart = 10;
      int escRange = targetESCPercent - escStart;
      int newPercent = escStart + (escRange * elapsed / escRampDuration);
      if (newPercent != currentESCPercent) {
        setESCPercent(newPercent);
      }
    } else if (currentESCPercent != targetESCPercent) {
      // Ensure we're at target percent
      setESCPercent(targetESCPercent);
    }
  }
  
  // ===== Update OLED Display =====
  if (millis() - lastDisplayUpdate > displayUpdateInterval) {
    updateDisplay();
    lastDisplayUpdate = millis();
  }
  
  delay(1); // Small delay for stability
}
