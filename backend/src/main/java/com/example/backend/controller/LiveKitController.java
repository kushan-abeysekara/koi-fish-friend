package com.example.backend.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/**
 * LiveKit Token Controller
 * 
 * Generates JWT access tokens for LiveKit rooms.
 * - Viewers (dashboard): can subscribe to camera feeds
 * - Publishers (Raspberry Pi): can publish camera feeds
 * 
 * LiveKit is self-hosted on the VPS via Dokploy.
 */
@RestController
@RequestMapping("/api/livekit")
@CrossOrigin(origins = "*")
public class LiveKitController {

    @Value("${livekit.api.key:APIhfro22ogg9c3}")
    private String apiKey;

    @Value("${livekit.api.secret:5ejwe0usuxnlknv5afgtsyfvsgmukb1pedprwwqaxilc}")
    private String apiSecret;

    @Value("${livekit.url:wss://livekit.koifish-livekit-9ae13d-187-77-189-5.traefik.me}")
    private String livekitUrl;

    /**
     * Generate a viewer token for the dashboard.
     * Viewers can subscribe (watch streams) but cannot publish.
     */
    @GetMapping("/token")
    public ResponseEntity<Map<String, String>> getViewerToken(
            @RequestParam(defaultValue = "dashboard-viewer") String identity,
            @RequestParam(defaultValue = "boat-navigation") String room) {

        long ttlSeconds = 6 * 60 * 60; // 6 hours
        String token = generateLiveKitJWT(identity, identity, room, true, false, ttlSeconds);

        Map<String, String> response = new HashMap<>();
        response.put("token", token);
        response.put("url", livekitUrl);
        response.put("room", room);

        return ResponseEntity.ok(response);
    }

    /**
     * Generate a publisher token for Raspberry Pi camera.
     * Publishers can publish (stream camera) and optionally subscribe.
     */
    @GetMapping("/publisher-token")
    public ResponseEntity<Map<String, String>> getPublisherToken(
            @RequestParam(defaultValue = "boat-camera-pi") String identity,
            @RequestParam(defaultValue = "boat-navigation") String room) {

        long ttlSeconds = 24 * 60 * 60; // 24 hours
        String token = generateLiveKitJWT(identity, "Boat Camera", room, true, true, ttlSeconds);

        Map<String, String> response = new HashMap<>();
        response.put("token", token);
        response.put("url", livekitUrl);

        return ResponseEntity.ok(response);
    }

    /**
     * Health check for LiveKit configuration.
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> status = new HashMap<>();
        status.put("status", "ok");
        status.put("livekitUrl", livekitUrl);
        status.put("apiKeyConfigured", apiKey != null && !apiKey.isEmpty());
        return ResponseEntity.ok(status);
    }

    // ─── JWT Generation (no external LiveKit SDK dependency needed) ───

    /**
     * Generate a LiveKit-compatible JWT token.
     * LiveKit tokens are standard JWTs with specific claims for room access.
     */
    private String generateLiveKitJWT(
            String identity,
            String name,
            String room,
            boolean canSubscribe,
            boolean canPublish,
            long ttlSeconds) {

        try {
            long now = System.currentTimeMillis() / 1000;
            long exp = now + ttlSeconds;

            // JWT Header
            String header = base64UrlEncode("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");

            // JWT Payload with LiveKit claims
            // LiveKit uses "video" claim for room permissions
            StringBuilder payload = new StringBuilder();
            payload.append("{");
            payload.append("\"iss\":\"").append(apiKey).append("\",");
            payload.append("\"sub\":\"").append(identity).append("\",");
            payload.append("\"name\":\"").append(name).append("\",");
            payload.append("\"iat\":").append(now).append(",");
            payload.append("\"nbf\":").append(now).append(",");
            payload.append("\"exp\":").append(exp).append(",");
            payload.append("\"jti\":\"").append(identity).append("-").append(now).append("\",");
            // LiveKit video grant
            payload.append("\"video\":{");
            payload.append("\"room\":\"").append(room).append("\",");
            payload.append("\"roomJoin\":true,");
            payload.append("\"canSubscribe\":").append(canSubscribe).append(",");
            payload.append("\"canPublish\":").append(canPublish).append(",");
            payload.append("\"canPublishData\":").append(canPublish);
            payload.append("}");
            payload.append("}");

            String encodedPayload = base64UrlEncode(payload.toString());

            // Sign with HMAC-SHA256
            String signingInput = header + "." + encodedPayload;
            String signature = hmacSha256(signingInput, apiSecret);

            return signingInput + "." + signature;

        } catch (Exception e) {
            throw new RuntimeException("Failed to generate LiveKit JWT", e);
        }
    }

    private String base64UrlEncode(String input) {
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(input.getBytes(StandardCharsets.UTF_8));
    }

    private String hmacSha256(String data, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec keySpec = new SecretKeySpec(
                secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(keySpec);
        byte[] rawHmac = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(rawHmac);
    }
}
