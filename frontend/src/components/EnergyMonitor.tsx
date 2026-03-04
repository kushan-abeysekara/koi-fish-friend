import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { sensorDataApi } from '../services/api';
import type { SensorData } from '../services/api';
// Direct Supabase calls removed — frontend is HTTPS, Supabase is HTTP.
// All data now goes through the Spring Boot backend (HTTPS) as a proxy.
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';

// ── helpers ──────────────────────────────────────────────────────────────────
const timeRangeLabel = (h: number) => {
  if (h === 1)   return '1 Hour';
  if (h === 168) return '1 Week';
  if (h === 72)  return '3 Days';
  return `${h} Hours`;
};

const statusStyle = (status: string) => {
  if (status === 'normal')   return 'bg-emerald-100 text-emerald-700';
  if (status === 'warning')  return 'bg-amber-100   text-amber-700';
  if (status === 'critical') return 'bg-red-100     text-red-700';
  return 'bg-gray-100 text-gray-600';
};

// ── component ─────────────────────────────────────────────────────────────────
export default function EnergyMonitor() {
  const [latestData, setLatestData] = useState<SensorData | null>(null);
  const [historicalData, setHistoricalData] = useState<SensorData[]>([]);
  const [electricityRate, setElectricityRate] = useState<number>(25);
  const [selectedHours, setSelectedHours] = useState<number>(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'realtime' | 'analysis'>('realtime');
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── WebSocket: real-time live readings from MQTT data messages ───────────
  useEffect(() => {
    let isMounted = true;
    const API_BASE = import.meta.env.VITE_API_URL || 'https://koifish-backend-tqteaf-bae886-187-77-189-5.traefik.me';
    const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws/feeding'; // shared WS channel — filter by BM_ prefix

    const connect = () => {
      if (!isMounted) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const d = JSON.parse(event.data);
          // Only handle data messages (have voltage field), not status messages
          if (!d.deviceId?.startsWith('BM_') || d.voltage === undefined) return;

          const now = new Date();
          setLastUpdateTime(now);
          // Build a pseudo-SensorData from the MQTT payload
          setLatestData(prev => ({
            id: prev?.id ?? 0,
            device: prev?.device ?? ({ deviceId: d.deviceId } as SensorData['device']),
            pond: prev?.pond ?? null,
            voltage: d.voltage ?? 0,
            current: d.current ?? 0,
            power: d.power ?? 0,
            energyWh: d.energyWh ?? 0,
            status: d.status ?? 'normal',
            timestamp: now.toISOString(),
          }));

          // Offline watchdog: no message in 15 s → clear live data
          if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
          offlineTimerRef.current = setTimeout(() => {
            setLatestData(null);
            setLastUpdateTime(null);
          }, 15000);
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        wsRef.current = null;
        reconnectTimerRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => { /* close will fire next */ };
    };

    connect();

    return () => {
      isMounted = false;
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, []);

  // Supabase Realtime removed — direct ws:// blocked from HTTPS pages.
  // Live data comes from Spring Boot WebSocket (wss://) above.

  // ── History: Supabase primary → REST fallback ───────────────────────────
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Fetch energy history via Spring Boot proxy (HTTPS safe — no Mixed Content)
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'https://koifish-backend-tqteaf-bae886-187-77-189-5.traefik.me';
      const res = await fetch(`${API_BASE}/api/energy/history?hours=${selectedHours}&limit=1500`);
      if (res.ok) {
        const json = await res.json();
        // pg/query returns { rows: [...] }
        const rows: Record<string, unknown>[] = Array.isArray(json) ? json : (json.rows ?? []);
        if (rows.length > 0) {
          const mapped: SensorData[] = rows.map((r, i) => ({
            id:        (r.id as number) ?? i,
            device:    { deviceId: r.device_id as string } as SensorData['device'],
            pond:      null,
            voltage:   (r.voltage  as number) ?? 0,
            current:   (r.current  as number) ?? 0,
            power:     (r.power    as number) ?? 0,
            energyWh:  (r.energy_wh as number) ?? 0,
            status:    (r.status   as string) ?? 'normal',
            timestamp: (r.recorded_at as string) ?? '',
          }));
          setHistoricalData(mapped);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('[EnergyMonitor] Backend energy/history fetch failed:', err);
    }

    // Final fallback: original sensorDataApi (MySQL — may be empty for energy now)
    try {
      const historicalRes = await sensorDataApi.getEnergyHistory(selectedHours);
      if (historicalRes.success && historicalRes.data) {
        setHistoricalData(historicalRes.data);
      } else {
        setHistoricalData([]);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      setError('Failed to fetch historical data');
    } finally {
      setLoading(false);
    }
  }, [selectedHours]);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, [fetchHistory]);

  const calculateTotalCost = () => {
    if (!latestData) return 0;
    return (latestData.energyWh / 1000) * electricityRate;
  };
  const calculateHistoricalEnergy = () => {
    if (historicalData.length < 2) return 0;
    return (historicalData[0].energyWh - historicalData[historicalData.length - 1].energyWh) / 1000;
  };
  const calculateHistoricalCost = () => calculateHistoricalEnergy() * electricityRate;
  const calculateAveragePower = () => {
    if (historicalData.length === 0) return 0;
    return historicalData.reduce((s, d) => s + d.power, 0) / historicalData.length;
  };
  const formatTimestamp = (ts: string) => new Date(ts).toLocaleTimeString();
  const formatFullTimestamp = (ts: string) => new Date(ts).toLocaleString();

  // latestData is null when offline (cleared by the 15s WebSocket watchdog)
  const isOnline = latestData !== null;

  // Group by minute — keep only the most recent reading per minute
  // This de-duplicates old DB rows that were saved every 3s (before the backend throttle)
  const minuteFilteredData = useMemo(() => {
    const seen = new Map<string, SensorData>();
    for (const d of historicalData) {
      // Ensure UTC parsing: append 'Z' if no timezone info present
      const ts = d.timestamp.endsWith('Z') || d.timestamp.includes('+') ? d.timestamp : d.timestamp + 'Z';
      // key = "YYYY-MM-DDTHH:MM" — truncate to the minute
      const key = new Date(ts).toISOString().slice(0, 16);
      if (!seen.has(key)) seen.set(key, d); // first hit = most recent (data comes DESC)
    }
    return Array.from(seen.values());
  }, [historicalData]);

  const chartData = useMemo(() => {
    return [...minuteFilteredData].reverse().map(d => ({
      time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      voltage: parseFloat((d.voltage ?? 0).toFixed(1)),
      current: parseFloat((d.current ?? 0).toFixed(3)),
    }));
  }, [minuteFilteredData]);

  // ── shared chart config ───────────────────────────────────────────────────
  const ChartEmpty = () => (
    <div className="flex flex-col items-center justify-center h-44 text-gray-400 gap-2">
      <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0
             002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2
             2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2
             2 0 01-2-2z" />
      </svg>
      <span className="text-sm">Collecting data — waiting for more readings</span>
    </div>
  );

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero Header ──────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white px-6 py-5 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <span className="text-yellow-400">⚡</span> Energy Monitor
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">Real-time power monitoring &amp; cost analysis</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Live badge */}
            <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-full text-sm font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              LIVE · {lastUpdateTime ? lastUpdateTime.toLocaleTimeString() : 'Connecting…'}
            </div>
            {/* Power Control link */}
            <a
              href="/dashboard/power-control"
              className="flex items-center gap-1.5 bg-blue-500/20 border border-blue-500/40 text-blue-300 hover:bg-blue-500/30 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors"
            >
              🔌 Power Control →
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Toolbar ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-5 py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Time Range
              </label>
              <select
                value={selectedHours}
                onChange={(e) => setSelectedHours(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value={1}>Last 1 Hour</option>
                <option value={6}>Last 6 Hours</option>
                <option value={12}>Last 12 Hours</option>
                <option value={24}>Last 24 Hours</option>
                <option value={72}>Last 3 Days</option>
                <option value={168}>Last Week</option>
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Electricity Rate (LKR / kWh)
              </label>
              <input
                type="number"
                value={electricityRate}
                onChange={(e) => setElectricityRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                min="0"
                step="0.01"
              />
            </div>
            {/* Tabs live here in desktop toolbar */}
            <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {(['realtime', 'analysis'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === tab
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'realtime' ? '⚡ Live' : '📊 Analysis'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
            <span className="text-lg">⚠️</span>
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {loading && !latestData && (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-3 text-gray-500 text-sm">Loading sensor data…</p>
          </div>
        )}

        {/* ── No Data ───────────────────────────────────────────────────── */}
        {!loading && !latestData && (
          <div className="bg-white border border-amber-200 rounded-2xl p-10 text-center shadow-sm">
            <div className="text-5xl mb-3">📡</div>
            <h3 className="font-bold text-gray-800 text-lg mb-1">No Data Yet</h3>
            <p className="text-gray-500 text-sm">Make sure the energy monitoring device is powered on and connected.</p>
          </div>
        )}

        {/* ── Main Content ──────────────────────────────────────────────── */}
        {latestData && (
          <>
            {/* ── KPI Strip ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Voltage',  value: latestData.voltage?.toFixed(1) ?? '—',                unit: 'V',   color: 'blue',   icon: '⚡' },
                { label: 'Current',  value: latestData.current?.toFixed(2) ?? '—',                unit: 'A',   color: 'emerald',icon: '〰️' },
                { label: 'Power',    value: latestData.power?.toFixed(1) ?? '—',                  unit: 'W',   color: 'violet', icon: '⚙️' },
                { label: 'Energy',   value: ((latestData.energyWh || 0) / 1000).toFixed(3),       unit: 'kWh', color: 'orange', icon: '💡' },
              ].map(({ label, value, unit, color, icon }) => (
                <div key={label} className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-4`}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl
                    ${color === 'blue'    ? 'bg-blue-100'    : ''}
                    ${color === 'emerald' ? 'bg-emerald-100' : ''}
                    ${color === 'violet'  ? 'bg-violet-100'  : ''}
                    ${color === 'orange'  ? 'bg-orange-100'  : ''}
                  `}>{icon}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                    <p className={`text-2xl font-bold leading-tight
                      ${color === 'blue'    ? 'text-blue-600'    : ''}
                      ${color === 'emerald' ? 'text-emerald-600' : ''}
                      ${color === 'violet'  ? 'text-violet-600'  : ''}
                      ${color === 'orange'  ? 'text-orange-600'  : ''}
                    `}>{value} <span className="text-sm font-medium text-gray-400">{unit}</span></p>
                  </div>
                </div>
              ))}
            </div>

            {/* ════════════════════════════════════ REAL-TIME TAB ════════ */}
            {activeTab === 'realtime' && (
              <div className="space-y-5">

                {/* ── Charts (2-column on desktop) ──────────────────────── */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

                  {/* Voltage chart */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
                        <span className="font-semibold text-gray-700 text-sm">Voltage</span>
                      </div>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                        Last {timeRangeLabel(selectedHours)} · {chartData.length} pts
                      </span>
                    </div>
                    {chartData.length < 2 ? <ChartEmpty /> : (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={chartData} margin={{ top: 4, right: 12, left: -10, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" stroke="#e2e8f0" />
                          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#e2e8f0" unit="V" width={42} />
                          <Tooltip
                            contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }}
                            formatter={(val: number | undefined) => [`${val ?? 0} V`, 'Voltage']}
                          />
                          <Line type="monotone" dataKey="voltage" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Voltage (V)" isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Current chart */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                        <span className="font-semibold text-gray-700 text-sm">Current</span>
                      </div>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                        Last {timeRangeLabel(selectedHours)} · {chartData.length} pts
                      </span>
                    </div>
                    {chartData.length < 2 ? <ChartEmpty /> : (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={chartData} margin={{ top: 4, right: 12, left: -10, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" stroke="#e2e8f0" />
                          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#e2e8f0" unit="A" width={42} />
                          <Tooltip
                            contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }}
                            formatter={(val: number | undefined) => [`${val ?? 0} A`, 'Current']}
                          />
                          <Line type="monotone" dataKey="current" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Current (A)" isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* ── Recent Readings Table ─────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-700">Recent Readings</h2>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                      Last {timeRangeLabel(selectedHours)}
                    </span>
                  </div>
                  {minuteFilteredData.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm">No data available yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                            <th className="text-left px-5 py-3 font-semibold">Time</th>
                            <th className="text-right px-4 py-3 font-semibold">Voltage (V)</th>
                            <th className="text-right px-4 py-3 font-semibold">Current (A)</th>
                            <th className="text-right px-4 py-3 font-semibold">Power (W)</th>
                            <th className="text-right px-4 py-3 font-semibold">Energy (kWh)</th>
                            <th className="text-center px-4 py-3 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {minuteFilteredData.slice(0, 20).map((data, index) => (
                            <tr
                              key={data.id}
                              className={`hover:bg-gray-50 transition-colors ${index === 0 ? 'bg-blue-50/50' : ''}`}
                            >
                              <td className="px-5 py-3 font-mono text-gray-600">
                                {index === 0 && <span className="mr-2 text-xs text-blue-500 font-semibold">LATEST</span>}
                                {formatTimestamp(data.timestamp)}
                              </td>
                              <td className="text-right px-4 py-3 font-medium text-blue-600">{data.voltage.toFixed(1)}</td>
                              <td className="text-right px-4 py-3 font-medium text-emerald-600">{data.current.toFixed(2)}</td>
                              <td className="text-right px-4 py-3 font-medium text-violet-600">{data.power.toFixed(1)}</td>
                              <td className="text-right px-4 py-3 font-medium text-orange-600">{(data.energyWh / 1000).toFixed(3)}</td>
                              <td className="text-center px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusStyle(data.status)}`}>
                                  {data.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════════════════════════════════════ ANALYSIS TAB ═════════ */}
            {activeTab === 'analysis' && (
              <div className="space-y-5">

                {/* ── Summary KPIs ──────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Energy', sub: 'Cumulative', value: ((latestData?.energyWh || 0) / 1000).toFixed(3), unit: 'kWh', color: 'blue' },
                    { label: 'Current Power', sub: 'Right now', value: latestData?.power?.toFixed(1) ?? '—', unit: 'W', color: 'emerald' },
                    { label: 'Total Cost', sub: 'Cumulative', value: calculateTotalCost().toFixed(2), unit: 'LKR', color: 'violet' },
                  ].map(({ label, sub, value, unit, color }) => (
                    <div key={label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                      <p className={`text-3xl font-bold capitalize
                        ${color === 'blue'   ? 'text-blue-600'   : ''}
                        ${color === 'emerald'? 'text-emerald-600': ''}
                        ${color === 'violet' ? 'text-violet-600' : ''}
                      `}>{value} <span className="text-base font-medium text-gray-400">{unit}</span></p>
                      <p className="text-xs text-gray-400 mt-1">{sub}</p>
                    </div>
                  ))}

                  {/* Device Status — derived from live data flow, not DB-stored status */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Device Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="relative flex h-3 w-3">
                        {isOnline && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        )}
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${isOnline ? 'bg-emerald-500' : 'bg-red-400'}`}></span>
                      </span>
                      <p className={`text-3xl font-bold ${isOnline ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isOnline ? 'Online' : 'Offline'}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {lastUpdateTime ? `Last seen ${lastUpdateTime.toLocaleTimeString()}` : 'No data received'}
                    </p>
                  </div>
                </div>

                {/* ── Period Analysis ───────────────────────────────────── */}
                {historicalData.length >= 2 && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <span className="w-2 h-4 rounded-sm bg-indigo-500 inline-block"></span>
                      Period Analysis
                      <span className="ml-auto text-xs text-gray-400 font-normal bg-gray-100 px-2.5 py-1 rounded-full">
                        Last {timeRangeLabel(selectedHours)}
                      </span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { label: 'Energy Consumed', value: calculateHistoricalEnergy().toFixed(3), unit: 'kWh', color: 'indigo' },
                        { label: 'Average Power',   value: calculateAveragePower().toFixed(1),     unit: 'W',   color: 'purple' },
                        { label: 'Period Cost',     value: calculateHistoricalCost().toFixed(2),   unit: 'LKR', color: 'pink' },
                      ].map(({ label, value, unit, color }) => (
                        <div key={label} className={`rounded-xl p-4 border
                          ${color === 'indigo' ? 'bg-indigo-50 border-indigo-100' : ''}
                          ${color === 'purple' ? 'bg-purple-50 border-purple-100' : ''}
                          ${color === 'pink'   ? 'bg-pink-50   border-pink-100'   : ''}
                        `}>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                          <p className={`text-3xl font-bold
                            ${color === 'indigo' ? 'text-indigo-600' : ''}
                            ${color === 'purple' ? 'text-purple-600' : ''}
                            ${color === 'pink'   ? 'text-pink-600'   : ''}
                          `}>{value} <span className="text-sm font-medium text-gray-400">{unit}</span></p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Cost Breakdown Table ──────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-700">Detailed Cost Breakdown</h2>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                      {minuteFilteredData.length} records
                    </span>
                  </div>
                  {minuteFilteredData.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm">No historical data available.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                            <th className="text-left px-5 py-3 font-semibold">Timestamp</th>
                            <th className="text-right px-4 py-3 font-semibold">V</th>
                            <th className="text-right px-4 py-3 font-semibold">I (A)</th>
                            <th className="text-right px-4 py-3 font-semibold">P (W)</th>
                            <th className="text-right px-4 py-3 font-semibold">kWh</th>
                            <th className="text-right px-4 py-3 font-semibold">Cost (LKR)</th>
                            <th className="text-center px-4 py-3 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {minuteFilteredData.map((data) => {
                            const kWh = data.energyWh / 1000;
                            const cost = kWh * electricityRate;
                            return (
                              <tr key={data.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-5 py-2.5 text-gray-500 font-mono">{formatFullTimestamp(data.timestamp)}</td>
                                <td className="text-right px-4 py-2.5 text-blue-600 font-medium">{data.voltage.toFixed(1)}</td>
                                <td className="text-right px-4 py-2.5 text-emerald-600 font-medium">{data.current.toFixed(2)}</td>
                                <td className="text-right px-4 py-2.5 font-semibold">{data.power.toFixed(1)}</td>
                                <td className="text-right px-4 py-2.5 text-indigo-600 font-semibold">{kWh.toFixed(3)}</td>
                                <td className="text-right px-4 py-2.5 text-violet-600 font-bold">{cost.toFixed(2)}</td>
                                <td className="text-center px-4 py-2.5">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusStyle(data.status)}`}>
                                    {data.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* ── Info box ──────────────────────────────────────────── */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-700 mb-2">ℹ️ How costs are calculated</p>
                  <ul className="space-y-1 list-disc ml-5 text-slate-500">
                    <li>Total Cost = Total Energy (kWh) × Electricity Rate</li>
                    <li>Period Cost = Energy consumed in selected period × Rate</li>
                    <li>Average Power = Mean of all power readings in the period</li>
                    <li>Energy readings are cumulative from the last reset</li>
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
