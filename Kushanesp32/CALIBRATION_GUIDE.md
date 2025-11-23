# HX711 Load Cell Calibration Guide

## Overview

This guide helps you calibrate the HX711 load cell for accurate weight measurements. The system should display weight in **kilograms (kg)** with **2 decimal places** (e.g., 1.12 kg).

## Materials Needed

- Assembled HX711 + 5KG Load Cell
- ESP32 with code uploaded
- Known calibration weights (e.g., 500g, 1000g, 2000g)
- Serial Monitor (115200 baud)

---

## Step 1: Find Raw Values (No Calibration)

### 1.1 Upload Test Code

First, upload this test code to find raw values:

```cpp
#include <HX711.h>

#define DOUT 16
#define SCK 17

HX711 scale;

void setup() {
  Serial.begin(115200);
  Serial.println("HX711 Calibration");
  
  scale.begin(DOUT, SCK);
  
  Serial.println("Remove all weight from scale");
  Serial.println("Send 't' to tare");
}

void loop() {
  if (Serial.available()) {
    char command = Serial.read();
    if (command == 't') {
      scale.tare();
      Serial.println("Tared! Place known weight and send 'r'");
    }
    else if (command == 'r') {
      long reading = scale.read_average(20);
      Serial.print("Raw value: ");
      Serial.println(reading);
    }
  }
}
```

### 1.2 Get Raw Reading

1. Open Serial Monitor (115200 baud)
2. Remove all weight from load cell
3. Send `t` to tare (zero) the scale
4. Place a **known weight** (e.g., 1.00 kg or 1000g)
5. Send `r` to get raw reading
6. Note down the value (e.g., 7050)

---

## Step 2: Calculate Calibration Factor

### Formula:
```
calibration_factor = raw_value / known_weight_in_kg
```

### Example:
- Known weight: 1.00 kg
- Raw reading: -7050
- Calibration factor: -7050 / 1.00 = **-7050.0**

**Note:** The factor can be positive or negative depending on load cell wiring.

---

## Step 3: Test Calibration

### 3.1 Update Main Code

In your main `Kushanesp32.ino` file, update this line:

```cpp
#define CALIBRATION_FACTOR -7050.0  // Replace with your calculated value
```

### 3.2 Verify with Multiple Weights

Upload the code and test with different known weights:

| Known Weight | Expected Reading | Actual Reading | Error |
|--------------|------------------|----------------|-------|
| 0.50 kg | 0.50 kg | _____ kg | _____ |
| 1.00 kg | 1.00 kg | _____ kg | _____ |
| 2.00 kg | 2.00 kg | _____ kg | _____ |
| 3.00 kg | 3.00 kg | _____ kg | _____ |

### 3.3 Fine-Tune if Needed

If readings are consistently off:

```cpp
// If reading is too HIGH, increase calibration factor
#define CALIBRATION_FACTOR -7200.0

// If reading is too LOW, decrease calibration factor
#define CALIBRATION_FACTOR -6900.0
```

---

## Step 4: Advanced Calibration (Multi-Point)

For better accuracy across full range:

### 4.1 Collect Multiple Data Points

| Weight (kg) | Raw Reading | Factor (Raw/Weight) |
|-------------|-------------|---------------------|
| 0.50 | _____ | _____ |
| 1.00 | _____ | _____ |
| 2.00 | _____ | _____ |
| 3.00 | _____ | _____ |
| 5.00 | _____ | _____ |

### 4.2 Calculate Average Factor

```
Average Factor = (Factor1 + Factor2 + Factor3 + Factor4 + Factor5) / 5
```

Use this average as your `CALIBRATION_FACTOR`.

---

## Troubleshooting

### Problem: Unstable Readings

**Causes:**
- Vibrations
- Poor connections
- Electromagnetic interference

**Solutions:**
1. Place scale on stable surface
2. Check wiring connections
3. Add 100nF capacitor between VCC and GND
4. Keep away from motors during measurement

### Problem: Always Shows Zero

**Causes:**
- Load cell not connected
- Wrong DOUT/SCK pins
- Scale not tared

