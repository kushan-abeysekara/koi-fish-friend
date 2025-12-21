package com.example.backend.repository;

import com.example.backend.entity.Pond;
import com.example.backend.entity.Revenue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface RevenueRepository extends JpaRepository<Revenue, Long> {
    List<Revenue> findByPondOrderByDateDesc(Pond pond);

    List<Revenue> findByPondIdOrderByDateDesc(Long pondId);

    List<Revenue> findAllByOrderByDateDesc();

    List<Revenue> findBySourceOrderByDateDesc(String source);

    @Query("SELECT r FROM Revenue r WHERE r.pond.id = :pondId AND r.date BETWEEN :startDate AND :endDate ORDER BY r.date DESC")
    List<Revenue> findByPondAndDateRange(@Param("pondId") Long pondId, @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("SELECT SUM(r.amount) FROM Revenue r WHERE r.pond.id = :pondId")
    BigDecimal sumAmountByPondId(@Param("pondId") Long pondId);

    @Query("SELECT SUM(r.amount) FROM Revenue r WHERE r.source = :source")
    BigDecimal sumAmountBySource(@Param("source") String source);

    @Query("SELECT SUM(r.amount) FROM Revenue r")
    BigDecimal sumTotalAmount();

    @Query("SELECT SUM(r.amount) FROM Revenue r WHERE r.pond.id = :pondId AND r.date BETWEEN :startDate AND :endDate")
    BigDecimal sumAmountByPondAndDateRange(@Param("pondId") Long pondId, @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("SELECT SUM(r.amount) FROM Revenue r WHERE r.date BETWEEN :startDate AND :endDate")
    BigDecimal sumAmountByDateRange(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);
}
