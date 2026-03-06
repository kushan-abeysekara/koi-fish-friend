# Raspberry Pi LiveKit Camera Publisher - Setup Guide

## Overview

This guide sets up your Raspberry Pi to **publish a live camera feed** to your self-hosted **LiveKit server** on the VPS. The feed will be available from **any network** — your local network, VPS dashboard, or mobile browser.

### Architecture

```
┌─────────────────────────┐                    ┌─────────────────────────────────────┐
│   Raspberry Pi          │                    │   VPS (187.77.189.5)                │
│   (Your Local Network)  │                    │                                     │
│                         │   WebRTC (WSS)     │   LiveKit Server                    │
│   camera_publisher.py  ─┼───────────────────▶│   livekit.koifish-livekit-9ae13d-   │
│   USB Camera / Pi Cam   │                    │   187-77-189-5.traefik.me           │
│                         │                    │                                     │
└─────────────────────────┘                    │   EMQX (MQTT)                       │
                                               │   Spring Boot Backend               │
                                               └──────────────┬──────────────────────┘
                                                              │
                                                    WebRTC (WSS Subscribe)
                                                              │
                                        ┌─────────────────────┼────────────────────┐
                                        │                     │                    │
                               ┌────────▼───────┐  ┌─────────▼──────┐   ┌─────────▼─────┐
                               │ localhost:5173  │  │ VPS Dashboard  │   │ Mobile/Any    │
                               │ (Your Dev PC)  │  │ (Production)   │   │ Browser       │
                               └────────────────┘  └────────────────┘   └───────────────┘
```

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
pip install livekit livekit-api opencv-python-headless
```

> **Note:** We use `opencv-python-headless` (no GUI) since the Pi runs headless.

If `opencv-python-headless` has issues on Pi, use the system package:

```bash
sudo apt install -y python3-opencv
# Then in your venv:
pip install livekit livekit-api
```

---

## Step 3: Camera Publisher Script

### Create the publisher

```bash
nano ~/livekit-camera/camera_publisher.py
```

Paste the following:

```python
#!/usr/bin/env python3
"""
LiveKit Camera Publisher for Raspberry Pi
Streams camera feed to LiveKit server on VPS.
Works from any network (local WiFi, different network, behind NAT).

Usage:
    python3 camera_publisher.py
    python3 camera_publisher.py --camera 0 --fps 15 --width 640 --height 480

Environment Variables (override defaults):
    LIVEKIT_URL       - LiveKit server URL
    LIVEKIT_API_KEY   - API key
    LIVEKIT_API_SECRET - API secret
    CAMERA_INDEX      - Camera device index (default: 0)
"""

import asyncio
import cv2
import signal
import sys
import os
import argparse
import logging
import time
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("livekit-camera")

# ─────────────────────────────────────────
# Configuration (edit these or use env vars)
# ─────────────────────────────────────────
LIVEKIT_URL = os.getenv(
    "LIVEKIT_URL",
    "wss://livekit.koifish-livekit-9ae13d-187-77-189-5.traefik.me"
)
API_KEY = os.getenv("LIVEKIT_API_KEY", "APIhfro22ogg9c3")
API_SECRET = os.getenv(
    "LIVEKIT_API_SECRET",
    "5ejwe0usuxnlknv5afgtsyfvsgmukb1pedprwwqaxilc"
)

ROOM_NAME = os.getenv("LIVEKIT_ROOM", "boat-navigation")
PARTICIPANT_IDENTITY = os.getenv("LIVEKIT_IDENTITY", "boat-camera-pi")
PARTICIPANT_NAME = os.getenv("LIVEKIT_NAME", "Boat Camera (RPi)")

# Shutdown event
shutdown_event = asyncio.Event()


def signal_handler(sig, frame):
    logger.info("Received shutdown signal (%s)", signal.Signals(sig).name)
    shutdown_event.set()


