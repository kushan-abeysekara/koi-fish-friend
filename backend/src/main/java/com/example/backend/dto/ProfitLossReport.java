package com.example.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

public class ProfitLossReport {
    private Long pondId;
    private String pondName;
    private LocalDate startDate;
    private LocalDate endDate;

    // Revenue breakdown
    private BigDecimal totalRevenue;
    private Map<String, BigDecimal> revenueBySource;

    // Expenditure breakdown
    private BigDecimal totalExpenses;
    private Map<String, BigDecimal> expensesByCategory;

    // Profit metrics
    private BigDecimal grossProfit; // Revenue - Direct Costs (Feed, Fish Stocking)
    private BigDecimal netProfit; // Revenue - Total Expenses
    private BigDecimal profitMargin; // (Net Profit / Revenue) * 100

    // ROI metrics
    private BigDecimal totalInvestment; // Infrastructure + Equipment costs
    private BigDecimal roi; // (Net Profit / Total Investment) * 100
    private Integer roiPeriodDays; // Days taken to calculate ROI

    // Break-even analysis
    private BigDecimal breakEvenRevenue; // Total expenses that need to be covered
    private BigDecimal remainingToBreakEven; // Amount needed to break even
    private boolean isBreakEven; // true if net profit >= 0

    // Additional metrics
    private BigDecimal averageRevenuePerDay;
    private BigDecimal averageExpensePerDay;
    private Integer totalTransactions;

    // Constructors
    public ProfitLossReport() {
    }

    // Getters and Setters
    public Long getPondId() {
        return pondId;
    }

    public void setPondId(Long pondId) {
        this.pondId = pondId;
    }

    public String getPondName() {
        return pondName;
    }

    public void setPondName(String pondName) {
        this.pondName = pondName;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public BigDecimal getTotalRevenue() {
        return totalRevenue;
    }

    public void setTotalRevenue(BigDecimal totalRevenue) {
        this.totalRevenue = totalRevenue;
    }

    public Map<String, BigDecimal> getRevenueBySource() {
        return revenueBySource;
    }

    public void setRevenueBySource(Map<String, BigDecimal> revenueBySource) {
        this.revenueBySource = revenueBySource;
    }

    public BigDecimal getTotalExpenses() {
        return totalExpenses;
    }

    public void setTotalExpenses(BigDecimal totalExpenses) {
        this.totalExpenses = totalExpenses;
    }

    public Map<String, BigDecimal> getExpensesByCategory() {
        return expensesByCategory;
    }

    public void setExpensesByCategory(Map<String, BigDecimal> expensesByCategory) {
        this.expensesByCategory = expensesByCategory;
    }

    public BigDecimal getGrossProfit() {
        return grossProfit;
    }

    public void setGrossProfit(BigDecimal grossProfit) {
        this.grossProfit = grossProfit;
    }

    public BigDecimal getNetProfit() {
        return netProfit;
    }

    public void setNetProfit(BigDecimal netProfit) {
        this.netProfit = netProfit;
    }

    public BigDecimal getProfitMargin() {
        return profitMargin;
    }

    public void setProfitMargin(BigDecimal profitMargin) {
        this.profitMargin = profitMargin;
    }

    public BigDecimal getTotalInvestment() {
        return totalInvestment;
    }

    public void setTotalInvestment(BigDecimal totalInvestment) {
        this.totalInvestment = totalInvestment;
    }

    public BigDecimal getRoi() {
        return roi;
    }

    public void setRoi(BigDecimal roi) {
        this.roi = roi;
    }

    public Integer getRoiPeriodDays() {
        return roiPeriodDays;
    }

    public void setRoiPeriodDays(Integer roiPeriodDays) {
        this.roiPeriodDays = roiPeriodDays;
    }

    public BigDecimal getBreakEvenRevenue() {
        return breakEvenRevenue;
    }

    public void setBreakEvenRevenue(BigDecimal breakEvenRevenue) {
        this.breakEvenRevenue = breakEvenRevenue;
    }

    public BigDecimal getRemainingToBreakEven() {
        return remainingToBreakEven;
    }

    public void setRemainingToBreakEven(BigDecimal remainingToBreakEven) {
        this.remainingToBreakEven = remainingToBreakEven;
    }

    public boolean isBreakEven() {
        return isBreakEven;
    }

    public void setBreakEven(boolean breakEven) {
        isBreakEven = breakEven;
    }

    public BigDecimal getAverageRevenuePerDay() {
        return averageRevenuePerDay;
    }

    public void setAverageRevenuePerDay(BigDecimal averageRevenuePerDay) {
        this.averageRevenuePerDay = averageRevenuePerDay;
    }

    public BigDecimal getAverageExpensePerDay() {
        return averageExpensePerDay;
    }

    public void setAverageExpensePerDay(BigDecimal averageExpensePerDay) {
        this.averageExpensePerDay = averageExpensePerDay;
    }

    public Integer getTotalTransactions() {
        return totalTransactions;
    }

    public void setTotalTransactions(Integer totalTransactions) {
        this.totalTransactions = totalTransactions;
    }
}
