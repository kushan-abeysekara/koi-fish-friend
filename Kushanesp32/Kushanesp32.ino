/*
 * Koi Fish Friend - ESP32 Boat Control System
 * Board: ZY-ESP32 WIFI BT 38 PIN BOARD
 * 
 * Features:
 * - Voltage monitoring with relay control
 * - Weight measurement using HX711 and load cell
 * - Day/Night detection using LDR
 * - Motion detection and balance control using MPU-6050
 * - Dual motor control using L298N
 * - Obstacle detection using HC-SR04
 * - RTC with temperature monitoring using DS3231
 * 
 * Author: Koi Fish Friend Team
 * Date: November 24, 2025
 */

#include <Wire.h>
#include <HX711.h>
#include <MPU6050.h>
#include <RTClib.h>

// ==================== PIN DEFINITIONS ====================

// Voltage Sensor
#define VOLTAGE_SENSOR_PIN 34  // Analog pin for voltage sensor

// Relay Module
#define RELAY_PIN 13           // G13 for relay control

// HX711 Load Cell
#define HX711_DOUT_PIN 16      // HX711 DOUT (keep original)
#define HX711_SCK_PIN 17       // HX711 SCK (keep original)

// LDR Light Sensor
#define LDR_PIN 35             // Analog pin for LDR

// MPU-6050 (I2C)
// SDA -> GPIO 21
// SCL -> GPIO 22

// L298N Motor Driver
#define MOTOR_LEFT_IN1 25
#define MOTOR_LEFT_IN2 26
#define MOTOR_LEFT_EN 14

#define MOTOR_RIGHT_IN1 27
#define MOTOR_RIGHT_IN2 32
#define MOTOR_RIGHT_EN 33

// HC-SR04 Ultrasonic Sensors (4 units)
#define ULTRASONIC_FRONT_TRIG 18
#define ULTRASONIC_FRONT_ECHO 19
#define ULTRASONIC_BACK_TRIG 23
#define ULTRASONIC_BACK_ECHO -1   // DISABLED - GPIO 0 causes boot loop
#define ULTRASONIC_LEFT_TRIG 4
#define ULTRASONIC_LEFT_ECHO 15
#define ULTRASONIC_RIGHT_TRIG 2
#define ULTRASONIC_RIGHT_ECHO 12

// DS3231 RTC (I2C)
// SDA -> GPIO 21
// SCL -> GPIO 22

// OLED Display 0.96" SSD1306 (SPI Mode)
#define OLED_MOSI 3          // SDA/MOSI
#define OLED_CLK 1           // SCL/SCK
#define OLED_DC 36           // Data/Command
#define OLED_CS 39           // Chip Select
#define OLED_RESET -1        // Reset (not used, -1)

// Fish Feeding Motor (A2212 Brushless - ESC Control)
#define FEED_MOTOR_PIN 9     // PWM pin for ESC control

// A4988 Stepper Motor Driver
#define STEPPER_STEP 10      // Step pin
#define STEPPER_DIR 11       // Direction pin
#define STEPPER_EN 8         // Enable pin (optional)

// Arduino Pro Mini Communication (Serial2)
#define ARDUINO_TX 17          // ESP32 TX2 -> Arduino RX
#define ARDUINO_RX 18          // ESP32 RX2 -> Arduino TX (conflicts with HX711!)
// NOTE: Use I2C instead! Arduino as I2C slave on the shared I2C bus

// RESERVED FOR FUTURE WiFi/MQTT
// Note: WiFi uses internal pins (no external connection needed)

// ==================== CONSTANTS ====================

#define VOLTAGE_THRESHOLD 8.6       // Voltage threshold for relay
#define VOLTAGE_DIVIDER_RATIO 5.0   // Adjust based on your voltage divider
#define LDR_DAY_THRESHOLD 2000      // LDR threshold for day/night
#define OBSTACLE_DISTANCE_CM 30     // Obstacle detection distance
#define BALANCE_ANGLE_THRESHOLD 15  // Angle threshold for balance control
#define CALIBRATION_FACTOR -7050.0  // HX711 calibration factor (adjust after calibration)

// ==================== GLOBAL OBJECTS ====================

HX711 scale;
MPU6050 mpu;
RTC_DS3231 rtc;

// ==================== GLOBAL VARIABLES ====================

float voltage = 0.0;
float weight = 0.0;
int ldrValue = 0;
bool isDayTime = false;

