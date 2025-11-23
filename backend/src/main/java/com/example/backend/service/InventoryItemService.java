package com.example.backend.service;

import com.example.backend.dto.InventoryItemRequest;
import com.example.backend.entity.InventoryItem;
import com.example.backend.repository.InventoryItemRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@Transactional
public class InventoryItemService {

    @Autowired
    private InventoryItemRepository inventoryItemRepository;

    public List<InventoryItem> getAllInventoryItems() {
        return inventoryItemRepository.findAllByOrderByNameAsc();
    }

    public List<InventoryItem> getInventoryItemsByCategory(String category) {
        return inventoryItemRepository.findByCategory(category);
    }

    public List<InventoryItem> getLowStockItems() {
        return inventoryItemRepository.findLowStockItems();
    }

    public InventoryItem getInventoryItemById(Long id) {
        return inventoryItemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Inventory item not found with id: " + id));
    }

    public InventoryItem createInventoryItem(InventoryItemRequest request) {
        InventoryItem item = new InventoryItem(
                request.getName(),
                request.getCategory(),
                request.getCurrentStock(),
                request.getUnit(),
                request.getReorderLevel(),
                request.getCostPerUnit(),
                request.getLastRestocked(),
                request.getSupplier());

        return inventoryItemRepository.save(item);
    }

    public InventoryItem updateInventoryItem(Long id, InventoryItemRequest request) {
        InventoryItem item = getInventoryItemById(id);

        item.setName(request.getName());
        item.setCategory(request.getCategory());
        item.setCurrentStock(request.getCurrentStock());
        item.setUnit(request.getUnit());
        item.setReorderLevel(request.getReorderLevel());
        item.setCostPerUnit(request.getCostPerUnit());
        item.setLastRestocked(request.getLastRestocked());
        item.setSupplier(request.getSupplier());

        return inventoryItemRepository.save(item);
    }

    public void deleteInventoryItem(Long id) {
        InventoryItem item = getInventoryItemById(id);
        inventoryItemRepository.delete(item);
    }

    public BigDecimal getTotalInventoryValue() {
        List<InventoryItem> items = inventoryItemRepository.findAll();
        return items.stream()
                .map(item -> item.getCurrentStock().multiply(item.getCostPerUnit()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
