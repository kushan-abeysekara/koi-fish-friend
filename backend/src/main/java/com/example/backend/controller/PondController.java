package com.example.backend.controller;

import com.example.backend.dto.ApiResponse;
import com.example.backend.dto.PondRequest;
import com.example.backend.entity.Pond;
import com.example.backend.service.PondService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ponds")
@CrossOrigin(origins = "*")
public class PondController {

    @Autowired
    private PondService pondService;

    @GetMapping
    public ResponseEntity<ApiResponse> getAllPonds() {
        try {
            List<Pond> ponds = pondService.getAllPonds();
            return ResponseEntity.ok(new ApiResponse(true, "Ponds retrieved successfully", ponds));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving ponds: " + e.getMessage(), null));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse> getPondById(@PathVariable Long id) {
        try {
            Pond pond = pondService.getPondById(id);
            return ResponseEntity.ok(new ApiResponse(true, "Pond retrieved successfully", pond));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error retrieving pond: " + e.getMessage(), null));
        }
    }

    @PostMapping
    public ResponseEntity<ApiResponse> createPond(@RequestBody PondRequest request) {
        try {
            Pond pond = pondService.createPond(request);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new ApiResponse(true, "Pond created successfully", pond));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error creating pond: " + e.getMessage(), null));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse> updatePond(@PathVariable Long id, @RequestBody PondRequest request) {
        try {
            Pond pond = pondService.updatePond(id, request);
            return ResponseEntity.ok(new ApiResponse(true, "Pond updated successfully", pond));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error updating pond: " + e.getMessage(), null));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> deletePond(@PathVariable Long id) {
        try {
            pondService.deletePond(id);
            return ResponseEntity.ok(new ApiResponse(true, "Pond deleted successfully", null));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse(false, e.getMessage(), null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error deleting pond: " + e.getMessage(), null));
        }
    }
}
