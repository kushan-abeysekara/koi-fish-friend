/*
  ESP32 Dual Motor Control System
  - ESC control with 10k potentiometer (103) for feed distribution
  - A4988 Stepper Motor (NEMA 17) for feed output control from tank
  - OLED Display (SSD1306) for real-time monitoring
  Compatible with ESP32 Arduino Core 3.x
*/

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <HX711.h>

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
#define HX711_SCK 16  // Clock pin (safe GPIO, not strapping or XTAL)

// HX711 Object and Calibration
HX711 scale;
float calibrationFactor = -7050.0; // Adjust based on your load cell
float currentWeight = 0.0;

// ESC Motor Pins (Feed Distribution)
const int potPin = 36;   // ADC1_0
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
unsigned long stepperLastUpdate = 0;
int currentSpeed = 500;  // Delay in microseconds between steps (lower = faster)

// RPM Tracking Variables
float stepperRPM = 0.0;
float escThrottlePercent = 0.0;
unsigned long lastDisplayUpdate = 0;
const unsigned long displayUpdateInterval = 200; // Update display every 200ms
int feedCount = 0;

// Convert microseconds to duty (ESC)
uint32_t usToDuty(int us) {
  const int periodUs = 20000; // 50Hz = 20ms
  uint32_t maxDuty = (1 << pwmResolution) - 1;
  return (uint32_t)((uint64_t)us * maxDuty / periodUs);
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
  
  // ESC Motor Status
  display.setCursor(0, 14);
  display.print("ESC: ");
  display.print(escThrottlePercent, 1);
  display.println("%");
  
  // Stepper Motor RPM
  display.setCursor(0, 24);
  display.print("Stepper: ");
  if (stepperRPM > 0.1) {
    display.print(stepperRPM, 1);
    display.println(" RPM");
  } else {
    display.println("IDLE");
  }
  
  // Weight Display
  display.setCursor(0, 34);
  display.print("Weight: ");
  display.print(currentWeight, 1);
  display.println(" g");
  
  // Feed Count
  display.setCursor(0, 44);
  display.print("Feeds: ");
  display.println(feedCount);
  
  // Status Bar
  display.drawLine(0, 54, 128, 54, SSD1306_WHITE);
  display.setCursor(0, 56);
  display.setTextSize(1);
  if (stepperRPM > 0.1) {
    display.print("ACTIVE");
  } else {
    display.print("READY");
  }
  
  // Uptime
  display.print(" | ");
  unsigned long seconds = millis() / 1000;
  display.print(seconds / 60);
  display.print("m");
  
  display.display();
}

void displaySplashScreen() {
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10, 10);
  display.println("FEED");
  display.println("SYSTEM");
  display.setTextSize(1);
  display.setCursor(0, 50);
  display.println("Initializing...");
  display.display();
  delay(2000);
}

// Calculate Stepper RPM
float calculateStepperRPM(int delayMicros) {
  // Time per step = delayMicros + 500 (pulse width)
  float timePerStepUs = delayMicros + 500.0;
  float stepsPerSecond = 1000000.0 / timePerStepUs;
  float rpm = (stepsPerSecond * 60.0) / stepsPerRevolution;
  return rpm;
}

// Stepper Motor Functions
void stepperRotate(int steps, int delayMicros, bool clockwise) {
  digitalWrite(dirPin, clockwise ? HIGH : LOW);
  delayMicroseconds(1000); // Wait for direction to settle
  
  // Calculate and update RPM
  stepperRPM = calculateStepperRPM(delayMicros);
  
  for (int i = 0; i < steps; i++) {
    digitalWrite(stepPin, HIGH);
    delayMicroseconds(500); // Minimum 1-2µs HIGH pulse for A4988
    digitalWrite(stepPin, LOW);
    delayMicroseconds(delayMicros); // Wait before next step
    
    // Update display periodically during rotation
    if (millis() - lastDisplayUpdate > displayUpdateInterval) {
      updateDisplay();
      lastDisplayUpdate = millis();
    }
  }
  
  stepperRPM = 0.0; // Reset RPM when stopped
}

void stepperRotateRevolutions(float revolutions, int delayMicros, bool clockwise) {
  int totalSteps = (int)(revolutions * stepsPerRevolution);
  stepperRotate(totalSteps, delayMicros, clockwise);
}

void stepperDemoSequence() {
  Serial.println("\n--- Stepper Demo: Variable Speeds ---");
  feedCount++; // Increment for demo
  
  // Very slow speed (2000 microseconds)
  Serial.println("Very Slow CW: 1 revolution (testing)...");
  stepperRotateRevolutions(1.0, 2000, true);
  delay(1000);
  
  // Slow speed (1500 microseconds)
  Serial.println("Slow CCW: 1 revolution");
  stepperRotateRevolutions(1.0, 1500, false);
  delay(1000);
  
  // Medium speed (1000 microseconds)
  Serial.println("Medium CW: 2 revolutions");
  stepperRotateRevolutions(2.0, 1000, true);
  delay(1000);
  
  // Fast speed (700 microseconds)
  Serial.println("Fast CCW: 1 revolution");
  stepperRotateRevolutions(1.0, 700, false);
  delay(1000);
  
  // Very fast (500 microseconds)
  Serial.println("Very Fast CW: 0.5 revolution");
  stepperRotateRevolutions(0.5, 500, true);
  delay(2000);
  
  Serial.println("Demo complete!\n");
}

