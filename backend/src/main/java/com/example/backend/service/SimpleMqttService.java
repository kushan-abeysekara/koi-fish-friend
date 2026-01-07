package com.example.backend.service;

import com.example.backend.entity.SensorDevice;
import com.example.backend.repository.SensorDeviceRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.eclipse.paho.client.mqttv3.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.time.LocalDateTime;

@Service
public class SimpleMqttService implements MqttCallback {

    @Autowired
    private SensorDeviceRepository deviceRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MqttClient mqttClient;
    
    private static final String BROKER_URL = "tcp://broker.hivemq.com:1883";
    private static final String CLIENT_ID = "spring-backend-simple-mqtt";
    private static final String[] TOPICS = {
        "koi/sensors/+/data",
        "koi/sensors/+/status",
        "koi/devices/+/feeding/status"
    };

    @PostConstruct
    public void init() {
        try {
            System.out.println("=== Initializing Simple MQTT Service ===");
            mqttClient = new MqttClient(BROKER_URL, CLIENT_ID);
            
            MqttConnectOptions options = new MqttConnectOptions();
            options.setCleanSession(true);
            options.setAutomaticReconnect(true);
            options.setConnectionTimeout(10);
            options.setKeepAliveInterval(20);
            
            mqttClient.setCallback(this);
            mqttClient.connect(options);
            
            System.out.println("✓ Connected to MQTT broker: " + BROKER_URL);
            
            // Subscribe to topics
            for (String topic : TOPICS) {
                mqttClient.subscribe(topic, 1);
                System.out.println("✓ Subscribed to: " + topic);
            }
            
            System.out.println("=== MQTT Service Ready ===");
        } catch (MqttException e) {
            System.err.println("✗ Failed to initialize MQTT: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @PreDestroy
    public void cleanup() {
        try {
            if (mqttClient != null && mqttClient.isConnected()) {
                mqttClient.disconnect();
                mqttClient.close();
                System.out.println("MQTT client disconnected");
            }
        } catch (MqttException e) {
            System.err.println("Error disconnecting MQTT: " + e.getMessage());
        }
    }

    @Override
    public void connectionLost(Throwable cause) {
        System.err.println("MQTT connection lost: " + cause.getMessage());
    }

    @Override
    public void messageArrived(String topic, MqttMessage message) throws Exception {
        try {
            String payload = new String(message.getPayload());
            System.out.println("\n=== MQTT Message Received ===");
            System.out.println("Topic: " + topic);
            System.out.println("Payload: " + payload);
            
            JsonNode jsonNode = objectMapper.readTree(payload);
            String deviceId = jsonNode.get("deviceId").asText();
            
            if (topic.contains("/status")) {
                System.out.println("Processing status update for: " + deviceId);
                handleStatusUpdate(deviceId, jsonNode);
            } else if (topic.contains("/data")) {
                System.out.println("Processing sensor data for: " + deviceId);
                // Handle sensor data if needed
            }
            
            System.out.println("=== Message Processed ===\n");
        } catch (Exception e) {
            System.err.println("Error processing MQTT message: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken token) {
        // Not used for incoming messages
    }

    private void handleStatusUpdate(String deviceId, JsonNode json) {
        SensorDevice device = deviceRepository.findByDeviceId(deviceId)
                .orElseGet(() -> {
                    System.out.println("Creating new device: " + deviceId);
                    SensorDevice newDevice = new SensorDevice();
                    newDevice.setDeviceId(deviceId);
                    if (deviceId.contains("feed_device")) {
                        newDevice.setDeviceType(SensorDevice.DeviceType.FEEDING_MANAGEMENT);
                    }
                    return newDevice;
                });

        // Set device status to online
        device.setStatus("online");
        device.setLastSeen(LocalDateTime.now());
        
        // Handle feeding device specific fields
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
            device.setFeedingActive(json.get("feedingActive").asBoolean());
        }
        
        deviceRepository.save(device);
        System.out.println("✓ Device updated: " + deviceId + " - Status: online - Hopper: " + device.getHopperLevel() + "g");
    }
    
    public void publishMessage(String topic, String payload) {
        try {
            if (mqttClient != null && mqttClient.isConnected()) {
                MqttMessage message = new MqttMessage(payload.getBytes());
                message.setQos(1);
                mqttClient.publish(topic, message);
                System.out.println("Published to " + topic + ": " + payload);
            } else {
                System.err.println("Cannot publish - MQTT client not connected");
            }
        } catch (MqttException e) {
            System.err.println("Error publishing MQTT message: " + e.getMessage());
        }
    }
}
