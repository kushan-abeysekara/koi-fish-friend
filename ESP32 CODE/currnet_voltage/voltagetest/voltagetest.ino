const int sensorPin = 34;
const float vRef = 3.3;      // ESP32 ADC reference
const int adcMax = 4095;     // 12-bit ADC

void setup() {
  Serial.begin(115200);
  delay(1000);

  analogReadResolution(12);  // 0 to 4095
}

void loop() {
  int rawValue = analogRead(sensorPin);
  float voltage = (rawValue * vRef) / adcMax;

  Serial.print("ADC Raw: ");
  Serial.print(rawValue);
  Serial.print("   Pin Voltage: ");
  Serial.print(voltage, 3);
  Serial.println(" V");

  delay(500);
}