import React, { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, AlertCircle, Download } from 'lucide-react';
import io from 'socket.io-client';
import axios from 'axios';
import MediaMTXCameraFeed from './MediaMTXCameraFeed';

// Detection Event Interface
interface DetectionEvent {
  id: string;
  timestamp: string;
  fishId: number;
  healthClass: string;
  confidence: number;
  isCritical: boolean;
  needsAttention: boolean;
  bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

// Feed source type
type FeedSource = 'hls' | 'ai';

const PondCamera: React.FC = () => {
  // Camera feed states
  const [cameraConnected, setCameraConnected] = useState(false);
  const [cameraFPS, setCameraFPS] = useState(0);
  const [fishCount, setFishCount] = useState(0);
  const [detections, setDetections] = useState<Array<{ id: number; health?: { class?: string; confidence?: number; is_critical?: boolean; needs_attention?: boolean } }>>([]);
  const [cameraFrame, setCameraFrame] = useState<string>('');
  const cameraSocketRef = useRef<ReturnType<typeof io> | null>(null);
  const CAMERA_SERVER_URL = import.meta.env.VITE_CAMERA_SERVER_URL || 'http://192.168.8.101:5000';
  
  // Feed source toggle (HLS = MediaMTX live stream, AI = local detection server)
  const [feedSource, setFeedSource] = useState<FeedSource>('hls');

  // Camera performance mode (for AI feed)
  const [cameraMode, setCameraMode] = useState<'quality' | 'balanced' | 'performance'>('balanced');
  
  // Event logging states
  const [detectionEvents, setDetectionEvents] = useState<DetectionEvent[]>([]);
  const [criticalAlerts, setCriticalAlerts] = useState<number>(0);
  const [, setTotalDetections] = useState<number>(0);

  // AI Camera Feed WebSocket Connection (optional — connects to local detection server)
  useEffect(() => {
    console.log('🎥 Connecting to AI camera server:', CAMERA_SERVER_URL);
    
    const socket = io(CAMERA_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionAttempts: 5,
      timeout: 8000,
    });

    socket.on('connect', () => {
      console.log('✅ AI camera server connected');
      setCameraConnected(true);
      
      const config = {
        quality: { width: 960, height: 540, quality: 90 },
        balanced: { width: 640, height: 360, quality: 75 },
        performance: { width: 480, height: 270, quality: 60 }
      };
      
      const settings = config[cameraMode];
      
      fetch(`${CAMERA_SERVER_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      }).catch(err => console.warn('Could not update AI config:', err));
      
      socket.emit('start_stream');
    });

    socket.on('disconnect', () => {
      console.log('❌ AI camera server disconnected');
      setCameraConnected(false);
      setCameraFrame('');
      setFishCount(0);
      setDetections([]);
    });

    socket.on('detection_update', (data: { fps?: number; fish_count?: number; detections?: Array<{ id: number; health?: { class?: string; confidence?: number; is_critical?: boolean; needs_attention?: boolean }; bbox?: { x1: number; y1: number; x2: number; y2: number } }>; frame?: string; timestamp?: string }) => {
      try {
        setCameraFPS(data.fps || 0);
        setFishCount(data.fish_count || 0);
        setDetections(data.detections || []);
        setTotalDetections(prev => prev + (data.fish_count || 0));
        
        if (data.frame) {
          setCameraFrame(`data:image/jpeg;base64,${data.frame}`);
        }
        
        if (data.detections && data.detections.length > 0) {
          const newEvents: DetectionEvent[] = data.detections.map((fish) => ({
            id: `${Date.now()}-${fish.id}`,
            timestamp: data.timestamp || new Date().toISOString(),
            fishId: fish.id,
            healthClass: fish.health?.class || 'unknown',
            confidence: fish.health?.confidence || 0,
            isCritical: fish.health?.is_critical || false,
            needsAttention: fish.health?.needs_attention || false,
            bbox: fish.bbox || { x1: 0, y1: 0, x2: 0, y2: 0 }
          }));
          
          setDetectionEvents(prev => [...newEvents, ...prev].slice(0, 100));
          
          const criticalCount = newEvents.filter(e => e.isCritical).length;
          if (criticalCount > 0) {
            setCriticalAlerts(prev => prev + criticalCount);
            saveCriticalAlert(newEvents.filter(e => e.isCritical));
          }
          
          saveDetectionEvents(newEvents);
        }
      } catch (error) {
        console.error('Error processing camera data:', error);
      }
    });

    socket.on('connect_error', (error: Error) => {
      console.warn('⚠️ AI camera connection error:', error.message);
    });

    cameraSocketRef.current = socket;

    return () => {
      console.log('🔌 Disconnecting from AI camera server');
      socket.emit('stop_stream');
      socket.disconnect();
    };
  }, [cameraMode]);

  // Save detection events to backend
  const saveDetectionEvents = async (events: DetectionEvent[]) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';
    try {
      await axios.post(`${API_URL}/api/camera/events`, {
        events: events.map(e => ({
          timestamp: e.timestamp,
          fishId: e.fishId,
          healthStatus: e.healthClass,
          confidence: e.confidence,
          isCritical: e.isCritical,
          needsAttention: e.needsAttention,
          boundingBox: e.bbox
        }))
      });
    } catch (error) {
      console.error('Failed to save detection events:', error);
    }
  };

  // Save critical alerts
  const saveCriticalAlert = async (events: DetectionEvent[]) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';
    try {
      await axios.post(`${API_URL}/api/camera/alerts/critical`, {
        timestamp: new Date().toISOString(),
        alertType: 'DEAD_FISH_DETECTED',
        severity: 'CRITICAL',
        fishCount: events.length,
        details: events.map(e => ({
          fishId: e.fishId,
          healthClass: e.healthClass,
          confidence: e.confidence
        }))
      });
      
      // Play alert sound
      playAlertSound();
    } catch (error) {
      console.error('Failed to save critical alert:', error);
    }
  };

  const playAlertSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZURE');
    audio.play().catch(e => console.log('Could not play alert sound:', e));
  };

  const handleCameraModeChange = (mode: 'quality' | 'balanced' | 'performance') => {
    setCameraMode(mode);
    if (cameraSocketRef.current) {
      cameraSocketRef.current.disconnect();
      cameraSocketRef.current.connect();
    }
  };

  const getHealthColor = (healthClass: string) => {
    switch (healthClass) {
      case 'healthy': return 'text-green-500';
      case 'bacterial': return 'text-orange-500';
      case 'fungal': return 'text-purple-500';
      case 'parasitic': return 'text-blue-500';
      case 'white_tail': return 'text-yellow-500';
      case 'dead': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getHealthEmoji = (healthClass: string) => {
    switch (healthClass) {
      case 'healthy': return '🟢';
      case 'bacterial': return '🟠';
      case 'fungal': return '🟣';
      case 'parasitic': return '🔵';
      case 'white_tail': return '🟡';
      case 'dead': return '🔴';
      default: return '⚪';
    }
  };

  const exportEventsToCSV = () => {
    const csv = [
      ['Timestamp', 'Fish ID', 'Health Status', 'Confidence', 'Critical', 'Needs Attention'].join(','),
      ...detectionEvents.map(e => 
        [e.timestamp, e.fishId, e.healthClass, e.confidence.toFixed(2), e.isCritical, e.needsAttention].join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fish-detection-events-${new Date().toISOString()}.csv`;
    a.click();
  };

  const clearEvents = () => {
    if (confirm('Clear all detection events?')) {
      setDetectionEvents([]);
      setCriticalAlerts(0);
      setTotalDetections(0);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Video className="text-cyan-500" size={32} />
            Live Fish Health Monitoring
          </h2>
          <p className="text-gray-600 mt-1">Real-time AI fish detection with health analysis</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportEventsToCSV}
            disabled={detectionEvents.length === 0}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 flex items-center gap-2"
          >
            <Download size={16} />
            Export Events
          </button>
          <button
            onClick={clearEvents}
            disabled={detectionEvents.length === 0}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 flex items-center gap-2"
          >
            Clear Events
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Live Feed</p>
              <p className="text-2xl font-bold mt-2">
                {feedSource === 'hls' ? (
                  <span className="text-green-600">HLS Stream</span>
                ) : cameraConnected ? (
                  <span className="text-green-600">AI Online</span>
                ) : (
                  <span className="text-red-600">AI Offline</span>
                )}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              feedSource === 'hls' || cameraConnected ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {feedSource === 'hls' || cameraConnected ? (
                <Video className="text-green-600" size={24} />
              ) : (
                <VideoOff className="text-red-600" size={24} />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Fish Detected</p>
              <p className="text-3xl font-bold text-cyan-600 mt-2">{fishCount}</p>
            </div>
            <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🐟</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Events</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{detectionEvents.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Critical Alerts</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{criticalAlerts}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="text-red-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Camera Feed - 2/3 width */}
        <div className="lg:col-span-2">
          <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="bg-gray-700 px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold">Live Camera Feed</h2>
                <p className="text-gray-400 text-sm">
                  {feedSource === 'hls' ? 'Pond Camera via MediaMTX HLS' : 'AI-Powered Fish Health Detection'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Feed Source Toggle */}
                <div className="flex bg-gray-600 rounded-lg p-0.5">
                  <button
                    onClick={() => setFeedSource('hls')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                      feedSource === 'hls'
                        ? 'bg-cyan-500 text-white shadow'
                        : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    📡 HLS Live
                  </button>
                  <button
                    onClick={() => setFeedSource('ai')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                      feedSource === 'ai'
                        ? 'bg-cyan-500 text-white shadow'
                        : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    🤖 AI Detection
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-xs font-semibold">LIVE</span>
                </div>
              </div>
            </div>
            
            {/* HLS Feed (primary — always works in production) */}
            {feedSource === 'hls' && (
              <div className="aspect-video">
                <MediaMTXCameraFeed className="w-full h-full" showStatus={true} />
              </div>
            )}

            {/* AI Detection Feed (optional — requires local camera server) */}
            {feedSource === 'ai' && (
              <>
                <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
              {cameraConnected && cameraFrame ? (
                <>
                  {/* Live Video Feed with Detections */}
                  <img 
                    src={cameraFrame} 
                    alt="Live Camera Feed" 
                    className="w-full h-full object-contain"
                  />
                  
                  {/* Detection Overlays */}
                  <div className="absolute top-4 right-4 space-y-2">
                    {detections.map((fish, idx) => (
                      <div 
                        key={idx} 
                        className={`px-3 py-1 rounded-lg text-sm font-semibold shadow-lg ${
                          fish.health?.is_critical 
                            ? 'bg-red-600 text-white animate-pulse' 
                            : fish.health?.needs_attention
                            ? 'bg-orange-500 text-white'
                            : 'bg-green-500 bg-opacity-80 text-white'
                        }`}
                      >
                        {getHealthEmoji(fish.health?.class || 'unknown')} Fish #{fish.id}: {fish.health?.class || 'detecting'} ({((fish.health?.confidence ?? 0) * 100).toFixed(0)}%)
                      </div>
                    ))}
                  </div>
                  
                  {/* Live Indicator & Controls */}
                  <div className="absolute top-4 left-4 space-y-2">
                    <div className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg">
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                      <span>LIVE</span>
                    </div>
                    
                    {/* Performance Mode Selector */}
                    <div className="bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg text-xs space-y-1">
                      <div className="text-gray-300 mb-1">Quality Mode:</div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleCameraModeChange('performance')}
                          className={`px-2 py-1 rounded ${
                            cameraMode === 'performance' 
                              ? 'bg-cyan-500 text-white' 
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          ⚡ Fast
                        </button>
                        <button
                          onClick={() => handleCameraModeChange('balanced')}
                          className={`px-2 py-1 rounded ${
                            cameraMode === 'balanced' 
                              ? 'bg-cyan-500 text-white' 
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          ⚖️ Balanced
                        </button>
                        <button
                          onClick={() => handleCameraModeChange('quality')}
                          className={`px-2 py-1 rounded ${
                            cameraMode === 'quality' 
                              ? 'bg-cyan-500 text-white' 
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          🎯 Quality
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Stats Bar */}
                  <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                    <div className={`px-3 py-1 rounded text-sm flex items-center gap-2 ${
                      cameraFPS < 10 
                        ? 'bg-red-600 bg-opacity-90 text-white font-bold'
                        : cameraFPS < 15
                        ? 'bg-yellow-600 bg-opacity-90 text-white'
                        : 'bg-black bg-opacity-70 text-white'
                    }`}>
                      <Video size={16} />
                      <span>{cameraFPS.toFixed(1)} FPS</span>
                      {cameraFPS < 10 && <span>⚠️</span>}
                    </div>
                    <div className="bg-black bg-opacity-70 text-white px-3 py-1 rounded text-sm flex items-center gap-2">
                      <span>🐟 {fishCount} Fish</span>
                    </div>
                    {detections.some(d => d.health?.is_critical) && (
                      <div className="bg-red-600 text-white px-3 py-1 rounded text-sm font-bold animate-pulse">
                        ⚠️ CRITICAL ALERT
                      </div>
                    )}
                    {cameraFPS < 10 && (
                      <div className="bg-orange-600 text-white px-3 py-1 rounded text-sm">
                        💡 Try ⚡ Fast mode
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center p-6">
                  <div className="w-24 h-24 mx-auto mb-4 opacity-50">
                    {cameraConnected ? (
                      <Video className="text-cyan-500 w-full h-full" />
                    ) : (
                      <VideoOff className="text-gray-600 w-full h-full" />
                    )}
                  </div>
                  <p className="text-gray-400 text-lg mb-2">
                    {cameraConnected ? 'Waiting for camera stream...' : 'Camera Server Not Connected'}
                  </p>
                  <p className="text-gray-500 text-sm">
                    {cameraConnected 
                      ? 'Initializing fish detection models...' 
                      : `Trying to connect to ${CAMERA_SERVER_URL}`
                    }
                  </p>
                  {!cameraConnected && (
                    <div className="mt-4">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                      <p className="text-sm text-gray-500 mt-2">Reconnecting...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="bg-gray-700 px-4 py-2 text-center text-sm">
              <div className="flex items-center justify-center gap-4 text-gray-300">
                <span className="flex items-center gap-2">
                  {cameraConnected ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span>AI Server: Connected</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span>AI Server: Disconnected</span>
                    </>
                  )}
                </span>
                <span>|</span>
                <span>📹 AI Detection Mode — Switch to HLS for live stream</span>
              </div>
            </div>
              </>
            )}

            {/* Bottom status bar for HLS mode */}
            {feedSource === 'hls' && (
              <div className="bg-gray-700 px-4 py-2 text-center text-sm">
                <div className="flex items-center justify-center gap-4 text-gray-300">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span>Pond Camera (RPi + MediaMTX)</span>
                  </span>
                  <span>|</span>
                  <span>📡 HLS Live Stream</span>
                  {cameraConnected && (
                    <>
                      <span>|</span>
                      <span className="text-green-400">🤖 AI Server Available</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Event Log - 1/3 width */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-4 py-3">
              <h3 className="font-semibold">Detection Events Log</h3>
              <p className="text-sm text-cyan-100">Real-time event tracking</p>
            </div>
            
            <div className="h-[600px] overflow-y-auto">
              {detectionEvents.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <AlertCircle size={48} className="mx-auto mb-3 opacity-50" />
                  <p>No detection events yet</p>
                  <p className="text-sm mt-1">Events will appear here in real-time</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {detectionEvents.map((event) => (
                    <div 
                      key={event.id} 
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        event.isCritical ? 'bg-red-50 border-l-4 border-red-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{getHealthEmoji(event.healthClass)}</span>
                          <div>
                            <p className="font-semibold text-gray-800">
                              Fish #{event.fishId}
                            </p>
                            <p className={`text-sm font-medium ${getHealthColor(event.healthClass)}`}>
                              {event.healthClass.toUpperCase()}
                            </p>
                          </div>
                        </div>
                        {event.isCritical && (
                          <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">
                            CRITICAL
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>Confidence: {(event.confidence * 100).toFixed(1)}%</p>
                        <p className="text-xs text-gray-500">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      
                      {event.needsAttention && !event.isCritical && (
                        <div className="mt-2 px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">
                          ⚠️ Needs Attention
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Health Statistics */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Health Status Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {['healthy', 'bacterial', 'fungal', 'parasitic', 'white_tail', 'dead'].map((status) => {
            const count = detectionEvents.filter(e => e.healthClass === status).length;
            const percentage = detectionEvents.length > 0 
              ? ((count / detectionEvents.length) * 100).toFixed(1) 
              : '0';
            
            return (
              <div key={status} className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-3xl mb-2">{getHealthEmoji(status)}</div>
                <p className={`font-bold text-2xl ${getHealthColor(status)}`}>{count}</p>
                <p className="text-sm text-gray-600 capitalize">{status.replace('_', ' ')}</p>
                <p className="text-xs text-gray-500 mt-1">{percentage}%</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PondCamera;
