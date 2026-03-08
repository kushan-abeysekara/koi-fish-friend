package com.example.backend.controller;

import com.example.backend.service.MqttService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/boat")
@CrossOrigin(origins = "*")
public class BoatController {

    @Autowired
    private MqttService mqttService;

    /**
     * Returns the latest cached boat sensor data.
     * This is a REST polling fallback for when MQTT WSS and WebSocket relay don't deliver data.
     */
    @GetMapping("/telemetry")
    public ResponseEntity<?> getLatestTelemetry() {
        String payload = mqttService.getLastBoatPayload();
        if (payload == null) {
            return ResponseEntity.ok(Map.of(
                "success", false,
                "message", "No boat telemetry received yet",
                "mqttConnected", mqttService.isConnected()
            ));
        }
        // Return raw JSON payload as-is (same format as MQTT/WS relay)
        return ResponseEntity.ok().header("Content-Type", "application/json").body(payload);
    }

    @PostMapping("/command")
    public ResponseEntity<?> sendBoatCommand(@RequestBody Map<String, Object> command) {
        try {
            String commandType = (String) command.get("command");
            Integer speed = command.get("speed") != null ? (Integer) command.get("speed") : 128;

            // Create JSON payload
            String payload = String.format("{\"command\":\"%s\",\"speed\":%d}", commandType, speed);
            
            // Publish to MQTT
            mqttService.publishMessage("koifish/boat/command", payload);

            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Command sent successfully",
                "command", commandType,
                "speed", speed
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "message", "Error sending command: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/status")
    public ResponseEntity<?> getBoatStatus() {
        try {
            // Return latest boat status from MQTT or database
            return ResponseEntity.ok(Map.of(
                "success", true,
                "connected", mqttService.isConnected(),
                "message", "Boat status retrieved"
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "message", "Error getting status: " + e.getMessage()
            ));
        }
    }

    @PostMapping("/mode")
    public ResponseEntity<?> setBoatMode(@RequestBody Map<String, String> modeData) {
        try {
            String mode = modeData.get("mode"); // "AUTO" or "MANUAL"
            
            // Publish mode change to MQTT
            String payload = String.format("{\"command\":\"%s\"}", mode);
            mqttService.publishMessage("koifish/boat/command", payload);

            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Mode changed to " + mode,
                "mode", mode
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "message", "Error changing mode: " + e.getMessage()
            ));
        }
    }
}
