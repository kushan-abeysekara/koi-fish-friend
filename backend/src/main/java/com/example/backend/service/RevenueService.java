package com.example.backend.service;

import com.example.backend.dto.RevenueRequest;
import com.example.backend.entity.FishCount;
import com.example.backend.entity.Pond;
import com.example.backend.entity.Revenue;
import com.example.backend.repository.FishCountRepository;
import com.example.backend.repository.PondRepository;
import com.example.backend.repository.RevenueRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
public class RevenueService {

    @Autowired
    private RevenueRepository revenueRepository;

    @Autowired
    private PondRepository pondRepository;

    @Autowired
    private FishCountRepository fishCountRepository;

    public List<Revenue> getAllRevenues() {
        return revenueRepository.findAllByOrderByDateDesc();
    }

    public List<Revenue> getRevenuesByPond(Long pondId) {
        return revenueRepository.findByPondIdOrderByDateDesc(pondId);
    }

    public List<Revenue> getRevenuesBySource(String source) {
        return revenueRepository.findBySourceOrderByDateDesc(source);
    }

    public List<Revenue> getRevenuesByPondAndDateRange(Long pondId, LocalDate startDate, LocalDate endDate) {
        return revenueRepository.findByPondAndDateRange(pondId, startDate, endDate);
    }

    public BigDecimal getTotalAmount() {
        BigDecimal total = revenueRepository.sumTotalAmount();
        return total != null ? total : BigDecimal.ZERO;
    }

    public BigDecimal getTotalAmountByPond(Long pondId) {
        BigDecimal total = revenueRepository.sumAmountByPondId(pondId);
        return total != null ? total : BigDecimal.ZERO;
    }

    public BigDecimal getTotalAmountBySource(String source) {
        BigDecimal total = revenueRepository.sumAmountBySource(source);
        return total != null ? total : BigDecimal.ZERO;
    }

    public BigDecimal getTotalAmountByDateRange(LocalDate startDate, LocalDate endDate) {
        BigDecimal total = revenueRepository.sumAmountByDateRange(startDate, endDate);
        return total != null ? total : BigDecimal.ZERO;
    }

    public BigDecimal getTotalAmountByPondAndDateRange(Long pondId, LocalDate startDate, LocalDate endDate) {
        BigDecimal total = revenueRepository.sumAmountByPondAndDateRange(pondId, startDate, endDate);
        return total != null ? total : BigDecimal.ZERO;
    }

    public Revenue getRevenueById(Long id) {
        return revenueRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Revenue not found with id: " + id));
    }

    @Transactional
    public Revenue createRevenue(RevenueRequest request) {
        Pond pond = pondRepository.findById(request.getPondId())
                .orElseThrow(() -> new RuntimeException("Pond not found with id: " + request.getPondId()));

        Revenue revenue = new Revenue();
        revenue.setDate(request.getDate());
        revenue.setPond(pond);
        revenue.setSource(request.getSource());
        revenue.setAmount(request.getAmount());
        revenue.setQuantitySold(request.getQuantitySold());
        revenue.setPricePerUnit(request.getPricePerUnit());
        revenue.setFishSpecies(request.getFishSpecies());
        revenue.setCustomerName(request.getCustomerName());
        revenue.setNotes(request.getNotes());
        revenue.setPaymentMethod(request.getPaymentMethod());
        revenue.setPaymentStatus(request.getPaymentStatus());

        Revenue savedRevenue = revenueRepository.save(revenue);

        // If this is a fish sale, update the fish count
        if ("Fish Sales".equals(request.getSource()) && request.getQuantitySold() != null
                && request.getQuantitySold() > 0) {
            updateFishCountAfterSale(pond, request.getDate(), request.getQuantitySold(), request.getFishSpecies());
        }

        return savedRevenue;
    }

    @Transactional
    public Revenue updateRevenue(Long id, RevenueRequest request) {
        Revenue revenue = getRevenueById(id);
        Pond pond = pondRepository.findById(request.getPondId())
                .orElseThrow(() -> new RuntimeException("Pond not found with id: " + request.getPondId()));

        revenue.setDate(request.getDate());
        revenue.setPond(pond);
        revenue.setSource(request.getSource());
        revenue.setAmount(request.getAmount());
        revenue.setQuantitySold(request.getQuantitySold());
        revenue.setPricePerUnit(request.getPricePerUnit());
        revenue.setFishSpecies(request.getFishSpecies());
        revenue.setCustomerName(request.getCustomerName());
        revenue.setNotes(request.getNotes());
        revenue.setPaymentMethod(request.getPaymentMethod());
        revenue.setPaymentStatus(request.getPaymentStatus());

        return revenueRepository.save(revenue);
    }

    @Transactional
    public void deleteRevenue(Long id) {
        if (!revenueRepository.existsById(id)) {
            throw new RuntimeException("Revenue not found with id: " + id);
        }
        revenueRepository.deleteById(id);
    }

    private void updateFishCountAfterSale(Pond pond, LocalDate saleDate, Integer quantitySold, String fishSpecies) {
        // Get the latest fish count for this pond before the sale date
        List<FishCount> recentCounts = fishCountRepository.findByPondIdOrderByDateDesc(pond.getId());

        int currentCount = 0;
        if (!recentCounts.isEmpty()) {
            // Find the most recent count on or before the sale date
            for (FishCount fc : recentCounts) {
                if (!fc.getDate().isAfter(saleDate)) {
                    currentCount = fc.getCount();
                    break;
                }
            }
            // If all counts are after the sale date, use the oldest count
            if (currentCount == 0 && !recentCounts.isEmpty()) {
                currentCount = recentCounts.get(recentCounts.size() - 1).getCount();
            }
        }

        // Calculate new count after sale
        int newCount = Math.max(0, currentCount - quantitySold);

        // Create new fish count entry
        FishCount newFishCount = new FishCount();
        newFishCount.setDate(saleDate);
        newFishCount.setPond(pond);
        newFishCount.setCount(newCount);
        newFishCount.setCountMethod("auto-sale");
        newFishCount.setNotes("Automatic count update after selling " + quantitySold +
                (fishSpecies != null ? " " + fishSpecies : "") + " fish");

        fishCountRepository.save(newFishCount);
    }
}
