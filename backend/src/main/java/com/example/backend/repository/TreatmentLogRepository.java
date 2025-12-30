package com.example.backend.repository;

import com.example.backend.entity.TreatmentLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TreatmentLogRepository extends JpaRepository<TreatmentLog, Long> {
    
    // Find all logs for a specific pond
    List<TreatmentLog> findByPondIdOrderByTimestampDesc(Long pondId);
    
    // Find logs by pond and treatment type
    List<TreatmentLog> findByPondIdAndTreatmentTypeOrderByTimestampDesc(Long pondId, String treatmentType);
    
    // Find logs by pond and parameter
    List<TreatmentLog> findByPondIdAndParameterOrderByTimestampDesc(Long pondId, String parameter);
    
    // Find logs within a date range for a pond
    List<TreatmentLog> findByPondIdAndTimestampBetweenOrderByTimestampDesc(Long pondId, LocalDateTime start, LocalDateTime end);
    
    // Find logs by status
    List<TreatmentLog> findByPondIdAndStatusOrderByTimestampDesc(Long pondId, String status);
    
    // Get recent logs (last N days)
    @Query("SELECT t FROM TreatmentLog t WHERE t.pond.id = ?1 AND t.timestamp >= ?2 ORDER BY t.timestamp DESC")
    List<TreatmentLog> findRecentLogs(Long pondId, LocalDateTime since);
    
    // Count logs this week
    @Query("SELECT COUNT(t) FROM TreatmentLog t WHERE t.pond.id = ?1 AND t.timestamp >= ?2")
    Long countLogsThisWeek(Long pondId, LocalDateTime weekStart);
}
