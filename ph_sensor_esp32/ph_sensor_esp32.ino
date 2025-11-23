/*
 * ESP32 Water Quality Monitoring System
 * 
 * This sketch reads multiple sensors for koi pond water quality monitoring:
 * - pH Sensor (GPIO 32)
 * - MQ135 Air Quality Sensor (GPIO 33)
 * - Turbidity Sensor (GPIO 34)
 * 
 * Hardware:
 * - ESP32 Development Board
 * - pH Sensor (Analog output connected to GPIO 32)
 * - MQ135 Air Quality Sensor (Analog output connected to GPIO 33)
 * - Turbidity Sensor Module (Analog output connected to GPIO 34)
 * 
 * Future Enhancement: WiFi connectivity for remote monitoring
 * 
 * Author: Generated for koi-fish-friend project
 * Date: November 23, 2025
 */

// Pin definitions
#define PH_SENSOR_PIN 32        // GPIO 32 (ADC1_CH4) - pH Sensor
#define MQ135_SENSOR_PIN 33     // GPIO 33 (ADC1_CH5) - MQ135 Air Quality
#define TURBIDITY_SENSOR_PIN 34 // GPIO 34 (ADC1_CH6) - Turbidity Sensor

// ADC Configuration
#define ADC_RESOLUTION 12       // 12-bit resolution (0-4095)
#define ADC_MAX_VALUE 4095.0    // Maximum ADC value for 12-bit
#define VREF 3.3                // ESP32 reference voltage (3.3V)

// pH Calibration Constants
// The pH formula used is: pH = 7.0 + (2.5 - V_out) / 0.18
// 
// Calibration voltage (2.5V): This is the voltage output when the pH sensor 
// is in a neutral solution (pH 7.0). This value is sensor-specific and should
// be calibrated using a pH 7.0 buffer solution.
//
// Slope (0.18): This represents the voltage change per pH unit. For most analog
// pH sensors, the slope is approximately 0.18V per pH unit (based on the Nernst
// equation, ~59mV per pH at 25°C, scaled by the sensor's amplifier circuit).
// This value should be calibrated using pH 4.0 and pH 7.0 buffer solutions.
#define PH_NEUTRAL_VOLTAGE 2.5  // Voltage at pH 7.0 (neutral)
#define PH_SLOPE 0.18           // Voltage change per pH unit

// Sampling configuration
#define NUM_SAMPLES 50          // Number of samples to average
#define SAMPLE_INTERVAL 1000    // Delay between readings in milliseconds

// MQ135 Air Quality Sensor Constants
// The MQ135 sensor detects NH3, NOx, alcohol, benzene, smoke, CO2
// Higher voltage = worse air quality
#define MQ135_CLEAN_AIR_VALUE 100.0  // PPM value for clean air (calibration needed)

// Turbidity Sensor Constants
// Lower voltage = higher turbidity (more particles in water)
// Higher voltage = clearer water
#define TURBIDITY_CLEAR_WATER_VOLTAGE 4.2  // Voltage for clear water (calibration)
#define TURBIDITY_MAX_NTU 3000.0           // Maximum NTU (Nephelometric Turbidity Units)

// WiFi Configuration (for future use)
// #define WIFI_SSID "Your_WiFi_Name"
// #define WIFI_PASSWORD "Your_WiFi_Password"
// #include <WiFi.h>