async def open_camera(index: int, width: int, height: int, fps: int):
    """Open the camera with the given settings."""
    logger.info(f"Opening camera {index} ({width}x{height} @ {fps}fps)...")

    cap = cv2.VideoCapture(index)
    if not cap.isOpened():
        # Try alternative backends on Pi
        for backend in [cv2.CAP_V4L2, cv2.CAP_GSTREAMER]:
            cap = cv2.VideoCapture(index, backend)
            if cap.isOpened():
                logger.info(f"Opened with backend: {backend}")
                break

    if not cap.isOpened():
        logger.error(f"❌ Cannot open camera at index {index}")
        logger.error("Troubleshooting:")
        logger.error("  1. Check: ls /dev/video*")
        logger.error("  2. Try: v4l2-ctl --device=/dev/video0 --all")
        logger.error("  3. For Pi Camera: sudo raspi-config → Interface → Camera → Enable")
        return None

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    cap.set(cv2.CAP_PROP_FPS, fps)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Minimize latency

    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    actual_fps = cap.get(cv2.CAP_PROP_FPS)
    logger.info(f"📷 Camera opened: {actual_w}x{actual_h} @ {actual_fps}fps")

    return cap, actual_w, actual_h


async def publish_camera(camera_index: int, width: int, height: int, fps: int):
    """Connect to LiveKit and publish camera frames."""

    # Import LiveKit SDK
    from livekit import rtc
    from livekit.api import AccessToken, VideoGrants

    # ─── Generate Access Token ───
    logger.info(f"Generating token for room: {ROOM_NAME}")
    token = AccessToken(API_KEY, API_SECRET)
    token.with_identity(PARTICIPANT_IDENTITY)
    token.with_name(PARTICIPANT_NAME)
    token.with_grants(VideoGrants(
        room_join=True,
        room=ROOM_NAME,
        can_publish=True,
        can_subscribe=False,  # Camera only publishes
    ))
    jwt_token = token.to_jwt()

    # ─── Connect to LiveKit Room ───
    room = rtc.Room()
    logger.info(f"Connecting to LiveKit: {LIVEKIT_URL}")

    try:
        await room.connect(LIVEKIT_URL, jwt_token)
    except Exception as e:
        logger.error(f"❌ Failed to connect: {e}")
        logger.error("Check:")
        logger.error(f"  1. LiveKit server is running at {LIVEKIT_URL}")
        logger.error("  2. SSL certificates are valid (HTTPS)")
        logger.error("  3. API key/secret match the server config")
        logger.error("  4. Pi has internet access: ping google.com")
        return

    logger.info(f"✅ Connected to LiveKit room: {ROOM_NAME}")

    # ─── Open Camera ───
    result = await open_camera(camera_index, width, height, fps)
    if result is None:
        await room.disconnect()
        return

    cap, actual_w, actual_h = result

    # ─── Create and Publish Video Track ───
    source = rtc.VideoSource(actual_w, actual_h)
    track = rtc.LocalVideoTrack.create_video_track("boat-cam", source)

    options = rtc.TrackPublishOptions()
    options.source = rtc.TrackSource.SOURCE_CAMERA
    publication = await room.local_participant.publish_track(track, options)
    logger.info(f"✅ Video track published (SID: {publication.sid})")

    # ─── Frame Publishing Loop ───
    frame_interval = 1.0 / fps
    frame_count = 0
    start_time = time.time()
    fps_counter = 0
    fps_timer = time.time()

    logger.info(f"🎬 Streaming at target {fps} FPS...")
    logger.info("Press Ctrl+C to stop")
    logger.info("-" * 50)

    while not shutdown_event.is_set():
        ret, frame = cap.read()
        if not ret:
            logger.warning("Failed to read frame, skipping...")
            await asyncio.sleep(0.05)
            continue

        # Convert BGR (OpenCV) → RGBA (LiveKit)
        frame_rgba = cv2.cvtColor(frame, cv2.COLOR_BGR2RGBA)

        # Create and publish LiveKit video frame
        video_frame = rtc.VideoFrame(
            actual_w,
            actual_h,
            rtc.VideoBufferType.RGBA,
            frame_rgba.tobytes()
        )
        source.capture_frame(video_frame)

        frame_count += 1
        fps_counter += 1

        # Calculate and log actual FPS every 10 seconds
        now = time.time()
        if now - fps_timer >= 10.0:
            actual_fps = fps_counter / (now - fps_timer)
            elapsed = now - start_time
            logger.info(
                f"📡 Frames: {frame_count} | "
                f"FPS: {actual_fps:.1f} | "
                f"Uptime: {int(elapsed)}s | "
                f"Time: {datetime.now().strftime('%H:%M:%S')}"
            )
            fps_counter = 0
            fps_timer = now

        await asyncio.sleep(frame_interval)

    # ─── Cleanup ───
    logger.info("Shutting down camera...")
    cap.release()
    await room.disconnect()
    total_time = time.time() - start_time
    logger.info(f"✅ Done. Published {frame_count} frames in {total_time:.0f}s")