// MPU-6050 readings
float accelX, accelY, accelZ;
float gyroX, gyroY, gyroZ;
float angleX, angleY;
float temperature;

// Ultrasonic distances
float distanceFront = 0.0;
float distanceBack = 0.0;
float distanceLeft = 0.0;
float distanceRight = 0.0;

// Motor speeds
int motorLeftSpeed = 0;
int motorRightSpeed = 0;

// Timing
unsigned long lastSensorRead = 0;
unsigned long lastRTCRead = 0;
const unsigned long SENSOR_READ_INTERVAL = 100;  // 100ms
const unsigned long RTC_READ_INTERVAL = 1000;     // 1 second

// Feeding motor state (controlled by backend)
int feedMotorSpeed = 0;  // 0-180 (ESC servo style) or 1000-2000 (PWM microseconds)
bool feedMotorEnabled = false;

// Stepper motor state (controlled by backend)
long stepperPosition = 0;
int stepperSpeed = 1000;  // Microseconds between steps
bool stepperEnabled = false;

// ==================== SETUP ====================

void setup() {
  Serial.begin(115200);
  Serial.println("Koi Fish Friend - ESP32 Boat Control System");
  Serial.println("Initializing...");
  
  // Initialize I2C
  Wire.begin(21, 22);
  
  // Initialize pins
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  
  pinMode(LDR_PIN, INPUT);
  pinMode(VOLTAGE_SENSOR_PIN, INPUT);
  
  // Motor pins
  pinMode(MOTOR_LEFT_IN1, OUTPUT);
  pinMode(MOTOR_LEFT_IN2, OUTPUT);
  pinMode(MOTOR_LEFT_EN, OUTPUT);
  pinMode(MOTOR_RIGHT_IN1, OUTPUT);
  pinMode(MOTOR_RIGHT_IN2, OUTPUT);
  pinMode(MOTOR_RIGHT_EN, OUTPUT);
  
  // Ultrasonic pins (3 sensors - back disabled)
  pinMode(ULTRASONIC_FRONT_TRIG, OUTPUT);
  pinMode(ULTRASONIC_FRONT_ECHO, INPUT);
  // pinMode(ULTRASONIC_BACK_TRIG, OUTPUT);  // Disabled
  // pinMode(ULTRASONIC_BACK_ECHO, INPUT);   // Disabled
  pinMode(ULTRASONIC_LEFT_TRIG, OUTPUT);
  pinMode(ULTRASONIC_LEFT_ECHO, INPUT);
  pinMode(ULTRASONIC_RIGHT_TRIG, OUTPUT);
  pinMode(ULTRASONIC_RIGHT_ECHO, INPUT);
  
  // OLED Display pins (SPI) - DISABLED (conflicts with flash pins)
  // pinMode(OLED_MOSI, OUTPUT);
  // pinMode(OLED_CLK, OUTPUT);
  // pinMode(OLED_DC, OUTPUT);
  // pinMode(OLED_CS, OUTPUT);
  Serial.println("OLED DISABLED - GPIO 1,3,36,39 cause issues");
  
  // Fish Feeding Motor (ESC) - DISABLED (GPIO 9 is flash pin)
  // pinMode(FEED_MOTOR_PIN, OUTPUT);
  // ledcAttach(FEED_MOTOR_PIN, 50, 16);
  // ledcWrite(FEED_MOTOR_PIN, 0);
  Serial.println("Feeding motor DISABLED - GPIO 8-11 are flash pins");
  
  // Stepper Motor Driver pins - DISABLED (GPIO 8,10,11 are flash pins)
  // pinMode(STEPPER_STEP, OUTPUT);
  // pinMode(STEPPER_DIR, OUTPUT);
  // pinMode(STEPPER_EN, OUTPUT);
  // digitalWrite(STEPPER_EN, HIGH);
  // digitalWrite(STEPPER_STEP, LOW);
  // digitalWrite(STEPPER_DIR, LOW);
  Serial.println("Stepper motor DISABLED - GPIO 8-11 are flash pins");
  
  // Initialize HX711
  Serial.println("Initializing HX711...");
  scale.begin(HX711_DOUT_PIN, HX711_SCK_PIN);
  scale.set_scale(CALIBRATION_FACTOR);
  scale.tare();  // Reset scale to 0
  Serial.println("HX711 initialized!");
  
  // Initialize MPU-6050
  Serial.println("Initializing MPU-6050...");
  mpu.initialize();
  if (mpu.testConnection()) {
    Serial.println("MPU-6050 connection successful!");
  } else {
    Serial.println("MPU-6050 connection failed!");
  }
  
  // Initialize RTC
  Serial.println("Initializing DS3231 RTC...");
  if (!rtc.begin()) {
    Serial.println("Couldn't find RTC!");
  } else {
    Serial.println("RTC initialized!");
    
    // Check if RTC lost power and set the time if needed
    if (rtc.lostPower()) {
      Serial.println("RTC lost power, setting the time!");
      rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
    }
  }
  
  // Stop motors initially
  stopMotors();
  
  Serial.println("Initialization complete!");
  Serial.println("NOTE: OLED Display requires Adafruit_SSD1306 library for full functionality");
  Serial.println("NOTE: Feeding motor and stepper are ready for backend control");
  Serial.println("========================================");
}

