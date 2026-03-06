# LiveKit Deployment Guide

## Overview

LiveKit is used to stream the Raspberry Pi camera feed (with YOLOv8 fish detection overlays) to the web dashboard from anywhere — not just the local network.

### Architecture

```
Raspberry Pi (192.168.8.101)
│
├── Flask/Socket.IO Server (port 5000)
│   └── YOLOv8 Fish Detection + Health Classification
│
├── LiveKit Bridge (livekit_bridge.py)
│   └── Receives processed frames via Socket.IO
│       Publishes to LiveKit via WebRTC
│
└───────────────── wss://livekit.koifishfriend.online ──────────────┐
                                                                     │
                   VPS (187.77.189.5)                                │
                   ├── LiveKit Server (port 7880)  ◄─────────────────┘
                   ├── Traefik Reverse Proxy (SSL via Let's Encrypt)
                   ├── Spring Boot Backend (/api/livekit/token)
                   └── React Frontend (LiveKitCameraFeed component)
                                    │
                                    ▼
                        Viewers (Any Device, Any Network)
```

---

## URLs & Credentials

| Service | URL |
|---------|-----|
| LiveKit Server | `wss://livekit.koifishfriend.online` |
| LiveKit Health Check | `https://livekit.koifishfriend.online` → returns `OK` |
| Backend API | `https://koifish-backend-tqteaf-bae886-187-77-189-5.traefik.me` |
| Frontend | Deployed via Dokploy |
| Pi Camera Server | `http://192.168.8.101:5000` (local only) |

| Credential | Value |
|------------|-------|
| API Key | `APIhfro22ogg9c3` |
| API Secret | `5ejwe0usuxnlknv5afgtsyfvsgmukb1pedprwwqaxilc` |
| Room Name | `boat-navigation` |

---

## Step 1: Push & Redeploy Frontend + Backend

```bash
git add -A
git commit -m "Switch LiveKit URL to livekit.koifishfriend.online"
git push
```

Then in **Dokploy** (`http://187.77.189.5:3000`):
1. Go to **Projects → KOIFISH → Frontend** → click **Deploy**
2. Go to **Projects → KOIFISH → Backend** → click **Deploy**

### Files Changed

| File | Change |
|------|--------|
| `frontend/.env` | `VITE_LIVEKIT_URL=wss://livekit.koifishfriend.online` |
| `frontend/src/components/LiveKitCameraFeed.tsx` | Updated fallback URL |
| `backend/src/main/resources/application.properties` | `livekit.url=wss://livekit.koifishfriend.online` |
| `backend/src/main/java/.../LiveKitController.java` | Updated default URL |
| `raspberry-pi/livekit_bridge.py` | Updated default URL |
| `raspberry-pi/camera_publisher.py` | Updated default URL |
| `raspberry-pi/setup.sh` | Updated default URL |

---

## Step 2: Verify SSL Certificate

Open in browser:
```
https://livekit.koifishfriend.online
```

- Should return **`OK`** with a **valid SSL certificate** (lock icon, no "Not Secure" warning)
- If still "Not Secure", DNS may still be propagating (wait 5-10 minutes)

### DNS Record

| Type | Name | Content | TTL |
|------|------|---------|-----|
| A | livekit | 187.77.189.5 | 14400 |

Configured at: Hostinger DNS (`hpanel.hostinger.com/domain/koifishfriend.online`)

---

## Step 3: Set Up Raspberry Pi

### SSH into the Pi

```bash
ssh koi@192.168.8.101
```

### Option A: If livekit_bridge.py is already deployed

Update the `.env` file:

```bash
cd ~/livekit-camera
nano .env
```

Set:
```bash
LIVEKIT_URL=wss://livekit.koifishfriend.online
LIVEKIT_API_KEY=APIhfro22ogg9c3
LIVEKIT_API_SECRET=5ejwe0usuxnlknv5afgtsyfvsgmukb1pedprwwqaxilc
PI_CAMERA_URL=http://192.168.8.101:5000
```

Restart:
```bash
sudo systemctl restart livekit-publisher.service
```

### Option B: Fresh setup

```bash
# Create directory
mkdir -p ~/livekit-camera && cd ~/livekit-camera

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install livekit livekit-api python-socketio[client] opencv-python-headless Pillow

# Create .env file
cat > .env << 'EOF'
LIVEKIT_URL=wss://livekit.koifishfriend.online
LIVEKIT_API_KEY=APIhfro22ogg9c3
LIVEKIT_API_SECRET=5ejwe0usuxnlknv5afgtsyfvsgmukb1pedprwwqaxilc
PI_CAMERA_URL=http://192.168.8.101:5000
LIVEKIT_ROOM=boat-navigation
LIVEKIT_IDENTITY=boat-camera-pi
LIVEKIT_NAME=Boat Camera (RPi + YOLOv8)
EOF

# Copy livekit_bridge.py from the repo (or SCP from your PC)
# Then run:
source .env && export LIVEKIT_URL LIVEKIT_API_KEY LIVEKIT_API_SECRET PI_CAMERA_URL LIVEKIT_ROOM LIVEKIT_IDENTITY LIVEKIT_NAME
python3 livekit_bridge.py
```

