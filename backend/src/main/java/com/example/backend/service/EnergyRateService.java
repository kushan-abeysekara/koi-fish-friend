package com.example.backend.service;

import com.example.backend.entity.AppSetting;
import com.example.backend.repository.AppSettingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class EnergyRateService {

    private static final String ENERGY_RATE_KEY = "energy.daily.rate-lkr-per-kwh";

    @Autowired
    private AppSettingRepository appSettingRepository;

    @Value("${energy.daily.rate-lkr-per-kwh:25}")
    private BigDecimal defaultRate;

    public BigDecimal getCurrentRate() {
        return appSettingRepository.findBySettingKey(ENERGY_RATE_KEY)
                .map(AppSetting::getSettingValue)
                .map(this::parseRate)
                .orElse(defaultRate);
    }

    @Transactional
    public BigDecimal setCurrentRate(BigDecimal rate) {
        if (rate == null || rate.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Rate must be a non-negative number");
        }

        BigDecimal normalized = rate.setScale(2, RoundingMode.HALF_UP);

        AppSetting setting = appSettingRepository.findBySettingKey(ENERGY_RATE_KEY)
                .orElseGet(() -> new AppSetting(ENERGY_RATE_KEY, normalized.toPlainString()));
        setting.setSettingValue(normalized.toPlainString());
        appSettingRepository.save(setting);

        return normalized;
    }

    private BigDecimal parseRate(String raw) {
        try {
            return new BigDecimal(raw).setScale(2, RoundingMode.HALF_UP);
        } catch (Exception ignored) {
            return defaultRate;
        }
    }
}
