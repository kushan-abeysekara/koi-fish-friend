package com.example.backend.websocket;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket handler that broadcasts MQTT power management device messages
 * (both /status and /data topics from BM_ devices) to connected browser clients.
 *
 * Browser connects to /ws/power → receives raw MQTT JSON payloads in real-time.
 * Status messages  have: deviceId, status, relayState, controlMode, scheduleCount, ipAddress, rssi, energyWh
 * Data messages have: deviceId, voltage, current, power, energyWh, pondId
 */
@Component
public class PowerWebSocketHandler extends TextWebSocketHandler {

    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
        System.out.println("[PWR-WS] Client connected: " + session.getId() + " (total: " + sessions.size() + ")");
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
        System.out.println("[PWR-WS] Client disconnected: " + session.getId() + " (total: " + sessions.size() + ")");
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        sessions.remove(session);
        System.err.println("[PWR-WS] Transport error for session " + session.getId() + ": " + exception.getMessage());
    }

    /**
     * Broadcast a message (raw MQTT JSON payload) to all connected WebSocket clients.
     */
    public void broadcast(String message) {
        if (sessions.isEmpty()) return;

        TextMessage textMessage = new TextMessage(message);
        for (WebSocketSession session : sessions) {
            try {
                if (session.isOpen()) {
                    session.sendMessage(textMessage);
                }
            } catch (IOException e) {
                System.err.println("[PWR-WS] Failed to send to " + session.getId() + ", removing session");
                sessions.remove(session);
            }
        }
    }
}
