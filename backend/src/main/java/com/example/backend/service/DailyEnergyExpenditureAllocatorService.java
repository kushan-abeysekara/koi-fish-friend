package com.example.backend.service;

import com.example.backend.entity.Expenditure;
import com.example.backend.entity.Pond;
import com.example.backend.repository.ExpenditureRepository;
import com.example.backend.repository.PondRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class DailyEnergyExpenditureAllocatorService {

    private static final String CATEGORY = "Utilities";
    private static final String SUBCATEGORY = "Electricity";
    private static final String DESCRIPTION_PREFIX = "Auto daily energy allocation";

    @Autowired
    private SupabaseService supabaseService;

    @Autowired
    private PondRepository pondRepository;

    @Autowired
    private ExpenditureRepository expenditureRepository;

    @Autowired
    private EnergyRateService energyRateService;

    /**
     * Runs shortly after midnight and allocates yesterday's total energy cost
     * equally across all non-closed ponds.
     */
    @Scheduled(cron = "${energy.daily-allocation.cron:0 5 0 * * *}")
    public void allocateYesterdayEnergyCost() {
        LocalDate targetDate = LocalDate.now().minusDays(1);

        LocalDateTime endOfTargetDay = targetDate.plusDays(1).atStartOfDay().minusNanos(1);
        List<Pond> activePonds = pondRepository
                .findByStatusIgnoreCaseNotAndCreatedAtLessThanEqual("CLOSED", endOfTargetDay);
        if (activePonds.isEmpty()) {
            System.out.println("[EnergyAllocator] Skipped " + targetDate + " - no active ponds");
            return;
        }

        double totalKwh = supabaseService.getDailyEnergyKwh(targetDate);
        if (totalKwh <= 0) {
            System.out.println("[EnergyAllocator] Skipped " + targetDate + " - no daily energy usage");
            return;
        }

        BigDecimal rateLkrPerKwh = energyRateService.getCurrentRate();
        BigDecimal totalCost = BigDecimal.valueOf(totalKwh)
                .multiply(rateLkrPerKwh)
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal perPondCost = totalCost
                .divide(BigDecimal.valueOf(activePonds.size()), 2, RoundingMode.HALF_UP);

        String description = DESCRIPTION_PREFIX + " for " + targetDate +
                " | total kWh=" + BigDecimal.valueOf(totalKwh).setScale(3, RoundingMode.HALF_UP) +
                " | rate=" + rateLkrPerKwh + " LKR/kWh | split=" + activePonds.size() + " ponds";

        int created = 0;
        for (Pond pond : activePonds) {
            boolean exists = expenditureRepository.existsByDateAndCategoryAndSubcategoryAndPondId(
                    targetDate,
                    CATEGORY,
                    SUBCATEGORY,
                    pond.getId());

            if (exists) {
                continue;
            }

            Expenditure expenditure = new Expenditure(
                    targetDate,
                    CATEGORY,
                    SUBCATEGORY,
                    description,
                    perPondCost,
                    pond);
            expenditureRepository.save(expenditure);
            created++;
        }

        System.out.println("[EnergyAllocator] " + targetDate +
                " | totalKwh=" + BigDecimal.valueOf(totalKwh).setScale(3, RoundingMode.HALF_UP) +
                " | totalCost=" + totalCost +
                " | perPond=" + perPondCost +
                " | ponds=" + activePonds.size() +
                " | created=" + created);
    }
}
