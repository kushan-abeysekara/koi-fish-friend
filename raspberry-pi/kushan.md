You are building a full-stack smart fish farm monitoring system.

Tech stack:
- Backend: Spring Boot (Java)
- Frontend: React
- Realtime Video: LiveKit (self-hosted)
- Database: Supabase (PostgreSQL)
- AI Predictions: Flowise (self-hosted LLM)
- Devices: ESP32 (camera + sensors)

========================================
🌐 SERVER ENDPOINTS
========================================

LiveKit WebSocket URL:
wss://livekit.koifishfriend.online

LiveKit RTMP Ingest:
rtmp://livekit.koifishfriend.online:1935/x

LiveKit WHIP Ingest:
https://livekit.koifishfriend.online/w

Flowise AI API:
http://187.77.189.5:3000/api/v1/prediction/YOUR_CHATFLOW_ID

Weather API (Free):
https://api.open-meteo.com/v1/forecast?latitude=6.9271&longitude=79.8612&hourly=temperature_2m,precipitation

========================================
🔐 LIVEKIT AUTH
========================================

LIVEKIT_API_KEY = APIhfro22ogg9c3
LIVEKIT_API_SECRET = 5ejwe0usuxnlknv5afgtsyfvsgmukb1pedprwwqaxilc

========================================
🗄️ SUPABASE DATABASE
========================================

NEXT_PUBLIC_SUPABASE_URL = http://superbase.koifishfriend.online
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Database Tables:

feeddb:
- id
- weight (float)
- device_id (text)
- tank_level (float)
- tank_capacity (float)
- tank_percentage (float)
- motor_status (text)
- motor_runtime (int)
- created_at (timestamp)

feeding_history
manual_feedings
weight_history

========================================
🤖 SYSTEM FEATURES TO IMPLEMENT
========================================

1. SPRING BOOT BACKEND
   - REST API to receive ESP32 sensor data
   - Save data into Supabase PostgreSQL
   - Endpoint to fetch latest tank data
   - Endpoint to generate LiveKit access token
   - Endpoint to request AI predictions from Flowise

2. REACT FRONTEND
   - Live video player using LiveKit WebRTC
   - Dashboard showing:
     • Tank level %
     • Weight
     • Motor status
     • Motor runtime
   - Charts for:
     • Feeding history
     • Weight history
     • Tank level history
   - AI Prediction panel
   - Weather forecast widget

3. LIVE VIDEO
   - Connect to LiveKit using WebSocket URL
   - Join room with server-generated token
   - Display live stream

4. AI PREDICTIONS (Flowise)
   Send feeding + tank data and get:
   - Next feeding time
   - Feed amount required
   - Tank empty estimate
   - Abnormal behavior detection

5. WEATHER FORECAST
   Fetch from Open-Meteo API and show:
   - Temperature
   - Rain probability

6. ESP32 DEVICE API FORMAT
   JSON POST to backend:

   {
     "weight": 138,
     "deviceId": "feed_device_001",
     "tankLevel": 1500,
     "tankCapacity": 20000,
     "tankPercentage": 7.5,
     "motorStatus": "RUNNING",
     "motorRuntime": 300
   }

========================================
🎯 WHAT TO GENERATE
========================================

Generate:

• Spring Boot:
  - Entity models
  - JPA repositories
  - Controllers
  - Services
  - LiveKit token generator
  - Flowise API client

• React:
  - Live video component
  - Dashboard UI
  - Charts
  - API hooks
  - AI prediction panel
  - Weather widget

• Axios API service layer

• Clean production-ready structure

========================================
Return complete working code.