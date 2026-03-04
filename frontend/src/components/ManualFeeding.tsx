import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchDeviceStatus,
  startManualFeeding,
  completeManualFeeding,
  cancelManualFeeding,
  fetchManualFeedingHistory,
} from '../services/supabase';
import type { FeeddbRow, ManualFeedingRow } from '../services/supabase';

/* ─── EMA Smoother (matches FeedingDashboard — fast alpha, no spike rejection) ─── */
class SmoothValue {
  private value = 0;
  private alpha: number;
  private initialized = false;
  constructor(alpha = 0.8) { this.alpha = alpha; }
  update(raw: number): number {
    if (!this.initialized || !isFinite(this.value)) { this.value = raw; this.initialized = true; return raw; }
    this.value += this.alpha * (raw - this.value);
    return this.value;
  }
}

/* ───────── Animated Tank Gauge ───────── */
const TankGauge: React.FC<{ level: number; capacity: number; isFeeding: boolean }> = ({
  level,
  capacity,
  isFeeding,
}) => {
  const pct = capacity > 0 ? Math.min(100, Math.max(0, (level / capacity) * 100)) : 0;
  const colour =
    pct > 60 ? 'from-emerald-400 to-emerald-600' : pct > 30 ? 'from-amber-400 to-amber-600' : 'from-red-400 to-red-600';
  const textColour = pct > 60 ? 'text-emerald-600' : pct > 30 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Tank shell */}
      <div className="relative w-36 h-56 sm:w-44 sm:h-64 rounded-2xl border-4 border-gray-300 bg-gray-100 overflow-hidden shadow-inner">
        {/* Water fill */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${colour} transition-all duration-700 ease-in-out`}
          style={{ height: `${pct}%` }}
        >
          {/* Wave animation */}
          <div className="absolute -top-2 left-0 right-0 h-4 overflow-hidden">
            <div
              className={`w-[200%] h-4 ${isFeeding ? 'animate-wave-fast' : 'animate-wave'}`}
              style={{
                background:
                  'repeating-linear-gradient(90deg, transparent, transparent 25%, rgba(255,255,255,0.25) 25%, rgba(255,255,255,0.25) 50%)',
              }}
            />
          </div>

          {/* Bubbles when feeding */}
          {isFeeding && (
            <>
              <span className="absolute bottom-4 left-[20%] w-2 h-2 bg-white/40 rounded-full animate-bubble1" />
              <span className="absolute bottom-8 left-[55%] w-3 h-3 bg-white/30 rounded-full animate-bubble2" />
              <span className="absolute bottom-2 left-[75%] w-2 h-2 bg-white/35 rounded-full animate-bubble3" />
            </>
          )}
        </div>
        {/* Centre percentage */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-3xl font-extrabold drop-shadow-lg ${pct > 50 ? 'text-white' : 'text-gray-700'}`}>
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
      {/* Level reading */}
      <div className="text-center">
        <span className={`text-2xl font-bold ${textColour}`}>{level.toFixed(2)} kg</span>
        <span className="text-sm text-gray-400 block">/ {capacity.toFixed(1)} kg capacity</span>
      </div>
    </div>
  );
};

/* ───────── Status Badge ───────── */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-700',
    feeding: 'bg-blue-100 text-blue-700 animate-pulse',
    cancelled: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
};

/* ═══════════════════════════════════════
   Main Component
   ═══════════════════════════════════════ */
