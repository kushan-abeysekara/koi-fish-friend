package com.example.backend.dto;

public class UpdateCredentialsRequest {
    private String currentUsername;
    private String newUsername;
    private String newPassword;
    
    // Constructors
    public UpdateCredentialsRequest() {
    }
    
    public UpdateCredentialsRequest(String currentUsername, String newUsername, String newPassword) {
        this.currentUsername = currentUsername;
        this.newUsername = newUsername;
        this.newPassword = newPassword;
    }
    
    // Getters and Setters
    public String getCurrentUsername() {
        return currentUsername;
    }
    
    public void setCurrentUsername(String currentUsername) {
        this.currentUsername = currentUsername;
    }
    
    public String getNewUsername() {
        return newUsername;
    }
    
    public void setNewUsername(String newUsername) {
        this.newUsername = newUsername;
    }
    
    public String getNewPassword() {
        return newPassword;
    }
    
    public void setNewPassword(String newPassword) {
        this.newPassword = newPassword;
    }
}
