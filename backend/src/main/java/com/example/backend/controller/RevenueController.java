package com.example.backend.controller;

import com.example.backend.dto.ApiResponse;
import com.example.backend.dto.RevenueRequest;
import com.example.backend.entity.Revenue;
import com.example.backend.service.RevenueService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/revenues")
@CrossOrigin(origins = "*")
public class RevenueController {

    @Autowired
    private RevenueService revenueService;

    @GetMapping
    public ResponseEntity<ApiResponse> getAllRevenues() {
        try {
            List<Revenue> revenues = revenueService.getAllRevenues();
            return ResponseEntity.ok(new ApiResponse(true, "Revenues retrieved successfully", revenues));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving revenues: " + e.getMessage(), null));
        }
    }

    @GetMapping("/pond/{pondId}")
    public ResponseEntity<ApiResponse> getRevenuesByPond(@PathVariable Long pondId) {
        try {
            List<Revenue> revenues = revenueService.getRevenuesByPond(pondId);
            return ResponseEntity.ok(new ApiResponse(true, "Revenues retrieved successfully", revenues));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving revenues: " + e.getMessage(), null));
        }
    }

    @GetMapping("/source/{source}")
    public ResponseEntity<ApiResponse> getRevenuesBySource(@PathVariable String source) {
        try {
            List<Revenue> revenues = revenueService.getRevenuesBySource(source);
            return ResponseEntity.ok(new ApiResponse(true, "Revenues retrieved successfully", revenues));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving revenues: " + e.getMessage(), null));
        }
    }

    @GetMapping("/pond/{pondId}/date-range")
    public ResponseEntity<ApiResponse> getRevenuesByPondAndDateRange(
            @PathVariable Long pondId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        try {
            List<Revenue> revenues = revenueService.getRevenuesByPondAndDateRange(pondId, startDate, endDate);
            return ResponseEntity.ok(new ApiResponse(true, "Revenues retrieved successfully", revenues));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving revenues: " + e.getMessage(), null));
        }
    }

    @GetMapping("/totals")
    public ResponseEntity<ApiResponse> getTotals() {
        try {
            Map<String, BigDecimal> totals = new HashMap<>();
            totals.put("totalAmount", revenueService.getTotalAmount());
            return ResponseEntity.ok(new ApiResponse(true, "Totals retrieved successfully", totals));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving totals: " + e.getMessage(), null));
        }
    }

    @GetMapping("/totals/pond/{pondId}")
    public ResponseEntity<ApiResponse> getTotalByPond(@PathVariable Long pondId) {
        try {
            Map<String, BigDecimal> totals = new HashMap<>();
            totals.put("totalAmount", revenueService.getTotalAmountByPond(pondId));
            return ResponseEntity.ok(new ApiResponse(true, "Pond total retrieved successfully", totals));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving pond total: " + e.getMessage(), null));
        }
    }

    @GetMapping("/totals/source/{source}")
    public ResponseEntity<ApiResponse> getTotalBySource(@PathVariable String source) {
        try {
            Map<String, BigDecimal> totals = new HashMap<>();
            totals.put("totalAmount", revenueService.getTotalAmountBySource(source));
            return ResponseEntity.ok(new ApiResponse(true, "Source total retrieved successfully", totals));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving source total: " + e.getMessage(), null));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse> getRevenueById(@PathVariable Long id) {
        try {
            Revenue revenue = revenueService.getRevenueById(id);
            return ResponseEntity.ok(new ApiResponse(true, "Revenue retrieved successfully", revenue));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving revenue: " + e.getMessage(), null));
        }
    }

    @PostMapping
    public ResponseEntity<ApiResponse> createRevenue(@RequestBody RevenueRequest request) {
        try {
            Revenue revenue = revenueService.createRevenue(request);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new ApiResponse(true, "Revenue created successfully", revenue));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error creating revenue: " + e.getMessage(), null));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse> updateRevenue(@PathVariable Long id, @RequestBody RevenueRequest request) {
        try {
            Revenue revenue = revenueService.updateRevenue(id, request);
            return ResponseEntity.ok(new ApiResponse(true, "Revenue updated successfully", revenue));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error updating revenue: " + e.getMessage(), null));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> deleteRevenue(@PathVariable Long id) {
        try {
            revenueService.deleteRevenue(id);
            return ResponseEntity.ok(new ApiResponse(true, "Revenue deleted successfully", null));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error deleting revenue: " + e.getMessage(), null));
        }
    }
}