void setup() {
  Serial.begin(115200);
  delay(500);
  
  Serial.println("=================================");
  Serial.println("Dual Motor Feed Control System");
  Serial.println("=================================");

  // ===== I2C & OLED Setup =====
  Serial.println("\n[Display Setup]");
  Wire.begin(I2C_SDA, I2C_SCL);
  
  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println("SSD1306 allocation failed!");
    Serial.println("Continuing without display...");
  } else {
    Serial.println("OLED Display Initialized ✓");
    displaySplashScreen();
  }

  // ===== HX711 Load Cell Setup =====
  Serial.println("\n[Load Cell Setup]");
  scale.begin(HX711_DT, HX711_SCK);
  
  Serial.println("Initializing HX711...");
  Serial.println("Waiting for HX711 to be ready...");
  
  int attempts = 0;
  while (!scale.is_ready() && attempts < 10) {
    Serial.print(".");
    delay(100);
    attempts++;
  }
  Serial.println();
  
  if (scale.is_ready()) {
    Serial.println("HX711 Connected ✓");
    
    // Read raw value before calibration
    long rawValue = scale.read_average(10);
    Serial.print("Raw reading (no cal): ");
    Serial.println(rawValue);
    
    scale.set_scale(calibrationFactor);
    Serial.print("Calibration Factor: ");
    Serial.println(calibrationFactor);
    
    Serial.println("Taring (zeroing)...");
    scale.tare(10); // Average 10 readings for tare
    Serial.println("HX711 Ready ✓");
    Serial.println("Load Cell Ready (5kg capacity)");
  } else {
    Serial.println("⚠ HX711 NOT RESPONDING!");
    Serial.println("Check wiring:");
    Serial.println("  DT  -> GPIO 39");
    Serial.println("  SCK -> GPIO 16");
    Serial.println("  VCC -> 3.3V");
    Serial.println("  GND -> GND");
    Serial.println("Load cell to HX711:");
    Serial.println("  Red -> E+, Black -> E-");
    Serial.println("  White -> A+, Green -> A-");
  }

  // ===== ESC Setup (Feed Distribution) =====
  Serial.println("\n[ESC Motor Setup]");
  
  // ADC setup
  analogReadResolution(12); // 0–4095
  analogSetPinAttenuation(potPin, ADC_11db);

  // NEW LEDC API (Core 3.x)
  ledcAttach(escPin, pwmFreq, pwmResolution);

  // Arm ESC
  Serial.println("Arming ESC (keep pot at MIN)...");
  ledcWrite(escPin, usToDuty(minUs));
  delay(3000);
  Serial.println("ESC Armed ✓");

  // ===== Stepper Motor Setup (Feed Output Control) =====
  Serial.println("\n[Stepper Motor Setup]");
  
  pinMode(stepPin, OUTPUT);
  pinMode(dirPin, OUTPUT);
  pinMode(resetSleepPin, OUTPUT);
  
  digitalWrite(stepPin, LOW);
  digitalWrite(dirPin, LOW);
  digitalWrite(resetSleepPin, HIGH); // Enable driver (RESET + SLEEP HIGH)
  
  delay(100); // Give driver time to wake up
  
  Serial.println("A4988 Driver Enabled ✓");
  Serial.println("NEMA 17 Ready ✓");
  Serial.println("\nTesting motor rotation...");
  
  delay(500);
  
  // Run stepper demo sequence
  stepperDemoSequence();
  
  Serial.println("\n=================================");
  Serial.println("System Ready - Both Motors Active");
  Serial.println("=================================\n");
}

void loop() {
  // ===== Load Cell Weight Reading =====
  static unsigned long lastWeightDebug = 0;
  static bool hx711Ready = true;
  
  if (scale.is_ready()) {
    if (!hx711Ready) {
      Serial.println("\n[HX711 now responding!]");
      hx711Ready = true;
    }
    currentWeight = scale.get_units(5); // Average of 5 readings
    if (currentWeight < 0) currentWeight = 0; // Prevent negative values
    
    // Debug output every 5 seconds
    if (millis() - lastWeightDebug > 5000) {
      long rawReading = scale.read_average(5);
      Serial.print("\n[Weight Debug] Raw: ");
      Serial.print(rawReading);
      Serial.print(" | Calibrated: ");
      Serial.print(currentWeight, 2);
      Serial.println("g");
      lastWeightDebug = millis();
    }
  } else {
    if (hx711Ready) {
      Serial.println("\n⚠ HX711 NOT READY! Check connections.");
      hx711Ready = false;
    }
    currentWeight = 0.0;
  }
  
  // ===== ESC Motor Control (Feed Distribution) =====
  int adcValue = analogRead(potPin); // 0–4095

  int pulseUs = map(adcValue, 0, 4095, minUs, maxUs);
  ledcWrite(escPin, usToDuty(pulseUs));
  
  // Calculate ESC throttle percentage
  escThrottlePercent = map(adcValue, 0, 4095, 0, 100);

  Serial.print("Weight: ");
  Serial.print(currentWeight, 1);
  Serial.print("g | ESC: ");
  Serial.print(escThrottlePercent, 1);
  Serial.print("%");
  
  // ===== Stepper Motor Control (Feed Output) =====
  // Optional: Add continuous rotation or trigger-based control here
  // Example: Rotate stepper every 7 seconds
  static unsigned long lastStepperRun = 0;
  if (millis() - lastStepperRun > 7000) {
    Serial.print(" | Stepper: Dispensing");
    feedCount++;
    stepperRotateRevolutions(0.5, 1000, true); // Half revolution at medium speed
    Serial.print(" ✓");
    lastStepperRun = millis();
  }
  
  // Update OLED Display periodically
  if (millis() - lastDisplayUpdate > displayUpdateInterval) {
    updateDisplay();
    lastDisplayUpdate = millis();
  }
  
  Serial.println();
  delay(50);
}
