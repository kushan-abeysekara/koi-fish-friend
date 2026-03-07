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
#include <WiFi.h>
#include <PubSubClient.h>
#include <WebSocketsServer.h>  // Hybrid: Local WebSocket for same network
#include <ArduinoJson.h>       // JSON parsing for both MQTT and WebSocket

// ==================== PIN DEFINITIONS ====================

// Voltage Sensor
#define VOLTAGE_SENSOR_PIN 34  // Analog pin for voltage sensor

// Relay Module
#define RELAY_PIN 13           // G13 for relay control

// MPU-6050 (I2C)
// SDA -> GPIO 21
// SCL -> GPIO 22

// L298N Motor Driver - New Pin Configuration
// Motor A (Left)
#define MOTOR_LEFT_IN1 26   // IN1
#define MOTOR_LEFT_IN2 4    // IN2
#define MOTOR_LEFT_EN 27    // ENA

// Motor B (Right)
#define MOTOR_RIGHT_IN1 2   // IN3
#define MOTOR_RIGHT_IN2 32  // IN4
#define MOTOR_RIGHT_EN 33   // ENB

// Motor Direction Inversion (set to true if motor is mounted backwards)
#define INVERT_LEFT_MOTOR false   // Set to true if left motor rotates wrong direction
#define INVERT_RIGHT_MOTOR true   // Set to true if right motor rotates wrong direction

// LEDC PWM Configuration (ESP32 3.x API)
#define PWM_FREQ 5000
#define PWM_RESOLUTION 8

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
#define OLED_RESET -1   // RES pin connected to GND

// ==================== CONSTANTS ====================

#define VOLTAGE_THRESHOLD 5.5       // Voltage threshold for relay
#define VOLTAGE_DIVIDER_RATIO 7.0   // Adjust based on your voltage divider
#define OBSTACLE_DISTANCE_CM 30     // Obstacle detection distance
#define BALANCE_ANGLE_THRESHOLD 15  // Angle threshold for balance control

// WiFi Credentials
const char* ssid = "KoiFishFriend";
const char* password = "FiberTarget255";

// MQTT Configuration - Self-hosted EMQX on VPS
const char* mqtt_server = "187.77.189.5";
const int mqtt_port = 1883;
const char* mqtt_topic_command = "koifish/boat/command";
const char* mqtt_topic_status = "koifish/boat/status";
const char* mqtt_topic_sensor = "koifish/boat/sensor";
String deviceId = "BOAT_ESP32_001";

// ==================== GLOBAL OBJECTS ====================

MPU6050 mpu;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, OLED_MOSI, OLED_CLK, 
                         OLED_DC, OLED_RESET, OLED_CS);

WiFiClient espClient;
PubSubClient mqttClient(espClient);
WebSocketsServer wsServer(81);  // WebSocket on port 81 for local direct communication

// Hybrid Communication Stats
int wsConnectedClients = 0;
bool mqttConnected = false;
String lastCommandSource = "none";  // "mqtt" or "websocket"
unsigned long lastWiFiCheck = 0;
const unsigned long WIFI_CHECK_INTERVAL = 5000;  // Check WiFi every 5 seconds

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

// Control mode
bool autoMode = false;  // false = manual MQTT control, true = auto obstacle avoidance
int remoteSpeed = 150;  // Speed from remote control (0-255) - default 150 for good motor response
String currentCommand = "STOP";

