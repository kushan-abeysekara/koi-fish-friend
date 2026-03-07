# Raspberry Pi MediaMTX Camera Streamer Setup Guide

## Overview

This guide sets up your Raspberry Pi to stream live camera feed (with YOLOv8 fish detection) to the MediaMTX server on your VPS, making it accessible from anywhere via the frontend dashboard.

### Architecture

```
Pi Camera → Flask/Socket.IO (port 5000) → mediamtx_streamer.py → ffmpeg (RTMP) → MediaMTX (VPS)
                  ↑                                                                    ↓
           YOLOv8 Fish Detection                                                HLS → Frontend
           (6 health classes)                                              (Any network/device)
```

### System Details

| Component | Value |
|-----------|-------|
| **Pi IP** | `192.168.8.101` |
| **Pi User** | `koi` |
| **Flask Camera Server** | `http://192.168.8.101:5000` (YOLOv8 + Socket.IO) |
| **VPS IP** | `187.77.189.5` |
| **MediaMTX RTMP** | `rtmp://187.77.189.5:1935/live/camera` |
| **MediaMTX HLS** | `https://mediamtx.koifishfriend.online/live/camera/index.m3u8` |
| **Stream** | 640×360 @ 15fps, H.264, 800kbps |

---

## Prerequisites

1. **MediaMTX must be running on your VPS** (Dokploy compose with `bluenviron/mediamtx:latest`)
2. **VPS port 1935 (RTMP) must be exposed** — check your Dokploy docker-compose has `1935:1935`
3. Your existing **Flask camera server** (with YOLOv8 fish detection) should be running on the Pi at port 5000

---

## Step-by-Step Setup

### 1. SSH into your Raspberry Pi

```bash
ssh koi@192.168.8.101
```

### 2. Install System Dependencies

```bash
sudo apt update
sudo apt install -y python3-pip python3-venv python3-opencv ffmpeg
```

Verify ffmpeg is installed:
```bash
ffmpeg -version
```

### 3. Create Project Directory

```bash
mkdir -p ~/mediamtx-camera
cd ~/mediamtx-camera
```

### 4. Create Python Virtual Environment

```bash
python3 -m venv --system-site-packages venv
source venv/bin/activate
```

### 5. Install Python Packages

```bash
pip install --upgrade pip
pip install python-socketio[client] opencv-python-headless Pillow numpy
```

### 6. Create the Streamer Script

Create `~/mediamtx-camera/mediamtx_streamer.py` with the following content. You can also copy this directly from the `raspberry-pi/` folder in the project repo.

```bash
# Option A: If you have the repo cloned on the Pi
cp /path/to/koi-fish-friendn/raspberry-pi/mediamtx_streamer.py ~/mediamtx-camera/

# Option B: SCP from your computer
# Run this FROM your Windows PC (PowerShell):
scp "d:\GITHUB\koi-fish-friendn\raspberry-pi\mediamtx_streamer.py" koi@192.168.8.101:~/mediamtx-camera/
scp "d:\GITHUB\koi-fish-friendn\raspberry-pi\mediamtx-camera.service" koi@192.168.8.101:~/mediamtx-camera/
```

### 7. Create Environment Config (Optional)

```bash
cat > ~/mediamtx-camera/.env << 'EOF'
RTMP_URL=rtmp://187.77.189.5:1935/live/camera
PI_CAMERA_URL=http://192.168.8.101:5000
STREAM_WIDTH=640
STREAM_HEIGHT=360
STREAM_FPS=15
EOF
```

> The script uses these environment variables with sensible defaults, so the `.env` file is optional.

### 8. Test Manually First

**Important:** Make sure your Flask camera server (YOLOv8) is running first on port 5000.

```bash
cd ~/mediamtx-camera
source venv/bin/activate
python3 mediamtx_streamer.py
```

You should see output like:
```
==================================================
🐟 Koi Fish MediaMTX Camera Streamer
==================================================
RTMP Target:  rtmp://187.77.189.5:1935/live/camera
Resolution:   640x360 @ 15fps
Mode:         FLASK BRIDGE (YOLOv8)
Flask URL:    http://192.168.8.101:5000
🔌 Connecting to Flask camera: http://192.168.8.101:5000
✅ Connected to Flask camera server: http://192.168.8.101:5000
Starting ffmpeg → rtmp://187.77.189.5:1935/live/camera
📊 Streamed 150 frames (14.8 fps)
```

**Verify in browser:** Open `https://mediamtx.koifishfriend.online/live/camera/index.m3u8` — you should see the HLS stream. Or check your dashboard at the Boat Navigation page.

Press `Ctrl+C` to stop the manual test.

#### Direct Camera Mode (No YOLOv8)

If you want to stream directly from the camera without fish detection (lower CPU, lower latency):
```bash
python3 mediamtx_streamer.py --direct
```

### 9. Install as Systemd Service (Auto-Start on Boot)

```bash
# Copy the service file
sudo cp ~/mediamtx-camera/mediamtx-camera.service /etc/systemd/system/

# If you SCP'd it to home dir instead:
# sudo cp ~/mediamtx-camera/mediamtx-camera.service /etc/systemd/system/
```

Or create it manually:

```bash
sudo nano /etc/systemd/system/mediamtx-camera.service
```

Paste this content:

