#!/bin/bash
# Quick setup script for Raspberry Pi LiveKit integration
# Run this on your Raspberry Pi via SSH

echo "============================================="
echo "🐟 Koi Fish LiveKit Setup for Raspberry Pi"
echo "============================================="

# Install system deps
echo ""
echo "📦 Installing system dependencies..."
sudo apt update
sudo apt install -y python3-pip python3-venv python3-opencv

# Create project directory
echo ""
echo "📁 Setting up project directory..."
mkdir -p ~/livekit-camera
cd ~/livekit-camera

# Create virtual environment with system packages (for opencv)
echo ""
echo "🐍 Creating Python virtual environment..."
python3 -m venv --system-site-packages venv
source venv/bin/activate

# Install Python packages
echo ""
echo "📦 Installing Python packages..."
pip install --upgrade pip
pip install livekit livekit-api python-socketio[client] Pillow

# Create .env file
echo ""
echo "📝 Creating .env config..."
cat > .env << 'EOF'
LIVEKIT_URL=wss://livekit.koifishfriend.online
LIVEKIT_API_KEY=APIhfro22ogg9c3
LIVEKIT_API_SECRET=5ejwe0usuxnlknv5afgtsyfvsgmukb1pedprwwqaxilc
LIVEKIT_ROOM=boat-navigation
LIVEKIT_IDENTITY=boat-camera-pi
LIVEKIT_NAME=Boat Camera (RPi + YOLOv8)
PI_CAMERA_URL=http://192.168.8.101:5000
EOF

echo ""
echo "✅ Setup complete!"
echo ""
echo "============================================="
echo "📋 Next steps:"
echo "============================================="
echo ""
echo "1. Copy the bridge script to ~/livekit-camera/"
echo "   scp livekit_bridge.py pi@192.168.8.101:~/livekit-camera/"
echo ""
echo "2. Run the bridge:"
echo "   cd ~/livekit-camera"
echo "   source venv/bin/activate"
echo "   set -a && source .env && set +a"
echo "   python3 livekit_bridge.py"
echo ""
echo "3. Or set up as a systemd service (auto-start):"
echo "   sudo cp livekit-camera.service /etc/systemd/system/"
echo "   sudo systemctl daemon-reload"
echo "   sudo systemctl enable livekit-camera"
echo "   sudo systemctl start livekit-camera"
echo ""
