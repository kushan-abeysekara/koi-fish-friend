package com.example.backend.controller;

import com.example.backend.service.SupabaseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
}
