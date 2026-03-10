package com.example.backend.controller;

import com.example.backend.dto.ApiResponse;
import com.example.backend.service.SupabaseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/fish-detection")
@CrossOrigin(origins = "*")
public class FishDetectionController {

    @Autowired
    private SupabaseService supabaseService;

    /**
     * GET /api/fish-detection/history?limit=20&offset=0&healthClass=healthy
     * Returns paginated detection history (without full image data).
     */
    @GetMapping("/history")
    public ResponseEntity<ApiResponse> getHistory(
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(required = false) String healthClass) {
        try {
            List<Map<String, Object>> rows = supabaseService.getFishDetectionHistory(
                    Math.min(limit, 100), offset, healthClass);
            return ResponseEntity.ok(new ApiResponse(true, "Detection history loaded", rows));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new ApiResponse(false, "Error loading history: " + e.getMessage(), null));
        }
    }

    /**
     * GET /api/fish-detection/image/{id}
     * Returns the base64 image for a specific detection event.
     */
    @GetMapping("/image/{id}")
    public ResponseEntity<ApiResponse> getImage(@PathVariable long id) {
        try {
            String image = supabaseService.getFishDetectionImage(id);
            if (image != null) {
                return ResponseEntity.ok(new ApiResponse(true, "Image loaded", image));
            }
            return ResponseEntity.ok(new ApiResponse(false, "No image found", null));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new ApiResponse(false, "Error loading image: " + e.getMessage(), null));
        }
    }

    /**
     * GET /api/fish-detection/summary
     * Returns count summary per health class.
     */
    @GetMapping("/summary")
    public ResponseEntity<ApiResponse> getSummary() {
        try {
            List<Map<String, Object>> summary = supabaseService.getFishDetectionSummary();
            return ResponseEntity.ok(new ApiResponse(true, "Summary loaded", summary));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new ApiResponse(false, "Error loading summary: " + e.getMessage(), null));
        }
    }

    /**
     * GET /api/fish-detection/export?limit=5000
     * Returns detection events for CSV export (no image data).
     */
    @GetMapping("/export")
    public ResponseEntity<ApiResponse> getExport(
            @RequestParam(defaultValue = "5000") int limit) {
        try {
            List<Map<String, Object>> rows = supabaseService.getFishDetectionsForExport(
                    Math.min(limit, 10000));
            return ResponseEntity.ok(new ApiResponse(true, "Export data loaded", rows));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(new ApiResponse(false, "Error loading export: " + e.getMessage(), null));
        }
    }
}
