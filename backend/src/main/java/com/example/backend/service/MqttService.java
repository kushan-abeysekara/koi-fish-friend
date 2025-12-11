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
        device.setEnergyWh(json.has("energyWh") ? json.get("energyWh").asDouble() : null);
        device.setLastSeen(LocalDateTime.now());

        // Handle pond assignment/unassignment
        if (json.has("pondId")) {
            int pondId = json.get("pondId").asInt();
            if (pondId > 0) {
                // Assign to pond
                pondRepository.findById((long) pondId).ifPresent(device::setPond);
            } else {
                // Unassign from pond (pondId = 0)
                device.setPond(null);
            }
        }

        deviceRepository.save(device);
        System.out.println("Device status updated: " + deviceId);
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
        data.setVoltage(json.get("voltage").asDouble());
        data.setCurrent(json.get("current").asDouble());
        data.setPower(json.get("power").asDouble());
        data.setEnergyWh(json.get("energyWh").asDouble());
        data.setStatus(json.has("status") ? json.get("status").asText() : "normal");

        dataRepository.save(data);
        device.setLastSeen(LocalDateTime.now());
        deviceRepository.save(device);

        System.out.println("Sensor data saved: " + deviceId + " - Pond: " +
                (device.getPond() != null ? device.getPond().getId() : "Not assigned") +
                " - V:" + data.getVoltage() + " I:" + data.getCurrent() + " P:" + data.getPower());
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

    // Check for offline devices every 3 seconds for faster detection
    @Scheduled(fixedRate = 3000)
    public void checkOfflineDevices() {
        LocalDateTime timeout = LocalDateTime.now().minusSeconds(15); // 15 second timeout
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
