package com.example.backend.controller;

import com.example.backend.dto.ApiResponse;
import com.example.backend.service.SupabaseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@RestController
@RequestMapping("/api/camera")
@CrossOrigin(origins = "*")
public class CameraController {

    @Autowired
    private SupabaseService supabaseService;

    private final AtomicLong alertIdSequence = new AtomicLong(0);
    private final Map<Long, Map<String, Object>> alerts = new ConcurrentHashMap<>();

    @GetMapping("/ponds")
    public ResponseEntity<ApiResponse> getAllPonds() {
        return ResponseEntity.ok(new ApiResponse(true, "Camera ponds retrieved", List.of()));
    }

    @PostMapping("/events")
    public ResponseEntity<ApiResponse> saveEvents(@RequestBody(required = false) Map<String, Object> payload) {
        try {
            List<?> incoming = payload != null && payload.get("events") instanceof List<?> list ? list : List.of();
            List<Map<String, Object>> saved = new ArrayList<>();

            for (Object item : incoming) {
                if (!(item instanceof Map<?, ?> sourceMap)) {
                    continue;
                }

                Map<String, Object> safeSource = new LinkedHashMap<>();
                for (Map.Entry<?, ?> entry : sourceMap.entrySet()) {
                    if (entry.getKey() instanceof String key) {
                        safeSource.put(key, entry.getValue());
                    }
                }

                // Extract detection event data
                Integer fishId = null;
                Object fishObj = safeSource.get("fishId");
                if (fishObj instanceof Number) {
                    fishId = ((Number) fishObj).intValue();
                }

                String healthStatus = (String) safeSource.getOrDefault("healthStatus", "unknown");
                double confidence = 0;
                Object confObj = safeSource.get("confidence");
                if (confObj instanceof Number) {
                    confidence = ((Number) confObj).doubleValue();
                }

                boolean isCritical = (boolean) safeSource.getOrDefault("isCritical", false);
                boolean needsAttention = (boolean) safeSource.getOrDefault("needsAttention", false);

                // Extract bounding box
                double x1 = 0, y1 = 0, x2 = 0, y2 = 0;
                Object bbox = safeSource.get("boundingBox");
                if (bbox instanceof Map<?, ?> bboxMap) {
                    Object x1Obj = bboxMap.get("x1");
                    Object y1Obj = bboxMap.get("y1");
                    Object x2Obj = bboxMap.get("x2");
                    Object y2Obj = bboxMap.get("y2");
                    if (x1Obj instanceof Number)
                        x1 = ((Number) x1Obj).doubleValue();
                    if (y1Obj instanceof Number)
                        y1 = ((Number) y1Obj).doubleValue();
                    if (x2Obj instanceof Number)
                        x2 = ((Number) x2Obj).doubleValue();
                    if (y2Obj instanceof Number)
                        y2 = ((Number) y2Obj).doubleValue();
                }

                // Extract optional screenshot (base64 data URL)
                String screenshot = (String) safeSource.getOrDefault("screenshot", null);

                // Store to Supabase
                Map<String, Object> storedEvent = supabaseService.storeDetectionEvent(
                        fishId, healthStatus, confidence, isCritical, needsAttention, x1, y1, x2, y2, screenshot);

                if (!storedEvent.isEmpty()) {
                    saved.add(storedEvent);
                }
            }

            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new ApiResponse(true, "Detection events saved", saved));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to save detection events: " + e.getMessage(), null));
        }
    }

    @GetMapping("/events")
    public ResponseEntity<ApiResponse> getEvents(
            @RequestParam(required = false) Integer fishId,
            @RequestParam(required = false) String healthStatus,
            @RequestParam(required = false) Boolean isCritical,
            @RequestParam(defaultValue = "24") int hoursBack,
            @RequestParam(defaultValue = "1000") int limit) {
        try {
            List<Map<String, Object>> events = supabaseService.getDetectionEvents(
                    fishId, healthStatus, isCritical, hoursBack, limit);
            return ResponseEntity.ok(new ApiResponse(true, "Detection events retrieved", events));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to retrieve detection events: " + e.getMessage(), null));
        }
    }

    @GetMapping("/events/{eventId}")
    public ResponseEntity<ApiResponse> getEventDetails(@PathVariable Long eventId) {
        try {
            List<Map<String, Object>> events = supabaseService.queryRows(
                    "SELECT * FROM detection_events WHERE id = " + eventId + " LIMIT 1");
            if (events.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Event not found", null));
            }
            return ResponseEntity.ok(new ApiResponse(true, "Detection event retrieved", events.get(0)));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to retrieve event: " + e.getMessage(), null));
        }
    }

    @PostMapping("/events/{eventId}/acknowledge")
    public ResponseEntity<ApiResponse> acknowledgeEvent(@PathVariable Long eventId) {
        try {
            supabaseService.updateDetectionEventStatus(eventId, "acknowledged", null);
            return ResponseEntity.ok(new ApiResponse(true, "Event acknowledged", null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to acknowledge event: " + e.getMessage(), null));
        }
    }

    @PostMapping("/events/{eventId}/false-alarm")
    public ResponseEntity<ApiResponse> markEventAsFalseAlarm(@PathVariable Long eventId) {
        try {
            supabaseService.updateDetectionEventStatus(eventId, "false_alarm", null);
            return ResponseEntity.ok(new ApiResponse(true, "Event marked as false alarm", null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to mark event: " + e.getMessage(), null));
        }
    }

    @PostMapping("/events/{eventId}/notes")
    public ResponseEntity<ApiResponse> addEventNotes(@PathVariable Long eventId,
            @RequestBody(required = false) Map<String, Object> payload) {
        try {
            String notes = payload != null && payload.get("notes") != null
                    ? String.valueOf(payload.get("notes"))
                    : "";
            supabaseService.updateDetectionEventStatus(eventId, null, notes);
            return ResponseEntity.ok(new ApiResponse(true, "Event notes updated", null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to update notes: " + e.getMessage(), null));
        }
    }

    @DeleteMapping("/events")
    public ResponseEntity<ApiResponse> deleteAllEvents() {
        try {
            supabaseService.deleteAllDetectionEvents();
            return ResponseEntity.ok(new ApiResponse(true, "All detection events deleted", null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to delete events: " + e.getMessage(), null));
        }
    }

    @PostMapping("/alerts/critical")
    public ResponseEntity<ApiResponse> saveCriticalAlert(@RequestBody(required = false) Map<String, Object> payload) {
        try {
            long id = alertIdSequence.incrementAndGet();
            Map<String, Object> alert = new LinkedHashMap<>();
            alert.put("id", id);
            alert.put("timestamp", payload != null && payload.get("timestamp") != null
                    ? payload.get("timestamp")
                    : Instant.now().toString());
            alert.put("alertType",
                    payload != null ? payload.getOrDefault("alertType", "DETECTION_ALERT") : "DETECTION_ALERT");
            alert.put("severity", payload != null ? payload.getOrDefault("severity", "HIGH") : "HIGH");
            alert.put("fishCount", payload != null ? payload.getOrDefault("fishCount", 0) : 0);
            alert.put("details", payload != null ? payload.getOrDefault("details", List.of()) : List.of());
            alert.put("status", "sent");

            alerts.put(id, alert);

            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new ApiResponse(true, "Critical alert saved", alert));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to save critical alert: " + e.getMessage(), null));
        }
    }

    @GetMapping("/alerts")
    public ResponseEntity<ApiResponse> getAlerts() {
        List<Map<String, Object>> list = alerts.values().stream()
                .sorted(Comparator.comparingLong(e -> -((Number) e.get("id")).longValue()))
                .toList();
        return ResponseEntity.ok(new ApiResponse(true, "Alerts retrieved", list));
    }

    @PutMapping("/alerts/{alertId}/status")
    public ResponseEntity<ApiResponse> updateAlertStatus(@PathVariable Long alertId,
            @RequestBody(required = false) Map<String, Object> payload) {
        Map<String, Object> alert = alerts.get(alertId);
        if (alert == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse(false, "Alert not found", null));
        }

        String status = payload != null && payload.get("status") != null
                ? String.valueOf(payload.get("status"))
                : "acknowledged";
        alert.put("status", status);

        return ResponseEntity.ok(new ApiResponse(true, "Alert status updated", alert));
    }
}
