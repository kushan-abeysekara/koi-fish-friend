package com.example.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.socket.client.IO;
import io.socket.client.Socket;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Background service that connects to the AI fish detection server via Socket.IO
 * and continuously saves detection events to Supabase.
 *
 * This runs on the backend server 24/7 — detection history is saved even when
 * no user has the browser open.
 */
@Service
public class FishDetectionListenerService {

    @Value("${fish.detection.camera-url:http://192.168.8.101:5000}")
    private String cameraUrl;

    @Value("${fish.detection.enabled:true}")
    private boolean enabled;

    @Value("${fish.detection.save-interval-ms:5000}")
    private long saveIntervalMs;

    @Autowired
    private SupabaseService supabaseService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private Socket socket;
    private final AtomicBoolean connected = new AtomicBoolean(false);
    private final AtomicLong lastSaveTime = new AtomicLong(0);
    private final AtomicLong totalSaved = new AtomicLong(0);

    @PostConstruct
    public void init() {
        if (!enabled) {
            System.out.println("[FishDetection] ⚠️ Disabled via config");
            return;
        }
        connectToAiServer();
    }

    private void connectToAiServer() {
        try {
            IO.Options opts = new IO.Options();
            opts.transports = new String[]{"websocket", "polling"};
            opts.reconnection = true;
            opts.reconnectionDelay = 5000;
            opts.reconnectionAttempts = Integer.MAX_VALUE;
            opts.timeout = 10000;

            socket = IO.socket(URI.create(cameraUrl), opts);

            socket.on(Socket.EVENT_CONNECT, args -> {
                connected.set(true);
                System.out.println("[FishDetection] ✅ Connected to AI server: " + cameraUrl);
                socket.emit("start_stream");
            });

            socket.on(Socket.EVENT_DISCONNECT, args -> {
                connected.set(false);
                System.out.println("[FishDetection] ⚠️ Disconnected from AI server");
            });

            socket.on(Socket.EVENT_CONNECT_ERROR, args -> {
                connected.set(false);
                if (args.length > 0) {
                    System.out.println("[FishDetection] ❌ Connection error: " + args[0]);
                }
            });

            socket.on("detection_update", args -> {
                if (args.length == 0) return;
                handleDetectionUpdate(args[0]);
            });

            socket.connect();
            System.out.println("[FishDetection] 🔄 Connecting to AI server: " + cameraUrl);
        } catch (Exception e) {
            System.err.println("[FishDetection] ❌ Failed to initialize Socket.IO: " + e.getMessage());
        }
    }

    private void handleDetectionUpdate(Object rawData) {
        try {
            // Throttle saves to avoid overwhelming Supabase
            long now = System.currentTimeMillis();
            long last = lastSaveTime.get();
            if (now - last < saveIntervalMs) return;
            if (!lastSaveTime.compareAndSet(last, now)) return;

            String jsonStr;
            if (rawData instanceof String) {
                jsonStr = (String) rawData;
            } else {
                jsonStr = objectMapper.writeValueAsString(rawData);
            }

            JsonNode data = objectMapper.readTree(jsonStr);
            JsonNode detections = data.get("detections");
            if (detections == null || !detections.isArray() || detections.isEmpty()) return;

            double fps = data.has("fps") ? data.get("fps").asDouble() : 0;
            int fishCount = data.has("fish_count") ? data.get("fish_count").asInt() : 0;
            String timestamp = data.has("timestamp") ? data.get("timestamp").asText() : Instant.now().toString();
            String frame = data.has("frame") ? data.get("frame").asText() : null;

            for (JsonNode fish : detections) {
                int fishId = fish.has("id") ? fish.get("id").asInt() : 0;

                // Health info
                JsonNode health = fish.get("health");
                String healthClass = "unknown";
                double confidence = 0;
                boolean isCritical = false;
                boolean needsAttention = false;
                if (health != null) {
                    healthClass = health.has("class") ? health.get("class").asText() : "unknown";
                    confidence = health.has("confidence") ? health.get("confidence").asDouble() : 0;
                    isCritical = health.has("is_critical") && health.get("is_critical").asBoolean();
                    needsAttention = health.has("needs_attention") && health.get("needs_attention").asBoolean();
                }

                // Bounding box
                JsonNode bbox = fish.get("bbox");
                Double bboxX1 = null, bboxY1 = null, bboxX2 = null, bboxY2 = null;
                if (bbox != null) {
                    bboxX1 = bbox.has("x1") ? bbox.get("x1").asDouble() : null;
                    bboxY1 = bbox.has("y1") ? bbox.get("y1").asDouble() : null;
                    bboxX2 = bbox.has("x2") ? bbox.get("x2").asDouble() : null;
                    bboxY2 = bbox.has("y2") ? bbox.get("y2").asDouble() : null;
                }

                supabaseService.storeFishDetection(
                        "POND_CAM_001", timestamp, fishId,
                        healthClass, confidence, isCritical, needsAttention,
                        bboxX1, bboxY1, bboxX2, bboxY2,
                        frame, fishCount, fps);

                totalSaved.incrementAndGet();
            }
        } catch (Exception e) {
            System.err.println("[FishDetection] ❌ Error processing detection: " + e.getMessage());
        }
    }

    /**
     * Periodically log status and attempt reconnect if disconnected.
     */
    @Scheduled(fixedRate = 60000)
    public void statusCheck() {
        if (!enabled) return;
        System.out.println("[FishDetection] Status: " +
                (connected.get() ? "✅ Connected" : "❌ Disconnected") +
                " | Total events saved: " + totalSaved.get());

        // If disconnected and socket exists, try reconnecting
        if (!connected.get() && socket != null && !socket.connected()) {
            System.out.println("[FishDetection] 🔄 Attempting reconnect...");
            socket.connect();
        }
    }

    @PreDestroy
    public void cleanup() {
        if (socket != null) {
            try {
                socket.emit("stop_stream");
                socket.disconnect();
                socket.close();
            } catch (Exception e) {
                // ignore
            }
            System.out.println("[FishDetection] 🛑 Disconnected from AI server (shutdown)");
        }
    }

    public boolean isConnected() {
        return connected.get();
    }

    public long getTotalSaved() {
        return totalSaved.get();
    }
}
