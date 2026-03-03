import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { supabase, fetchFeedingHistory, fetchFeedingEvents, type FeedingHistoryRow } from '../services/supabase';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line
} from 'recharts';

// Build WebSocket URL from the REST API URL (same backend, /ws/feeding endpoint)
const API_BASE = import.meta.env.VITE_API_URL || 'https://koifish-backend-tqteaf-bae886-187-77-189-5.traefik.me';
const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws/feeding';
const DEVICE_ID = 'feed_device_001';

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
  escPercent: number;
  uptimeMs: number;
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

const INITIAL_DEVICE: DeviceData = {
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
  escPercent: 0,
  uptimeMs: 0,
};

// Cache key for persisting last known device data
const DEVICE_CACHE_KEY = 'feedingDashboard_lastDevice';

function loadCachedDevice(): DeviceData {
  try {
    const cached = localStorage.getItem(DEVICE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as DeviceData;
      // Mark as offline (stale data) but keep all values
      return { ...parsed, status: 'offline' };
    }
  } catch { /* ignore */ }
  return INITIAL_DEVICE;
}

function cacheDevice(d: DeviceData) {
  try {
    localStorage.setItem(DEVICE_CACHE_KEY, JSON.stringify(d));
  } catch { /* ignore */ }
}

const FeedingDashboard: React.FC = () => {
  const [device, setDevice] = useState<DeviceData>(loadCachedDevice);
  const [feedingInProgress, setFeedingInProgress] = useState(false);
  const [weightHistory, setWeightHistory] = useState<WeightHistoryPoint[]>([]);
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  // Historical feeding data from server DB
  const [historyData, setHistoryData] = useState<FeedingHistoryRow[]>([]);
  const [historyEvents, setHistoryEvents] = useState<FeedingHistoryRow[]>([]);
  const [historyRange, setHistoryRange] = useState<number>(24); // hours
  const [historyLoading, setHistoryLoading] = useState(true);
  const [mqttStatus, setMqttStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [lastMqttMsg, setLastMqttMsg] = useState<Date | null>(null);
  const [messageRate, setMessageRate] = useState(0);
  const [isStale, setIsStale] = useState(true); // True when showing cached/old data
  const prevFeedCount = useRef(0);
  const msgCountRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000); // Exponential backoff starting at 1s

  const isOnline = device.status !== 'offline';
  // Show values if online OR if we have cached stale data
  const hasData = isOnline || isStale;

  // ─── Parse incoming WebSocket message (relayed from backend MQTT) ───
  const handleWsMessage = useCallback((rawPayload: string) => {
    try {
      const d = JSON.parse(rawPayload);

      // Filter: only process messages from OUR device
      if (d.deviceId && d.deviceId !== DEVICE_ID) return;

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

      const newDevice: DeviceData = {
        status: d.status || 'online',
        feedingActive: d.feedingActive || false,
        hopperLevel: d.hopperLevel ?? 0,
        hopperCapacity: d.hopperCapacity ?? 20000,
        hopperPercentage: d.hopperPercentage ?? 0,
        currentWeight: d.weight ?? 0,
        targetWeight: d.targetWeight ?? 0,
        feedCount: d.feedCount ?? 0,
        totalGramsFed: d.totalGrams ?? 0,
        motorStatus: d.motorStatus || 'STOPPED',
        plateSpeed: d.plateSpeed ?? 0,
        lastFeedingTime: d.status === 'feeding_stopped' ? now.toISOString() : null,
        lastSeen: now.toISOString(),
        rssi: d.rssi ?? null,
        ipAddress: d.ipAddress || null,
        scheduleCount: d.scheduleCount ?? 0,
        escPercent: d.escPercent ?? 0,
        uptimeMs: d.uptimeMs ?? 0,
      };

      setDevice(newDevice);
      cacheDevice(newDevice); // Persist to localStorage for weak-connection recovery
      setIsStale(false);      // Data is fresh

      if (d.feedingActive) setFeedingInProgress(true);
      else setFeedingInProgress(false);

      setLastMqttMsg(now);
      msgCountRef.current++;

      // Weight history (keep last 60 data points = ~2 min at 2s interval)
      setWeightHistory(prev => {
        const next = [...prev, { time: timeStr, weight: d.weight ?? 0, hopper: (d.hopperLevel ?? 0) / 1000 }];
        return next.slice(-60);
      });

      // Feed events tracking
      const newFeedCount = d.feedCount ?? 0;
      if (newFeedCount > prevFeedCount.current && prevFeedCount.current > 0) {
        setFeedEvents(prev => {
          const next = [...prev, {
            time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            amount: (d.totalGrams ?? 0) / 1000,
          }];
          return next.slice(-10);
        });
      }
      prevFeedCount.current = newFeedCount;

      // Reset offline timer — if no message in 30s, mark offline but keep cached values
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      offlineTimerRef.current = setTimeout(() => {
        setDevice(prev => ({ ...prev, status: 'offline' }));
        setIsStale(true); // Mark as stale but keep values visible
      }, 30000);
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  }, []);

  // ─── WebSocket connection to backend (relays MQTT messages) ───
  useEffect(() => {
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      setMqttStatus('connecting');
      console.log('[WS] Connecting to', WS_URL);

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        console.log('[WS] Connected to backend WebSocket');
        setMqttStatus('connected');
        reconnectDelayRef.current = 1000; // Reset backoff on successful connection
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        handleWsMessage(event.data);
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
        if (isMounted) setMqttStatus('error');
      };

      ws.onclose = () => {
        if (!isMounted) return;
        const delay = reconnectDelayRef.current;
        console.log(`[WS] Disconnected, reconnecting in ${delay / 1000}s...`);
        setMqttStatus('disconnected');
        wsRef.current = null;
        // Exponential backoff: 1s → 2s → 4s → 8s → max 15s
        reconnectTimerRef.current = setTimeout(connect, delay);
        reconnectDelayRef.current = Math.min(delay * 2, 15000);
      };
    };

    connect();

    // Message rate calculator (msgs/sec)
    const rateInterval = setInterval(() => {
      setMessageRate(msgCountRef.current);
      msgCountRef.current = 0;
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(rateInterval);
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [handleWsMessage]);

  // ─── Fetch device data from REST API (bootstrap + polling fallback) ───
  const fetchDeviceFromRest = useCallback(async () => {
    try {
      const response = await api.get(`/sensors/device/${DEVICE_ID}`);
      if (response.data.success && response.data.data) {
        const d = response.data.data;
        setDevice(prev => {
          const updated: DeviceData = {
            status: d.status || prev.status || 'online',
            feedingActive: d.feedingActive ?? prev.feedingActive,
            hopperLevel: d.hopperLevel ?? prev.hopperLevel,
            hopperCapacity: d.hopperCapacity ?? prev.hopperCapacity ?? 20000,
            hopperPercentage: d.hopperPercentage ?? prev.hopperPercentage,
            currentWeight: d.currentWeight ?? prev.currentWeight,
            targetWeight: d.targetWeight ?? prev.targetWeight,
            feedCount: d.feedCount ?? prev.feedCount,
            totalGramsFed: d.totalGramsFed ?? prev.totalGramsFed,
            motorStatus: d.motorStatus || prev.motorStatus || 'STOPPED',
            plateSpeed: d.plateSpeed ?? prev.plateSpeed,
            lastFeedingTime: d.lastFeedingTime || prev.lastFeedingTime,
            lastSeen: d.lastSeen || prev.lastSeen || new Date().toISOString(),
            rssi: d.rssi ?? prev.rssi,
            ipAddress: d.ipAddress || prev.ipAddress,
            scheduleCount: d.scheduleCount ?? prev.scheduleCount,
            escPercent: d.escPercent ?? prev.escPercent,
            uptimeMs: d.uptimeMs ?? prev.uptimeMs,
          };
          cacheDevice(updated);
          return updated;
        });
        setIsStale(true); // REST data is slightly stale vs live WS
        if (d.feedCount) prevFeedCount.current = d.feedCount;
      }
    } catch { /* REST fallback — ignore errors silently */ }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchDeviceFromRest();
  }, [fetchDeviceFromRest]);

  // REST polling fallback — poll every 5s when WebSocket not receiving messages
  useEffect(() => {
    const pollInterval = setInterval(() => {
      // Only poll if WebSocket hasn't delivered a message in the last 8 seconds
      const now = Date.now();
      const lastMsg = lastMqttMsg ? lastMqttMsg.getTime() : 0;
      if (now - lastMsg > 8000) {
        fetchDeviceFromRest();
      }
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [fetchDeviceFromRest, lastMqttMsg]);

  // ─── Load historical data from Backend REST API (MySQL) + optional Supabase real-time ───
  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const [history, events] = await Promise.all([
          fetchFeedingHistory(DEVICE_ID, historyRange),
          fetchFeedingEvents(DEVICE_ID, Math.max(historyRange, 72)),
        ]);
        if (isMounted) {
          setHistoryData(history);
          setHistoryEvents(events);
        }
      } catch (err) {
        console.error('[FeedingHistory] Failed to load history:', err);
      } finally {
        if (isMounted) setHistoryLoading(false);
      }
    };
    loadHistory();

    // Subscribe to real-time inserts on feeding_history (Supabase Realtime)
    // This provides a SECONDARY live data channel for hopper level, weight, etc.
    // Works independently of MQTT/WebSocket — data flows: ESP32 → MQTT → Backend → Supabase → Browser
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
    if (supabase) {
      try {
        channel = supabase
          .channel('feeding_history_realtime')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'feeding_history',
              filter: `device_id=eq.${DEVICE_ID}`,
            },
            (payload) => {
              if (!isMounted) return;
              const r = payload.new as Record<string, unknown>;

              // Normalise to FeedingHistoryRow (handles both snake_case and camelCase)
              const newRow: FeedingHistoryRow = {
                id: (r.id as number) ?? 0,
                device_id: (r.device_id ?? r.deviceId ?? '') as string,
                recorded_at: (r.recorded_at ?? r.recordedAt ?? '') as string,
                status: (r.status ?? '') as string,
                feeding_active: (r.feeding_active ?? r.feedingActive ?? false) as boolean,
                hopper_level: (r.hopper_level ?? r.hopperLevel ?? 0) as number,
                hopper_capacity: (r.hopper_capacity ?? r.hopperCapacity ?? 0) as number,
                hopper_percentage: (r.hopper_percentage ?? r.hopperPercentage ?? 0) as number,
                current_weight: (r.current_weight ?? r.currentWeight ?? 0) as number,
                target_weight: (r.target_weight ?? r.targetWeight ?? 0) as number,
                feed_count: (r.feed_count ?? r.feedCount ?? 0) as number,
                total_grams_fed: (r.total_grams_fed ?? r.totalGramsFed ?? 0) as number,
                motor_status: (r.motor_status ?? r.motorStatus ?? '') as string,
                plate_speed: (r.plate_speed ?? r.plateSpeed ?? 0) as number,
                esc_percent: (r.esc_percent ?? r.escPercent ?? 0) as number,
                rssi: (r.rssi ?? null) as number | null,
                ip_address: (r.ip_address ?? r.ipAddress ?? null) as string | null,
                uptime_ms: (r.uptime_ms ?? r.uptimeMs ?? 0) as number,
              };

              // Append to history data
              setHistoryData(prev => {
                const next = [...prev, newRow];
                return next.length > 2000 ? next.slice(-2000) : next;
              });

              // If it's a feeding event, add to events list
              if (newRow.status === 'feeding_started' || newRow.status === 'feeding_stopped') {
                setHistoryEvents(prev => [...prev, newRow].slice(-100));
              }

              // ─── ALSO update live device data from Supabase real-time ───
              // This is the secondary channel: if WebSocket is down, hopper data
              // still updates via Supabase Realtime (ESP32→MQTT→Backend→Supabase→Browser)
              setDevice(prev => {
                const updated: DeviceData = {
                  ...prev,
                  status: 'online',
                  hopperLevel: newRow.hopper_level,
                  hopperCapacity: newRow.hopper_capacity,
                  hopperPercentage: newRow.hopper_percentage,
                  currentWeight: newRow.current_weight,
                  targetWeight: newRow.target_weight,
                  feedCount: newRow.feed_count,
                  totalGramsFed: newRow.total_grams_fed,
                  motorStatus: newRow.motor_status || prev.motorStatus,
                  plateSpeed: newRow.plate_speed,
                  escPercent: newRow.esc_percent,
                  rssi: newRow.rssi,
                  ipAddress: newRow.ip_address,
                  uptimeMs: newRow.uptime_ms,
                  feedingActive: newRow.feeding_active,
                  lastSeen: new Date().toISOString(),
                };
                cacheDevice(updated);
                return updated;
              });
              setIsStale(false);
              setLastMqttMsg(new Date()); // Treat Supabase RT as equivalent to WS msg for offline timer
            },
          )
          .subscribe((status) => {
            console.log('[Supabase RT] Subscription status:', status);
          });
      } catch (err) {
        console.warn('[Supabase] Realtime subscription failed:', err);
      }
    }

    return () => {
      isMounted = false;
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [historyRange]);

  // ── Action Handlers ──
  const handleStartFeeding = async () => {
    try {
      setFeedingInProgress(true);
      await api.post(`/feeding/start?deviceId=${DEVICE_ID}`);
    } catch {
      alert('Failed to start feeding.');
      setFeedingInProgress(false);
    }
  };

  const handleStopFeeding = async () => {
    try {
      await api.post(`/feeding/stop?deviceId=${DEVICE_ID}`);
      setFeedingInProgress(false);
    } catch {
      alert('Failed to stop feeding.');
    }
  };

  const handleEmergencyStop = async () => {
    if (!confirm('EMERGENCY STOP — Are you sure?')) return;
    try {
      await api.post(`/feeding/stop?deviceId=${DEVICE_ID}`);
      setFeedingInProgress(false);
    } catch {
      alert('Emergency stop sent, but response failed.');
    }
  };

  const handleTare = async () => {
    try {
      await api.post(`/feeding/tare?deviceId=${DEVICE_ID}`);
    } catch {
      alert('Failed to tare load cell.');
    }
  };

  // ── Helpers ──
  const formatWeight = (grams: number) => {
    if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
    return `${grams.toFixed(1)} g`;
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return 'N/A';
    try {
      return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    } catch { return iso; }
  };

  const formatUptime = (ms: number) => {
    if (ms <= 0) return 'N/A';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  const getSignalStrength = (rssi: number | null) => {
    if (rssi === null) return { label: 'N/A', color: 'text-gray-400', bars: 0 };
    if (rssi > -50) return { label: 'Excellent', color: 'text-green-500', bars: 4 };
    if (rssi > -60) return { label: 'Good', color: 'text-green-400', bars: 3 };
    if (rssi > -70) return { label: 'Fair', color: 'text-yellow-500', bars: 2 };
    return { label: 'Weak', color: 'text-red-500', bars: 1 };
  };

  const getMqttStatusDisplay = () => {
    switch (mqttStatus) {
      case 'connected': return { text: 'Live', color: 'bg-green-400/30 text-green-100', dot: 'bg-green-400 animate-pulse' };
      case 'connecting': return { text: 'Connecting...', color: 'bg-yellow-400/30 text-yellow-100', dot: 'bg-yellow-400 animate-pulse' };
      case 'error': return { text: 'WS Error', color: 'bg-red-400/30 text-red-100', dot: 'bg-red-400' };
      default: return { text: 'Disconnected', color: 'bg-red-400/30 text-red-100', dot: 'bg-red-400' };
    }
  };

  const hopperPct = Math.min(Math.max(device.hopperPercentage, 0), 100);
  const hopperKg = device.hopperLevel / 1000;
  const capacityKg = device.hopperCapacity / 1000;
  const signal = getSignalStrength(device.rssi);
  const mqttStatusDisplay = getMqttStatusDisplay();

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
            {/* MQTT Connection Badge */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm ${mqttStatusDisplay.color}`}>
              <span className={`w-2 h-2 rounded-full ${mqttStatusDisplay.dot}`} />
              {mqttStatusDisplay.text}
            </div>
            {/* Device Status Badge */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm ${
              isOnline ? 'bg-green-400/30 text-green-100' : 'bg-red-400/30 text-red-100'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              {isOnline ? 'Device Online' : 'Device Offline'}
            </div>
            {/* Stale data indicator */}
            {!isOnline && isStale && device.lastSeen && (
              <span className="text-yellow-200 text-xs hidden sm:inline">
                <i className="fas fa-clock mr-1"></i>Last: {new Date(device.lastSeen).toLocaleTimeString()}
              </span>
            )}
            {/* Message rate indicator */}
            {mqttStatus === 'connected' && (
              <span className="text-emerald-200 text-xs hidden sm:inline">
                {messageRate > 0 ? `${messageRate} msg/s` : 'Waiting...'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── STALE DATA BANNER (shows when connection lost but cached data exists) ── */}
      {!isOnline && isStale && device.lastSeen && (
        <div className="bg-amber-50 rounded-xl p-3 sm:p-4 border border-amber-200 flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
            <i className="fas fa-wifi text-amber-500"></i>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">Connection Lost — Showing Last Known Data</p>
            <p className="text-xs text-amber-600">
              Last update: {new Date(device.lastSeen).toLocaleString()} &bull; Reconnecting automatically...
            </p>
          </div>
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
        </div>
      )}

      {/* ── LIVE STATUS CARDS ── */}
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
            {hasData ? device.motorStatus : '--'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {hasData && device.plateSpeed > 0 ? `${device.plateSpeed.toFixed(0)} RPM` : hasData ? 'Idle' : '--'}
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
            {hasData ? formatWeight(device.currentWeight) : '--'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Target: {hasData && device.targetWeight > 0 ? formatWeight(device.targetWeight) : 'None'}
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
            {hasData ? device.feedCount : '--'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Total: {hasData ? formatWeight(device.totalGramsFed) : '--'}
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
          <p className={`text-lg sm:text-2xl font-bold ${isOnline ? signal.color : 'text-gray-400'}`}>
            {isOnline && device.rssi !== null ? `${device.rssi} dBm` : '--'}
          </p>
          <div className="flex items-center gap-1 mt-1">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`w-1.5 rounded-full ${
                i <= signal.bars ? 'bg-current' : 'bg-gray-200'
              }`} style={{ height: `${6 + i * 3}px` }} />
            ))}
            <span className="text-xs text-gray-500 ml-1">{hasData ? signal.label : 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* ── HOPPER GAUGE + LAST FEEDING ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

        {/* Hopper Level */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
              <i className="fas fa-box-open text-teal-500"></i>
              Hopper Feed Level
            </h3>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              !hasData ? 'bg-gray-100 text-gray-500' :
              !isOnline ? 'bg-yellow-100 text-yellow-700' :
              hopperPct > 50 ? 'bg-green-100 text-green-700' :
              hopperPct > 20 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {hasData ? (isOnline ? `${hopperPct.toFixed(1)}%` : `${hopperPct.toFixed(1)}% (stale)`) : 'Offline'}
            </span>
          </div>

          <div className="flex items-end gap-6">
            <div className="relative w-28 sm:w-36 h-44 sm:h-52 mx-auto">
              <div className="absolute inset-0 rounded-b-2xl rounded-t-lg border-2 border-gray-300 bg-gray-50 overflow-hidden">
                <div
                  className={`absolute bottom-0 left-0 right-0 transition-all duration-700 rounded-b-xl ${
                    !hasData ? 'bg-gray-200' :
                    !isOnline ? 'bg-gradient-to-t from-yellow-400 to-yellow-200 opacity-60' :
                    hopperPct > 50 ? 'bg-gradient-to-t from-teal-500 to-teal-300' :
                    hopperPct > 20 ? 'bg-gradient-to-t from-yellow-500 to-yellow-300' :
                    'bg-gradient-to-t from-red-500 to-red-300'
                  }`}
                  style={{ height: `${hasData ? hopperPct : 0}%` }}
                >
                  {hasData && (
                    <div className="absolute top-0 left-0 right-0 h-3 opacity-30">
                      <div className="w-full h-full bg-white rounded-full animate-pulse" />
                    </div>
                  )}
                </div>
                {[25, 50, 75].map(line => (
                  <div key={line} className="absolute left-0 right-0 border-t border-dashed border-gray-300 flex items-center" style={{ bottom: `${line}%` }}>
                    <span className="text-[9px] text-gray-400 ml-1">{line}%</span>
                  </div>
                ))}
              </div>
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-16 sm:w-20 h-4 bg-gray-400 rounded-t-lg" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Current Level</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800">{hasData ? `${hopperKg.toFixed(2)}` : '--'} <span className="text-base font-normal text-gray-500">kg</span></p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Capacity</p>
                <p className="text-lg font-semibold text-gray-600">{capacityKg.toFixed(0)} kg</p>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    !hasData ? 'bg-gray-300' :
                    !isOnline ? 'bg-yellow-400' :
                    hopperPct > 50 ? 'bg-teal-500' : hopperPct > 20 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${hasData ? hopperPct : 0}%` }}
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
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><i className="fas fa-clock"></i></div>
                <span className="text-sm text-gray-600 font-medium">Time</span>
              </div>
              <span className="font-semibold text-sm text-gray-800">{formatTime(device.lastFeedingTime)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center"><i className="fas fa-bullseye"></i></div>
                <span className="text-sm text-gray-600 font-medium">Target Weight</span>
              </div>
              <span className="font-semibold text-sm text-gray-800">{hasData && device.targetWeight > 0 ? formatWeight(device.targetWeight) : 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center"><i className="fas fa-weight"></i></div>
                <span className="text-sm text-gray-600 font-medium">Total Dispensed</span>
              </div>
              <span className="font-semibold text-sm text-gray-800">{hasData ? formatWeight(device.totalGramsFed) : 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center"><i className="fas fa-hashtag"></i></div>
                <span className="text-sm text-gray-600 font-medium">Feed Sessions</span>
              </div>
              <span className="font-semibold text-sm text-gray-800">{hasData ? device.feedCount : 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-100 text-cyan-600 flex items-center justify-center"><i className="fas fa-calendar-check"></i></div>
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
              <p className="text-blue-600 text-xs">Motor: {device.motorStatus} | ESC: {device.escPercent}% | Weight: {formatWeight(device.currentWeight)}</p>
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
                <p className="text-xs">{mqttStatus === 'connected' ? 'MQTT connected, waiting for ESP32...' : 'Connecting to MQTT...'}</p>
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
                <p className="text-xs">{mqttStatus === 'connected' ? 'MQTT connected, waiting for ESP32...' : 'Connecting to MQTT...'}</p>
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
            Feeding History (Session)
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

      {/* ══════════════════════════════════════════════════════════════════
          ── HISTORICAL DATA FROM SERVER DATABASE (MySQL) ──
          ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 rounded-2xl p-4 sm:p-6 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <i className="fas fa-database text-2xl"></i>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">Historical Data</h2>
              <p className="text-purple-200 text-xs sm:text-sm">
                Stored by server (always running) &bull; {historyData.length} records
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[1, 6, 24, 72, 168].map(h => (
              <button
                key={h}
                onClick={() => setHistoryRange(h)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  historyRange === h
                    ? 'bg-white text-purple-700 shadow-md'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                {h === 1 ? '1H' : h === 6 ? '6H' : h === 24 ? '24H' : h === 72 ? '3D' : '7D'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Historical Weight & Hopper Chart */}
      {historyLoading ? (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading historical data from server...</p>
          </div>
        </div>
      ) : historyData.length > 0 ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Historical Weight Chart */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                <i className="fas fa-weight text-purple-500"></i>
                Weight History (Server DB)
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={historyData.map(row => ({
                  time: new Date(row.recorded_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
                  weight: row.current_weight,
                  hopper: row.hopper_level / 1000,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} unit="g" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="kg" />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="weight" name="Scale (g)" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="hopper" name="Hopper (kg)" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Historical Hopper % Chart */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                <i className="fas fa-box text-indigo-500"></i>
                Hopper Level % (Server DB)
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={historyData.map(row => ({
                  time: new Date(row.recorded_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
                  percentage: row.hopper_percentage,
                }))}>
                  <defs>
                    <linearGradient id="hopperHistGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    formatter={(value?: number | string) => [`${Number(value ?? 0).toFixed(1)}%`, 'Hopper Level']}
                  />
                  <Area type="monotone" dataKey="percentage" stroke="#6366f1" strokeWidth={2} fill="url(#hopperHistGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Historical Feed Events Table */}
          {historyEvents.length > 0 && (
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                <i className="fas fa-list-alt text-violet-500"></i>
                Feeding Events Log (Server DB)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500">Time</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500">Event</th>
                      <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500">Weight</th>
                      <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500">Total Fed</th>
                      <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500">Hopper</th>
                      <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500">Feed #</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyEvents.slice().reverse().slice(0, 20).map((evt, i) => (
                      <tr key={evt.id || i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 text-xs text-gray-600">
                          {new Date(evt.recorded_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                            evt.status === 'feeding_started'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            <i className={`fas ${evt.status === 'feeding_started' ? 'fa-play' : 'fa-stop'} text-[9px]`}></i>
                            {evt.status === 'feeding_started' ? 'Started' : 'Stopped'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-xs font-mono text-gray-700">{evt.current_weight.toFixed(1)}g</td>
                        <td className="py-2 px-3 text-right text-xs font-mono text-gray-700">{(evt.total_grams_fed / 1000).toFixed(2)}kg</td>
                        <td className="py-2 px-3 text-right text-xs font-mono text-gray-700">{evt.hopper_percentage.toFixed(1)}%</td>
                        <td className="py-2 px-3 text-right text-xs font-mono text-gray-700">#{evt.feed_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex items-center justify-center">
          <div className="text-center text-gray-400">
            <i className="fas fa-database text-4xl mb-3"></i>
            <p className="text-sm font-semibold">No Historical Data Yet</p>
            <p className="text-xs mt-1">The server stores feeding data to MySQL automatically.<br/>Data will appear here once the device sends its first messages.</p>
          </div>
        </div>
      )}

      {/* ── DEVICE INFO FOOTER ── */}
      <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl p-4 sm:p-5 border border-gray-200">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
          <div>
            <span className="text-gray-500 block mb-1">Device ID</span>
            <span className="font-mono font-semibold text-gray-700">{DEVICE_ID}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">IP Address</span>
            <span className="font-mono font-semibold text-gray-700">{device.ipAddress || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">Uptime</span>
            <span className="font-semibold text-gray-700">{hasData ? formatUptime(device.uptimeMs) : 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">Last Message</span>
            <span className="font-semibold text-gray-700">{lastMqttMsg ? lastMqttMsg.toLocaleTimeString() : 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">Connection</span>
            <span className={`font-semibold ${
              mqttStatus === 'connected' ? 'text-green-600' :
              mqttStatus === 'connecting' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              <i className={`fas fa-circle text-[8px] mr-1`}></i>
              {mqttStatus === 'connected' ? 'WebSocket Live' : mqttStatus === 'connecting' ? 'Reconnecting...' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedingDashboard;
