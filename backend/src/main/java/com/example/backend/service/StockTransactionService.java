package com.example.backend.service;

import com.example.backend.dto.ExpenditureRequest;
import com.example.backend.dto.StockTransactionRequest;
import com.example.backend.entity.InventoryItem;
import com.example.backend.entity.Pond;
import com.example.backend.entity.StockTransaction;
import com.example.backend.repository.InventoryItemRepository;
import com.example.backend.repository.PondRepository;
import com.example.backend.repository.StockTransactionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
@Transactional
public class StockTransactionService {

    @Autowired
    private StockTransactionRepository stockTransactionRepository;

    @Autowired
    private InventoryItemRepository inventoryItemRepository;

    @Autowired
    private PondRepository pondRepository;

    @Autowired
    private ExpenditureService expenditureService;

    public List<StockTransaction> getAllStockTransactions() {
        return stockTransactionRepository.findAllByOrderByDateDesc();
    }

    public List<StockTransaction> getStockTransactionsByItem(Long itemId) {
        return stockTransactionRepository.findByItemIdOrderByDateDesc(itemId);
    }

    public List<StockTransaction> getStockTransactionsByType(String type) {
        return stockTransactionRepository.findByTypeOrderByDateDesc(type);
    }

    public List<StockTransaction> getStockTransactionsByItemAndDateRange(Long itemId, LocalDate startDate,
            LocalDate endDate) {
        return stockTransactionRepository.findByItemAndDateRange(itemId, startDate, endDate);
    }

    public StockTransaction getStockTransactionById(Long id) {
        return stockTransactionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Stock transaction not found with id: " + id));
    }

    public StockTransaction createStockTransaction(StockTransactionRequest request) {
        InventoryItem item = inventoryItemRepository.findById(request.getItemId())
                .orElseThrow(() -> new RuntimeException("Inventory item not found with id: " + request.getItemId()));

        Pond pond = null;
        if (request.getPondId() != null) {
            pond = pondRepository.findById(request.getPondId())
                    .orElseThrow(() -> new RuntimeException("Pond not found with id: " + request.getPondId()));
        }

        // Validate stock availability for 'use' transactions
        if ("use".equals(request.getType())) {
            if (item.getCurrentStock().compareTo(request.getQuantity()) < 0) {
                throw new RuntimeException(
                        "Insufficient stock. Available: " + item.getCurrentStock() + " " + item.getUnit());
            }
            if (pond == null) {
                throw new RuntimeException("Pond is required for stock usage transactions");
            }
        }

        // Determine unit cost
        BigDecimal unitCost = request.getUnitCost() != null ? request.getUnitCost() : item.getCostPerUnit();

        // Create transaction
        StockTransaction transaction = new StockTransaction(
                item,
                request.getType(),
                request.getQuantity(),
                request.getDate(),
                pond,
                request.getNotes(),
                unitCost);

        StockTransaction savedTransaction = stockTransactionRepository.save(transaction);

        // Update inventory stock
        if ("add".equals(request.getType())) {
            item.setCurrentStock(item.getCurrentStock().add(request.getQuantity()));
            item.setLastRestocked(request.getDate());
            item.setCostPerUnit(unitCost);

            // Create expenditure for stock addition (purchase)
            if (pond != null) {
                BigDecimal totalCost = request.getQuantity().multiply(unitCost);
                ExpenditureRequest expenditureRequest = new ExpenditureRequest(
                        request.getDate(),
                        "Inventory Purchases",
                        item.getCategory() + ": " + item.getName(),
                        "Purchased " + request.getQuantity() + " " + item.getUnit() +
                                " at LKR " + unitCost + " per " + item.getUnit() +
                                (request.getNotes() != null && !request.getNotes().isEmpty()
                                        ? " - " + request.getNotes()
                                        : ""),
                        totalCost,
                        pond.getId());
                expenditureService.createExpenditure(expenditureRequest);
            }
        } else if ("use".equals(request.getType())) {
            item.setCurrentStock(item.getCurrentStock().subtract(request.getQuantity()));
        }

        inventoryItemRepository.save(item);

        return savedTransaction;
    }

    public void deleteStockTransaction(Long id) {
        StockTransaction transaction = getStockTransactionById(id);

        // Reverse the stock change
        InventoryItem item = transaction.getItem();
        if ("add".equals(transaction.getType())) {
            item.setCurrentStock(item.getCurrentStock().subtract(transaction.getQuantity()));
        } else if ("use".equals(transaction.getType())) {
            item.setCurrentStock(item.getCurrentStock().add(transaction.getQuantity()));
        }
        inventoryItemRepository.save(item);

        stockTransactionRepository.delete(transaction);
    }
}
