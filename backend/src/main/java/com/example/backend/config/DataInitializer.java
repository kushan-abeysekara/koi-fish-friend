package com.example.backend.config;

import com.example.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Override
    public void run(String... args) throws Exception {
        // Data initializer - ready for future use if needed
        // No default user creation - users should exist in database
        System.out.println("Application started - checking database connection");
        long userCount = userRepository.count();
        System.out.println("Found " + userCount + " user(s) in database");
    }
}