// Connection & Safety
unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 1000; // Send heartbeat every 1 second
int reconnectAttempts = 0;
const int MAX_RECONNECT_ATTEMPTS = 3;  // Reduced for faster failover

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
  
  // Configure GPIO 2 safely (set LOW at boot)
  pinMode(MOTOR_RIGHT_IN1, OUTPUT);
  digitalWrite(MOTOR_RIGHT_IN1, LOW);
  
  // Initialize I2C
  Wire.begin(21, 22);
  
  // Initialize pins
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  
  pinMode(VOLTAGE_SENSOR_PIN, INPUT);
  
  // Motor pins
  pinMode(MOTOR_LEFT_IN1, OUTPUT);
  pinMode(MOTOR_LEFT_IN2, OUTPUT);
  pinMode(MOTOR_RIGHT_IN1, OUTPUT);
  pinMode(MOTOR_RIGHT_IN2, OUTPUT);
  
  // Initialize all motor pins to LOW
  digitalWrite(MOTOR_LEFT_IN1, LOW);
  digitalWrite(MOTOR_LEFT_IN2, LOW);
  digitalWrite(MOTOR_RIGHT_IN1, LOW);
  digitalWrite(MOTOR_RIGHT_IN2, LOW);
  
  // Setup LEDC PWM for motor speed control (ESP32 3.x API)
  ledcAttach(MOTOR_LEFT_EN, PWM_FREQ, PWM_RESOLUTION);
  ledcAttach(MOTOR_RIGHT_EN, PWM_FREQ, PWM_RESOLUTION);
  
  Serial.println("Motor PWM initialized (LEDC)");
  
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
  
  // Connect to WiFi
  connectWiFi();
  
  // Setup MQTT with optimized settings
  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setKeepAlive(15);  // Faster keepalive for quick disconnection detection
  mqttClient.setSocketTimeout(5);  // 5 second socket timeout
  
  // Setup WebSocket server for hybrid local communication
  wsServer.begin();
  wsServer.onEvent(webSocketEvent);
  Serial.println("✓ WebSocket server started on port 81");
  Serial.print("  Local access: ws://");
  Serial.println(WiFi.localIP());
  
  // Initialize safety timers
  lastHeartbeat = millis();
  lastWiFiCheck = millis();
  
  Serial.println("Initialization complete!");
  Serial.println("Mode: Continuous movement - no watchdog");
  Serial.println("Hybrid Mode: MQTT + WebSocket (local network)");
  Serial.println("========================================");
}

// ==================== MAIN LOOP ====================

void loop() {
  unsigned long currentMillis = millis();
  
  // WebSocket server loop - handle local connections
  wsServer.loop();
  
  // Maintain WiFi connection with periodic checks
  if (currentMillis - lastWiFiCheck >= WIFI_CHECK_INTERVAL) {
    lastWiFiCheck = currentMillis;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("⚠️ WiFi disconnected! Reconnecting...");
      connectWiFi();
      mqttConnected = false;
    }
  }
  
  // Maintain MQTT connection
  if (!mqttClient.connected()) {
    mqttConnected = false;
    reconnectMQTT();
  } else {
    mqttConnected = true;
    reconnectAttempts = 0;  // Reset on successful connection
  }
  mqttClient.loop();
  
  // Send heartbeat to frontend
  if (currentMillis - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    lastHeartbeat = currentMillis;
    publishHeartbeat();
  }
  
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
    publishSensorData();        // MQTT publishing
    broadcastSensorDataWS();    // WebSocket broadcasting (hybrid)
  }
  
  // Control relay based on voltage
  controlRelay();
  
  // Auto mode: balance and obstacle avoidance (only if connected)
  if (autoMode && mqttConnected) {
    balanceControl();
    obstacleAvoidance();
  }
  // Manual mode is handled via MQTT commands
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

void setMotorSpeed(int in1, int in2, int enPin, int speed) {
  Serial.print("setMotorSpeed - IN1:");
  Serial.print(in1);
  Serial.print(" IN2:");
  Serial.print(in2);
  Serial.print(" EN:");
  Serial.print(enPin);
  Serial.print(" Speed:");
  Serial.println(speed);
  
  if (speed > 0) {
    // Forward
    digitalWrite(in1, HIGH);
    digitalWrite(in2, LOW);
    ledcWrite(enPin, abs(speed));
    Serial.println("  -> Direction: FORWARD");
  } else if (speed < 0) {
    // Backward
    digitalWrite(in1, LOW);
    digitalWrite(in2, HIGH);
    ledcWrite(enPin, abs(speed));
    Serial.println("  -> Direction: BACKWARD");
  } else {
    // Stop
    digitalWrite(in1, LOW);
    digitalWrite(in2, LOW);
    ledcWrite(enPin, 0);
    Serial.println("  -> Direction: STOP");
  }
}

void moveForward(int speed) {
  motorLeftSpeed = speed;
  motorRightSpeed = speed;
  // Apply motor inversion if needed
  int leftSpeed = INVERT_LEFT_MOTOR ? -speed : speed;
  int rightSpeed = INVERT_RIGHT_MOTOR ? -speed : speed;
  setMotorSpeed(MOTOR_LEFT_IN1, MOTOR_LEFT_IN2, MOTOR_LEFT_EN, leftSpeed);
  setMotorSpeed(MOTOR_RIGHT_IN1, MOTOR_RIGHT_IN2, MOTOR_RIGHT_EN, rightSpeed);
  currentCommand = "FORWARD";
  Serial.print("Moving FORWARD at speed: ");
  Serial.println(speed);
}

