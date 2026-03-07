#!/bin/bash
# Quick setup script for MediaMTX Camera Streamer on Raspberry Pi
# Run this on your Pi via SSH:  bash mediamtx_setup.sh

set -e

echo "============================================="
echo "🐟 Koi Fish MediaMTX Streamer Setup"
echo "============================================="
echo ""

# Install system deps
echo "📦 Installing system dependencies..."
sudo apt update
sudo apt install -y python3-pip python3-venv python3-opencv ffmpeg

# Verify ffmpeg
echo ""
echo "🔍 Checking ffmpeg..."
ffmpeg -version | head -1
echo "✅ ffmpeg installed"

# Create project directory
echo ""
echo "📁 Setting up project directory..."
mkdir -p ~/mediamtx-camera
cd ~/mediamtx-camera

# Create virtual environment
echo ""
echo "🐍 Creating Python virtual environment..."
python3 -m venv --system-site-packages venv
source venv/bin/activate

# Install Python packages
echo ""
echo "📦 Installing Python packages..."
pip install --upgrade pip
pip install python-socketio[client] opencv-python-headless Pillow numpy

# Copy streamer script
echo ""
echo "📋 Copying streamer script..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "$SCRIPT_DIR/mediamtx_streamer.py" ~/mediamtx-camera/

# Create .env
echo ""
echo "📝 Creating config..."
cat > ~/mediamtx-camera/.env << 'EOF'
RTMP_URL=rtmp://187.77.189.5:1935/live/camera
PI_CAMERA_URL=http://192.168.8.101:5000
STREAM_WIDTH=640
STREAM_HEIGHT=360
STREAM_FPS=15
EOF

# Install systemd service
echo ""
echo "⚙️  Installing systemd service..."
sudo cp "$SCRIPT_DIR/mediamtx-camera.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable mediamtx-camera.service

echo ""
echo "============================================="
echo "✅ Setup complete!"
echo "============================================="
echo ""
echo "📋 Quick commands:"
echo ""
echo "  # Test manually first:"
echo "  cd ~/mediamtx-camera"
echo "  source venv/bin/activate"
echo "  python3 mediamtx_streamer.py"
echo ""
echo "  # Start as background service:"
echo "  sudo systemctl start mediamtx-camera"
echo ""
echo "  # Check status:"
echo "  sudo systemctl status mediamtx-camera"
echo ""
echo "  # View logs:"
echo "  journalctl -u mediamtx-camera -f"
echo ""
echo "⚠️  IMPORTANT: Make sure MediaMTX is running on VPS first!"
echo "   See the Dokploy deployment guide."
echo ""
