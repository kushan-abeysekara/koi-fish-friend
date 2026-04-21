import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square, Wifi, WifiOff, AlertCircle, Video, Activity } from 'lucide-react';
import MediaMTXCameraFeed from '../components/MediaMTXCameraFeed';
import BoatTilt3D from '../components/BoatTilt3D';
import { supabase, supabasePgQuery } from '../services/supabase';

// ═══════════════════════════════════════════════════════════════════
// DATA STRATEGY:
//   Display: Supabase Realtime (PRIMARY) + REST polling (FALLBACK)
//   Commands: REST API → Backend → MQTT → ESP32
//   ESP32 → EMQX → Backend → Supabase DB → Frontend (Realtime)
// ═══════════════════════════════════════════════════════════════════

// Backend REST API (for commands + polling fallback)
// In dev without VITE_API_URL set, falls back to '' so Vite proxy (/api → backend) is used
const API_URL: string = (import.meta.env.VITE_API_URL as string) || '';

// Supabase table
const BOAT_TABLE = 'boat_telemetry';

interface SensorData {
  voltage: number;
  distanceFront: number;
  distanceBack: number;
  distanceLeft: number;
  distanceRight: number;
  angleX: number;
  angleY: number;
  temperature: number;
  mode: string;
  motorLeft: number;
  motorRight: number;
  command: string;
  rssi: number;
  connected: boolean;
}

const DEFAULT_SENSOR: SensorData = {
  voltage: 0, distanceFront: 0, distanceBack: 0, distanceLeft: 0, distanceRight: 0,
  angleX: 0, angleY: 0, temperature: 0, mode: 'manual',
  motorLeft: 0, motorRight: 0, command: 'STOP', rssi: 0, connected: false,
};

