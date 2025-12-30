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
     * Start feeding operation
     * - NEMA 17 stepper motor runs continuously at speed 500
     * - ESC motor ramps from 10% to 45% over 8 seconds, then maintains 45%
     */
    @PostMapping("/start")
    public ResponseEntity<ApiResponse> startFeeding(@RequestParam(required = false, defaultValue = "feed_device_001") String deviceId) {
        try {
            Map<String, Object> commandData = new HashMap<>();
            commandData.put("action", "start");
            commandData.put("stepperSpeed", 500);
            commandData.put("escStartPercent", 10);
            commandData.put("escTargetPercent", 45);
            commandData.put("escRampTimeSeconds", 8);

            mqttService.sendFeedingCommand(deviceId, "feeding", commandData);

            Map<String, Object> result = new HashMap<>();
            result.put("deviceId", deviceId);
            result.put("status", "feeding_started");
            result.put("message", "Feeding operation started successfully");

            return ResponseEntity.ok(new ApiResponse(true, "Feeding started", result));
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
}