// ==================== MAIN LOOP ====================

void loop() {
  unsigned long currentMillis = millis();
  
  // Read sensors at regular intervals
  if (currentMillis - lastSensorRead >= SENSOR_READ_INTERVAL) {
    lastSensorRead = currentMillis;
    
    // Read all sensors
    readVoltageSensor();
    readLoadCell();
    readLDRSensor();
    readMPU6050();
    readUltrasonicSensors();
  }
  
  // Read RTC less frequently
  if (currentMillis - lastRTCRead >= RTC_READ_INTERVAL) {
    lastRTCRead = currentMillis;
    readRTC();
    readArduinoProMini();  // Get back ultrasonic distance
    printSensorData();
  }
  
  // Control relay based on voltage
  controlRelay();
  
  // Balance control based on MPU-6050
  balanceControl();
  
  // Obstacle avoidance
  obstacleAvoidance();
}

// ==================== SENSOR READING FUNCTIONS ====================

void readVoltageSensor() {
  int rawValue = analogRead(VOLTAGE_SENSOR_PIN);
  voltage = (rawValue / 4095.0) * 3.3 * VOLTAGE_DIVIDER_RATIO;
}

void readLoadCell() {
  if (scale.is_ready()) {
    weight = scale.get_units(5);  // Average of 5 readings
    weight = abs(weight);  // Absolute value
    
    // Ensure positive and format to 2 decimal places
    if (weight < 0) weight = 0;
  }
}

void readLDRSensor() {
  ldrValue = analogRead(LDR_PIN);
  isDayTime = (ldrValue > LDR_DAY_THRESHOLD);
}

void readMPU6050() {
  int16_t ax, ay, az;
  int16_t gx, gy, gz;
  
  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
  
  // Convert to proper units
  accelX = ax / 16384.0;  // g (gravity)
  accelY = ay / 16384.0;
  accelZ = az / 16384.0;
  
  gyroX = gx / 131.0;  // degrees/second
  gyroY = gy / 131.0;
  gyroZ = gz / 131.0;
  
  // Calculate angles (simple complementary filter)
  angleX = atan2(accelY, accelZ) * 180.0 / PI;
  angleY = atan2(-accelX, sqrt(accelY * accelY + accelZ * accelZ)) * 180.0 / PI;
  
  // Get MPU temperature
  temperature = mpu.getTemperature() / 340.0 + 36.53;
}

void readUltrasonicSensors() {
  distanceFront = getDistance(ULTRASONIC_FRONT_TRIG, ULTRASONIC_FRONT_ECHO);
  // distanceBack read from Arduino Pro Mini via I2C
  distanceLeft = getDistance(ULTRASONIC_LEFT_TRIG, ULTRASONIC_LEFT_ECHO);
  distanceRight = getDistance(ULTRASONIC_RIGHT_TRIG, ULTRASONIC_RIGHT_ECHO);
}

void readArduinoProMini() {
  // Request 2 bytes from Arduino Pro Mini (back distance)
  Wire.requestFrom(0x08, 2);
  
  if (Wire.available() >= 2) {
    byte highByte = Wire.read();
    byte lowByte = Wire.read();
    int distanceInt = (highByte << 8) | lowByte;
    distanceBack = distanceInt / 10.0;  // Convert back to float
  }
}

// Send command to Arduino Pro Mini
void sendArduinoCommand(const char* command) {
  Wire.beginTransmission(0x08);
  Wire.write(command);
  Wire.endTransmission();
}

float getDistance(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  
  long duration = pulseIn(echoPin, HIGH, 30000);  // Timeout 30ms
  float distance = (duration * 0.034) / 2.0;
  
  return distance;
}

