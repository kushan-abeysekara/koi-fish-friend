# 💧 Water Quality Monitoring System — ESP32 Sensor Details

> Real-time water quality and rain monitoring module for the Koi Fish Friend smart aquaculture system.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Hardware Components](#2-hardware-components)
3. [Pin Mapping & Wiring Diagram](#3-pin-mapping--wiring-diagram)
4. [Arduino Libraries](#4-arduino-libraries)
5. [Sensor Specifications](#5-sensor-specifications)
6. [Calibration Details](#6-calibration-details)
7. [MQTT Communication](#7-mqtt-communication)
8. [Data Output Format](#8-data-output-format)
9. [Water Quality Evaluation Logic](#9-water-quality-evaluation-logic)
10. [Rain Detection Logic](#10-rain-detection-logic)
11. [Network Configuration](#11-network-configuration)
12. [Wiring Diagram](#12-wiring-diagram)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. System Overview

The Water Quality module is an **ESP32-based IoT sensor node** that continuously monitors pond water conditions and rain status. It reads data from 5 sensors and publishes measurements every **2 seconds** via MQTT to the EMQX broker. The backend receives the data and stores it in both MySQL and Supabase (PostgreSQL) for real-time dashboard display and historical analysis.

**Source File**: `ESP32 CODE/water_quality/water_quality.ino` (~850 lines)
**Board**: ESP32 DevKit 38-Pin (ZY-ESP32 WiFi BT)
**Device Type**: `WATER_QUALITY`
**Device ID Format**: `WQ_XXYYZZ` (auto-generated from MAC address)

---

## 2. Hardware Components

| # | Component | Model / Type | Quantity | Purpose |
|---|-----------|-------------|----------|---------|
| 1 | Microcontroller | **ESP32 DevKit** (38-pin, WiFi + BT) | 1 | Main processing & communication |
| 2 | pH Sensor | **Analog pH Sensor** (BNC connector probe) | 1 | Measures water acidity/alkalinity (0–14 pH) |
| 3 | Gas Sensor | **MQ135** (semiconductor gas sensor) | 1 | Measures CO₂ (PPM) and NH₃/Ammonia (PPM) |
| 4 | Turbidity Sensor | **Analog Turbidity Sensor** (photoelectric) | 1 | Measures water clarity in NTU |
| 5 | Rain Sensor | **Rain Detection Module** (analog + digital) | 1 | Detects rain and measures rain intensity |
| 6 | Jumper Wires | Male-to-Female | ~15 | Sensor connections |
| 7 | Breadboard | Standard 830-point (optional) | 1 | Prototyping |
| 8 | Power Supply | USB 5V or 3.3V regulated | 1 | ESP32 power |

---

## 3. Pin Mapping & Wiring Diagram

### ESP32 GPIO Pin Assignments

| GPIO Pin | ADC Channel | Function | Connected To | Signal Type |
|----------|-------------|----------|-------------|-------------|
| **GPIO 32** | ADC1_CH4 | pH Sensor Input | pH Module AO (Analog Out) | Analog (0–3.3V) |
| **GPIO 33** | ADC1_CH5 | MQ135 Gas Sensor | MQ135 AO (Analog Out) | Analog (0–3.3V) |
| **GPIO 34** | ADC1_CH6 | Turbidity Sensor | Turbidity Module AO | Analog (0–3.3V) |
| **GPIO 35** | ADC1_CH7 | Rain Sensor Analog | Rain Module AO | Analog (0–3.3V) |
| **GPIO 26** | — | Rain Sensor Digital | Rain Module DO | Digital (HIGH/LOW) |

### Power Connections

| Pin | Connection | Notes |
|-----|-----------|-------|
| **3.3V** | pH Sensor VCC, Rain Sensor VCC | 3.3V power rail |
| **5V (VIN)** | MQ135 VCC, Turbidity Sensor VCC | 5V power rail (MQ135 requires 5V heater) |
| **GND** | All sensor GND pins | Common ground |

### Sensor Wiring Table

#### pH Sensor → ESP32
| pH Module Pin | ESP32 Pin | Wire Color (suggested) |
|--------------|-----------|----------------------|
| VCC | 3.3V | Red |
| GND | GND | Black |
| AO (Analog Out) | GPIO 32 | Yellow |

#### MQ135 Gas Sensor → ESP32
| MQ135 Pin | ESP32 Pin | Wire Color (suggested) |
|-----------|-----------|----------------------|
| VCC | 5V (VIN) | Red |
| GND | GND | Black |
| AO (Analog Out) | GPIO 33 | Orange |

> **Note**: MQ135 requires a **5V** power supply for its internal heater. The analog output is still within ESP32 ADC range (0–3.3V).

#### Turbidity Sensor → ESP32
| Turbidity Pin | ESP32 Pin | Wire Color (suggested) |
|--------------|-----------|----------------------|
| VCC | 5V (VIN) | Red |
| GND | GND | Black |
| AO (Analog Out) | GPIO 34 | Green |

#### Rain Sensor Module → ESP32
| Rain Module Pin | ESP32 Pin | Wire Color (suggested) |
|----------------|-----------|----------------------|
| VCC | 3.3V | Red |
| GND | GND | Black |
| AO (Analog Out) | GPIO 35 | Blue |
| DO (Digital Out) | GPIO 26 | White |

> **Note**: Rain module DO pin is configured with `INPUT_PULLUP`. **LOW = Rain Detected**, **HIGH = No Rain**.

---

## 4. Arduino Libraries

| Library | Header | Version | Purpose | Source |
|---------|--------|---------|---------|--------|
| **WiFi** | `WiFi.h` | Built-in (ESP32 Arduino Core) | WiFi STA mode connectivity | ESP32 Arduino Core |
| **PubSubClient** | `PubSubClient.h` | 2.8+ | MQTT v3.1.1 client (publish/subscribe) | [knolleary/pubsubclient](https://github.com/knolleary/pubsubclient) |
| **ArduinoJson** | `ArduinoJson.h` | 6.x | JSON serialization & deserialization for MQTT payloads | [bblanchon/ArduinoJson](https://github.com/bblanchon/ArduinoJson) |

### Library Installation

**Arduino IDE:**
1. Open **Sketch → Include Library → Manage Libraries**
2. Search and install:
   - `PubSubClient` by Nick O'Leary
   - `ArduinoJson` by Benoît Blanchon

**PlatformIO:**
```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
lib_deps =
    knolleary/PubSubClient @ ^2.8
    bblanchon/ArduinoJson @ ^6.21
```

### ESP32 Board Configuration

| Setting | Value |
|---------|-------|
| Board | ESP32 Dev Module |
| Upload Speed | 115200 |
| CPU Frequency | 240 MHz |
| Flash Size | 4MB |
| Partition Scheme | Default |
| ADC Attenuation | 11dB (~0V to 3.6V range) |
| ADC Resolution | 12-bit (0–4095) |

---

## 5. Sensor Specifications

### pH Sensor (Analog pH Probe)

| Specification | Value |
|--------------|-------|
| Measurement Range | 0–14 pH |
| Operating Voltage | 3.3V–5V |
| Output | Analog voltage (0–3.3V) |
| Accuracy | ±0.1 pH (after calibration) |
| Response Time | < 1 minute |
| Operating Temperature | 0–60°C |
| Connection | BNC connector to module board |
| ADC Pin | GPIO 32 (ADC1_CH4) |
| Sampling | 30 readings averaged |

### MQ135 Gas Sensor (CO₂ + NH₃)

| Specification | Value |
|--------------|-------|
| Detectable Gases | CO₂, NH₃, NOx, Benzene, Alcohol, Smoke |
| CO₂ Range | 400–5000 PPM |
| NH₃ Range | 0–10 PPM |
| Operating Voltage | 5V (heater requires 5V) |
| Analog Output | 0–3.3V proportional to gas concentration |
| Preheat Time | 24–48 hours (first use), 2–3 min (subsequent) |
| Operating Temperature | -10°C to 45°C |
| ADC Pin | GPIO 33 (ADC1_CH5) |
| Sampling | 30 readings averaged |

> **Dual-use**: The same MQ135 sensor is read twice — once for CO₂ estimation and once for NH₃ estimation using different calibration curves.

### Turbidity Sensor (Analog Photoelectric)

| Specification | Value |
|--------------|-------|
| Measurement Range | 0–3000 NTU |
| Operating Voltage | 5V |
| Output | Analog voltage (higher voltage = clearer water) |
| Clear Water Voltage | ~4.2V |
| Response Time | < 500ms |
| ADC Pin | GPIO 34 (ADC1_CH6) |
| Sampling | 30 readings averaged |

### Rain Sensor Module (Analog + Digital)

| Specification | Value |
|--------------|-------|
| Detection Type | Resistive (water bridges conductive traces) |
| Analog Output | 0–3.3V (dry = high, wet = low) |
| Digital Output | HIGH = No rain, LOW = Rain detected |
| Sensitivity | Adjustable via onboard potentiometer |
| Operating Voltage | 3.3V–5V |
| Rain Level Output | 0–100% (calculated from analog reading) |
| ADC Pin (Analog) | GPIO 35 (ADC1_CH7) |
| Digital Pin | GPIO 26 (INPUT_PULLUP) |
| Sampling | 20 readings averaged |

---

## 6. Calibration Details

### pH Sensor Calibration

```
Neutral Voltage (pH 7.0):  2.5V
Voltage Step per pH unit:  0.18V
Calibration Offset:        -2.3 pH units

Formula:
  voltage = (ADC_reading / 4095) × 3.3V
  pH = 7.0 + ((2.5 - voltage) / 0.18) - 2.3

Valid Range: 0–14 pH
```

**Calibration Note**: The -2.3 offset was determined from real-world measurement where the sensor read 9.23 pH when actual water was 6.8–7.0 pH.

### Turbidity Sensor Calibration

```
Clear Water Reference:  4.2V
Maximum NTU:           3000 NTU

Formula (voltage > 2.5V):
  NTU = -1120.4 × V² + 5742.3 × V - 4352.9

Formula (voltage ≤ 2.5V):
  NTU = 3000 (very turbid)

Valid Range: 0–3000 NTU
```

### MQ135 CO₂ Calibration

```
Base CO₂ Level:     400 PPM (atmospheric baseline)
Base Offset:        +300 PPM

Formula (voltage > 0.4V):
  PPM = 116.6020682 × exp((voltage - 2.462) / -0.263) + 300

Valid Range: 400–5000 PPM
```

### MQ135 NH₃/Ammonia Calibration

```
Fresh Air Baseline:  2.5–3.0V
High Ammonia:        < 1.5V

Formula:
  voltage < 1.0V  → PPM = 10.0 (saturated)
  voltage < 2.0V  → PPM = 5.0 × exp((2.0 - V) / 0.4)
  voltage < 2.5V  → PPM = (2.5 - V) × 2.0
  voltage ≥ 2.5V  → PPM = max(0, (2.8 - V) × 0.5)

Valid Range: 0–10 PPM
```

### Rain Sensor Calibration

```
Dry (no rain):   ADC ≈ 4095 → Rain Level = 0%
Heavy rain:      ADC ≈ 0    → Rain Level = 100%

Formula:
  rainPercent = ((4095 - ADC_reading) / 4095) × 100

Digital Threshold:
  DO = HIGH → No rain
  DO = LOW  → Rain detected (threshold adjustable via potentiometer)
```

---

## 7. MQTT Communication

### Broker Configuration

| Parameter | Value |
|-----------|-------|
| Broker | EMQX (self-hosted) |
| Host | `187.77.189.5` |
| Port | `1883` (TCP) |
| Authentication | Anonymous (empty username/password) |
| Client ID | `ESP32-{deviceId}` (e.g., `ESP32-WQ_A1B2C3`) |
| Keep Alive | 15 seconds |
| Buffer Size | 512 bytes |
| Reconnect Interval | 3 seconds (non-blocking) |
| Last Will | Offline status on disconnect |

### MQTT Topics

| Topic | Direction | QoS | Retained | Purpose |
|-------|-----------|-----|----------|---------|
| `koi/sensors/{deviceId}/status` | ESP32 → Broker | 0 | Yes | Device online/offline status |
| `koi/sensors/{deviceId}/data` | ESP32 → Broker | 0 | No | Sensor readings (every 2s) |
| `koi/sensors/{deviceId}/command` | Broker → ESP32 | 0 | No | Commands (assign, unassign) |

### Publish Intervals

| Data Type | Interval | Topic |
|-----------|----------|-------|
| Sensor Data | Every 2 seconds | `.../data` |
| Device Status | Every 2 seconds | `.../status` |
| WiFi Check | Every 5 seconds | Internal |
| MQTT Reconnect | Every 3 seconds | Internal |

---

## 8. Data Output Format

### Sensor Data Payload (`/data` topic)

```json
{
  "deviceId": "WQ_A1B2C3",
  "pondId": 3,
  "phValue": 7.25,
  "turbidity": 18.5,
  "co2Level": 650,
  "ammonia": 0.12,
  "rainLevel": 35.2,
  "rainDetected": true,
  "rainStatus": "moderate",
  "waterQualityStatus": "normal",
  "status": "normal",
  "rssi": -45,
  "timestamp": 125000
}
```

| Field | Type | Unit | Range | Description |
|-------|------|------|-------|-------------|
| `deviceId` | String | — | `WQ_XXXXXX` | Unique device identifier |
| `pondId` | Integer | — | 0–99 | Assigned pond (default: 3) |
| `phValue` | Float | pH | 0–14 | Water acidity/alkalinity |
| `turbidity` | Float | NTU | 0–3000 | Water clarity |
| `co2Level` | Float | PPM | 400–5000 | Carbon dioxide concentration |
| `ammonia` | Float | PPM | 0–10 | Ammonia/NH₃ concentration |
| `rainLevel` | Float | % | 0–100 | Rain intensity percentage |
| `rainDetected` | Boolean | — | true/false | Digital rain detection flag |
| `rainStatus` | String | — | dry/light/moderate/heavy | Rain intensity classification |
| `waterQualityStatus` | String | — | normal/warning/critical | Overall water quality |
| `status` | String | — | normal | Sensor operational status |
| `rssi` | Integer | dBm | -100 to 0 | WiFi signal strength |
| `timestamp` | Integer | ms | — | Milliseconds since boot |

### Status Payload (`/status` topic)

```json
{
  "deviceId": "WQ_A1B2C3",
  "deviceType": "WATER_QUALITY",
  "status": "online",
  "ipAddress": "192.168.8.102",
  "rssi": -45
}
```

### Last Will (Offline) Payload

```json
{
  "deviceId": "WQ_A1B2C3",
  "deviceType": "WATER_QUALITY",
  "status": "offline"
}
```

---

## 9. Water Quality Evaluation Logic

The `evaluateWaterQuality()` function classifies pond conditions based on ideal koi fish parameters:

### Thresholds

| Parameter | Normal (Safe) | Warning | Critical |
|-----------|--------------|---------|----------|
| **pH** | 7.0–8.5 | 6.5–7.0 or 8.5–9.0 | < 6.5 or > 9.0 |
| **Turbidity** | < 25 NTU | 25–40 NTU | > 40 NTU |
| **CO₂** | < 1000 PPM | 1000–2000 PPM | > 2000 PPM |
| **NH₃** | < 0.5 PPM | 0.5–1.0 PPM | > 1.0 PPM |

### Evaluation Priority

```
IF any parameter is CRITICAL → status = "critical"
ELSE IF any parameter is WARNING → status = "warning"
ELSE → status = "normal"
```

### Ideal Koi Pond Conditions

| Parameter | Ideal Range | Notes |
|-----------|------------|-------|
| pH | 7.0–8.5 | Slightly alkaline preferred by koi |
| Turbidity | < 25 NTU | Clear water for fish health |
| CO₂ | < 1000 PPM | High CO₂ reduces dissolved oxygen |
| NH₃ | < 0.05 PPM | Ammonia is toxic to fish even at low levels |
| Temperature | 15–25°C | *(measured by weather module)* |

---

## 10. Rain Detection Logic

### Rain Status Classification

| Rain Level (%) | Digital Pin | Status | Description |
|----------------|------------|--------|-------------|
| < 5% | HIGH (no rain) | **Dry** | No rain, clear conditions |
| < 25% | LOW or HIGH | **Light** | Light drizzle or mist |
| < 60% | LOW or HIGH | **Moderate** | Steady rain, monitor water quality |
| ≥ 60% | LOW | **Heavy** | Heavy rain, risk of water quality changes |

### Why Rain Monitoring Matters for Koi Ponds

| Impact | Description |
|--------|-------------|
| **pH Changes** | Rainwater is slightly acidic (pH ~5.6) and can lower pond pH |
| **Turbidity Increase** | Rain runoff carries dirt and debris into the pond |
| **Ammonia Dilution** | Heavy rain can dilute ammonia (beneficial) but also flush in fertilizers |
| **Temperature Drop** | Cold rain can cause rapid temperature changes stressing fish |
| **Overflow Risk** | Heavy rain may cause pond overflow |

---

## 11. Network Configuration

### WiFi Settings

| Parameter | Value |
|-----------|-------|
| SSID | `KoiFishFriend` |
| Mode | Station (STA) |
| IP Assignment | **Static IP** |
| IP Address | `192.168.8.102` |
| Gateway | `192.168.8.1` |
| Subnet | `255.255.255.0` |
| Primary DNS | `8.8.8.8` (Google) |
| Secondary DNS | `8.8.4.4` (Google) |
| Connection Timeout | 10 seconds (40 attempts × 250ms) |

### Data Flow

```
pH Sensor   ─┐
MQ135       ─┤   ┌──────────┐      ┌──────────┐      ┌──────────────┐
Turbidity   ─┼──→│  ESP32   │─MQTT→│   EMQX   │─────→│ Spring Boot  │
Rain Sensor ─┘   │ (WiFi)   │      │  Broker  │      │  Backend     │
                  └──────────┘      └──────────┘      └──────┬───────┘
                                         │                    │
                                         │              ┌─────┴──────┐
                                         │              │            │
                                         ▼              ▼            ▼
                                    React Frontend   Supabase    MySQL
                                    (MQTT.js direct) (sensor_live)(sensor_data)
```

---

## 12. Wiring Diagram

```
                        ┌─────────────────────────┐
                        │       ESP32 DevKit       │
                        │        (38-Pin)          │
                        │                          │
   pH Sensor AO ───────►│ GPIO 32 (ADC1_CH4)      │
                        │                          │
   MQ135 AO ───────────►│ GPIO 33 (ADC1_CH5)      │
                        │                          │
   Turbidity AO ───────►│ GPIO 34 (ADC1_CH6)      │
                        │                          │
   Rain Sensor AO ─────►│ GPIO 35 (ADC1_CH7)      │
                        │                          │
   Rain Sensor DO ─────►│ GPIO 26 (Digital Input)  │
                        │                          │
   All Sensors GND ────►│ GND                      │
                        │                          │
   pH + Rain VCC ──────►│ 3.3V                     │
                        │                          │
   MQ135 + Turb VCC ──►│ 5V (VIN)                 │
                        │                          │
                        └─────────────────────────┘

   ┌─────────────────────────────────────────────────┐
   │              SENSOR MODULES                      │
   │                                                  │
   │  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
   │  │ pH Sensor│  │  MQ135   │  │  Turbidity   │   │
   │  │          │  │          │  │  Sensor       │   │
   │  │ VCC→3.3V │  │ VCC→5V   │  │ VCC→5V       │   │
   │  │ GND→GND  │  │ GND→GND  │  │ GND→GND      │   │
   │  │ AO →GP32 │  │ AO →GP33 │  │ AO →GP34     │   │
   │  └──────────┘  └──────────┘  └──────────────┘   │
   │                                                  │
   │  ┌────────────────────┐                          │
   │  │   Rain Sensor      │                          │
   │  │   Module           │                          │
   │  │                    │                          │
   │  │ VCC → 3.3V         │                          │
   │  │ GND → GND          │                          │
   │  │ AO  → GPIO 35      │                          │
   │  │ DO  → GPIO 26      │                          │
   │  └────────────────────┘                          │
   └─────────────────────────────────────────────────┘
```

---

## 13. Troubleshooting

### Sensor Connection Check

The firmware automatically detects disconnected sensors by checking ADC boundary values:

| Condition | Indicator | Action |
|-----------|----------|--------|
| ADC reading ≥ 4090 | Sensor likely disconnected (pulled high) | Check wiring |
| ADC reading ≤ 5 | Sensor likely shorted to ground | Check for short circuit |

### Common Issues

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| pH reads 0 or 14 constantly | Sensor disconnected or cable fault | Check BNC connector and wiring to GPIO 32 |
| MQ135 reads max CO₂ | Sensor not preheated | Allow 2–3 minutes warmup; first use needs 24–48 hours |
| Turbidity always shows 3000 NTU | Low voltage reading (< 2.5V) | Check 5V power supply to turbidity sensor |
| Rain always shows 0% | Analog pin not reading | Verify GPIO 35 wiring; test with wet finger on rain pad |
| Rain always shows 100% | Rain pad wet or damaged | Dry the rain pad; check for corrosion |
| WiFi won't connect | Wrong credentials or out of range | Verify SSID: `KoiFishFriend`, password: check config |
| MQTT won't connect | Broker unreachable | Verify `187.77.189.5:1883` is accessible from network |
| No data on dashboard | MQTT topic mismatch | Check device ID matches `WQ_` prefix pattern |
| Serial monitor blank | `ENABLE_SERIAL` is false | Set `#define ENABLE_SERIAL true` for debugging |

### Debug Mode

To enable Serial Monitor output for debugging:

```cpp
// Change this line in the code:
#define ENABLE_SERIAL true  // Set to true for debugging
```

Then open Serial Monitor at **115200 baud**.

### Sensor Debug Output (when ENABLE_SERIAL = true)

```
📡 MQTT: ✅ | 📍 IP: 192.168.8.102 | Signal: -45 dBm
🏊 Pond: 3 | pH: 7.25 | Turbidity: 18.5 NTU | CO2: 650 PPM | NH3: 0.12 PPM | Rain: 35.2% (moderate) | Status: normal

📊 pH Debug - Raw ADC: 2048 | Voltage: 1.650V | Calculated pH: 7.25
🧪 NH3 Debug - Raw: 3200 | Voltage: 2.578V | NH3: 0.11 PPM
🌧️ Rain Debug - Raw ADC: 2650 | Rain Level: 35.3%
```

---

## Version History

| Date | Change |
|------|--------|
| March 2026 | Added rain sensor (GPIO 35 analog, GPIO 26 digital) |
| March 2026 | Added `rainLevel`, `rainDetected`, `rainStatus` to MQTT payload |
| Feb 2026 | Calibrated pH sensor (-2.3 offset) |
| Feb 2026 | Added MQ135 ammonia (NH₃) detection |
| Jan 2026 | Initial release with pH, turbidity, CO₂ |

---

> **Project**: Koi Fish Friend — Smart Koi Fish Farm Management System
> **Module**: Water Quality & Rain Monitoring (ESP32)
> **Last Updated**: March 2026