```ini
[Unit]
Description=Koi Fish MediaMTX Camera Streamer
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=koi
WorkingDirectory=/home/koi/mediamtx-camera
Environment=RTMP_URL=rtmp://187.77.189.5:1935/live/camera
Environment=PI_CAMERA_URL=http://192.168.8.101:5000
Environment=STREAM_WIDTH=640
Environment=STREAM_HEIGHT=360
Environment=STREAM_FPS=15
ExecStart=/home/koi/mediamtx-camera/venv/bin/python3 /home/koi/mediamtx-camera/mediamtx_streamer.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable mediamtx-camera
sudo systemctl start mediamtx-camera
```

### 10. Verify the Service

```bash
# Check status
sudo systemctl status mediamtx-camera

# View live logs
journalctl -u mediamtx-camera -f

# Check if ffmpeg is running
ps aux | grep ffmpeg
```

---

## Quick Setup Script (Alternative)

If you want a one-shot automated setup, copy all files to the Pi and run the setup script:

**From your Windows PC (PowerShell):**
```powershell
scp "d:\GITHUB\koi-fish-friendn\raspberry-pi\mediamtx_streamer.py" koi@192.168.8.101:~/
scp "d:\GITHUB\koi-fish-friendn\raspberry-pi\mediamtx-camera.service" koi@192.168.8.101:~/
scp "d:\GITHUB\koi-fish-friendn\raspberry-pi\mediamtx_setup.sh" koi@192.168.8.101:~/
```

**Then on the Pi:**
```bash
ssh koi@192.168.8.101
# Move files to where setup.sh expects them
mkdir -p ~/pi-scripts
mv ~/mediamtx_streamer.py ~/mediamtx-camera.service ~/mediamtx_setup.sh ~/pi-scripts/
cd ~/pi-scripts
chmod +x mediamtx_setup.sh
bash mediamtx_setup.sh
```

---

## Managing the Service

| Action | Command |
|--------|---------|
| Start streaming | `sudo systemctl start mediamtx-camera` |
| Stop streaming | `sudo systemctl stop mediamtx-camera` |
| Restart | `sudo systemctl restart mediamtx-camera` |
| Check status | `sudo systemctl status mediamtx-camera` |
| View logs | `journalctl -u mediamtx-camera -f` |
| Disable auto-start | `sudo systemctl disable mediamtx-camera` |

---

## Troubleshooting

### Stream not appearing in browser

1. **Check MediaMTX is running on VPS:**
   ```bash
   curl http://187.77.189.5:8888/v3/paths/list
   ```
   You should see `"items":[{"name":"live/camera",...}]` when the Pi is streaming.

2. **Check RTMP port 1935 is accessible from Pi:**
   ```bash
   nc -zv 187.77.189.5 1935
   ```
   Should say "Connection ... succeeded!" or "open".

3. **Check Pi service logs:**
   ```bash
   journalctl -u mediamtx-camera -n 50 --no-pager
   ```

### "Connection failed" to Flask server

- Make sure the Flask camera server is running:
  ```bash
  curl http://192.168.8.101:5000
  ```
- The streamer will keep retrying every 5 seconds automatically.

### ffmpeg pipe broken

- This is usually temporary — the streamer auto-restarts ffmpeg.
- If persistent, check that MediaMTX is running and RTMP port is open.

### High CPU usage

- Default is 640×360 @ 15fps @ 800kbps — this should be manageable on Pi 4.
- Reduce resolution/FPS if needed:
  ```bash
  python3 mediamtx_streamer.py --width 480 --height 270 --fps 10
  ```
- Or edit the Environment lines in the `.service` file.

### HLS latency is high (>10s)

The MediaMTX docker-compose on VPS should include low-latency HLS settings:
```yaml
environment:
  - MTX_HLSVARIANT=lowLatency
  - MTX_HLSALWAYSREMUX=yes
```

---

## Cleanup Old LiveKit Files (Optional)

If you previously had LiveKit installed on the Pi, you can remove the old files:

```bash
# Stop and remove old LiveKit service (if it exists)
sudo systemctl stop livekit-camera 2>/dev/null
sudo systemctl disable livekit-camera 2>/dev/null
sudo rm -f /etc/systemd/system/livekit-camera.service
sudo systemctl daemon-reload

# Remove old LiveKit scripts
rm -f ~/livekit-camera/livekit_bridge.py
rm -f ~/livekit-camera/camera_publisher.py
rm -rf ~/livekit-camera/

# Remove LiveKit Python packages from system
pip uninstall -y livekit livekit-api 2>/dev/null
```

---

## VPS Side: MediaMTX Docker Compose (Reference)

This should already be deployed on your Dokploy. For reference, the docker-compose:

```yaml
version: "3.8"
services:
  mediamtx:
    image: bluenviron/mediamtx:latest
    restart: unless-stopped
    ports:
      - "8888:8888"   # HLS (proxied by Traefik → mediamtx.koifishfriend.online)
      - "1935:1935"   # RTMP (Pi streams here)
      - "8554:8554"   # RTSP (optional)
    environment:
      - MTX_HLSVARIANT=lowLatency
      - MTX_HLSALWAYSREMUX=yes
      - MTX_PROTOCOLS=tcp
```

**Domain:** `mediamtx.koifishfriend.online` → port 8888 (HTTPS via Traefik/Let's Encrypt)

---

## Verification Checklist

- [ ] Flask camera server running on Pi (port 5000)
- [ ] MediaMTX container running on VPS (ports 1935, 8888)
- [ ] Pi can reach VPS RTMP: `nc -zv 187.77.189.5 1935`
- [ ] `mediamtx_streamer.py` runs successfully (manual test)
- [ ] Systemd service enabled and running
- [ ] HLS stream visible at `https://mediamtx.koifishfriend.online/live/camera/index.m3u8`
- [ ] Dashboard shows live camera feed on Boat Navigation page
