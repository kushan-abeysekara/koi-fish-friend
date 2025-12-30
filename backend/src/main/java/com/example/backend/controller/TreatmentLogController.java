package com.example.backend.controller;

import com.example.backend.dto.TreatmentLogDTO;
import com.example.backend.entity.Pond;
import com.example.backend.entity.TreatmentLog;
import com.example.backend.repository.TreatmentLogRepository;
import com.example.backend.repository.PondRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/treatment-logs")
@CrossOrigin(origins = "*")
public class TreatmentLogController {
    
    @Autowired
    private TreatmentLogRepository treatmentLogRepository;
    
    @Autowired
    private PondRepository pondRepository;
    
    // Get all treatment logs for a pond
    @GetMapping("/pond/{pondId}")
    public ResponseEntity<Map<String, Object>> getLogsByPond(@PathVariable Long pondId) {
        try {
            List<TreatmentLog> logs = treatmentLogRepository.findByPondIdOrderByTimestampDesc(pondId);
            List<TreatmentLogDTO> dtos = logs.stream().map(this::convertToDTO).collect(Collectors.toList());
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", dtos);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Error fetching treatment logs: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // Get logs filtered by treatment type
    @GetMapping("/pond/{pondId}/type/{treatmentType}")
    public ResponseEntity<Map<String, Object>> getLogsByType(
            @PathVariable Long pondId, 
            @PathVariable String treatmentType) {
        try {
            List<TreatmentLog> logs = treatmentLogRepository.findByPondIdAndTreatmentTypeOrderByTimestampDesc(pondId, treatmentType);
            List<TreatmentLogDTO> dtos = logs.stream().map(this::convertToDTO).collect(Collectors.toList());
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", dtos);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Error fetching logs: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // Get logs filtered by parameter
    @GetMapping("/pond/{pondId}/parameter/{parameter}")
    public ResponseEntity<Map<String, Object>> getLogsByParameter(
            @PathVariable Long pondId, 
            @PathVariable String parameter) {
        try {
            List<TreatmentLog> logs = treatmentLogRepository.findByPondIdAndParameterOrderByTimestampDesc(pondId, parameter);
            List<TreatmentLogDTO> dtos = logs.stream().map(this::convertToDTO).collect(Collectors.toList());
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", dtos);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Error fetching logs: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // Create new treatment log
    @PostMapping
    public ResponseEntity<Map<String, Object>> createLog(@RequestBody TreatmentLogDTO dto) {
        try {
            // Validate pond exists
            Optional<Pond> pondOpt = pondRepository.findById(dto.getPondId());
            if (!pondOpt.isPresent()) {
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("message", "Pond not found");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }
            
            TreatmentLog log = convertToEntity(dto, pondOpt.get());
            TreatmentLog savedLog = treatmentLogRepository.save(log);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Treatment log created successfully");
            response.put("data", convertToDTO(savedLog));
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Error creating treatment log: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // Update treatment log
    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateLog(
            @PathVariable Long id, 
            @RequestBody TreatmentLogDTO dto) {
        try {
            Optional<TreatmentLog> existingOpt = treatmentLogRepository.findById(id);
            if (!existingOpt.isPresent()) {
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("message", "Treatment log not found");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }
            
            TreatmentLog existing = existingOpt.get();
            updateEntityFromDTO(existing, dto);
            TreatmentLog savedLog = treatmentLogRepository.save(existing);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Treatment log updated successfully");
            response.put("data", convertToDTO(savedLog));
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Error updating treatment log: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // Delete treatment log
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteLog(@PathVariable Long id) {
        try {
            if (!treatmentLogRepository.existsById(id)) {
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("message", "Treatment log not found");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }
            
            treatmentLogRepository.deleteById(id);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Treatment log deleted successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Error deleting treatment log: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // Get statistics for a pond
    @GetMapping("/pond/{pondId}/stats")
    public ResponseEntity<Map<String, Object>> getStats(@PathVariable Long pondId) {
        try {
            List<TreatmentLog> allLogs = treatmentLogRepository.findByPondIdOrderByTimestampDesc(pondId);
            
            // This week
            LocalDateTime weekStart = LocalDateTime.now().minusDays(7);
            Long thisWeek = treatmentLogRepository.countLogsThisWeek(pondId, weekStart);
            
            // Calculate average per week
            if (!allLogs.isEmpty()) {
                LocalDateTime firstLog = allLogs.get(allLogs.size() - 1).getTimestamp();
                long weeks = java.time.temporal.ChronoUnit.WEEKS.between(firstLog, LocalDateTime.now());
                weeks = Math.max(1, weeks);
                double avgPerWeek = (double) allLogs.size() / weeks;
                
                Map<String, Object> stats = new HashMap<>();
                stats.put("total", allLogs.size());
                stats.put("thisWeek", thisWeek);
                stats.put("avgPerWeek", Math.round(avgPerWeek * 10.0) / 10.0);
                
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("data", stats);
                return ResponseEntity.ok(response);
            } else {
                Map<String, Object> stats = new HashMap<>();
                stats.put("total", 0);
                stats.put("thisWeek", 0);
                stats.put("avgPerWeek", 0.0);
                
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("data", stats);
                return ResponseEntity.ok(response);
            }
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", "Error calculating statistics: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // Convert entity to DTO
    private TreatmentLogDTO convertToDTO(TreatmentLog log) {
        TreatmentLogDTO dto = new TreatmentLogDTO();
        dto.setId(log.getId());
        dto.setPondId(log.getPond().getId());
        dto.setTimestamp(log.getTimestamp());
        dto.setTreatmentType(log.getTreatmentType());
        dto.setDosage(log.getDosage());
        dto.setUnit(log.getUnit());
        dto.setReason(log.getReason());
        dto.setNotes(log.getNotes());
        dto.setRecordedBy(log.getRecordedBy());
        dto.setParameter(log.getParameter());
        dto.setTargetValue(log.getTargetValue());
        dto.setBeforeValue(log.getBeforeValue());
        dto.setAfterValue(log.getAfterValue());
        dto.setPhotoUrl(log.getPhotoUrl());
        dto.setStatus(log.getStatus());
        dto.setVerifiedAt(log.getVerifiedAt());
        dto.setVerifiedBy(log.getVerifiedBy());
        dto.setCompletedAt(log.getCompletedAt());
        dto.setCompletedBy(log.getCompletedBy());
        return dto;
    }
    
    // Convert DTO to entity
    private TreatmentLog convertToEntity(TreatmentLogDTO dto, Pond pond) {
        TreatmentLog log = new TreatmentLog();
        log.setPond(pond);
        log.setTimestamp(dto.getTimestamp() != null ? dto.getTimestamp() : LocalDateTime.now());
        log.setTreatmentType(dto.getTreatmentType());
        log.setDosage(dto.getDosage());
        log.setUnit(dto.getUnit());
        log.setReason(dto.getReason());
        log.setNotes(dto.getNotes());
        log.setRecordedBy(dto.getRecordedBy());
        log.setParameter(dto.getParameter());
        log.setTargetValue(dto.getTargetValue());
        log.setBeforeValue(dto.getBeforeValue());
        log.setAfterValue(dto.getAfterValue());
        log.setPhotoUrl(dto.getPhotoUrl());
        log.setStatus(dto.getStatus() != null ? dto.getStatus() : "logged");
        return log;
    }
    
    // Update entity from DTO
    private void updateEntityFromDTO(TreatmentLog log, TreatmentLogDTO dto) {
        if (dto.getTreatmentType() != null) log.setTreatmentType(dto.getTreatmentType());
        if (dto.getDosage() != null) log.setDosage(dto.getDosage());
        if (dto.getUnit() != null) log.setUnit(dto.getUnit());
        if (dto.getReason() != null) log.setReason(dto.getReason());
        if (dto.getNotes() != null) log.setNotes(dto.getNotes());
        if (dto.getParameter() != null) log.setParameter(dto.getParameter());
        if (dto.getTargetValue() != null) log.setTargetValue(dto.getTargetValue());
        if (dto.getBeforeValue() != null) log.setBeforeValue(dto.getBeforeValue());
        if (dto.getAfterValue() != null) log.setAfterValue(dto.getAfterValue());
        if (dto.getPhotoUrl() != null) log.setPhotoUrl(dto.getPhotoUrl());
        if (dto.getStatus() != null) log.setStatus(dto.getStatus());
        if (dto.getVerifiedBy() != null) {
            log.setVerifiedBy(dto.getVerifiedBy());
            log.setVerifiedAt(java.time.LocalDateTime.now());
        }
        if (dto.getCompletedBy() != null) {
            log.setCompletedBy(dto.getCompletedBy());
            log.setCompletedAt(java.time.LocalDateTime.now());
        }
    }
}
