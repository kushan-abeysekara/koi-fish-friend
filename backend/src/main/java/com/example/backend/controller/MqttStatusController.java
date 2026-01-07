package com.example.backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/mqtt")
public class MqttStatusController {

    @Autowired(required = false)
    @Qualifier("inbound")
    private MqttPahoMessageDrivenChannelAdapter mqttAdapter;

    @GetMapping("/status")
    public Map<String, Object> getMqttStatus() {
        Map<String, Object> status = new HashMap<>();
        
        if (mqttAdapter == null) {
            status.put("connected", false);
            status.put("error", "MQTT adapter not initialized");
            return status;
        }
        
        try {
            status.put("running", mqttAdapter.isRunning());
            status.put("autoStartup", mqttAdapter.isAutoStartup());
            status.put("componentName", mqttAdapter.getComponentName());
            status.put("connected", mqttAdapter.isRunning());
        } catch (Exception e) {
            status.put("error", e.getMessage());
            status.put("connected", false);
        }
        
        return status;
    }
}