void readRTC() {
  DateTime now = rtc.now();
  float rtcTemp = rtc.getTemperature();
  
  Serial.println("\n========== RTC Information ==========");
  Serial.print("Date: ");
  Serial.print(now.year(), DEC);
  Serial.print('/');
  Serial.print(now.month(), DEC);
  Serial.print('/');
  Serial.println(now.day(), DEC);
  
  Serial.print("Time: ");
  Serial.print(now.hour(), DEC);
  Serial.print(':');
  Serial.print(now.minute(), DEC);
  Serial.print(':');
  Serial.println(now.second(), DEC);
  
  Serial.print("RTC Temperature: ");
  Serial.print(rtcTemp);
  Serial.println(" °C");
}

// ==================== CONTROL FUNCTIONS ====================

void controlRelay() {
  if (voltage < VOLTAGE_THRESHOLD) {
    digitalWrite(RELAY_PIN, HIGH);  // Turn on relay
  } else {
    digitalWrite(RELAY_PIN, LOW);   // Turn off relay
  }
}

void balanceControl() {
  // Check if boat is tilted beyond threshold
  if (abs(angleX) > BALANCE_ANGLE_THRESHOLD) {
    // Tilt on X-axis (left/right) - adjust motor speeds for turning
    if (angleX > 0) {
      // Tilted right - increase left motor, decrease right motor
      adjustMotorsForBalance(20, -20);
    } else {
      // Tilted left - increase right motor, decrease left motor
      adjustMotorsForBalance(-20, 20);
    }
  } else if (abs(angleY) > BALANCE_ANGLE_THRESHOLD) {
    // Tilt on Y-axis (forward/backward) - adjust both motors equally
    if (angleY > 0) {
      adjustMotorsForBalance(15, 15);  // Both forward
    } else {
      adjustMotorsForBalance(-15, -15);  // Both backward
    }
  }
}

void adjustMotorsForBalance(int leftAdjust, int rightAdjust) {
  motorLeftSpeed = constrain(motorLeftSpeed + leftAdjust, -255, 255);
  motorRightSpeed = constrain(motorRightSpeed + rightAdjust, -255, 255);
  
  setMotorSpeed(MOTOR_LEFT_IN1, MOTOR_LEFT_IN2, MOTOR_LEFT_EN, motorLeftSpeed);
  setMotorSpeed(MOTOR_RIGHT_IN1, MOTOR_RIGHT_IN2, MOTOR_RIGHT_EN, motorRightSpeed);
}

void obstacleAvoidance() {
  // Check front
  if (distanceFront > 0 && distanceFront < OBSTACLE_DISTANCE_CM) {
    Serial.println("Obstacle detected FRONT!");
    // Decide direction based on side sensors
    if (distanceLeft > distanceRight) {
      turnLeft();  // More space on left
    } else {
      turnRight(); // More space on right
    }
  }
  
  // Check back
  if (distanceBack > 0 && distanceBack < OBSTACLE_DISTANCE_CM) {
    Serial.println("Obstacle detected BACK!");
    moveForward(150); // Move away from back obstacle
  }
  
  // Check left side
  if (distanceLeft > 0 && distanceLeft < OBSTACLE_DISTANCE_CM) {
    Serial.println("Obstacle detected LEFT!");
    turnRight();
  }
  
  // Check right side
  if (distanceRight > 0 && distanceRight < OBSTACLE_DISTANCE_CM) {
    Serial.println("Obstacle detected RIGHT!");
    turnLeft();
  }
}

// ==================== MOTOR CONTROL FUNCTIONS ====================

void setMotorSpeed(int in1, int in2, int en, int speed) {
  if (speed > 0) {
    // Forward
    digitalWrite(in1, HIGH);
    digitalWrite(in2, LOW);
    analogWrite(en, abs(speed));
  } else if (speed < 0) {
    // Backward
    digitalWrite(in1, LOW);
    digitalWrite(in2, HIGH);
    analogWrite(en, abs(speed));
  } else {
    // Stop
    digitalWrite(in1, LOW);
    digitalWrite(in2, LOW);
    analogWrite(en, 0);
  }
}

void moveForward(int speed) {
  motorLeftSpeed = speed;
  motorRightSpeed = speed;
  setMotorSpeed(MOTOR_LEFT_IN1, MOTOR_LEFT_IN2, MOTOR_LEFT_EN, speed);
  setMotorSpeed(MOTOR_RIGHT_IN1, MOTOR_RIGHT_IN2, MOTOR_RIGHT_EN, speed);
}

