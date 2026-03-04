package com.example.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Service that reads/writes feeding device data from/to Supabase.
 *
 * Uses the pg/query endpoint for ALL operations because the self-hosted
 * Supabase instance has a JWT secret mismatch that causes PostgREST
 * (/rest/v1/) to return 401 for all keys.
 *
 * Tables:
 *   - feeddb:           Real-time device status (ESP32 writes directly every 2s)
 *   - feeding_history:  Feeding events (start/stop with tank diff)
 *   - weight_history:   Continuous sensor readings for charts (every 10s)
 *
 * Architecture:
 *   - ESP32 → Supabase directly (heavy continuous data)
 *   - Backend → Supabase (backup writes + read API for frontend)
 *   - MySQL: user details only
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
    private long throttleMs;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private HttpClient httpClient;
    private ExecutorService executor;
    private final AtomicLong lastInsertTime = new AtomicLong(0);

    @PostConstruct
    public void init() {
        if (supabaseUrl == null || supabaseUrl.isBlank() || supabaseKey == null || supabaseKey.isBlank()) {
            enabled = false;
            System.out.println("[Supabase] ⚠️ URL or key not configured. Disabled.");
            return;
        }

        httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .sslContext(createTrustAllSSLContext())
                .build();

        executor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "supabase-writer");
            t.setDaemon(true);
            return t;
        });

        System.out.println("[Supabase] ✅ Initialized - URL: " + supabaseUrl);
        System.out.println("[Supabase] ✅ Using pg/query endpoint for all operations");
    }

    // ═══════════════════════════════════════════════════════════════
    //  pg/query SQL execution
    // ═══════════════════════════════════════════════════════════════

    /**
     * Execute a SQL query via the pg/query endpoint.
     */
    private String executePgQuery(String sql) throws Exception {
        String url = supabaseUrl.replaceAll("/$", "") + "/pg/query";

        ObjectNode body = objectMapper.createObjectNode();
        body.put("query", sql);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .header("apikey", supabaseKey)
                .header("Authorization", "Bearer " + supabaseKey)
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 200 && response.statusCode() < 300) {
            return response.body();
        } else {
            throw new RuntimeException("pg/query HTTP " + response.statusCode() + ": " + response.body());
        }
    }

    /**
     * Execute a SQL SELECT and return rows as list of maps.
     */
    public List<Map<String, Object>> queryRows(String sql) {
        if (!enabled || httpClient == null) return new ArrayList<>();
        try {
            String body = executePgQuery(sql);
            JsonNode arr = objectMapper.readTree(body);
            List<Map<String, Object>> rows = new ArrayList<>();
            if (arr.isArray()) {
                for (JsonNode node : arr) {
                    Map<String, Object> row = new HashMap<>();
                    node.fields().forEachRemaining(e -> {
                        if (e.getValue().isNumber()) row.put(e.getKey(), e.getValue().numberValue());
                        else if (e.getValue().isBoolean()) row.put(e.getKey(), e.getValue().booleanValue());
                        else if (e.getValue().isNull()) row.put(e.getKey(), null);
                        else row.put(e.getKey(), e.getValue().asText());
                    });
                    rows.add(row);
                }
            }
            return rows;
        } catch (Exception e) {
            System.err.println("[Supabase] ❌ Query error: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  READ operations — Backend reads from Supabase for frontend
    // ═══════════════════════════════════════════════════════════════

    /**
     * Get real-time device status from feeddb table.
     * ESP32 writes directly to this table every 2 seconds.
     */
    public Map<String, Object> getDeviceStatus(String deviceId) {
        String sql = "SELECT * FROM feeddb WHERE device_id = '" + esc(deviceId) + "' LIMIT 1";
        List<Map<String, Object>> rows = queryRows(sql);
        return rows.isEmpty() ? new HashMap<>() : rows.get(0);
    }

    /**
     * Get weight history from Supabase for charts/trends.
     */
    public List<Map<String, Object>> getWeightHistory(String deviceId, int hoursBack, int limit) {
        String sql = "SELECT * FROM weight_history WHERE device_id = '" + esc(deviceId) + "' " +
                "AND recorded_at > now() - interval '" + hoursBack + " hours' " +
                "ORDER BY recorded_at ASC LIMIT " + limit;
        return queryRows(sql);
    }

    /**
     * Get feeding events (start/stop) from Supabase.
     */
    public List<Map<String, Object>> getFeedingEvents(String deviceId, int hoursBack, int limit) {
        String sql = "SELECT * FROM feeding_history WHERE device_id = '" + esc(deviceId) + "' " +
                "AND recorded_at > now() - interval '" + hoursBack + " hours' " +
                "ORDER BY recorded_at ASC LIMIT " + limit;
        return queryRows(sql);
    }

    /**
     * Get all feeding_history rows (events + status snapshots) for chart data.
     */
    public List<Map<String, Object>> getFeedingHistory(String deviceId, int hoursBack, int limit) {
        String sql = "SELECT * FROM weight_history WHERE device_id = '" + esc(deviceId) + "' " +
                "AND recorded_at > now() - interval '" + hoursBack + " hours' " +
                "ORDER BY recorded_at ASC LIMIT " + limit;
        return queryRows(sql);
    }

    /**
     * Get feeding stats from Supabase.
     */
    public Map<String, Object> getFeedingStats(String deviceId) {
        String sql = "SELECT count(*) as total_events, " +
                "count(CASE WHEN event_type = 'feeding_started' THEN 1 END) as start_count, " +
                "count(CASE WHEN event_type = 'feeding_stopped' THEN 1 END) as stop_count, " +
                "COALESCE(sum(total_feed), 0) as total_feed_dispensed, " +
                "COALESCE(avg(total_feed), 0) as avg_feed_per_session, " +
                "COALESCE(max(motor_max_speed), 0) as max_motor_speed " +
                "FROM feeding_history WHERE device_id = '" + esc(deviceId) + "'";
        List<Map<String, Object>> rows = queryRows(sql);
        return rows.isEmpty() ? new HashMap<>() : rows.get(0);
    }

    // ═══════════════════════════════════════════════════════════════
    //  WRITE operations — Backup path (ESP32 writes directly too)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Store feeding data to weight_history (throttled backup).
     * ESP32 also writes directly every 10s — this is redundancy.
     */
    public void storeFeedingData(String deviceId, JsonNode mqttPayload) {
        if (!enabled || httpClient == null) return;

        long now = System.currentTimeMillis();
        long last = lastInsertTime.get();
        if (now - last < throttleMs) return;
        if (!lastInsertTime.compareAndSet(last, now)) return;

        executor.submit(() -> {
            try {
                double weight = getDoubleOrDefault(mqttPayload, "weight", 0);
                double tankLevel = getDoubleOrDefault(mqttPayload, "hopperLevel", 0);
                double tankPct = getDoubleOrDefault(mqttPayload, "hopperPercentage", 0);
                double rpm = getDoubleOrDefault(mqttPayload, "plateSpeed", 0);
                double escPct = getDoubleOrDefault(mqttPayload, "escPercent", 0);
                String motorStatus = getTextOrDefault(mqttPayload, "motorStatus", "STOPPED");
                boolean feedActive = getBoolOrDefault(mqttPayload, "feedingActive", false);
                int rssi = getIntOrDefault(mqttPayload, "rssi", 0);

                String sql = "INSERT INTO weight_history (device_id, weight, tank_level, tank_percentage, " +
                        "motor_rpm, esc_percent, motor_status, feeding_active, rssi) VALUES ('" +
                        esc(deviceId) + "', " + weight + ", " + tankLevel + ", " + tankPct + ", " +
                        rpm + ", " + escPct + ", '" + esc(motorStatus) + "', " +
                        feedActive + ", " + rssi + ")";

                executePgQuery(sql);
                System.out.println("[Supabase] ✅ Weight history stored for " + deviceId);
            } catch (Exception e) {
                System.err.println("[Supabase] ❌ Error storing data: " + e.getMessage());
            }
        });
    }

    /**
     * Store a feeding event (start/stop) — always stored, not throttled.
     */
    public void storeFeedingEvent(String deviceId, String eventType, JsonNode mqttPayload) {
        if (!enabled || httpClient == null) return;

        executor.submit(() -> {
            try {
                double tankLevel = getDoubleOrDefault(mqttPayload, "hopperLevel", 0);
                double weight = getDoubleOrDefault(mqttPayload, "weight", 0);
                double rpm = getDoubleOrDefault(mqttPayload, "plateSpeed", 0);
                double escPct = getDoubleOrDefault(mqttPayload, "escPercent", 0);
                int feedCount = getIntOrDefault(mqttPayload, "feedCount", 0);
                double totalGrams = getDoubleOrDefault(mqttPayload, "totalGrams", 0);
                double targetWt = getDoubleOrDefault(mqttPayload, "targetWeight", 0);
                double tankCap = getDoubleOrDefault(mqttPayload, "hopperCapacity", 20000);
                double tankPct = getDoubleOrDefault(mqttPayload, "hopperPercentage", 0);
                String motorStatus = getTextOrDefault(mqttPayload, "motorStatus", "STOPPED");
                int rssi = getIntOrDefault(mqttPayload, "rssi", 0);
                String ip = getTextOrDefault(mqttPayload, "ipAddress", "");

                String sql = "INSERT INTO feeding_history (device_id, event_type, weight, tank_level, " +
                        "tank_capacity, tank_percentage, motor_status, motor_rpm, esc_percent, " +
                        "feeding_active, feed_count, total_grams_fed, target_weight, rssi, ip_address) " +
                        "VALUES ('" + esc(deviceId) + "', '" + esc(eventType) + "', " +
                        weight + ", " + tankLevel + ", " + tankCap + ", " + tankPct + ", '" +
                        esc(motorStatus) + "', " + rpm + ", " + escPct + ", " +
                        ("feeding_started".equals(eventType) ? "true" : "false") + ", " +
                        feedCount + ", " + totalGrams + ", " + targetWt + ", " +
                        rssi + ", '" + esc(ip) + "')";

                executePgQuery(sql);
                System.out.println("[Supabase] ✅ Feeding EVENT stored: " + eventType + " for " + deviceId);
            } catch (Exception e) {
                System.err.println("[Supabase] ❌ Error storing event: " + e.getMessage());
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════════════════════════

    private String esc(String val) {
        if (val == null) return "";
        return val.replace("'", "''");
    }

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

    /**
     * Trust-all SSL for self-hosted Supabase with self-signed/untrusted TLS certs.
     */
    private SSLContext createTrustAllSSLContext() {
        try {
            TrustManager[] trustAll = new TrustManager[]{
                new X509TrustManager() {
                    public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                    public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                    public void checkServerTrusted(X509Certificate[] certs, String authType) {}
                }
            };
            SSLContext sc = SSLContext.getInstance("TLS");
            sc.init(null, trustAll, new java.security.SecureRandom());
            return sc;
        } catch (Exception e) {
            System.err.println("[Supabase] ⚠️ Failed to create trust-all SSL: " + e.getMessage());
            try { return SSLContext.getDefault(); } catch (Exception ex) { throw new RuntimeException(ex); }
        }
    }
}
