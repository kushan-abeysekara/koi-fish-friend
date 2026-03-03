package com.example.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Service that stores feeding device MQTT data into Supabase
 * for permanent historical storage.
 *
 * The backend is always connected to MQTT (server-side),
 * so every status message is captured regardless of whether
 * any browser client is viewing the dashboard.
 */
@Service
public class SupabaseService {

    @Value("${supabase.url:}")
    private String supabaseUrl;

    @Value("${supabase.key:}")
    private String supabaseKey;

    @Value("${supabase.enabled:true}")
    private boolean enabled;

    @Value("${supabase.throttle-ms:10000}")
    private long throttleMs; // Minimum interval between inserts (default 10s)

    private final ObjectMapper objectMapper = new ObjectMapper();
    private HttpClient httpClient;
    private ExecutorService executor;
    private final AtomicLong lastInsertTime = new AtomicLong(0);

    @PostConstruct
    public void init() {
        if (supabaseUrl == null || supabaseUrl.isBlank() || supabaseKey == null || supabaseKey.isBlank()) {
            enabled = false;
            System.out.println("[Supabase] ⚠️ Supabase URL or key not configured. Historical storage disabled.");
            return;
        }

        httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        // Use a single-thread executor so inserts are sequential and non-blocking
        executor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "supabase-writer");
            t.setDaemon(true);
            return t;
        });

        System.out.println("[Supabase] ✅ Initialized - URL: " + supabaseUrl);
        System.out.println("[Supabase] ✅ Throttle: " + throttleMs + "ms between inserts");
    }

    /**
     * Store a feeding device status message to Supabase.
     * Called from MqttService on every feeding device MQTT message.
     * Throttled to avoid excessive writes (default: 1 insert per 10 seconds).
     */
    public void storeFeedingData(String deviceId, JsonNode mqttPayload) {
        if (!enabled || httpClient == null) return;

        // Throttle: skip if less than throttleMs since last insert
        long now = System.currentTimeMillis();
        long last = lastInsertTime.get();
        if (now - last < throttleMs) {
            return; // Skip this message, too soon
        }
        if (!lastInsertTime.compareAndSet(last, now)) {
            return; // Another thread won the CAS, skip
        }

        // Build and submit async
        executor.submit(() -> {
            try {
                ObjectNode row = objectMapper.createObjectNode();
                row.put("device_id", deviceId);
                row.put("recorded_at", Instant.now().toString());

                // Map MQTT payload fields to table columns
                row.put("status", getTextOrDefault(mqttPayload, "status", "online"));
                row.put("feeding_active", getBoolOrDefault(mqttPayload, "feedingActive", false));
                row.put("hopper_level", getDoubleOrDefault(mqttPayload, "hopperLevel", 0));
                row.put("hopper_capacity", getDoubleOrDefault(mqttPayload, "hopperCapacity", 20000));
                row.put("hopper_percentage", getDoubleOrDefault(mqttPayload, "hopperPercentage", 0));
                row.put("current_weight", getDoubleOrDefault(mqttPayload, "weight", 0));
                row.put("target_weight", getDoubleOrDefault(mqttPayload, "targetWeight", 0));
                row.put("feed_count", getIntOrDefault(mqttPayload, "feedCount", 0));
                row.put("total_grams_fed", getDoubleOrDefault(mqttPayload, "totalGrams", 0));
                row.put("motor_status", getTextOrDefault(mqttPayload, "motorStatus", "STOPPED"));
                row.put("plate_speed", getDoubleOrDefault(mqttPayload, "plateSpeed", 0));
                row.put("esc_percent", getDoubleOrDefault(mqttPayload, "escPercent", 0));
                row.put("uptime_ms", getLongOrDefault(mqttPayload, "uptimeMs", 0));

                if (mqttPayload.has("rssi") && !mqttPayload.get("rssi").isNull()) {
                    row.put("rssi", mqttPayload.get("rssi").asInt());
                }
                if (mqttPayload.has("ipAddress") && !mqttPayload.get("ipAddress").isNull()) {
                    row.put("ip_address", mqttPayload.get("ipAddress").asText());
                }

                String body = objectMapper.writeValueAsString(row);

                // POST to Supabase REST API
                String url = supabaseUrl.replaceAll("/$", "") + "/rest/v1/feeding_history";

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .timeout(Duration.ofSeconds(10))
                        .header("Content-Type", "application/json")
                        .header("apikey", supabaseKey)
                        .header("Authorization", "Bearer " + supabaseKey)
                        .header("Prefer", "return=minimal")
                        .POST(HttpRequest.BodyPublishers.ofString(body))
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

                if (response.statusCode() >= 200 && response.statusCode() < 300) {
                    System.out.println("[Supabase] ✅ Feeding data stored for " + deviceId);
                } else {
                    System.err.println("[Supabase] ❌ Insert failed (HTTP " + response.statusCode() + "): " + response.body());
                }

            } catch (Exception e) {
                System.err.println("[Supabase] ❌ Error storing feeding data: " + e.getMessage());
            }
        });
    }

    /**
     * Store a feeding event (feeding started/stopped) — always stored, not throttled.
     */
    public void storeFeedingEvent(String deviceId, String eventType, JsonNode mqttPayload) {
        if (!enabled || httpClient == null) return;

        executor.submit(() -> {
            try {
                ObjectNode row = objectMapper.createObjectNode();
                row.put("device_id", deviceId);
                row.put("recorded_at", Instant.now().toString());
                row.put("status", eventType); // "feeding_started" or "feeding_stopped"
                row.put("feeding_active", "feeding_started".equals(eventType));
                row.put("hopper_level", getDoubleOrDefault(mqttPayload, "hopperLevel", 0));
                row.put("hopper_capacity", getDoubleOrDefault(mqttPayload, "hopperCapacity", 20000));
                row.put("hopper_percentage", getDoubleOrDefault(mqttPayload, "hopperPercentage", 0));
                row.put("current_weight", getDoubleOrDefault(mqttPayload, "weight", 0));
                row.put("target_weight", getDoubleOrDefault(mqttPayload, "targetWeight", 0));
                row.put("feed_count", getIntOrDefault(mqttPayload, "feedCount", 0));
                row.put("total_grams_fed", getDoubleOrDefault(mqttPayload, "totalGrams", 0));
                row.put("motor_status", getTextOrDefault(mqttPayload, "motorStatus", "STOPPED"));
                row.put("plate_speed", getDoubleOrDefault(mqttPayload, "plateSpeed", 0));
                row.put("esc_percent", getDoubleOrDefault(mqttPayload, "escPercent", 0));

                String body = objectMapper.writeValueAsString(row);
                String url = supabaseUrl.replaceAll("/$", "") + "/rest/v1/feeding_history";

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .timeout(Duration.ofSeconds(10))
                        .header("Content-Type", "application/json")
                        .header("apikey", supabaseKey)
                        .header("Authorization", "Bearer " + supabaseKey)
                        .header("Prefer", "return=minimal")
                        .POST(HttpRequest.BodyPublishers.ofString(body))
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

                if (response.statusCode() >= 200 && response.statusCode() < 300) {
                    System.out.println("[Supabase] ✅ Feeding EVENT stored: " + eventType + " for " + deviceId);
                } else {
                    System.err.println("[Supabase] ❌ Event insert failed (HTTP " + response.statusCode() + "): " + response.body());
                }

            } catch (Exception e) {
                System.err.println("[Supabase] ❌ Error storing feeding event: " + e.getMessage());
            }
        });
    }

    // ─── Helpers ───

    private String getTextOrDefault(JsonNode node, String field, String defaultVal) {
        return node.has(field) && !node.get(field).isNull() ? node.get(field).asText() : defaultVal;
    }

    private double getDoubleOrDefault(JsonNode node, String field, double defaultVal) {
        return node.has(field) && !node.get(field).isNull() ? node.get(field).asDouble() : defaultVal;
    }

    private int getIntOrDefault(JsonNode node, String field, int defaultVal) {
        return node.has(field) && !node.get(field).isNull() ? node.get(field).asInt() : defaultVal;
    }

    private long getLongOrDefault(JsonNode node, String field, long defaultVal) {
        return node.has(field) && !node.get(field).isNull() ? node.get(field).asLong() : defaultVal;
    }

    private boolean getBoolOrDefault(JsonNode node, String field, boolean defaultVal) {
        return node.has(field) && !node.get(field).isNull() ? node.get(field).asBoolean() : defaultVal;
    }

    public boolean isEnabled() {
        return enabled;
    }
}
