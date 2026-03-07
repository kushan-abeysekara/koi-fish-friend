#!/usr/bin/env python3
"""
MediaMTX Camera Streamer for Raspberry Pi

Captures frames from the existing Flask/Socket.IO camera server
(with YOLOv8 fish detection overlays) and streams via RTMP to
MediaMTX running on the VPS.

Architecture:
  Pi Camera → Flask/SocketIO (local:5000) → This Script → ffmpeg (RTMP) → MediaMTX (VPS)
                  ↑                                                            ↓
           Fish Detection                                              HLS to Browsers
           (YOLOv8)                                                    (Any Network)

Alternative mode (--direct):
  Pi Camera → OpenCV → ffmpeg (RTMP) → MediaMTX (VPS)
  (No fish detection, lower latency)

Usage:
    # Stream from Flask camera server (with YOLOv8 overlays):
    python3 mediamtx_streamer.py

    # Stream directly from camera (no YOLOv8):
    python3 mediamtx_streamer.py --direct

    # Custom RTMP target:
    python3 mediamtx_streamer.py --rtmp-url rtmp://187.77.189.5:1935/live/camera

Requirements:
    pip install python-socketio[client] opencv-python-headless Pillow
    sudo apt install ffmpeg
"""

import subprocess
import threading
import signal
import sys
import os
import time
import argparse
import logging
import base64
import io
import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("mediamtx-streamer")

# ─── Configuration ───
VPS_IP = os.getenv("VPS_IP", "187.77.189.5")
RTMP_URL = os.getenv("RTMP_URL", f"rtmp://{VPS_IP}:1935/live/camera")
PI_CAMERA_URL = os.getenv("PI_CAMERA_URL", "http://192.168.8.101:5000")
STREAM_WIDTH = int(os.getenv("STREAM_WIDTH", "640"))
STREAM_HEIGHT = int(os.getenv("STREAM_HEIGHT", "360"))
STREAM_FPS = int(os.getenv("STREAM_FPS", "15"))

# Global state
running = True
ffmpeg_process = None
frame_count = 0
start_time = time.time()


def signal_handler(sig, frame):
    global running
    logger.info("Shutdown signal received...")
    running = False


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def start_ffmpeg(width, height, fps, rtmp_url):
    """Start ffmpeg process that accepts raw BGR frames on stdin and pushes RTMP."""
    cmd = [
        'ffmpeg',
        '-y',
        '-f', 'rawvideo',
        '-pix_fmt', 'bgr24',
        '-s', f'{width}x{height}',
        '-r', str(fps),
        '-i', '-',                          # Read from stdin
        '-c:v', 'libx264',
        '-preset', 'ultrafast',             # Low CPU usage on Pi
        '-tune', 'zerolatency',             # Minimize latency
        '-b:v', '800k',                     # Bitrate (good for 640x360)
        '-maxrate', '1000k',
        '-bufsize', '500k',
        '-g', str(fps * 2),                 # Keyframe every 2s
        '-pix_fmt', 'yuv420p',
        '-f', 'flv',
        rtmp_url
    ]
    logger.info(f"Starting ffmpeg → {rtmp_url}")
    logger.info(f"  Resolution: {width}x{height} @ {fps}fps")
    return subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE
    )


def stream_from_flask(rtmp_url, pi_url, width, height, fps):
    """
    Connect to the Flask/Socket.IO camera server and forward
    YOLOv8-annotated frames to ffmpeg → RTMP → MediaMTX.
    """
    global running, ffmpeg_process, frame_count

    try:
        import socketio
        from PIL import Image
    except ImportError:
        logger.error("Missing deps. Run: pip install python-socketio[client] Pillow")
        sys.exit(1)

    ffmpeg_process = start_ffmpeg(width, height, fps, rtmp_url)
    sio = socketio.Client(reconnection=True, reconnection_attempts=0,
                          reconnection_delay=2, reconnection_delay_max=10)
    connected = False

    @sio.event
    def connect():
        nonlocal connected
        connected = True
        logger.info(f"✅ Connected to Flask camera server: {pi_url}")

    @sio.event
    def disconnect():
        nonlocal connected
        connected = False
        logger.warning("⚠️  Disconnected from Flask camera server, will retry...")

    @sio.on('video_frame')
    def on_frame(data):
        global frame_count
        if not running or ffmpeg_process is None or ffmpeg_process.poll() is not None:
            return
        try:
            # Decode base64 JPEG from Flask
            if isinstance(data, dict) and 'frame' in data:
                img_b64 = data['frame']
            elif isinstance(data, str):
                img_b64 = data
            else:
                return

            if img_b64.startswith('data:image'):
                img_b64 = img_b64.split(',', 1)[1]

            img_bytes = base64.b64decode(img_b64)
            img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
            img = img.resize((width, height), Image.LANCZOS)

            # Convert to BGR numpy array for ffmpeg
            frame = np.array(img)[:, :, ::-1]  # RGB → BGR
            ffmpeg_process.stdin.write(frame.tobytes())
            frame_count += 1

            if frame_count % (fps * 10) == 0:
                elapsed = time.time() - start_time
                actual_fps = frame_count / elapsed if elapsed > 0 else 0
                logger.info(f"📊 Streamed {frame_count} frames ({actual_fps:.1f} fps)")

        except (BrokenPipeError, OSError):
            logger.error("ffmpeg pipe broken — restarting...")
            restart_ffmpeg(width, height, fps, rtmp_url)
        except Exception as e:
            logger.error(f"Frame error: {e}")

    def restart_ffmpeg(w, h, f, url):
        global ffmpeg_process
        if ffmpeg_process:
            try:
                ffmpeg_process.kill()
            except Exception:
                pass
        time.sleep(1)
        ffmpeg_process = start_ffmpeg(w, h, f, url)

    # Connect to Flask server
    while running:
        try:
            logger.info(f"🔌 Connecting to Flask camera: {pi_url}")
            sio.connect(pi_url, transports=['websocket', 'polling'],
                        wait_timeout=10)
            break
        except Exception as e:
            logger.warning(f"Connection failed: {e} — retrying in 5s")
            time.sleep(5)

    # Keep running
    try:
        while running:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        logger.info("Shutting down...")
        try:
            sio.disconnect()
        except Exception:
            pass
        if ffmpeg_process:
            ffmpeg_process.stdin.close()
            ffmpeg_process.wait(timeout=5)
        logger.info("Done.")


