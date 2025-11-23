package com.example.backend.repository;

import com.example.backend.entity.InventoryItem;
import com.example.backend.entity.StockTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface StockTransactionRepository extends JpaRepository<StockTransaction, Long> {
    List<StockTransaction> findByItemOrderByDateDesc(InventoryItem item);

    List<StockTransaction> findByItemIdOrderByDateDesc(Long itemId);

    List<StockTransaction> findAllByOrderByDateDesc();

    List<StockTransaction> findByTypeOrderByDateDesc(String type);

    @Query("SELECT st FROM StockTransaction st WHERE st.item.id = :itemId AND st.date BETWEEN :startDate AND :endDate ORDER BY st.date DESC")
    List<StockTransaction> findByItemAndDateRange(@Param("itemId") Long itemId, @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}
