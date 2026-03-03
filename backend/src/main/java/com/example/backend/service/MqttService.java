package com.example.backend.service;

import com.example.backend.entity.Pond;
import com.example.backend.entity.SensorDevice;
import com.example.backend.entity.SensorData;
import com.example.backend.repository.PondRepository;
import com.example.backend.repository.SensorDeviceRepository;
import com.example.backend.repository.SensorDataRepository;
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

@Service
public class MqttService {

    @Autowired
    private SensorDeviceRepository deviceRepository;

    @Autowired
    private SensorDataRepository dataRepository;

    @Autowired
    private PondRepository pondRepository;

    @Autowired
    private MessageChannel mqttOutboundChannel;

    @Autowired
    private FeedingWebSocketHandler feedingWebSocketHandler;

    @Autowired
    private com.example.backend.websocket.PowerWebSocketHandler powerWebSocketHandler;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private boolean connected = true; // Assume connected (Spring Integration handles connection)

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
            String deviceId = jsonNode.get("deviceId").asText();

            if (topic.contains("/status")) {
                handleStatusUpdate(deviceId, jsonNode);
                // Broadcast to the shared WebSocket channel — frontend filters by deviceId
                // prefix
                if (deviceId.contains("feed_device")) {
                    feedingWebSocketHandler.broadcast(payload);
                } else if (deviceId.startsWith("BM_")) {
                    feedingWebSocketHandler.broadcast(payload);
                }
            } else if (topic.contains("/data")) {
                handleSensorData(deviceId, jsonNode);
                // Energy/sensor data from BM_ devices broadcasted for EnergyMonitor
                if (deviceId.startsWith("BM_")) {
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

            System.out.println("Water quality data saved: " + deviceId + " - Pond: " +
                    (device.getPond() != null ? device.getPond().getId() : "Not assigned") +
                    " - pH:" + data.getPhValue() + " Turb:" + data.getTurbidity());
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

            // Always save energy data for BUDGET_MANAGEMENT devices
            dataRepository.save(data);

            System.out.println("⚡ Energy data saved: " + deviceId + " - Pond: " +
                    (device.getPond() != null ? device.getPond().getId() : "Unassigned") +
                    " - V:" + data.getVoltage() + " I:" + data.getCurrent() +
                    " P:" + data.getPower() + "W E:" + data.getEnergyWh() + "Wh");

            // Update device energy counter
            device.setEnergyWh(data.getEnergyWh());
        } else {
            // No relevant data to store
            device.setLastSeen(LocalDateTime.now());
            deviceRepository.save(device);
            System.out.println("⚠️ No sensor data to save for device: " + deviceId);
            return;
        }

        // Save sensor data if applicable
        if (device.getDeviceType() == SensorDevice.DeviceType.WATER_QUALITY) {
            dataRepository.save(data);
            System.out.println("✅ Water quality data saved to database for device: " + deviceId);
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
