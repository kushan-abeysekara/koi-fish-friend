/*
 * Koi Fish Friend - ESP32 Boat Control System
 * Board: ZY-ESP32 WIFI BT 38 PIN BOARD
 * 
 * Features:
 * - Voltage monitoring with relay control
 * - Motion detection and balance control using MPU-6050
 * - Dual motor control using L298N
 * - Obstacle detection using 4x HC-SR04 ultrasonic sensors
 * - OLED display for real-time monitoring
 * 
 * Author: Koi Fish Friend Team
 * Date: December 22, 2025
 */

#include <Wire.h>
#include <MPU6050.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ==================== PIN DEFINITIONS ====================

// Voltage Sensor
#define VOLTAGE_SENSOR_PIN 34  // Analog pin for voltage sensor

// Relay Module
#define RELAY_PIN 13           // G13 for relay control

// MPU-6050 (I2C)
// SDA -> GPIO 21
// SCL -> GPIO 22

// L298N Motor Driver
#define MOTOR_LEFT_IN1 26
#define MOTOR_LEFT_IN2 14
#define MOTOR_LEFT_EN 27

#define MOTOR_RIGHT_IN1 32
#define MOTOR_RIGHT_IN2 33
#define MOTOR_RIGHT_EN 33

// HC-SR04 Ultrasonic Sensors (4 units)
// Left sensor relocated to GPIO 25, 39 (previous pins 2, 36 had hardware issues)
#define ULTRASONIC_FRONT_TRIG 18
#define ULTRASONIC_FRONT_ECHO 19
#define ULTRASONIC_BACK_TRIG 0
#define ULTRASONIC_BACK_ECHO 35
#define ULTRASONIC_LEFT_TRIG 25  
#define ULTRASONIC_LEFT_ECHO 39  
#define ULTRASONIC_RIGHT_TRIG 15 
#define ULTRASONIC_RIGHT_ECHO 12

// OLED Display 0.96" SSD1306 (SPI Mode)
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_MOSI 17    // D1 pin (MOSI)
#define OLED_CLK 16     // D0 pin (SCK)
#define OLED_DC 5       // DC pin
#define OLED_CS 23      // CS pin
#define OLED_RESET 4    // RES pin - using GPIO 4 temporarily

// ==================== CONSTANTS ====================

#define VOLTAGE_THRESHOLD 8.5       // Voltage threshold for relay
#define VOLTAGE_DIVIDER_RATIO 5.0   // Adjust based on your voltage divider
#define OBSTACLE_DISTANCE_CM 30     // Obstacle detection distance
#define BALANCE_ANGLE_THRESHOLD 15  // Angle threshold for balance control

// ==================== GLOBAL OBJECTS ====================

MPU6050 mpu;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, OLED_MOSI, OLED_CLK, 
                         OLED_DC, OLED_RESET, OLED_CS);

// ==================== GLOBAL VARIABLES ====================

