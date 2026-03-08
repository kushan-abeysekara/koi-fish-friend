package com.example.backend.service;

import com.example.backend.entity.SensorDevice;
import com.example.backend.entity.SensorData;
import com.example.backend.entity.FeedingHistory;
import com.example.backend.repository.SensorDeviceRepository;
import com.example.backend.repository.FeedingHistoryRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.example.backend.websocket.FeedingWebSocketHandler;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class MqttService {

    @Autowired
    private SensorDeviceRepository deviceRepository;

    @Autowired
    private MessageChannel mqttOutboundChannel;

    @Autowired
    private FeedingWebSocketHandler feedingWebSocketHandler;

    @Autowired
    private SupabaseService supabaseService;

    @Autowired
    private FeedingHistoryRepository feedingHistoryRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private boolean connected = true; // Assume connected (Spring Integration handles connection)

    // Throttle MySQL history writes: 1 insert per 10 seconds for periodic status
    private final AtomicLong lastHistoryInsertTime = new AtomicLong(0);
    private static final long HISTORY_THROTTLE_MS = 10_000;

    // ── Cached latest boat telemetry (for REST polling fallback) ──
    private volatile String lastBoatPayload = null;
    private volatile long lastBoatTimestamp = 0;

    /** Returns the last received boat sensor JSON payload (or null). */
    public String getLastBoatPayload() { return lastBoatPayload; }
    /** Returns epoch-ms of last boat message. */
    public long getLastBoatTimestamp() { return lastBoatTimestamp; }

    @ServiceActivator(inputChannel = "mqttInputChannel")
    public void handleMessage(Message<?> message) {
        try {
            String topic = (String) message.getHeaders().get(MqttHeaders.RECEIVED_TOPIC);

            // Handle both String and byte[] payloads
            String payload;
            Object payloadObj = message.getPayload();
            if (payloadObj instanceof byte[]) {
                payload = new String((byte[]) payloadObj);
            } else if (payloadObj instanceof String) {
                payload = (String) payloadObj;
            } else {
                System.out.println("Unknown payload type: " + payloadObj.getClass().getName());
                return;
            }

            System.out.println("Received MQTT message on topic: " + topic);
            System.out.println("Payload: " + payload);

            JsonNode jsonNode = objectMapper.readTree(payload);

            // ── Boat telemetry: forward to Supabase boat_telemetry table ──
            if (topic.startsWith("koifish/boat/")) {
                String boatDeviceId = jsonNode.has("deviceId") ? jsonNode.get("deviceId").asText() : "BOAT_ESP32_001";
                // Cache latest payload for REST polling fallback
                lastBoatPayload = payload;
                lastBoatTimestamp = System.currentTimeMillis();
                supabaseService.storeBoatTelemetry(boatDeviceId, jsonNode);
                feedingWebSocketHandler.broadcast(payload); // also push to WS for any listeners
                System.out.println("🚤 Boat telemetry stored for " + boatDeviceId);
                return;
            }

            String deviceId = jsonNode.get("deviceId").asText();

            if (topic.contains("/status")) {
                handleStatusUpdate(deviceId, jsonNode);
                // Broadcast to the shared WebSocket channel — frontend filters by deviceId
                // prefix
                if (deviceId.contains("feed_device")) {
                    feedingWebSocketHandler.broadcast(payload);
                    // Store feeding data to Supabase for historical records (server-side, always
                    // running)
                    supabaseService.storeFeedingData(deviceId, jsonNode);
                    // Store feeding data to MySQL (primary storage, auto-created table)
                    storeFeedingHistoryToMySQL(deviceId, jsonNode);
                    // Detect feeding state transitions for event logging
                    detectFeedingEvent(deviceId, jsonNode);
                } else if (deviceId.startsWith("BM_")) {
                    feedingWebSocketHandler.broadcast(payload);
                } else if (deviceId.startsWith("WQ_")) {
                    feedingWebSocketHandler.broadcast(payload);
                }
            } else if (topic.contains("/data")) {
                handleSensorData(deviceId, jsonNode);
                // Energy/sensor data from BM_ devices broadcasted for EnergyMonitor
                if (deviceId.startsWith("BM_")) {
                    feedingWebSocketHandler.broadcast(payload);
                }
                // Water quality data from WQ_ devices broadcasted for WaterQualityDashboard
                if (deviceId.startsWith("WQ_")) {
                    feedingWebSocketHandler.broadcast(payload);
                }
            }
        } catch (Exception e) {
            System.err.println("Error processing MQTT message: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void handleStatusUpdate(String deviceId, JsonNode json) {
        SensorDevice device = deviceRepository.findByDeviceId(deviceId)
                .orElseGet(() -> {
                    SensorDevice newDevice = new SensorDevice();
                    newDevice.setDeviceId(deviceId);
                    // Set device type by default based on device ID prefix
                    if (deviceId.contains("feed_device")) {
                        newDevice.setDeviceType(SensorDevice.DeviceType.FEEDING_MANAGEMENT);
                    } else if (deviceId.startsWith("BM_")) {
                        newDevice.setDeviceType(SensorDevice.DeviceType.BUDGET_MANAGEMENT);
                    }
                    return newDevice;
                });

        // Set device status to online when receiving status messages
        device.setStatus("online");
        device.setIpAddress(json.has("ipAddress") ? json.get("ipAddress").asText() : null);
        device.setRssi(json.has("rssi") ? json.get("rssi").asInt() : null);
        device.setEnergyWh(json.has("energyWh") ? json.get("energyWh").asDouble() : 0.0);
        device.setLastSeen(LocalDateTime.now());

        // Handle feeding device specific fields from status messages
        if (json.has("hopperLevel")) {
            device.setHopperLevel(json.get("hopperLevel").asDouble());
        }
        if (json.has("hopperCapacity")) {
            device.setHopperCapacity(json.get("hopperCapacity").asDouble());
        }
        if (json.has("hopperPercentage")) {
            device.setHopperPercentage(json.get("hopperPercentage").asDouble());
        }
        if (json.has("plateSpeed")) {
            device.setPlateSpeed(json.get("plateSpeed").asDouble());
        }
        if (json.has("motorStatus")) {
            device.setMotorStatus(json.get("motorStatus").asText());
        }
        if (json.has("feedingActive")) {
            boolean wasFeedingActive = Boolean.TRUE.equals(device.getFeedingActive());
            boolean isNowActive = json.get("feedingActive").asBoolean();
            device.setFeedingActive(isNowActive);

            // Detect feeding completion (was active, now stopped)
            if (wasFeedingActive && !isNowActive) {
                device.setLastFeedingTime(LocalDateTime.now());
            }
        }
        if (json.has("feedCount")) {
            device.setFeedCount(json.get("feedCount").asInt());
        }
        if (json.has("totalGrams")) {
            device.setTotalGramsFed(json.get("totalGrams").asDouble());
        }
        if (json.has("weight")) {
            device.setCurrentWeight(json.get("weight").asDouble());
        }
        if (json.has("targetWeight")) {
            device.setTargetWeight(json.get("targetWeight").asDouble());
        }

        // Handle power management fields (for BUDGET_MANAGEMENT devices)
        if (json.has("relayState")) {
            device.setRelayState(json.get("relayState").asText());
        }
        if (json.has("controlMode")) {
            device.setControlMode(json.get("controlMode").asText());
        }
        if (json.has("scheduleCount")) {
            device.setScheduleCount(json.get("scheduleCount").asInt());
        }

        // Handle device type (check both "type" and "deviceType" for compatibility)
        if (json.has("deviceType")) {
            String typeStr = json.get("deviceType").asText();
            try {
                device.setDeviceType(SensorDevice.DeviceType.valueOf(typeStr));
            } catch (IllegalArgumentException e) {
                System.err.println("Invalid device type: " + typeStr);
            }
        } else if (json.has("type")) {
            String typeStr = json.get("type").asText();
            try {
                device.setDeviceType(SensorDevice.DeviceType.valueOf(typeStr));
            } catch (IllegalArgumentException e) {
                System.err.println("Invalid device type: " + typeStr);
            }
        }

        // DO NOT automatically assign/unassign based on pondId in status messages
        // The pondId in status is informational only (shows what the ESP32 thinks it's
        // assigned to)
        // Actual assignment is controlled only by explicit assign/unassign API calls
        // This prevents devices from auto-reassigning themselves after manual
        // unassignment

        deviceRepository.save(device);

        if (deviceId.contains("feed_device")) {
            System.out.println("Feeding device status updated: " + deviceId +
                    " - Status: online" +
                    " - Hopper: " + device.getHopperLevel() + "g (" + device.getHopperPercentage() + "%)" +
                    " - Motor: " + device.getMotorStatus() +
                    " - Plate: " + device.getPlateSpeed() + " RPM");
        } else {
            System.out.println("Device status updated: " + deviceId + " (Pond: " +
                    (device.getPond() != null ? device.getPond().getId() : "None") + ")");
        }
    }

    private boolean lastFeedingActiveState = false;

    /**
     * Store feeding status to MySQL feeding_history table (throttled: 1 per 10s).
     * Table is auto-created by JPA/Hibernate.
     */
    private void storeFeedingHistoryToMySQL(String deviceId, JsonNode json) {
        try {
            // Throttle: skip if less than 10s since last insert
            long now = System.currentTimeMillis();
            long last = lastHistoryInsertTime.get();
            if (now - last < HISTORY_THROTTLE_MS)
                return;
            if (!lastHistoryInsertTime.compareAndSet(last, now))
                return;

            FeedingHistory h = buildFeedingHistory(deviceId, json, "online");
            feedingHistoryRepository.save(h);
            System.out.println("[MySQL] ✅ Feeding history stored for " + deviceId);
        } catch (Exception e) {
            System.err.println("[MySQL] ❌ Error storing feeding history: " + e.getMessage());
        }
    }

    /**
     * Store a feeding event (start/stop) to MySQL — always stored, not throttled.
     */
    private void storeFeedingEventToMySQL(String deviceId, String eventType, JsonNode json) {
        try {
            FeedingHistory h = buildFeedingHistory(deviceId, json, eventType);
            feedingHistoryRepository.save(h);
            System.out.println("[MySQL] ✅ Feeding EVENT stored: " + eventType + " for " + deviceId);
        } catch (Exception e) {
            System.err.println("[MySQL] ❌ Error storing feeding event: " + e.getMessage());
        }
    }

    /**
     * Build a FeedingHistory entity from MQTT JSON payload.
     */
    private FeedingHistory buildFeedingHistory(String deviceId, JsonNode json, String status) {
        FeedingHistory h = new FeedingHistory();
        h.setDeviceId(deviceId);
        h.setRecordedAt(LocalDateTime.now());
        h.setStatus(status);

        if (json.has("feedingActive") && !json.get("feedingActive").isNull())
            h.setFeedingActive(json.get("feedingActive").asBoolean());
        if (json.has("hopperLevel") && !json.get("hopperLevel").isNull())
            h.setHopperLevel(json.get("hopperLevel").asDouble());
        if (json.has("hopperCapacity") && !json.get("hopperCapacity").isNull())
            h.setHopperCapacity(json.get("hopperCapacity").asDouble());
        if (json.has("hopperPercentage") && !json.get("hopperPercentage").isNull())
            h.setHopperPercentage(json.get("hopperPercentage").asDouble());
        if (json.has("weight") && !json.get("weight").isNull())
            h.setCurrentWeight(json.get("weight").asDouble());
        if (json.has("targetWeight") && !json.get("targetWeight").isNull())
            h.setTargetWeight(json.get("targetWeight").asDouble());
        if (json.has("feedCount") && !json.get("feedCount").isNull())
            h.setFeedCount(json.get("feedCount").asInt());
        if (json.has("totalGrams") && !json.get("totalGrams").isNull())
            h.setTotalGramsFed(json.get("totalGrams").asDouble());
        if (json.has("motorStatus") && !json.get("motorStatus").isNull())
            h.setMotorStatus(json.get("motorStatus").asText());
        if (json.has("plateSpeed") && !json.get("plateSpeed").isNull())
            h.setPlateSpeed(json.get("plateSpeed").asDouble());
        if (json.has("escPercent") && !json.get("escPercent").isNull())
            h.setEscPercent(json.get("escPercent").asDouble());
        if (json.has("rssi") && !json.get("rssi").isNull())
            h.setRssi(json.get("rssi").asInt());
        if (json.has("ipAddress") && !json.get("ipAddress").isNull())
            h.setIpAddress(json.get("ipAddress").asText());
        if (json.has("uptimeMs") && !json.get("uptimeMs").isNull())
            h.setUptimeMs(json.get("uptimeMs").asLong());

        return h;
    }

    /**
     * Detect feeding start/stop transitions and log events to Supabase + MySQL (not
     * throttled).
     */
    private void detectFeedingEvent(String deviceId, JsonNode json) {
        if (!json.has("feedingActive"))
            return;
        boolean isActive = json.get("feedingActive").asBoolean();
        if (isActive && !lastFeedingActiveState) {
            supabaseService.storeFeedingEvent(deviceId, "feeding_started", json);
            storeFeedingEventToMySQL(deviceId, "feeding_started", json);
        } else if (!isActive && lastFeedingActiveState) {
            supabaseService.storeFeedingEvent(deviceId, "feeding_stopped", json);
            storeFeedingEventToMySQL(deviceId, "feeding_stopped", json);
        }
        lastFeedingActiveState = isActive;
    }

    private void handleSensorData(String deviceId, JsonNode json) {
        SensorDevice device = deviceRepository.findByDeviceId(deviceId).orElse(null);
        if (device == null) {
            System.err.println("Device not found: " + deviceId);
            return;
        }

        SensorData data = new SensorData();
        data.setDevice(device);
        data.setPond(device.getPond());
        data.setStatus(json.has("status") ? json.get("status").asText() : "normal");

        // Check device type and store appropriate data
        if (device.getDeviceType() == SensorDevice.DeviceType.WATER_QUALITY) {
            // Store water quality data
            if (json.has("phValue"))
                data.setPhValue(json.get("phValue").asDouble());
            if (json.has("turbidity"))
                data.setTurbidity(json.get("turbidity").asDouble());
            if (json.has("waterQualityStatus"))
                data.setWaterQualityStatus(json.get("waterQualityStatus").asText());

            // Water quality: skip MySQL, save only to Supabase
            supabaseService.storeSensorLive(deviceId, json);
            supabaseService.storeSensorHistory(deviceId, json);
            System.out.println("🌊 Water quality → Supabase: " + deviceId +
                    " pH:" + data.getPhValue() + " Turb:" + data.getTurbidity());
        } else if (device.getDeviceType() == SensorDevice.DeviceType.FEEDING_MANAGEMENT) {
            // Store feeding device status
            device.setStatus("online");
            if (json.has("hopperLevel")) {
                device.setHopperLevel(json.get("hopperLevel").asDouble());
            }
            if (json.has("hopperCapacity")) {
                device.setHopperCapacity(json.get("hopperCapacity").asDouble());
            }
            if (json.has("hopperPercentage")) {
                device.setHopperPercentage(json.get("hopperPercentage").asDouble());
            }
            if (json.has("plateSpeed")) {
                device.setPlateSpeed(json.get("plateSpeed").asDouble());
            }
            if (json.has("motorStatus")) {
                device.setMotorStatus(json.get("motorStatus").asText());
            }
            if (json.has("feedingActive")) {
                boolean wasFeedingActive = Boolean.TRUE.equals(device.getFeedingActive());
                boolean isNowActive = json.get("feedingActive").asBoolean();
                device.setFeedingActive(isNowActive);
                if (wasFeedingActive && !isNowActive) {
                    device.setLastFeedingTime(LocalDateTime.now());
                }
            }
            if (json.has("feedCount")) {
                device.setFeedCount(json.get("feedCount").asInt());
            }
            if (json.has("totalGrams")) {
                device.setTotalGramsFed(json.get("totalGrams").asDouble());
            }
            if (json.has("weight")) {
                device.setCurrentWeight(json.get("weight").asDouble());
            }
            if (json.has("targetWeight")) {
                device.setTargetWeight(json.get("targetWeight").asDouble());
            }

            System.out.println("Feeding device data updated: " + deviceId +
                    " - Status: online" +
                    " - Hopper: " + device.getHopperLevel() + "g (" + device.getHopperPercentage() + "%)" +
                    " - Motor: " + device.getMotorStatus() +
                    " - Plate: " + device.getPlateSpeed() + " RPM");

        } else if (json.has("voltage") && json.has("current") && json.has("power")) {
            // Store voltage/current data for budget management devices
            data.setVoltage(json.get("voltage").asDouble());
            data.setCurrent(json.get("current").asDouble());
            data.setPower(json.get("power").asDouble());
            data.setEnergyWh(json.get("energyWh").asDouble());
            data.setStatus(json.has("status") ? json.get("status").asText() : "normal");

            // Energy data: skip MySQL, save only to Supabase
            // Supabase: UPSERT live status on every message (Realtime → frontend ~100ms)
            supabaseService.storeEnergyLive(deviceId, json);
            // Supabase: INSERT history once per minute (for charts)
            supabaseService.storeEnergyHistory(deviceId, json);
            System.out.println("⚡ Energy received → Supabase: " + deviceId +
                    " V:" + data.getVoltage() + " I:" + data.getCurrent() +
                    " P:" + data.getPower() + "W E:" + data.getEnergyWh() + "Wh");

            // Always update live device energy counter regardless of throttle
            device.setEnergyWh(data.getEnergyWh());
        } else {
            // No relevant data to store
            device.setLastSeen(LocalDateTime.now());
            deviceRepository.save(device);
            System.out.println("⚠️ No sensor data to save for device: " + deviceId);
            return;
        }

        device.setLastSeen(LocalDateTime.now());
        deviceRepository.save(device);
    }

    public void sendCommand(String deviceId, String command, Object data) {
        try {
            String topic = "koi/sensors/" + deviceId + "/command";

            Map<String, Object> payload = new HashMap<>();
            payload.put("command", command);
            if (data != null) {
                if (data instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> dataMap = (Map<String, Object>) data;
                    payload.putAll(dataMap);
                } else {
                    payload.put("data", data);
                }
            }

            String payloadStr = objectMapper.writeValueAsString(payload);

            System.out.println("Sending MQTT command:");
            System.out.println("  Topic: " + topic);
            System.out.println("  Payload: " + payloadStr);

            mqttOutboundChannel.send(
                    MessageBuilder.withPayload(payloadStr)
                            .setHeader(MqttHeaders.TOPIC, topic)
                            .build());

            System.out.println("Command sent successfully to device " + deviceId + ": " + command);
        } catch (Exception e) {
            System.err.println("Error sending command: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Send raw MQTT message to a specific topic (for schedules, etc.)
     */
    public void sendMqttMessage(String topic, Map<String, Object> data) {
        try {
            String payloadStr = objectMapper.writeValueAsString(data);

            System.out.println("Sending MQTT message:");
            System.out.println("  Topic: " + topic);
            System.out.println("  Payload: " + payloadStr);

            mqttOutboundChannel.send(
                    MessageBuilder.withPayload(payloadStr)
                            .setHeader(MqttHeaders.TOPIC, topic)
                            .build());

            System.out.println("MQTT message sent successfully to topic: " + topic);
        } catch (Exception e) {
            System.err.println("Error sending MQTT message: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public void sendFeedingCommand(String deviceId, String command, Map<String, Object> data) {
        try {
            String topic = "koi/devices/" + deviceId + "/feeding/command";

            Map<String, Object> payload = new HashMap<>();
            payload.put("command", command);
            payload.put("data", data);

            String payloadStr = objectMapper.writeValueAsString(payload);

            System.out.println("Sending Feeding MQTT command:");
            System.out.println("  Topic: " + topic);
            System.out.println("  Payload: " + payloadStr);

            mqttOutboundChannel.send(
                    MessageBuilder.withPayload(payloadStr)
                            .setHeader(MqttHeaders.TOPIC, topic)
                            .build());

            System.out.println("Feeding command sent successfully to device " + deviceId + ": " + command);
        } catch (Exception e) {
            System.err.println("Error sending feeding command: " + e.getMessage());
            e.printStackTrace();
        }
    }

    // Check for offline devices every 15 seconds (reduced from 2s to avoid DB spam)
    @Scheduled(fixedRate = 15000)
    public void checkOfflineDevices() {
        LocalDateTime timeout = LocalDateTime.now().minusSeconds(30); // 30 second timeout
        List<SensorDevice> allDevices = deviceRepository.findAll();

        for (SensorDevice device : allDevices) {
            if (device.getLastSeen() != null && device.getLastSeen().isBefore(timeout)) {
                if (!"offline".equals(device.getStatus())) {
                    device.setStatus("offline");
                    deviceRepository.save(device);
                    System.out.println("Device marked offline due to timeout: " + device.getDeviceId());
                }
            }
        }
    }

    /**
     * Publish a message to a specific MQTT topic
     */
    public void publishMessage(String topic, String payload) {
        try {
            System.out.println("Publishing to MQTT:");
            System.out.println("  Topic: " + topic);
            System.out.println("  Payload: " + payload);

            mqttOutboundChannel.send(
                    MessageBuilder.withPayload(payload)
                            .setHeader(MqttHeaders.TOPIC, topic)
                            .build());

            System.out.println("Message published successfully");
        } catch (Exception e) {
            System.err.println("Error publishing message: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Check if MQTT is connected
     */
    public boolean isConnected() {
        return connected;
    }
}