void moveBackward(int speed) {
  motorLeftSpeed = -speed;
  motorRightSpeed = -speed;
  // Apply motor inversion if needed
  int leftSpeed = INVERT_LEFT_MOTOR ? speed : -speed;
  int rightSpeed = INVERT_RIGHT_MOTOR ? speed : -speed;
  setMotorSpeed(MOTOR_LEFT_IN1, MOTOR_LEFT_IN2, MOTOR_LEFT_EN, leftSpeed);
  setMotorSpeed(MOTOR_RIGHT_IN1, MOTOR_RIGHT_IN2, MOTOR_RIGHT_EN, rightSpeed);
  currentCommand = "BACKWARD";
  Serial.print("Moving BACKWARD at speed: ");
  Serial.println(speed);
}

void turnLeft() {
  int speed = remoteSpeed;  // Use full speed for turning
  motorLeftSpeed = -speed;
  motorRightSpeed = speed;
  // Apply motor inversion if needed
  int leftSpeed = INVERT_LEFT_MOTOR ? speed : -speed;
  int rightSpeed = INVERT_RIGHT_MOTOR ? -speed : speed;
  setMotorSpeed(MOTOR_LEFT_IN1, MOTOR_LEFT_IN2, MOTOR_LEFT_EN, leftSpeed);
  setMotorSpeed(MOTOR_RIGHT_IN1, MOTOR_RIGHT_IN2, MOTOR_RIGHT_EN, rightSpeed);
  currentCommand = "LEFT";
}

void turnRight() {
  int speed = remoteSpeed;  // Use full speed for turning
  motorLeftSpeed = speed;
  motorRightSpeed = -speed;
  // Apply motor inversion if needed
  int leftSpeed = INVERT_LEFT_MOTOR ? -speed : speed;
  int rightSpeed = INVERT_RIGHT_MOTOR ? speed : -speed;
  setMotorSpeed(MOTOR_LEFT_IN1, MOTOR_LEFT_IN2, MOTOR_LEFT_EN, leftSpeed);
  setMotorSpeed(MOTOR_RIGHT_IN1, MOTOR_RIGHT_IN2, MOTOR_RIGHT_EN, rightSpeed);
  currentCommand = "RIGHT";
}

void moveLeftOnly() {
  int speed = remoteSpeed;
  motorLeftSpeed = speed;
  motorRightSpeed = 0;
  // Apply motor inversion if needed
  int leftSpeed = INVERT_LEFT_MOTOR ? -speed : speed;
  setMotorSpeed(MOTOR_LEFT_IN1, MOTOR_LEFT_IN2, MOTOR_LEFT_EN, leftSpeed);
  setMotorSpeed(MOTOR_RIGHT_IN1, MOTOR_RIGHT_IN2, MOTOR_RIGHT_EN, 0);
  currentCommand = "LEFT_ONLY";
  Serial.print("Moving LEFT MOTOR ONLY at speed: ");
  Serial.println(speed);
}

void moveRightOnly() {
  int speed = remoteSpeed;
  motorLeftSpeed = 0;
  motorRightSpeed = speed;
  // Apply motor inversion if needed
  int rightSpeed = INVERT_RIGHT_MOTOR ? -speed : speed;
  setMotorSpeed(MOTOR_LEFT_IN1, MOTOR_LEFT_IN2, MOTOR_LEFT_EN, 0);
  setMotorSpeed(MOTOR_RIGHT_IN1, MOTOR_RIGHT_IN2, MOTOR_RIGHT_EN, rightSpeed);
  currentCommand = "RIGHT_ONLY";
  Serial.print("Moving RIGHT MOTOR ONLY at speed: ");
  Serial.println(speed);
}

void stopMotors() {
  motorLeftSpeed = 0;
  motorRightSpeed = 0;
  setMotorSpeed(MOTOR_LEFT_IN1, MOTOR_LEFT_IN2, MOTOR_LEFT_EN, 0);
  setMotorSpeed(MOTOR_RIGHT_IN1, MOTOR_RIGHT_IN2, MOTOR_RIGHT_EN, 0);
  currentCommand = "STOP";
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

// ==================== WIFI FUNCTIONS ====================

void connectWiFi() {
  Serial.println("\nConnecting to WiFi...");
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n✗ WiFi Connection Failed");
  }
}

// ==================== MQTT FUNCTIONS ====================

void reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  // Don't retry too many times - prevent blocking
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    Serial.println("⚠️ Max reconnect attempts reached. Waiting...");
    delay(5000);
    reconnectAttempts = 0;
    return;
  }
  
  if (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT (attempt ");
    Serial.print(reconnectAttempts + 1);
    Serial.print("/");
    Serial.print(MAX_RECONNECT_ATTEMPTS);
    Serial.print(")...");
    
    String clientId = "ESP32Boat_" + String(random(0xffff), HEX);
    
    // Use clean session and last will for disconnect detection
    if (mqttClient.connect(clientId.c_str(), NULL, NULL, mqtt_topic_status, 0, true, "{\"status\":\"offline\"}")) {
      Serial.println(" ✓ Connected!");
      mqttClient.subscribe(mqtt_topic_command, 0); // QoS 0 for fastest delivery
      Serial.print("Subscribed to: ");
      Serial.println(mqtt_topic_command);
      
      // Publish online status
      String statusMsg = "{\"deviceId\":\"" + deviceId + "\",\"status\":\"online\",\"mode\":\"" + (autoMode ? "auto" : "manual") + "\",\"rssi\":" + String(WiFi.RSSI()) + "}";
      mqttClient.publish(mqtt_topic_status, statusMsg.c_str(), true);  // Retain status
      
      mqttConnected = true;
      reconnectAttempts = 0;
    } else {
      Serial.print(" ✗ Failed, rc=");
      Serial.println(mqttClient.state());
      reconnectAttempts++;
      
      // Exponential backoff: 500ms, 1s, 2s, 4s, 8s
      int backoffDelay = min(500 * (1 << reconnectAttempts), 8000);
      delay(backoffDelay);
      mqttConnected = false;
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.print("📨 MQTT: ");
  Serial.println(message);
  
  // Mark command source
  lastCommandSource = "mqtt";
  
  // Use unified command processor
  processCommand(message);
}

void extractSpeed(String message) {
  int speedIndex = message.indexOf("\"speed\":");
  if (speedIndex > -1) {
    int startIndex = speedIndex + 8;
    int endIndex = message.indexOf(",", startIndex);
    if (endIndex == -1) endIndex = message.indexOf("}", startIndex);
    
    String speedStr = message.substring(startIndex, endIndex);
    int speed = speedStr.toInt();
    if (speed >= 0 && speed <= 255) {
      // Enforce minimum speed of 100 to ensure motors rotate
      remoteSpeed = (speed > 0 && speed < 100) ? 100 : speed;
      Serial.print("Speed set to: ");
      Serial.println(remoteSpeed);
    }
  }
}

void publishHeartbeat() {
  if (!mqttClient.connected()) return;
  
  // Send lightweight heartbeat with connection quality
  String heartbeat = "{";
  heartbeat += "\"deviceId\":\"" + deviceId + "\",";
  heartbeat += "\"type\":\"heartbeat\",";
  heartbeat += "\"timestamp\":" + String(millis()) + ",";
  heartbeat += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  heartbeat += "\"connected\":true,";
  heartbeat += "\"uptime\":" + String(millis() / 1000);
  heartbeat += "}";
  
  mqttClient.publish(mqtt_topic_status, heartbeat.c_str());
}

void publishSensorData() {
  if (!mqttClient.connected()) return;
  
  // Create JSON sensor data with connection info
  String sensorData = "{";
  sensorData += "\"deviceId\":\"" + deviceId + "\",";
  sensorData += "\"voltage\":" + String(voltage, 2) + ",";
  sensorData += "\"distanceFront\":" + String(distanceFront, 1) + ",";
  sensorData += "\"distanceBack\":" + String(distanceBack, 1) + ",";
  sensorData += "\"distanceLeft\":" + String(distanceLeft, 1) + ",";
  sensorData += "\"distanceRight\":" + String(distanceRight, 1) + ",";
  sensorData += "\"angleX\":" + String(angleX, 2) + ",";
  sensorData += "\"angleY\":" + String(angleY, 2) + ",";
  sensorData += "\"temperature\":" + String(temperature, 2) + ",";
  sensorData += "\"motorLeft\":" + String(motorLeftSpeed) + ",";
  sensorData += "\"motorRight\":" + String(motorRightSpeed) + ",";
  sensorData += "\"command\":\"" + currentCommand + "\",";
  sensorData += "\"mode\":\"" + String(autoMode ? "auto" : "manual") + "\",";
  sensorData += "\"connected\":" + String(mqttConnected ? "true" : "false") + ",";
  sensorData += "\"rssi\":" + String(WiFi.RSSI());
  sensorData += "}";
  
  mqttClient.publish(mqtt_topic_sensor, sensorData.c_str());
}

// ==================== WEBSOCKET FUNCTIONS (HYBRID MODE) ====================

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.printf("[WS] Client #%u disconnected\n", num);
      wsConnectedClients = max(0, wsConnectedClients - 1);
      Serial.printf("[WS] Active clients: %d\n", wsConnectedClients);
      break;
      
    case WStype_CONNECTED: {
      IPAddress ip = wsServer.remoteIP(num);
      Serial.printf("[WS] Client #%u connected from %d.%d.%d.%d\n", num, ip[0], ip[1], ip[2], ip[3]);
      wsConnectedClients++;
      Serial.printf("[WS] Active clients: %d\n", wsConnectedClients);
      
      // Send initial status
      String status = "{\"status\":\"connected\",\"ip\":\"" + WiFi.localIP().toString() + "\",\"mode\":\"hybrid\"}";
      wsServer.sendTXT(num, status);
      break;
    }
      
    case WStype_TEXT: {
      String message = String((char*)payload);
      Serial.printf("[WS] Command from #%u: %s\n", num, message.c_str());
      
      // Mark command source
      lastCommandSource = "websocket";
      
      // Process command (same format as MQTT)
      processCommand(message);
      
      // Send acknowledgment
      String ack = "{\"ack\":true,\"command\":\"" + currentCommand + "\"}";
      wsServer.sendTXT(num, ack);
      break;
    }
      
    case WStype_BIN:
    case WStype_ERROR:
    case WStype_FRAGMENT_TEXT_START:
    case WStype_FRAGMENT_BIN_START:
    case WStype_FRAGMENT:
    case WStype_FRAGMENT_FIN:
      break;
  }
}

