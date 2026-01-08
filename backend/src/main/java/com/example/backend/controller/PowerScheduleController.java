package com.example.backend.controller;

import com.example.backend.dto.ApiResponse;
import com.example.backend.entity.PowerSchedule;
import com.example.backend.entity.SensorDevice;
import com.example.backend.repository.PowerScheduleRepository;
import com.example.backend.repository.SensorDeviceRepository;
import com.example.backend.service.MqttService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/power-schedules")
@CrossOrigin(origins = "*")
public class PowerScheduleController {

    @Autowired
    private PowerScheduleRepository scheduleRepository;

    @Autowired
    private SensorDeviceRepository deviceRepository;

    @Autowired
    private MqttService mqttService;

    /**
     * Get all schedules for a specific device
     */
    @GetMapping("/device/{deviceId}")
    public ResponseEntity<ApiResponse> getSchedulesByDevice(@PathVariable String deviceId) {
        try {
            List<PowerSchedule> schedules = scheduleRepository.findByDeviceId(deviceId);
            return ResponseEntity.ok(new ApiResponse(true, "Schedules retrieved successfully", schedules));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving schedules: " + e.getMessage(), null));
        }
    }

    /**
     * Get a specific schedule by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse> getSchedule(@PathVariable Long id) {
        try {
            PowerSchedule schedule = scheduleRepository.findById(id).orElse(null);
            if (schedule == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Schedule not found", null));
            }
            return ResponseEntity.ok(new ApiResponse(true, "Schedule retrieved successfully", schedule));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving schedule: " + e.getMessage(), null));
        }
    }

    /**
     * Create a new schedule
     */
    @PostMapping
    public ResponseEntity<ApiResponse> createSchedule(@RequestBody PowerSchedule schedule) {
        try {
            // Validate device exists and is BUDGET_MANAGEMENT type
            SensorDevice device = deviceRepository.findByDeviceId(schedule.getDeviceId()).orElse(null);
            if (device == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Device not found", null));
            }

            if (device.getDeviceType() != SensorDevice.DeviceType.BUDGET_MANAGEMENT) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(new ApiResponse(false, "Only BUDGET_MANAGEMENT devices support schedules", null));
            }

            // Save schedule
            PowerSchedule savedSchedule = scheduleRepository.save(schedule);

            // Sync schedules to ESP32
            syncSchedulesToDevice(schedule.getDeviceId());

            return ResponseEntity.ok(new ApiResponse(true, "Schedule created successfully", savedSchedule));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error creating schedule: " + e.getMessage(), null));
        }
    }

    /**
     * Update an existing schedule
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse> updateSchedule(@PathVariable Long id, @RequestBody PowerSchedule schedule) {
        try {
            PowerSchedule existingSchedule = scheduleRepository.findById(id).orElse(null);
            if (existingSchedule == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Schedule not found", null));
            }

            // Update fields
            existingSchedule.setName(schedule.getName());
            existingSchedule.setStartTime(schedule.getStartTime());
            existingSchedule.setEndTime(schedule.getEndTime());
            existingSchedule.setDaysOfWeek(schedule.getDaysOfWeek());
            existingSchedule.setEnabled(schedule.getEnabled());

            PowerSchedule updatedSchedule = scheduleRepository.save(existingSchedule);

            // Sync schedules to ESP32
            syncSchedulesToDevice(existingSchedule.getDeviceId());

            return ResponseEntity.ok(new ApiResponse(true, "Schedule updated successfully", updatedSchedule));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error updating schedule: " + e.getMessage(), null));
        }
    }

    /**
     * Toggle schedule enabled status
     */
    @PutMapping("/{id}/toggle")
    public ResponseEntity<ApiResponse> toggleSchedule(@PathVariable Long id) {
        try {
            PowerSchedule schedule = scheduleRepository.findById(id).orElse(null);
            if (schedule == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Schedule not found", null));
            }

            schedule.setEnabled(!schedule.getEnabled());
            PowerSchedule updatedSchedule = scheduleRepository.save(schedule);

            // Sync schedules to ESP32
            syncSchedulesToDevice(schedule.getDeviceId());

            return ResponseEntity.ok(new ApiResponse(true, "Schedule toggled successfully", updatedSchedule));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error toggling schedule: " + e.getMessage(), null));
        }
    }

    /**
     * Delete a schedule
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> deleteSchedule(@PathVariable Long id) {
        try {
            PowerSchedule schedule = scheduleRepository.findById(id).orElse(null);
            if (schedule == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Schedule not found", null));
            }

            String deviceId = schedule.getDeviceId();
            scheduleRepository.deleteById(id);

            // Sync remaining schedules to ESP32
            syncSchedulesToDevice(deviceId);

            return ResponseEntity.ok(new ApiResponse(true, "Schedule deleted successfully", null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error deleting schedule: " + e.getMessage(), null));
        }
    }

    /**
     * Sync all schedules to ESP32 device via MQTT
     */
    @PostMapping("/device/{deviceId}/sync")
    public ResponseEntity<ApiResponse> syncSchedules(@PathVariable String deviceId) {
        try {
            syncSchedulesToDevice(deviceId);
            return ResponseEntity.ok(new ApiResponse(true, "Schedules synced to device successfully", null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error syncing schedules: " + e.getMessage(), null));
        }
    }

    /**
     * Helper method to sync schedules to ESP32
     */
    private void syncSchedulesToDevice(String deviceId) {
        List<PowerSchedule> schedules = scheduleRepository.findByDeviceIdAndEnabled(deviceId, true);

        Map<String, Object> data = new HashMap<>();
        data.put("schedules", schedules.stream().map(schedule -> {
            Map<String, Object> scheduleMap = new HashMap<>();
            scheduleMap.put("name", schedule.getName());
            scheduleMap.put("enabled", schedule.getEnabled());
            scheduleMap.put("startHour", schedule.getStartTime().getHour());
            scheduleMap.put("startMinute", schedule.getStartTime().getMinute());
            scheduleMap.put("endHour", schedule.getEndTime().getHour());
            scheduleMap.put("endMinute", schedule.getEndTime().getMinute());
            scheduleMap.put("daysOfWeek", schedule.getDaysOfWeekArray()); // Convert to boolean array for ESP32
            return scheduleMap;
        }).toList());

        mqttService.sendCommand(deviceId, "sync_schedules", data);
        System.out.println("📅 Synced " + schedules.size() + " schedules to device " + deviceId);
    }
}
