# Raspberry Pi LiveKit Camera Publisher - Setup Guide

## Overview

This guide sets up your Raspberry Pi to **publish its live camera feed** (with YOLOv8 fish detection overlays) to your self-hosted **LiveKit server** on the VPS. The feed will be available from **any network**.

### Your Current Setup
- Pi at `192.168.8.101:5000` runs Flask/Socket.IO with YOLOv8 fish detection
- Only accessible from **local network**
- The **LiveKit Bridge** connects to your existing server and re-publishes to LiveKit on VPS

### Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”          â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   Raspberry Pi (192.168.8.101)   â”‚          â”‚   VPS (187.77.189.5)                 â”‚
â”‚                                  â”‚          â”‚                                      â”‚
â”‚   USB Camera / Pi Cam            â”‚          â”‚   LiveKit Server                     â”‚
â”‚          â”‚                       â”‚          â”‚   livekit.koifish-livekit-9ae13d-    â”‚
â”‚          â–¼                       â”‚   WSS    â”‚   187-77-189-5.traefik.me            â”‚
â”‚   Flask + YOLOv8 (:5000)        â”‚          â”‚                                      â”‚
â”‚   (fish detection overlays)      â”‚          â”‚   EMQX (MQTT)                        â”‚
â”‚          â”‚ Socket.IO             â”‚          â”‚   Spring Boot Backend                â”‚
â”‚          â–¼                       â”‚          â”‚                                      â”‚
â”‚   livekit_bridge.py â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶   â”‚   LiveKit Room: boat-navigation      â”‚
â”‚   (reads frames, publishes       â”‚          â”‚                                      â”‚
â”‚    to LiveKit with detections)   â”‚          â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                          â”‚
                                                    WebRTC (WSS Subscribe)
                                                              â”‚
                                        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                        â”‚                     â”‚                    â”‚
                               â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”
                               â”‚ localhost:5173  â”‚  â”‚ VPS Dashboard  â”‚   â”‚ Mobile/Any    â”‚
                               â”‚ (Your Dev PC)  â”‚  â”‚ (Production)   â”‚   â”‚ Browser       â”‚
                               â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Two Scripts Available

