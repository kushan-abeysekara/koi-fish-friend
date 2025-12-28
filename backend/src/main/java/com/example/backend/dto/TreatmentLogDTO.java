package com.example.backend.dto;

import java.time.LocalDateTime;

public class TreatmentLogDTO {
    private Long id;
    private Long pondId;
    private LocalDateTime timestamp;
    private String treatmentType;
    private Double dosage;
    private String unit;
    private String reason;
    private String notes;
    private String recordedBy;
    private String parameter;
    private Double targetValue;
    private Double beforeValue;
    private Double afterValue;
    private String photoUrl;
    private String status;
    private LocalDateTime verifiedAt;
    private String verifiedBy;
    private LocalDateTime completedAt;
    private String completedBy;
    
    // Constructors
    public TreatmentLogDTO() {}
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public Long getPondId() {
        return pondId;
    }
    
    public void setPondId(Long pondId) {
        this.pondId = pondId;
    }
    
    public LocalDateTime getTimestamp() {
        return timestamp;
    }
    
    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
    
    public String getTreatmentType() {
        return treatmentType;
    }
    
    public void setTreatmentType(String treatmentType) {
        this.treatmentType = treatmentType;
    }
    
    public Double getDosage() {
        return dosage;
    }
    
    public void setDosage(Double dosage) {
        this.dosage = dosage;
    }
    
    public String getUnit() {
        return unit;
    }
    
    public void setUnit(String unit) {
        this.unit = unit;
    }
    
    public String getReason() {
        return reason;
    }
    
    public void setReason(String reason) {
        this.reason = reason;
    }
    
    public String getNotes() {
        return notes;
    }
    
    public void setNotes(String notes) {
        this.notes = notes;
    }
    
    public String getRecordedBy() {
        return recordedBy;
    }
    
    public void setRecordedBy(String recordedBy) {
        this.recordedBy = recordedBy;
    }
    
    public String getParameter() {
        return parameter;
    }
    
    public void setParameter(String parameter) {
        this.parameter = parameter;
    }
    
    public Double getTargetValue() {
        return targetValue;
    }
    
    public void setTargetValue(Double targetValue) {
        this.targetValue = targetValue;
    }
    
    public Double getBeforeValue() {
        return beforeValue;
    }
    
    public void setBeforeValue(Double beforeValue) {
        this.beforeValue = beforeValue;
    }
    
    public Double getAfterValue() {
        return afterValue;
    }
    
    public void setAfterValue(Double afterValue) {
        this.afterValue = afterValue;
    }
    
    public String getPhotoUrl() {
        return photoUrl;
    }
    
    public void setPhotoUrl(String photoUrl) {
        this.photoUrl = photoUrl;
    }
    
    public String getStatus() {
        return status;
    }
    
    public void setStatus(String status) {
        this.status = status;
    }
    
    public LocalDateTime getVerifiedAt() {
        return verifiedAt;
    }
    
    public void setVerifiedAt(LocalDateTime verifiedAt) {
        this.verifiedAt = verifiedAt;
    }
    
    public String getVerifiedBy() {
        return verifiedBy;
    }
    
    public void setVerifiedBy(String verifiedBy) {
        this.verifiedBy = verifiedBy;
    }
    
    public LocalDateTime getCompletedAt() {
        return completedAt;
    }
    
    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }
    
    public String getCompletedBy() {
        return completedBy;
    }
    
    public void setCompletedBy(String completedBy) {
        this.completedBy = completedBy;
    }
}
