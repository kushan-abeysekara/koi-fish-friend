package com.example.backend.service;

import com.example.backend.entity.SensorDevice;
import com.example.backend.repository.SensorDeviceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Lightweight service — only handles offline detection.
 * All MQTT message processing is handled by MqttConfig + MqttService (EMQX broker).
 * The old duplicate SimpleMqttService (HiveMQ broker) has been removed to prevent
 * data overwrites and connection conflicts.
 */
@Service
public class SimpleMqttService {

    @Autowired
    private SensorDeviceRepository deviceRepository;

    // Check for offline devices every 2 seconds
    @Scheduled(fixedRate = 2000)
    public void checkOfflineDevices() {
        LocalDateTime timeout = LocalDateTime.now().minusSeconds(10);
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