| Script | Purpose |
|--------|---------|
| **`livekit_bridge.py`** (Recommended) | Connects to your existing Flask/SocketIO server, preserves YOLOv8 fish detection overlays |
| **`camera_publisher.py`** | Direct camera â†’ LiveKit (no fish detection, use if Flask server isn't running) |

---

## Prerequisites

- Raspberry Pi 3B+, 4, or 5 (with Raspberry Pi OS)
- USB Webcam or Raspberry Pi Camera Module (CSI)
- Internet connection (WiFi or Ethernet)
- Python 3.9+

---

## Step 1: System Setup

### Update the Pi

```bash
sudo apt update && sudo apt upgrade -y
```

### Install system dependencies

```bash
# Video/camera support
sudo apt install -y python3-pip python3-venv libcamera-apps v4l-utils

# If using Pi Camera Module (CSI)
sudo apt install -y python3-picamera2

# Build tools for native packages
sudo apt install -y build-essential cmake pkg-config
sudo apt install -y libjpeg-dev libtiff-dev libpng-dev
sudo apt install -y libavcodec-dev libavformat-dev libswscale-dev
```

### Verify camera is detected

```bash
# For USB webcam
ls /dev/video*
# Should show /dev/video0

# For Pi Camera Module
libcamera-hello --list-cameras

# Test video capture
v4l2-ctl --device=/dev/video0 --all
```

---

## Step 2: Python Environment

### Create virtual environment

```bash
mkdir -p ~/livekit-camera
cd ~/livekit-camera
python3 -m venv venv
source venv/bin/activate
```

### Install Python packages

```bash
pip install --upgrade pip
pip install livekit livekit-api python-socketio[client] Pillow opencv-python-headless
```

> **Note:** `python-socketio[client]` is needed for the bridge to connect to your Flask server.
> We use `opencv-python-headless` (no GUI) since the Pi runs headless.

If `opencv-python-headless` has issues on Pi, use the system package:

```bash
sudo apt install -y python3-opencv
# Then in your venv:
pip install livekit livekit-api
```

---

## Step 3: LiveKit Bridge Script (Recommended)

The bridge connects to your **existing** Flask/Socket.IO camera server (`192.168.8.101:5000`) and re-publishes the processed frames (with YOLOv8 fish detection overlays) to LiveKit.

### Copy from this repo

```bash
# From your dev machine (Windows), copy the scripts to the Pi:
scp raspberry-pi/livekit_bridge.py koi@192.168.8.101:~/livekit-camera/
scp raspberry-pi/camera_publisher.py koi@192.168.8.101:~/livekit-camera/
scp raspberry-pi/livekit-camera.service koi@192.168.8.101:~/livekit-camera/
```

Or create the file manually on the Pi:

### Create the bridge script

```bash
nano ~/livekit-camera/livekit_bridge.py
```

Paste the contents of `raspberry-pi/livekit_bridge.py` from this repo.

The bridge does:
1. Connects to `http://192.168.8.101:5000` via Socket.IO
2. Receives processed frames (with fish detection bounding boxes)
3. Converts them to RGBA format
4. Publishes to LiveKit room `boat-navigation` on VPS

### How it works

```
Pi Flask Server (:5000)          livekit_bridge.py              LiveKit (VPS)
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”            â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Camera            â”‚ Socket.IO  â”‚ Receive      â”‚  WebRTC      â”‚ Room:       â”‚
â”‚ YOLOv8 Detection â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶â”‚ JPEG frames  â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶â”‚ boat-nav    â”‚
â”‚ Health Analysis   â”‚            â”‚ Convert RGBA â”‚              â”‚             â”‚
â”‚ Bounding Boxes    â”‚            â”‚ Publish      â”‚              â”‚ â†’ Viewers   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜            â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

> **Full source code**: See [`raspberry-pi/livekit_bridge.py`](raspberry-pi/livekit_bridge.py) in this repo.
> **Alternative (no fish detection)**: See [`raspberry-pi/camera_publisher.py`](raspberry-pi/camera_publisher.py) for direct camera feed.

---

## Step 4: Configuration

### Option A: Edit the script directly

Open `camera_publisher.py` and change the values at the top:

```python
LIVEKIT_URL = "wss://livekit.koifish-livekit-9ae13d-187-77-189-5.traefik.me"
API_KEY = "APIhfro22ogg9c3"
API_SECRET = "5ejwe0usuxnlknv5afgtsyfvsgmukb1pedprwwqaxilc"
ROOM_NAME = "boat-navigation"
```

### Option B: Use environment variables (recommended for production)

Create a `.env` file:

```bash
nano ~/livekit-camera/.env
```

```bash
LIVEKIT_URL=wss://livekit.koifish-livekit-9ae13d-187-77-189-5.traefik.me
LIVEKIT_API_KEY=APIhfro22ogg9c3
LIVEKIT_API_SECRET=5ejwe0usuxnlknv5afgtsyfvsgmukb1pedprwwqaxilc
LIVEKIT_ROOM=boat-navigation
LIVEKIT_IDENTITY=boat-camera-pi
LIVEKIT_NAME=Boat Camera (RPi)
```

Then run with:

```bash
cd ~/livekit-camera
source venv/bin/activate
set -a && source .env && set +a
python3 camera_publisher.py
```

### Option C: Fetch token from backend instead

If you prefer not to store API secrets on the Pi, the script can fetch a token from your backend:

```python
# Replace the token generation section with:
import requests
BACKEND_URL = "https://koifish-backend-tqteaf-bae886-187-77-189-5.traefik.me"
response = requests.get(f"{BACKEND_URL}/api/livekit/publisher-token?identity=boat-camera-pi")
jwt_token = response.json()["token"]
```

---

## Step 5: Test Run

```bash
cd ~/livekit-camera
source venv/bin/activate

# Test with default settings (640x480 @ 15fps)
python3 camera_publisher.py

# Test with custom settings
python3 camera_publisher.py --camera 0 --width 1280 --height 720 --fps 10

# Lower resolution for slow networks
python3 camera_publisher.py --width 480 --height 360 --fps 10
```

### Expected output:

```
==================================================
ðŸŸ Koi Fish LiveKit Camera Publisher
==================================================
LiveKit URL:  wss://livekit.koifish-livekit-9ae13d-187-77-189-5.traefik.me
Room:         boat-navigation
Identity:     boat-camera-pi
Camera:       /dev/video0
Resolution:   640x480
Target FPS:   15
==================================================
Connection attempt #1...
Generating token for room: boat-navigation
Connecting to LiveKit: wss://livekit.koifish-livekit-...
âœ… Connected to LiveKit room: boat-navigation
ðŸ“· Camera opened: 640x480 @ 15.0fps
âœ… Video track published (SID: TR_xxx)
ðŸŽ¬ Streaming at target 15 FPS...
Press Ctrl+C to stop
--------------------------------------------------
ðŸ“¡ Frames: 150 | FPS: 14.8 | Uptime: 10s | Time: 14:30:25
ðŸ“¡ Frames: 300 | FPS: 15.0 | Uptime: 20s | Time: 14:30:35
```

---

## Step 6: Run as Systemd Service (Auto-Start on Boot)

### Create the service file

```bash
sudo nano /etc/systemd/system/livekit-camera.service
```

```ini
[Unit]
Description=LiveKit Camera Publisher for Koi Fish Monitoring
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/livekit-camera
EnvironmentFile=/home/pi/livekit-camera/.env
ExecStart=/home/pi/livekit-camera/venv/bin/python3 /home/pi/livekit-camera/camera_publisher.py --fps 15 --width 640 --height 480
Restart=always
RestartSec=10

# Logging
StandardOutput=journal
StandardError=journal

# Resource limits
MemoryMax=512M
CPUQuota=80%

[Install]
WantedBy=multi-user.target
```

### Enable and start

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable livekit-camera

# Start now
sudo systemctl start livekit-camera

# Check status
sudo systemctl status livekit-camera

# View logs
journalctl -u livekit-camera -f
```

### Management commands

```bash
# Stop the camera
sudo systemctl stop livekit-camera

# Restart (e.g., after config change)
sudo systemctl restart livekit-camera

# Disable auto-start
sudo systemctl disable livekit-camera

# View last 50 log lines
journalctl -u livekit-camera -n 50 --no-pager
```

---

## Step 7: Verify From Dashboard

1. Make sure the Pi is running `camera_publisher.py`
2. Open your dashboard: `http://localhost:5173/dashboard/boat-navigation`
3. Or the VPS dashboard: `https://your-frontend-domain/dashboard/boat-navigation`
4. You should see the **LIVE** camera feed with the WebRTC connection status

---

## Troubleshooting

### Camera not found

```bash
# List all video devices
ls -la /dev/video*
v4l2-ctl --list-devices

# For Pi Camera Module, enable in config
sudo raspi-config
# â†’ Interface Options â†’ Camera â†’ Enable
sudo reboot

# Test camera manually
python3 -c "import cv2; cap = cv2.VideoCapture(0); print('Opened:', cap.isOpened()); cap.release()"
```

### LiveKit connection fails

```bash
# Check internet connectivity
ping -c 3 google.com

# Check if LiveKit server is reachable
curl -s https://livekit.koifish-livekit-9ae13d-187-77-189-5.traefik.me
# Should return: OK

# Check DNS resolution
nslookup livekit.koifish-livekit-9ae13d-187-77-189-5.traefik.me

# Check if ports are open (from Pi to VPS)
nc -zv 187.77.189.5 7880 -w 5
```

### SSL certificate issues

```bash
# If you get SSL errors, update certificates
sudo apt install -y ca-certificates
sudo update-ca-certificates

# Or temporarily disable SSL verification (NOT for production)
# Add to camera_publisher.py:
# import ssl
# ssl._create_default_https_context = ssl._create_unverified_context
```

### Low FPS / High latency

```bash
# Reduce resolution and FPS
python3 camera_publisher.py --width 480 --height 360 --fps 10

# Check CPU usage
htop

# Check network speed
speedtest-cli

# Optimize Pi performance
# Add to /boot/config.txt:
gpu_mem=128
over_voltage=2
arm_freq=1800
```

### OpenCV installation issues on Pi

```bash
# If pip install opencv-python-headless fails:
sudo apt install -y python3-opencv

# Then create venv with system packages access:
python3 -m venv --system-site-packages venv
source venv/bin/activate
pip install livekit livekit-api
```

---

## Advanced: Using Pi Camera Module (CSI) Instead of USB

If you're using the Raspberry Pi Camera Module (not USB), use `picamera2`:

```python
# Replace the cv2.VideoCapture section with:
from picamera2 import Picamera2
import numpy as np

picam = Picamera2()
config = picam.create_video_configuration(
    main={"size": (640, 480), "format": "RGB888"}
)
picam.configure(config)
picam.start()

# In the frame loop:
frame = picam.capture_array()
frame_rgba = cv2.cvtColor(frame, cv2.COLOR_RGB2RGBA)
```

---

## Network Requirements

| Port | Protocol | Direction | Purpose |
|------|----------|-----------|---------|
| 7880 | TCP (WSS) | Pi â†’ VPS | LiveKit signaling |
| 7881 | TCP | Pi â†’ VPS | LiveKit RTC (TCP fallback) |
| 7882 | UDP | Pi â†” VPS | WebRTC media (preferred) |
| 3478 | UDP | Pi â†’ VPS | TURN server (NAT traversal) |
| 5349 | TCP | Pi â†’ VPS | TURN over TLS |

> **Note:** If your Pi is behind a strict NAT/firewall, the TURN server handles the relay automatically. No port forwarding needed on the Pi's router.

---

## Resource Usage (Raspberry Pi 4)

| Setting | CPU | RAM | Network |
|---------|-----|-----|---------|
| 480x360 @ 10fps | ~15% | ~120MB | ~0.5 Mbps |
| 640x480 @ 15fps | ~25% | ~150MB | ~1.0 Mbps |
| 1280x720 @ 15fps | ~45% | ~200MB | ~2.0 Mbps |
| 1920x1080 @ 10fps | ~60% | ~280MB | ~3.0 Mbps |

Recommended: **640x480 @ 15fps** for a good balance of quality and performance.
