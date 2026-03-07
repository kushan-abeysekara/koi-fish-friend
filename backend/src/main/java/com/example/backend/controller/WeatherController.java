package com.example.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Weather Forecast Controller
 *
 * Proxies weather data from Open-Meteo API (free, no API key needed).
 * Default coordinates: Colombo, Sri Lanka (6.9271°N, 79.8612°E).
 *
 * Caches responses for 30 minutes to avoid excessive API calls.
 *
 * Endpoints:
 *   GET /api/weather/current      → Current weather conditions
 *   GET /api/weather/forecast     → 7-day hourly forecast
 *   GET /api/weather/summary      → Simplified summary for dashboard widget
 */
@RestController
@RequestMapping("/api/weather")
@CrossOrigin(origins = "*")
public class WeatherController {

    private static final String OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
    private static final String DEFAULT_LAT = "6.9271";
    private static final String DEFAULT_LON = "79.8612";
    private static final long CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Simple in-memory cache
    private final ConcurrentHashMap<String, CachedResponse> cache = new ConcurrentHashMap<>();

    private record CachedResponse(Object data, long timestamp) {
        boolean isValid() { return System.currentTimeMillis() - timestamp < CACHE_TTL_MS; }
    }

    /**
     * Get current weather conditions.
     */
    @GetMapping("/current")
    public ResponseEntity<Map<String, Object>> getCurrentWeather(
            @RequestParam(defaultValue = DEFAULT_LAT) double latitude,
            @RequestParam(defaultValue = DEFAULT_LON) double longitude) {

        String cacheKey = "current-" + latitude + "-" + longitude;
        CachedResponse cached = cache.get(cacheKey);
        if (cached != null && cached.isValid()) {
            @SuppressWarnings("unchecked")
            Map<String, Object> cachedData = (Map<String, Object>) cached.data();
            return ResponseEntity.ok(cachedData);
        }

        try {
            String url = OPEN_METEO_BASE +
                    "?latitude=" + latitude +
                    "&longitude=" + longitude +
                    "&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,cloud_cover" +
                    "&timezone=auto";

            String body = fetchUrl(url);
            JsonNode json = objectMapper.readTree(body);

            Map<String, Object> result = new HashMap<>();
            if (json.has("current")) {
                JsonNode current = json.get("current");
                result.put("temperature", current.path("temperature_2m").asDouble());
                result.put("humidity", current.path("relative_humidity_2m").asInt());
                result.put("precipitation", current.path("precipitation").asDouble());
                result.put("rain", current.path("rain").asDouble());
                result.put("weatherCode", current.path("weather_code").asInt());
                result.put("windSpeed", current.path("wind_speed_10m").asDouble());
                result.put("cloudCover", current.path("cloud_cover").asInt());
                result.put("weatherDescription", weatherCodeToDescription(current.path("weather_code").asInt()));
                result.put("weatherIcon", weatherCodeToIcon(current.path("weather_code").asInt()));
            }
            result.put("latitude", latitude);
            result.put("longitude", longitude);
            result.put("timestamp", java.time.Instant.now().toString());

            cache.put(cacheKey, new CachedResponse(result, System.currentTimeMillis()));
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Failed to fetch weather: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    /**
     * Get hourly forecast for next 48 hours.
     */
    @GetMapping("/forecast")
    public ResponseEntity<Map<String, Object>> getForecast(
            @RequestParam(defaultValue = DEFAULT_LAT) double latitude,
            @RequestParam(defaultValue = DEFAULT_LON) double longitude) {

        String cacheKey = "forecast-" + latitude + "-" + longitude;
        CachedResponse cached = cache.get(cacheKey);
        if (cached != null && cached.isValid()) {
            @SuppressWarnings("unchecked")
            Map<String, Object> cachedData = (Map<String, Object>) cached.data();
            return ResponseEntity.ok(cachedData);
        }

        try {
            String url = OPEN_METEO_BASE +
                    "?latitude=" + latitude +
                    "&longitude=" + longitude +
                    "&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,rain,weather_code,wind_speed_10m" +
                    "&forecast_days=3" +
                    "&timezone=auto";

            String body = fetchUrl(url);
            JsonNode json = objectMapper.readTree(body);

            Map<String, Object> result = new HashMap<>();
            List<Map<String, Object>> hourly = new ArrayList<>();

            if (json.has("hourly")) {
                JsonNode h = json.get("hourly");
                JsonNode times = h.path("time");
                JsonNode temps = h.path("temperature_2m");
                JsonNode humidity = h.path("relative_humidity_2m");
                JsonNode precipProb = h.path("precipitation_probability");
                JsonNode precip = h.path("precipitation");
                JsonNode rain = h.path("rain");
                JsonNode codes = h.path("weather_code");
                JsonNode wind = h.path("wind_speed_10m");

                for (int i = 0; i < times.size() && i < 72; i++) {
                    Map<String, Object> point = new HashMap<>();
                    point.put("time", times.get(i).asText());
                    point.put("temperature", temps.get(i).asDouble());
                    point.put("humidity", humidity.get(i).asInt());
                    point.put("precipitationProbability", precipProb.get(i).asInt());
                    point.put("precipitation", precip.get(i).asDouble());
                    point.put("rain", rain.get(i).asDouble());
                    point.put("weatherCode", codes.get(i).asInt());
                    point.put("windSpeed", wind.get(i).asDouble());
                    point.put("weatherDescription", weatherCodeToDescription(codes.get(i).asInt()));
                    hourly.add(point);
                }
            }

            result.put("hourly", hourly);
            result.put("latitude", latitude);
            result.put("longitude", longitude);
            result.put("timestamp", java.time.Instant.now().toString());

            cache.put(cacheKey, new CachedResponse(result, System.currentTimeMillis()));
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Failed to fetch forecast: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    /**
     * Get a simplified weather summary for the dashboard widget.
     * Returns current conditions + rain probability for next 6 hours.
     */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getWeatherSummary(
            @RequestParam(defaultValue = DEFAULT_LAT) double latitude,
            @RequestParam(defaultValue = DEFAULT_LON) double longitude) {

        String cacheKey = "summary-" + latitude + "-" + longitude;
        CachedResponse cached = cache.get(cacheKey);
        if (cached != null && cached.isValid()) {
            @SuppressWarnings("unchecked")
            Map<String, Object> cachedData = (Map<String, Object>) cached.data();
            return ResponseEntity.ok(cachedData);
        }

        try {
            String url = OPEN_METEO_BASE +
                    "?latitude=" + latitude +
                    "&longitude=" + longitude +
                    "&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m" +
                    "&hourly=temperature_2m,precipitation_probability,rain" +
                    "&forecast_days=2" +
                    "&timezone=auto";

            String body = fetchUrl(url);
            JsonNode json = objectMapper.readTree(body);

            Map<String, Object> result = new HashMap<>();

            // Current conditions
            if (json.has("current")) {
                JsonNode c = json.get("current");
                result.put("temperature", c.path("temperature_2m").asDouble());
                result.put("humidity", c.path("relative_humidity_2m").asInt());
                result.put("precipitation", c.path("precipitation").asDouble());
                result.put("rain", c.path("rain").asDouble());
                int code = c.path("weather_code").asInt();
                result.put("weatherCode", code);
                result.put("weatherDescription", weatherCodeToDescription(code));
                result.put("weatherIcon", weatherCodeToIcon(code));
                result.put("windSpeed", c.path("wind_speed_10m").asDouble());
            }

            // Rain probability for next 6 hours
            if (json.has("hourly")) {
                JsonNode h = json.get("hourly");
                JsonNode precipProb = h.path("precipitation_probability");
                int maxRainProb = 0;
                double totalRain = 0;
                int count = Math.min(precipProb.size(), 6);
                for (int i = 0; i < count; i++) {
                    int prob = precipProb.get(i).asInt();
                    if (prob > maxRainProb) maxRainProb = prob;
                    totalRain += h.path("rain").get(i).asDouble();
                }
                result.put("rainProbabilityNext6h", maxRainProb);
                result.put("totalRainNext6h", Math.round(totalRain * 10.0) / 10.0);

                // Next 24h temperature range
                JsonNode temps = h.path("temperature_2m");
                double minTemp = Double.MAX_VALUE, maxTemp = Double.MIN_VALUE;
                int tempCount = Math.min(temps.size(), 24);
                for (int i = 0; i < tempCount; i++) {
                    double t = temps.get(i).asDouble();
                    if (t < minTemp) minTemp = t;
                    if (t > maxTemp) maxTemp = t;
                }
                result.put("tempMin24h", Math.round(minTemp * 10.0) / 10.0);
                result.put("tempMax24h", Math.round(maxTemp * 10.0) / 10.0);
            }

            result.put("location", "Colombo, Sri Lanka");
            result.put("timestamp", java.time.Instant.now().toString());

            cache.put(cacheKey, new CachedResponse(result, System.currentTimeMillis()));
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Failed to fetch weather summary: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    private String fetchUrl(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(10))
                .GET()
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 200 && response.statusCode() < 300) {
            return response.body();
        }
        throw new RuntimeException("HTTP " + response.statusCode());
    }

    /**
     * Convert WMO weather code to human-readable description.
     */
    private String weatherCodeToDescription(int code) {
        return switch (code) {
            case 0 -> "Clear sky";
            case 1 -> "Mainly clear";
            case 2 -> "Partly cloudy";
            case 3 -> "Overcast";
            case 45, 48 -> "Foggy";
            case 51 -> "Light drizzle";
            case 53 -> "Moderate drizzle";
            case 55 -> "Dense drizzle";
            case 61 -> "Slight rain";
            case 63 -> "Moderate rain";
            case 65 -> "Heavy rain";
            case 71 -> "Slight snow";
            case 73 -> "Moderate snow";
            case 75 -> "Heavy snow";
            case 80 -> "Slight rain showers";
            case 81 -> "Moderate rain showers";
            case 82 -> "Violent rain showers";
            case 85 -> "Slight snow showers";
            case 86 -> "Heavy snow showers";
            case 95 -> "Thunderstorm";
            case 96, 99 -> "Thunderstorm with hail";
            default -> "Unknown (" + code + ")";
        };
    }

    /**
     * Convert WMO weather code to emoji icon.
     */
    private String weatherCodeToIcon(int code) {
        return switch (code) {
            case 0 -> "☀️";
            case 1 -> "🌤️";
            case 2 -> "⛅";
            case 3 -> "☁️";
            case 45, 48 -> "🌫️";
            case 51, 53, 55 -> "🌦️";
            case 61, 63, 65, 80, 81, 82 -> "🌧️";
            case 71, 73, 75, 85, 86 -> "❄️";
            case 95, 96, 99 -> "⛈️";
            default -> "🌡️";
        };
    }
}
