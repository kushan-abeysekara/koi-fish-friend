package com.example.backend.dto;

public class PasswordResetRequest {
    private String username;
    private String newPassword;

    // Constructors
    public PasswordResetRequest() {
    }

    public PasswordResetRequest(String username, String newPassword) {
        this.username = username;
        this.newPassword = newPassword;
    }

    // Getters and Setters
    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getNewPassword() {
        return newPassword;
    }

    public void setNewPassword(String newPassword) {
        this.newPassword = newPassword;
    }
}
