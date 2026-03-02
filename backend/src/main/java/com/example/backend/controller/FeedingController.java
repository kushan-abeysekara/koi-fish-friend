package com.example.backend.controller;

import com.example.backend.dto.ApiResponse;
import com.example.backend.service.MqttService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/feeding")
@CrossOrigin(origins = "*")
public class FeedingController {

    @Autowired
    private MqttService mqttService;

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
}
