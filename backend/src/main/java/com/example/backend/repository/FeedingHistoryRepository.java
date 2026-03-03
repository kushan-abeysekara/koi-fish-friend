package com.example.backend.repository;

import com.example.backend.entity.FeedingHistory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface FeedingHistoryRepository extends JpaRepository<FeedingHistory, Long> {

    /**
     * Fetch recent history rows for a device, ordered chronologically.
     */
    List<FeedingHistory> findByDeviceIdAndRecordedAtAfterOrderByRecordedAtAsc(
            String deviceId, LocalDateTime since);

    /**
     * Fetch only feeding events (start/stop transitions) for a device.
     */
    @Query("SELECT f FROM FeedingHistory f WHERE f.deviceId = ?1 " +
           "AND f.status IN ('feeding_started', 'feeding_stopped') " +
           "AND f.recordedAt > ?2 ORDER BY f.recordedAt ASC")
    List<FeedingHistory> findEventsByDeviceId(String deviceId, LocalDateTime since);

    /**
     * Fetch latest N rows (for dashboard quick-load).
     */
    List<FeedingHistory> findByDeviceIdOrderByRecordedAtDesc(String deviceId, Pageable pageable);

    /**
     * Count rows for a device in a time window (for stats).
     */
    long countByDeviceIdAndRecordedAtAfter(String deviceId, LocalDateTime since);

    /**
     * Delete old data (housekeeping).
     */
    void deleteByRecordedAtBefore(LocalDateTime cutoff);
}
