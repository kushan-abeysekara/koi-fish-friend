package com.example.backend.service;

import com.example.backend.dto.PondRequest;
import com.example.backend.entity.Pond;
import com.example.backend.repository.PondRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class PondService {

    @Autowired
    private PondRepository pondRepository;

    public List<Pond> getAllPonds() {
        return pondRepository.findAll();
    }

    public Pond getPondById(Long id) {
        return pondRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Pond not found with id: " + id));
    }

    public Pond createPond(PondRequest request) {
        if (pondRepository.existsByName(request.getName())) {
            throw new RuntimeException("Pond with name '" + request.getName() + "' already exists");
        }

        Pond pond = new Pond(request.getName(), request.getColor());
        return pondRepository.save(pond);
    }

    public Pond updatePond(Long id, PondRequest request) {
        Pond pond = getPondById(id);

        if (!pond.getName().equals(request.getName()) && pondRepository.existsByName(request.getName())) {
            throw new RuntimeException("Pond with name '" + request.getName() + "' already exists");
        }

        pond.setName(request.getName());
        pond.setColor(request.getColor());
        return pondRepository.save(pond);
    }

    public void deletePond(Long id) {
        Pond pond = getPondById(id);
        pondRepository.delete(pond);
    }
}
