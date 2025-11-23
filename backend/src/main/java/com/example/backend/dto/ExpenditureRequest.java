package com.example.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public class ExpenditureRequest {
    private LocalDate date;
    private String category;
    private String subcategory;
    private String description;
    private BigDecimal amount;
    private Long pondId;

    // Constructors
    public ExpenditureRequest() {
    }

    public ExpenditureRequest(LocalDate date, String category, String subcategory, String description,
            BigDecimal amount, Long pondId) {
        this.date = date;
        this.category = category;
        this.subcategory = subcategory;
        this.description = description;
        this.amount = amount;
        this.pondId = pondId;
    }

    // Getters and Setters
    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getSubcategory() {
        return subcategory;
    }

    public void setSubcategory(String subcategory) {
        this.subcategory = subcategory;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public Long getPondId() {
        return pondId;
    }

    public void setPondId(Long pondId) {
        this.pondId = pondId;
    }
}