def stream_direct(rtmp_url, camera_index, width, height, fps):
    """
    Stream directly from Pi camera via OpenCV → ffmpeg → RTMP.
    No YOLOv8 detection (lower CPU, lower latency).
    """
    global running, ffmpeg_process, frame_count

    import cv2

    ffmpeg_process = start_ffmpeg(width, height, fps, rtmp_url)

    cap = cv2.VideoCapture(camera_index)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    cap.set(cv2.CAP_PROP_FPS, fps)

    if not cap.isOpened():
        logger.error(f"Cannot open camera {camera_index}")
        sys.exit(1)

    logger.info(f"✅ Camera opened: {camera_index} ({width}x{height} @ {fps}fps)")
    frame_delay = 1.0 / fps

    try:
        while running:
            ret, frame = cap.read()
            if not ret:
                logger.warning("Frame capture failed, retrying...")
                time.sleep(0.1)
                continue

            frame = cv2.resize(frame, (width, height))

            try:
                ffmpeg_process.stdin.write(frame.tobytes())
                frame_count += 1

                if frame_count % (fps * 30) == 0:
                    elapsed = time.time() - start_time
                    actual_fps = frame_count / elapsed if elapsed > 0 else 0
                    logger.info(f"📊 Streamed {frame_count} frames ({actual_fps:.1f} fps)")

            except (BrokenPipeError, OSError):
                logger.error("ffmpeg pipe broken — restarting...")
                if ffmpeg_process:
                    ffmpeg_process.kill()
                time.sleep(1)
                ffmpeg_process = start_ffmpeg(width, height, fps, rtmp_url)

            time.sleep(frame_delay)

    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        if ffmpeg_process:
            ffmpeg_process.stdin.close()
            ffmpeg_process.wait(timeout=5)
        logger.info("Done.")


def main():
    parser = argparse.ArgumentParser(description='MediaMTX Camera Streamer')
    parser.add_argument('--rtmp-url', default=RTMP_URL,
                        help=f'RTMP target URL (default: {RTMP_URL})')
    parser.add_argument('--pi-url', default=PI_CAMERA_URL,
                        help=f'Flask camera server URL (default: {PI_CAMERA_URL})')
    parser.add_argument('--direct', action='store_true',
                        help='Stream directly from camera (no YOLOv8)')
    parser.add_argument('--camera', type=int, default=0,
                        help='Camera index for direct mode (default: 0)')
    parser.add_argument('--width', type=int, default=STREAM_WIDTH,
                        help=f'Stream width (default: {STREAM_WIDTH})')
    parser.add_argument('--height', type=int, default=STREAM_HEIGHT,
                        help=f'Stream height (default: {STREAM_HEIGHT})')
    parser.add_argument('--fps', type=int, default=STREAM_FPS,
                        help=f'Stream FPS (default: {STREAM_FPS})')

    args = parser.parse_args()

    logger.info("=" * 50)
    logger.info("🐟 Koi Fish MediaMTX Camera Streamer")
    logger.info("=" * 50)
    logger.info(f"RTMP Target:  {args.rtmp_url}")
    logger.info(f"Resolution:   {args.width}x{args.height} @ {args.fps}fps")

    if args.direct:
        logger.info(f"Mode:         DIRECT (camera #{args.camera})")
        stream_direct(args.rtmp_url, args.camera, args.width, args.height, args.fps)
    else:
        logger.info(f"Mode:         FLASK BRIDGE (YOLOv8)")
        logger.info(f"Flask URL:    {args.pi_url}")
        stream_from_flask(args.rtmp_url, args.pi_url, args.width, args.height, args.fps)


if __name__ == '__main__':
    main()
