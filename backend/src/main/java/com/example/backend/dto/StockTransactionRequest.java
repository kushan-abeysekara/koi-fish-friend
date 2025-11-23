package com.example.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public class StockTransactionRequest {
    private Long itemId;
    private String type; // 'add' or 'use'
    private BigDecimal quantity;
    private LocalDate date;
    private Long pondId;
    private String notes;
    private BigDecimal unitCost;

    // Constructors
    public StockTransactionRequest() {
    }

    public StockTransactionRequest(Long itemId, String type, BigDecimal quantity, LocalDate date,
            Long pondId, String notes, BigDecimal unitCost) {
        this.itemId = itemId;
        this.type = type;
        this.quantity = quantity;
        this.date = date;
        this.pondId = pondId;
        this.notes = notes;
        this.unitCost = unitCost;
    }

    // Getters and Setters
    public Long getItemId() {
        return itemId;
    }

    public void setItemId(Long itemId) {
        this.itemId = itemId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public Long getPondId() {
        return pondId;
    }

    public void setPondId(Long pondId) {
        this.pondId = pondId;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public BigDecimal getUnitCost() {
        return unitCost;
    }

    public void setUnitCost(BigDecimal unitCost) {
        this.unitCost = unitCost;
    }
}
