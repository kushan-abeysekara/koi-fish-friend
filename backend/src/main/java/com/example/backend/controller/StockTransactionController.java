package com.example.backend.controller;

import com.example.backend.dto.ApiResponse;
import com.example.backend.dto.StockTransactionRequest;
import com.example.backend.entity.StockTransaction;
import com.example.backend.service.StockTransactionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/stock-transactions")
@CrossOrigin(origins = "*")
public class StockTransactionController {

    @Autowired
    private StockTransactionService stockTransactionService;

    @GetMapping
    public ResponseEntity<ApiResponse> getAllStockTransactions() {
        try {
            List<StockTransaction> transactions = stockTransactionService.getAllStockTransactions();
            return ResponseEntity.ok(new ApiResponse(true, "Stock transactions retrieved successfully", transactions));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving stock transactions: " + e.getMessage(), null));
        }
    }

    @GetMapping("/item/{itemId}")
    public ResponseEntity<ApiResponse> getStockTransactionsByItem(@PathVariable Long itemId) {
        try {
            List<StockTransaction> transactions = stockTransactionService.getStockTransactionsByItem(itemId);
            return ResponseEntity.ok(new ApiResponse(true, "Stock transactions retrieved successfully", transactions));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving stock transactions: " + e.getMessage(), null));
        }
    }

    @GetMapping("/type/{type}")
    public ResponseEntity<ApiResponse> getStockTransactionsByType(@PathVariable String type) {
        try {
            List<StockTransaction> transactions = stockTransactionService.getStockTransactionsByType(type);
            return ResponseEntity.ok(new ApiResponse(true, "Stock transactions retrieved successfully", transactions));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving stock transactions: " + e.getMessage(), null));
        }
    }

    @GetMapping("/item/{itemId}/date-range")
    public ResponseEntity<ApiResponse> getStockTransactionsByItemAndDateRange(
            @PathVariable Long itemId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        try {
            List<StockTransaction> transactions = stockTransactionService.getStockTransactionsByItemAndDateRange(itemId,
                    startDate, endDate);
            return ResponseEntity.ok(new ApiResponse(true, "Stock transactions retrieved successfully", transactions));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving stock transactions: " + e.getMessage(), null));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse> getStockTransactionById(@PathVariable Long id) {
        try {
            StockTransaction transaction = stockTransactionService.getStockTransactionById(id);
            return ResponseEntity.ok(new ApiResponse(true, "Stock transaction retrieved successfully", transaction));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving stock transaction: " + e.getMessage(), null));
        }
    }

    @PostMapping
    public ResponseEntity<ApiResponse> createStockTransaction(@RequestBody StockTransactionRequest request) {
        try {
            StockTransaction transaction = stockTransactionService.createStockTransaction(request);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new ApiResponse(true, "Stock transaction created successfully", transaction));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error creating stock transaction: " + e.getMessage(), null));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> deleteStockTransaction(@PathVariable Long id) {
        try {
            stockTransactionService.deleteStockTransaction(id);
            return ResponseEntity.ok(new ApiResponse(true, "Stock transaction deleted successfully", null));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error deleting stock transaction: " + e.getMessage(), null));
        }
    }
}
