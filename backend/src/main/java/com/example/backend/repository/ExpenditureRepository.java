package com.example.backend.repository;

import com.example.backend.entity.Expenditure;
import com.example.backend.entity.Pond;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface ExpenditureRepository extends JpaRepository<Expenditure, Long> {
    List<Expenditure> findByPondOrderByDateDesc(Pond pond);

    List<Expenditure> findByPondIdOrderByDateDesc(Long pondId);

    List<Expenditure> findAllByOrderByDateDesc();

    List<Expenditure> findByCategoryOrderByDateDesc(String category);

    @Query("SELECT e FROM Expenditure e WHERE e.pond.id = :pondId AND e.date BETWEEN :startDate AND :endDate ORDER BY e.date DESC")
    List<Expenditure> findByPondAndDateRange(@Param("pondId") Long pondId, @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("SELECT SUM(e.amount) FROM Expenditure e WHERE e.pond.id = :pondId")
    BigDecimal sumAmountByPondId(@Param("pondId") Long pondId);

    @Query("SELECT SUM(e.amount) FROM Expenditure e WHERE e.category = :category")
    BigDecimal sumAmountByCategory(@Param("category") String category);

    @Query("SELECT SUM(e.amount) FROM Expenditure e")
    BigDecimal sumTotalAmount();
}
