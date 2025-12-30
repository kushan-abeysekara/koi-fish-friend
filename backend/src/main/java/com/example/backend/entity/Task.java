package com.example.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "tasks")
public class Task {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, length = 200)
    private String title;
    
    @Column(length = 2000)
    private String description;
    
    @Column(nullable = false, length = 20)
    private String priority; // high, medium, low
    
    @Column(nullable = false, length = 20)
    private String status; // pending, in-progress, completed, snoozed
    
    @Column(nullable = false, length = 50)
    private String type; // calibration, maintenance, cleaning, inspection, treatment
    
    @Column(nullable = false)
    private LocalDateTime dueDate;
    
    @Column(nullable = false)
    private LocalDateTime createdDate;
    
    @Column
    private LocalDateTime completedDate;
    
    @Column
    private LocalDateTime snoozeUntil;
    
    @Column(length = 5000)
    private String notes; // Store as JSON array string
    
    @Column(length = 100)
    private String linkedParameter;
    
    @Column(nullable = false)
    private Boolean autoCloseEnabled = false;
    
    @Column(length = 100)
    private String assignedTo;
    
    @ManyToOne
    @JoinColumn(name = "pond_id")
    private Pond pond;
    
    // Constructors
    public Task() {
        this.createdDate = LocalDateTime.now();
        this.status = "pending";
        this.priority = "medium";
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getTitle() {
        return title;
    }
    
    public void setTitle(String title) {
        this.title = title;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
    public String getPriority() {
        return priority;
    }
    
    public void setPriority(String priority) {
        this.priority = priority;
    }
    
    public String getStatus() {
        return status;
    }
    
    public void setStatus(String status) {
        this.status = status;
    }
    
    public String getType() {
        return type;
    }
    
    public void setType(String type) {
        this.type = type;
    }
    
    public LocalDateTime getDueDate() {
        return dueDate;
    }
    
    public void setDueDate(LocalDateTime dueDate) {
        this.dueDate = dueDate;
    }
    
    public LocalDateTime getCreatedDate() {
        return createdDate;
    }
    
    public void setCreatedDate(LocalDateTime createdDate) {
        this.createdDate = createdDate;
    }
    
    public LocalDateTime getCompletedDate() {
        return completedDate;
    }
    
    public void setCompletedDate(LocalDateTime completedDate) {
        this.completedDate = completedDate;
    }
    
    public LocalDateTime getSnoozeUntil() {
        return snoozeUntil;
    }
    
    public void setSnoozeUntil(LocalDateTime snoozeUntil) {
        this.snoozeUntil = snoozeUntil;
    }
    
    public String getNotes() {
        return notes;
    }
    
    public void setNotes(String notes) {
        this.notes = notes;
    }
    
    public String getLinkedParameter() {
        return linkedParameter;
    }
    
    public void setLinkedParameter(String linkedParameter) {
        this.linkedParameter = linkedParameter;
    }
    
    public Boolean getAutoCloseEnabled() {
        return autoCloseEnabled;
    }
    
    public void setAutoCloseEnabled(Boolean autoCloseEnabled) {
        this.autoCloseEnabled = autoCloseEnabled;
    }
    
    public String getAssignedTo() {
        return assignedTo;
    }
    
    public void setAssignedTo(String assignedTo) {
        this.assignedTo = assignedTo;
    }
    
    public Pond getPond() {
        return pond;
    }
    
    public void setPond(Pond pond) {
        this.pond = pond;
    }
}