void setup() {
  // Initialize Serial communication
  Serial.begin(115200);
  while (!Serial) {
    ; // Wait for serial port to connect
  }
  
  Serial.println("╔════════════════════════════════════════╗");
  Serial.println("║  ESP32 Water Quality Monitor System   ║");
  Serial.println("║     Koi Fish Friend Project           ║");
  Serial.println("╚════════════════════════════════════════╝");
  Serial.println();
  
  // Configure ADC1
  // Set ADC attenuation to 11dB for ~0V to 3.6V range
  analogSetAttenuation(ADC_11db);
  
  // Set ADC resolution to 12 bits (0-4095)
  analogReadResolution(ADC_RESOLUTION);
  
  Serial.println("ADC Configuration:");
  Serial.println("- Attenuation: 11dB (0V - 3.6V range)");
  Serial.println("- Resolution: 12 bits (0-4095)");
  Serial.println("- Reference Voltage: 3.3V");
  Serial.println();
  Serial.println("Sensor Configuration:");
  Serial.println("1. pH Sensor (GPIO 32)");
  Serial.println("   - Neutral Voltage (pH 7.0): 2.5V");
  Serial.println("   - Slope: 0.18V per pH unit");
  Serial.println("2. MQ135 Air Quality Sensor (GPIO 33)");
  Serial.println("   - Detects: NH3, NOx, CO2, Smoke");
  Serial.println("3. Turbidity Sensor (GPIO 34)");
  Serial.println("   - Measures water clarity (NTU)");
  Serial.println();
  Serial.println("Starting measurements...");
  Serial.println();
  
  delay(2000);
}

// Function to read pH sensor
float readPH(int &minRaw, int &maxRaw) {
  unsigned long sum = 0;
  minRaw = 4095;
  maxRaw = 0;
  
  for (int i = 0; i < NUM_SAMPLES; i++) {
    int reading = analogRead(PH_SENSOR_PIN);
    sum += reading;
    if (reading < minRaw) minRaw = reading;
    if (reading > maxRaw) maxRaw = reading;
    delay(10);
  }
  
  float averageRaw = sum / (float)NUM_SAMPLES;
  float voltage = (averageRaw / ADC_MAX_VALUE) * VREF;
  float pH = 7.0 + ((PH_NEUTRAL_VOLTAGE - voltage) / PH_SLOPE);
  
  return pH;
}

// Function to read MQ135 Air Quality sensor
float readAirQuality(int &rawValue) {
  unsigned long sum = 0;
  
  for (int i = 0; i < NUM_SAMPLES; i++) {
    sum += analogRead(MQ135_SENSOR_PIN);
    delay(10);
  }
  
  rawValue = sum / NUM_SAMPLES;
  float voltage = (rawValue / ADC_MAX_VALUE) * VREF;
  
  // Convert to PPM (parts per million) - simplified calculation
  // Higher voltage = worse air quality
  // This needs calibration for accurate PPM values
  float ppm = (voltage / VREF) * 1000.0; // Simplified PPM calculation
  
  return ppm;
}

// Function to read Turbidity sensor
float readTurbidity(int &rawValue) {
  unsigned long sum = 0;
  
  for (int i = 0; i < NUM_SAMPLES; i++) {
    sum += analogRead(TURBIDITY_SENSOR_PIN);
    delay(10);
  }
  
  rawValue = sum / NUM_SAMPLES;
  float voltage = (rawValue / ADC_MAX_VALUE) * VREF;
  
  // Convert voltage to NTU (Nephelometric Turbidity Units)
  // Lower voltage = higher turbidity (cloudier water)
  // This formula needs calibration based on your specific sensor
  float ntu = 0;
  
  if (voltage > 2.5) {
    ntu = -1120.4 * voltage * voltage + 5742.3 * voltage - 4352.9;
  } else {
    ntu = 3000.0; // Very turbid water
  }
  
  // Clamp NTU to valid range
  if (ntu < 0) ntu = 0;
  if (ntu > TURBIDITY_MAX_NTU) ntu = TURBIDITY_MAX_NTU;
  
  return ntu;
}

// Function to get air quality description
String getAirQualityStatus(float ppm) {
  if (ppm < 200) return "Excellent";
  else if (ppm < 400) return "Good";
  else if (ppm < 600) return "Moderate";
  else if (ppm < 800) return "Poor";
  else return "Dangerous";
}

// Function to get water clarity description
String getWaterClarityStatus(float ntu) {
  if (ntu < 5) return "Crystal Clear";
  else if (ntu < 50) return "Clear";
  else if (ntu < 100) return "Slightly Cloudy";
  else if (ntu < 500) return "Cloudy";
  else return "Very Turbid";
}

