package com.example.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * Service that communicates with the self-hosted Flowise AI instance
 * to generate smart predictions for the fish farm.
 *
 * Flowise runs on the VPS and exposes chatflow prediction endpoints.
 * We send feeding + tank + weather context and get back AI predictions:
 *   - Next feeding time
 *   - Recommended feed amount
 *   - Tank empty estimate
 *   - Abnormal behavior detection
 */
@Service
public class FlowiseService {

    @Value("${flowise.url:http://187.77.189.5:3001}")
    private String flowiseUrl;

    @Value("${flowise.chatflow.id:}")
    private String chatflowId;

    @Value("${flowise.api.key:}")
    private String apiKey;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private HttpClient httpClient;

    @PostConstruct
    public void init() {
        httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();

        System.out.println("[Flowise] Initialized - URL: " + flowiseUrl);
        if (chatflowId != null && !chatflowId.isBlank()) {
            System.out.println("[Flowise] Chatflow ID: " + chatflowId);
        } else {
            System.out.println("[Flowise] ⚠️ No chatflow ID configured. Set flowise.chatflow.id in application.properties");
        }
    }

    /**
     * Send a prediction request to Flowise with feeding/tank context.
     *
     * @param feedData Map containing: weight, tankLevel, tankCapacity, tankPercentage,
     *                 motorStatus, feedCount, totalGramsFed, temperature, rainfall
     * @return AI prediction response as a Map
     */
    public Map<String, Object> getPrediction(Map<String, Object> feedData) {
        if (chatflowId == null || chatflowId.isBlank()) {
            return buildFallbackPrediction(feedData);
        }

        try {
            String question = buildPredictionPrompt(feedData);
            String response = callFlowise(question);
            return parsePredictionResponse(response, feedData);
        } catch (Exception e) {
            System.err.println("[Flowise] Prediction error: " + e.getMessage());
            return buildFallbackPrediction(feedData);
        }
    }

    /**
     * Send a free-form question to Flowise.
     */
    public String askQuestion(String question) {
        if (chatflowId == null || chatflowId.isBlank()) {
            return "Flowise chatflow not configured. Set flowise.chatflow.id in application.properties.";
        }

        try {
            return callFlowise(question);
        } catch (Exception e) {
            System.err.println("[Flowise] Question error: " + e.getMessage());
            return "Error communicating with AI: " + e.getMessage();
        }
    }

