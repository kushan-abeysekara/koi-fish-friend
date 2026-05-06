package com.example.backend.repository;

import com.example.backend.entity.Pond;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PondRepository extends JpaRepository<Pond, Long> {
    Optional<Pond> findByName(String name);

    boolean existsByName(String name);

    List<Pond> findByStatusIgnoreCaseNot(String status);

    List<Pond> findByStatusIgnoreCaseNotAndCreatedAtLessThanEqual(String status, LocalDateTime createdAt);
}
