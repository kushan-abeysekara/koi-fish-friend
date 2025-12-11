package com.example.backend.controller;

import com.example.backend.dto.ApiResponse;
import com.example.backend.entity.SensorData;
import com.example.backend.entity.SensorDevice;
import com.example.backend.repository.SensorDataRepository;
import com.example.backend.repository.SensorDeviceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/sensor-data")
@CrossOrigin(origins = "*")
public class SensorDataController {

    @Autowired
    private SensorDataRepository dataRepository;

    @Autowired
    private SensorDeviceRepository deviceRepository;

    @GetMapping("/pond/{pondId}")
    public ResponseEntity<ApiResponse> getDataByPond(@PathVariable Long pondId) {
        try {
            // Only return data from the last hour to avoid showing stale data
            LocalDateTime oneHourAgo = LocalDateTime.now().minusHours(1);
            List<SensorData> data = dataRepository.findByPondIdAndTimestampAfter(pondId, oneHourAgo);
            return ResponseEntity.ok(new ApiResponse(true, "Sensor data retrieved successfully", data));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving sensor data: " + e.getMessage(), null));
        }
    }

    @GetMapping("/pond/{pondId}/latest")
    public ResponseEntity<ApiResponse> getLatestDataByPond(@PathVariable Long pondId) {
        try {
            // Check if there's an online device assigned to this pond
            SensorDevice device = deviceRepository.findByPondIdAndStatus(pondId, "online").orElse(null);

            if (device == null) {
                // No online device for this pond
                return ResponseEntity.ok(new ApiResponse(true, "No active device for this pond", null));
            }

            SensorData data = dataRepository.findLatestByPond(pondId);

            // Check if data is recent (within last 2 minutes)
            if (data != null && data.getTimestamp() != null) {
                LocalDateTime twoMinutesAgo = LocalDateTime.now().minusMinutes(2);
                if (data.getTimestamp().isBefore(twoMinutesAgo)) {
                    // Data is stale
                    return ResponseEntity.ok(new ApiResponse(true, "Sensor data is stale", null));
                }
            }

            return ResponseEntity.ok(new ApiResponse(true, "Latest sensor data retrieved successfully", data));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving latest sensor data: " + e.getMessage(), null));
        }
    }

    @GetMapping("/pond/{pondId}/history")
    public ResponseEntity<ApiResponse> getHistoricalData(
            @PathVariable Long pondId,
            @RequestParam(defaultValue = "24") int hours) {

        try {
            LocalDateTime since = LocalDateTime.now().minusHours(hours);
            List<SensorData> data = dataRepository.findByPondIdAndTimestampAfter(pondId, since);

            return ResponseEntity.ok(new ApiResponse(true, "Historical sensor data retrieved successfully", data));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving historical sensor data: " + e.getMessage(), null));
        }
    }
}
