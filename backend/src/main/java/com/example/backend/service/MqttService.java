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

    private final ObjectMapper objectMapper = new ObjectMapper();

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
            } else if (topic.contains("/data")) {
                handleSensorData(deviceId, jsonNode);
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
                    return newDevice;
                });

        device.setStatus(json.get("status").asText());
        device.setIpAddress(json.has("ipAddress") ? json.get("ipAddress").asText() : null);
        device.setRssi(json.has("rssi") ? json.get("rssi").asInt() : null);
        device.setEnergyWh(json.has("energyWh") ? json.get("energyWh").asDouble() : 0.0);
        device.setLastSeen(LocalDateTime.now());
        
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
        // The pondId in status is informational only (shows what the ESP32 thinks it's assigned to)
        // Actual assignment is controlled only by explicit assign/unassign API calls
        // This prevents devices from auto-reassigning themselves after manual unassignment

        deviceRepository.save(device);
        System.out.println("Device status updated: " + deviceId + " (Pond: " + 
                (device.getPond() != null ? device.getPond().getId() : "None") + ")");
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
            if (json.has("phValue")) data.setPhValue(json.get("phValue").asDouble());
            if (json.has("turbidity")) data.setTurbidity(json.get("turbidity").asDouble());
            if (json.has("airQuality")) data.setAirQuality(json.get("airQuality").asDouble());
            if (json.has("waterQualityStatus")) data.setWaterQualityStatus(json.get("waterQualityStatus").asText());
            
            System.out.println("Water quality data saved: " + deviceId + " - Pond: " +
                    (device.getPond() != null ? device.getPond().getId() : "Not assigned") +
                    " - pH:" + data.getPhValue() + " Turb:" + data.getTurbidity() + " Air:" + data.getAirQuality());
        } else if (json.has("voltage") && json.has("current") && json.has("power")) {
            // Store voltage/current data for budget management devices
            data.setVoltage(json.get("voltage").asDouble());
            data.setCurrent(json.get("current").asDouble());
            data.setPower(json.get("power").asDouble());
            data.setEnergyWh(json.get("energyWh").asDouble());
            
            System.out.println("Energy data saved: " + deviceId + " - Pond: " +
                    (device.getPond() != null ? device.getPond().getId() : "Not assigned") +
                    " - V:" + data.getVoltage() + " I:" + data.getCurrent() + " P:" + data.getPower());
        } else {
            // No relevant data to store
            device.setLastSeen(LocalDateTime.now());
            deviceRepository.save(device);
            return;
        }

        dataRepository.save(data);
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

    // Check for offline devices every 2 seconds for real-time detection
    @Scheduled(fixedRate = 2000)
    public void checkOfflineDevices() {
        LocalDateTime timeout = LocalDateTime.now().minusSeconds(15); // 15 second timeout (3x status interval)
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
}
