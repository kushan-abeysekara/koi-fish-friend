package com.example.backend.service;

import com.example.backend.dto.InventoryItemRequest;
import com.example.backend.dto.StockBatch;
import com.example.backend.entity.InventoryItem;
import com.example.backend.entity.StockTransaction;
import com.example.backend.repository.InventoryItemRepository;
import com.example.backend.repository.StockTransactionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional
public class InventoryItemService {

    @Autowired
    private InventoryItemRepository inventoryItemRepository;

    @Autowired
    private StockTransactionRepository stockTransactionRepository;

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

        InventoryItem savedItem = inventoryItemRepository.save(item);

        // Create initial stock transaction if there's initial stock
        if (request.getCurrentStock() != null && request.getCurrentStock().compareTo(BigDecimal.ZERO) > 0) {
            StockTransaction initialTransaction = new StockTransaction(
                    savedItem,
                    "add",
                    request.getCurrentStock(),
                    request.getLastRestocked(),
                    null, // No pond for initial stock
                    "Initial stock",
                    request.getCostPerUnit());
            stockTransactionRepository.save(initialTransaction);
        }

        return savedItem;
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

        // Check if there are stock transactions
        List<StockTransaction> transactions = stockTransactionRepository.findByItemIdOrderByDateDesc(id);
        if (!transactions.isEmpty()) {
            throw new RuntimeException("Cannot delete inventory item '" + item.getName() +
                    "' because it has " + transactions.size() + " stock transaction(s). " +
                    "Please delete the stock transactions first.");
        }

        inventoryItemRepository.delete(item);
    }

    public BigDecimal getTotalInventoryValue() {
        List<InventoryItem> items = inventoryItemRepository.findAll();
        return items.stream()
                .map(item -> item.getCurrentStock().multiply(item.getCostPerUnit()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Get stock batches for an item using FIFO (First-In-First-Out) method
     * Returns list of batches with their unit cost and available quantity
     */
    public List<StockBatch> getStockBatchesByItemId(Long itemId) {
        // Get the inventory item
        InventoryItem item = getInventoryItemById(itemId);

        // Get all transactions for this item, ordered by date (oldest first)
        List<StockTransaction> transactions = stockTransactionRepository.findByItemIdOrderByDateDesc(itemId);

        // Reverse to get oldest first (FIFO)
        List<StockTransaction> chronological = new ArrayList<>(transactions);
        java.util.Collections.reverse(chronological);

        // We'll track batches with both cost AND original add date/index to maintain
        // FIFO order
        // Key: "cost_timestamp" to keep batches with same cost separate if added at
        // different times
        List<StockBatch> batches = new ArrayList<>();

        // Calculate if there's initial stock (stock before any transactions)
        BigDecimal calculatedStock = BigDecimal.ZERO;
        for (StockTransaction t : chronological) {
            if ("add".equals(t.getType())) {
                calculatedStock = calculatedStock.add(t.getQuantity());
            } else if ("use".equals(t.getType())) {
                calculatedStock = calculatedStock.subtract(t.getQuantity());
            }
        }

        // If current stock is more than calculated, there was initial stock
        BigDecimal initialStock = item.getCurrentStock().subtract(calculatedStock);
        if (initialStock.compareTo(BigDecimal.ZERO) > 0) {
            // Add initial stock as first batch
            batches.add(new StockBatch(item.getCostPerUnit(), initialStock));
        }

        // Process all transactions in chronological order
        for (StockTransaction transaction : chronological) {
            if ("add".equals(transaction.getType())) {
                // Add new batch
                batches.add(new StockBatch(transaction.getUnitCost(), transaction.getQuantity()));

            } else if ("use".equals(transaction.getType())) {
                // Deduct from oldest batches first (FIFO)
                BigDecimal remainingToUse = transaction.getQuantity();

                int i = 0;
                while (i < batches.size() && remainingToUse.compareTo(BigDecimal.ZERO) > 0) {
                    StockBatch batch = batches.get(i);

                    if (batch.getQuantity().compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal toDeduct = remainingToUse.min(batch.getQuantity());
                        batch.setQuantity(batch.getQuantity().subtract(toDeduct));
                        remainingToUse = remainingToUse.subtract(toDeduct);

                        // Remove batch if depleted
                        if (batch.getQuantity().compareTo(BigDecimal.ZERO) == 0) {
                            batches.remove(i);
                            // Don't increment i, as we removed an element
                        } else {
                            i++;
                        }
                    } else {
                        i++;
                    }
                }
            }
        }

        // Return only non-empty batches
        return batches.stream()
                .filter(b -> b.getQuantity().compareTo(BigDecimal.ZERO) > 0)
                .collect(java.util.stream.Collectors.toList());
    }
}
