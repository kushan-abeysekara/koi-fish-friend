package com.example.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Stores every feeding device MQTT status message for historical analysis.
 * Table is auto-created by Hibernate (ddl-auto=update) — no manual SQL needed.
 */
@Entity
@Table(name = "feeding_history", indexes = {
    @Index(name = "idx_fh_device_recorded", columnList = "device_id, recorded_at"),
    @Index(name = "idx_fh_status", columnList = "status")
})
public class FeedingHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "device_id", nullable = false, length = 64)
    private String deviceId;

    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt;

    @Column(length = 32)
    private String status; // "online", "feeding_started", "feeding_stopped"

    @Column(name = "feeding_active")
    private Boolean feedingActive;

    @Column(name = "hopper_level")
    private Double hopperLevel;

    @Column(name = "hopper_capacity")
    private Double hopperCapacity;

    @Column(name = "hopper_percentage")
    private Double hopperPercentage;

    @Column(name = "current_weight")
    private Double currentWeight;

    @Column(name = "target_weight")
    private Double targetWeight;

    @Column(name = "feed_count")
    private Integer feedCount;

    @Column(name = "total_grams_fed")
    private Double totalGramsFed;

    @Column(name = "motor_status", length = 16)
    private String motorStatus;

    @Column(name = "plate_speed")
    private Double plateSpeed;

    @Column(name = "esc_percent")
    private Double escPercent;

    private Integer rssi;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "uptime_ms")
    private Long uptimeMs;

    @PrePersist
    protected void onCreate() {
        if (recordedAt == null) {
            recordedAt = LocalDateTime.now();
        }
    }

    // Constructors
    public FeedingHistory() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }

    public LocalDateTime getRecordedAt() { return recordedAt; }
    public void setRecordedAt(LocalDateTime recordedAt) { this.recordedAt = recordedAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Boolean getFeedingActive() { return feedingActive; }
    public void setFeedingActive(Boolean feedingActive) { this.feedingActive = feedingActive; }

    public Double getHopperLevel() { return hopperLevel; }
    public void setHopperLevel(Double hopperLevel) { this.hopperLevel = hopperLevel; }

    public Double getHopperCapacity() { return hopperCapacity; }
    public void setHopperCapacity(Double hopperCapacity) { this.hopperCapacity = hopperCapacity; }

    public Double getHopperPercentage() { return hopperPercentage; }
    public void setHopperPercentage(Double hopperPercentage) { this.hopperPercentage = hopperPercentage; }

    public Double getCurrentWeight() { return currentWeight; }
    public void setCurrentWeight(Double currentWeight) { this.currentWeight = currentWeight; }

    public Double getTargetWeight() { return targetWeight; }
    public void setTargetWeight(Double targetWeight) { this.targetWeight = targetWeight; }

    public Integer getFeedCount() { return feedCount; }
    public void setFeedCount(Integer feedCount) { this.feedCount = feedCount; }

    public Double getTotalGramsFed() { return totalGramsFed; }
    public void setTotalGramsFed(Double totalGramsFed) { this.totalGramsFed = totalGramsFed; }

    public String getMotorStatus() { return motorStatus; }
    public void setMotorStatus(String motorStatus) { this.motorStatus = motorStatus; }

    public Double getPlateSpeed() { return plateSpeed; }
    public void setPlateSpeed(Double plateSpeed) { this.plateSpeed = plateSpeed; }

    public Double getEscPercent() { return escPercent; }
    public void setEscPercent(Double escPercent) { this.escPercent = escPercent; }

    public Integer getRssi() { return rssi; }
    public void setRssi(Integer rssi) { this.rssi = rssi; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public Long getUptimeMs() { return uptimeMs; }
    public void setUptimeMs(Long uptimeMs) { this.uptimeMs = uptimeMs; }
}
