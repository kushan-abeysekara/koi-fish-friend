/*
  ESP32 ESC control with 10k potentiometer (103)
  Compatible with ESP32 Arduino Core 3.x
*/

const int potPin = 36;   // ADC1_0
const int escPin = 25;   // ESC signal

// ESC parameters
const int pwmFreq = 50;       // 50Hz (servo/ESC)
const int pwmResolution = 16; // 16-bit
const int minUs = 1000;       // Min throttle
const int maxUs = 2000;       // Max throttle

// Convert microseconds to duty
uint32_t usToDuty(int us) {
  const int periodUs = 20000; // 50Hz = 20ms
  uint32_t maxDuty = (1 << pwmResolution) - 1;
  return (uint32_t)((uint64_t)us * maxDuty / periodUs);
}

void setup() {
  Serial.begin(115200);
  delay(500);

  // ADC setup
  analogReadResolution(12); // 0–4095
  analogSetPinAttenuation(potPin, ADC_11db);

  // NEW LEDC API (Core 3.x)
  ledcAttach(escPin, pwmFreq, pwmResolution);

  // Arm ESC
  Serial.println("Arming ESC (keep pot at MIN)...");
  ledcWrite(escPin, usToDuty(minUs));
  delay(3000);
  Serial.println("ESC Armed");
}

void loop() {
  int adcValue = analogRead(potPin); // 0–4095

  int pulseUs = map(adcValue, 0, 4095, minUs, maxUs);
  ledcWrite(escPin, usToDuty(pulseUs));

  Serial.print("ADC: ");
  Serial.print(adcValue);
  Serial.print("  Pulse(us): ");
  Serial.println(pulseUs);

  delay(50);
}
