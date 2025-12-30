package com.example.backend.repository;

import com.example.backend.entity.InventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {
    Optional<InventoryItem> findByName(String name);

    List<InventoryItem> findByCategory(String category);

    @Query("SELECT i FROM InventoryItem i WHERE i.currentStock <= i.reorderLevel ORDER BY i.name")
    List<InventoryItem> findLowStockItems();

    List<InventoryItem> findAllByOrderByNameAsc();
}
