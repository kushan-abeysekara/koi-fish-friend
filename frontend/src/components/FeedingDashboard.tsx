import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';

interface DeviceData {
  status: string;
  feedingActive: boolean;
  hopperLevel: number;
  hopperCapacity: number;
  hopperPercentage: number;
  currentWeight: number;
  targetWeight: number;
  feedCount: number;
  totalGramsFed: number;
  motorStatus: string;
  plateSpeed: number;
  lastFeedingTime: string | null;
  lastSeen: string | null;
  rssi: number | null;
  ipAddress: string | null;
  scheduleCount: number;
}

interface WeightHistoryPoint {
  time: string;
  weight: number;
  hopper: number;
}

interface FeedEvent {
  time: string;
  amount: number;
}

const FeedingDashboard: React.FC = () => {
  const [deviceId] = useState('feed_device_001');
  const [device, setDevice] = useState<DeviceData>({
    status: 'offline',
    feedingActive: false,
    hopperLevel: 0,
    hopperCapacity: 20000,
    hopperPercentage: 0,
    currentWeight: 0,
    targetWeight: 0,
    feedCount: 0,
    totalGramsFed: 0,
    motorStatus: 'STOPPED',
    plateSpeed: 0,
    lastFeedingTime: null,
    lastSeen: null,
    rssi: null,
    ipAddress: null,
    scheduleCount: 0,
  });
  const [feedingInProgress, setFeedingInProgress] = useState(false);
  const [weightHistory, setWeightHistory] = useState<WeightHistoryPoint[]>([]);
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [lastFetchTime, setLastFetchTime] = useState<Date>(new Date());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const prevFeedCount = useRef(0);

  const isOnline = device.status === 'online';

  const fetchDeviceStatus = useCallback(async () => {
    try {
      const response = await api.get(`/sensors/device/${deviceId}`);
      if (response.data.success && response.data.data) {
        const d = response.data.data;
        const online = d.status === 'online';

        setDevice({
          status: d.status || 'offline',
          feedingActive: d.feedingActive || false,
          hopperLevel: d.hopperLevel || 0,
          hopperCapacity: d.hopperCapacity || 20000,
          hopperPercentage: d.hopperPercentage || 0,
          currentWeight: d.currentWeight || 0,
          targetWeight: d.targetWeight || 0,
          feedCount: d.feedCount || 0,
          totalGramsFed: d.totalGramsFed || 0,
          motorStatus: d.motorStatus || 'STOPPED',
          plateSpeed: d.plateSpeed || 0,
          lastFeedingTime: d.lastFeedingTime || null,
          lastSeen: d.lastSeen || null,
          rssi: d.rssi || null,
          ipAddress: d.ipAddress || null,
          scheduleCount: d.scheduleCount || 0,
        });

        if (d.feedingActive) setFeedingInProgress(true);
        else setFeedingInProgress(false);

        setConnectionStatus(online ? 'connected' : 'disconnected');
        setLastFetchTime(new Date());

        // Track weight history (keep last 30 data points)
        if (online) {
          const now = new Date();
          const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
          setWeightHistory(prev => {
            const next = [...prev, { time: timeStr, weight: d.currentWeight || 0, hopper: (d.hopperLevel || 0) / 1000 }];
            return next.slice(-30);
          });
        }

        // Track feed events
        const newFeedCount = d.feedCount || 0;
        if (newFeedCount > prevFeedCount.current && prevFeedCount.current > 0) {
          const now = new Date();
          setFeedEvents(prev => {
            const next = [...prev, {
              time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
              amount: (d.totalGramsFed || 0) / 1000,
            }];
            return next.slice(-10);
          });
        }
        prevFeedCount.current = newFeedCount;
      } else {
        setConnectionStatus('disconnected');
        setDevice(prev => ({ ...prev, status: 'offline' }));
      }
    } catch {
      setConnectionStatus('disconnected');
      setDevice(prev => ({ ...prev, status: 'offline' }));
    }
  }, [deviceId]);

  useEffect(() => {
    fetchDeviceStatus();
    const interval = setInterval(fetchDeviceStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchDeviceStatus]);

  // -- Action Handlers --
  const handleStartFeeding = async () => {
    try {
      setFeedingInProgress(true);
      await api.post(`/feeding/start?deviceId=${deviceId}`);
    } catch {
      alert('Failed to start feeding. Check backend connection.');
      setFeedingInProgress(false);
    }
  };

  const handleStopFeeding = async () => {
    try {
      await api.post(`/feeding/stop?deviceId=${deviceId}`);
      setFeedingInProgress(false);
    } catch {
      alert('Failed to stop feeding.');
    }
  };

  const handleEmergencyStop = async () => {
    if (!confirm('EMERGENCY STOP — Are you sure?')) return;
    try {
      await api.post(`/feeding/stop?deviceId=${deviceId}`);
      setFeedingInProgress(false);
    } catch {
      alert('Emergency stop sent, but response failed.');
    }
  };

  const handleTare = async () => {
    try {
      await api.post(`/feeding/tare?deviceId=${deviceId}`);
    } catch {
      alert('Failed to tare load cell.');
    }
  };

  // -- Helpers --
  const formatWeight = (grams: number) => {
    if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
    return `${grams.toFixed(1)} g`;
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return 'N/A';
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    } catch { return iso; }
  };

  const getSignalStrength = (rssi: number | null) => {
    if (rssi === null) return { label: 'N/A', color: 'text-gray-400', bars: 0 };
    if (rssi > -50) return { label: 'Excellent', color: 'text-green-500', bars: 4 };
    if (rssi > -60) return { label: 'Good', color: 'text-green-400', bars: 3 };
    if (rssi > -70) return { label: 'Fair', color: 'text-yellow-500', bars: 2 };
    return { label: 'Weak', color: 'text-red-500', bars: 1 };
  };

  const hopperPct = Math.min(Math.max(device.hopperPercentage, 0), 100);
  const hopperKg = device.hopperLevel / 1000;
  const capacityKg = device.hopperCapacity / 1000;
  const signal = getSignalStrength(device.rssi);

  // Colors for feeding history bars
  const barColors = ['#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444'];

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-4 sm:p-6 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <span className="text-2xl sm:text-3xl">🐟</span>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Feed Control Center</h2>
              <p className="text-emerald-100 text-xs sm:text-sm">Real-time MQTT monitoring &bull; Pond A</p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm ${
              isOnline ? 'bg-green-400/30 text-green-100' : 'bg-red-400/30 text-red-100'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              {isOnline ? 'Device Online' : 'Device Offline'}
            </div>
            <span className="text-emerald-200 text-xs hidden sm:inline">
              Updated {lastFetchTime.toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      {/* ── LIVE STATUS CARDS (4 columns on desktop, 2 on mobile) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Motor Status */}
        <div className={`rounded-2xl p-4 sm:p-5 border shadow-sm transition-all ${
          device.feedingActive
            ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 ring-2 ring-blue-300'
            : 'bg-white border-gray-100'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Motor</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              device.feedingActive ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'
            }`}>
              <i className={`fas fa-cog ${device.feedingActive ? 'fa-spin' : ''}`}></i>
            </div>
          </div>
          <p className={`text-lg sm:text-2xl font-bold ${device.feedingActive ? 'text-blue-700' : 'text-gray-800'}`}>
            {device.motorStatus}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {device.plateSpeed > 0 ? `${device.plateSpeed.toFixed(0)} RPM` : 'Idle'}
          </p>
        </div>

        {/* Scale Weight */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Scale</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <i className="fas fa-weight-hanging"></i>
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-800">
            {isOnline ? formatWeight(device.currentWeight) : '--'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Target: {device.targetWeight > 0 ? formatWeight(device.targetWeight) : 'None'}
          </p>
        </div>

        {/* Feed Count */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Feeds Today</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <i className="fas fa-utensils"></i>
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-800">
            {isOnline ? device.feedCount : '--'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Total: {isOnline ? formatWeight(device.totalGramsFed) : '--'}
          </p>
        </div>

        {/* WiFi Signal */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Signal</span>
            <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
              <i className="fas fa-signal"></i>
            </div>
          </div>
          <p className={`text-lg sm:text-2xl font-bold ${signal.color}`}>
            {isOnline ? `${device.rssi} dBm` : '--'}
          </p>
          <div className="flex items-center gap-1 mt-1">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`w-1.5 rounded-full ${
                i <= signal.bars ? 'bg-current' : 'bg-gray-200'
              }`} style={{ height: `${6 + i * 3}px` }} />
            ))}
            <span className="text-xs text-gray-500 ml-1">{signal.label}</span>
          </div>
        </div>
      </div>

      {/* ── HOPPER GAUGE + LAST FEEDING ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

        {/* Hopper Level - Visual Gauge */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
              <i className="fas fa-box-open text-teal-500"></i>
              Hopper Feed Level
            </h3>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              hopperPct > 50 ? 'bg-green-100 text-green-700' :
              hopperPct > 20 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {isOnline ? `${hopperPct.toFixed(1)}%` : 'Offline'}
            </span>
          </div>

          {/* Tank Visualization */}
          <div className="flex items-end gap-6">
            <div className="relative w-28 sm:w-36 h-44 sm:h-52 mx-auto">
              {/* Tank outline */}
              <div className="absolute inset-0 rounded-b-2xl rounded-t-lg border-2 border-gray-300 bg-gray-50 overflow-hidden">
                {/* Fill level */}
                <div
                  className={`absolute bottom-0 left-0 right-0 transition-all duration-1000 rounded-b-xl ${
                    hopperPct > 50 ? 'bg-gradient-to-t from-teal-500 to-teal-300' :
                    hopperPct > 20 ? 'bg-gradient-to-t from-yellow-500 to-yellow-300' :
                    'bg-gradient-to-t from-red-500 to-red-300'
                  }`}
                  style={{ height: `${isOnline ? hopperPct : 0}%` }}
                >
                  {/* Wave effect */}
                  <div className="absolute top-0 left-0 right-0 h-3 opacity-30">
                    <div className="w-full h-full bg-white rounded-full animate-pulse" />
                  </div>
                </div>
                {/* Measurement lines */}
                {[25, 50, 75].map(line => (
                  <div key={line} className="absolute left-0 right-0 border-t border-dashed border-gray-300 flex items-center" style={{ bottom: `${line}%` }}>
                    <span className="text-[9px] text-gray-400 ml-1">{line}%</span>
                  </div>
                ))}
              </div>
              {/* Top funnel */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-16 sm:w-20 h-4 bg-gray-400 rounded-t-lg" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Current Level</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800">{isOnline ? `${hopperKg.toFixed(2)}` : '--'} <span className="text-base font-normal text-gray-500">kg</span></p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Capacity</p>
                <p className="text-lg font-semibold text-gray-600">{capacityKg.toFixed(0)} kg</p>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    hopperPct > 50 ? 'bg-teal-500' : hopperPct > 20 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${isOnline ? hopperPct : 0}%` }}
                />
              </div>
              {hopperPct < 15 && isOnline && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <i className="fas fa-exclamation-triangle text-red-500 text-sm"></i>
                  <span className="text-xs text-red-700 font-medium">Low feed level! Refill needed.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Last Feeding Summary */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
            <i className="fas fa-history text-indigo-500"></i>
            Last Feeding Summary
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <i className="fas fa-clock"></i>
                </div>
                <span className="text-sm text-gray-600 font-medium">Time</span>
              </div>
              <span className="font-semibold text-sm text-gray-800">{formatTime(device.lastFeedingTime)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <i className="fas fa-bullseye"></i>
                </div>
                <span className="text-sm text-gray-600 font-medium">Target Weight</span>
              </div>
              <span className="font-semibold text-sm text-gray-800">{device.targetWeight > 0 ? formatWeight(device.targetWeight) : 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center">
                  <i className="fas fa-weight"></i>
                </div>
                <span className="text-sm text-gray-600 font-medium">Total Dispensed</span>
              </div>
              <span className="font-semibold text-sm text-gray-800">{isOnline ? formatWeight(device.totalGramsFed) : 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
                  <i className="fas fa-hashtag"></i>
                </div>
                <span className="text-sm text-gray-600 font-medium">Feed Sessions</span>
              </div>
              <span className="font-semibold text-sm text-gray-800">{isOnline ? device.feedCount : 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-100 text-cyan-600 flex items-center justify-center">
                  <i className="fas fa-calendar-check"></i>
                </div>
                <span className="text-sm text-gray-600 font-medium">Schedules Active</span>
              </div>
              <span className="font-semibold text-sm text-gray-800">{device.scheduleCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
          <i className="fas fa-bolt text-amber-500"></i>
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={handleStartFeeding}
            disabled={feedingInProgress}
            className={`py-3 sm:py-4 px-3 rounded-xl font-semibold text-sm sm:text-base transition-all flex flex-col items-center justify-center gap-2 ${
              !feedingInProgress
                ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white hover:shadow-lg hover:scale-[1.02] active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <i className="fas fa-play-circle text-xl sm:text-2xl"></i>
            <span>Start Feed</span>
          </button>
          <button
            onClick={handleStopFeeding}
            className="py-3 sm:py-4 px-3 rounded-xl font-semibold text-sm sm:text-base transition-all flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-amber-500 to-orange-600 text-white hover:shadow-lg hover:scale-[1.02] active:scale-95"
          >
            <i className="fas fa-stop-circle text-xl sm:text-2xl"></i>
            <span>Stop Feed</span>
          </button>
          <button
            onClick={handleTare}
            className="py-3 sm:py-4 px-3 rounded-xl font-semibold text-sm sm:text-base transition-all flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-blue-500 to-indigo-600 text-white hover:shadow-lg hover:scale-[1.02] active:scale-95"
          >
            <i className="fas fa-balance-scale text-xl sm:text-2xl"></i>
            <span>Tare Scale</span>
          </button>
          <button
            onClick={handleEmergencyStop}
            className="py-3 sm:py-4 px-3 rounded-xl font-semibold text-sm sm:text-base transition-all flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-red-500 to-rose-700 text-white hover:shadow-lg hover:scale-[1.02] active:scale-95 ring-2 ring-red-300"
          >
            <i className="fas fa-exclamation-triangle text-xl sm:text-2xl"></i>
            <span>Emergency</span>
          </button>
        </div>
        {feedingInProgress && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
              <i className="fas fa-spinner fa-spin text-white text-sm"></i>
            </div>
            <div>
              <span className="text-blue-800 font-semibold text-sm">Feeding in progress...</span>
              <p className="text-blue-600 text-xs">Motor: {device.motorStatus} | Speed: {device.plateSpeed.toFixed(0)} RPM</p>
            </div>
          </div>
        )}
      </div>

      {/* ── REAL-TIME CHARTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

        {/* Weight History Chart */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
            <i className="fas fa-chart-area text-cyan-500"></i>
            Live Weight Monitor
          </h3>
          {weightHistory.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={weightHistory}>
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} unit="g" />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  formatter={(value?: number | string) => [`${Number(value ?? 0).toFixed(1)} g`, 'Scale Weight']}
                />
                <Area type="monotone" dataKey="weight" stroke="#06b6d4" strokeWidth={2} fill="url(#weightGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <i className="fas fa-chart-line text-3xl mb-2"></i>
                <p className="text-sm">Waiting for live data...</p>
                <p className="text-xs">Chart populates when device is online</p>
              </div>
            </div>
          )}
        </div>

        {/* Hopper Level History Chart */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
            <i className="fas fa-chart-bar text-emerald-500"></i>
            Hopper Level Trend
          </h3>
          {weightHistory.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={weightHistory}>
                <defs>
                  <linearGradient id="hopperGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} unit="kg" />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  formatter={(value?: number | string) => [`${Number(value ?? 0).toFixed(2)} kg`, 'Hopper Level']}
                />
                <Area type="monotone" dataKey="hopper" stroke="#10b981" strokeWidth={2} fill="url(#hopperGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <i className="fas fa-box text-3xl mb-2"></i>
                <p className="text-sm">Waiting for hopper data...</p>
                <p className="text-xs">Chart populates when device is online</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── FEEDING HISTORY BAR ── */}
      {feedEvents.length > 0 && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
            <i className="fas fa-history text-violet-500"></i>
            Feeding History
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={feedEvents}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} unit="kg" />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  formatter={(value?: number | string) => [`${Number(value ?? 0).toFixed(2)} kg`, 'Feed Amount']}
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                {feedEvents.map((_entry, index) => (
                  <Cell key={index} fill={barColors[index % barColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── DEVICE INFO FOOTER ── */}
      <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl p-4 sm:p-5 border border-gray-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-gray-500 block mb-1">Device ID</span>
            <span className="font-mono font-semibold text-gray-700">{deviceId}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">IP Address</span>
            <span className="font-mono font-semibold text-gray-700">{device.ipAddress || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">Last Seen</span>
            <span className="font-semibold text-gray-700">{formatTime(device.lastSeen)}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">Connection</span>
            <span className={`font-semibold ${
              connectionStatus === 'connected' ? 'text-green-600' :
              connectionStatus === 'checking' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              <i className={`fas fa-circle text-[8px] mr-1 ${connectionStatus === 'connected' ? 'text-green-500' : connectionStatus === 'checking' ? 'text-yellow-500' : 'text-red-500'}`}></i>
              {connectionStatus === 'connected' ? 'MQTT Connected' : connectionStatus === 'checking' ? 'Checking...' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedingDashboard;
