package com.example.backend.controller;

import com.example.backend.dto.ApiResponse;
import com.example.backend.entity.SensorDevice;
import com.example.backend.repository.SensorDeviceRepository;
import com.example.backend.repository.PondRepository;
import com.example.backend.service.MqttService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sensors")
@CrossOrigin(origins = "*")
public class SensorDeviceController {

    @Autowired
    private SensorDeviceRepository deviceRepository;

    @Autowired
    private PondRepository pondRepository;

    @Autowired
    private MqttService mqttService;

    @GetMapping
    public ResponseEntity<ApiResponse> getAllDevices() {
        try {
            List<SensorDevice> devices = deviceRepository.findAll();
            return ResponseEntity.ok(new ApiResponse(true, "Devices retrieved successfully", devices));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving devices: " + e.getMessage(), null));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse> getDevice(@PathVariable Long id) {
        try {
            SensorDevice device = deviceRepository.findById(id).orElse(null);
            if (device == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Device not found", null));
            }
            return ResponseEntity.ok(new ApiResponse(true, "Device retrieved successfully", device));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving device: " + e.getMessage(), null));
        }
    }

    @GetMapping("/pond/{pondId}")
    public ResponseEntity<ApiResponse> getDevicesByPond(@PathVariable Long pondId) {
        try {
            List<SensorDevice> devices = deviceRepository.findByPondId(pondId);
            return ResponseEntity.ok(new ApiResponse(true, "Devices retrieved successfully", devices));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving devices: " + e.getMessage(), null));
        }
    }

    @PostMapping("/{deviceId}/assign")
    public ResponseEntity<ApiResponse> assignToPond(
            @PathVariable String deviceId,
            @RequestBody Map<String, Long> request) {

        try {
            Long pondId = request.get("pondId");

            SensorDevice device = deviceRepository.findByDeviceId(deviceId).orElse(null);
            if (device == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Device not found", null));
            }

            if (pondId == null || pondId == 0) {
                device.setPond(null);
            } else {
                pondRepository.findById(pondId).ifPresent(device::setPond);
            }

            deviceRepository.save(device);

            // Send MQTT command to device
            Map<String, Object> commandData = new HashMap<>();
            commandData.put("pondId", pondId != null ? pondId : 0);
            mqttService.sendCommand(deviceId, "assign", commandData);

            return ResponseEntity.ok(new ApiResponse(true, "Device assigned successfully", device));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error assigning device: " + e.getMessage(), null));
        }
    }

    @PostMapping("/{deviceId}/unassign")
    public ResponseEntity<ApiResponse> unassignFromPond(@PathVariable String deviceId) {
        try {
            SensorDevice device = deviceRepository.findByDeviceId(deviceId).orElse(null);
            if (device == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Device not found", null));
            }

            device.setPond(null);
            deviceRepository.save(device);

            // Send MQTT command to device
            Map<String, Object> commandData = new HashMap<>();
            commandData.put("pondId", 0);
            mqttService.sendCommand(deviceId, "unassign", commandData);

            return ResponseEntity.ok(new ApiResponse(true, "Device unassigned successfully", device));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error unassigning device: " + e.getMessage(), null));
        }
    }

    @PostMapping("/{deviceId}/reset-energy")
    public ResponseEntity<ApiResponse> resetEnergy(@PathVariable String deviceId) {
        try {
            SensorDevice device = deviceRepository.findByDeviceId(deviceId).orElse(null);
            if (device == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Device not found", null));
            }

            mqttService.sendCommand(deviceId, "reset_energy", null);

            return ResponseEntity.ok(new ApiResponse(true, "Energy reset command sent", null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error resetting energy: " + e.getMessage(), null));
        }
    }
}
