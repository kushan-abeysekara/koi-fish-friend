package com.example.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.example.backend.websocket.FeedingWebSocketHandler;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Continuously polls Supabase sensor_live table and broadcasts updates via WebSocket.
 *
 * This service runs in the backend regardless of whether any frontend client is connected,
 * ensuring:
 *   1. Sensor data is always monitored (critical alerts etc.)
 *   2. Any WebSocket client that connects immediately receives the latest data
 *   3. No dependency on MQTT for water quality data — ESP32 writes directly to Supabase
 *
 * Data flow:
 *   ESP32 → Supabase sensor_live (HTTPS UPSERT every 2s)
 *   This poller → reads sensor_live every 3s → broadcasts via WebSocket
 *   Frontend → receives via WebSocket OR subscribes to Supabase Realtime directly
 */
@Service
public class SupabaseRealtimePoller {

    private final SupabaseService supabaseService;
    private final FeedingWebSocketHandler webSocketHandler;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Track last-known updated_at per device to avoid re-broadcasting unchanged data
    private final ConcurrentHashMap<String, String> lastBroadcastTimestamp = new ConcurrentHashMap<>();

    // Cache latest water quality data for REST endpoint access
    private volatile Map<String, Object> latestWaterQualityData = new HashMap<>();

    public SupabaseRealtimePoller(SupabaseService supabaseService,
                                   FeedingWebSocketHandler webSocketHandler) {
        this.supabaseService = supabaseService;
        this.webSocketHandler = webSocketHandler;
        System.out.println("[SupabasePoller] ✅ Initialized — polling sensor_live every 3 seconds");
    }

    /**
     * Poll sensor_live table every 3 seconds.
     * Only broadcasts when new data is detected (updated_at changed).
     */
    @Scheduled(fixedRate = 3000)
    public void pollSensorLive() {
        if (!supabaseService.isEnabled()) return;

        try {
            String jsonResponse = supabaseService.readSensorLive(null); // all devices
            if (jsonResponse == null || jsonResponse.isBlank()) return;

            List<?> rows = objectMapper.readValue(jsonResponse, List.class);
            if (rows == null || rows.isEmpty()) return;

            for (Object rowObj : rows) {
                @SuppressWarnings("unchecked")
                Map<String, Object> row = (Map<String, Object>) rowObj;

                String deviceId = (String) row.getOrDefault("device_id", "");
                String updatedAt = String.valueOf(row.getOrDefault("updated_at", ""));

                if (deviceId.isBlank()) continue;

                // Only broadcast if the data actually changed (new timestamp)
                String previousTimestamp = lastBroadcastTimestamp.get(deviceId);
                if (updatedAt.equals(previousTimestamp)) continue;

                lastBroadcastTimestamp.put(deviceId, updatedAt);

                // Build a JSON payload matching the format the frontend expects
                // (camelCase keys matching MqttSensorData interface)
                Map<String, Object> payload = new HashMap<>();
                payload.put("deviceId", deviceId);
                payload.put("pondId", 3); // Water quality device is on Pond 3
                payload.put("phValue", toDouble(row.get("ph_value")));
                payload.put("turbidity", toDouble(row.get("turbidity")));
                payload.put("co2Level", toDouble(row.get("co2_level")));
                payload.put("ammonia", toDouble(row.get("ammonia")));
                payload.put("waterQualityStatus", row.getOrDefault("water_quality_status", "normal"));
                payload.put("rainLevel", toDouble(row.get("rain_level")));
                payload.put("rainDetected", toBool(row.get("rain_detected")));
                payload.put("rainStatus", row.getOrDefault("rain_status", "dry"));
                payload.put("airQualityIndex", toInt(row.get("air_quality_index")));
                payload.put("gasStatus", row.getOrDefault("gas_status", "normal"));
                payload.put("status", row.getOrDefault("status", "normal"));
                payload.put("rssi", toInt(row.get("rssi")));
                payload.put("timestamp", System.currentTimeMillis());
                payload.put("source", "supabase"); // mark as supabase-polled data

                String json = objectMapper.writeValueAsString(payload);
                webSocketHandler.broadcast(json);

                // Cache for REST endpoint
                latestWaterQualityData = payload;

                System.out.println("[SupabasePoller] 🌊 Broadcast WQ update: " + deviceId +
                        " pH:" + payload.get("phValue") +
                        " Turb:" + payload.get("turbidity") +
                        " CO2:" + payload.get("co2Level") +
                        " NH3:" + payload.get("ammonia") +
                        " Rain:" + payload.get("rainLevel") + "% (" + payload.get("rainStatus") + ")" +
                        " AQI:" + payload.get("airQualityIndex") + " Gas:" + payload.get("gasStatus"));
            }
        } catch (Exception e) {
            // Don't spam logs — only log occasionally
            System.err.println("[SupabasePoller] ⚠️ Poll error: " + e.getMessage());
        }
    }

    /**
     * Returns the latest cached water quality data (for REST endpoints).
     */
    public Map<String, Object> getLatestWaterQualityData() {
        return latestWaterQualityData;
    }

    private double toDouble(Object val) {
        if (val == null) return 0;
        if (val instanceof Number) return ((Number) val).doubleValue();
        try { return Double.parseDouble(String.valueOf(val)); } catch (Exception e) { return 0; }
    }

    private int toInt(Object val) {
        if (val == null) return 0;
        if (val instanceof Number) return ((Number) val).intValue();
        try { return Integer.parseInt(String.valueOf(val)); } catch (Exception e) { return 0; }
    }

    private boolean toBool(Object val) {
        if (val == null) return false;
        if (val instanceof Boolean) return (Boolean) val;
        return "true".equalsIgnoreCase(String.valueOf(val));
    }
}
