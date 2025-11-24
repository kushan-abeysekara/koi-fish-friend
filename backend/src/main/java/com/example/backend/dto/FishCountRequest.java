package com.example.backend.dto;

import java.time.LocalDate;

public class FishCountRequest {
    private LocalDate date;
    private Long pondId;
    private Integer count;
    private String notes;
    private String countMethod;
    private String countedBy;

    // Constructors
    public FishCountRequest() {
    }

    public FishCountRequest(LocalDate date, Long pondId, Integer count, String notes) {
        this.date = date;
        this.pondId = pondId;
        this.count = count;
        this.notes = notes;
    }

    public FishCountRequest(LocalDate date, Long pondId, Integer count, String notes, String countMethod,
            String countedBy) {
        this.date = date;
        this.pondId = pondId;
        this.count = count;
        this.notes = notes;
        this.countMethod = countMethod;
        this.countedBy = countedBy;
    }

    // Getters and Setters
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

    public Integer getCount() {
        return count;
    }

    public void setCount(Integer count) {
        this.count = count;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getCountMethod() {
        return countMethod;
    }

    public void setCountMethod(String countMethod) {
        this.countMethod = countMethod;
    }

    public String getCountedBy() {
        return countedBy;
    }

    public void setCountedBy(String countedBy) {
        this.countedBy = countedBy;
    }
}
