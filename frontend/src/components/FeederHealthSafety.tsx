import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

const DEVICE_ID = 'feed_device_001';
const API_BASE = import.meta.env.VITE_API_URL || 'https://backend.koifishfriend.online';
const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws/feeding';

interface DeviceLive {
  status: string;
  feedingActive: boolean;
  stepperActive: boolean;
  motorStatus: string;
  plateSpeed: number;
  currentWeight: number;
  hopperLevel: number;
  hopperCapacity: number;
  hopperPercentage: number;
  currentESCPercent: number;
  escPercent: number;
  rssi: number | null;
  ipAddress: string | null;
  uptimeMs: number;
  feedCount: number;
  totalGramsFed: number;
}

interface DiagLog {
  time: string;
  action: string;
  result: 'success' | 'error';
  detail: string;
}

const INITIAL: DeviceLive = {
  status: 'offline', feedingActive: false, stepperActive: false, motorStatus: 'STOPPED',
  plateSpeed: 0, currentWeight: 0, hopperLevel: 0, hopperCapacity: 20000, hopperPercentage: 0,
  currentESCPercent: 0, escPercent: 0, rssi: null, ipAddress: null, uptimeMs: 0,
  feedCount: 0, totalGramsFed: 0,
};

const FeederHealthSafety: React.FC = () => {
  const [device, setDevice] = useState<DeviceLive>(INITIAL);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastMsg, setLastMsg] = useState<Date | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offlineRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Stepper controls ──
  const [stepperOn, setStepperOn] = useState(false);
  const [stepperSpeed, setStepperSpeed] = useState(500);

  // ── ESC controls ──
  const [escOn, setEscOn] = useState(false);
  const [escPercent, setEscPercent] = useState(25);
  const ESC_MAX = 34; // ⚠ Safety limit — 35%+ damages the device

  // ── Calibration ──
  const [calFactor, setCalFactor] = useState(-2520);
  const [calStatus, setCalStatus] = useState('');

  // ── Diagnostic log ──
  const [diagLog, setDiagLog] = useState<DiagLog[]>([]);

  const isOnline = device.status !== 'offline';

  const addLog = useCallback((action: string, result: 'success' | 'error', detail: string) => {
    const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    setDiagLog(prev => [{ time: t, action, result, detail }, ...prev].slice(0, 50));
  }, []);

  // ─── WebSocket connection ───
  const handleWsMessage = useCallback((raw: string) => {
    try {
      const d = JSON.parse(raw);
      setDevice({
        status: d.status || 'online',
        feedingActive: d.feedingActive || false,
        stepperActive: d.stepperActive || false,
        motorStatus: d.motorStatus || 'STOPPED',
        plateSpeed: d.plateSpeed || 0,
        currentWeight: d.weight || 0,
        hopperLevel: d.hopperLevel || 0,
        hopperCapacity: d.hopperCapacity || 20000,
        hopperPercentage: d.hopperPercentage || 0,
        currentESCPercent: d.escPercent || d.escPotPercent || 0,
        escPercent: d.escPercent || 0,
        rssi: d.rssi ?? null,
        ipAddress: d.ipAddress || null,
        uptimeMs: d.uptimeMs || 0,
        feedCount: d.feedCount || 0,
        totalGramsFed: d.totalGrams || 0,
      });
      setLastMsg(new Date());

      // Track stepper / ESC state from device
      if (d.stepperActive !== undefined) setStepperOn(d.stepperActive);
      if (d.status?.startsWith('diag_stepper_on')) setStepperOn(true);
      if (d.status?.startsWith('diag_stepper_off')) setStepperOn(false);
      if (d.status?.startsWith('diag_esc_on')) setEscOn(true);
      if (d.status?.startsWith('diag_esc_off')) setEscOn(false);
      if (d.status?.startsWith('diag_all_stop')) { setStepperOn(false); setEscOn(false); }

      // Log diag acknowledgements
      const s = d.status || '';
      if (s.startsWith('diag_') || s === 'tared' || s === 'calibrated') {
        addLog(s, 'success', `Device confirmed: ${s}`);
      }

      if (offlineRef.current) clearTimeout(offlineRef.current);
      offlineRef.current = setTimeout(() => setDevice(prev => ({ ...prev, status: 'offline' })), 6000);
    } catch { /* ignore */ }
  }, [addLog]);

  useEffect(() => {
    let mounted = true;
    const connect = () => {
      if (!mounted) return;
      setWsStatus('connecting');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => { if (mounted) setWsStatus('connected'); };
      ws.onmessage = (e) => { if (mounted) handleWsMessage(e.data); };
      ws.onerror = () => { if (mounted) setWsStatus('disconnected'); };
      ws.onclose = () => {
        if (!mounted) return;
        setWsStatus('disconnected');
        wsRef.current = null;
        reconnectRef.current = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      mounted = false;
      if (offlineRef.current) clearTimeout(offlineRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [handleWsMessage]);

  // ── API helpers ──
  const sendDiag = async (action: string, params: Record<string, string | number> = {}) => {
    try {
      const qs = new URLSearchParams({ deviceId: DEVICE_ID, action, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
      await api.post(`/feeding/diagnostic?${qs.toString()}`);
      addLog(action, 'success', `Sent ${action}`);
    } catch (err) {
      addLog(action, 'error', `Failed: ${err}`);
    }
  };

  const handleTare = async () => {
    try {
      await api.post(`/feeding/tare?deviceId=${DEVICE_ID}`);
      setCalStatus('Tare command sent — waiting for confirmation...');
      addLog('tare', 'success', 'Tare command sent');
    } catch {
      setCalStatus('Failed to send tare command');
      addLog('tare', 'error', 'API call failed');
    }
  };

  const handleCalibrate = async () => {
    try {
      await api.post(`/feeding/calibrate?deviceId=${DEVICE_ID}&calibrationFactor=${calFactor}`);
      setCalStatus(`Calibration factor ${calFactor} sent — waiting for confirmation...`);
      addLog('calibrate', 'success', `Factor: ${calFactor}`);
    } catch {
      setCalStatus('Failed to send calibration');
      addLog('calibrate', 'error', 'API call failed');
    }
  };

  const handleDiagReport = () => sendDiag('diag_report');

  // ── Helpers ──
  const formatUptime = (ms: number) => {
    if (ms <= 0) return 'N/A';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s % 60}s`;
  };

  const getSignal = (rssi: number | null) => {
    if (rssi === null) return { label: 'N/A', bars: 0 };
    if (rssi > -50) return { label: 'Excellent', bars: 4 };
    if (rssi > -60) return { label: 'Good', bars: 3 };
    if (rssi > -70) return { label: 'Fair', bars: 2 };
    return { label: 'Weak', bars: 1 };
  };

  const signal = getSignal(device.rssi);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 rounded-2xl p-4 sm:p-6 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <span className="text-2xl sm:text-3xl">🔧</span>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Device Diagnostics & Calibration</h2>
              <p className="text-pink-100 text-xs sm:text-sm">Real-time motor testing &bull; Load cell calibration &bull; Pond A</p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm ${
              wsStatus === 'connected' ? 'bg-green-400/30 text-green-100' : wsStatus === 'connecting' ? 'bg-yellow-400/30 text-yellow-100' : 'bg-red-400/30 text-red-100'
            }`}>
              <span className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-green-400 animate-pulse' : wsStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'}`} />
              {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm ${
              isOnline ? 'bg-green-400/30 text-green-100' : 'bg-red-400/30 text-red-100'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              {isOnline ? 'Device Online' : 'Device Offline'}
            </div>
          </div>
        </div>
      </div>

      {/* ── DEVICE STATUS OVERVIEW ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Connection */}
        <div className={`rounded-2xl p-4 border shadow-sm ${isOnline ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Connection</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isOnline ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
              <i className="fas fa-wifi"></i>
            </div>
          </div>
          <p className={`text-lg font-bold ${isOnline ? 'text-green-700' : 'text-red-700'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </p>
          <p className="text-xs text-gray-500 mt-1">{device.ipAddress || 'N/A'}</p>
        </div>

        {/* Signal */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Signal</span>
            <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
              <i className="fas fa-signal"></i>
            </div>
          </div>
          <p className="text-lg font-bold text-gray-800">
            {isOnline && device.rssi !== null ? `${device.rssi} dBm` : '--'}
          </p>
          <div className="flex items-center gap-1 mt-1">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`w-1.5 rounded-full ${i <= signal.bars ? 'bg-violet-500' : 'bg-gray-200'}`} style={{ height: `${6 + i * 3}px` }} />
            ))}
            <span className="text-xs text-gray-500 ml-1">{signal.label}</span>
          </div>
        </div>

        {/* Uptime */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Uptime</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-600 flex items-center justify-center">
              <i className="fas fa-clock"></i>
            </div>
          </div>
          <p className="text-lg font-bold text-gray-800">{isOnline ? formatUptime(device.uptimeMs) : '--'}</p>
          <p className="text-xs text-gray-500 mt-1">Last msg: {lastMsg ? lastMsg.toLocaleTimeString() : 'N/A'}</p>
        </div>

        {/* Scale */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Scale</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <i className="fas fa-weight-hanging"></i>
            </div>
          </div>
          <p className="text-lg font-bold text-gray-800">
            {isOnline ? `${device.currentWeight.toFixed(1)} g` : '--'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Hopper: {isOnline ? `${device.hopperPercentage.toFixed(1)}%` : '--'}</p>
        </div>
      </div>

      {/* ── NEMA 17 STEPPER MOTOR DIAGNOSTICS ── */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
            <i className="fas fa-cog"></i>
          </div>
          NEMA 17 Stepper Motor
          <span className={`ml-auto text-xs font-semibold px-3 py-1 rounded-full ${
            stepperOn ? 'bg-blue-100 text-blue-700 animate-pulse' : 'bg-gray-100 text-gray-500'
          }`}>
            {stepperOn ? 'RUNNING' : 'STOPPED'}
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Speed Control */}
          <div className="bg-gray-50 rounded-xl p-4">
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Step Delay (μs) — Lower = Faster
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={100}
                max={2000}
                step={50}
                value={stepperSpeed}
                onChange={(e) => setStepperSpeed(Number(e.target.value))}
                className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-sm font-mono font-bold text-blue-700 w-16 text-right">{stepperSpeed}μs</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
              <span>Fast (100)</span>
              <span>Slow (2000)</span>
            </div>
          </div>

          {/* Motor Actions */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { sendDiag('diag_stepper_on', { stepperSpeed }); setStepperOn(true); }}
                disabled={stepperOn}
                className={`py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  !stepperOn
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:shadow-lg active:scale-95'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <i className="fas fa-play"></i> Start
              </button>
              <button
                onClick={() => { sendDiag('diag_stepper_off'); setStepperOn(false); }}
                className="py-3 rounded-xl font-semibold text-sm bg-gradient-to-br from-gray-500 to-gray-600 text-white hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <i className="fas fa-stop"></i> Stop
              </button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              <i className="fas fa-info-circle mr-1"></i>
              Controls the NEMA 17 stepper motor (feed dispenser plate). Adjust delay to change rotation speed.
            </div>
          </div>
        </div>
      </div>

      {/* ── ESC / BRUSHLESS MOTOR DIAGNOSTICS ── */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <i className="fas fa-fan"></i>
          </div>
          ESC Brushless Motor (Feed Spreader)
          <span className={`ml-auto text-xs font-semibold px-3 py-1 rounded-full ${
            escOn ? 'bg-emerald-100 text-emerald-700 animate-pulse' : 'bg-gray-100 text-gray-500'
          }`}>
            {escOn ? `RUNNING ${device.currentESCPercent || escPercent}%` : 'STOPPED'}
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* PWM Control */}
          <div className="bg-gray-50 rounded-xl p-4">
            <label className="text-sm font-medium text-gray-700 block mb-2">
              ESC Power (PWM %)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={ESC_MAX}
                step={1}
                value={escPercent}
                onChange={(e) => setEscPercent(Number(e.target.value))}
                className="flex-1 h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <span className="text-sm font-mono font-bold text-emerald-700 w-12 text-right">{escPercent}%</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
              <span>Off (0%)</span>
              <span>Max ({ESC_MAX}%)</span>
            </div>
            {/* Live ESC value from device */}
            {isOnline && device.currentESCPercent > 0 && (
              <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs text-emerald-700">
                <i className="fas fa-tachometer-alt mr-1"></i>
                Device reporting: {device.currentESCPercent}% PWM
              </div>
            )}
          </div>

          {/* ESC Actions */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { sendDiag('diag_esc_on', { escPercent }); setEscOn(true); }}
                disabled={escOn}
                className={`py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  !escOn
                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:shadow-lg active:scale-95'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <i className="fas fa-play"></i> Start
              </button>
              <button
                onClick={() => { sendDiag('diag_esc_off'); setEscOn(false); }}
                className="py-3 rounded-xl font-semibold text-sm bg-gradient-to-br from-gray-500 to-gray-600 text-white hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <i className="fas fa-stop"></i> Stop
              </button>
            </div>
            {/* Update PWM live */}
            {escOn && (
              <button
                onClick={() => sendDiag('diag_esc_on', { escPercent })}
                className="py-2 rounded-xl font-semibold text-xs bg-gradient-to-br from-teal-500 to-cyan-600 text-white hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <i className="fas fa-sync"></i> Update PWM to {escPercent}%
              </button>
            )}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700">
              <i className="fas fa-info-circle mr-1"></i>
              Controls the ESC brushless motor (feed spreader). <strong>Max 34%</strong> — exceeding this can damage the device. Use low values (10-25%) for testing.
            </div>
          </div>
        </div>
      </div>

      {/* ── LOAD CELL CALIBRATION ── */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
            <i className="fas fa-balance-scale"></i>
          </div>
          Load Cell Calibration
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Tare (Zero) */}
          <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
            <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <i className="fas fa-bullseye"></i>
              Set Zero Point (Tare)
            </h4>
            <p className="text-xs text-amber-700 mb-3">
              Remove all weight from the scale, then press Tare to set the current reading as 0g.
            </p>
            <div className="mb-3 bg-white rounded-lg p-3 border border-amber-200 text-center">
              <span className="text-xs text-gray-500 block">Current Reading</span>
              <span className="text-2xl font-bold text-gray-800">
                {isOnline ? `${device.currentWeight.toFixed(1)} g` : '-- g'}
              </span>
            </div>
            <button
              onClick={handleTare}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-br from-amber-500 to-orange-600 text-white hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <i className="fas fa-crosshairs"></i> Tare (Set Zero)
            </button>
          </div>

          {/* Calibration Factor */}
          <div className="bg-purple-50 rounded-xl p-5 border border-purple-200">
            <h4 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
              <i className="fas fa-sliders-h"></i>
              Calibration Factor
            </h4>
            <p className="text-xs text-purple-700 mb-3">
              Adjust the calibration factor to match a known weight. Place a known weight on the scale, then adjust until the reading is accurate.
            </p>
            <div className="mb-3">
              <label className="text-xs font-medium text-gray-600 block mb-1">Factor Value</label>
              <input
                type="number"
                value={calFactor}
                onChange={(e) => setCalFactor(Number(e.target.value))}
                className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                step={10}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[-2520, -1260, -420].map(val => (
                <button
                  key={val}
                  onClick={() => setCalFactor(val)}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    calFactor === val
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
            <button
              onClick={handleCalibrate}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-br from-purple-500 to-indigo-600 text-white hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <i className="fas fa-paper-plane"></i> Apply Calibration
            </button>
          </div>

          {/* Calibration Guide */}
          <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
              <i className="fas fa-book-open"></i>
              Calibration Guide
            </h4>
            <ol className="space-y-2 text-xs text-blue-700">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                Remove all weight from the load cell platform
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                Press <strong>Tare (Set Zero)</strong> to zero the scale
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                Place a known weight (e.g. 100g, 500g, 1kg)
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-[10px] font-bold shrink-0">4</span>
                Adjust the calibration factor until the reading matches
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-[10px] font-bold shrink-0">5</span>
                Press <strong>Apply Calibration</strong> to save
              </li>
            </ol>
            {calStatus && (
              <div className="mt-3 bg-white rounded-lg p-2 border border-blue-200 text-xs text-blue-700">
                <i className="fas fa-info-circle mr-1"></i>
                {calStatus}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── EMERGENCY STOP + DIAGNOSTIC REPORT ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => { sendDiag('diag_all_stop'); setStepperOn(false); setEscOn(false); }}
          className="py-5 rounded-2xl font-bold text-lg bg-gradient-to-br from-red-500 to-rose-700 text-white hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 ring-2 ring-red-300"
        >
          <i className="fas fa-exclamation-triangle text-2xl"></i>
          EMERGENCY STOP ALL MOTORS
        </button>
        <button
          onClick={handleDiagReport}
          className="py-5 rounded-2xl font-bold text-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <i className="fas fa-file-medical-alt text-2xl"></i>
          Get Diagnostic Report
        </button>
      </div>

      {/* ── SYSTEM HEALTH OVERVIEW ── */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
          <i className="fas fa-heartbeat text-red-500"></i>
          System Health Overview
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Hopper', value: isOnline ? `${device.hopperPercentage.toFixed(0)}%` : '--', ok: isOnline && device.hopperPercentage > 15, icon: 'fa-box' },
            { label: 'Motor', value: isOnline ? device.motorStatus : '--', ok: isOnline, icon: 'fa-cog' },
            { label: 'WiFi', value: isOnline ? 'Connected' : 'Offline', ok: isOnline, icon: 'fa-wifi' },
            { label: 'Feeds', value: isOnline ? String(device.feedCount) : '--', ok: true, icon: 'fa-utensils' },
            { label: 'Total Fed', value: isOnline ? `${(device.totalGramsFed / 1000).toFixed(1)}kg` : '--', ok: true, icon: 'fa-weight' },
            { label: 'Scale', value: isOnline ? `${device.currentWeight.toFixed(0)}g` : '--', ok: isOnline, icon: 'fa-balance-scale' },
          ].map((item, i) => (
            <div key={i} className={`rounded-xl p-3 border text-center ${
              !isOnline ? 'bg-gray-50 border-gray-200' : item.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <i className={`fas ${item.icon} text-lg mb-1 ${!isOnline ? 'text-gray-400' : item.ok ? 'text-green-500' : 'text-red-500'}`}></i>
              <p className={`text-lg font-bold ${!isOnline ? 'text-gray-400' : item.ok ? 'text-green-700' : 'text-red-700'}`}>{item.value}</p>
              <p className="text-[10px] text-gray-500 uppercase font-semibold">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── DIAGNOSTIC LOG ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-terminal text-gray-600"></i>
            Diagnostic Log
          </h3>
          {diagLog.length > 0 && (
            <button
              onClick={() => setDiagLog([])}
              className="text-xs text-gray-500 hover:text-red-500 transition-colors"
            >
              <i className="fas fa-trash mr-1"></i> Clear
            </button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto">
          {diagLog.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <i className="fas fa-clipboard-list text-3xl mb-2"></i>
              <p className="text-sm">No diagnostic events yet. Run a test to see results here.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Time</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Action</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Result</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {diagLog.map((entry, i) => (
                  <tr key={i} className="hover:bg-gray-50 text-sm">
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{entry.time}</td>
                    <td className="px-4 py-2 font-semibold text-gray-800">{entry.action}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        entry.result === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {entry.result}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">{entry.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── DEVICE INFO FOOTER ── */}
      <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl p-4 border border-gray-200">
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
            <span className="font-semibold text-gray-700">{isOnline ? formatUptime(device.uptimeMs) : 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">Last Message</span>
            <span className="font-semibold text-gray-700">{lastMsg ? lastMsg.toLocaleTimeString() : 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">WebSocket</span>
            <span className={`font-semibold ${wsStatus === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
              <i className="fas fa-circle text-[8px] mr-1"></i>
              {wsStatus === 'connected' ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeederHealthSafety;
