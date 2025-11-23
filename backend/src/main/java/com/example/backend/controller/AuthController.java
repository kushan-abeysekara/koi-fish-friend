package com.example.backend.controller;

import com.example.backend.dto.ApiResponse;
import com.example.backend.dto.LoginRequest;
import com.example.backend.dto.UpdateCredentialsRequest;
import com.example.backend.entity.User;
import com.example.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse> login(@RequestBody LoginRequest loginRequest) {
        try {
            Optional<User> userOptional = userRepository.findByUsername(loginRequest.getUsername());

            if (userOptional.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponse(false, "Invalid username or password"));
            }

            User user = userOptional.get();

            if (passwordEncoder.matches(loginRequest.getPassword(), user.getPassword())) {
                return ResponseEntity.ok(new ApiResponse(true, "Login successful"));
            } else {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponse(false, "Invalid username or password"));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "An error occurred: " + e.getMessage()));
        }
    }

    @PostMapping("/update-credentials")
    public ResponseEntity<ApiResponse> updateCredentials(@RequestBody UpdateCredentialsRequest request) {
        try {
            Optional<User> userOptional = userRepository.findByUsername(request.getCurrentUsername());

            if (userOptional.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "User not found"));
            }

            User user = userOptional.get();

            // Update username if provided and different
            if (request.getNewUsername() != null && !request.getNewUsername().isEmpty()) {
                // Check if new username already exists
                Optional<User> existingUser = userRepository.findByUsername(request.getNewUsername());
                if (existingUser.isPresent() && !existingUser.get().getId().equals(user.getId())) {
                    return ResponseEntity.status(HttpStatus.CONFLICT)
                            .body(new ApiResponse(false, "Username already exists"));
                }
                user.setUsername(request.getNewUsername());
            }

            // Update password if provided
            if (request.getNewPassword() != null && !request.getNewPassword().isEmpty()) {
                String encodedPassword = passwordEncoder.encode(request.getNewPassword());
                user.setPassword(encodedPassword);
            }

            userRepository.save(user);

            return ResponseEntity.ok(new ApiResponse(true, "Credentials updated successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "An error occurred: " + e.getMessage()));
        }
    }
}
