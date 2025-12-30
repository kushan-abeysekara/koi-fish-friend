package com.example.backend.controller;

import com.example.backend.dto.ApiResponse;
import com.example.backend.dto.FishCountRequest;
import com.example.backend.entity.FishCount;
import com.example.backend.service.FishCountService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/fish-counts")
@CrossOrigin(origins = "*")
public class FishCountController {

    @Autowired
    private FishCountService fishCountService;

    @GetMapping
    public ResponseEntity<ApiResponse> getAllFishCounts() {
        try {
            List<FishCount> fishCounts = fishCountService.getAllFishCounts();
            return ResponseEntity.ok(new ApiResponse(true, "Fish counts retrieved successfully", fishCounts));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving fish counts: " + e.getMessage(), null));
        }
    }

    @GetMapping("/pond/{pondId}")
    public ResponseEntity<ApiResponse> getFishCountsByPond(@PathVariable Long pondId) {
        try {
            List<FishCount> fishCounts = fishCountService.getFishCountsByPond(pondId);
            return ResponseEntity.ok(new ApiResponse(true, "Fish counts retrieved successfully", fishCounts));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving fish counts: " + e.getMessage(), null));
        }
    }

    @GetMapping("/pond/{pondId}/date-range")
    public ResponseEntity<ApiResponse> getFishCountsByPondAndDateRange(
            @PathVariable Long pondId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        try {
            List<FishCount> fishCounts = fishCountService.getFishCountsByPondAndDateRange(pondId, startDate, endDate);
            return ResponseEntity.ok(new ApiResponse(true, "Fish counts retrieved successfully", fishCounts));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving fish counts: " + e.getMessage(), null));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse> getFishCountById(@PathVariable Long id) {
        try {
            FishCount fishCount = fishCountService.getFishCountById(id);
            return ResponseEntity.ok(new ApiResponse(true, "Fish count retrieved successfully", fishCount));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving fish count: " + e.getMessage(), null));
        }
    }

    @PostMapping
    public ResponseEntity<ApiResponse> createFishCount(@RequestBody FishCountRequest request) {
        try {
            FishCount fishCount = fishCountService.createFishCount(request);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new ApiResponse(true, "Fish count created successfully", fishCount));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error creating fish count: " + e.getMessage(), null));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse> updateFishCount(@PathVariable Long id, @RequestBody FishCountRequest request) {
        try {
            FishCount fishCount = fishCountService.updateFishCount(id, request);
            return ResponseEntity.ok(new ApiResponse(true, "Fish count updated successfully", fishCount));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error updating fish count: " + e.getMessage(), null));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> deleteFishCount(@PathVariable Long id) {
        try {
            fishCountService.deleteFishCount(id);
            return ResponseEntity.ok(new ApiResponse(true, "Fish count deleted successfully", null));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error deleting fish count: " + e.getMessage(), null));
        }
    }
}
