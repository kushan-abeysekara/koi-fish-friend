package com.example.backend.controller;

import com.example.backend.service.SimpleMqttService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/test")
public class TestController {

    @Autowired(required = false)
    private SimpleMqttService simpleMqttService;

    @GetMapping("/mqtt-status")
    public Map<String, Object> getMqttStatus() {
        Map<String, Object> status = new HashMap<>();
        
        if (simpleMqttService == null) {
            status.put("error", "SimpleMqttService not found");
            status.put("running", false);
        } else {
            status.put("running", true);
            status.put("message", "SimpleMqttService is loaded");
        }
        
        return status;
    }
    
    @PostMapping("/publish-test")
    public Map<String, Object> publishTest() {
        Map<String, Object> result = new HashMap<>();
        
        if (simpleMqttService == null) {
            result.put("success", false);
            result.put("error", "SimpleMqttService not available");
        } else {
            try {
                String topic = "koi/devices/feed_device_001/feeding/test";
                String payload = "{\"test\":true,\"timestamp\":" + System.currentTimeMillis() + "}";
                simpleMqttService.publishMessage(topic, payload);
                result.put("success", true);
                result.put("message", "Test message published");
            } catch (Exception e) {
                result.put("success", false);
                result.put("error", e.getMessage());
            }
        }
        
        return result;
    }
}
