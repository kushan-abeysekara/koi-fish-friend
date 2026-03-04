package com.example.backend.controller;

import com.example.backend.dto.ApiResponse;
import com.example.backend.entity.FeedingHistory;
import com.example.backend.entity.SensorDevice;
import com.example.backend.repository.FeedingHistoryRepository;
import com.example.backend.repository.SensorDeviceRepository;
import com.example.backend.service.MqttService;
import com.example.backend.service.SupabaseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/feeding")
@CrossOrigin(origins = "*")
public class FeedingController {

    @Autowired
    private MqttService mqttService;

    @Autowired
    private FeedingHistoryRepository feedingHistoryRepository;

    @Autowired
    private SensorDeviceRepository sensorDeviceRepository;

    @Autowired
    private SupabaseService supabaseService;

    /**
     * Start feeding operation with weight-based control
     * - Dispenses specific amount in grams using load cell
     * - NEMA 17 stepper motor dispenses feed
     * - ESC motor distributes feed (speed controlled by potentiometer)
     * - Automatically stops when target weight is reached
     */
    @PostMapping("/start")
    public ResponseEntity<ApiResponse> startFeeding(
            @RequestParam(required = false, defaultValue = "feed_device_001") String deviceId,
            @RequestParam(required = false) Float targetWeight,
            @RequestParam(required = false, defaultValue = "500") Integer stepperSpeed,
            @RequestParam(required = false) Integer escPercent) {
        try {
            Map<String, Object> commandData = new HashMap<>();
            commandData.put("action", "start");
            
            // Weight-based feeding mode
            if (targetWeight != null && targetWeight > 0) {
                commandData.put("targetWeight", targetWeight);
                commandData.put("stepperSpeed", stepperSpeed);
                
                Map<String, Object> result = new HashMap<>();
                result.put("deviceId", deviceId);
                result.put("status", "feeding_started");
                result.put("targetWeight", targetWeight);
                result.put("message", "Weight-based feeding started: " + targetWeight + "g");
                
                mqttService.sendFeedingCommand(deviceId, "feeding", commandData);
                return ResponseEntity.ok(new ApiResponse(true, "Feeding started", result));
            }
            // Manual feeding mode (no weight target)
            else {
                commandData.put("stepperSpeed", stepperSpeed);
                if (escPercent != null) {
                    commandData.put("escPercent", escPercent);
                }
                
                Map<String, Object> result = new HashMap<>();
                result.put("deviceId", deviceId);
                result.put("status", "manual_feeding_started");
                result.put("message", "Manual feeding started");
                
                mqttService.sendFeedingCommand(deviceId, "feeding", commandData);
                return ResponseEntity.ok(new ApiResponse(true, "Manual feeding started", result));
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse(false, "Failed to start feeding: " + e.getMessage(), null));
        }
    }

