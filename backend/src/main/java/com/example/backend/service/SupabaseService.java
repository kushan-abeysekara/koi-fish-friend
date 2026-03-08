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
 * - feeddb: Real-time device status (ESP32 writes directly every 2s)
 * - feeding_history: Feeding events (start/stop with tank diff)
 * - weight_history: Continuous sensor readings for charts (every 10s)
 *
 * Architecture:
 * - ESP32 → Supabase directly (heavy continuous data)
 * - Backend → Supabase (backup writes + read API for frontend)
 * - MySQL: user details only
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

        // Create all required tables on startup (idempotent)
        executor.submit(this::ensureTablesExist);
    }

    /**
     * Creates all required Supabase tables if they do not already exist.
     * Called once during @PostConstruct — safe to run on every restart.
     */
    private void ensureTablesExist() {
        String[] ddls = {
                // Energy: live status (one row per device)
                "CREATE TABLE IF NOT EXISTS energydb (" +
                        "  device_id   TEXT PRIMARY KEY," +
                        "  voltage     FLOAT   DEFAULT 0," +
                        "  current     FLOAT   DEFAULT 0," +
                        "  power       FLOAT   DEFAULT 0," +
                        "  energy_wh   FLOAT   DEFAULT 0," +
                        "  status      TEXT    DEFAULT 'normal'," +
                        "  rssi        INT     DEFAULT 0," +
                        "  ip_address  TEXT    DEFAULT ''," +
                        "  updated_at  TIMESTAMPTZ DEFAULT NOW()" +
                        ")",

                // Energy: historical readings (1 per minute)
                "CREATE TABLE IF NOT EXISTS energy_history (" +
                        "  id          BIGSERIAL PRIMARY KEY," +
                        "  device_id   TEXT," +
                        "  voltage     FLOAT," +
                        "  current     FLOAT," +
                        "  power       FLOAT," +
                        "  energy_wh   FLOAT," +
                        "  status      TEXT    DEFAULT 'normal'," +
                        "  recorded_at TIMESTAMPTZ DEFAULT NOW()" +
                        ")",

                // Water quality: live status (one row per device)
                "CREATE TABLE IF NOT EXISTS sensor_live (" +
                        "  device_id            TEXT PRIMARY KEY," +
                        "  ph_value             FLOAT   DEFAULT 0," +
                        "  turbidity            FLOAT   DEFAULT 0," +
                        "  water_quality_status TEXT    DEFAULT 'normal'," +
                        "  status               TEXT    DEFAULT 'normal'," +
                        "  rssi                 INT     DEFAULT 0," +
                        "  updated_at           TIMESTAMPTZ DEFAULT NOW()" +
                        ")",

                // Water quality: historical readings (1 per minute)
                "CREATE TABLE IF NOT EXISTS sensor_history (" +
                        "  id                   BIGSERIAL PRIMARY KEY," +
                        "  device_id            TEXT," +
                        "  ph_value             FLOAT," +
                        "  turbidity            FLOAT," +
                        "  water_quality_status TEXT    DEFAULT 'normal'," +
                        "  status               TEXT    DEFAULT 'normal'," +
                        "  recorded_at          TIMESTAMPTZ DEFAULT NOW()" +
                        ")",

                // Enable Realtime on live tables
                "ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS energydb",
                "ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS sensor_live",

                // Boat: live telemetry (one row per device, upserted every 500ms)
                "CREATE TABLE IF NOT EXISTS boat_telemetry (" +
                        "  device_id       TEXT PRIMARY KEY," +
                        "  voltage         FLOAT   DEFAULT 0," +
                        "  distance_front  FLOAT   DEFAULT 0," +
                        "  distance_back   FLOAT   DEFAULT 0," +
                        "  distance_left   FLOAT   DEFAULT 0," +
                        "  distance_right  FLOAT   DEFAULT 0," +
                        "  angle_x         FLOAT   DEFAULT 0," +
                        "  angle_y         FLOAT   DEFAULT 0," +
                        "  temperature     FLOAT   DEFAULT 0," +
                        "  motor_left      INT     DEFAULT 0," +
                        "  motor_right     INT     DEFAULT 0," +
                        "  command         TEXT    DEFAULT 'STOP'," +
                        "  mode            TEXT    DEFAULT 'manual'," +
                        "  rssi            INT     DEFAULT 0," +
                        "  connected       BOOLEAN DEFAULT TRUE," +
                        "  updated_at      TIMESTAMPTZ DEFAULT NOW()" +
                        ")",
                "ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS boat_telemetry"
        };

        for (String sql : ddls) {
            try {
                executePgQuery(sql);
            } catch (Exception e) {
                // Log but don't fail startup — table may already exist or Realtime already
                // added
                System.out.println("[Supabase] ℹ️ DDL note: " + e.getMessage());
            }
        }
        System.out.println("[Supabase] ✅ All tables ensured (energydb, energy_history, sensor_live, sensor_history, boat_telemetry)");
    }

    // ═══════════════════════════════════════════════════════════════
    // pg/query SQL execution
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
        if (!enabled || httpClient == null)
            return new ArrayList<>();
        try {
            String body = executePgQuery(sql);
            JsonNode arr = objectMapper.readTree(body);
            List<Map<String, Object>> rows = new ArrayList<>();
            if (arr.isArray()) {
                for (JsonNode node : arr) {
                    Map<String, Object> row = new HashMap<>();
                    node.properties().forEach(e -> {
                        if (e.getValue().isNumber())
                            row.put(e.getKey(), e.getValue().numberValue());
                        else if (e.getValue().isBoolean())
                            row.put(e.getKey(), e.getValue().booleanValue());
                        else if (e.getValue().isNull())
                            row.put(e.getKey(), null);
                        else
                            row.put(e.getKey(), e.getValue().asText());
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
    // READ operations — Backend reads from Supabase for frontend
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
    // WRITE operations — Backup path (ESP32 writes directly too)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Store feeding data to weight_history (throttled backup).
     * ESP32 also writes directly every 10s — this is redundancy.
     */
    public void storeFeedingData(String deviceId, JsonNode mqttPayload) {
        if (!enabled || httpClient == null)
            return;

        long now = System.currentTimeMillis();
        long last = lastInsertTime.get();
        if (now - last < throttleMs)
            return;
        if (!lastInsertTime.compareAndSet(last, now))
            return;

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
        if (!enabled || httpClient == null)
            return;

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
    // Manual Feeding operations (manual_feedings table)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Create a new manual feeding record — returns the new row ID.
     */
    public Map<String, Object> createManualFeeding(String deviceId, double amount, String unit, double tankBefore) {
        String sql = "INSERT INTO manual_feedings (device_id, requested_amount, requested_unit, tank_before, status) " +
                "VALUES ('" + esc(deviceId) + "', " + amount + ", '" + esc(unit) + "', " + tankBefore +
                ", 'feeding') RETURNING id, started_at";
        List<Map<String, Object>> rows = queryRows(sql);
        return rows.isEmpty() ? new HashMap<>() : rows.get(0);
    }

    /**
     * Complete a manual feeding record — update tank_after, actual_dispensed,
     * status, duration.
     */
    public void completeManualFeeding(long feedingId, double tankAfter, double actualDispensed, long durationMs) {
        String sql = "UPDATE manual_feedings SET " +
                "tank_after = " + tankAfter + ", " +
                "actual_dispensed = " + actualDispensed + ", " +
                "status = 'completed', " +
                "completed_at = now(), " +
                "duration_ms = " + durationMs + " " +
                "WHERE id = " + feedingId;
        try {
            executePgQuery(sql);
            System.out.println("[Supabase] ✅ Manual feeding #" + feedingId + " completed");
        } catch (Exception e) {
            System.err.println("[Supabase] ❌ Error completing manual feeding: " + e.getMessage());
        }
    }

    /**
     * Cancel a manual feeding.
     */
    public void cancelManualFeeding(long feedingId, double tankAfter) {
        String sql = "UPDATE manual_feedings SET " +
                "tank_after = " + tankAfter + ", " +
                "actual_dispensed = GREATEST(0, tank_before - " + tankAfter + "), " +
                "status = 'cancelled', " +
                "completed_at = now(), " +
                "duration_ms = EXTRACT(EPOCH FROM (now() - started_at))::bigint * 1000 " +
                "WHERE id = " + feedingId;
        try {
            executePgQuery(sql);
            System.out.println("[Supabase] ✅ Manual feeding #" + feedingId + " cancelled");
        } catch (Exception e) {
            System.err.println("[Supabase] ❌ Error cancelling manual feeding: " + e.getMessage());
        }
    }

    /**
     * Get recent manual feedings.
     */
    public List<Map<String, Object>> getManualFeedings(String deviceId, int limit) {
        String sql = "SELECT * FROM manual_feedings WHERE device_id = '" + esc(deviceId) + "' " +
                "ORDER BY created_at DESC LIMIT " + limit;
        return queryRows(sql);
    }

    // ═══════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════

    private String esc(String val) {
        if (val == null)
            return "";
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

    private boolean getBoolOrDefault(JsonNode node, String field, boolean defaultVal) {
        return node.has(field) && !node.get(field).isNull() ? node.get(field).asBoolean() : defaultVal;
    }

    public boolean isEnabled() {
        return enabled;
    }

    // ═══════════════════════════════════════════════════════════════
    // ENERGY / BUDGET_MANAGEMENT device write operations
    // ═══════════════════════════════════════════════════════════════

    // Separate throttle for energy_history (don't share with feeding throttle)
    private final AtomicLong lastEnergyHistoryInsertTime = new AtomicLong(0);
    private static final long ENERGY_HISTORY_THROTTLE_MS = 60_000; // 1 per minute

    /**
     * UPSERT real-time energy device status into energydb table.
     * Called on every MQTT message (~every 3s). Updates a single row per device_id.
     * Frontend subscribes via Supabase Realtime to get ~100ms updates.
     */
    public void storeEnergyLive(String deviceId, JsonNode mqttPayload) {
        if (!enabled || httpClient == null)
            return;

        executor.submit(() -> {
            try {
                double voltage = getDoubleOrDefault(mqttPayload, "voltage", 0);
                double current = getDoubleOrDefault(mqttPayload, "current", 0);
                double power = getDoubleOrDefault(mqttPayload, "power", 0);
                double energyWh = getDoubleOrDefault(mqttPayload, "energyWh", 0);
                String status = getTextOrDefault(mqttPayload, "status", "normal");
                int rssi = getIntOrDefault(mqttPayload, "rssi", 0);
                String ipAddress = getTextOrDefault(mqttPayload, "ipAddress", "");

                String sql = "INSERT INTO energydb (device_id, voltage, current, power, energy_wh, status, rssi, ip_address, updated_at) "
                        +
                        "VALUES ('" + esc(deviceId) + "', " + voltage + ", " + current + ", " + power + ", " +
                        energyWh + ", '" + esc(status) + "', " + rssi + ", '" + esc(ipAddress) + "', NOW()) " +
                        "ON CONFLICT (device_id) DO UPDATE SET " +
                        "voltage = EXCLUDED.voltage, current = EXCLUDED.current, power = EXCLUDED.power, " +
                        "energy_wh = EXCLUDED.energy_wh, status = EXCLUDED.status, rssi = EXCLUDED.rssi, " +
                        "ip_address = EXCLUDED.ip_address, updated_at = NOW()";

                executePgQuery(sql);
                System.out.println("[Supabase] ⚡ energydb upserted: " + deviceId +
                        " V:" + voltage + " I:" + current + " P:" + power + "W");
            } catch (Exception e) {
                System.err.println("[Supabase] ❌ Error upserting energydb: " + e.getMessage());
            }
        });
    }

    /**
     * INSERT one reading per minute into energy_history table.
     * Provides historical data for charts. Throttled to 1/min.
     */
    public void storeEnergyHistory(String deviceId, JsonNode mqttPayload) {
        if (!enabled || httpClient == null)
            return;

        long now = System.currentTimeMillis();
        long last = lastEnergyHistoryInsertTime.get();
        if (now - last < ENERGY_HISTORY_THROTTLE_MS)
            return;
        if (!lastEnergyHistoryInsertTime.compareAndSet(last, now))
            return;

        executor.submit(() -> {
            try {
                double voltage = getDoubleOrDefault(mqttPayload, "voltage", 0);
                double current = getDoubleOrDefault(mqttPayload, "current", 0);
                double power = getDoubleOrDefault(mqttPayload, "power", 0);
                double energyWh = getDoubleOrDefault(mqttPayload, "energyWh", 0);
                String status = getTextOrDefault(mqttPayload, "status", "normal");

                String sql = "INSERT INTO energy_history (device_id, voltage, current, power, energy_wh, status, recorded_at) "
                        +
                        "VALUES ('" + esc(deviceId) + "', " + voltage + ", " + current + ", " +
                        power + ", " + energyWh + ", '" + esc(status) + "', NOW())";

                executePgQuery(sql);
                System.out.println("[Supabase] ⚡ energy_history saved (1/min): " + deviceId);
            } catch (Exception e) {
                System.err.println("[Supabase] ❌ Error storing energy_history: " + e.getMessage());
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // ENERGY read operations (proxied through backend → avoids Mixed Content)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Read the latest live row from energydb for a device (or all devices).
     * Returns raw JSON string from Supabase pg/query.
     */
    public String readEnergyLive(String deviceId) throws Exception {
        String where = (deviceId != null && !deviceId.isBlank())
                ? "WHERE device_id = '" + esc(deviceId) + "'"
                : "";
        String sql = "SELECT * FROM energydb " + where + " ORDER BY updated_at DESC LIMIT 50";
        return executePgQuery(sql);
    }

    /**
     * Read historical energy readings from energy_history.
     * 
     * @param hoursBack how many hours back to query
     * @param limit     max rows to return
     */
    public String readEnergyHistory(int hoursBack, int limit) throws Exception {
        String sql = "SELECT * FROM energy_history " +
                "WHERE recorded_at >= NOW() - INTERVAL '" + hoursBack + " hours' " +
                "ORDER BY recorded_at DESC LIMIT " + limit;
        return executePgQuery(sql);
    }

    /**
     * Read historical sensor (water quality) readings from sensor_history.
     */
    public String readSensorHistory(int hoursBack, int limit) throws Exception {
        String sql = "SELECT * FROM sensor_history " +
                "WHERE recorded_at >= NOW() - INTERVAL '" + hoursBack + " hours' " +
                "ORDER BY recorded_at DESC LIMIT " + limit;
        return executePgQuery(sql);
    }

    /**
     * Read latest sensor live row from sensor_live.
     */
    public String readSensorLive(String deviceId) throws Exception {
        String where = (deviceId != null && !deviceId.isBlank())
                ? "WHERE device_id = '" + esc(deviceId) + "'"
                : "";
        String sql = "SELECT * FROM sensor_live " + where + " ORDER BY updated_at DESC LIMIT 50";
        return executePgQuery(sql);
    }

    // ═══════════════════════════════════════════════════════════════
    // WATER_QUALITY device write operations
    // ═══════════════════════════════════════════════════════════════

    private final AtomicLong lastSensorHistoryInsertTime = new AtomicLong(0);
    private static final long SENSOR_HISTORY_THROTTLE_MS = 60_000; // 1 per minute

    /**
     * UPSERT real-time water quality device status into sensor_live table.
     * Called on every MQTT message. Triggers Supabase Realtime → frontend ~100ms.
     */
    public void storeSensorLive(String deviceId, JsonNode mqttPayload) {
        if (!enabled || httpClient == null)
            return;

        executor.submit(() -> {
            try {
                double phValue = getDoubleOrDefault(mqttPayload, "phValue", 0);
                double turbidity = getDoubleOrDefault(mqttPayload, "turbidity", 0);
                String wqStatus = getTextOrDefault(mqttPayload, "waterQualityStatus", "normal");
                String status = getTextOrDefault(mqttPayload, "status", "normal");
                int rssi = getIntOrDefault(mqttPayload, "rssi", 0);

                String sql = "INSERT INTO sensor_live (device_id, ph_value, turbidity, water_quality_status, status, rssi, updated_at) "
                        +
                        "VALUES ('" + esc(deviceId) + "', " + phValue + ", " + turbidity + ", '" +
                        esc(wqStatus) + "', '" + esc(status) + "', " + rssi + ", NOW()) " +
                        "ON CONFLICT (device_id) DO UPDATE SET " +
                        "ph_value = EXCLUDED.ph_value, turbidity = EXCLUDED.turbidity, " +
                        "water_quality_status = EXCLUDED.water_quality_status, " +
                        "status = EXCLUDED.status, rssi = EXCLUDED.rssi, updated_at = NOW()";

                executePgQuery(sql);
                System.out.println("[Supabase] 🌊 sensor_live upserted: " + deviceId +
                        " pH:" + phValue + " Turb:" + turbidity);
            } catch (Exception e) {
                System.err.println("[Supabase] ❌ Error upserting sensor_live: " + e.getMessage());
            }
        });
    }

    /**
     * INSERT one reading per minute into sensor_history table.
     * Provides historical data for water quality charts.
     */
    public void storeSensorHistory(String deviceId, JsonNode mqttPayload) {
        if (!enabled || httpClient == null)
            return;

        long now = System.currentTimeMillis();
        long last = lastSensorHistoryInsertTime.get();
        if (now - last < SENSOR_HISTORY_THROTTLE_MS)
            return;
        if (!lastSensorHistoryInsertTime.compareAndSet(last, now))
            return;

        executor.submit(() -> {
            try {
                double phValue = getDoubleOrDefault(mqttPayload, "phValue", 0);
                double turbidity = getDoubleOrDefault(mqttPayload, "turbidity", 0);
                String wqStatus = getTextOrDefault(mqttPayload, "waterQualityStatus", "normal");
                String status = getTextOrDefault(mqttPayload, "status", "normal");

                String sql = "INSERT INTO sensor_history (device_id, ph_value, turbidity, water_quality_status, status, recorded_at) "
                        +
                        "VALUES ('" + esc(deviceId) + "', " + phValue + ", " + turbidity + ", '" +
                        esc(wqStatus) + "', '" + esc(status) + "', NOW())";

                executePgQuery(sql);
                System.out.println("[Supabase] 🌊 sensor_history saved (1/min): " + deviceId);
            } catch (Exception e) {
                System.err.println("[Supabase] ❌ Error storing sensor_history: " + e.getMessage());
            }
        });
    }

    /**
     * Trust-all SSL for self-hosted Supabase with self-signed/untrusted TLS certs.
     */
    private SSLContext createTrustAllSSLContext() {
        try {
            TrustManager[] trustAll = new TrustManager[] {
                    new X509TrustManager() {
                        public X509Certificate[] getAcceptedIssuers() {
                            return new X509Certificate[0];
                        }

                        public void checkClientTrusted(X509Certificate[] certs, String authType) {
                        }

                        public void checkServerTrusted(X509Certificate[] certs, String authType) {
                        }
                    }
            };
            SSLContext sc = SSLContext.getInstance("TLS");
            sc.init(null, trustAll, new java.security.SecureRandom());
            return sc;
        } catch (Exception e) {
            System.err.println("[Supabase] ⚠️ Failed to create trust-all SSL: " + e.getMessage());
            try {
                return SSLContext.getDefault();
            } catch (Exception ex) {
                throw new RuntimeException(ex);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Boat Telemetry - UPSERT live reading to boat_telemetry table
    // ═══════════════════════════════════════════════════════════════

    /**
     * Upsert boat telemetry data into boat_telemetry table.
     * Uses ON CONFLICT (device_id) DO UPDATE so there is always one live row per boat.
     * Called from MqttService when messages arrive on koifish/boat/sensor or koifish/boat/status.
     */
    public void storeBoatTelemetry(String deviceId, JsonNode data) {
        if (!enabled || httpClient == null) return;

        executor.submit(() -> {
            try {
                double voltage       = data.has("voltage")       ? data.get("voltage").asDouble()       : 0;
                double distFront     = data.has("distanceFront") ? data.get("distanceFront").asDouble() : 0;
                double distBack      = data.has("distanceBack")  ? data.get("distanceBack").asDouble()  : 0;
                double distLeft      = data.has("distanceLeft")  ? data.get("distanceLeft").asDouble()  : 0;
                double distRight     = data.has("distanceRight") ? data.get("distanceRight").asDouble() : 0;
                double angleX        = data.has("angleX")        ? data.get("angleX").asDouble()        : 0;
                double angleY        = data.has("angleY")        ? data.get("angleY").asDouble()        : 0;
                double temperature   = data.has("temperature")   ? data.get("temperature").asDouble()   : 0;
                int    motorLeft     = data.has("motorLeft")     ? data.get("motorLeft").asInt()        : 0;
                int    motorRight    = data.has("motorRight")    ? data.get("motorRight").asInt()       : 0;
                String command       = data.has("command")       ? data.get("command").asText()         : "STOP";
                String mode          = data.has("mode")          ? data.get("mode").asText()            : "manual";
                int    rssi          = data.has("rssi")          ? data.get("rssi").asInt()             : 0;
                boolean connected    = data.has("connected")     ? data.get("connected").asBoolean()    : true;

                String sql = String.format(
                    "INSERT INTO boat_telemetry " +
                    "(device_id, voltage, distance_front, distance_back, distance_left, distance_right, " +
                    " angle_x, angle_y, temperature, motor_left, motor_right, command, mode, rssi, connected, updated_at) " +
                    "VALUES ('%s', %.2f, %.2f, %.2f, %.2f, %.2f, %.2f, %.2f, %.2f, %d, %d, '%s', '%s', %d, %b, NOW()) " +
                    "ON CONFLICT (device_id) DO UPDATE SET " +
                    " voltage=EXCLUDED.voltage, distance_front=EXCLUDED.distance_front, " +
                    " distance_back=EXCLUDED.distance_back, distance_left=EXCLUDED.distance_left, " +
                    " distance_right=EXCLUDED.distance_right, angle_x=EXCLUDED.angle_x, angle_y=EXCLUDED.angle_y, " +
                    " temperature=EXCLUDED.temperature, motor_left=EXCLUDED.motor_left, motor_right=EXCLUDED.motor_right, " +
                    " command=EXCLUDED.command, mode=EXCLUDED.mode, rssi=EXCLUDED.rssi, connected=EXCLUDED.connected, " +
                    " updated_at=NOW()",
                    deviceId.replace("'", ""), voltage, distFront, distBack, distLeft, distRight,
                    angleX, angleY, temperature, motorLeft, motorRight,
                    command.replace("'", ""), mode.replace("'", ""), rssi, connected);

                executePgQuery(sql);
            } catch (Exception e) {
                System.err.println("[Supabase] ❌ Failed to store boat telemetry: " + e.getMessage());
            }
        });
    }
}
