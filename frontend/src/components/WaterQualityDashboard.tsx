import React, { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import type { SensorData } from '../services/api';
import { Wifi, WifiOff } from 'lucide-react';

// ===================== MQTT / BACKEND WS CONFIG =====================
// Strategy:
//   1. Try direct MQTT via mqtt.js  (requires port 8083 published in EMQX Docker compose)
//   2. If that fails within 10s → fall back to backend WebSocket relay /ws/feeding
//      (backend is connected to EMQX via TCP 1883 which always works)
const MQTT_DIRECT_URL: string =
  (import.meta.env.VITE_MQTT_WS_URL as string) ||
  'wss://mqtt.koifishfriend.online/mqtt';
const MQTT_USER     = 'admin';
const MQTT_PASSWORD = 'admin1234';

// Backend WebSocket relay — derives from VITE_API_URL automatically
const API_BASE: string = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8081';
const BACKEND_WS_URL: string = API_BASE
  .replace('https://', 'wss://')
  .replace('http://', 'ws://') + '/ws/feeding';

// Subscribe to all water-quality sensor data & status topics
const DATA_TOPIC   = 'koi/sensors/+/data';
const STATUS_TOPIC = 'koi/sensors/+/status';

interface WaterParameter {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'danger';
  icon: string;
  safeRange: { min: number; max: number };
  warningRange: { min: number; max: number };
  lastUpdated: Date;
}

interface MqttSensorData {
  deviceId: string;
  pondId: number;
  phValue: number;
  turbidity: number;
  co2Level: number;
  ammonia: number;
  dissolvedOxygen?: number;
  waterQualityStatus: string;
  timestamp?: number;
  rssi?: number;
}

const WaterQualityDashboard: React.FC = () => {
  const [mqttConnected, setMqttConnected] = useState(false);
  const [mqttStatus, setMqttStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [connectionMode, setConnectionMode] = useState<'mqtt' | 'relay' | 'none'>('none');
  const [signalStrength, setSignalStrength] = useState(0);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [latestData, setLatestData] = useState<SensorData | null>(null);
  const mqttClientRef = useRef<mqtt.MqttClient | null>(null);
  const backendWsRef  = useRef<WebSocket | null>(null);
  const mqttTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedRef  = useRef(false); // tracks live connection for timeout callback

  // ===================== SHARED DATA HANDLER =====================
  const handleSensorPayload = React.useCallback((raw: unknown) => {
    const data = raw as MqttSensorData;
    if (data.phValue === undefined || data.phValue === null) {
      if (data.rssi !== undefined) setSignalStrength(data.rssi);
      return;
    }
    if (data.rssi !== undefined) setSignalStrength(data.rssi);
    const sensorData: SensorData = {
      id: Date.now(),
      device: {
        id: 0,
        deviceId: data.deviceId,
        deviceType: 'WATER_QUALITY',
        pond: null,
        status: 'online',
        ipAddress: '',
        rssi: data.rssi || 0,
        energyWh: 0,
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      pond: null,
      voltage: 0, current: 0, power: 0, energyWh: 0,
      phValue: data.phValue,
      turbidity: data.turbidity,
      co2Level: data.co2Level,
      ammonia: data.ammonia,
      waterQualityStatus: data.waterQualityStatus,
      status: 'active',
      timestamp: new Date().toISOString(), // ESP32 sends millis() not Unix time, use current time
    };
    setLatestData(sensorData);
    setLastSync(new Date());
    // Supabase storage is handled by backend MqttService via the same MQTT message
  }, []);

  // ===================== BACKEND WS RELAY (fallback) =====================
  const connectBackendRelay = React.useCallback(() => {
    if (backendWsRef.current) {
      backendWsRef.current.close();
      backendWsRef.current = null;
    }
    console.log('🔌 [WATER QUALITY] Connecting to backend WS relay:', BACKEND_WS_URL);
    setMqttStatus('connecting');

    const ws = new WebSocket(BACKEND_WS_URL);
    backendWsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ [WATER QUALITY] Backend WS relay connected');
      connectedRef.current = true;
      setMqttConnected(true);
      setMqttStatus('connected');
      setConnectionMode('relay');
    };

    ws.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data as string);
        // Only handle WQ_ device messages
        if (raw.deviceId && !String(raw.deviceId).startsWith('WQ_')) return;
        handleSensorPayload(raw);
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      console.warn('🔌 [WATER QUALITY] Backend WS relay disconnected, retrying in 5s...');
      connectedRef.current = false;
      setMqttConnected(false);
      setMqttStatus('disconnected');
      setConnectionMode('none');
      setTimeout(connectBackendRelay, 5000);
    };

    ws.onerror = (err) => {
      console.error('❌ [WATER QUALITY] Backend WS relay error:', err);
      setMqttStatus('error');
    };
  }, [handleSensorPayload]);

  // ===================== MQTT DIRECT CONNECTION (primary) =====================
  useEffect(() => {
    // If page is HTTPS and MQTT URL is ws://, skip direct MQTT and go straight to relay
    const isHttps = window.location.protocol === 'https:';
    const isMqttInsecure = MQTT_DIRECT_URL.startsWith('ws://');
    if (isHttps && isMqttInsecure) {
      console.log('🔒 Page is HTTPS — skipping insecure ws:// MQTT, using backend relay');
      connectBackendRelay();
      return () => {
        if (backendWsRef.current) backendWsRef.current.close();
        clearTimeout(mqttTimeoutRef.current ?? undefined);
      };
    }

    console.log('🌐 [WATER QUALITY] Trying direct MQTT:', MQTT_DIRECT_URL);
    setMqttStatus('connecting');

    const client = mqtt.connect(MQTT_DIRECT_URL, {
      username: MQTT_USER,
      password: MQTT_PASSWORD,
      clientId: `wq-dashboard-${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      reconnectPeriod: 0,    // Disable auto-reconnect — we handle it manually with fallback
      connectTimeout: 10000,
      keepalive: 30,
    });

    mqttClientRef.current = client;

    // If no CONNACK within 10 seconds → kill MQTT, fall back to backend relay
    mqttTimeoutRef.current = setTimeout(() => {
      if (!connectedRef.current) {
        console.warn('⏱️ [WATER QUALITY] MQTT direct timeout — switching to backend WS relay');
        client.end(true);
        mqttClientRef.current = null;
        connectBackendRelay();
      }
    }, 10000);

    client.on('connect', () => {
      if (mqttTimeoutRef.current) clearTimeout(mqttTimeoutRef.current);
      console.log('✅ [WATER QUALITY] Direct MQTT connected');
      connectedRef.current = true;
      setMqttConnected(true);
      setMqttStatus('connected');
      setConnectionMode('mqtt');

      client.subscribe([DATA_TOPIC, STATUS_TOPIC], { qos: 1 }, (err) => {
        if (err) console.error('❌ MQTT subscribe error:', err);
        else console.log('📡 Subscribed to:', DATA_TOPIC, STATUS_TOPIC);
      });
    });

    client.on('message', (topic: string, payload: Buffer) => {
      try {
        const raw = JSON.parse(payload.toString());
        if (topic.endsWith('/status')) {
          if (raw.rssi !== undefined) setSignalStrength(raw.rssi);
          return;
        }
        handleSensorPayload(raw);
      } catch (err) {
        console.error('❌ Failed to parse MQTT message:', err);
      }
    });

    client.on('reconnect', () => {
      setMqttConnected(false);
      setMqttStatus('connecting');
    });

    client.on('offline', () => {
      console.warn('📴 [WATER QUALITY] MQTT offline');
      connectedRef.current = false;
      setMqttConnected(false);
      setMqttStatus('disconnected');
      setConnectionMode('none');
      // Offline after being connected — fall back to relay
      client.end(true);
      mqttClientRef.current = null;
      connectBackendRelay();
    });

    client.on('error', (err) => {
      console.error('❌ [WATER QUALITY] MQTT error:', err.message);
      setMqttStatus('error');
    });

    return () => {
      if (mqttTimeoutRef.current) clearTimeout(mqttTimeoutRef.current);
      client.end(true);
      mqttClientRef.current = null;
      if (backendWsRef.current) backendWsRef.current.close();
    };
  }, [connectBackendRelay, handleSensorPayload]);

  // Check if we have real data
  const hasRealData = latestData && latestData.phValue !== undefined && latestData.phValue !== null;

  // Convert sensor data to parameter format - only when real data exists
  const parameters: WaterParameter[] = React.useMemo(() => {
    if (!hasRealData) {
      return []; // Return empty array when no real data
    }

    const getStatus = (value: number, safe: {min: number, max: number}, warning: {min: number, max: number}): 'normal' | 'warning' | 'danger' => {
      if (value >= safe.min && value <= safe.max) return 'normal';
      if (value >= warning.min && value <= warning.max) return 'warning';
      return 'danger';
    };

    const timestamp = new Date(latestData.timestamp);

    return [
      {
        id: 'turbidity',
        name: 'Turbidity',
        value: Number((latestData.turbidity || 0).toFixed(2)),
        unit: 'NTU',
        status: getStatus(latestData.turbidity || 0, { min: 0, max: 25 }, { min: 0, max: 40 }),
        icon: '💧',
        safeRange: { min: 0, max: 25 },
        warningRange: { min: 0, max: 40 },
        lastUpdated: timestamp,
      },
      {
        id: 'ph',
        name: 'pH Level',
        value: Number((latestData.phValue || 7.0).toFixed(2)),
        unit: 'pH',
        status: getStatus(latestData.phValue || 7.0, { min: 6.5, max: 8.5 }, { min: 6.0, max: 9.0 }),
        icon: '⚗️',
        safeRange: { min: 6.5, max: 8.5 },
        warningRange: { min: 6.0, max: 9.0 },
        lastUpdated: timestamp,
      },
      {
        id: 'co2',
        name: 'CO₂ Level',
        value: Number((latestData.co2Level || 400).toFixed(0)),
        unit: 'PPM',
        status: getStatus(latestData.co2Level || 400, { min: 400, max: 1000 }, { min: 400, max: 2000 }),
        icon: '🌫️',
        safeRange: { min: 400, max: 1000 },
        warningRange: { min: 400, max: 2000 },
        lastUpdated: timestamp,
      },
      {
        id: 'ammonia',
        name: 'Ammonia (NH₃)',
        value: Number((latestData.ammonia || 0).toFixed(3)),
        unit: 'PPM',
        status: getStatus(latestData.ammonia || 0, { min: 0, max: 0.5 }, { min: 0, max: 1.0 }),
        icon: '⚠️',
        safeRange: { min: 0, max: 0.5 },
        warningRange: { min: 0, max: 1.0 },
        lastUpdated: timestamp,
      },
    ];
  }, [latestData, hasRealData]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'normal':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">NORMAL</span>;
      case 'warning':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">WARNING</span>;
      case 'danger':
        return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">DANGER</span>;
      default:
        return null;
    }
  };

  const getConnectionStatusBadge = () => {
    const statusConfig = {
      connected:    { icon: <Wifi className="text-green-500 w-4 h-4" />,  label: connectionMode === 'relay' ? '🔗 Backend Relay' : '🌐 MQTT Direct', sub: connectionMode === 'relay' ? 'via backend /ws/feeding' : 'EMQX Self-Hosted', color: 'text-green-600' },
      connecting:   { icon: <Wifi className="text-yellow-500 w-4 h-4 animate-pulse" />, label: '⏳ Connecting…', sub: 'trying MQTT → relay fallback', color: 'text-yellow-600' },
      disconnected: { icon: <WifiOff className="text-gray-400 w-4 h-4" />, label: '📴 Disconnected', sub: 'Retrying…',                color: 'text-gray-500' },
      error:        { icon: <WifiOff className="text-red-500 w-4 h-4" />,  label: '❌ Error',        sub: 'Check broker or backend', color: 'text-red-600' },
    };
    const cfg = statusConfig[mqttStatus];
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
          {cfg.icon}
          <div className="text-right">
            <div className={`font-semibold text-xs ${cfg.color}`}>{cfg.label}</div>
            <div className="text-xs text-gray-500">{cfg.sub}</div>
          </div>
        </div>
        {signalStrength !== 0 && (
          <div className="text-right text-xs">
            <span className={`font-semibold ${
              signalStrength >= -50 ? 'text-green-600' :
              signalStrength >= -70 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              Signal: {signalStrength >= -50 ? 'Excellent' : signalStrength >= -70 ? 'Good' : 'Weak'} ({signalStrength} dBm)
            </span>
          </div>
        )}
      </div>
    );
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleString();
  };

  const getProgressPercentage = (value: number, min: number, max: number) => {
    return Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
  };

  return (
    <div className="space-y-6">
      {/* Header with Pond Selection and Status */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">🌊</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Water Quality Monitor</h2>
              <p className="text-sm text-gray-500">Real-time monitoring and alerts</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 font-medium">
              <span>📡</span>
              <span>Water Quality Device</span>
            </div>
            {getConnectionStatusBadge()}
          </div>
        </div>
      </div>

      {/* Last Sync Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
        <i className="fas fa-info-circle text-blue-600 text-xl"></i>
        <div className="flex-1">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Last updated:</span> {formatTimestamp(lastSync)}
            {mqttConnected && <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-semibold">LIVE</span>}
          </p>
          <p className="text-xs text-blue-600 mt-1">
            {mqttConnected
              ? connectionMode === 'mqtt'
                ? '⚡ Direct MQTT — EMQX Self-Hosted (Supabase stored via backend)'
                : '🔗 Backend relay — ESP32 → EMQX → Backend → Browser (Supabase stored)'
              : '⏳ Waiting for connection… (trying MQTT direct, then backend relay)'
            }
          </p>
        </div>
        {mqttConnected && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs font-semibold text-green-700">STREAMING</span>
          </div>
        )}
      </div>

      {/* Water Quality Parameter Cards */}
      {!hasRealData ? (
        <div className="bg-white rounded-xl shadow-sm p-12 border-2 border-dashed border-gray-300 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
              <i className="fas fa-plug-circle-xmark text-4xl text-gray-400"></i>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Sensor Data Available</h3>
              <p className="text-gray-500 mb-1">
                Water quality sensor is not connected or not sending data
              </p>
              <p className="text-sm text-gray-400">
                Make sure the ESP32 device is powered on and connected to WiFi
              </p>
            </div>
            <div className="flex gap-3 mt-4">
              <button className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium transition-colors">
                <i className="fas fa-sync-alt mr-2"></i>Retry Connection
              </button>
              <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
                <i className="fas fa-book mr-2"></i>Troubleshooting Guide
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {parameters.map((param) => (
          <div
            key={param.id}
            className={`bg-white rounded-xl shadow-sm border-2 p-6 transition-all duration-300 hover:shadow-lg ${
              param.status === 'normal' ? 'border-gray-200' : 
              param.status === 'warning' ? 'border-yellow-300' : 
              'border-red-300'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-4xl">{param.icon}</div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-lg">{param.name}</h3>
                  <p className="text-xs text-gray-500">{formatTimestamp(param.lastUpdated)}</p>
                </div>
              </div>
              {getStatusBadge(param.status)}
            </div>

            {/* Value Display */}
            <div className="mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-gray-800">
                  {param.id === 'dissolvedOxygen' ? param.value.toFixed(2) : param.value.toFixed(2)}
                </span>
                <span className="text-lg text-gray-600">{param.unit}</span>
              </div>
            </div>

            {/* Safe Range Indicator */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Min: {param.safeRange.min}</span>
                <span>Max: {param.safeRange.max}</span>
              </div>
              <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                {/* Safe zone (green) */}
                <div
                  className="absolute h-full bg-green-200"
                  style={{
                    left: `${getProgressPercentage(param.safeRange.min, param.warningRange.min, param.warningRange.max)}%`,
                    width: `${
                      getProgressPercentage(param.safeRange.max, param.warningRange.min, param.warningRange.max) -
                      getProgressPercentage(param.safeRange.min, param.warningRange.min, param.warningRange.max)
                    }%`,
                  }}
                />
                {/* Current value indicator */}
                <div
                  className={`absolute h-full w-1 ${
                    param.status === 'normal' ? 'bg-green-600' : 
                    param.status === 'warning' ? 'bg-yellow-600' : 
                    'bg-red-600'
                  }`}
                  style={{
                    left: `${getProgressPercentage(param.value, param.warningRange.min, param.warningRange.max)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center">
                Safe Range: {param.safeRange.min} - {param.safeRange.max} {param.unit}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
              <button className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors">
                <i className="fas fa-chart-line mr-1"></i> View Trend
              </button>
              <button className="flex-1 px-3 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs font-medium transition-colors">
                <i className="fas fa-flask mr-1"></i> Log Treatment
              </button>
            </div>
          </div>
          ))}
        </div>
      )}

      {/* Quick Actions Panel */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <i className="fas fa-bolt text-cyan-500"></i> Quick Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 rounded-lg border border-blue-200 transition-all">
            <i className="fas fa-plus-circle text-2xl text-blue-600"></i>
            <span className="text-sm font-medium text-gray-700">Add Treatment</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-lg border border-purple-200 transition-all">
            <i className="fas fa-wrench text-2xl text-purple-600"></i>
            <span className="text-sm font-medium text-gray-700">Calibrate Sensors</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 rounded-lg border border-green-200 transition-all">
            <i className="fas fa-file-export text-2xl text-green-600"></i>
            <span className="text-sm font-medium text-gray-700">Export Report</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-orange-50 to-yellow-50 hover:from-orange-100 hover:to-yellow-100 rounded-lg border border-orange-200 transition-all">
            <i className="fas fa-bell text-2xl text-orange-600"></i>
            <span className="text-sm font-medium text-gray-700">View Alerts</span>
          </button>
        </div>
      </div>

      {/* Status Summary - Only show when data is available */}
      {hasRealData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-check-circle text-2xl text-green-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-600">Normal Parameters</p>
                <p className="text-2xl font-bold text-gray-800">
                  {parameters.filter(p => p.status === 'normal').length}/{parameters.length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-exclamation-triangle text-2xl text-yellow-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-600">Warnings</p>
                <p className="text-2xl font-bold text-gray-800">
                  {parameters.filter(p => p.status === 'warning').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-exclamation-circle text-2xl text-red-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-600">Critical Alerts</p>
                <p className="text-2xl font-bold text-gray-800">
                  {parameters.filter(p => p.status === 'danger').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaterQualityDashboard;
