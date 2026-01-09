package com.example.backend.dto;

public class WebSocketDataRequest {
    private String deviceId;
    private Long pondId;
    private Double phValue;
    private Double turbidity;
    private Double co2Level;
    private Double ammonia;
    private String waterQualityStatus;

    // Constructors
    public WebSocketDataRequest() {
    }

    public WebSocketDataRequest(String deviceId, Long pondId, Double phValue, Double turbidity, 
                                Double co2Level, Double ammonia, String waterQualityStatus) {
        this.deviceId = deviceId;
        this.pondId = pondId;
        this.phValue = phValue;
        this.turbidity = turbidity;
        this.co2Level = co2Level;
        this.ammonia = ammonia;
        this.waterQualityStatus = waterQualityStatus;
    }

    // Getters and Setters
    public String getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }

    public Long getPondId() {
        return pondId;
    }

    public void setPondId(Long pondId) {
        this.pondId = pondId;
    }

    public Double getPhValue() {
        return phValue;
    }

    public void setPhValue(Double phValue) {
        this.phValue = phValue;
    }

    public Double getTurbidity() {
        return turbidity;
    }

    public void setTurbidity(Double turbidity) {
        this.turbidity = turbidity;
    }

    public Double getCo2Level() {
        return co2Level;
    }

    public void setCo2Level(Double co2Level) {
        this.co2Level = co2Level;
    }

    public Double getAmmonia() {
        return ammonia;
    }

    public void setAmmonia(Double ammonia) {
        this.ammonia = ammonia;
    }

    public String getWaterQualityStatus() {
        return waterQualityStatus;
    }

    public void setWaterQualityStatus(String waterQualityStatus) {
        this.waterQualityStatus = waterQualityStatus;
    }
}
