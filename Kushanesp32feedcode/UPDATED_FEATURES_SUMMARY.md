# Updated Kushanesp32feedcode.ino - Feature Summary

## ✅ NEW FEATURES ADDED (from LoadCellFeeder.ino)

### 1. **Weight-Based Automatic Feeding**
- `startWeightBasedFeeding(float targetGrams)` - Start feeding with gram target
- `checkWeightAndControl()` - Monitors weight every 500ms and stops at target
- Automatically tares scale before each feeding session
- Tracks total grams dispensed (`totalGramsFed`)

### 2. **NTP Time Synchronization**
- `setupNTP()` - Connects to pool.ntp.org for real date/time
- `getCurrentTime()` - Returns current time as "HH:MM" string
- `getCurrentHour()`, `getCurrentMinute()`, `getCurrentDay()` - Individual time components
- `printLocalTime()` - Displays full date/time to serial
- Configurable timezone offset (`gmtOffset_sec`)

### 3. **Scheduled Feeding System**
- `checkScheduledFeedings()` - Checks every 30 seconds for scheduled feeds
- Supports up to 10 schedules via MQTT
- Schedule format: `{time: "HH:MM", amount: 100, enabled: true, pondId: "pond1"}`
- Prevents duplicate execution (tracks `lastExecutedDay`)
- Automatically triggers weight-based feeding at scheduled times

### 4. **Variable Resistor ESC Control**
- `readESCSpeedFromPotentiometer()` - Reads GPIO 36 every 200ms
- Maps analog value (0-4095) to ESC percentage (0-100%)
- Stored in `escSpeedFromPot` variable
- Can override manual ESC commands

### 5. **Enhanced MQTT Commands**
- **Tare Command**: `{"action": "tare"}` - Zero the load cell
- **Calibrate Command**: `{"action": "calibrate", "factor": -7050}` - Set calibration
- **Weight Start**: `{"action": "start", "targetWeight": 100}` - Feed until 100g reached
- **Schedule Topic**: Receives schedule array from backend

### 6. **Enhanced Status Reporting**
Now includes:
- `escPotPercent` - Current potentiometer reading
- `targetWeight` - Current target weight (if weight-based)
- `totalGrams` - Total grams fed across all sessions
- `timeInitialized` - Whether NTP sync succeeded
- `currentTime` - Current time string
- `scheduleCount` - Number of active schedules

### 7. **Improved OLED Display**
- Shows current time when NTP synced (replaces WiFi/MQTT status)
- Weight progress: "W:45/100g" during weight-based feeding
- Total stats: "Feeds:12 T:1250g" when idle
- Auto-switches display based on feeding mode

---

## ✅ PRESERVED EXISTING FEATURES (from original Kushanesp32feedcode.ino)

### 1. **ESC Smooth Ramping**
- Gradual speed increase over 8 seconds
- Prevents sudden motor starts
- Parameters: `escStartPercent`, `escTargetPercent`, `escRampTimeSeconds`
- Uses `escRampStartTime` and `escRampDuration`

### 2. **Homing Functionality**
- `isHoming` flag for homing mode
- `currentStepPosition` tracks stepper position
- Stops automatically at position 187
- Publishes `"homing_complete"` status

### 3. **Position Tracking**
- Counts steps during rotation
- Resets after full revolution (`stepsPerRevolution = 200`)
- Used for precise motor control

### 4. **Feed Count**
- `feedCount` - Total number of feeding sessions
- Incremented on each start command
- Displayed on OLED and in MQTT status

### 5. **RPM Calculation**
- `calculateStepperRPM(int delayMicros)` - Calculates motor speed
- Displayed on OLED when stepper active
- Shows "SLEEP" when motor disabled

### 6. **Manual Feeding Mode**
- Start command without `targetWeight` triggers manual mode
- Uses ESC ramping
- Runs until stop command received
- Compatible with existing backend/frontend

---

## 🔧 HARDWARE CONFIGURATION

All GPIO pins remain unchanged:

| Component | GPIO Pin | Purpose |
|-----------|----------|---------|
| HX711 Data | GPIO 39 | Load cell data (input-only) |
| HX711 Clock | GPIO 32 | Load cell clock |
| NEMA 17 STEP | GPIO 26 | Stepper pulse |
| NEMA 17 DIR | GPIO 27 | Stepper direction |
| NEMA 17 SLEEP | GPIO 12 | Enable/disable motor |
| ESC Signal | GPIO 25 | ESC PWM control |
| **Variable Resistor** | **GPIO 36** | **ESC speed control (NEW)** |
| OLED SDA | GPIO 21 | I2C data |
| OLED SCL | GPIO 22 | I2C clock |

---

## 📡 MQTT TOPICS

### Command Topic
`koi/devices/feed_device_001/feeding/command`

**Commands:**
```json
// Weight-based feeding
{"action": "start", "targetWeight": 100}

// Manual feeding (with ramping)
{
  "action": "start",
  "stepperSpeed": 500,
  "escStartPercent": 10,
  "escTargetPercent": 35,
  "escRampTimeSeconds": 8
}

// Stop feeding
{"action": "stop"}

// Tare load cell
{"action": "tare"}

// Calibrate load cell
{"action": "calibrate", "factor": -7050}

// Request status
{"action": "status"}
```