    /**
     * Call the Flowise prediction API.
     */
    private String callFlowise(String question) throws Exception {
        String url = flowiseUrl.replaceAll("/$", "") + "/api/v1/prediction/" + chatflowId;

        ObjectNode body = objectMapper.createObjectNode();
        body.put("question", question);

        HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json");

        if (apiKey != null && !apiKey.isBlank()) {
            reqBuilder.header("Authorization", "Bearer " + apiKey);
        }

        reqBuilder.POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)));

        HttpResponse<String> response = httpClient.send(reqBuilder.build(),
                HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 200 && response.statusCode() < 300) {
            JsonNode json = objectMapper.readTree(response.body());
            // Flowise returns { "text": "...", ... }
            if (json.has("text")) {
                return json.get("text").asText();
            }
            return response.body();
        } else {
            throw new RuntimeException("Flowise HTTP " + response.statusCode() + ": " + response.body());
        }
    }

    /**
     * Build a structured prompt for the AI with current farm data.
     */
    private String buildPredictionPrompt(Map<String, Object> feedData) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are a smart koi fish farm AI assistant. Based on the following real-time sensor data, ");
        sb.append("provide predictions in JSON format.\n\n");
        sb.append("Current Farm Data:\n");
        sb.append("- Current Weight on Scale: ").append(feedData.getOrDefault("weight", "unknown")).append(" grams\n");
        sb.append("- Tank Level: ").append(feedData.getOrDefault("tankLevel", "unknown")).append(" grams\n");
        sb.append("- Tank Capacity: ").append(feedData.getOrDefault("tankCapacity", "unknown")).append(" grams\n");
        sb.append("- Tank Percentage: ").append(feedData.getOrDefault("tankPercentage", "unknown")).append("%\n");
        sb.append("- Motor Status: ").append(feedData.getOrDefault("motorStatus", "unknown")).append("\n");
        sb.append("- Total Feedings Today: ").append(feedData.getOrDefault("feedCount", "unknown")).append("\n");
        sb.append("- Total Grams Fed: ").append(feedData.getOrDefault("totalGramsFed", "unknown")).append("\n");

        if (feedData.containsKey("temperature")) {
            sb.append("- Temperature: ").append(feedData.get("temperature")).append("°C\n");
        }
        if (feedData.containsKey("rainfall")) {
            sb.append("- Rainfall Probability: ").append(feedData.get("rainfall")).append("%\n");
        }

        sb.append("\nProvide a JSON response with these keys:\n");
        sb.append("- nextFeedingTime: recommended next feeding time (e.g., '2 hours from now')\n");
        sb.append("- recommendedAmount: feed amount in grams\n");
        sb.append("- tankEmptyEstimate: when the tank will be empty\n");
        sb.append("- abnormalBehavior: any detected anomalies (or 'None detected')\n");
        sb.append("- healthScore: overall farm health (0-100)\n");
        sb.append("- recommendations: array of actionable recommendations\n");

        return sb.toString();
    }

    /**
     * Parse the Flowise response into a structured prediction map.
     */
    private Map<String, Object> parsePredictionResponse(String response, Map<String, Object> feedData) {
        Map<String, Object> result = new HashMap<>();

        try {
            // Try to parse as JSON first
            JsonNode json = objectMapper.readTree(response);
            if (json.has("nextFeedingTime")) result.put("nextFeedingTime", json.get("nextFeedingTime").asText());
            if (json.has("recommendedAmount")) result.put("recommendedAmount", json.get("recommendedAmount").asDouble());
            if (json.has("tankEmptyEstimate")) result.put("tankEmptyEstimate", json.get("tankEmptyEstimate").asText());
            if (json.has("abnormalBehavior")) result.put("abnormalBehavior", json.get("abnormalBehavior").asText());
            if (json.has("healthScore")) result.put("healthScore", json.get("healthScore").asInt());
            if (json.has("recommendations")) result.put("recommendations", objectMapper.convertValue(json.get("recommendations"), java.util.List.class));
            result.put("rawResponse", response);
            result.put("source", "flowise");
        } catch (Exception e) {
            // AI returned free text — wrap it
            result.put("rawResponse", response);
            result.put("source", "flowise");
            result = buildFallbackPrediction(feedData);
            result.put("aiInsight", response);
        }

        return result;
    }

    /**
     * Generate smart rule-based predictions when Flowise is unavailable.
     * Uses actual sensor data for calculations.
     */
    private Map<String, Object> buildFallbackPrediction(Map<String, Object> feedData) {
        Map<String, Object> result = new HashMap<>();

        double tankPercentage = toDouble(feedData.getOrDefault("tankPercentage", 50));
        double totalGramsFed = toDouble(feedData.getOrDefault("totalGramsFed", 0));
        int feedCount = toInt(feedData.getOrDefault("feedCount", 0));
        double tankLevel = toDouble(feedData.getOrDefault("tankLevel", 10000));
        double tankCapacity = toDouble(feedData.getOrDefault("tankCapacity", 20000));

        // Next feeding time — based on last feed count and time of day
        int hour = java.time.LocalTime.now().getHour();
        String nextFeeding;
        if (feedCount == 0) {
            nextFeeding = "Feed now — no feedings recorded today";
        } else if (hour < 8) {
            nextFeeding = "8:00 AM — Morning feeding";
        } else if (hour < 12) {
            nextFeeding = "12:00 PM — Midday feeding";
        } else if (hour < 16) {
            nextFeeding = "4:00 PM — Afternoon feeding";
        } else {
            nextFeeding = "Tomorrow 8:00 AM — No more feedings today";
        }
        result.put("nextFeedingTime", nextFeeding);

        // Recommended amount — 2-3% body weight typical, varies by temp
        double baseAmount = 150; // grams per feeding
        double temp = toDouble(feedData.getOrDefault("temperature", 25));
        if (temp < 15) baseAmount *= 0.5;       // Cold — reduce feeding
        else if (temp < 20) baseAmount *= 0.75;  // Cool
        else if (temp > 30) baseAmount *= 0.8;   // Hot — slight reduction
        result.put("recommendedAmount", Math.round(baseAmount));

        // Tank empty estimate
        double avgPerDay = feedCount > 0 ? totalGramsFed / Math.max(feedCount, 1) * 3 : 450;
        double daysRemaining = (tankLevel / tankCapacity) * tankLevel / Math.max(avgPerDay, 1);
        if (daysRemaining < 1) {
            result.put("tankEmptyEstimate", "Less than 1 day — REFILL NOW");
        } else if (daysRemaining < 3) {
            result.put("tankEmptyEstimate", String.format("%.1f days — refill soon", daysRemaining));
        } else {
            result.put("tankEmptyEstimate", String.format("%.0f days remaining", daysRemaining));
        }

        // Abnormal behavior detection
        String abnormal = "None detected";
        if (tankPercentage < 5) abnormal = "⚠️ Tank critically low!";
        else if (feedCount > 8) abnormal = "⚠️ Unusually high feeding count today";
        result.put("abnormalBehavior", abnormal);

        // Health score
        int healthScore = 85;
        if (tankPercentage < 10) healthScore -= 20;
        if (tankPercentage < 5) healthScore -= 20;
        if (feedCount > 8) healthScore -= 10;
        if (feedCount == 0 && hour > 10) healthScore -= 15;
        healthScore = Math.max(0, Math.min(100, healthScore));
        result.put("healthScore", healthScore);

        // Recommendations
        java.util.List<String> recommendations = new java.util.ArrayList<>();
        if (tankPercentage < 20) recommendations.add("Refill feed tank soon — " + String.format("%.1f%%", tankPercentage) + " remaining");
        if (feedCount == 0 && hour > 9) recommendations.add("No feedings yet today — consider starting morning feeding");
        if (temp > 30) recommendations.add("High temperature detected — reduce feeding amount slightly");
        if (temp < 15) recommendations.add("Low temperature — fish metabolism slowed, reduce feeding frequency");
        if (recommendations.isEmpty()) recommendations.add("All systems nominal — continue regular feeding schedule");
        result.put("recommendations", recommendations);

        result.put("source", "rule-engine");
        return result;
    }

    private double toDouble(Object val) {
        if (val instanceof Number) return ((Number) val).doubleValue();
        try { return Double.parseDouble(String.valueOf(val)); } catch (Exception e) { return 0; }
    }

    private int toInt(Object val) {
        if (val instanceof Number) return ((Number) val).intValue();
        try { return Integer.parseInt(String.valueOf(val)); } catch (Exception e) { return 0; }
    }
}
