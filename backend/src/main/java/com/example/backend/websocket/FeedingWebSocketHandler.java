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
 * WebSocket handler that broadcasts MQTT feeding device messages
 * to all connected browser clients in real-time.
 *
 * Browser connects to /ws/feeding → receives raw MQTT JSON payloads
 * from the feeding device every ~2 seconds (ESP32 heartbeat).
 */
@Component
public class FeedingWebSocketHandler extends TextWebSocketHandler {

    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
        System.out.println("[WS] Client connected: " + session.getId() + " (total: " + sessions.size() + ")");
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
        System.out.println("[WS] Client disconnected: " + session.getId() + " (total: " + sessions.size() + ")");
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        sessions.remove(session);
        System.err.println("[WS] Transport error for session " + session.getId() + ": " + exception.getMessage());
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
                System.err.println("[WS] Failed to send to " + session.getId() + ", removing session");
                sessions.remove(session);
            }
        }
    }

    public int getConnectedClients() {
        return sessions.size();
    }
}
