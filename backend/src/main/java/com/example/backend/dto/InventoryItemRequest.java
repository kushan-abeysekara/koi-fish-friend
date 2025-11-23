package com.example.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public class InventoryItemRequest {
    private String name;
    private String category;
    private BigDecimal currentStock;
    private String unit;
    private BigDecimal reorderLevel;
    private BigDecimal costPerUnit;
    private LocalDate lastRestocked;
    private String supplier;

    // Constructors
    public InventoryItemRequest() {
    }

    public InventoryItemRequest(String name, String category, BigDecimal currentStock, String unit,
            BigDecimal reorderLevel, BigDecimal costPerUnit, LocalDate lastRestocked, String supplier) {
        this.name = name;
        this.category = category;
        this.currentStock = currentStock;
        this.unit = unit;
        this.reorderLevel = reorderLevel;
        this.costPerUnit = costPerUnit;
        this.lastRestocked = lastRestocked;
        this.supplier = supplier;
    }

    // Getters and Setters
    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public BigDecimal getCurrentStock() {
        return currentStock;
    }

    public void setCurrentStock(BigDecimal currentStock) {
        this.currentStock = currentStock;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public BigDecimal getReorderLevel() {
        return reorderLevel;
    }

    public void setReorderLevel(BigDecimal reorderLevel) {
        this.reorderLevel = reorderLevel;
    }

    public BigDecimal getCostPerUnit() {
        return costPerUnit;
    }

    public void setCostPerUnit(BigDecimal costPerUnit) {
        this.costPerUnit = costPerUnit;
    }

    public LocalDate getLastRestocked() {
        return lastRestocked;
    }

    public void setLastRestocked(LocalDate lastRestocked) {
        this.lastRestocked = lastRestocked;
    }

    public String getSupplier() {
        return supplier;
    }

    public void setSupplier(String supplier) {
        this.supplier = supplier;
    }
}