    /**
     * Stop feeding operation
     * - Stops all motors
     * - Puts NEMA 17 into sleep mode
     */
    @PostMapping("/stop")
    public ResponseEntity<ApiResponse> stopFeeding(@RequestParam(required = false, defaultValue = "feed_device_001") String deviceId) {
        try {
            Map<String, Object> commandData = new HashMap<>();
            commandData.put("action", "stop");

            mqttService.sendFeedingCommand(deviceId, "feeding", commandData);

            Map<String, Object> result = new HashMap<>();
            result.put("deviceId", deviceId);
            result.put("status", "feeding_stopped");
            result.put("message", "Feeding operation stopped successfully");

            return ResponseEntity.ok(new ApiResponse(true, "Feeding stopped", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse(false, "Failed to stop feeding: " + e.getMessage(), null));
        }
    }

    /**
     * Get feeding device status
     */
    @GetMapping("/status")
    public ResponseEntity<ApiResponse> getFeedingStatus(@RequestParam(required = false, defaultValue = "feed_device_001") String deviceId) {
        try {
            // Request status from device
            Map<String, Object> commandData = new HashMap<>();
            commandData.put("action", "status");

            mqttService.sendFeedingCommand(deviceId, "feeding", commandData);

            Map<String, Object> result = new HashMap<>();
            result.put("deviceId", deviceId);
            result.put("message", "Status request sent to device");

            return ResponseEntity.ok(new ApiResponse(true, "Status request sent", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse(false, "Failed to get status: " + e.getMessage(), null));
        }
    }

    /**
     * Tare (zero) the load cell
     */
    @PostMapping("/tare")
    public ResponseEntity<ApiResponse> tareLoadCell(@RequestParam(required = false, defaultValue = "feed_device_001") String deviceId) {
        try {
            Map<String, Object> commandData = new HashMap<>();
            commandData.put("action", "tare");

            mqttService.sendFeedingCommand(deviceId, "feeding", commandData);

            Map<String, Object> result = new HashMap<>();
            result.put("deviceId", deviceId);
            result.put("message", "Load cell tared successfully");

            return ResponseEntity.ok(new ApiResponse(true, "Load cell tared", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse(false, "Failed to tare load cell: " + e.getMessage(), null));
        }
    }

    /**
     * Calibrate the load cell
     */
    @PostMapping("/calibrate")
    public ResponseEntity<ApiResponse> calibrateLoadCell(
            @RequestParam(required = false, defaultValue = "feed_device_001") String deviceId,
            @RequestParam Float calibrationFactor) {
        try {
            Map<String, Object> commandData = new HashMap<>();
            commandData.put("action", "calibrate");
            commandData.put("factor", calibrationFactor);

            mqttService.sendFeedingCommand(deviceId, "feeding", commandData);

            Map<String, Object> result = new HashMap<>();
            result.put("deviceId", deviceId);
            result.put("calibrationFactor", calibrationFactor);
            result.put("message", "Load cell calibrated");

            return ResponseEntity.ok(new ApiResponse(true, "Load cell calibrated", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse(false, "Failed to calibrate: " + e.getMessage(), null));
        }
    }

    /**
     * Send feeding schedules to device
     */
    @PostMapping("/schedule")
    public ResponseEntity<ApiResponse> sendSchedules(
            @RequestParam(required = false, defaultValue = "feed_device_001") String deviceId,
            @RequestBody Map<String, Object> scheduleData) {
        try {
            // Send schedules directly to schedule topic (not command topic)
            String topic = "koi/devices/" + deviceId + "/feeding/schedule";
            mqttService.sendMqttMessage(topic, scheduleData);

            Map<String, Object> result = new HashMap<>();
            result.put("deviceId", deviceId);
            result.put("message", "Schedules sent to device");

            return ResponseEntity.ok(new ApiResponse(true, "Schedules updated", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse(false, "Failed to send schedules: " + e.getMessage(), null));
        }
    }

    /**
     * Diagnostic: control individual motors for testing
     * Actions: diag_stepper_on, diag_stepper_off, diag_esc_on, diag_esc_off, diag_all_stop, diag_report
     */
    @PostMapping("/diagnostic")
    public ResponseEntity<ApiResponse> diagnosticCommand(
            @RequestParam(required = false, defaultValue = "feed_device_001") String deviceId,
            @RequestParam String action,
            @RequestParam(required = false) Integer stepperSpeed,
            @RequestParam(required = false) Integer escPercent) {
        try {
            Map<String, Object> commandData = new HashMap<>();
            commandData.put("action", action);
            if (stepperSpeed != null) commandData.put("stepperSpeed", stepperSpeed);
            if (escPercent != null) commandData.put("escPercent", escPercent);

            mqttService.sendFeedingCommand(deviceId, "feeding", commandData);

            Map<String, Object> result = new HashMap<>();
            result.put("deviceId", deviceId);
            result.put("action", action);
            result.put("message", "Diagnostic command sent: " + action);

            return ResponseEntity.ok(new ApiResponse(true, "Diagnostic command sent", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse(false, "Failed to send diagnostic: " + e.getMessage(), null));
        }
    }

    // ─── MySQL-backed device status (reads from sensor_devices, updated by MQTT) ───

    /**
     * Get real-time device status from MySQL sensor_devices table.
     * MQTT handler updates this table on every message (~every 1s).
     * Includes staleness check: if last_seen > 15s ago, mark as offline.
     */
    @GetMapping("/device-status")
    public ResponseEntity<Map<String, Object>> getDeviceStatusFromMySQL(
            @RequestParam(defaultValue = "feed_device_001") String deviceId) {
        try {
            var optDevice = sensorDeviceRepository.findByDeviceId(deviceId);
            if (optDevice.isEmpty()) {
                return ResponseEntity.ok(Map.of("status", "offline", "device_id", deviceId));
            }
            SensorDevice dev = optDevice.get();

            // Staleness check: if last_seen is > 15s ago, device is offline
            boolean isOnline = dev.getLastSeen() != null &&
                    dev.getLastSeen().isAfter(LocalDateTime.now().minusSeconds(15));

            // Map MySQL fields to the same JSON keys the frontend expects (feeddb schema)
            Map<String, Object> status = new HashMap<>();
            status.put("device_id", dev.getDeviceId());
            status.put("status", isOnline ? "online" : "offline");
            status.put("weight", dev.getCurrentWeight() != null ? dev.getCurrentWeight() : 0);
            status.put("tank_level", dev.getHopperLevel() != null ? dev.getHopperLevel() : 0);
            status.put("tank_capacity", dev.getHopperCapacity() != null ? dev.getHopperCapacity() : 20000);
            status.put("tank_percentage", dev.getHopperPercentage() != null ? dev.getHopperPercentage() : 0);
            status.put("motor_status", dev.getMotorStatus() != null ? dev.getMotorStatus() : "STOPPED");
            status.put("motor_rpm", dev.getPlateSpeed() != null ? dev.getPlateSpeed() : 0);
            status.put("esc_percent", 0); // Not stored in MySQL; ESP32 sends it but we don't persist ESC
            status.put("feeding_active", dev.getFeedingActive() != null ? dev.getFeedingActive() : false);
            status.put("feed_count", dev.getFeedCount() != null ? dev.getFeedCount() : 0);
            status.put("total_grams_fed", dev.getTotalGramsFed() != null ? dev.getTotalGramsFed() : 0);
            status.put("target_weight", dev.getTargetWeight() != null ? dev.getTargetWeight() : 0);
            status.put("rssi", dev.getRssi() != null ? dev.getRssi() : 0);
            status.put("ip_address", dev.getIpAddress());
            status.put("uptime_ms", 0); // Not stored in MySQL entity
            status.put("updated_at", dev.getLastSeen() != null ? dev.getLastSeen().toString() : null);

            return ResponseEntity.ok(status);
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    /**
     * Get weight history from Supabase weight_history table.
     * Used for Live Weight Monitor and Hopper Level Trend charts.
     */
    @GetMapping("/history")
    public ResponseEntity<List<Map<String, Object>>> getFeedingHistory(
            @RequestParam(defaultValue = "feed_device_001") String deviceId,
            @RequestParam(defaultValue = "24") int hours,
            @RequestParam(defaultValue = "2000") int limit) {
        try {
            List<Map<String, Object>> rows = supabaseService.getFeedingHistory(deviceId, hours, limit);
            return ResponseEntity.ok(rows);
        } catch (Exception e) {
            System.err.println("[FeedingHistory] Error fetching from Supabase: " + e.getMessage());
            return ResponseEntity.ok(List.of());
        }
    }

    /**
     * Get feeding events (start/stop) from Supabase feeding_history table.
     */
    @GetMapping("/events")
    public ResponseEntity<List<Map<String, Object>>> getFeedingEvents(
            @RequestParam(defaultValue = "feed_device_001") String deviceId,
            @RequestParam(defaultValue = "72") int hours,
            @RequestParam(defaultValue = "100") int limit) {
        try {
            List<Map<String, Object>> events = supabaseService.getFeedingEvents(deviceId, hours, limit);
            return ResponseEntity.ok(events);
        } catch (Exception e) {
            System.err.println("[FeedingHistory] Error fetching events from Supabase: " + e.getMessage());
            return ResponseEntity.ok(List.of());
        }
    }

    /**
     * Get feeding stats from Supabase.
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getFeedingStats(
            @RequestParam(defaultValue = "feed_device_001") String deviceId,
            @RequestParam(defaultValue = "24") int hours) {
        try {
            Map<String, Object> stats = supabaseService.getFeedingStats(deviceId);
            stats.put("deviceId", deviceId);
            stats.put("hoursBack", hours);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get weight history specifically for charts (Supabase weight_history table).
     */
    @GetMapping("/weight-history")
    public ResponseEntity<List<Map<String, Object>>> getWeightHistory(
            @RequestParam(defaultValue = "feed_device_001") String deviceId,
            @RequestParam(defaultValue = "24") int hours,
            @RequestParam(defaultValue = "5000") int limit) {
        try {
            List<Map<String, Object>> rows = supabaseService.getWeightHistory(deviceId, hours, limit);
            return ResponseEntity.ok(rows);
        } catch (Exception e) {
            System.err.println("[WeightHistory] Error fetching from Supabase: " + e.getMessage());
            return ResponseEntity.ok(List.of());
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Manual Feeding endpoints (Supabase manual_feedings table)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Start a manual feeding — records in Supabase and sends MQTT start command.
     * Body: { "deviceId": "feed_device_001", "amount": 1.0, "unit": "kg", "tankBefore": 4.5 }
     */
    @PostMapping("/manual-feeding/start")
    public ResponseEntity<Map<String, Object>> startManualFeeding(@RequestBody Map<String, Object> body) {
        try {
            String deviceId = (String) body.getOrDefault("deviceId", "feed_device_001");
            double amount = ((Number) body.getOrDefault("amount", 0)).doubleValue();
            String unit = (String) body.getOrDefault("unit", "kg");
            double tankBefore = ((Number) body.getOrDefault("tankBefore", 0)).doubleValue();

            // Insert record into Supabase
            Map<String, Object> result = supabaseService.createManualFeeding(deviceId, amount, unit, tankBefore);

            // Also send MQTT command to start feeding
            Map<String, Object> commandData = new java.util.HashMap<>();
            commandData.put("action", "start");
            commandData.put("targetWeight", amount);
            mqttService.sendFeedingCommand(deviceId, "feeding", commandData);
            System.out.println("[ManualFeed] ✅ Started: " + amount + unit + " from tank at " + tankBefore);

            Map<String, Object> response = new java.util.HashMap<>(result);
            response.put("status", "feeding");
            response.put("mqttSent", true);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("[ManualFeed] ❌ Error starting: " + e.getMessage());
            return ResponseEntity.ok(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Complete a manual feeding — updates Supabase record and sends MQTT stop.
     * Body: { "feedingId": 1, "tankAfter": 3.5, "actualDispensed": 1.0, "durationMs": 45000 }
     */
    @PostMapping("/manual-feeding/complete")
    public ResponseEntity<Map<String, Object>> completeManualFeeding(@RequestBody Map<String, Object> body) {
        try {
            long feedingId = ((Number) body.get("feedingId")).longValue();
            double tankAfter = ((Number) body.getOrDefault("tankAfter", 0)).doubleValue();
            double actualDispensed = ((Number) body.getOrDefault("actualDispensed", 0)).doubleValue();
            long durationMs = ((Number) body.getOrDefault("durationMs", 0)).longValue();

            supabaseService.completeManualFeeding(feedingId, tankAfter, actualDispensed, durationMs);

            // Send stop command
            Map<String, Object> commandData = new java.util.HashMap<>();
            commandData.put("action", "stop");
            mqttService.sendFeedingCommand("feed_device_001", "feeding", commandData);

            return ResponseEntity.ok(Map.of("status", "completed", "feedingId", feedingId));
        } catch (Exception e) {
            System.err.println("[ManualFeed] ❌ Error completing: " + e.getMessage());
            return ResponseEntity.ok(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Cancel a manual feeding.
     * Body: { "feedingId": 1, "tankAfter": 4.2 }
     */
    @PostMapping("/manual-feeding/cancel")
    public ResponseEntity<Map<String, Object>> cancelManualFeeding(@RequestBody Map<String, Object> body) {
        try {
            long feedingId = ((Number) body.get("feedingId")).longValue();
            double tankAfter = ((Number) body.getOrDefault("tankAfter", 0)).doubleValue();

            supabaseService.cancelManualFeeding(feedingId, tankAfter);

            // Send stop command
            Map<String, Object> commandData = new java.util.HashMap<>();
            commandData.put("action", "stop");
            mqttService.sendFeedingCommand("feed_device_001", "feeding", commandData);

            return ResponseEntity.ok(Map.of("status", "cancelled", "feedingId", feedingId));
        } catch (Exception e) {
            System.err.println("[ManualFeed] ❌ Error cancelling: " + e.getMessage());
            return ResponseEntity.ok(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get recent manual feedings history.
     */
    @GetMapping("/manual-feeding/history")
    public ResponseEntity<List<Map<String, Object>>> getManualFeedingHistory(
            @RequestParam(defaultValue = "feed_device_001") String deviceId,
            @RequestParam(defaultValue = "20") int limit) {
        try {
            List<Map<String, Object>> rows = supabaseService.getManualFeedings(deviceId, limit);
            return ResponseEntity.ok(rows);
        } catch (Exception e) {
            System.err.println("[ManualFeed] Error fetching history: " + e.getMessage());
            return ResponseEntity.ok(List.of());
        }
    }
}
