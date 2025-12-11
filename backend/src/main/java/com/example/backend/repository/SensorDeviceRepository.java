package com.example.backend.repository;

import com.example.backend.entity.SensorDevice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.List;

@Repository
public interface SensorDeviceRepository extends JpaRepository<SensorDevice, Long> {
    Optional<SensorDevice> findByDeviceId(String deviceId);

    List<SensorDevice> findByPondId(Long pondId);

    List<SensorDevice> findByStatus(String status);

    Optional<SensorDevice> findByPond_Id(Long pondId);

    // Find online device for a pond
    Optional<SensorDevice> findByPondIdAndStatus(Long pondId, String status);
}