### Copy files via SCP (from your PC)

```bash
scp raspberry-pi/livekit_bridge.py koi@192.168.8.101:~/livekit-camera/
scp raspberry-pi/camera_publisher.py koi@192.168.8.101:~/livekit-camera/
scp raspberry-pi/livekit-camera.service koi@192.168.8.101:~/livekit-camera/
```

### Enable auto-start on boot

```bash
sudo cp ~/livekit-camera/livekit-camera.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable livekit-camera.service
sudo systemctl start livekit-camera.service
```

---

## Step 4: Verify the Stream

### Check Pi service status

```bash
sudo systemctl status livekit-publisher.service
sudo journalctl -u livekit-publisher.service -f
```

Expected output:
```
✅ Connected to Pi camera server: http://192.168.8.101:5000
✅ Connected to LiveKit room: boat-navigation
✅ Video track published (SID: TR_xxx)
🎬 Publishing to LiveKit at up to 15 FPS...
📡 Frames: 150 | FPS: 14.8 | Uptime: 10s | Pi: 🟢
```

### Check from dashboard

1. Open `http://localhost:5173/dashboard/boat-navigation` (dev) or your deployed frontend
2. The LiveKit camera feed should appear automatically
3. Status indicator shows connection state (Connecting → Connected)

### Test backend token endpoint

```bash
curl https://koifish-backend-tqteaf-bae886-187-77-189-5.traefik.me/api/livekit/token
```

Should return:
```json
{"token": "eyJ...", "url": "wss://livekit.koifishfriend.online"}
```

---

## Troubleshooting

### Stream not appearing in dashboard

1. **Check Pi is publishing**: `sudo journalctl -u livekit-publisher.service -f`
2. **Check Flask server is running**: `curl http://192.168.8.101:5000` (from Pi)
3. **Check backend token endpoint**: `curl .../api/livekit/token`
4. **Check browser console** for WebRTC errors

### SSL certificate issues

```bash
# Check if domain resolves
nslookup livekit.koifishfriend.online

# Check SSL cert
curl -vI https://livekit.koifishfriend.online 2>&1 | grep -i "ssl\|cert\|subject"

# If cert is still invalid, reload Traefik in Dokploy:
# Settings → Web Server → Traefik → Reload
```

### Pi can't connect to LiveKit

```bash
# Check internet
ping -c 3 google.com

# Check DNS resolution
nslookup livekit.koifishfriend.online

# Check LiveKit reachability
curl -s https://livekit.koifishfriend.online
# Should return: OK

# Check if Flask camera server is running
curl http://192.168.8.101:5000
```

### Service management

```bash
# View logs
sudo journalctl -u livekit-publisher.service -f

# Restart
sudo systemctl restart livekit-publisher.service

# Stop
sudo systemctl stop livekit-publisher.service

# Disable auto-start
sudo systemctl disable livekit-publisher.service
```

---

## Dokploy Domain Configuration

### LiveKit Service Domains

| Domain | Port | Purpose |
|--------|------|---------|
| `livekit.koifishfriend.online` | 7880 | Main LiveKit server (WebSocket + HTTP) |
| `livekit-whip.koifish-livekit-02ae4f-187-77-189-5.traefik.me` | 8080 | WHIP ingress |
| `livekit-turn.koifish-livekit-57c0a8-187-77-189-5.traefik.me` | 5349 | TURN server |

All domains have **HTTPS enabled** with **Let's Encrypt** certificates.

### SSL Configuration

- **Let's Encrypt Email**: `aks.abeysekara@gmail.com`
- **Server Domain**: `koifishfriend.online`
- **HTTPS**: Auto-provisioned via Traefik

---

## Component Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| `LiveKitCameraFeed.tsx` | Frontend | React component that subscribes to LiveKit room |
| `LiveKitController.java` | Backend | JWT token generation for viewers/publishers |
| `livekit_bridge.py` | Raspberry Pi | Bridges Flask/Socket.IO → LiveKit |
| `camera_publisher.py` | Raspberry Pi | Direct camera → LiveKit (no detection) |
| `livekit-camera.service` | Raspberry Pi | Systemd auto-start service |

### Backend Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/livekit/token` | GET | Viewer token (can subscribe, can't publish) |
| `/api/livekit/publisher-token` | GET | Publisher token (can publish, can't subscribe) |
| `/api/livekit/health` | GET | Health check |
