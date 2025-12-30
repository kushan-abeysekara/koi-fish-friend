# Feeding Dashboard Button Behavior

## Dashboard URL
`http://localhost:5173/dashboard/feeding-dashboard`

## Quick Actions Section

### 1. Start Feeding Button 🟢

#### Button States:
- **Enabled** (Green): When feeder status is "Ready"
- **Disabled** (Gray): When feeding is already in progress or feeder is blocked

#### When Clicked:
1. **Frontend Action**:
   - Button becomes disabled
   - Loading indicator appears: "Feeding in progress..."
   - Status changes to "Feeding"

2. **Backend API Call**:
   ```
   POST http://localhost:8080/api/feeding/start?deviceId=feed_device_001
   ```

3. **MQTT Command Sent**:
   ```json
   {
     "command": "feeding",
     "data": {
       "action": "start",
       "stepperSpeed": 500,
       "escStartPercent": 10,
       "escTargetPercent": 45,
       "escRampTimeSeconds": 8
     }
   }
   ```

4. **ESP32 Response**:
   - **NEMA 17 Motor**: 
     - Wake from sleep (resetSleepPin = HIGH)
     - Start continuous rotation
     - Speed: 500 microseconds delay (approximately 240 RPM)
     - Direction: Clockwise
   
   - **ESC Motor**:
     - Start at 10% throttle
     - Ramp smoothly to 45% over 8 seconds
     - Formula: `percent = 10 + (35 × elapsed_seconds / 8)`
     - After 8 seconds: maintain 45% continuously

5. **OLED Display Shows**:
   ```
   == FEED SYSTEM ==
   WiFi: OK    MQTT: OK
   ESC: 45%
   Stepper: 240 RPM
   Status: FEEDING
   Feeds: [count]
   ```

6. **Alert Message**:
   "Feeding started successfully! Motors running at configured speeds."

#### Motor Timeline:
```
Second 0:  ESC = 10%,  Stepper = continuous
Second 1:  ESC = 14%,  Stepper = continuous
Second 2:  ESC = 19%,  Stepper = continuous
Second 3:  ESC = 23%,  Stepper = continuous
Second 4:  ESC = 28%,  Stepper = continuous
Second 5:  ESC = 32%,  Stepper = continuous
Second 6:  ESC = 36%,  Stepper = continuous
Second 7:  ESC = 41%,  Stepper = continuous
Second 8:  ESC = 45%,  Stepper = continuous
Second 9+: ESC = 45%,  Stepper = continuous (until stop)
```

---

### 2. Stop Feeding Button 🟡

#### Button States:
- **Enabled** (Yellow): When feeding is in progress
- **Disabled** (Gray): When feeder is ready or blocked

#### When Clicked:
1. **Frontend Action**:
   - Loading indicator disappears
   - Status changes to "Ready"
   - Last feeding time updates to current time

2. **Backend API Call**:
   ```
   POST http://localhost:8080/api/feeding/stop?deviceId=feed_device_001
   ```

3. **MQTT Command Sent**:
   ```json
   {
     "command": "feeding",
     "data": {
       "action": "stop"
     }
   }
   ```

4. **ESP32 Response**:
   - **NEMA 17 Motor**: 
     - Stop rotation immediately
     - Enter sleep mode (resetSleepPin = LOW)
     - Driver powers down to save energy
   
   - **ESC Motor**:
     - Ramp down to 0%
     - Stop motor

5. **OLED Display Shows**:
   ```
   == FEED SYSTEM ==
   WiFi: OK    MQTT: OK
   ESC: 0%
   Stepper: SLEEP
   Status: READY
   Feeds: [count]
   ```

6. **Alert Message**:
   "Feeding stopped successfully. Motors are in sleep mode."

---

### 3. Emergency Stop Button 🔴

#### Button States:
- **Always Enabled** (Red): Available at all times for safety

#### When Clicked:
1. **Confirmation Dialog**:
   "Are you sure you want to execute EMERGENCY STOP?"
   - Cancel: No action taken
   - OK: Proceed with emergency stop

2. **Frontend Action** (if confirmed):
   - Immediately set feeding to inactive
   - Status changes to "Blocked"

