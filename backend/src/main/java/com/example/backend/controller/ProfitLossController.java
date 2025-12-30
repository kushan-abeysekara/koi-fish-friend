package com.example.backend.controller;

import com.example.backend.dto.ApiResponse;
import com.example.backend.dto.ProfitLossReport;
import com.example.backend.service.ProfitLossService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/profit-loss")
@CrossOrigin(origins = "*")
public class ProfitLossController {

    @Autowired
    private ProfitLossService profitLossService;

    @GetMapping("/pond/{pondId}")
    public ResponseEntity<ApiResponse> getProfitLossReport(
            @PathVariable Long pondId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        try {
            ProfitLossReport report = profitLossService.generateProfitLossReport(pondId, startDate, endDate);
            return ResponseEntity.ok(new ApiResponse(true, "Profit & Loss report generated successfully", report));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error generating report: " + e.getMessage(), null));
        }
    }

    @GetMapping("/overall")
    public ResponseEntity<ApiResponse> getOverallProfitLossReport(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        try {
            ProfitLossReport report = profitLossService.generateOverallProfitLossReport(startDate, endDate);
            return ResponseEntity
                    .ok(new ApiResponse(true, "Overall Profit & Loss report generated successfully", report));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error generating report: " + e.getMessage(), null));
        }
    }
}
