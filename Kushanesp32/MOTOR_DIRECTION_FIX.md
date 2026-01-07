// MOTOR DIRECTION FIX NOTES
// ========================

// ISSUE: Forward/Reverse buttons not working - both motors not rotating

// POSSIBLE CAUSES:
// 1. One motor might be physically mounted backwards on the boat
// 2. Motor wiring might be reversed (swap IN1/IN2 for one motor)
// 3. PWM signal not working correctly
// 4. Power supply issue to motors

// SOLUTION OPTIONS:

// Option 1: Invert Right Motor Direction in Code
// -----------------------------------------------
// If the right motor is physically mounted backwards, modify moveForward() and moveBackward():

void moveForward_INVERTED_RIGHT(int speed) {
  motorLeftSpeed = speed;
  motorRightSpeed = speed;
  setMotorSpeed(MOTOR_LEFT_IN1, MOTOR_LEFT_IN2, MOTOR_LEFT_EN, speed);
  // Invert right motor: use -speed instead of speed
  setMotorSpeed(MOTOR_RIGHT_IN1, MOTOR_RIGHT_IN2, MOTOR_RIGHT_EN, -speed);
  currentCommand = "FORWARD";
}

void moveBackward_INVERTED_RIGHT(int speed) {
  motorLeftSpeed = -speed;
  motorRightSpeed = -speed;
  setMotorSpeed(MOTOR_LEFT_IN1, MOTOR_LEFT_IN2, MOTOR_LEFT_EN, -speed);
  // Invert right motor: use speed instead of -speed
  setMotorSpeed(MOTOR_RIGHT_IN1, MOTOR_RIGHT_IN2, MOTOR_RIGHT_EN, speed);
  currentCommand = "BACKWARD";
}

// Option 2: Invert Left Motor Direction in Code
// -----------------------------------------------
// If the left motor is physically mounted backwards:

void moveForward_INVERTED_LEFT(int speed) {
  motorLeftSpeed = speed;
  motorRightSpeed = speed;
  // Invert left motor: use -speed instead of speed
  setMotorSpeed(MOTOR_LEFT_IN1, MOTOR_LEFT_IN2, MOTOR_LEFT_EN, -speed);
  setMotorSpeed(MOTOR_RIGHT_IN1, MOTOR_RIGHT_IN2, MOTOR_RIGHT_EN, speed);
  currentCommand = "FORWARD";
}

void moveBackward_INVERTED_LEFT(int speed) {
  motorLeftSpeed = -speed;
  motorRightSpeed = -speed;
  // Invert left motor: use speed instead of -speed
  setMotorSpeed(MOTOR_LEFT_IN1, MOTOR_LEFT_IN2, MOTOR_LEFT_EN, speed);
  setMotorSpeed(MOTOR_RIGHT_IN1, MOTOR_RIGHT_IN2, MOTOR_RIGHT_EN, -speed);
  currentCommand = "BACKWARD";
}

// Option 3: Hardware Fix
// ----------------------
// Check L298N motor driver connections:
// - Make sure ENA and ENB are connected to PWM-capable pins (GPIO 27 and 33)
// - Verify IN1, IN2, IN3, IN4 connections match the pin definitions
// - Test with multimeter: when FORWARD is sent, you should see:
//   * IN1 (GPIO 26) = HIGH (3.3V)
//   * IN2 (GPIO 4) = LOW (0V)
//   * IN3 (GPIO 2) = HIGH (3.3V)
//   * IN4 (GPIO 32) = LOW (0V)
//   * ENA (GPIO 27) = PWM signal
//   * ENB (GPIO 33) = PWM signal

// DEBUGGING STEPS:
// 1. Upload the code with Serial.print statements (already added)
// 2. Open Serial Monitor at 115200 baud
// 3. Send FORWARD command from frontend
// 4. Check serial output to see if motors are being commanded
// 5. Use multimeter to test GPIO pins while FORWARD is active
// 6. If motors don't spin, check:
//    - Motor power supply (12V battery connected to L298N)
//    - L298N jumpers are in place (for ENA/ENB enable)
//    - Motor output wires are connected to OUT1/OUT2 and OUT3/OUT4

// TESTING PROCEDURE:
// 1. Send FORWARD command at speed 200
// 2. Observe which motor spins (if any) and in what direction
// 3. Send BACKWARD command at speed 200
// 4. Observe motor behavior
// 5. Based on results, apply one of the inversion options above