const BoatNavigation: React.FC = () => {
  const [speed, setSpeed] = useState(150);
  const [isConnected, setIsConnected] = useState(false);
  const [currentCommand, setCurrentCommand] = useState('STOP');
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [connectionMode, setConnectionMode] = useState<'supabase' | 'rest' | 'none'>('none');
  const [sensorData, setSensorData] = useState<SensorData>(DEFAULT_SENSOR);
  const [dataSource, setDataSource] = useState<'supabase' | 'rest' | 'none'>('none');
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const lastUpdateRef = useRef<number>(0);

  // Keep refs in sync
  useEffect(() => { lastUpdateRef.current = lastUpdate; }, [lastUpdate]);

  // ─── Parse incoming boat data from any source ───
  const parseSensorPayload = useCallback((data: Record<string, unknown>): Partial<SensorData> => ({
    voltage: (data.voltage as number) ?? 0,
    distanceFront: (data.distanceFront as number) ?? 0,
    distanceBack: (data.distanceBack as number) ?? 0,
    distanceLeft: (data.distanceLeft as number) ?? 0,
    distanceRight: (data.distanceRight as number) ?? 0,
    angleX: (data.angleX as number) ?? 0,
    angleY: (data.angleY as number) ?? 0,
    temperature: (data.temperature as number) ?? 0,
    mode: (data.mode as string) ?? 'manual',
    motorLeft: (data.motorLeft as number) ?? 0,
    motorRight: (data.motorRight as number) ?? 0,
    command: (data.command as string) ?? 'STOP',
    rssi: (data.rssi as number) ?? 0,
    connected: (data.connected as boolean) ?? true,
  }), []);

  // ─── Update sensor data from any source ───
  const updateSensor = useCallback((data: Partial<SensorData>, source: 'supabase' | 'rest') => {
    console.log(`📊 [BOAT] Data from ${source}:`, { angleX: data.angleX, angleY: data.angleY, voltage: data.voltage, temp: data.temperature });
    setSensorData(prev => ({ ...prev, ...data }));
    setDataSource(source);
    setLastUpdate(Date.now());
    setIsConnected(true);
    if (data.command) setCurrentCommand(data.command);
  }, []);

  // ═══ Supabase Realtime (PRIMARY data source — fastest) ═══
  useEffect(() => {
    // Initial load: fetch latest row from boat_telemetry immediately
    const loadInitial = async () => {
      try {
        const rows = await supabasePgQuery<Record<string, unknown>>(
          `SELECT * FROM ${BOAT_TABLE} WHERE device_id = 'BOAT_ESP32_001' ORDER BY updated_at DESC LIMIT 1`
        );
        if (rows.length > 0) {
          const row = rows[0];
          console.log('🚀 [BOAT] Initial Supabase load:', row);
          updateSensor({
            voltage: (row.voltage as number) ?? 0,
            distanceFront: (row.distance_front as number) ?? 0,
            distanceBack: (row.distance_back as number) ?? 0,
            distanceLeft: (row.distance_left as number) ?? 0,
            distanceRight: (row.distance_right as number) ?? 0,
            angleX: (row.angle_x as number) ?? 0,
            angleY: (row.angle_y as number) ?? 0,
            temperature: (row.temperature as number) ?? 0,
            mode: (row.mode as string) ?? 'manual',
            command: (row.command as string) ?? 'STOP',
            motorLeft: (row.motor_left as number) ?? 0,
            motorRight: (row.motor_right as number) ?? 0,
            rssi: (row.rssi as number) ?? 0,
            connected: true,
          }, 'supabase');
          setConnectionMode('supabase');
        }
      } catch (err) {
        console.warn('[BOAT] Initial Supabase load failed:', err);
      }
    };
    loadInitial();

    if (!supabase) return;

    // Subscribe to real-time changes on boat_telemetry table
    const channel = supabase
      .channel('boat-telemetry-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: BOAT_TABLE, filter: 'device_id=eq.BOAT_ESP32_001' },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as Record<string, unknown>;
          if (!row) return;
          console.log('⚡ [BOAT] Supabase Realtime update:', { voltage: row.voltage, angle_x: row.angle_x, angle_y: row.angle_y });
          updateSensor({
            voltage: (row.voltage as number) ?? 0,
            distanceFront: (row.distance_front as number) ?? 0,
            distanceBack: (row.distance_back as number) ?? 0,
            distanceLeft: (row.distance_left as number) ?? 0,
            distanceRight: (row.distance_right as number) ?? 0,
            angleX: (row.angle_x as number) ?? 0,
            angleY: (row.angle_y as number) ?? 0,
            temperature: (row.temperature as number) ?? 0,
            mode: (row.mode as string) ?? 'manual',
            command: (row.command as string) ?? 'STOP',
            motorLeft: (row.motor_left as number) ?? 0,
            motorRight: (row.motor_right as number) ?? 0,
            rssi: (row.rssi as number) ?? 0,
            connected: true,
          }, 'supabase');
          setConnectionMode('supabase');
        }
      )
      .subscribe((status: string) => {
        console.log('📡 [BOAT] Supabase Realtime status:', status);
        if (status === 'SUBSCRIBED') {
          setSupabaseConnected(true);
          setConnectionMode('supabase');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setSupabaseConnected(false);
          // Let REST polling take over
          setConnectionMode(prev => prev === 'supabase' ? 'rest' : prev);
        }
      });

    return () => { supabase?.removeChannel(channel); };
  }, [updateSensor]);

  // ═══ REST API Polling (FALLBACK — every 3s when Supabase data is stale) ═══
  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      while (!stopped) {
        // Poll only if no fresh data from Supabase (>4s stale)
        const freshEnough = Date.now() - lastUpdateRef.current < 4000;
        if (!freshEnough) {
          try {
            const resp = await fetch(`${API_URL}/api/boat/telemetry`);
            if (resp.ok) {
              const raw = await resp.json();
              if (raw && raw.deviceId && raw.voltage !== undefined) {
                console.log('🔄 [BOAT] REST fallback poll:', { voltage: raw.voltage, angleX: raw.angleX, angleY: raw.angleY });
                updateSensor(parseSensorPayload(raw as Record<string, unknown>), 'rest');
                if (connectionMode === 'none') setConnectionMode('rest');
              }
            }
          } catch {
            // Silently ignore — this is a fallback
          }
        }
        await new Promise(r => setTimeout(r, 3000)); // Poll every 3s
      }
    };
    poll();
    return () => { stopped = true; };
  }, [updateSensor, parseSensorPayload, connectionMode]);

  // ─── Stale data detection ───
  useEffect(() => {
    const interval = setInterval(() => {
      const stale = Date.now() - lastUpdateRef.current > 10000;
      if (stale) setIsConnected(false);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // ─── Send Command via Backend REST API → MQTT → ESP32 ───
  const sendCommand = useCallback((command: string) => {
    setCurrentCommand(command);
    fetch(`${API_URL}/api/boat/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, speed }),
    })
      .then(() => console.log('🚀 Command sent:', command, 'speed:', speed))
      .catch(err => console.error('❌ Command failed:', err));
  }, [speed]);

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseInt(e.target.value);
    setSpeed(newSpeed);
    // Send speed update via REST → MQTT
    fetch(`${API_URL}/api/boat/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'SPEED', speed: newSpeed }),
    }).catch(() => {});
  };

  const handleEmergencyStop = () => {
    sendCommand('STOP');
    setSpeed(0);
  };

  // ─── Keyboard Controls ───
  useEffect(() => {
    const keyMap: Record<string, string> = {
      ArrowUp: 'FORWARD', w: 'FORWARD', W: 'FORWARD',
      ArrowDown: 'BACKWARD', s: 'BACKWARD', S: 'BACKWARD',
      ArrowLeft: 'LEFT_ONLY', a: 'LEFT_ONLY', A: 'LEFT_ONLY',
      ArrowRight: 'RIGHT_ONLY', d: 'RIGHT_ONLY', D: 'RIGHT_ONLY',
      ' ': 'STOP',
    };
    const down = (e: KeyboardEvent) => {
      const cmd = keyMap[e.key];
      if (cmd) { e.preventDefault(); sendCommand(cmd); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [sendCommand]);

  const getSpeedLabel = () => {
    const pct = Math.round((speed / 255) * 100);
    if (pct < 33) return 'Slow';
    if (pct < 67) return 'Medium';
    return 'Fast';
  };

  const getObstacleColor = (dist: number) => {
    if (dist <= 0) return 'text-gray-400';
    if (dist < 15) return 'text-red-500 font-bold';
    if (dist < 30) return 'text-yellow-500';
    return 'text-green-500';
  };

  const dataFresh = lastUpdate > 0 && (Date.now() - lastUpdate) < 5000;

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
                <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
                <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Boat Navigation</h1>
              <p className="text-gray-500 text-sm">MQTT Remote Control + Live Telemetry</p>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-3">
            {/* Connection Mode */}
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
              supabaseConnected || isConnected
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200 animate-pulse'
            }`}>
              {supabaseConnected || isConnected ? <Wifi className="text-green-500 w-5 h-5" /> : <WifiOff className="text-red-500 w-5 h-5" />}
              <div>
                <div className={`font-semibold text-sm ${supabaseConnected || isConnected ? 'text-green-600' : 'text-red-500'}`}>
                  {connectionMode === 'supabase' ? '☁️ Supabase Realtime'
                    : connectionMode === 'rest' ? '🔄 REST Polling'
                    : 'Connecting...'}
                </div>
                <div className="text-xs text-gray-500">
                  {connectionMode === 'supabase' ? 'Live DB Updates' 
                    : connectionMode === 'rest' ? 'Polling every 3s'
                    : 'Waiting for data...'}
                </div>
              </div>
            </div>

            {/* Data Freshness */}
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 ${
              dataFresh ? 'bg-cyan-50 border-cyan-200' : 'bg-gray-50 border-gray-200'
            }`}>
              <Activity className={`w-4 h-4 ${dataFresh ? 'text-cyan-500' : 'text-gray-400'}`} />
              <div className="text-xs">
                <div className={`font-semibold ${dataFresh ? 'text-cyan-600' : 'text-gray-500'}`}>
                  {dataFresh ? `Live (${dataSource})` : 'No Data'}
                </div>
                {dataFresh && <div className="text-gray-400">RSSI: {sensorData.rssi} dBm</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ─── Left Column: Camera + 3D Tilt ─── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Live Camera Feed */}
          <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <div className="bg-gray-700 px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold">Live Camera Feed</h2>
                <p className="text-gray-400 text-sm">Boat POV via MediaMTX HLS</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400 text-xs font-semibold">LIVE</span>
              </div>
            </div>
            <div className="aspect-video">
              <MediaMTXCameraFeed className="w-full h-full" showStatus={true} />
            </div>
            <div className="bg-gray-700 px-4 py-2 text-center">
              <div className="flex items-center justify-center gap-4 text-gray-300 text-sm">
                <span className="flex items-center gap-2">
                  <Video size={14} className="text-cyan-400" />
                  HLS Stream
                </span>
                <span>|</span>
                <span>⌨️ Arrow / WASD + Space</span>
              </div>
            </div>
          </div>

          {/* 3D Boat Tilt + Radar Obstacle Visualization */}
          <BoatTilt3D
            angleX={sensorData.angleX}
            angleY={sensorData.angleY}
            temperature={sensorData.temperature}
            voltage={sensorData.voltage}
            distanceFront={sensorData.distanceFront}
            distanceBack={sensorData.distanceBack}
            distanceLeft={sensorData.distanceLeft}
            distanceRight={sensorData.distanceRight}
            motorLeft={sensorData.motorLeft}
            motorRight={sensorData.motorRight}
            command={sensorData.command}
          />
        </div>

        {/* ─── Right Column: Controls + Status ─── */}
        <div className="space-y-5">
          {/* Emergency Stop */}
          <button
            onClick={handleEmergencyStop}
            className="w-full py-5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xl rounded-xl transition-all shadow-lg flex items-center justify-center gap-3"
          >
            <AlertCircle size={28} />
            EMERGENCY STOP
          </button>

          {/* Speed Control */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Speed Control</h3>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Speed: {Math.round((speed / 255) * 100)}%</span>
              <span className="text-sm font-semibold text-cyan-600">{getSpeedLabel()}</span>
            </div>
            <input
              type="range" min="0" max="255" value={speed}
              onChange={handleSpeedChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0%</span><span>Slow</span><span>Medium</span><span>Fast</span><span>100%</span>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Navigation Controls</h3>
            <div className="flex flex-col items-center gap-3 mb-4">
              <button
                onClick={() => sendCommand('FORWARD')}
                className="w-20 h-20 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white rounded-xl shadow-lg flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
              >
                <ArrowUp size={32} />
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => sendCommand('LEFT_ONLY')}
                  className="w-20 h-20 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white rounded-xl shadow-lg flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
                >
                  <ArrowLeft size={32} />
                </button>
                <button
                  onClick={() => sendCommand('STOP')}
                  className="w-20 h-20 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-xl shadow-lg flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
                >
                  <Square size={32} fill="white" />
                </button>
                <button
                  onClick={() => sendCommand('RIGHT_ONLY')}
                  className="w-20 h-20 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white rounded-xl shadow-lg flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
                >
                  <ArrowRight size={32} />
                </button>
              </div>
              <button
                onClick={() => sendCommand('BACKWARD')}
                className="w-20 h-20 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white rounded-xl shadow-lg flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
              >
                <ArrowDown size={32} />
              </button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <p className="text-sm text-blue-700 font-semibold">
                💡 Click once to move continuously. Click STOP (red) to halt.
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Commands: REST → Backend → MQTT → ESP32 | Data: Supabase Realtime
              </p>
            </div>
          </div>

          {/* Real-Time Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Live Status</h3>
              {dataFresh && (
                <span className="flex items-center gap-1 text-xs text-green-500">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  Live
                </span>
              )}
            </div>
            
            <div className="space-y-2.5">
              <StatusRow label="Connection" value={isConnected ? 'Online' : 'Offline'} valueClass={isConnected ? 'text-green-500' : 'text-red-500'} />
              <StatusRow label="Command" value={currentCommand} valueClass="text-cyan-600" />
              <StatusRow label="Mode" value={sensorData.mode} valueClass="text-gray-800 capitalize" />
              <StatusRow label="Voltage" value={`${sensorData.voltage.toFixed(1)}V`} valueClass={sensorData.voltage > 5.5 ? 'text-green-600' : 'text-red-500'} />
              <StatusRow label="Motors" value={`L:${sensorData.motorLeft} R:${sensorData.motorRight}`} valueClass="text-gray-700" />
              <StatusRow label="Data Via" value={connectionMode === 'supabase' ? 'Supabase Realtime' : connectionMode === 'rest' ? 'REST Polling' : '—'} valueClass="text-blue-500" />

              {/* Obstacle Distances */}
              <div className="border-t pt-3 mt-3">
                <p className="text-sm font-medium text-gray-600 mb-2">Obstacle Distance (cm)</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <ObstacleCell label="Front" value={sensorData.distanceFront} colorFn={getObstacleColor} />
                  <ObstacleCell label="Back" value={sensorData.distanceBack} colorFn={getObstacleColor} />
                  <ObstacleCell label="Left" value={sensorData.distanceLeft} colorFn={getObstacleColor} />
                  <ObstacleCell label="Right" value={sensorData.distanceRight} colorFn={getObstacleColor} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Helper Sub-Components ───
const StatusRow: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass = 'text-gray-800' }) => (
  <div className="flex justify-between items-center">
    <span className="text-gray-500 text-sm">{label}:</span>
    <span className={`font-semibold text-sm ${valueClass}`}>{value}</span>
  </div>
);

const ObstacleCell: React.FC<{ label: string; value: number; colorFn: (v: number) => string }> = ({ label, value, colorFn }) => (
  <div className="bg-gray-50 p-2 rounded-lg flex justify-between items-center">
    <span className="text-gray-500 text-xs">{label}:</span>
    <span className={`font-bold text-sm ${colorFn(value)}`}>{value.toFixed(0)}</span>
  </div>
);

export default BoatNavigation;