const ManualFeeding: React.FC = () => {
  const DEVICE_ID = 'feed_device_001';

  // ── state ──
  const [tankLevel, setTankLevel] = useState(0);
  const [tankCapacity, setTankCapacity] = useState(20); // kg — read from device
  const [feedAmount, setFeedAmount] = useState('');
  const [unit, setUnit] = useState<'kg' | 'g'>('kg');
  const [isFeeding, setIsFeeding] = useState(false);
  const [activeFeedingId, setActiveFeedingId] = useState<number | null>(null);
  const [tankBefore, setTankBefore] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [dispensed, setDispensed] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [history, setHistory] = useState<ManualFeedingRow[]>([]);
  const [deviceOnline, setDeviceOnline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');

  const feedingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Client-side staleness tracking: if updated_at stops changing, device is offline
  const lastUpdatedAtRef = useRef<string>('');
  const staleCountRef = useRef(0);
  const STALE_THRESHOLD = 5; // 5 polls × 2s = 10s

  // EMA smoothers (alpha=0.8, no spike rejection — hard clamps handle impossible values)
  const smoothLevel = useRef(new SmoothValue(0.8));
  const smoothCap = useRef(new SmoothValue(0.8));

  /* ── helpers ── */
  const amountInKg = useCallback(() => {
    const v = parseFloat(feedAmount) || 0;
    return unit === 'g' ? v / 1000 : v;
  }, [feedAmount, unit]);

  /* ── fetch device status from Backend API (MySQL sensor_devices, grams → kg → smooth) ── */
  const refreshDeviceStatus = useCallback(async () => {
    const row: FeeddbRow | null = await fetchDeviceStatus(DEVICE_ID);
    if (row) {
      const rawLevel = (row.tank_level ?? 0) / 1000;
      const rawCap = (row.tank_capacity ?? 20000) / 1000;
      // Hard-clamp: level ≤ capacity, both ≥ 0
      setTankLevel(Math.min(Math.max(smoothLevel.current.update(rawLevel), 0), rawCap));
      setTankCapacity(smoothCap.current.update(rawCap));

      // Client-side staleness: track if updated_at changes between polls
      const currentUpdatedAt = row.updated_at || '';
      if (currentUpdatedAt && currentUpdatedAt !== lastUpdatedAtRef.current) {
        lastUpdatedAtRef.current = currentUpdatedAt;
        staleCountRef.current = 0;
      } else {
        staleCountRef.current++;
      }
      const backendSaysOnline = row.status === 'online';
      const dataIsFresh = staleCountRef.current < STALE_THRESHOLD;
      setDeviceOnline(backendSaysOnline && dataIsFresh);
      setLastUpdate(new Date(row.updated_at ?? Date.now()).toLocaleTimeString());
    }
  }, []);

  /* ── initial load + 2s Backend polling (Backend reads MySQL sensor_devices) ── */
  useEffect(() => {
    // Bootstrap: fetch current state + history
    refreshDeviceStatus();
    fetchManualFeedingHistory(DEVICE_ID, 20).then(setHistory).catch(() => {});

    // Poll device status every 2s via Backend API
    const pollInterval = setInterval(() => {
      refreshDeviceStatus();
    }, 2000);

    // Poll feeding history every 10s (lightweight)
    const historyPollInterval = setInterval(() => {
      fetchManualFeedingHistory(DEVICE_ID, 20).then(setHistory).catch(() => {});
    }, 10000);

    return () => {
      if (feedingPollRef.current) clearInterval(feedingPollRef.current);
      clearInterval(pollInterval);
      clearInterval(historyPollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── monitor tank drop while feeding — auto-stop ── */
  useEffect(() => {
    if (!isFeeding || !activeFeedingId) return;

    const target = amountInKg();
    const dropped = Math.max(0, tankBefore - tankLevel);
    setDispensed(dropped);
    setProgressPct(target > 0 ? Math.min(100, (dropped / target) * 100) : 0);

    // Auto-stop when dispensed >= target
    if (dropped >= target && target > 0) {
      handleComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tankLevel, isFeeding]);

  /* ── start feeding ── */
  const handleStart = async () => {
    const target = amountInKg();
    if (target <= 0) return;

    const currentTank = tankLevel;
    setTankBefore(currentTank);
    setStartTime(Date.now());
    setDispensed(0);
    setProgressPct(0);

    const res = await startManualFeeding(DEVICE_ID, target, 'kg', currentTank);
    if (res.error) {
      alert('Failed to start feeding: ' + res.error);
      return;
    }
    setActiveFeedingId(res.id ?? null);
    setIsFeeding(true);
  };

  /* ── complete feeding ── */
  const handleComplete = async () => {
    if (!activeFeedingId) return;
    const now = Date.now();
    const dur = now - startTime;
    const actualDispensed = Math.max(0, tankBefore - tankLevel);

    await completeManualFeeding(activeFeedingId, tankLevel, actualDispensed, dur);
    cleanup();
  };

  /* ── cancel feeding ── */
  const handleCancel = async () => {
    if (!activeFeedingId) return;
    await cancelManualFeeding(activeFeedingId, tankLevel);
    cleanup();
  };

  const cleanup = () => {
    setIsFeeding(false);
    setActiveFeedingId(null);
    setProgressPct(0);
    setDispensed(0);
    fetchManualFeedingHistory(DEVICE_ID, 20).then(setHistory);
  };

  /* ── presets ── */
  const presets = [
    { label: '0.5 kg', value: '0.5', u: 'kg' as const },
    { label: '1 kg', value: '1', u: 'kg' as const },
    { label: '2 kg', value: '2', u: 'kg' as const },
    { label: '3 kg', value: '3', u: 'kg' as const },
  ];

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const fmtDuration = (ms: number | null) => {
    if (!ms) return '-';
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  /* ═══════════════════════════════════════
     RENDER
     ═══════════════════════════════════════ */
  return (
    <div className="space-y-5 max-w-5xl mx-auto animate-fadeIn">
      {/* ── Live Tank status + Gauge ── */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 sm:p-7">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Gauge */}
          <TankGauge level={tankLevel} capacity={tankCapacity} isFeeding={isFeeding} />

          {/* Info */}
          <div className="flex-1 w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">
                <i className="fas fa-database mr-2 text-cyan-500" />
                Feed Tank — Pond&nbsp;A
              </h3>
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <span
                  className={`w-2 h-2 rounded-full ${deviceOnline ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}
                />
                <span className={deviceOnline ? 'text-green-600' : 'text-red-500'}>
                  {deviceOnline ? 'Online' : 'Offline'}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-xl p-3">
                <span className="text-gray-500 text-xs block">Current Level</span>
                <span className="text-lg font-bold text-gray-800">{tankLevel.toFixed(2)} kg</span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <span className="text-gray-500 text-xs block">Last Update</span>
                <span className="text-lg font-bold text-gray-800">{lastUpdate || '—'}</span>
              </div>
            </div>

            {/* Feeding progress bar (visible only when feeding) */}
            {isFeeding && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 animate-fadeIn">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-semibold text-blue-700">
                    <i className="fas fa-spinner fa-spin mr-1.5" />
                    Dispensing…
                  </span>
                  <span className="text-blue-600 font-mono">{dispensed.toFixed(2)} / {amountInKg().toFixed(2)} kg</span>
                </div>
                <div className="h-3 bg-blue-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-xs text-blue-500 mt-1.5">
                  Auto-stop at {amountInKg().toFixed(2)} kg • Elapsed {fmtDuration(Date.now() - startTime)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Feed Control Card ── */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 sm:p-7">
        <h3 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
          <i className="fas fa-hand-pointer text-orange-500" />
          Feed Control
        </h3>

        {/* Quick presets */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Presets</label>
          <div className="grid grid-cols-4 gap-2">
            {presets.map((p) => (
              <button
                key={p.value}
                disabled={isFeeding}
                onClick={() => {
                  setFeedAmount(p.value);
                  setUnit(p.u);
                }}
                className={`py-2.5 rounded-xl text-sm font-semibold transition-all
                  ${feedAmount === p.value && unit === p.u
                    ? 'bg-orange-500 text-white shadow-lg scale-[1.04]'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                  ${isFeeding ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Amount input */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1">
            <input
              type="number"
              step="0.1"
              min="0"
              max={unit === 'kg' ? '5' : '5000'}
              value={feedAmount}
              onChange={(e) => setFeedAmount(e.target.value)}
              disabled={isFeeding}
              placeholder="Enter amount"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-lg font-bold disabled:bg-gray-100 disabled:cursor-not-allowed transition"
            />
          </div>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as 'kg' | 'g')}
            disabled={isFeeding}
            className="w-24 px-3 py-3 border-2 border-gray-200 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="kg">kg</option>
            <option value="g">g</option>
          </select>
        </div>

        {/* Info text */}
        <p className="text-xs text-gray-400 mb-5 -mt-2">
          <i className="fas fa-info-circle mr-1" />
          System will feed until tank drops by the entered amount, then auto-stop.
        </p>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          {!isFeeding ? (
            <button
              onClick={handleStart}
              disabled={!feedAmount || amountInKg() <= 0 || amountInKg() > tankLevel}
              className="col-span-2 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3
                bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600
                shadow-lg hover:shadow-xl active:scale-[0.98]
                disabled:from-gray-300 disabled:to-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <i className="fas fa-play-circle text-xl" />
              Feed Now — {amountInKg() > 0 ? `${amountInKg().toFixed(2)} kg` : '0 kg'}
            </button>
          ) : (
            <>
              <button
                onClick={handleComplete}
                className="py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2
                  bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg active:scale-[0.98]"
              >
                <i className="fas fa-check-circle" />
                Complete
              </button>
              <button
                onClick={handleCancel}
                className="py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2
                  bg-red-500 text-white hover:bg-red-600 shadow-lg active:scale-[0.98]"
              >
                <i className="fas fa-times-circle" />
                Cancel
              </button>
            </>
          )}
        </div>

        {/* Warning when amount exceeds current level */}
        {feedAmount && amountInKg() > tankLevel && !isFeeding && (
          <p className="mt-3 text-sm text-red-500 animate-fadeIn">
            <i className="fas fa-exclamation-triangle mr-1" />
            Amount exceeds current tank level ({tankLevel.toFixed(2)} kg). Please refill the tank or reduce amount.
          </p>
        )}
      </div>

      {/* ── Recent Manual Feedings ── */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-history text-gray-500" />
            Recent Manual Feedings
          </h3>
          <span className="text-xs text-gray-400">{history.length} records</span>
        </div>

        {history.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <i className="fas fa-inbox text-4xl mb-3 block" />
            No manual feedings yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Requested</th>
                  <th className="px-4 py-3 text-left">Dispensed</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{fmtDate(row.started_at)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">
                      {row.requested_amount} {row.requested_unit}
                    </td>
                    <td className="px-4 py-3 font-semibold text-purple-600">
                      {row.actual_dispensed != null ? `${Number(row.actual_dispensed).toFixed(2)} kg` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fmtDuration(row.duration_ms)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Safety Note */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-5 border border-blue-200 text-sm text-blue-800">
        <h4 className="font-semibold text-blue-900 mb-2">
          <i className="fas fa-shield-alt mr-1.5 text-blue-600" />
          Safety Guidelines
        </h4>
        <ul className="grid sm:grid-cols-2 gap-1.5">
          {[
            'Monitor the pond during manual feeding',
            'Do not exceed recommended amounts',
            'Wait at least 4 hours between feedings',
            'Check water quality after feeding',
          ].map((t) => (
            <li key={t} className="flex items-start gap-1.5">
              <i className="fas fa-check-circle text-green-600 mt-0.5 text-xs" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ManualFeeding;