float voltage = 0.0;

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
unsigned long lastDisplayUpdate = 0;
const unsigned long SENSOR_READ_INTERVAL = 100;   // 100ms
const unsigned long DISPLAY_UPDATE_INTERVAL = 500; // 500ms

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
  
  // Initialize MPU-6050
  Serial.println("Initializing MPU-6050...");
  mpu.initialize();
  if (mpu.testConnection()) {
    Serial.println("MPU-6050 connection successful!");
  } else {
    Serial.println("MPU-6050 connection failed!");
  }
  
  // Initialize OLED with detailed diagnostics
  Serial.println("Initializing OLED Display (SPI Mode)...");
  Serial.print("OLED Pins - MOSI:");
  Serial.print(OLED_MOSI);
  Serial.print(" CLK:");
  Serial.print(OLED_CLK);
  Serial.print(" DC:");
  Serial.print(OLED_DC);
  Serial.print(" CS:");
  Serial.print(OLED_CS);
  Serial.print(" RESET:");
  Serial.println(OLED_RESET);
  
  // Manual reset pulse
  pinMode(OLED_RESET, OUTPUT);
  digitalWrite(OLED_RESET, HIGH);
  delay(10);
  digitalWrite(OLED_RESET, LOW);
  delay(10);
  digitalWrite(OLED_RESET, HIGH);
  delay(10);
  Serial.println("Reset pulse sent to OLED");
  
  // Try to initialize
  bool oledOK = display.begin();
  Serial.print("Display.begin() returned: ");
  Serial.println(oledOK ? "SUCCESS" : "FAILED");
  
  if(!oledOK) {
    Serial.println("⚠️ SSD1306 allocation failed!");
    Serial.println("Troubleshooting:");
    Serial.println("1. Check if OLED needs 5V power (not 3.3V)");
    Serial.println("2. Verify all SPI connections");
    Serial.println("3. Try connecting RES to GPIO 4");
    Serial.println("4. Check if display is SPI or I2C mode");
  } else {
    Serial.println("✓ OLED initialized successfully!");
    display.clearDisplay();
    display.setTextSize(2);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("KOI FISH");
    display.println("FRIEND");
    display.setTextSize(1);
    display.println("");
    display.println("ESP32 System");
    display.println("Ready!");
    display.display();
    Serial.println("✓ Splash screen displayed");
    delay(3000);
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
    readMPU6050();
    readUltrasonicSensors();
  }
  
  // Update display and serial output
  if (currentMillis - lastDisplayUpdate >= DISPLAY_UPDATE_INTERVAL) {
    lastDisplayUpdate = currentMillis;
    printSensorData();
    updateDisplay();
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

// ==================== CONTROL FUNCTIONS ====================

void controlRelay() {
  if (voltage < VOLTAGE_THRESHOLD) {
    digitalWrite(RELAY_PIN, LOW);   // Turn off relay (cut power - low voltage)
  } else {
    digitalWrite(RELAY_PIN, HIGH);  // Turn on relay (power on - voltage OK)
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

void updateDisplay() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  // Line 1: Title
  display.setCursor(0, 0);
  display.println("Koi Fish Friend");
  
  // Line 2: Voltage
  display.setCursor(0, 10);
  display.print("V:");
  display.print(voltage, 1);
  display.print("V ");
  display.print(voltage < VOLTAGE_THRESHOLD ? "OFF" : "ON");
  
  // Line 3: MPU Acceleration (X, Y, Z on one line)
  display.setCursor(0, 20);
  display.print("A:");
  display.print(accelX, 1);
  display.print(" ");
  display.print(accelY, 1);
  display.print(" ");
  display.print(accelZ, 1);
  
  // Line 4: MPU Gyro (X, Y, Z on one line)
  display.setCursor(0, 30);
  display.print("G:");
  display.print(gyroX, 0);
  display.print(" ");
  display.print(gyroY, 0);
  display.print(" ");
  display.print(gyroZ, 0);
  
  // Line 5: Angles (X, Y on one line)
  display.setCursor(0, 40);
  display.print("Angle:");
  display.print(angleX, 0);
  display.print(" ");
  display.print(angleY, 0);
  
  // Line 6: Distances
  display.setCursor(0, 50);
  display.print("F:");
  display.print(distanceFront, 0);
  display.print(" B:");
  display.print(distanceBack, 0);
  display.print(" L:");
  display.print(distanceLeft, 0);
  display.print(" R:");
  display.print(distanceRight, 0);
  
  // Line 7: Motor speeds
  display.setCursor(0, 56);
  display.print("M:");
  display.print(motorLeftSpeed);
  display.print(",");
  display.print(motorRightSpeed);
  
  display.display();
}

void printSensorData() {
  Serial.println("\n========== Sensor Readings ==========");
  
  // Voltage
  Serial.print("Voltage: ");
  Serial.print(voltage, 2);
  Serial.print(" V | Relay: ");
  Serial.println(voltage < VOLTAGE_THRESHOLD ? "OFF (Low Battery)" : "ON (Power OK)");
  
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
