package com.example.backend.service;

import com.example.backend.dto.FishCountRequest;
import com.example.backend.entity.FishCount;
import com.example.backend.entity.Pond;
import com.example.backend.repository.FishCountRepository;
import com.example.backend.repository.PondRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@Transactional
public class FishCountService {

    @Autowired
    private FishCountRepository fishCountRepository;

    @Autowired
    private PondRepository pondRepository;

    public List<FishCount> getAllFishCounts() {
        return fishCountRepository.findAllByOrderByDateDesc();
    }

    public List<FishCount> getFishCountsByPond(Long pondId) {
        return fishCountRepository.findByPondIdOrderByDateDesc(pondId);
    }

    public List<FishCount> getFishCountsByPondAndDateRange(Long pondId, LocalDate startDate, LocalDate endDate) {
        return fishCountRepository.findByPondAndDateRange(pondId, startDate, endDate);
    }

    public FishCount getFishCountById(Long id) {
        return fishCountRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Fish count not found with id: " + id));
    }

    public FishCount createFishCount(FishCountRequest request) {
        Pond pond = pondRepository.findById(request.getPondId())
                .orElseThrow(() -> new RuntimeException("Pond not found with id: " + request.getPondId()));

        FishCount fishCount = new FishCount(
                request.getDate(),
                pond,
                request.getCount(),
                request.getNotes(),
                request.getCountMethod() != null ? request.getCountMethod() : "manual",
                request.getCountedBy());

        return fishCountRepository.save(fishCount);
    }

    public FishCount updateFishCount(Long id, FishCountRequest request) {
        FishCount fishCount = getFishCountById(id);

        Pond pond = pondRepository.findById(request.getPondId())
                .orElseThrow(() -> new RuntimeException("Pond not found with id: " + request.getPondId()));

        fishCount.setDate(request.getDate());
        fishCount.setPond(pond);
        fishCount.setCount(request.getCount());
        fishCount.setNotes(request.getNotes());
        if (request.getCountMethod() != null) {
            fishCount.setCountMethod(request.getCountMethod());
        }
        if (request.getCountedBy() != null) {
            fishCount.setCountedBy(request.getCountedBy());
        }

        return fishCountRepository.save(fishCount);
    }

    public void deleteFishCount(Long id) {
        FishCount fishCount = getFishCountById(id);
        fishCountRepository.delete(fishCount);
    }
}
