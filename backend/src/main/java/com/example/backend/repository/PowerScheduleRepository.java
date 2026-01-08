package com.example.backend.repository;

import com.example.backend.entity.PowerSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PowerScheduleRepository extends JpaRepository<PowerSchedule, Long> {

    List<PowerSchedule> findByDeviceId(String deviceId);

    List<PowerSchedule> findByDeviceIdAndEnabled(String deviceId, Boolean enabled);

    void deleteByDeviceId(String deviceId);
}