**Solutions:**
1. Verify load cell wiring (E+, E-, A+, A-)
2. Check GPIO 16 (DOUT) and GPIO 17 (SCK)
3. Call `scale.tare()` in setup

### Problem: Negative Weights

**Causes:**
- Calibration factor sign is wrong
- Load cell wired backwards

**Solutions:**
1. Change sign of calibration factor
2. Or swap A+ and A- wires on load cell

### Problem: Readings Drift Over Time

**Causes:**
- Temperature changes
- Creep (material property)

**Solutions:**
1. Allow warm-up time (5 minutes)
2. Re-tare periodically
3. Use temperature compensation (advanced)

---

## Calibration Code (Standalone)

Use this complete calibration sketch:

```cpp
#include <HX711.h>

#define DOUT 16
#define SCK 17

HX711 scale;

float calibration_factor = -7050.0; // Start with this

void setup() {
  Serial.begin(115200);
  Serial.println("HX711 Calibration");
  Serial.println("Remove all weight and send 't' to tare");
  
  scale.begin(DOUT, SCK);
  scale.set_scale();
  scale.tare();
}

void loop() {
  scale.set_scale(calibration_factor);
  
  Serial.print("Reading: ");
  Serial.print(scale.get_units(10), 2);
  Serial.print(" kg");
  Serial.print(" | Calibration Factor: ");
  Serial.println(calibration_factor);
  
  if (Serial.available()) {
    char command = Serial.read();
    
    switch(command) {
      case 't':
        scale.tare();
        Serial.println("Tared!");
        break;
      case '+':
        calibration_factor += 10;
        Serial.println("Factor +10");
        break;
      case '-':
        calibration_factor -= 10;
        Serial.println("Factor -10");
        break;
      case 'p':
        calibration_factor += 100;
        Serial.println("Factor +100");
        break;
      case 'm':
        calibration_factor -= 100;
        Serial.println("Factor -100");
        break;
      case 's':
        Serial.print("Final Calibration Factor: ");
        Serial.println(calibration_factor);
        break;
    }
  }
  
  delay(500);
}
```

### Commands:
- `t` - Tare (zero) the scale
- `+` - Increase factor by 10
- `-` - Decrease factor by 10
- `p` - Increase factor by 100 (plus)
- `m` - Decrease factor by 100 (minus)
- `s` - Save/show final factor

### Calibration Process:
1. Upload this code
2. Remove all weight
3. Send `t` to tare
4. Place 1.00 kg weight
5. Adjust factor using `+` / `-` / `p` / `m` until reading shows 1.00
6. Send `s` to see final factor
7. Copy factor to main code

---

## Load Cell Wiring Colors

Different manufacturers use different colors:

### Standard Wiring:
| Wire Color | Function | HX711 Pin |
|------------|----------|-----------|
| Red | E+ (Excitation+) | E+ |
| Black | E- (Excitation-) | E- |
| White | A+ (Signal+) | A+ |
| Green | A- (Signal-) | A- |

### Alternative Wiring:
| Wire Color | Function | HX711 Pin |
|------------|----------|-----------|
| Red | E+ | E+ |
| Black | E- | E- |
| Green | A+ | A+ |
| White | A- | A- |

**Note:** If readings are inverted, swap A+ and A- wires.

---

## Expected Performance

After proper calibration:

- **Accuracy**: ±0.01 kg (10g)
- **Repeatability**: ±0.005 kg (5g)
- **Linearity**: <0.1% full scale
- **Update Rate**: 10 readings/second
- **Warm-up Time**: 5 minutes

---

## Maintenance

1. **Re-calibrate** every 6 months
2. **Re-tare** before each measurement session
3. **Check wiring** if readings become unstable
4. **Protect from moisture** (can affect readings)
5. **Avoid overloading** (max 5 kg for this load cell)

---

## Reference Values

Common calibration factors for 5KG load cells:

| Brand | Typical Factor |
|-------|----------------|
| Generic Chinese | -7000 to -7500 |
| TAL220 | -6800 to -7200 |
| Load Cell A | -7050 |
| Load Cell B | -7200 |

**Your value may differ!** Always calibrate with known weights.

---

**Document Version:** 1.0  
**Date:** November 24, 2025  
**Author:** Koi Fish Friend Team
