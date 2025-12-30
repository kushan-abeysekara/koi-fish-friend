package com.example.backend.controller;

import com.example.backend.dto.ApiResponse;
import com.example.backend.dto.PasswordResetRequest;
import com.example.backend.entity.User;
import com.example.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /**
     * Reset password for a user
     */
    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse> resetPassword(@RequestBody PasswordResetRequest request) {
        Optional<User> userOptional = userRepository.findByUsername(request.getUsername());

        if (userOptional.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse(false, "User not found"));
        }

        User user = userOptional.get();
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));

        userRepository.save(user);

        return ResponseEntity.ok(new ApiResponse(true, "Password reset successfully"));
    }

    /**
     * Create or update admin user with password 'admin1234'
     */
    @PostMapping("/create-admin")
    public ResponseEntity<ApiResponse> createAdmin() {
        Optional<User> existingUser = userRepository.findByUsername("admin");

        User user;
        if (existingUser.isPresent()) {
            user = existingUser.get();
            user.setPassword(passwordEncoder.encode("admin1234"));
        } else {
            user = new User();
            user.setUsername("admin");
            user.setPassword(passwordEncoder.encode("admin1234"));
        }

        userRepository.save(user);

        return ResponseEntity.ok(new ApiResponse(true,
                "Admin user created/updated with password: admin1234"));
    }

    /**
     * Get user by username
     */
    @GetMapping("/{username}")
    public ResponseEntity<ApiResponse> getUser(@PathVariable String username) {
        Optional<User> user = userRepository.findByUsername(username);

        if (user.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(new ApiResponse(true, "User found"));
    }
}
