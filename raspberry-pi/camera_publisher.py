#!/usr/bin/env python3
"""
Direct LiveKit Camera Publisher for Raspberry Pi
Publishes raw camera feed to LiveKit (no fish detection).
Use livekit_bridge.py instead if you want YOLOv8 detection overlays.

Usage:
    pip install livekit livekit-api opencv-python-headless
    python3 camera_publisher.py
    python3 camera_publisher.py --camera 0 --fps 15 --width 640 --height 480
"""

import asyncio
import cv2
import signal
import os
import time
import argparse
import logging
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("livekit-camera")

# Configuration
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "wss://livekit.koifishfriend.online")
API_KEY = os.getenv("LIVEKIT_API_KEY", "APIhfro22ogg9c3")
API_SECRET = os.getenv("LIVEKIT_API_SECRET", "5ejwe0usuxnlknv5afgtsyfvsgmukb1pedprwwqaxilc")
ROOM_NAME = os.getenv("LIVEKIT_ROOM", "boat-navigation")
PARTICIPANT_IDENTITY = os.getenv("LIVEKIT_IDENTITY", "boat-camera-pi")
PARTICIPANT_NAME = os.getenv("LIVEKIT_NAME", "Boat Camera (RPi)")

shutdown_event = asyncio.Event()

def signal_handler(sig, frame):
    shutdown_event.set()

async def publish_camera(camera_index, width, height, fps):
    from livekit import rtc
    from livekit.api import AccessToken, VideoGrants

    token = AccessToken(API_KEY, API_SECRET)
    token.with_identity(PARTICIPANT_IDENTITY)
    token.with_name(PARTICIPANT_NAME)
    token.with_grants(VideoGrants(room_join=True, room=ROOM_NAME, can_publish=True, can_subscribe=False))
    jwt_token = token.to_jwt()

    room = rtc.Room()
    logger.info(f"Connecting to LiveKit: {LIVEKIT_URL}")
    try:
        await room.connect(LIVEKIT_URL, jwt_token)
    except Exception as e:
        logger.error(f"❌ Failed to connect: {e}")
        return

    logger.info(f"✅ Connected to room: {ROOM_NAME}")

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        for backend in [cv2.CAP_V4L2, cv2.CAP_GSTREAMER]:
            cap = cv2.VideoCapture(camera_index, backend)
            if cap.isOpened():
                break
    if not cap.isOpened():
        logger.error(f"❌ Cannot open camera {camera_index}")
        await room.disconnect()
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    cap.set(cv2.CAP_PROP_FPS, fps)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    logger.info(f"📷 Camera: {w}x{h}")

    source = rtc.VideoSource(w, h)
    track = rtc.LocalVideoTrack.create_video_track("boat-cam", source)
    opts = rtc.TrackPublishOptions()
    opts.source = rtc.TrackSource.SOURCE_CAMERA
    pub = await room.local_participant.publish_track(track, opts)
    logger.info(f"✅ Track published: {pub.sid}")

    interval = 1.0 / fps
    count = 0
    fps_counter = 0
    fps_timer = time.time()

    logger.info(f"🎬 Streaming at {fps} FPS. Ctrl+C to stop.")

    while not shutdown_event.is_set():
        ret, frame = cap.read()
        if not ret:
            await asyncio.sleep(0.05)
            continue

        rgba = cv2.cvtColor(frame, cv2.COLOR_BGR2RGBA)
        vf = rtc.VideoFrame(w, h, rtc.VideoBufferType.RGBA, rgba.tobytes())
        source.capture_frame(vf)

        count += 1
        fps_counter += 1
        now = time.time()
        if now - fps_timer >= 10.0:
            actual_fps = fps_counter / (now - fps_timer)
            logger.info(f"📡 Frames: {count} | FPS: {actual_fps:.1f} | Uptime: {int(now - fps_timer)}s")
            fps_counter = 0
            fps_timer = now

        await asyncio.sleep(interval)

    cap.release()
    await room.disconnect()

async def main(args):
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    logger.info("🐟 Koi Fish - Direct Camera Publisher")
    logger.info(f"LiveKit: {LIVEKIT_URL} | Room: {ROOM_NAME}")

    while not shutdown_event.is_set():
        try:
            await publish_camera(args.camera, args.width, args.height, args.fps)
        except Exception as e:
            logger.error(f"Error: {e}")
        if not shutdown_event.is_set():
            logger.info("Reconnecting in 5s...")
            await asyncio.sleep(5)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Direct LiveKit Camera Publisher")
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    parser.add_argument("--fps", type=int, default=15)
    asyncio.run(main(parser.parse_args()))
