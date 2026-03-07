package com.example.backend.controller;

import com.example.backend.service.FlowiseService;
import com.example.backend.service.SupabaseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * AI Prediction Controller
 *
 * Provides endpoints for AI-powered farm predictions using Flowise.
 * Falls back to smart rule-based predictions when Flowise is unavailable.
 *
 * Endpoints:
 *   GET  /api/ai/prediction         → Get prediction based on latest sensor data
 *   POST /api/ai/prediction         → Get prediction with custom data
 *   POST /api/ai/ask                → Ask a free-form question
 *   GET  /api/ai/health             → Health check
 */
@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "*")
public class AIPredictionController {

    @Autowired
    private FlowiseService flowiseService;

    @Autowired
    private SupabaseService supabaseService;

    /**
     * Get AI prediction based on latest sensor data from Supabase.
     * Automatically fetches current feeddb + weather context.
     */
    @GetMapping("/prediction")
    public ResponseEntity<Map<String, Object>> getPrediction(
            @RequestParam(defaultValue = "feed_device_001") String deviceId) {

        Map<String, Object> feedData = fetchLatestFeedData(deviceId);
        Map<String, Object> prediction = flowiseService.getPrediction(feedData);
        prediction.put("deviceId", deviceId);
        prediction.put("timestamp", java.time.Instant.now().toString());

        return ResponseEntity.ok(prediction);
    }

    /**
     * Get AI prediction with custom/override data.
     * Frontend can send specific values for what-if scenarios.
     */
    @PostMapping("/prediction")
    public ResponseEntity<Map<String, Object>> getPredictionWithData(
            @RequestBody Map<String, Object> feedData) {

        Map<String, Object> prediction = flowiseService.getPrediction(feedData);
        prediction.put("timestamp", java.time.Instant.now().toString());

        return ResponseEntity.ok(prediction);
    }

    /**
     * Ask a free-form question to the AI.
     */
    @PostMapping("/ask")
    public ResponseEntity<Map<String, String>> askQuestion(
            @RequestBody Map<String, String> request) {

        String question = request.getOrDefault("question", "");
        if (question.isBlank()) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Question cannot be empty");
            return ResponseEntity.badRequest().body(error);
        }

        String answer = flowiseService.askQuestion(question);

        Map<String, String> response = new HashMap<>();
        response.put("question", question);
        response.put("answer", answer);
        response.put("timestamp", java.time.Instant.now().toString());

        return ResponseEntity.ok(response);
    }

    /**
     * Health check for AI service.
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> status = new HashMap<>();
        status.put("status", "ok");
        status.put("service", "flowise-ai");
        status.put("timestamp", java.time.Instant.now().toString());
        return ResponseEntity.ok(status);
    }

    /**
     * Fetch the latest device data from Supabase feeddb.
     */
    private Map<String, Object> fetchLatestFeedData(String deviceId) {
        Map<String, Object> data = new HashMap<>();
        data.put("deviceId", deviceId);

        try {
            List<Map<String, Object>> rows = supabaseService.queryRows(
                    "SELECT * FROM feeddb WHERE device_id = '" + deviceId + "' LIMIT 1"
            );

            if (!rows.isEmpty()) {
                Map<String, Object> row = rows.get(0);
                data.put("weight", row.getOrDefault("weight", 0));
                data.put("tankLevel", row.getOrDefault("tank_level", 0));
                data.put("tankCapacity", row.getOrDefault("tank_capacity", 20000));
                data.put("tankPercentage", row.getOrDefault("tank_percentage", 0));
                data.put("motorStatus", row.getOrDefault("motor_status", "STOPPED"));
                data.put("feedCount", row.getOrDefault("feed_count", 0));
                data.put("totalGramsFed", row.getOrDefault("total_grams_fed", 0));
            }
        } catch (Exception e) {
            System.err.println("[AI] Error fetching feed data: " + e.getMessage());
        }

        return data;
    }
}