// Unified command processor for both MQTT and WebSocket
void processCommand(String message) {
  // Parse JSON command: {"command":"FORWARD","speed":128}
  if (message.indexOf("HEARTBEAT") > -1) {
    // Just a keepalive ping - update timer only
    Serial.println("💓 Heartbeat [" + lastCommandSource + "]");
  } else if (message.indexOf("FORWARD") > -1) {
    autoMode = false;
    extractSpeed(message);
    moveForward(remoteSpeed);
  } else if (message.indexOf("BACKWARD") > -1) {
    autoMode = false;
    extractSpeed(message);
    moveBackward(remoteSpeed);
  } else if (message.indexOf("LEFT_ONLY") > -1) {
    autoMode = false;
    extractSpeed(message);
    moveLeftOnly();
  } else if (message.indexOf("RIGHT_ONLY") > -1) {
    autoMode = false;
    extractSpeed(message);
    moveRightOnly();
  } else if (message.indexOf("LEFT") > -1) {
    autoMode = false;
    extractSpeed(message);
    turnLeft();
  } else if (message.indexOf("RIGHT") > -1) {
    autoMode = false;
    extractSpeed(message);
    turnRight();
  } else if (message.indexOf("STOP") > -1) {
    autoMode = false;
    stopMotors();
  } else if (message.indexOf("AUTO") > -1) {
    autoMode = true;
    Serial.println("🤖 Auto mode enabled [" + lastCommandSource + "]");
  } else if (message.indexOf("MANUAL") > -1) {
    autoMode = false;
    stopMotors();
    Serial.println("🎮 Manual mode enabled [" + lastCommandSource + "]");
  }
}

// Broadcast sensor data to all WebSocket clients
void broadcastSensorDataWS() {
  if (wsConnectedClients == 0) return;
  
  // Create JSON sensor data
  StaticJsonDocument<512> doc;
  doc["deviceId"] = deviceId;
  doc["voltage"] = round(voltage * 100) / 100.0;
  doc["distanceFront"] = round(distanceFront * 10) / 10.0;
  doc["distanceBack"] = round(distanceBack * 10) / 10.0;
  doc["distanceLeft"] = round(distanceLeft * 10) / 10.0;
  doc["distanceRight"] = round(distanceRight * 10) / 10.0;
  doc["angleX"] = round(angleX * 100) / 100.0;
  doc["angleY"] = round(angleY * 100) / 100.0;
  doc["temperature"] = round(temperature * 100) / 100.0;
  doc["motorLeft"] = motorLeftSpeed;
  doc["motorRight"] = motorRightSpeed;
  doc["command"] = currentCommand;
  doc["mode"] = autoMode ? "auto" : "manual";
  doc["connected"] = true;
  doc["rssi"] = WiFi.RSSI();
  doc["wsClients"] = wsConnectedClients;
  doc["source"] = lastCommandSource;
  
  String output;
  serializeJson(doc, output);
  wsServer.broadcastTXT(output);
}

