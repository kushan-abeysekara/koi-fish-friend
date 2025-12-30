package com.example.backend.controller;

import com.example.backend.dto.ApiResponse;
import com.example.backend.dto.ExpenditureRequest;
import com.example.backend.entity.Expenditure;
import com.example.backend.service.ExpenditureService;
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
@RequestMapping("/api/expenditures")
@CrossOrigin(origins = "*")
public class ExpenditureController {

    @Autowired
    private ExpenditureService expenditureService;

    @GetMapping
    public ResponseEntity<ApiResponse> getAllExpenditures() {
        try {
            List<Expenditure> expenditures = expenditureService.getAllExpenditures();
            return ResponseEntity.ok(new ApiResponse(true, "Expenditures retrieved successfully", expenditures));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving expenditures: " + e.getMessage(), null));
        }
    }

    @GetMapping("/pond/{pondId}")
    public ResponseEntity<ApiResponse> getExpendituresByPond(@PathVariable Long pondId) {
        try {
            List<Expenditure> expenditures = expenditureService.getExpendituresByPond(pondId);
            return ResponseEntity.ok(new ApiResponse(true, "Expenditures retrieved successfully", expenditures));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving expenditures: " + e.getMessage(), null));
        }
    }

    @GetMapping("/category/{category}")
    public ResponseEntity<ApiResponse> getExpendituresByCategory(@PathVariable String category) {
        try {
            List<Expenditure> expenditures = expenditureService.getExpendituresByCategory(category);
            return ResponseEntity.ok(new ApiResponse(true, "Expenditures retrieved successfully", expenditures));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving expenditures: " + e.getMessage(), null));
        }
    }

    @GetMapping("/pond/{pondId}/date-range")
    public ResponseEntity<ApiResponse> getExpendituresByPondAndDateRange(
            @PathVariable Long pondId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        try {
            List<Expenditure> expenditures = expenditureService.getExpendituresByPondAndDateRange(pondId, startDate,
                    endDate);
            return ResponseEntity.ok(new ApiResponse(true, "Expenditures retrieved successfully", expenditures));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving expenditures: " + e.getMessage(), null));
        }
    }

    @GetMapping("/totals")
    public ResponseEntity<ApiResponse> getTotals() {
        try {
            Map<String, BigDecimal> totals = new HashMap<>();
            totals.put("totalAmount", expenditureService.getTotalAmount());
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
            totals.put("totalAmount", expenditureService.getTotalAmountByPond(pondId));
            return ResponseEntity.ok(new ApiResponse(true, "Pond total retrieved successfully", totals));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving pond total: " + e.getMessage(), null));
        }
    }

    @GetMapping("/totals/category/{category}")
    public ResponseEntity<ApiResponse> getTotalByCategory(@PathVariable String category) {
        try {
            Map<String, BigDecimal> totals = new HashMap<>();
            totals.put("totalAmount", expenditureService.getTotalAmountByCategory(category));
            return ResponseEntity.ok(new ApiResponse(true, "Category total retrieved successfully", totals));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving category total: " + e.getMessage(), null));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse> getExpenditureById(@PathVariable Long id) {
        try {
            Expenditure expenditure = expenditureService.getExpenditureById(id);
            return ResponseEntity.ok(new ApiResponse(true, "Expenditure retrieved successfully", expenditure));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving expenditure: " + e.getMessage(), null));
        }
    }

    @PostMapping
    public ResponseEntity<ApiResponse> createExpenditure(@RequestBody ExpenditureRequest request) {
        try {
            Expenditure expenditure = expenditureService.createExpenditure(request);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new ApiResponse(true, "Expenditure created successfully", expenditure));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error creating expenditure: " + e.getMessage(), null));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse> updateExpenditure(@PathVariable Long id,
            @RequestBody ExpenditureRequest request) {
        try {
            Expenditure expenditure = expenditureService.updateExpenditure(id, request);
            return ResponseEntity.ok(new ApiResponse(true, "Expenditure updated successfully", expenditure));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error updating expenditure: " + e.getMessage(), null));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> deleteExpenditure(@PathVariable Long id) {
        try {
            expenditureService.deleteExpenditure(id);
            return ResponseEntity.ok(new ApiResponse(true, "Expenditure deleted successfully", null));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error deleting expenditure: " + e.getMessage(), null));
        }
    }
}
