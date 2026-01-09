package com.example.backend.controller;

import com.example.backend.dto.ApiResponse;
import com.example.backend.dto.WebSocketDataRequest;
import com.example.backend.entity.SensorData;
import com.example.backend.entity.SensorDevice;
import com.example.backend.entity.Pond;
import com.example.backend.repository.SensorDataRepository;
import com.example.backend.repository.SensorDeviceRepository;
import com.example.backend.repository.PondRepository;
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

    @Autowired
    private PondRepository pondRepository;

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
            System.out.println("📊 Fetching latest water quality data for pond: " + pondId);

            // Get latest water quality data only for this specific pond
            SensorData data = dataRepository.findLatestByPondAndDeviceType(pondId,
                    SensorDevice.DeviceType.WATER_QUALITY);

            if (data == null) {
                System.out.println("⚠️ No water quality data found for pond: " + pondId);
                return ResponseEntity.ok(new ApiResponse(true,
                        "No water quality sensor assigned to this pond or no data received yet", null));
            }

            // Verify pond assignment matches (extra safety check)
            if (data.getPond() == null || !data.getPond().getId().equals(pondId)) {
                System.err.println("❌ Data pond mismatch! Requested pond:" + pondId +
                        " but data is for pond:" + (data.getPond() != null ? data.getPond().getId() : "null"));
                return ResponseEntity.ok(new ApiResponse(true,
                        "Data integrity error - pond mismatch", null));
            }

            // Verify at least one water quality parameter exists (no dummy data)
            if (data.getPhValue() == null && data.getTurbidity() == null && data.getAmmonia() == null) {
                System.out.println("⚠️ Data exists but no valid water quality parameters for pond: " + pondId);
                return ResponseEntity.ok(new ApiResponse(true,
                        "Sensor connected but not sending valid water quality data", null));
            }

            // Check if data is recent (within last 5 minutes)
            if (data.getTimestamp() != null) {
                LocalDateTime fiveMinutesAgo = LocalDateTime.now().minusMinutes(5);
                if (data.getTimestamp().isBefore(fiveMinutesAgo)) {
                    System.out.println("⚠️ Sensor data is stale for pond " + pondId +
                            " (Last update: " + data.getTimestamp() + ")");
                    // Still return data but with stale message
                    return ResponseEntity.ok(new ApiResponse(true,
                            "Sensor data is stale (last update: " + data.getTimestamp() +
                                    "). ESP32 may be offline.",
                            data));
                }
            }

            System.out.println("✅ Returning fresh water quality data for pond " + pondId +
                    " from device " + data.getDevice().getDeviceId() +
                    " - pH:" + data.getPhValue() + " Turb:" + data.getTurbidity() + " NH3:" + data.getAmmonia());
            return ResponseEntity.ok(new ApiResponse(true, "Latest sensor data retrieved successfully", data));
        } catch (Exception e) {
            System.err.println("❌ Error retrieving latest sensor data: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving latest sensor data: " + e.getMessage(), null));
        }
    }

    @PostMapping("/websocket")
    public ResponseEntity<ApiResponse> saveFromWebSocket(@RequestBody WebSocketDataRequest request) {
        try {
            System.out.println("📥 Received WebSocket data save request:");
            System.out.println("   Device ID: " + request.getDeviceId());
            System.out.println("   Pond ID: " + request.getPondId());
            System.out.println("   pH: " + request.getPhValue());
            System.out.println("   Turbidity: " + request.getTurbidity());
            System.out.println("   CO2: " + request.getCo2Level() + " PPM");
            System.out.println("   NH3: " + request.getAmmonia() + " PPM");
            System.out.println("   Status: " + request.getWaterQualityStatus());

            // Find or create device
            SensorDevice device = deviceRepository.findByDeviceId(request.getDeviceId())
                    .orElseGet(() -> {
                        System.out.println("⚠️ Device not found, creating new device: " + request.getDeviceId());
                        SensorDevice newDevice = new SensorDevice();
                        newDevice.setDeviceId(request.getDeviceId());
                        newDevice.setDeviceType(SensorDevice.DeviceType.WATER_QUALITY);
                        newDevice.setStatus("ONLINE");
                        return deviceRepository.save(newDevice);
                    });

            // Find pond
            Pond pond = pondRepository.findById(request.getPondId())
                    .orElseThrow(() -> new RuntimeException("Pond not found: " + request.getPondId()));

            // Create sensor data
            SensorData data = new SensorData();
            data.setDevice(device);
            data.setPond(pond);
            data.setPhValue(request.getPhValue());
            data.setTurbidity(request.getTurbidity());
            data.setCo2Level(request.getCo2Level());
            data.setAmmonia(request.getAmmonia());
            data.setWaterQualityStatus(request.getWaterQualityStatus());
            data.setTimestamp(LocalDateTime.now());

            // Save to database
            SensorData savedData = dataRepository.save(data);

            System.out.println("✅ Data saved successfully with ID: " + savedData.getId() +
                    " - pH:" + savedData.getPhValue() +
                    " Turb:" + savedData.getTurbidity() +
                    " CO2:" + savedData.getCo2Level() + "PPM" +
                    " NH3:" + savedData.getAmmonia() + "PPM");

            return ResponseEntity.ok(new ApiResponse(true, "Sensor data saved successfully", savedData));
        } catch (Exception e) {
            System.err.println("❌ Error saving WebSocket data: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error saving sensor data: " + e.getMessage(), null));
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

    @GetMapping("/pond/{pondId}/latest/energy")
    public ResponseEntity<ApiResponse> getLatestEnergyDataByPond(@PathVariable Long pondId) {
        try {
            System.out.println("⚡ Fetching latest energy data for pond: " + pondId);

            // Get latest energy data for BUDGET_MANAGEMENT devices
            SensorData data = dataRepository.findLatestByPondAndDeviceType(pondId,
                    SensorDevice.DeviceType.BUDGET_MANAGEMENT);

            if (data == null) {
                System.out.println("⚠️ No energy monitoring device found for pond: " + pondId);
                return ResponseEntity.ok(new ApiResponse(true,
                        "No energy monitoring device assigned to this pond or no data received yet", null));
            }

            // Verify pond assignment matches
            if (data.getPond() == null || !data.getPond().getId().equals(pondId)) {
                System.err.println("❌ Data pond mismatch! Requested pond:" + pondId +
                        " but data is for pond:" + (data.getPond() != null ? data.getPond().getId() : "null"));
                return ResponseEntity.ok(new ApiResponse(true,
                        "Data integrity error - pond mismatch", null));
            }

            // Check if data is recent (within last 30 seconds)
            if (data.getTimestamp() != null) {
                LocalDateTime thirtySecondsAgo = LocalDateTime.now().minusSeconds(30);
                if (data.getTimestamp().isBefore(thirtySecondsAgo)) {
                    System.out.println("⚠️ Energy data is stale for pond " + pondId +
                            " (Last update: " + data.getTimestamp() + ")");
                }
            }

            System.out.println("✅ Returning energy data for pond " + pondId +
                    " from device " + data.getDevice().getDeviceId() +
                    " - V:" + data.getVoltage() + " I:" + data.getCurrent() +
                    " P:" + data.getPower() + "W E:" + data.getEnergyWh() + "Wh");
            return ResponseEntity.ok(new ApiResponse(true, "Latest energy data retrieved successfully", data));
        } catch (Exception e) {
            System.err.println("❌ Error retrieving latest energy data: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving latest energy data: " + e.getMessage(), null));
        }
    }

    @GetMapping("/pond/{pondId}/history/energy")
    public ResponseEntity<ApiResponse> getHistoricalEnergyData(
            @PathVariable Long pondId,
            @RequestParam(defaultValue = "24") int hours) {

        try {
            System.out.println("⚡ Fetching energy history for pond " + pondId + " (last " + hours + " hours)");
            LocalDateTime since = LocalDateTime.now().minusHours(hours);

            // Get all energy data for this pond in the specified time range
            List<SensorData> allData = dataRepository.findByPondIdAndTimestampAfter(pondId, since);

            // Filter for BUDGET_MANAGEMENT devices only
            List<SensorData> energyData = allData.stream()
                    .filter(d -> d.getDevice() != null &&
                            d.getDevice().getDeviceType() == SensorDevice.DeviceType.BUDGET_MANAGEMENT)
                    .toList();

            System.out.println("✅ Found " + energyData.size() + " energy data points for pond " + pondId);
            return ResponseEntity
                    .ok(new ApiResponse(true, "Historical energy data retrieved successfully", energyData));
        } catch (Exception e) {
            System.err.println("❌ Error retrieving historical energy data: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving historical energy data: " + e.getMessage(), null));
        }
    }
}
