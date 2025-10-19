package com.example.backend.config;

import com.example.backend.entity.User;
import com.example.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Override
    public void run(String... args) throws Exception {
        // Check if demo user already exists
        if (userRepository.findByUsername("admin").isEmpty()) {
            User demoUser = new User();
            demoUser.setUsername("admin");
            demoUser.setPassword(passwordEncoder.encode("admin123"));
            userRepository.save(demoUser);
            System.out.println("Demo user created: username=admin, password=admin123");
        } else {
            System.out.println("Demo user already exists");
        }
    }
}
