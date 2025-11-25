package com.example.backend.dto;

import java.math.BigDecimal;

public class StockBatch {
    private BigDecimal unitCost;
    private BigDecimal quantity;

    public StockBatch() {
    }

    public StockBatch(BigDecimal unitCost, BigDecimal quantity) {
        this.unitCost = unitCost;
        this.quantity = quantity;
    }

    public BigDecimal getUnitCost() {
        return unitCost;
    }

    public void setUnitCost(BigDecimal unitCost) {
        this.unitCost = unitCost;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }
}
