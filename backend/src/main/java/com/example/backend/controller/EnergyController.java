package com.example.backend.controller;

import com.example.backend.dto.ApiResponse;
import com.example.backend.service.EnergyRateService;
import com.example.backend.service.SupabaseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Proxies energy and water-quality data from Supabase through the
 * Spring Boot backend (which has HTTPS via Traefik).
 *
 * This avoids Mixed Content browser errors that occur when an HTTPS
 * frontend tries to call the self-hosted HTTP-only Supabase directly.
 */
@RestController
@RequestMapping("/api/energy")
@CrossOrigin(origins = "*")
public class EnergyController {

    @Autowired
    private SupabaseService supabaseService;

    @Autowired
    private EnergyRateService energyRateService;

    /**
     * GET /api/energy/live
     * Returns the latest row(s) from the energydb live table.
     * Optional query param: ?deviceId=BM_000
     */
    @GetMapping("/live")
    public ResponseEntity<String> getEnergyLive(
            @RequestParam(required = false, defaultValue = "") String deviceId) {
        try {
            String json = supabaseService.readEnergyLive(deviceId);
            return ResponseEntity.ok()
                    .header("Content-Type", "application/json")
                    .body(json);
        } catch (Exception e) {
            return ResponseEntity.status(503)
                    .body("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    /**
     * GET /api/energy/history
     * Returns energy_history rows.
     * Query params: ?hours=24&limit=1500
     */
    @GetMapping("/history")
    public ResponseEntity<String> getEnergyHistory(
            @RequestParam(defaultValue = "24") int hours,
            @RequestParam(defaultValue = "1500") int limit) {
        try {
            String json = supabaseService.readEnergyHistory(hours, limit);
            return ResponseEntity.ok()
                    .header("Content-Type", "application/json")
                    .body(json);
        } catch (Exception e) {
            return ResponseEntity.status(503)
                    .body("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    /**
     * GET /api/energy/sensor/live
     * Returns the latest row(s) from sensor_live (water quality).
     */
    @GetMapping("/sensor/live")
    public ResponseEntity<String> getSensorLive(
            @RequestParam(required = false, defaultValue = "") String deviceId) {
        try {
            String json = supabaseService.readSensorLive(deviceId);
            return ResponseEntity.ok()
                    .header("Content-Type", "application/json")
                    .body(json);
        } catch (Exception e) {
            return ResponseEntity.status(503)
                    .body("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    /**
     * GET /api/energy/sensor/history
     * Returns sensor_history rows (water quality).
     */
    @GetMapping("/sensor/history")
    public ResponseEntity<String> getSensorHistory(
            @RequestParam(defaultValue = "24") int hours,
            @RequestParam(defaultValue = "1500") int limit) {
        try {
            String json = supabaseService.readSensorHistory(hours, limit);
            return ResponseEntity.ok()
                    .header("Content-Type", "application/json")
                    .body(json);
        } catch (Exception e) {
            return ResponseEntity.status(503)
                    .body("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    /**
     * GET /api/energy/rate
     * Returns the current configurable energy rate used by the daily allocator.
     */
    @GetMapping("/rate")
    public ResponseEntity<ApiResponse> getEnergyRate() {
        BigDecimal rate = energyRateService.getCurrentRate();
        return ResponseEntity.ok(new ApiResponse(true, "Energy rate retrieved", Map.of("rate", rate)));
    }

    /**
     * PUT /api/energy/rate
     * Updates the daily energy rate used by cost calculations and daily allocation.
     */
    @PutMapping("/rate")
    public ResponseEntity<ApiResponse> updateEnergyRate(@RequestBody Map<String, Object> body) {
        try {
            Object raw = body.get("rate");
            if (raw == null) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Missing 'rate' value", null));
            }
            BigDecimal rate = new BigDecimal(String.valueOf(raw));
            BigDecimal saved = energyRateService.setCurrentRate(rate);
            return ResponseEntity.ok(new ApiResponse(true, "Energy rate updated", Map.of("rate", saved)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(500)
                    .body(new ApiResponse(false, "Failed to update energy rate: " + e.getMessage(), null));
        }
    }
}