async def main(args):
    """Main entry with automatic reconnection."""
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    logger.info("=" * 50)
    logger.info("🐟 Koi Fish LiveKit Camera Publisher")
    logger.info("=" * 50)
    logger.info(f"LiveKit URL:  {LIVEKIT_URL}")
    logger.info(f"Room:         {ROOM_NAME}")
    logger.info(f"Identity:     {PARTICIPANT_IDENTITY}")
    logger.info(f"Camera:       /dev/video{args.camera}")
    logger.info(f"Resolution:   {args.width}x{args.height}")
    logger.info(f"Target FPS:   {args.fps}")
    logger.info("=" * 50)

    attempt = 0
    while not shutdown_event.is_set():
        attempt += 1
        logger.info(f"Connection attempt #{attempt}...")

        try:
            await publish_camera(args.camera, args.width, args.height, args.fps)
        except Exception as e:
            logger.error(f"Unexpected error: {e}")

        if not shutdown_event.is_set():
            wait_time = min(5 * attempt, 30)  # Back off up to 30s
            logger.info(f"Reconnecting in {wait_time}s...")
            await asyncio.sleep(wait_time)
            # Reset attempt counter after successful reconnect
            if attempt > 5:
                attempt = 0

    logger.info("👋 Camera publisher stopped")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LiveKit Camera Publisher for Raspberry Pi")
    parser.add_argument("--camera", type=int, default=0, help="Camera device index (default: 0)")
    parser.add_argument("--width", type=int, default=640, help="Frame width (default: 640)")
    parser.add_argument("--height", type=int, default=480, help="Frame height (default: 480)")
    parser.add_argument("--fps", type=int, default=15, help="Target FPS (default: 15)")
    args = parser.parse_args()

    asyncio.run(main(args))
```

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
🐟 Koi Fish LiveKit Camera Publisher
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
✅ Connected to LiveKit room: boat-navigation
📷 Camera opened: 640x480 @ 15.0fps
✅ Video track published (SID: TR_xxx)
🎬 Streaming at target 15 FPS...
Press Ctrl+C to stop
--------------------------------------------------
📡 Frames: 150 | FPS: 14.8 | Uptime: 10s | Time: 14:30:25
📡 Frames: 300 | FPS: 15.0 | Uptime: 20s | Time: 14:30:35
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
# → Interface Options → Camera → Enable
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
| 7880 | TCP (WSS) | Pi → VPS | LiveKit signaling |
| 7881 | TCP | Pi → VPS | LiveKit RTC (TCP fallback) |
| 7882 | UDP | Pi ↔ VPS | WebRTC media (preferred) |
| 3478 | UDP | Pi → VPS | TURN server (NAT traversal) |
| 5349 | TCP | Pi → VPS | TURN over TLS |

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
