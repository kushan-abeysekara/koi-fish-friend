package com.example.backend.repository;

import com.example.backend.entity.FishCount;
import com.example.backend.entity.Pond;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface FishCountRepository extends JpaRepository<FishCount, Long> {
    List<FishCount> findByPondOrderByDateDesc(Pond pond);

    List<FishCount> findByPondIdOrderByDateDesc(Long pondId);

    List<FishCount> findAllByOrderByDateDesc();

    Optional<FishCount> findByPondAndDate(Pond pond, LocalDate date);

    @Query("SELECT fc FROM FishCount fc WHERE fc.pond.id = :pondId AND fc.date BETWEEN :startDate AND :endDate ORDER BY fc.date DESC")
    List<FishCount> findByPondAndDateRange(@Param("pondId") Long pondId, @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}
