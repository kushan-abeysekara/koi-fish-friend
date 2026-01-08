import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square, Wifi, WifiOff, AlertCircle, Activity } from 'lucide-react';
import mqtt from 'mqtt';

const BoatNavigation: React.FC = () => {
  const [speed, setSpeed] = useState(150); // Default 150 for good motor response
  const [isConnected, setIsConnected] = useState(false);
  const [currentCommand, setCurrentCommand] = useState('STOP');
  const [mqttClient, setMqttClient] = useState<mqtt.MqttClient | null>(null);
  const [sensorData, setSensorData] = useState({
    voltage: 0,
    distanceFront: 0,
    distanceBack: 0,
    distanceLeft: 0,
    distanceRight: 0,
    angleX: 0,
    angleY: 0,
    temperature: 0,
    mode: 'manual'
  });

  useEffect(() => {
    // Connect to MQTT broker with optimized settings
    const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', {
      clientId: 'BoatControl_' + Math.random().toString(16).substr(2, 8),
      clean: true,
      keepalive: 30,
      reconnectPeriod: 1000
    });

    client.on('connect', () => {
      console.log('Connected to MQTT broker');
      setIsConnected(true);
      
      // Subscribe to sensor data with QoS 0 for fastest delivery
      client.subscribe('koifish/boat/sensor', { qos: 0 });
      client.subscribe('koifish/boat/status', { qos: 0 });
    });

    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (topic === 'koifish/boat/sensor') {
          setSensorData({
            voltage: data.voltage || 0,
            distanceFront: data.distanceFront || 0,
            distanceBack: data.distanceBack || 0,
            distanceLeft: data.distanceLeft || 0,
            distanceRight: data.distanceRight || 0,
            angleX: data.angleX || 0,
            angleY: data.angleY || 0,
            temperature: data.temperature || 0,
            mode: data.mode || 'manual'
          });
        }
      } catch (error) {
        console.error('Error parsing MQTT message:', error);
      }
    });

    client.on('error', (error) => {
      console.error('MQTT Error:', error);
      setIsConnected(false);
    });

    client.on('close', () => {
      setIsConnected(false);
    });

    setMqttClient(client);

    // Cleanup on unmount
    return () => {
      if (client) {
        client.end();
      }
    };
  }, []);

  const sendCommand = (command: string) => {
    if (!mqttClient || !isConnected) {
      console.log('MQTT not connected');
      return;
    }

    const payload = JSON.stringify({
      command: command,
      speed: speed
    });

    mqttClient.publish('koifish/boat/command', payload, { qos: 0, retain: false });
    setCurrentCommand(command);
    console.log('Sent command:', payload);
  };

  const handleMouseDown = (command: string) => {
    sendCommand(command);
  };

  const handleMouseUp = () => {
    sendCommand('STOP');
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseInt(e.target.value);
    setSpeed(newSpeed);
    sendCommand('SPEED');
  };

  const handleEmergencyStop = () => {
    sendCommand('STOP');
    setSpeed(0);
  };

  const getSpeedLabel = () => {
    const percentage = Math.round((speed / 255) * 100);
    if (percentage < 33) return 'Slow';
    if (percentage < 67) return 'Medium';
    return 'Fast';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-cyan-500 rounded-lg flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
                <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
                <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Boat Navigation Control</h1>
              <p className="text-gray-500">Remote control with live camera feed</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <Wifi className="text-green-500 w-6 h-6" />
                <span className="text-green-500 font-semibold">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="text-red-500 w-6 h-6" />
                <span className="text-red-500 font-semibold">Disconnected</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Camera Feed */}
        <div className="lg:col-span-2">
          <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="bg-gray-700 px-4 py-3">
              <h2 className="text-white font-semibold">Live Camera Feed</h2>
              <p className="text-gray-400 text-sm">Boat POV Camera</p>
            </div>
            <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 opacity-50">
                  <svg viewBox="0 0 24 24" fill="none" className="text-gray-600">
                    <path d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-gray-400 text-lg mb-2">Camera Stream Not Available</p>
                <p className="text-gray-500 text-sm">Camera server is not running on port 5000</p>
                <button className="mt-4 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-md transition-colors">
                  Retry Connection
                </button>
              </div>
              
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded text-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                <span>Quality: HD</span>
              </div>
            </div>
            <div className="bg-gray-700 px-4 py-2 text-center text-gray-400 text-sm">
              ⌨️ Keyboard: Arrow Keys or WASD + Space to Stop
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="space-y-6">
          {/* Emergency Stop */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <button
              onClick={handleEmergencyStop}
              className="w-full py-6 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xl rounded-lg transition-colors shadow-lg flex items-center justify-center gap-3"
            >
              <AlertCircle size={32} />
              EMERGENCY STOP
            </button>
          </div>

          {/* Speed Control */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Speed Control</h3>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Speed: {Math.round((speed / 255) * 100)}%</span>
                <span className="text-sm font-semibold text-cyan-600">{getSpeedLabel()}</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={speed}
                onChange={handleSpeedChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>Slow</span>
                <span>Medium</span>
                <span>Fast</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Navigation Controls</h3>
            
            <div className="flex flex-col items-center gap-3 mb-4">
              {/* Up Button */}
              <button
                onMouseDown={() => handleMouseDown('FORWARD')}
                onMouseUp={handleMouseUp}
                onTouchStart={() => handleMouseDown('FORWARD')}
                onTouchEnd={handleMouseUp}
                onContextMenu={(e) => e.preventDefault()}
                className="w-20 h-20 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white rounded-lg shadow-lg flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
              >
                <ArrowUp size={32} />
              </button>

              {/* Left, Stop, Right Buttons */}
              <div className="flex gap-3">
                <button
                  onMouseDown={() => handleMouseDown('LEFT_ONLY')}
                  onMouseUp={handleMouseUp}
                  onTouchStart={() => handleMouseDown('LEFT_ONLY')}
                  onTouchEnd={handleMouseUp}
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-20 h-20 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white rounded-lg shadow-lg flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
                >
                  <ArrowLeft size={32} />
                </button>

                <button
                  onClick={() => sendCommand('STOP')}
                  className="w-20 h-20 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-lg shadow-lg flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
                >
                  <Square size={32} fill="white" />
                </button>

                <button
                  onMouseDown={() => handleMouseDown('RIGHT_ONLY')}
                  onMouseUp={handleMouseUp}
                  onTouchStart={() => handleMouseDown('RIGHT_ONLY')}
                  onTouchEnd={handleMouseUp}
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-20 h-20 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white rounded-lg shadow-lg flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
                >
                  <ArrowRight size={32} />
                </button>
              </div>

              {/* Down Button */}
              <button
                onMouseDown={() => handleMouseDown('BACKWARD')}
                onMouseUp={handleMouseUp}
                onTouchStart={() => handleMouseDown('BACKWARD')}
                onTouchEnd={handleMouseUp}
                className="w-20 h-20 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white rounded-lg shadow-lg flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
              >
                <ArrowDown size={32} />
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-center">
              <p className="text-sm text-blue-700">
                💡 Hold buttons to move. Release to stop automatically.
              </p>
            </div>
          </div>

          {/* Status Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Status Information</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Connection:</span>
                <span className={`font-semibold ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
                  {isConnected ? 'Online' : 'Offline'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Current Command:</span>
                <span className="font-semibold text-cyan-600">{currentCommand}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Mode:</span>
                <span className="font-semibold text-gray-800 capitalize">{sensorData.mode}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Voltage:</span>
                <span className="font-semibold text-gray-800">{sensorData.voltage.toFixed(1)}V</span>
              </div>

              <div className="border-t pt-3 mt-3">
                <p className="text-sm text-gray-600 mb-2">Obstacle Distance (cm):</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-gray-500">Front:</span>
                    <span className="ml-2 font-semibold">{sensorData.distanceFront.toFixed(0)}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-gray-500">Back:</span>
                    <span className="ml-2 font-semibold">{sensorData.distanceBack.toFixed(0)}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-gray-500">Left:</span>
                    <span className="ml-2 font-semibold">{sensorData.distanceLeft.toFixed(0)}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-gray-500">Right:</span>
                    <span className="ml-2 font-semibold">{sensorData.distanceRight.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Gyroscope / Tilt Data */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Gyroscope / Tilt
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-gray-600">Pitch (X):</span>
                <span className="font-semibold text-gray-800">{sensorData.angleX?.toFixed(1) || '0.0'}°</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-gray-600">Roll (Y):</span>
                <span className="font-semibold text-gray-800">{sensorData.angleY?.toFixed(1) || '0.0'}°</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-gray-600">Temperature:</span>
                <span className="font-semibold text-gray-800">{sensorData.temperature?.toFixed(1) || '0.0'}°C</span>
              </div>
              {/* Visual tilt indicator */}
              <div className="mt-4 p-4 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg border border-cyan-200">
                <div className="flex justify-center items-center h-32 relative">
                  <div 
                    className="w-20 h-20 border-4 border-cyan-500 rounded-full flex items-center justify-center transition-transform duration-200"
                    style={{
                      transform: `perspective(200px) rotateX(${-(sensorData.angleY || 0)}deg) rotateY(${sensorData.angleX || 0}deg)`
                    }}
                  >
                    <div className="w-3 h-3 bg-cyan-500 rounded-full shadow-lg"></div>
                  </div>
                </div>
                <p className="text-center text-xs text-gray-600 mt-2 font-medium">Live Tilt Indicator</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoatNavigation;
