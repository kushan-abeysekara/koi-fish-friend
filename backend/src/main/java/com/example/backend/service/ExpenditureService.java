package com.example.backend.service;

import com.example.backend.dto.ExpenditureRequest;
import com.example.backend.entity.Expenditure;
import com.example.backend.entity.Pond;
import com.example.backend.repository.ExpenditureRepository;
import com.example.backend.repository.PondRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
@Transactional
public class ExpenditureService {

    @Autowired
    private ExpenditureRepository expenditureRepository;

    @Autowired
    private PondRepository pondRepository;

    public List<Expenditure> getAllExpenditures() {
        return expenditureRepository.findAllByOrderByDateDesc();
    }

    public List<Expenditure> getExpendituresByPond(Long pondId) {
        return expenditureRepository.findByPondIdOrderByDateDesc(pondId);
    }

    public List<Expenditure> getExpendituresByCategory(String category) {
        return expenditureRepository.findByCategoryOrderByDateDesc(category);
    }

    public List<Expenditure> getExpendituresByPondAndDateRange(Long pondId, LocalDate startDate, LocalDate endDate) {
        return expenditureRepository.findByPondAndDateRange(pondId, startDate, endDate);
    }

    public Expenditure getExpenditureById(Long id) {
        return expenditureRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Expenditure not found with id: " + id));
    }

    public Expenditure createExpenditure(ExpenditureRequest request) {
        Pond pond = pondRepository.findById(request.getPondId())
                .orElseThrow(() -> new RuntimeException("Pond not found with id: " + request.getPondId()));

        Expenditure expenditure = new Expenditure(
                request.getDate(),
                request.getCategory(),
                request.getSubcategory(),
                request.getDescription(),
                request.getAmount(),
                pond);

        return expenditureRepository.save(expenditure);
    }

    public Expenditure updateExpenditure(Long id, ExpenditureRequest request) {
        Expenditure expenditure = getExpenditureById(id);

        Pond pond = pondRepository.findById(request.getPondId())
                .orElseThrow(() -> new RuntimeException("Pond not found with id: " + request.getPondId()));

        expenditure.setDate(request.getDate());
        expenditure.setCategory(request.getCategory());
        expenditure.setSubcategory(request.getSubcategory());
        expenditure.setDescription(request.getDescription());
        expenditure.setAmount(request.getAmount());
        expenditure.setPond(pond);

        return expenditureRepository.save(expenditure);
    }

    public void deleteExpenditure(Long id) {
        Expenditure expenditure = getExpenditureById(id);
        expenditureRepository.delete(expenditure);
    }

    public BigDecimal getTotalAmountByPond(Long pondId) {
        BigDecimal total = expenditureRepository.sumAmountByPondId(pondId);
        return total != null ? total : BigDecimal.ZERO;
    }

    public BigDecimal getTotalAmountByCategory(String category) {
        BigDecimal total = expenditureRepository.sumAmountByCategory(category);
        return total != null ? total : BigDecimal.ZERO;
    }

    public BigDecimal getTotalAmount() {
        BigDecimal total = expenditureRepository.sumTotalAmount();
        return total != null ? total : BigDecimal.ZERO;
    }
}
