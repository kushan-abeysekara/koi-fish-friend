package com.example.backend.repository;

import com.example.backend.entity.SensorData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SensorDataRepository extends JpaRepository<SensorData, Long> {
    List<SensorData> findByDeviceIdOrderByTimestampDesc(Long deviceId);

    List<SensorData> findByPondIdOrderByTimestampDesc(Long pondId);

    @Query("SELECT s FROM SensorData s WHERE s.pond.id = ?1 AND s.timestamp >= ?2 ORDER BY s.timestamp DESC")
    List<SensorData> findByPondIdAndTimestampAfter(Long pondId, LocalDateTime after);

    @Query("SELECT s FROM SensorData s WHERE s.device.id = ?1 ORDER BY s.timestamp DESC LIMIT 1")
    SensorData findLatestByDevice(Long deviceId);

    @Query("SELECT s FROM SensorData s WHERE s.pond.id = ?1 ORDER BY s.timestamp DESC LIMIT 1")
    SensorData findLatestByPond(Long pondId);
}
