package com.example.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "treatment_logs")
public class TreatmentLog {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne
    @JoinColumn(name = "pond_id", nullable = false)
    private Pond pond;
    
    @Column(nullable = false)
    private LocalDateTime timestamp;
    
    @Column(nullable = false, length = 100)
    private String treatmentType;
    
    @Column(nullable = false)
    private Double dosage;
    
    @Column(nullable = false, length = 20)
    private String unit;
    
    @Column(nullable = false, length = 500)
    private String reason;
    
    @Column(length = 2000)
    private String notes;
    
    @Column(nullable = false, length = 100)
    private String recordedBy;
    
    // Optional parameter tracking
    @Column(length = 50)
    private String parameter;
    
    @Column
    private Double targetValue;
    
    @Column
    private Double beforeValue;
    
    @Column
    private Double afterValue;
    
    @Column(length = 500)
    private String photoUrl;
    
    @Column(nullable = false, length = 20)
    private String status = "logged"; // logged, verified, flagged, completed
    
    @Column(nullable = false)
    private LocalDateTime createdAt;
    
    @Column
    private LocalDateTime verifiedAt;
    
    @Column(length = 100)
    private String verifiedBy;
    
    @Column
    private LocalDateTime completedAt;
    
    @Column(length = 100)
    private String completedBy;
    
    // Constructors
    public TreatmentLog() {
        this.createdAt = LocalDateTime.now();
        this.timestamp = LocalDateTime.now();
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public Pond getPond() {
        return pond;
    }
    
    public void setPond(Pond pond) {
        this.pond = pond;
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
    
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
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
