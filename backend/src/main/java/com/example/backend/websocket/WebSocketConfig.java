package com.example.backend.websocket;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * WebSocket configuration that exposes /ws/feeding endpoint.
 * Browser connects here to receive real-time MQTT data relayed
 * through the Spring Boot backend.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    @Autowired
    private FeedingWebSocketHandler feedingWebSocketHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(feedingWebSocketHandler, "/ws/feeding")
                .setAllowedOrigins("*");
    }
}
