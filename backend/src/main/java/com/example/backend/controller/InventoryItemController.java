package com.example.backend.controller;

import com.example.backend.dto.ApiResponse;
import com.example.backend.dto.InventoryItemRequest;
import com.example.backend.entity.InventoryItem;
import com.example.backend.service.InventoryItemService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inventory")
@CrossOrigin(origins = "*")
public class InventoryItemController {

    @Autowired
    private InventoryItemService inventoryItemService;

    @GetMapping
    public ResponseEntity<ApiResponse> getAllInventoryItems() {
        try {
            List<InventoryItem> items = inventoryItemService.getAllInventoryItems();
            return ResponseEntity.ok(new ApiResponse(true, "Inventory items retrieved successfully", items));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving inventory items: " + e.getMessage(), null));
        }
    }

    @GetMapping("/category/{category}")
    public ResponseEntity<ApiResponse> getInventoryItemsByCategory(@PathVariable String category) {
        try {
            List<InventoryItem> items = inventoryItemService.getInventoryItemsByCategory(category);
            return ResponseEntity.ok(new ApiResponse(true, "Inventory items retrieved successfully", items));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving inventory items: " + e.getMessage(), null));
        }
    }

    @GetMapping("/low-stock")
    public ResponseEntity<ApiResponse> getLowStockItems() {
        try {
            List<InventoryItem> items = inventoryItemService.getLowStockItems();
            return ResponseEntity.ok(new ApiResponse(true, "Low stock items retrieved successfully", items));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving low stock items: " + e.getMessage(), null));
        }
    }

    @GetMapping("/total-value")
    public ResponseEntity<ApiResponse> getTotalInventoryValue() {
        try {
            BigDecimal totalValue = inventoryItemService.getTotalInventoryValue();
            Map<String, BigDecimal> result = new HashMap<>();
            result.put("totalValue", totalValue);
            return ResponseEntity.ok(new ApiResponse(true, "Total inventory value retrieved successfully", result));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving total inventory value: " + e.getMessage(), null));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse> getInventoryItemById(@PathVariable Long id) {
        try {
            InventoryItem item = inventoryItemService.getInventoryItemById(id);
            return ResponseEntity.ok(new ApiResponse(true, "Inventory item retrieved successfully", item));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving inventory item: " + e.getMessage(), null));
        }
    }

    @PostMapping
    public ResponseEntity<ApiResponse> createInventoryItem(@RequestBody InventoryItemRequest request) {
        try {
            InventoryItem item = inventoryItemService.createInventoryItem(request);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new ApiResponse(true, "Inventory item created successfully", item));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error creating inventory item: " + e.getMessage(), null));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse> updateInventoryItem(@PathVariable Long id,
            @RequestBody InventoryItemRequest request) {
        try {
            InventoryItem item = inventoryItemService.updateInventoryItem(id, request);
            return ResponseEntity.ok(new ApiResponse(true, "Inventory item updated successfully", item));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error updating inventory item: " + e.getMessage(), null));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> deleteInventoryItem(@PathVariable Long id) {
        try {
            inventoryItemService.deleteInventoryItem(id);
            return ResponseEntity.ok(new ApiResponse(true, "Inventory item deleted successfully", null));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error deleting inventory item: " + e.getMessage(), null));
        }
    }
}
