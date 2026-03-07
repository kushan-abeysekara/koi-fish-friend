import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square, Wifi, WifiOff, AlertCircle, Video } from 'lucide-react';
import mqtt from 'mqtt';
import MediaMTXCameraFeed from '../components/MediaMTXCameraFeed';

const BoatNavigation: React.FC = () => {
  const [speed, setSpeed] = useState(150); // Default 150 for good motor response
  const [isConnected, setIsConnected] = useState(false);
  const [currentCommand, setCurrentCommand] = useState('STOP');
  const [mqttClient, setMqttClient] = useState<mqtt.MqttClient | null>(null);
  const [wsClient, setWsClient] = useState<WebSocket | null>(null);
  const [connectionQuality, setConnectionQuality] = useState(0); // WiFi RSSI
  const [esp32IP, setEsp32IP] = useState<string>(''); // Auto-detected ESP32 IP
  const [wsConnected, setWsConnected] = useState(false);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
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
    // MQTT: Always connect - runs in background
    // Self-hosted EMQX on VPS — never fall back to HiveMQ
    const mqttUrl = import.meta.env.VITE_MQTT_WS_URL || 'ws://187.77.189.5:8083/mqtt';
    const client = mqtt.connect(mqttUrl, {
      clientId: 'BoatControl_' + Math.random().toString(16).substr(2, 8),
      clean: true,
      keepalive: 30,  // Increased from 15 for stability
      reconnectPeriod: 2000,  // Slower reconnect for stability
      connectTimeout: 8000,  // More time to connect
      queueQoSZero: false
    });

    client.on('connect', () => {
      console.log('🌐 MQTT Connected (background)');
      setMqttConnected(true);
      setReconnectAttempts(0);
      
      // Subscribe to topics
      client.subscribe('koifish/boat/sensor', { qos: 0 });
      client.subscribe('koifish/boat/status', { qos: 0 });
    });

    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (topic === 'koifish/boat/sensor') {
          // Only update if WebSocket is NOT connected (fallback mode)
          if (!wsConnected) {
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
          
          if (data.rssi) {
            setConnectionQuality(data.rssi);
          }
        }
        
        if (topic === 'koifish/boat/status') {
          // Heartbeat received
        }
      } catch (error) {
        console.error('MQTT parse error:', error);
      }
    });

    client.on('error', (error) => {
      console.warn('⚠️ MQTT Error (will retry):', error.message);
      setMqttConnected(false);
    });
    
    client.on('offline', () => {
      console.log('📡 MQTT offline (reconnecting...)');
      setMqttConnected(false);
    });

    client.on('close', () => {
      console.warn('⚠️ MQTT connection closed');
      setIsConnected(false);
    });
    
    client.on('offline', () => {
      console.log('📡 MQTT offline (reconnecting...)');
      setMqttConnected(false);
    });
    
    client.on('reconnect', () => {
      const attempts = reconnectAttempts + 1;
      setReconnectAttempts(attempts);
      console.log(`🔄 MQTT Reconnect attempt ${attempts}...`);
    });

    setMqttClient(client);
    
    // MQTT heartbeat: Send every 5 seconds (stable frequency)
    const heartbeatInterval = setInterval(() => {
      if (client && client.connected && !wsConnected) {
        // Only send MQTT heartbeat if WebSocket is NOT active
        const heartbeat = JSON.stringify({
          command: 'HEARTBEAT',
          timestamp: Date.now()
        });
        client.publish('koifish/boat/command', heartbeat, { qos: 0, retain: false });
      }
    }, 5000);
    
    // WebSocket: Try to connect to local ESP32 (Priority connection)
    const connectWebSocket = () => {
      const wsUrl = 'ws://192.168.8.100:81';
      console.log('🔌 Attempting WebSocket:', wsUrl);
      
      try {
        const ws = new WebSocket(wsUrl);
        let pingInterval: NodeJS.Timeout;
        
        ws.onopen = () => {
          console.log('⚡ WebSocket CONNECTED - Using LOCAL mode');
          setWsConnected(true);
          setWsClient(ws);
          setEsp32IP('192.168.8.100');
          
          // WebSocket ping every 2 seconds to keep alive
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ command: 'PING' }));
            }
          }, 2000);
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // WebSocket has priority - always update sensor data
            if (data.deviceId) {
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
              
              if (data.rssi) {
                setConnectionQuality(data.rssi);
              }
            }
          } catch (error) {
            console.error('WebSocket parse error:', error);
          }
        };
        
        ws.onerror = () => {
          console.log('❌ WebSocket error - will retry');
          clearInterval(pingInterval);
        };
        
        ws.onclose = () => {
          console.log('🔌 WebSocket DISCONNECTED - Switching to MQTT');
          setWsConnected(false);
          setWsClient(null);
          clearInterval(pingInterval);
          
          // Auto-reconnect after 10 seconds
          setTimeout(connectWebSocket, 10000);
        };
        
      } catch {
        console.log('⚠️ WebSocket unavailable, using MQTT');
        setTimeout(connectWebSocket, 10000);
      }
    };
    
    // Start WebSocket connection after 1 second delay
    const wsTimeout = setTimeout(connectWebSocket, 1000);
    
    // Update connection status based on what's available
    const statusInterval = setInterval(() => {
      if (wsConnected) {
        setIsConnected(true);
      } else if (mqttConnected) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    }, 1000);

    // Cleanup on unmount
    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(statusInterval);
      clearTimeout(wsTimeout);
      
      if (client) {
        // Send final STOP
        const stopCmd = JSON.stringify({ command: 'STOP', speed: 0 });
        client.publish('koifish/boat/command', stopCmd, { qos: 0 });
        client.end();
      }
      if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        const stopCmd = JSON.stringify({ command: 'STOP', speed: 0 });
        wsClient.send(stopCmd);
        wsClient.close();
      }
    };
  }, []); // Empty dependency - only run once on mount

  const sendCommand = (command: string) => {
    const payload = JSON.stringify({
      command: command,
      speed: speed,
      timestamp: Date.now()
    });

    let sent = false;

    // PRIORITY 1: WebSocket (Local network - fastest ~20ms)
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      try {
        wsClient.send(payload);
        sent = true;
        setCurrentCommand(command);
        console.log('⚡ WebSocket:', command, speed);
      } catch {
        console.warn('WebSocket failed, trying MQTT');
      }
    }

    // PRIORITY 2: MQTT (Always try as backup - ~150ms)
    // Send MQTT regardless of WebSocket status for redundancy
    if (!sent && mqttClient && mqttClient.connected) {
      try {
        mqttClient.publish('koifish/boat/command', payload, { qos: 0, retain: false });
        sent = true;
        setCurrentCommand(command);
        console.log('🌐 MQTT:', command, speed);
      } catch {
        console.error('⚠️ Both connections failed');
      }
    }

    if (!sent) {
      console.warn('⚠️ No connection - command dropped:', command);
      // NO BLOCKING ALERT - just log and continue
    }
  };

  const handleClick = (command: string) => {
    // Send command once - boat will continue moving until another command is sent
    sendCommand(command);
    console.log('🚤 Continuous movement:', command);
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
  
  const getConnectionQualityLabel = () => {
    // RSSI ranges: -30 (excellent) to -90 (poor)
    if (connectionQuality >= -50) return { label: 'Excellent', color: 'text-green-500' };
    if (connectionQuality >= -60) return { label: 'Good', color: 'text-blue-500' };
    if (connectionQuality >= -70) return { label: 'Fair', color: 'text-yellow-500' };
    if (connectionQuality >= -80) return { label: 'Poor', color: 'text-orange-500' };
    return { label: 'Very Poor', color: 'text-red-500' };
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
          
          {/* Always Show Connection Status - Top Right Corner */}
          <div className="flex flex-col gap-2">
            {/* WebSocket Status */}
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border-2 border-gray-200">
              {wsConnected ? (
                <>
                  <Wifi className="text-green-500 w-5 h-5" />
                  <div className="text-right">
                    <div className="text-green-600 font-bold text-sm">⚡ LOCAL WebSocket</div>
                    <div className="text-xs text-gray-600">ESP32: {esp32IP || '192.168.8.100'}</div>
                  </div>
                </>
              ) : (
                <>
                  <WifiOff className="text-orange-500 w-5 h-5 animate-pulse" />
                  <div className="text-right">
                    <div className="text-orange-500 font-semibold text-sm">Connecting...</div>
                    <div className="text-xs text-orange-400">Local: 192.168.8.100:81</div>
                  </div>
                </>
              )}
            </div>
            
            {/* MQTT Status */}
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border-2 border-gray-200">
              {mqttConnected ? (
                <>
                  <Wifi className="text-blue-500 w-5 h-5" />
                  <div className="text-right">
                    <div className="text-blue-600 font-bold text-sm">🌐 MQTT Connected</div>
                    <div className="text-xs text-gray-600">EMQX (VPS)</div>
                  </div>
                </>
              ) : (
                <>
                  <WifiOff className="text-red-500 w-5 h-5" />
                  <div className="text-right">
                    <div className="text-red-500 font-semibold text-sm">MQTT Offline</div>
                    <div className="text-xs text-red-400">Reconnecting...</div>
                  </div>
                </>
              )}
            </div>
            
            {/* Connection Quality */}
            {connectionQuality !== 0 && (
              <div className="text-right text-xs">
                <span className={`font-semibold ${getConnectionQualityLabel().color}`}>
                  Signal: {getConnectionQualityLabel().label} ({connectionQuality} dBm)
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Camera Feed - LiveKit WebRTC */}
        <div className="lg:col-span-2">
          <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="bg-gray-700 px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold">Live Camera Feed</h2>
                <p className="text-gray-400 text-sm">Boat POV Camera via MediaMTX HLS</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                <span className="text-red-400 text-xs font-semibold">LIVE</span>
              </div>
            </div>
            <div className="aspect-video">
              <MediaMTXCameraFeed 
                className="w-full h-full"
                showStatus={true}
              />
            </div>
            <div className="bg-gray-700 px-4 py-2 text-center text-sm">
              <div className="flex items-center justify-center gap-4 text-gray-300">
                <span className="flex items-center gap-2">
                  <Video size={14} className="text-cyan-400" />
                  <span>HLS Stream (Works from Anywhere)</span>
                </span>
                <span>|</span>
                <span>⌨️ Arrow Keys or WASD + Space to Stop</span>
              </div>
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
                onClick={() => handleClick('FORWARD')}
                className="w-20 h-20 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white rounded-lg shadow-lg flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
              >
                <ArrowUp size={32} />
              </button>

              {/* Left, Stop, Right Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleClick('LEFT_ONLY')}
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
                  onClick={() => handleClick('RIGHT_ONLY')}
                  className="w-20 h-20 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white rounded-lg shadow-lg flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
                >
                  <ArrowRight size={32} />
                </button>
              </div>

              {/* Down Button */}
              <button
                onClick={() => handleClick('BACKWARD')}
                className="w-20 h-20 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white rounded-lg shadow-lg flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
              >
                <ArrowDown size={32} />
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-center">
              <p className="text-sm text-blue-700 font-semibold">
                💡 Click once to move continuously. Click STOP (red) to halt.
              </p>
              <p className="text-xs text-blue-600 mt-1">
                No watchdog - boat keeps moving until you send another command
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
