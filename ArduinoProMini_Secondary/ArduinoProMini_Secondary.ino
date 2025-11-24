/*
 * Koi Fish Friend - Arduino Pro Mini Secondary Controller
 * Handles: OLED Display, Back Ultrasonic, Feeding Motor, Stepper
 * Communication: I2C Slave (Address 0x08)
 * 
 * Author: Koi Fish Friend Team
 * Date: November 24, 2025
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Servo.h>

// ==================== PIN DEFINITIONS ====================

// OLED Display (SPI)
#define OLED_MOSI 10
#define OLED_CLK 9
#define OLED_DC 8
#define OLED_CS 7
#define OLED_RESET -1

// HC-SR04 Back Ultrasonic
#define ULTRASONIC_BACK_TRIG 2
#define ULTRASONIC_BACK_ECHO 3

// Feeding Motor ESC
#define FEED_MOTOR_PIN 6

// Stepper Motor Driver
#define STEPPER_STEP 4
#define STEPPER_DIR 5
// EN pin not used (connect to GND to enable)

// I2C Slave Address
#define I2C_ADDRESS 0x08

// ==================== OLED Setup ====================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, OLED_MOSI, OLED_CLK, 
                         OLED_DC, OLED_RESET, OLED_CS);

// ==================== OBJECTS ====================
Servo feedMotor;

// ==================== GLOBAL VARIABLES ====================
float backDistance = 0.0;
int feedMotorSpeed = 0;
long stepperPosition = 0;
bool stepperDirection = true;

// Data from ESP32
String displayLine1 = "Koi Fish Friend";
String displayLine2 = "Initializing...";
String displayLine3 = "";
String displayLine4 = "";

// I2C command buffer
#define BUFFER_SIZE 64
char i2cBuffer[BUFFER_SIZE];
int bufferIndex = 0;

// ==================== SETUP ====================

void setup() {
  Serial.begin(115200);
  Serial.println("Arduino Pro Mini - Secondary Controller");
  
  // Initialize I2C as slave
  Wire.begin(I2C_ADDRESS);
  Wire.onReceive(receiveEvent);
  Wire.onRequest(requestEvent);
  Serial.println("I2C Slave initialized at address 0x08");
  
  // Initialize OLED
  if(!display.begin(SSD1306_SWITCHCAPVCC)) {
    Serial.println("SSD1306 allocation failed!");
  } else {
    Serial.println("OLED initialized!");
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("Koi Fish Friend");
    display.println("Arduino Pro Mini");
    display.println("I2C Slave: 0x08");
    display.display();
  }
  
  // Initialize ultrasonic
  pinMode(ULTRASONIC_BACK_TRIG, OUTPUT);
  pinMode(ULTRASONIC_BACK_ECHO, INPUT);
  Serial.println("Back ultrasonic initialized");
  
  // Initialize feeding motor
  feedMotor.attach(FEED_MOTOR_PIN);
  feedMotor.write(0);  // Stop
  Serial.println("Feeding motor initialized");
  
  // Initialize stepper
  pinMode(STEPPER_STEP, OUTPUT);
  pinMode(STEPPER_DIR, OUTPUT);
  digitalWrite(STEPPER_STEP, LOW);
  digitalWrite(STEPPER_DIR, LOW);
  Serial.println("Stepper motor initialized");
  
  Serial.println("Initialization complete!");
}

// ==================== MAIN LOOP ====================

void loop() {
  // Read back ultrasonic sensor
  backDistance = readUltrasonic();
  
  // Update OLED display
  updateDisplay();
  
  delay(100);  // 10Hz update rate
}

// ==================== SENSOR FUNCTIONS ====================

float readUltrasonic() {
  digitalWrite(ULTRASONIC_BACK_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(ULTRASONIC_BACK_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_BACK_TRIG, LOW);
  
  long duration = pulseIn(ULTRASONIC_BACK_ECHO, HIGH, 30000);
  float distance = (duration * 0.034) / 2.0;
  
  return distance;
}

// ==================== DISPLAY FUNCTIONS ====================

void updateDisplay() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  // Line 1
  display.setCursor(0, 0);
  display.println(displayLine1);
  
  // Line 2
  display.setCursor(0, 10);
  display.println(displayLine2);
  
  // Line 3
  display.setCursor(0, 20);
  display.println(displayLine3);
  
  // Line 4
  display.setCursor(0, 30);
  display.println(displayLine4);
  
  // Back distance
  display.setCursor(0, 40);
  display.print("Back: ");
  display.print(backDistance, 1);
  display.println(" cm");
  
  // Feed motor status
  display.setCursor(0, 50);
  display.print("Feed: ");
  display.print(feedMotorSpeed);
  
  display.display();
}

// ==================== I2C COMMUNICATION ====================

// Receive data from ESP32
void receiveEvent(int howMany) {
  bufferIndex = 0;
  
  while (Wire.available() && bufferIndex < BUFFER_SIZE - 1) {
    i2cBuffer[bufferIndex++] = Wire.read();
  }
  i2cBuffer[bufferIndex] = '\0';  // Null terminate
  
  // Parse command
  parseCommand(i2cBuffer);
}

// Send data to ESP32
void requestEvent() {
  // Send back distance as 2-byte integer (cm * 10)
  int distanceInt = (int)(backDistance * 10);
  byte data[2];
  data[0] = (distanceInt >> 8) & 0xFF;  // High byte
  data[1] = distanceInt & 0xFF;         // Low byte
  
  Wire.write(data, 2);
}

// ==================== COMMAND PARSER ====================

void parseCommand(char* cmd) {
  // Command format: "CMD:VALUE"
  // Examples:
  // "FEED:90" - Set feed motor to 90 degrees
  // "STEP:100" - Step 100 steps forward
  // "DIR:1" - Set stepper direction (1=forward, 0=backward)
  // "DISP1:Hello" - Set display line 1
  
  char* colonPos = strchr(cmd, ':');
  if (colonPos == NULL) return;
  
  *colonPos = '\0';  // Split at colon
  char* command = cmd;
  char* value = colonPos + 1;
  
  // Process commands
  if (strcmp(command, "FEED") == 0) {
    feedMotorSpeed = atoi(value);
    feedMotorSpeed = constrain(feedMotorSpeed, 0, 180);
    feedMotor.write(feedMotorSpeed);
    Serial.print("Feed motor set to: ");
    Serial.println(feedMotorSpeed);
  }
  else if (strcmp(command, "STEP") == 0) {
    int steps = atoi(value);
    stepMotor(steps);
    Serial.print("Stepped: ");
    Serial.println(steps);
  }
  else if (strcmp(command, "DIR") == 0) {
    stepperDirection = (atoi(value) == 1);
    digitalWrite(STEPPER_DIR, stepperDirection ? HIGH : LOW);
    Serial.print("Stepper direction: ");
    Serial.println(stepperDirection ? "Forward" : "Backward");
  }
  else if (strcmp(command, "DISP1") == 0) {
    displayLine1 = String(value);
  }
  else if (strcmp(command, "DISP2") == 0) {
    displayLine2 = String(value);
  }
  else if (strcmp(command, "DISP3") == 0) {
    displayLine3 = String(value);
  }
  else if (strcmp(command, "DISP4") == 0) {
    displayLine4 = String(value);
  }
}

// ==================== STEPPER CONTROL ====================

void stepMotor(int steps) {
  for (int i = 0; i < abs(steps); i++) {
    digitalWrite(STEPPER_STEP, HIGH);
    delayMicroseconds(1000);  // 1ms pulse
    digitalWrite(STEPPER_STEP, LOW);
    delayMicroseconds(1000);  // 1ms delay
    
    stepperPosition += (steps > 0) ? 1 : -1;
  }
}
