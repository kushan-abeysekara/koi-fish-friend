package com.example.backend.service;

import com.example.backend.dto.ProfitLossReport;
import com.example.backend.entity.Expenditure;
import com.example.backend.entity.Pond;
import com.example.backend.entity.Revenue;
import com.example.backend.repository.ExpenditureRepository;
import com.example.backend.repository.PondRepository;
import com.example.backend.repository.RevenueRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ProfitLossService {

    @Autowired
    private RevenueRepository revenueRepository;

    @Autowired
    private ExpenditureRepository expenditureRepository;

    @Autowired
    private PondRepository pondRepository;

    public ProfitLossReport generateProfitLossReport(Long pondId, LocalDate startDate, LocalDate endDate) {
        Pond pond = pondRepository.findById(pondId)
                .orElseThrow(() -> new RuntimeException("Pond not found with id: " + pondId));

        ProfitLossReport report = new ProfitLossReport();
        report.setPondId(pondId);
        report.setPondName(pond.getName());
        report.setStartDate(startDate);
        report.setEndDate(endDate);

        // Calculate period days
        int periodDays = (int) ChronoUnit.DAYS.between(startDate, endDate) + 1;
        report.setRoiPeriodDays(periodDays);

        // Get all revenues and expenditures for the period
        List<Revenue> revenues = revenueRepository.findByPondAndDateRange(pondId, startDate, endDate);
        List<Expenditure> expenditures = expenditureRepository.findByPondAndDateRange(pondId, startDate, endDate);

        // Calculate total revenue and breakdown by source
        BigDecimal totalRevenue = BigDecimal.ZERO;
        Map<String, BigDecimal> revenueBySource = new HashMap<>();
        for (Revenue revenue : revenues) {
            totalRevenue = totalRevenue.add(revenue.getAmount());
            revenueBySource.merge(revenue.getSource(), revenue.getAmount(), BigDecimal::add);
        }
        report.setTotalRevenue(totalRevenue);
        report.setRevenueBySource(revenueBySource);

        // Calculate total expenses and breakdown by category
        BigDecimal totalExpenses = BigDecimal.ZERO;
        Map<String, BigDecimal> expensesByCategory = new HashMap<>();
        BigDecimal directCosts = BigDecimal.ZERO; // Feed + Fish Stocking
        BigDecimal infrastructureCosts = BigDecimal.ZERO;

        for (Expenditure expenditure : expenditures) {
            totalExpenses = totalExpenses.add(expenditure.getAmount());
            expensesByCategory.merge(expenditure.getCategory(), expenditure.getAmount(), BigDecimal::add);

            // Calculate direct costs (for gross profit)
            if ("Fish Stocking".equals(expenditure.getCategory()) ||
                    ("Inventory Purchases".equals(expenditure.getCategory()) &&
                            expenditure.getSubcategory().contains("Feed"))) {
                directCosts = directCosts.add(expenditure.getAmount());
            }

            // Calculate infrastructure investment (for ROI)
            if ("Infrastructure".equals(expenditure.getCategory()) ||
                    ("Inventory Purchases".equals(expenditure.getCategory()) &&
                            expenditure.getSubcategory().contains("Equipment"))) {
                infrastructureCosts = infrastructureCosts.add(expenditure.getAmount());
            }
        }
        report.setTotalExpenses(totalExpenses);
        report.setExpensesByCategory(expensesByCategory);

        // Calculate gross profit (Revenue - Direct Costs)
        BigDecimal grossProfit = totalRevenue.subtract(directCosts);
        report.setGrossProfit(grossProfit);

        // Calculate net profit (Revenue - Total Expenses)
        BigDecimal netProfit = totalRevenue.subtract(totalExpenses);
        report.setNetProfit(netProfit);

        // Calculate profit margin (Net Profit / Revenue) * 100
        BigDecimal profitMargin = BigDecimal.ZERO;
        if (totalRevenue.compareTo(BigDecimal.ZERO) > 0) {
            profitMargin = netProfit.divide(totalRevenue, 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"))
                    .setScale(2, RoundingMode.HALF_UP);
        }
        report.setProfitMargin(profitMargin);

        // Calculate ROI (Net Profit / Total Investment) * 100
        report.setTotalInvestment(infrastructureCosts);
        BigDecimal roi = BigDecimal.ZERO;
        if (infrastructureCosts.compareTo(BigDecimal.ZERO) > 0) {
            roi = netProfit.divide(infrastructureCosts, 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"))
                    .setScale(2, RoundingMode.HALF_UP);
        }
        report.setRoi(roi);

        // Break-even analysis
        report.setBreakEvenRevenue(totalExpenses);
        BigDecimal remainingToBreakEven = totalExpenses.subtract(totalRevenue);
        report.setRemainingToBreakEven(remainingToBreakEven.max(BigDecimal.ZERO));
        report.setBreakEven(netProfit.compareTo(BigDecimal.ZERO) >= 0);

        // Calculate averages
        if (periodDays > 0) {
            BigDecimal avgRevenuePerDay = totalRevenue.divide(new BigDecimal(periodDays), 2, RoundingMode.HALF_UP);
            BigDecimal avgExpensePerDay = totalExpenses.divide(new BigDecimal(periodDays), 2, RoundingMode.HALF_UP);
            report.setAverageRevenuePerDay(avgRevenuePerDay);
            report.setAverageExpensePerDay(avgExpensePerDay);
        }

        // Total transactions
        report.setTotalTransactions(revenues.size() + expenditures.size());

        return report;
    }

    public ProfitLossReport generateOverallProfitLossReport(LocalDate startDate, LocalDate endDate) {
        ProfitLossReport report = new ProfitLossReport();
        report.setPondName("All Ponds");
        report.setStartDate(startDate);
        report.setEndDate(endDate);

        // Calculate period days
        int periodDays = (int) ChronoUnit.DAYS.between(startDate, endDate) + 1;
        report.setRoiPeriodDays(periodDays);

        // Get all revenues and expenditures for the period
        List<Revenue> revenues = revenueRepository.findAllByOrderByDateDesc();
        revenues = revenues.stream()
                .filter(r -> !r.getDate().isBefore(startDate) && !r.getDate().isAfter(endDate))
                .toList();

        List<Expenditure> expenditures = expenditureRepository.findAllByOrderByDateDesc();
        expenditures = expenditures.stream()
                .filter(e -> !e.getDate().isBefore(startDate) && !e.getDate().isAfter(endDate))
                .toList();

        // Calculate metrics (same as pond-specific report)
        BigDecimal totalRevenue = revenues.stream()
                .map(Revenue::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        report.setTotalRevenue(totalRevenue);

        Map<String, BigDecimal> revenueBySource = new HashMap<>();
        revenues.forEach(r -> revenueBySource.merge(r.getSource(), r.getAmount(), BigDecimal::add));
        report.setRevenueBySource(revenueBySource);

        BigDecimal totalExpenses = expenditures.stream()
                .map(Expenditure::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        report.setTotalExpenses(totalExpenses);

        Map<String, BigDecimal> expensesByCategory = new HashMap<>();
        BigDecimal directCosts = BigDecimal.ZERO;
        BigDecimal infrastructureCosts = BigDecimal.ZERO;

        for (Expenditure expenditure : expenditures) {
            expensesByCategory.merge(expenditure.getCategory(), expenditure.getAmount(), BigDecimal::add);
            if ("Fish Stocking".equals(expenditure.getCategory()) ||
                    ("Inventory Purchases".equals(expenditure.getCategory()) &&
                            expenditure.getSubcategory().contains("Feed"))) {
                directCosts = directCosts.add(expenditure.getAmount());
            }
            if ("Infrastructure".equals(expenditure.getCategory()) ||
                    ("Inventory Purchases".equals(expenditure.getCategory()) &&
                            expenditure.getSubcategory().contains("Equipment"))) {
                infrastructureCosts = infrastructureCosts.add(expenditure.getAmount());
            }
        }
        report.setExpensesByCategory(expensesByCategory);

        report.setGrossProfit(totalRevenue.subtract(directCosts));
        BigDecimal netProfit = totalRevenue.subtract(totalExpenses);
        report.setNetProfit(netProfit);

        if (totalRevenue.compareTo(BigDecimal.ZERO) > 0) {
            report.setProfitMargin(netProfit.divide(totalRevenue, 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"))
                    .setScale(2, RoundingMode.HALF_UP));
        } else {
            report.setProfitMargin(BigDecimal.ZERO);
        }

        report.setTotalInvestment(infrastructureCosts);
        if (infrastructureCosts.compareTo(BigDecimal.ZERO) > 0) {
            report.setRoi(netProfit.divide(infrastructureCosts, 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"))
                    .setScale(2, RoundingMode.HALF_UP));
        } else {
            report.setRoi(BigDecimal.ZERO);
        }

        report.setBreakEvenRevenue(totalExpenses);
        report.setRemainingToBreakEven(totalExpenses.subtract(totalRevenue).max(BigDecimal.ZERO));
        report.setBreakEven(netProfit.compareTo(BigDecimal.ZERO) >= 0);

        if (periodDays > 0) {
            report.setAverageRevenuePerDay(totalRevenue.divide(new BigDecimal(periodDays), 2, RoundingMode.HALF_UP));
            report.setAverageExpensePerDay(totalExpenses.divide(new BigDecimal(periodDays), 2, RoundingMode.HALF_UP));
        }

        report.setTotalTransactions(revenues.size() + expenditures.size());

        return report;
    }
}
