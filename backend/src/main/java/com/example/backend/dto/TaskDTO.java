package com.example.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

public class TaskDTO {
    private Long id;
    private String title;
    private String description;
    private String priority;
    private String status;
    private String type;
    private LocalDateTime dueDate;
    private LocalDateTime createdDate;
    private LocalDateTime completedDate;
    private LocalDateTime snoozeUntil;
    private List<String> notes;
    private String linkedParameter;
    private Boolean autoCloseEnabled;
    private String assignedTo;
    private Long pondId;
    
    // Constructors
    public TaskDTO() {}
    
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
    
    public List<String> getNotes() {
        return notes;
    }
    
    public void setNotes(List<String> notes) {
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
    
    public Long getPondId() {
        return pondId;
    }
    
    public void setPondId(Long pondId) {
        this.pondId = pondId;
    }
}