3. **Backend API Call**:
   ```
   POST http://localhost:8080/api/feeding/stop?deviceId=feed_device_001
   ```

4. **MQTT Command Sent**:
   Same as Stop command (immediate stop)

5. **ESP32 Response**:
   - **ALL MOTORS STOP IMMEDIATELY**
   - NEMA 17: Stop + Sleep mode
   - ESC: 0%
   - No gradual ramp-down (emergency!)

6. **OLED Display Shows**:
   ```
   == FEED SYSTEM ==
   WiFi: OK    MQTT: OK
   ESC: 0%
   Stepper: SLEEP
   Status: READY
   Feeds: [count]
   ```

7. **Alert Message**:
   "EMERGENCY STOP activated! All motors stopped immediately."

---

## Visual Button Layout

```
┌─────────────────────────────────────────────────────────────┐
│                      Quick Actions                          │
├─────────────────┬─────────────────┬─────────────────────────┤
│  🟢 Start Feed  │  🟡 Stop Feed   │  🔴 Emergency Stop      │
│  ┌───────────┐  │  ┌───────────┐  │  ┌───────────────────┐ │
│  │    ▶️      │  │  │    ⏸️      │  │  │        ⚠️         │ │
│  │   START    │  │  │    STOP    │  │  │   EMERGENCY      │ │
│  │  FEEDING   │  │  │  FEEDING   │  │  │      STOP        │ │
│  └───────────┘  │  └───────────┘  │  └───────────────────┘ │
│                 │                 │                         │
│  Enabled when   │  Enabled when   │  Always enabled         │
│  Ready          │  Feeding        │  (Safety feature)       │
└─────────────────┴─────────────────┴─────────────────────────┘
```

---

## Feeding Status Indicator

### During Normal Operation:
```
┌────────────────────────────────┐
│  Status: Ready                 │  (Green badge)
│  Last Feeding: 08:30 AM        │
│  Battery: 87%                  │
│  Hopper Level: 45.5 kg         │
└────────────────────────────────┘
```

### During Feeding:
```
┌────────────────────────────────┐
│  Status: Feeding               │  (Blue badge)
│  🔄 Feeding in progress...     │
│  Battery: 87%                  │
│  Hopper Level: 45.5 kg         │
└────────────────────────────────┘
```

### After Emergency Stop:
```
┌────────────────────────────────┐
│  Status: Blocked               │  (Red badge)
│  ⚠️ System halted              │
│  Battery: 87%                  │
│  Hopper Level: 45.5 kg         │
└────────────────────────────────┘
```

---

## Motor Behavior Summary

| Button Clicked | NEMA 17 Action | ESC Action | Duration |
|----------------|----------------|------------|----------|
| Start Feeding | Wake + Continuous @ 500μs | Ramp 10%→45% over 8s | Until stopped |
| Stop Feeding | Stop + Sleep | 0% | Immediate |
| Emergency Stop | Stop + Sleep | 0% | Immediate |

---

## Key Features

### ✅ Smooth ESC Ramp
- Prevents sudden motor stress
- Gradual acceleration over 8 seconds
- Protects motor and power supply

### ✅ Power-Efficient Sleep Mode
- NEMA 17 sleeps when idle
- Reduces heat generation
- Saves battery/power
- Instant wake-up (10ms)

### ✅ Continuous Operation
- Stepper runs non-stop during feeding
- ESC maintains 45% after ramp
- No manual intervention needed
- Consistent feed distribution

### ✅ Safety Features
- Emergency stop always available
- Confirmation dialog prevents accidents
- Immediate motor shutdown
- Status indicators for monitoring

---

## Testing Checklist

- [ ] Click "Start Feeding" - Motors start
- [ ] OLED shows "FEEDING" status
- [ ] ESC ramps from 10% to 45% over 8 seconds
- [ ] NEMA 17 rotates continuously
- [ ] Click "Stop Feeding" - Motors stop
- [ ] OLED shows "SLEEP" and "0%"
- [ ] Click "Emergency Stop" - Immediate halt
- [ ] Status updates on dashboard
- [ ] Backend logs show MQTT messages
- [ ] ESP32 serial monitor shows commands received
