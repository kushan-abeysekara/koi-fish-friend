#include <Arduino.h>

#define MQ135_PIN 33
#define RL 10.0          // Load resistor (kΩ) — most modules use 10k
#define ADC_MAX 4095.0
#define VREF 3.3

float readRs() {
int adc = analogRead(MQ135_PIN);
float v = adc * (VREF / ADC_MAX);
if (v <= 0.01) return 0;
float rs = ((VREF - v) / v) * RL;
return rs;
}

void setup() {
Serial.begin(115200);
analogSetAttenuation(ADC_11db);
analogReadResolution(12);
delay(2000);
Serial.println("Calibrating MQ135 in clean air...");
}

void loop() {
float rs = readRs();
float r0 = rs / 3.6;   // Clean air factor
Serial.print("R0 = ");
Serial.println(r0, 3);
delay(1000);
}
