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

    @GetMapping("/device/{deviceId}")
    public ResponseEntity<ApiResponse> getDeviceByDeviceId(@PathVariable String deviceId) {
        try {
            SensorDevice device = deviceRepository.findByDeviceId(deviceId).orElse(null);
            if (device == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Device not found with device_id: " + deviceId, null));
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

            System.out.println("ASSIGN: Before - Device " + deviceId + " pond: " +
                    (device.getPond() != null ? device.getPond().getId() : "null") +
                    ", Target pondId: " + pondId);

            if (pondId == null || pondId == 0) {
                device.setPond(null);
            } else {
                pondRepository.findById(pondId).ifPresent(device::setPond);
            }

            device = deviceRepository.save(device);

            System.out.println("ASSIGN: After save - Device " + deviceId + " pond: " +
                    (device.getPond() != null ? device.getPond().getId() : "null"));

            // Send MQTT command to device
            Map<String, Object> commandData = new HashMap<>();
            commandData.put("pondId", pondId != null ? pondId : 0);
            mqttService.sendCommand(deviceId, "assign", commandData);

            // Re-fetch to ensure proper state
            device = deviceRepository.findByDeviceId(deviceId).orElse(device);

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

            System.out.println("UNASSIGN: Before - Device " + deviceId + " pond: " +
                    (device.getPond() != null ? device.getPond().getId() : "null"));

            device.setPond(null);
            device = deviceRepository.save(device);

            System.out.println("UNASSIGN: After save - Device " + deviceId + " pond: " +
                    (device.getPond() != null ? device.getPond().getId() : "null"));

            // Send MQTT command to device
            Map<String, Object> commandData = new HashMap<>();
            commandData.put("pondId", 0);
            mqttService.sendCommand(deviceId, "unassign", commandData);

            // Re-fetch the device to ensure pond is null in the response
            device = deviceRepository.findByDeviceId(deviceId).orElse(device);

            System.out.println("UNASSIGN: After re-fetch - Device " + deviceId + " pond: " +
                    (device.getPond() != null ? device.getPond().getId() : "null"));

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

    @PostMapping("/{deviceId}/power-on")
    public ResponseEntity<ApiResponse> powerOn(@PathVariable String deviceId) {
        try {
            SensorDevice device = deviceRepository.findByDeviceId(deviceId).orElse(null);
            if (device == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Device not found", null));
            }

            if (device.getDeviceType() != SensorDevice.DeviceType.BUDGET_MANAGEMENT) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(new ApiResponse(false, "Power control only available for BUDGET_MANAGEMENT devices",
                                null));
            }

            mqttService.sendCommand(deviceId, "power_on", null);
            System.out.println("⚡ Power ON command sent to device: " + deviceId);

            return ResponseEntity.ok(new ApiResponse(true, "Power ON command sent successfully", null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error sending power ON command: " + e.getMessage(), null));
        }
    }

    @PostMapping("/{deviceId}/power-off")
    public ResponseEntity<ApiResponse> powerOff(@PathVariable String deviceId) {
        try {
            SensorDevice device = deviceRepository.findByDeviceId(deviceId).orElse(null);
            if (device == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Device not found", null));
            }

            if (device.getDeviceType() != SensorDevice.DeviceType.BUDGET_MANAGEMENT) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(new ApiResponse(false, "Power control only available for BUDGET_MANAGEMENT devices",
                                null));
            }

            mqttService.sendCommand(deviceId, "power_off", null);
            System.out.println("⚡ Power OFF command sent to device: " + deviceId);

            return ResponseEntity.ok(new ApiResponse(true, "Power OFF command sent successfully", null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error sending power OFF command: " + e.getMessage(), null));
        }
    }

    @PostMapping("/{deviceId}/auto-mode")
    public ResponseEntity<ApiResponse> setAutoMode(@PathVariable String deviceId) {
        try {
            SensorDevice device = deviceRepository.findByDeviceId(deviceId).orElse(null);
            if (device == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Device not found", null));
            }

            if (device.getDeviceType() != SensorDevice.DeviceType.BUDGET_MANAGEMENT) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(new ApiResponse(false, "Power control only available for BUDGET_MANAGEMENT devices",
                                null));
            }

            mqttService.sendCommand(deviceId, "auto_mode", null);
            System.out.println("⚡ AUTO mode command sent to device: " + deviceId);

            return ResponseEntity.ok(new ApiResponse(true, "AUTO mode command sent successfully", null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error sending AUTO mode command: " + e.getMessage(), null));
        }
    }

    @PostMapping("/{deviceId}/schedule-mode")
    public ResponseEntity<ApiResponse> setScheduleMode(@PathVariable String deviceId) {
        try {
            SensorDevice device = deviceRepository.findByDeviceId(deviceId).orElse(null);
            if (device == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Device not found", null));
            }

            if (device.getDeviceType() != SensorDevice.DeviceType.BUDGET_MANAGEMENT) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(new ApiResponse(false, "Schedule mode only available for BUDGET_MANAGEMENT devices",
                                null));
            }

            mqttService.sendCommand(deviceId, "schedule_mode", null);
            System.out.println("📅 SCHEDULE mode command sent to device: " + deviceId);

            return ResponseEntity.ok(new ApiResponse(true, "SCHEDULE mode command sent successfully", null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error sending SCHEDULE mode command: " + e.getMessage(), null));
        }
    }
}