void moveBackward(int speed) {
  motorLeftSpeed = -speed;
  motorRightSpeed = -speed;
  setMotorSpeed(MOTOR_LEFT_IN1, MOTOR_LEFT_IN2, MOTOR_LEFT_EN, -speed);
  setMotorSpeed(MOTOR_RIGHT_IN1, MOTOR_RIGHT_IN2, MOTOR_RIGHT_EN, -speed);
}

void turnLeft() {
  motorLeftSpeed = -100;
  motorRightSpeed = 100;
  setMotorSpeed(MOTOR_LEFT_IN1, MOTOR_LEFT_IN2, MOTOR_LEFT_EN, -100);
  setMotorSpeed(MOTOR_RIGHT_IN1, MOTOR_RIGHT_IN2, MOTOR_RIGHT_EN, 100);
}

void turnRight() {
  motorLeftSpeed = 100;
  motorRightSpeed = -100;
  setMotorSpeed(MOTOR_LEFT_IN1, MOTOR_LEFT_IN2, MOTOR_LEFT_EN, 100);
  setMotorSpeed(MOTOR_RIGHT_IN1, MOTOR_RIGHT_IN2, MOTOR_RIGHT_EN, -100);
}

void stopMotors() {
  motorLeftSpeed = 0;
  motorRightSpeed = 0;
  setMotorSpeed(MOTOR_LEFT_IN1, MOTOR_LEFT_IN2, MOTOR_LEFT_EN, 0);
  setMotorSpeed(MOTOR_RIGHT_IN1, MOTOR_RIGHT_IN2, MOTOR_RIGHT_EN, 0);
}

// ==================== DISPLAY FUNCTIONS ====================

void printSensorData() {
  Serial.println("\n========== Sensor Readings ==========");
  
  // Voltage
  Serial.print("Voltage: ");
  Serial.print(voltage, 2);
  Serial.print(" V | Relay: ");
  Serial.println(voltage < VOLTAGE_THRESHOLD ? "ON" : "OFF");
  
  // Weight
  Serial.print("Weight: ");
  Serial.print(weight, 2);
  Serial.println(" kg");
  
  // LDR
  Serial.print("Light: ");
  Serial.print(ldrValue);
  Serial.print(" | ");
  Serial.println(isDayTime ? "DAY" : "NIGHT");
  
  // MPU-6050
  Serial.println("\n--- MPU-6050 ---");
  Serial.print("Accel (m/s²): X=");
  Serial.print(accelX * 9.81, 2);
  Serial.print(" Y=");
  Serial.print(accelY * 9.81, 2);
  Serial.print(" Z=");
  Serial.println(accelZ * 9.81, 2);
  
  Serial.print("Gyro (°/s): X=");
  Serial.print(gyroX, 2);
  Serial.print(" Y=");
  Serial.print(gyroY, 2);
  Serial.print(" Z=");
  Serial.println(gyroZ, 2);
  
  Serial.print("Angles: X=");
  Serial.print(angleX, 2);
  Serial.print("° Y=");
  Serial.print(angleY, 2);
  Serial.println("°");
  
  Serial.print("MPU Temp: ");
  Serial.print(temperature, 2);
  Serial.println(" °C");
  
  // Ultrasonic
  Serial.println("\n--- Ultrasonic (4 Sensors) ---");
  Serial.print("Front: ");
  Serial.print(distanceFront, 1);
  Serial.print(" cm | Back: ");
  Serial.print(distanceBack, 1);
  Serial.println(" cm");
  Serial.print("Left: ");
  Serial.print(distanceLeft, 1);
  Serial.print(" cm | Right: ");
  Serial.print(distanceRight, 1);
  Serial.println(" cm");
  
  // Motor status
  Serial.println("\n--- Motors ---");
  Serial.print("Left Speed: ");
  Serial.print(motorLeftSpeed);
  Serial.print(" | Right Speed: ");
  Serial.println(motorRightSpeed);
  
  // Feeding system status
  Serial.println("\n--- Feeding System ---");
  Serial.print("Feed Motor: ");
  Serial.print(feedMotorEnabled ? "ON" : "OFF");
  Serial.print(" | Speed: ");
  Serial.println(feedMotorSpeed);
  Serial.print("Stepper: ");
  Serial.print(stepperEnabled ? "ENABLED" : "DISABLED");
  Serial.print(" | Position: ");
  Serial.println(stepperPosition);
  
  Serial.println("=====================================");
}
