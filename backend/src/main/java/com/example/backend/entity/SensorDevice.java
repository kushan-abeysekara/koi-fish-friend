package com.example.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "sensor_devices")
public class SensorDevice {

    public enum DeviceType {
        WATER_QUALITY,
        BUDGET_MANAGEMENT,
        FEEDING_MANAGEMENT,
        FISH_ANOMALY_DETECTION
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String deviceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "device_type")
    private DeviceType deviceType;

    @ManyToOne
    @JoinColumn(name = "pond_id")
    private Pond pond;

    private String status; // online, offline, warning, critical

    private String ipAddress;
    private Integer rssi;
    private Double energyWh;

    // Feeding device specific fields
    @Column(name = "hopper_level")
    private Double hopperLevel; // Current hopper weight in grams

    @Column(name = "hopper_capacity")
    private Double hopperCapacity; // Maximum capacity in grams (20000g = 20kg)

    @Column(name = "hopper_percentage")
    private Double hopperPercentage; // Percentage of capacity

    @Column(name = "plate_speed")
    private Double plateSpeed; // NEMA17 stepper motor RPM

    @Column(name = "motor_status")
    private String motorStatus; // "RUNNING" or "STOPPED"

    @Column(name = "feeding_active")
    private Boolean feedingActive; // Whether feeding is in progress

    // Power management fields (for BUDGET_MANAGEMENT devices)
    @Column(name = "relay_state")
    private String relayState; // "ON" or "OFF"

    @Column(name = "control_mode")
    private String controlMode; // "manual", "auto", or "schedule"

    @Column(name = "schedule_count")
    private Integer scheduleCount; // Number of synced schedules

    @Column(name = "last_seen")
    private LocalDateTime lastSeen;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        lastSeen = LocalDateTime.now();
    }

    // Constructors
    public SensorDevice() {
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }

    public DeviceType getDeviceType() {
        return deviceType;
    }

    public void setDeviceType(DeviceType deviceType) {
        this.deviceType = deviceType;
    }

    public Pond getPond() {
        return pond;
    }

    public void setPond(Pond pond) {
        this.pond = pond;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public Integer getRssi() {
        return rssi;
    }

    public void setRssi(Integer rssi) {
        this.rssi = rssi;
    }

    public Double getEnergyWh() {
        return energyWh;
    }

    public void setEnergyWh(Double energyWh) {
        this.energyWh = energyWh;
    }

    public LocalDateTime getLastSeen() {
        return lastSeen;
    }

    public void setLastSeen(LocalDateTime lastSeen) {
        this.lastSeen = lastSeen;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public Double getHopperLevel() {
        return hopperLevel;
    }

    public void setHopperLevel(Double hopperLevel) {
        this.hopperLevel = hopperLevel;
    }

    public Double getHopperCapacity() {
        return hopperCapacity;
    }

    public void setHopperCapacity(Double hopperCapacity) {
        this.hopperCapacity = hopperCapacity;
    }

    public Double getHopperPercentage() {
        return hopperPercentage;
    }

    public void setHopperPercentage(Double hopperPercentage) {
        this.hopperPercentage = hopperPercentage;
    }

    public Double getPlateSpeed() {
        return plateSpeed;
    }

    public void setPlateSpeed(Double plateSpeed) {
        this.plateSpeed = plateSpeed;
    }

    public String getMotorStatus() {
        return motorStatus;
    }

    public void setMotorStatus(String motorStatus) {
        this.motorStatus = motorStatus;
    }

    public Boolean getFeedingActive() {
        return feedingActive;
    }

    public void setFeedingActive(Boolean feedingActive) {
        this.feedingActive = feedingActive;
    }

    public String getRelayState() {
        return relayState;
    }

    public void setRelayState(String relayState) {
        this.relayState = relayState;
    }

    public String getControlMode() {
        return controlMode;
    }

    public void setControlMode(String controlMode) {
        this.controlMode = controlMode;
    }

    public Integer getScheduleCount() {
        return scheduleCount;
    }

    public void setScheduleCount(Integer scheduleCount) {
        this.scheduleCount = scheduleCount;
    }
}
