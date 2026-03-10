#define PH_PIN 32

void setup() {
  Serial.begin(115200);
}

void loop() {
  int raw = analogRead(PH_PIN);
  float voltage = raw * (3.3 / 4095.0);
  Serial.print("ADC: ");
  Serial.print(raw);
  Serial.print("  Voltage: ");
  Serial.println(voltage, 3);
  delay(1000);
}