package com.example.backend.controller;

import com.example.backend.service.SupabaseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * ESP32 Device Data Controller
 *
 * REST API for ESP32 devices to POST sensor data directly.
 * Saves to Supabase feeddb table (UPSERT per device).
 *
 * Expected JSON POST:
 * {
 *   "weight": 138,
 *   "deviceId": "feed_device_001",
 *   "tankLevel": 1500,
 *   "tankCapacity": 20000,
 *   "tankPercentage": 7.5,
 *   "motorStatus": "RUNNING",
 *   "motorRuntime": 300
 * }
 *
 * Endpoints:
 *   POST /api/device/data          → Receive ESP32 sensor data
 *   GET  /api/device/status        → Get latest device status
 *   GET  /api/device/history       → Get device history
 */
@RestController
@RequestMapping("/api/device")
@CrossOrigin(origins = "*")
public class DeviceDataController {

    @Autowired
    private SupabaseService supabaseService;

    /**
     * Receive sensor data from ESP32.
     * Upserts into Supabase feeddb table.
     */
    @PostMapping("/data")
    public ResponseEntity<Map<String, Object>> receiveDeviceData(
            @RequestBody Map<String, Object> data) {

        String deviceId = String.valueOf(data.getOrDefault("deviceId", "feed_device_001"));

        try {
            double weight = toDouble(data.getOrDefault("weight", 0));
            double tankLevel = toDouble(data.getOrDefault("tankLevel", 0));
            double tankCapacity = toDouble(data.getOrDefault("tankCapacity", 20000));
            double tankPercentage = toDouble(data.getOrDefault("tankPercentage", 0));
            String motorStatus = String.valueOf(data.getOrDefault("motorStatus", "STOPPED"));
            int motorRuntime = toInt(data.getOrDefault("motorRuntime", 0));
            int feedCount = toInt(data.getOrDefault("feedCount", 0));
            double totalGramsFed = toDouble(data.getOrDefault("totalGramsFed", 0));
            int rssi = toInt(data.getOrDefault("rssi", 0));
            String ipAddress = String.valueOf(data.getOrDefault("ipAddress", ""));

            // UPSERT into feeddb
            String sql = String.format(
                    "INSERT INTO feeddb (device_id, weight, tank_level, tank_capacity, tank_percentage, " +
                    "motor_status, motor_rpm, feed_count, total_grams_fed, rssi, ip_address, updated_at) " +
                    "VALUES ('%s', %.2f, %.2f, %.2f, %.2f, '%s', %d, %d, %.2f, %d, '%s', NOW()) " +
                    "ON CONFLICT (device_id) DO UPDATE SET " +
                    "weight = EXCLUDED.weight, tank_level = EXCLUDED.tank_level, " +
                    "tank_capacity = EXCLUDED.tank_capacity, tank_percentage = EXCLUDED.tank_percentage, " +
                    "motor_status = EXCLUDED.motor_status, motor_rpm = EXCLUDED.motor_rpm, " +
                    "feed_count = EXCLUDED.feed_count, total_grams_fed = EXCLUDED.total_grams_fed, " +
                    "rssi = EXCLUDED.rssi, ip_address = EXCLUDED.ip_address, updated_at = NOW()",
                    deviceId, weight, tankLevel, tankCapacity, tankPercentage,
                    motorStatus, motorRuntime, feedCount, totalGramsFed, rssi, ipAddress
            );

            supabaseService.queryRows(sql);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Data received and stored");
            response.put("deviceId", deviceId);
            response.put("timestamp", java.time.Instant.now().toString());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", "Failed to store data: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    /**
     * Get latest device status from feeddb.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getDeviceStatus(
            @RequestParam(defaultValue = "feed_device_001") String deviceId) {

        try {
            List<Map<String, Object>> rows = supabaseService.queryRows(
                    "SELECT *, EXTRACT(EPOCH FROM (now() - updated_at))::float AS age_seconds " +
                    "FROM feeddb WHERE device_id = '" + deviceId + "' LIMIT 1"
            );

            if (rows.isEmpty()) {
                Map<String, Object> notFound = new HashMap<>();
                notFound.put("deviceId", deviceId);
                notFound.put("status", "unknown");
                notFound.put("message", "No data found for device");
                return ResponseEntity.ok(notFound);
            }

            Map<String, Object> row = rows.get(0);
            double age = toDouble(row.getOrDefault("age_seconds", 999));
            row.put("status", age < 15 ? "online" : "offline");
            row.put("lastSeenSecondsAgo", Math.round(age));

            return ResponseEntity.ok(row);

        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Failed to fetch status: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    /**
     * Get device weight history for charts.
     */
    @GetMapping("/history")
    public ResponseEntity<Object> getDeviceHistory(
            @RequestParam(defaultValue = "feed_device_001") String deviceId,
            @RequestParam(defaultValue = "24") int hours,
            @RequestParam(defaultValue = "500") int limit) {

        try {
            List<Map<String, Object>> rows = supabaseService.queryRows(
                    "SELECT * FROM weight_history WHERE device_id = '" + deviceId +
                    "' AND recorded_at > now() - interval '" + hours + " hours' " +
                    "ORDER BY recorded_at ASC LIMIT " + limit
            );

            return ResponseEntity.ok(rows);

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                    Map.of("error", "Failed to fetch history: " + e.getMessage())
            );
        }
    }

    private double toDouble(Object val) {
        if (val instanceof Number) return ((Number) val).doubleValue();
        try { return Double.parseDouble(String.valueOf(val)); } catch (Exception e) { return 0; }
    }

    private int toInt(Object val) {
        if (val instanceof Number) return ((Number) val).intValue();
        try { return Integer.parseInt(String.valueOf(val)); } catch (Exception e) { return 0; }
    }
}