### Schedule Topic (NEW)
`koi/devices/feed_device_001/feeding/schedule`

**Format:**
```json
{
  "schedules": [
    {"time": "08:00", "amount": 100, "enabled": true, "pondId": "pond1"},
    {"time": "14:00", "amount": 150, "enabled": true, "pondId": "pond1"},
    {"time": "20:00", "amount": 100, "enabled": false, "pondId": "pond1"}
  ]
}
```

### Status Topic
`koi/devices/feed_device_001/feeding/status`

**Published Events:**
- `online` - Device connected
- `feeding_started` - Manual feeding started
- `weight_feeding_started` - Weight-based feeding started
- `feeding_stopped` - Feeding stopped
- `weight_target_reached` - Target weight achieved
- `schedule_executed` - Scheduled feeding triggered
- `tared` - Load cell zeroed
- `calibrated` - Calibration updated
- `schedules_updated` - Schedules received
- `homing_complete` - Motor at position 187
- `status_report` - Response to status request

---

## 🚀 USAGE EXAMPLES

### Example 1: Weight-Based Feeding (100g)
```json
MQTT Publish to: koi/devices/feed_device_001/feeding/command
{
  "action": "start",
  "targetWeight": 100
}
```
**Result:** Device will:
1. Tare the scale
2. Start NEMA 17 and ESC motors
3. Monitor weight every 500ms
4. Stop automatically when 100g reached
5. Publish `"weight_target_reached"` status

### Example 2: Schedule Daily Feedings
```json
MQTT Publish to: koi/devices/feed_device_001/feeding/schedule
{
  "schedules": [
    {"time": "10:00", "amount": 100, "enabled": true, "pondId": "pond1"}
  ]
}
```
**Result:** Device will:
1. Store schedule in memory
2. Check time every 30 seconds
3. At 10:00 AM, automatically start 100g feeding
4. Execute only once per day
5. Publish `"schedule_executed"` status

### Example 3: Manual Feeding with Ramping
```json
MQTT Publish to: koi/devices/feed_device_001/feeding/command
{
  "action": "start",
  "stepperSpeed": 500,
  "escStartPercent": 10,
  "escTargetPercent": 35,
  "escRampTimeSeconds": 8
}
```
**Result:** Original behavior preserved - ESC ramps from 10% to 35% over 8 seconds

---

## 🔄 MIGRATION NOTES

### What Changed:
1. **Schedule topic subscription** added to MQTT reconnect
2. **Weight-based feeding logic** added to command handler
3. **Tare and calibrate** commands added
4. **NTP setup** called in `setup()`
5. **New function calls** in `loop()`:
   - `readESCSpeedFromPotentiometer()`
   - `checkWeightAndControl()`
   - `checkScheduledFeedings()`
6. **Display updated** to show time and weight progress
7. **Status messages** expanded with new fields

### What Stayed the Same:
- All original ESC ramping logic
- Homing functionality
- Position tracking
- Manual feeding mode
- Hardware pinout
- Core stepper/ESC control functions

---

## ⚙️ CONFIGURATION

### Timezone Adjustment
```cpp
const long gmtOffset_sec = 0;           // Change to your timezone (e.g., 19800 for GMT+5:30)
const int daylightOffset_sec = 0;       // Daylight saving offset
```

### Load Cell Calibration
```cpp
float calibrationFactor = -7050.0;      // Adjust based on your load cell
```

### Weight Check Interval
```cpp
const unsigned long weightCheckInterval = 500; // Check every 500ms
```

### Schedule Check Interval
```cpp
if (millis() - lastCheck < 30000) return;  // Check every 30 seconds
```

---

## 📊 Status Report Example

```json
{
  "deviceId": "feed_device_001",
  "status": "weight_feeding_started",
  "feedingActive": true,
  "stepperActive": true,
  "stepperSpeed": 500,
  "escPercent": 35,
  "escPotPercent": 42,
  "feedCount": 5,
  "weight": 45.3,
  "targetWeight": 100.0,
  "totalGrams": 523.7,
  "timeInitialized": true,
  "currentTime": "10:23",
  "scheduleCount": 3
}
```

---

## ✅ TESTING CHECKLIST

- [ ] Load cell reads weight correctly
- [ ] Tare command zeros the scale
- [ ] Weight-based feeding stops at target
- [ ] Variable resistor changes ESC speed
- [ ] NTP time synchronization works
- [ ] Schedules execute at correct time
- [ ] Manual feeding with ramping still works
- [ ] Homing function returns to position 187
- [ ] OLED displays time when synced
- [ ] All MQTT topics publish/subscribe correctly
- [ ] Feed count increments properly
- [ ] Total grams accumulates across sessions

---

## 🎯 SUMMARY

**Updated Code = Best of Both Worlds**
- ✅ LoadCellFeeder.ino features (weight control, NTP, schedules, pot control)
- ✅ Kushanesp32feedcode.ino features (ramping, homing, position tracking)
- ✅ Fully backward compatible with existing backend/frontend
- ✅ Zero functions removed, only additions

**Total New Lines Added:** ~220 lines
**Functions Removed:** 0
**Breaking Changes:** None
