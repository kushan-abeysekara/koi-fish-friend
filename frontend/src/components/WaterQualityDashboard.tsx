import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SensorData } from '../services/api';
import { waterQualityLiveApi, type SupabaseSensorLiveRow } from '../services/api';
import { supabasePgQuery } from '../services/supabase';
import { Wifi, WifiOff } from 'lucide-react';

// ===================== SUPABASE POLLING CONFIG =====================
// Strategy: Poll Supabase pg/query every 3 seconds for sensor_live data.
// This is the most reliable approach for self-hosted Supabase where
// Realtime and WebSocket connections are unstable.

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

interface SensorPayloadData {
  deviceId?: string;
  device_id?: string;
  pondId?: number;
  phValue?: number;
  ph_value?: number;
  turbidity?: number;
  co2Level?: number;
  co2_level?: number;
  ammonia?: number;
  dissolvedOxygen?: number;
  rainLevel?: number;
  rain_level?: number;
  rainDetected?: boolean;
  rain_detected?: boolean;
  rainStatus?: string;
  rain_status?: string;
  waterQualityStatus?: string;
  water_quality_status?: string;
  timestamp?: number;
  rssi?: number;
  source?: string;
}

const WaterQualityDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [connectionMode, setConnectionMode] = useState<'supabase' | 'relay' | 'none'>('none');
  const [signalStrength, setSignalStrength] = useState(0);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [latestData, setLatestData] = useState<SensorData | null>(null);
  const [dataSource, setDataSource] = useState<'live' | 'cached' | 'none'>('none');
  const [cachedTimestamp, setCachedTimestamp] = useState<string | null>(null);
  const hasReceivedLive = useRef(false); // track if we've received live data
  const pollFailCount = useRef(0);

  // ===================== FETCH LAST-KNOWN DATA FROM SUPABASE =====================
  useEffect(() => {
    const fetchCachedData = async () => {
      try {
        const rows = await waterQualityLiveApi.getLatest();
        // Find the first WQ_ device row
        const wqRow = Array.isArray(rows)
          ? rows.find((r: SupabaseSensorLiveRow) => r.device_id?.startsWith('WQ_'))
          : null;
        if (wqRow && !hasReceivedLive.current) {
          // Map Supabase row to SensorData format
          const cachedSensorData: SensorData = {
            id: Date.now(),
            device: {
              id: 0,
              deviceId: wqRow.device_id,
              deviceType: 'WATER_QUALITY',
              pond: null,
              status: 'online',
              ipAddress: '',
              rssi: wqRow.rssi || 0,
              energyWh: 0,
              lastSeen: wqRow.updated_at || new Date().toISOString(),
              createdAt: new Date().toISOString(),
            },
            pond: null,
            voltage: 0, current: 0, power: 0, energyWh: 0,
            phValue: wqRow.ph_value ?? 0,
            turbidity: wqRow.turbidity ?? 0,
            co2Level: wqRow.co2_level ?? 400,
            ammonia: wqRow.ammonia ?? 0,
            rainLevel: wqRow.rain_level ?? 0,
            rainDetected: wqRow.rain_detected ?? false,
            rainStatus: wqRow.rain_status ?? 'dry',
            waterQualityStatus: wqRow.water_quality_status ?? 'normal',
            status: wqRow.status ?? 'normal',
            timestamp: wqRow.updated_at || new Date().toISOString(),
          };
          setLatestData(cachedSensorData);
          setDataSource('cached');
          setCachedTimestamp(wqRow.updated_at);
          setLastSync(new Date(wqRow.updated_at));
          if (wqRow.rssi) setSignalStrength(wqRow.rssi);
          console.log('📦 [WATER QUALITY] Loaded cached data from Supabase:', wqRow.device_id);
        }
      } catch (err) {
        console.warn('⚠️ [WATER QUALITY] Could not fetch cached data from Supabase:', err);
      }
    };
    fetchCachedData();
  }, []);

  // ===================== SHARED DATA HANDLER =====================
  // Accepts both camelCase (backend WS relay) and snake_case (Supabase Realtime) keys
  const handleSensorPayload = React.useCallback((raw: unknown) => {
    const data = raw as SensorPayloadData;
    const ph = data.phValue ?? data.ph_value;
    if (ph === undefined || ph === null) {
      if (data.rssi !== undefined) setSignalStrength(data.rssi);
      return;
    }
    const rssi = data.rssi ?? 0;
    if (rssi) setSignalStrength(rssi);

    const sensorData: SensorData = {
      id: Date.now(),
      device: {
        id: 0,
        deviceId: data.deviceId ?? data.device_id ?? '',
        deviceType: 'WATER_QUALITY',
        pond: null,
        status: 'online',
        ipAddress: '',
        rssi,
        energyWh: 0,
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      pond: null,
      voltage: 0, current: 0, power: 0, energyWh: 0,
      phValue: ph,
      turbidity: data.turbidity ?? 0,
      co2Level: data.co2Level ?? data.co2_level ?? 400,
      ammonia: data.ammonia ?? 0,
      rainLevel: data.rainLevel ?? data.rain_level ?? 0,
      rainDetected: data.rainDetected ?? data.rain_detected ?? false,
      rainStatus: data.rainStatus ?? data.rain_status ?? 'dry',
      waterQualityStatus: data.waterQualityStatus ?? data.water_quality_status ?? 'normal',
      status: 'active',
      timestamp: new Date().toISOString(),
    };
    setLatestData(sensorData);
    setLastSync(new Date());
    setDataSource('live');
    hasReceivedLive.current = true;
  }, []);

  // ===================== BACKEND WS RELAY — REMOVED =====================
  // Supabase Realtime and WebSocket relay were unstable on our self-hosted
  // Supabase.  Replaced with reliable periodic polling below.

  // ===================== PERIODIC POLL (primary & only data source) =====================
  // Polls Supabase pg/query every 3 seconds — rock-solid on self-hosted Supabase
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const rows = await supabasePgQuery<SupabaseSensorLiveRow>(
          "SELECT * FROM sensor_live WHERE device_id LIKE 'WQ_%' ORDER BY updated_at DESC LIMIT 1"
        );
        if (!active || rows.length === 0) return;
        const row = rows[0];
        handleSensorPayload({
          device_id: row.device_id,
          ph_value: row.ph_value,
          turbidity: row.turbidity,
          co2_level: row.co2_level,
          ammonia: row.ammonia,
          water_quality_status: row.water_quality_status,
          rain_level: row.rain_level,
          rain_detected: row.rain_detected,
          rain_status: row.rain_status,
          rssi: row.rssi,
          source: 'poll',
        });
        // Poll succeeded → mark connected
        pollFailCount.current = 0;
        setConnectionStatus('connected');
        setConnectionMode('supabase');
      } catch {
        pollFailCount.current += 1;
        if (pollFailCount.current >= 3) {
          setConnectionStatus('disconnected');
          setConnectionMode('none');
        }
      }
    };
    poll(); // initial
    const interval = setInterval(poll, 3000);
    return () => { active = false; clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSensorPayload]);

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
      {
        id: 'rain',
        name: 'Rain Level',
        value: Number((latestData.rainLevel || 0).toFixed(1)),
        unit: '%',
        status: (latestData.rainLevel || 0) < 10 ? 'normal' : (latestData.rainLevel || 0) < 40 ? 'warning' : 'danger',
        icon: '🌧️',
        safeRange: { min: 0, max: 10 },
        warningRange: { min: 0, max: 60 },
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
      connected:    { icon: <Wifi className="text-green-500 w-4 h-4" />,  label: '⚡ Supabase Live', sub: 'Polling sensor_live every 3s', color: 'text-green-600' },
      connecting:   { icon: <Wifi className="text-yellow-500 w-4 h-4 animate-pulse" />, label: '⏳ Connecting…', sub: 'Fetching sensor data…', color: 'text-yellow-600' },
      disconnected: { icon: <WifiOff className="text-gray-400 w-4 h-4" />, label: '📴 Disconnected', sub: 'Poll failed — retrying…',                color: 'text-gray-500' },
      error:        { icon: <WifiOff className="text-red-500 w-4 h-4" />,  label: '❌ Error',        sub: 'Check Supabase connection', color: 'text-red-600' },
    };
    const cfg = statusConfig[connectionStatus];
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
      <div className={`rounded-lg p-4 flex items-center gap-3 border ${
        dataSource === 'live' ? 'bg-blue-50 border-blue-200' :
        dataSource === 'cached' ? 'bg-amber-50 border-amber-200' :
        'bg-blue-50 border-blue-200'
      }`}>
        <i className={`fas text-xl ${
          dataSource === 'cached' ? 'fa-database text-amber-600' : 'fa-info-circle text-blue-600'
        }`}></i>
        <div className="flex-1">
          <p className={`text-sm ${dataSource === 'cached' ? 'text-amber-800' : 'text-blue-800'}`}>
            <span className="font-semibold">Last updated:</span> {formatTimestamp(lastSync)}
            {dataSource === 'live' && <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-semibold">LIVE</span>}
            {dataSource === 'cached' && <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-semibold">LAST KNOWN</span>}
          </p>
          <p className={`text-xs mt-1 ${dataSource === 'cached' ? 'text-amber-600' : 'text-blue-600'}`}>
            {dataSource === 'live'
              ? '⚡ Supabase Live — polling sensor_live table every 3 seconds'
              : dataSource === 'cached'
                ? `📦 Showing last known data from Supabase${cachedTimestamp ? ` (recorded ${new Date(cachedTimestamp).toLocaleString()})` : ''}. Waiting for live sensor…`
                : '⏳ Connecting to Supabase…'
            }
          </p>
        </div>
        {dataSource === 'live' && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs font-semibold text-green-700">STREAMING</span>
          </div>
        )}
        {dataSource === 'cached' && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <span className="text-xs font-semibold text-amber-700">CACHED</span>
          </div>
        )}
      </div>

      {/* Rain Status Banner */}
      {hasRealData && (
        <div className={`rounded-xl p-4 flex items-center gap-4 border ${
          (latestData?.rainLevel || 0) < 10
            ? 'bg-green-50 border-green-200'
            : (latestData?.rainLevel || 0) < 40
              ? 'bg-yellow-50 border-yellow-300'
              : 'bg-red-50 border-red-300'
        }`}>
          <div className="text-4xl">
            {(latestData?.rainLevel || 0) < 10 ? '☀️' : (latestData?.rainLevel || 0) < 40 ? '🌦️' : '🌧️'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className={`font-bold text-lg ${
                (latestData?.rainLevel || 0) < 10 ? 'text-green-800' : (latestData?.rainLevel || 0) < 40 ? 'text-yellow-800' : 'text-red-800'
              }`}>
                Rain: {latestData?.rainStatus ? latestData.rainStatus.charAt(0).toUpperCase() + latestData.rainStatus.slice(1) : 'Dry'}
              </h4>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                (latestData?.rainLevel || 0) < 10
                  ? 'bg-green-200 text-green-700'
                  : (latestData?.rainLevel || 0) < 40
                    ? 'bg-yellow-200 text-yellow-700'
                    : 'bg-red-200 text-red-700'
              }`}>
                {(latestData?.rainLevel || 0).toFixed(1)}%
              </span>
              {latestData?.rainDetected && (
                <span className="px-2 py-0.5 bg-blue-200 text-blue-700 rounded-full text-xs font-semibold animate-pulse">
                  🌧 RAIN DETECTED
                </span>
              )}
            </div>
            <p className="text-sm mt-1 text-gray-600">
              {(latestData?.rainLevel || 0) < 10
                ? 'No rain detected — ideal conditions for the pond.'
                : (latestData?.rainLevel || 0) < 25
                  ? 'Light rain — monitor water quality for changes.'
                  : (latestData?.rainLevel || 0) < 60
                    ? 'Moderate rain — check pH and turbidity levels closely.'
                    : 'Heavy rain — high risk of water quality changes. Consider protective measures.'}
            </p>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-xs text-gray-500">Intensity</p>
            <div className="w-32 h-3 bg-gray-200 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (latestData?.rainLevel || 0) < 10 ? 'bg-green-500' : (latestData?.rainLevel || 0) < 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(latestData?.rainLevel || 0, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Water Quality Parameter Cards */}
      {!hasRealData ? (
        <div className="bg-white rounded-xl shadow-sm p-12 border-2 border-dashed border-gray-300 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
              <i className="fas fa-satellite-dish text-4xl text-gray-400 animate-pulse"></i>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Loading Sensor Data…</h3>
              <p className="text-gray-500 mb-1">
                Connecting to water quality sensor via MQTT and loading last known data from database
              </p>
              <p className="text-sm text-gray-400">
                If no data appears, make sure the ESP32 device is powered on and connected to WiFi
              </p>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium transition-colors">
                <i className="fas fa-sync-alt mr-2"></i>Retry Connection
              </button>
              <button
                onClick={() => navigate('/dashboard/sensor-care')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
                <i className="fas fa-book mr-2"></i>Troubleshooting Guide
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
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
              <button
                onClick={() => navigate('/dashboard/water-quality-trends', { state: { parameter: param.id } })}
                className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors">
                <i className="fas fa-chart-line mr-1"></i> View Trend
              </button>
              <button
                onClick={() => navigate('/dashboard/treatment-dosing', { state: { openForm: true, parameter: param.name } })}
                className="flex-1 px-3 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs font-medium transition-colors">
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
          <button
            onClick={() => navigate('/dashboard/treatment-dosing')}
            className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 rounded-lg border border-blue-200 transition-all">
            <i className="fas fa-plus-circle text-2xl text-blue-600"></i>
            <span className="text-sm font-medium text-gray-700">Add Treatment</span>
          </button>
          <button
            onClick={() => navigate('/dashboard/sensor-care')}
            className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-lg border border-purple-200 transition-all">
            <i className="fas fa-wrench text-2xl text-purple-600"></i>
            <span className="text-sm font-medium text-gray-700">Calibrate Sensors</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 rounded-lg border border-green-200 transition-all">
            <i className="fas fa-file-export text-2xl text-green-600"></i>
            <span className="text-sm font-medium text-gray-700">Export Report</span>
          </button>
          <button
            onClick={() => navigate('/dashboard/alerts-center')}
            className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-orange-50 to-yellow-50 hover:from-orange-100 hover:to-yellow-100 rounded-lg border border-orange-200 transition-all">
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
