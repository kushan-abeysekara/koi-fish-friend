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
#define HX711_DOUT_PIN 16      // HX711 DOUT
#define HX711_SCK_PIN 17       // HX711 SCK

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
#define ULTRASONIC_BACK_ECHO 0    // GPIO 5 not available, using GPIO 0
#define ULTRASONIC_LEFT_TRIG 4
#define ULTRASONIC_LEFT_ECHO 15
#define ULTRASONIC_RIGHT_TRIG 2
#define ULTRASONIC_RIGHT_ECHO 12

// DS3231 RTC (I2C)
// SDA -> GPIO 21
// SCL -> GPIO 22

// RESERVED FOR FUTURE WiFi/MQTT
// Note: WiFi uses internal pins (no external connection needed)
// Reserved for MQTT/Additional features: GPIO 36, GPIO 39
// Note: GPIO 5 is NOT available on ESP32 38-pin board

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
  
  // Ultrasonic pins (4 sensors)
  pinMode(ULTRASONIC_FRONT_TRIG, OUTPUT);
  pinMode(ULTRASONIC_FRONT_ECHO, INPUT);
  pinMode(ULTRASONIC_BACK_TRIG, OUTPUT);
  pinMode(ULTRASONIC_BACK_ECHO, INPUT);
  pinMode(ULTRASONIC_LEFT_TRIG, OUTPUT);
  pinMode(ULTRASONIC_LEFT_ECHO, INPUT);
  pinMode(ULTRASONIC_RIGHT_TRIG, OUTPUT);
  pinMode(ULTRASONIC_RIGHT_ECHO, INPUT);
  
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
  distanceBack = getDistance(ULTRASONIC_BACK_TRIG, ULTRASONIC_BACK_ECHO);
  distanceLeft = getDistance(ULTRASONIC_LEFT_TRIG, ULTRASONIC_LEFT_ECHO);
  distanceRight = getDistance(ULTRASONIC_RIGHT_TRIG, ULTRASONIC_RIGHT_ECHO);
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
  
  Serial.println("=====================================");
}
