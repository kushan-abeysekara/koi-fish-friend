package com.example.backend.controller;

import com.example.backend.service.MqttService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/test")
public class TestController {

    @Autowired(required = false)
    private MqttService mqttService;

    @GetMapping("/mqtt-status")
    public Map<String, Object> getMqttStatus() {
        Map<String, Object> status = new HashMap<>();
        
        if (mqttService == null) {
            status.put("error", "MqttService not found");
            status.put("running", false);
        } else {
            status.put("running", true);
            status.put("message", "MqttService is loaded (EMQX broker)");
        }
        
        return status;
    }
    
    @PostMapping("/publish-test")
    public Map<String, Object> publishTest() {
        Map<String, Object> result = new HashMap<>();
        
        if (mqttService == null) {
            result.put("success", false);
            result.put("error", "MqttService not available");
        } else {
            try {
                mqttService.sendCommand("feed_device_001", "test", Map.of("timestamp", System.currentTimeMillis()));
                result.put("success", true);
                result.put("message", "Test message published via EMQX");
            } catch (Exception e) {
                result.put("success", false);
                result.put("error", e.getMessage());
            }
        }
        
        return result;
    }
}