void loop() {
  // Read all sensors
  int phMinRaw, phMaxRaw, mq135Raw, turbidityRaw;
  
  Serial.println("════════════════════════════════════════");
  Serial.println("        SENSOR READINGS");
  Serial.println("════════════════════════════════════════");
  
  // 1. Read pH Sensor
  float pH = readPH(phMinRaw, phMaxRaw);
  float phVoltage = ((phMinRaw + phMaxRaw) / 2.0 / ADC_MAX_VALUE) * VREF;
  
  Serial.println("\n📊 pH SENSOR (GPIO 32):");
  Serial.print("   Raw ADC Range: ");
  Serial.print(phMinRaw);
  Serial.print(" - ");
  Serial.println(phMaxRaw);
  Serial.print("   Voltage: ");
  Serial.print(phVoltage, 3);
  Serial.println(" V");
  Serial.print("   pH Value: ");
  Serial.print(pH, 2);
  
  // pH status
  if (pH < 6.5) {
    Serial.println(" (Acidic ⚠️)");
  } else if (pH > 8.5) {
    Serial.println(" (Basic ⚠️)");
  } else {
    Serial.println(" (Good ✓)");
  }
  
  // Check for pH sensor connection issues
  if (phMaxRaw >= 4090 || phMaxRaw <= 5) {
    Serial.println("   ⚠️ WARNING: pH Sensor may be disconnected!");
  }
  
  // 2. Read MQ135 Air Quality Sensor
  float airQualityPPM = readAirQuality(mq135Raw);
  float mq135Voltage = (mq135Raw / ADC_MAX_VALUE) * VREF;
  
  Serial.println("\n🌬️  AIR QUALITY SENSOR (GPIO 33):");
  Serial.print("   Raw ADC: ");
  Serial.println(mq135Raw);
  Serial.print("   Voltage: ");
  Serial.print(mq135Voltage, 3);
  Serial.println(" V");
  Serial.print("   Air Quality: ");
  Serial.print(airQualityPPM, 1);
  Serial.print(" PPM (");
  Serial.print(getAirQualityStatus(airQualityPPM));
  Serial.println(")");
  
  // Check for MQ135 sensor connection issues
  if (mq135Raw >= 4090 || mq135Raw <= 5) {
    Serial.println("   ⚠️ WARNING: MQ135 Sensor may be disconnected!");
  }
  
  // 3. Read Turbidity Sensor
  float turbidityNTU = readTurbidity(turbidityRaw);
  float turbidityVoltage = (turbidityRaw / ADC_MAX_VALUE) * VREF;
  
  Serial.println("\n💧 TURBIDITY SENSOR (GPIO 34):");
  Serial.print("   Raw ADC: ");
  Serial.println(turbidityRaw);
  Serial.print("   Voltage: ");
  Serial.print(turbidityVoltage, 3);
  Serial.println(" V");
  Serial.print("   Turbidity: ");
  Serial.print(turbidityNTU, 1);
  Serial.print(" NTU (");
  Serial.print(getWaterClarityStatus(turbidityNTU));
  Serial.println(")");
  
  // Check for turbidity sensor connection issues
  if (turbidityRaw >= 4090 || turbidityRaw <= 5) {
    Serial.println("   ⚠️ WARNING: Turbidity Sensor may be disconnected!");
  }
  
  Serial.println("\n════════════════════════════════════════");
  
  // CSV format for plotter/visualizer
  // Format: pH,AirQuality_PPM,Turbidity_NTU,pH_Raw,MQ135_Raw,Turbidity_Raw
  Serial.print("DATA:");
  Serial.print(pH, 2);
  Serial.print(",");
  Serial.print(airQualityPPM, 1);
  Serial.print(",");
  Serial.print(turbidityNTU, 1);
  Serial.print(",");
  Serial.print((phMinRaw + phMaxRaw) / 2);
  Serial.print(",");
  Serial.print(mq135Raw);
  Serial.print(",");
  Serial.println(turbidityRaw);
  
  Serial.println();
  
  // Wait before next reading
  delay(SAMPLE_INTERVAL);
}
