package com.example.backend.dto;

public class PondRequest {
    private String name;
    private String color;

    // Constructors
    public PondRequest() {
    }

    public PondRequest(String name, String color) {
        this.name = name;
        this.color = color;
    }

    // Getters and Setters
    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }
}
