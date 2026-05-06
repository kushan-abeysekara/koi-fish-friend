import { useState, useEffect, useCallback, useRef } from 'react';
import { supabasePgQuery } from '../services/supabase';

const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8081';
const FRONTEND_DOMAIN = window.location.origin;
const BACKEND_DOMAIN = API_URL;

interface HealthComponent {
  status: string;
  details?: Record<string, unknown>;
}

interface HealthResponse {
  status: string;
  components?: Record<string, HealthComponent>;
}

interface EndpointCheck {
  name: string;
  url: string;
  status: 'checking' | 'up' | 'down';
  responseTime?: number;
  details?: string;
}

// pH calibration simulation targets
const PH_TARGETS = {
  lime:  3.0,   // Lime juice is acidic ~pH 3
  water: 7.5,   // Clean water is neutral
  soap:  12.0,  // Soap is alkaline ~pH 12
} as const;

type PhMode = keyof typeof PH_TARGETS;

const SystemStatus: React.FC = () => {
  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointCheck[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // ── pH Sensor Calibration (fake / hard-coded simulation) ──────────────────
  const [phSimActive, setPhSimActive] = useState(false);
  const [phSimMode, setPhSimMode] = useState<PhMode | null>(null);
  const [phCurrent, setPhCurrent] = useState<number | null>(null);
  const [phTarget, setPhTarget] = useState<number | null>(null);
  const [phStart, setPhStart] = useState<number | null>(null);
  const [phSimStatus, setPhSimStatus] = useState<string>('');
  const [phDbStatus, setPhDbStatus] = useState<'idle' | 'writing' | 'ok' | 'error'>('idle');
  const phIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Turbidity Normal Simulation (random walk, always inside safe range) ────
  const [turbSimActive, setTurbSimActive] = useState(false);
  const [turbCurrent, setTurbCurrent] = useState<number | null>(null);
  const [turbDbStatus, setTurbDbStatus] = useState<'idle' | 'writing' | 'ok' | 'error'>('idle');
  const turbIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkEndpoint = async (name: string, url: string): Promise<EndpointCheck> => {
    const start = performance.now();
    try {
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10000) });
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        return { name, url, status: 'up', responseTime: elapsed, details: `HTTP ${res.status}` };
      }
      return { name, url, status: 'down', responseTime: elapsed, details: `HTTP ${res.status}` };
    } catch {
      const elapsed = Math.round(performance.now() - start);
      return { name, url, status: 'down', responseTime: elapsed, details: 'Connection failed' };
    }
  };

  const runChecks = useCallback(async () => {
    const checks: EndpointCheck[] = [
      { name: 'Frontend', url: FRONTEND_DOMAIN, status: 'checking' },
      { name: 'Backend API', url: `${BACKEND_DOMAIN}/api/ponds`, status: 'checking' },
      { name: 'Backend Health', url: `${BACKEND_DOMAIN}/actuator/health`, status: 'checking' },
      { name: 'Backend Info', url: `${BACKEND_DOMAIN}/actuator/info`, status: 'checking' },
    ];
    setEndpoints(checks);

    // Run all checks in parallel
    const results = await Promise.all(
      checks.map((c) => checkEndpoint(c.name, c.url))
    );
    setEndpoints(results);

    // Fetch backend health details
    try {
      const res = await fetch(`${BACKEND_DOMAIN}/actuator/health`);
      if (res.ok) {
        const data: HealthResponse = await res.json();
        setBackendHealth(data);
      }
    } catch {
      setBackendHealth(null);
    }

    setLastChecked(new Date());
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(runChecks, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, runChecks]);

  // ── pH Simulation helpers ──────────────────────────────────────────────────

  /** Write a pH value to the sensor_live table in Supabase */
  const writePhToSupabase = useCallback(async (value: number) => {
    const rounded = Math.round(value * 100) / 100;
    setPhDbStatus('writing');
    try {
      await supabasePgQuery(
        `UPDATE sensor_live SET ph_value = ${rounded}, updated_at = now() WHERE device_id LIKE 'WQ_%'`
      );
      setPhDbStatus('ok');
    } catch {
      setPhDbStatus('error');
    }
  }, []);

  /** Fetch current pH from Supabase before starting a simulation */
  const fetchCurrentPh = useCallback(async (): Promise<number> => {
    try {
      const rows = await supabasePgQuery<{ ph_value: number }>(
        "SELECT ph_value FROM sensor_live WHERE device_id LIKE 'WQ_%' ORDER BY updated_at DESC LIMIT 1"
      );
      if (rows.length > 0 && rows[0].ph_value != null) return Number(rows[0].ph_value);
    } catch { /* fall through */ }
    return 7.0; // safe default
  }, []);

  /** Stop any running pH simulation */
  const stopPhSim = useCallback(() => {
    if (phIntervalRef.current) {
      clearInterval(phIntervalRef.current);
      phIntervalRef.current = null;
    }
    setPhSimActive(false);
    setPhSimMode(null);
  }, []);

  /** Start a pH simulation toward a given target */
  const startPhSim = useCallback(async (mode: PhMode) => {
    // Stop any existing sim first
    stopPhSim();

    const target = PH_TARGETS[mode];
    setPhTarget(target);
    setPhSimMode(mode);
    setPhSimActive(true);
    setPhDbStatus('idle');

    const labels: Record<PhMode, string> = {
      lime:  'Lime (acidic) → pH 3.0',
      water: 'Clean Water → pH 7.5',
      soap:  'Soap (alkaline) → pH 12.0',
    };
    setPhSimStatus(`Starting: ${labels[mode]}`);

    const start = await fetchCurrentPh();
    let current = start;
    setPhCurrent(current);
    setPhStart(current);

    // Step = 0.1 pH units every 3 s → ~0-10 min max depending on distance
    const STEP = 0.1;
    const INTERVAL_MS = 3000;

    phIntervalRef.current = setInterval(async () => {
      const remaining = target - current;

      if (Math.abs(remaining) < 0.05) {
        // Reached target
        current = target;
        setPhCurrent(target);
        await writePhToSupabase(target);
        setPhSimStatus(`✓ Reached pH ${target.toFixed(1)} — simulation complete`);
        if (phIntervalRef.current) clearInterval(phIntervalRef.current);
        phIntervalRef.current = null;
        setPhSimActive(false);
        return;
      }

      // Move one step toward target
      const delta = remaining > 0 ? Math.min(STEP, remaining) : Math.max(-STEP, remaining);
      current = Math.round((current + delta) * 100) / 100;
      setPhCurrent(current);
      setPhSimStatus(`${labels[mode]} — current pH: ${current.toFixed(2)}`);
      await writePhToSupabase(current);
    }, INTERVAL_MS);
  }, [fetchCurrentPh, writePhToSupabase, stopPhSim]);

  // Cleanup simulation on unmount
  useEffect(() => () => { if (phIntervalRef.current) clearInterval(phIntervalRef.current); }, []);

  // ── Turbidity simulation helpers ────────────────────────────────────────────

  const writeTurbToSupabase = useCallback(async (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    setTurbDbStatus('writing');
    try {
      await supabasePgQuery(
        `UPDATE sensor_live SET turbidity = ${rounded}, updated_at = now() WHERE device_id LIKE 'WQ_%'`
      );
      setTurbDbStatus('ok');
    } catch {
      setTurbDbStatus('error');
    }
  }, []);

  const stopTurbSim = useCallback(() => {
    if (turbIntervalRef.current) {
      clearInterval(turbIntervalRef.current);
      turbIntervalRef.current = null;
    }
    setTurbSimActive(false);
  }, []);

  const startTurbSim = useCallback(async () => {
    stopTurbSim();
    setTurbSimActive(true);
    setTurbDbStatus('idle');

    // Start near centre of safe range
    let current = 12.0;
    setTurbCurrent(current);
    await writeTurbToSupabase(current);

    const SAFE_MIN = 2;
    const SAFE_MAX = 22;
    const INTERVAL_MS = 3000;

    turbIntervalRef.current = setInterval(async () => {
      // Random walk ±0.3 to ±1.5 NTU, clamped to safe range
      const delta = (Math.random() * 1.8 - 0.9); // -0.9 to +0.9
      current = Math.max(SAFE_MIN, Math.min(SAFE_MAX, Math.round((current + delta) * 10) / 10));
      setTurbCurrent(current);
      await writeTurbToSupabase(current);
    }, INTERVAL_MS);
  }, [stopTurbSim, writeTurbToSupabase]);

  // Cleanup turbidity sim on unmount
  useEffect(() => () => { if (turbIntervalRef.current) clearInterval(turbIntervalRef.current); }, []);

  // ── MQ135 Butane / Reset Simulation ───────────────────────────────────────
  const [mq135Mode, setMq135Mode] = useState<'idle' | 'butane' | 'reset'>('idle');
  const [mq135Co2, setMq135Co2] = useState<number | null>(null);
  const [mq135Ammonia, setMq135Ammonia] = useState<number | null>(null);
  const [mq135Wqi, setMq135Wqi] = useState<number | null>(null);
  const [mq135DbStatus, setMq135DbStatus] = useState<'idle' | 'writing' | 'ok' | 'error'>('idle');
  const mq135TimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopMq135 = useCallback(() => {
    if (mq135TimeoutRef.current) { clearTimeout(mq135TimeoutRef.current); mq135TimeoutRef.current = null; }
    setMq135Mode('idle');
  }, []);

  const writeMq135ToSupabase = useCallback(async (co2: number, ammonia: number, wqi: number) => {
    setMq135DbStatus('writing');
    try {
      await supabasePgQuery(
        `UPDATE sensor_live SET co2_level = ${Math.round(co2)}, ammonia = ${ammonia.toFixed(3)}, air_quality_index = ${Math.round(wqi)}, updated_at = now() WHERE device_id LIKE 'WQ_%'`
      );
      setMq135DbStatus('ok');
    } catch {
      setMq135DbStatus('error');
    }
  }, []);

  const startMq135Butane = useCallback(async () => {
    stopMq135();
    setMq135Mode('butane');
    setMq135DbStatus('idle');

    // Fetch current values first
    let co2 = 400, ammonia = 0.02, wqi = 35;
    try {
      const rows = await supabasePgQuery<{ co2_level: number; ammonia: number; air_quality_index: number }>(
        "SELECT co2_level, ammonia, air_quality_index FROM sensor_live WHERE device_id LIKE 'WQ_%' ORDER BY updated_at DESC LIMIT 1"
      );
      if (rows.length > 0) {
        co2 = Number(rows[0].co2_level) || 400;
        ammonia = Number(rows[0].ammonia) || 0.02;
        wqi = Number(rows[0].air_quality_index) || 35;
      }
    } catch { /* use defaults */ }

    setMq135Co2(co2); setMq135Ammonia(ammonia); setMq135Wqi(wqi);

    const CO2_TARGET = 2600, AMMONIA_TARGET = 2.8, WQI_TARGET = 420;

    const step = async () => {
      if (co2 >= CO2_TARGET && ammonia >= AMMONIA_TARGET && wqi >= WQI_TARGET) {
        setMq135Mode('idle'); return;
      }
      // Random step sizes — the "random gaps" effect
      const co2Step    = co2 < CO2_TARGET    ? Math.random() * 130 + 20   : 0;
      const ammoniaStep = ammonia < AMMONIA_TARGET ? Math.random() * 0.25 + 0.05 : 0;
      const wqiStep    = wqi < WQI_TARGET    ? Math.random() * 45 + 10    : 0;

      co2      = Math.min(CO2_TARGET,      co2 + co2Step);
      ammonia  = Math.min(AMMONIA_TARGET,  ammonia + ammoniaStep);
      wqi      = Math.min(WQI_TARGET,      wqi + wqiStep);

      setMq135Co2(Math.round(co2 * 10) / 10);
      setMq135Ammonia(Math.round(ammonia * 1000) / 1000);
      setMq135Wqi(Math.round(wqi * 10) / 10);
      await writeMq135ToSupabase(co2, ammonia, wqi);

      // Random delay 600ms–2200ms between steps
      const delay = Math.random() * 1600 + 600;
      mq135TimeoutRef.current = setTimeout(step, delay);
    };

    mq135TimeoutRef.current = setTimeout(step, 500);
  }, [stopMq135, writeMq135ToSupabase]);

  const startMq135Reset = useCallback(async () => {
    stopMq135();
    setMq135Mode('reset');
    setMq135DbStatus('idle');

    let co2 = mq135Co2 ?? 2600;
    let ammonia = mq135Ammonia ?? 2.8;
    let wqi = mq135Wqi ?? 420;

    const CO2_NORMAL = 420, AMMONIA_NORMAL = 0.02, WQI_NORMAL = 35;

    const step = async () => {
      if (co2 <= CO2_NORMAL && ammonia <= AMMONIA_NORMAL && wqi <= WQI_NORMAL) {
        co2 = CO2_NORMAL; ammonia = AMMONIA_NORMAL; wqi = WQI_NORMAL;
        setMq135Co2(co2); setMq135Ammonia(ammonia); setMq135Wqi(wqi);
        await writeMq135ToSupabase(co2, ammonia, wqi);
        setMq135Mode('idle'); return;
      }
      const co2Step     = co2 > CO2_NORMAL       ? Math.random() * 100 + 20   : 0;
      const ammoniaStep = ammonia > AMMONIA_NORMAL ? Math.random() * 0.2 + 0.04 : 0;
      const wqiStep     = wqi > WQI_NORMAL        ? Math.random() * 40 + 10    : 0;

      co2     = Math.max(CO2_NORMAL,      co2 - co2Step);
      ammonia = Math.max(AMMONIA_NORMAL,  ammonia - ammoniaStep);
      wqi     = Math.max(WQI_NORMAL,      wqi - wqiStep);

      setMq135Co2(Math.round(co2 * 10) / 10);
      setMq135Ammonia(Math.round(ammonia * 1000) / 1000);
      setMq135Wqi(Math.round(wqi * 10) / 10);
      await writeMq135ToSupabase(co2, ammonia, wqi);

      const delay = Math.random() * 1400 + 600;
      mq135TimeoutRef.current = setTimeout(step, delay);
    };

    mq135TimeoutRef.current = setTimeout(step, 400);
  }, [stopMq135, writeMq135ToSupabase, mq135Co2, mq135Ammonia, mq135Wqi]);

  // Cleanup MQ135 on unmount
  useEffect(() => () => { if (mq135TimeoutRef.current) clearTimeout(mq135TimeoutRef.current); }, []);

  const statusColor = (s: string) => {
    if (s === 'up' || s === 'UP') return 'text-green-600';
    if (s === 'down' || s === 'DOWN') return 'text-red-600';
    return 'text-yellow-500';
  };

  const statusBg = (s: string) => {
    if (s === 'up' || s === 'UP') return 'bg-green-100 border-green-300';
    if (s === 'down' || s === 'DOWN') return 'bg-red-100 border-red-300';
    return 'bg-yellow-100 border-yellow-300';
  };

  const statusIcon = (s: string) => {
    if (s === 'up' || s === 'UP') return 'fa-check-circle text-green-500';
    if (s === 'down' || s === 'DOWN') return 'fa-times-circle text-red-500';
    return 'fa-spinner fa-spin text-yellow-500';
  };

  const overallStatus = endpoints.length > 0 && endpoints.every((e) => e.status === 'up')
    ? 'All Systems Operational'
    : endpoints.some((e) => e.status === 'checking')
    ? 'Checking...'
    : 'Some Systems Down';

  const overallColor = endpoints.every((e) => e.status === 'up')
    ? 'text-green-600 bg-green-50 border-green-200'
    : endpoints.some((e) => e.status === 'checking')
    ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
    : 'text-red-600 bg-red-50 border-red-200';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">System Status</h2>
          <p className="text-gray-500 text-sm">
            Monitor frontend & backend health in real time
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={runChecks}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            <i className="fas fa-sync-alt mr-2"></i>Check Now
          </button>
        </div>
      </div>

      {/* Overall Status */}
      <div className={`p-4 rounded-lg border-2 ${overallColor} text-center`}>
        <p className="text-lg font-bold">{overallStatus}</p>
        {lastChecked && (
          <p className="text-xs mt-1 opacity-70">
            Last checked: {lastChecked.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Links Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          <i className="fas fa-link mr-2 text-blue-500"></i>Service Links
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href={FRONTEND_DOMAIN}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-desktop text-blue-600"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800">Frontend</p>
              <p className="text-xs text-gray-500 truncate">{FRONTEND_DOMAIN}</p>
            </div>
            <i className="fas fa-external-link-alt text-gray-400"></i>
          </a>
          <a
            href={BACKEND_DOMAIN}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-green-400 hover:bg-green-50 transition"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-server text-green-600"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800">Backend API</p>
              <p className="text-xs text-gray-500 truncate">{BACKEND_DOMAIN}</p>
            </div>
            <i className="fas fa-external-link-alt text-gray-400"></i>
          </a>
          <a
            href={`${BACKEND_DOMAIN}/actuator/health`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition"
          >
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-heartbeat text-emerald-600"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800">Health Endpoint</p>
              <p className="text-xs text-gray-500 truncate">{BACKEND_DOMAIN}/actuator/health</p>
            </div>
            <i className="fas fa-external-link-alt text-gray-400"></i>
          </a>
          <a
            href={`${BACKEND_DOMAIN}/actuator/info`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-info-circle text-purple-600"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800">Info Endpoint</p>
              <p className="text-xs text-gray-500 truncate">{BACKEND_DOMAIN}/actuator/info</p>
            </div>
            <i className="fas fa-external-link-alt text-gray-400"></i>
          </a>
        </div>
      </div>

      {/* Endpoint Status Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          <i className="fas fa-signal mr-2 text-indigo-500"></i>Endpoint Checks
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Service</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">URL</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">Status</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Response Time</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-800">{ep.name}</td>
                  <td className="py-3 px-4">
                    <a
                      href={ep.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs break-all"
                    >
                      {ep.url}
                    </a>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusBg(ep.status)}`}>
                      <i className={`fas ${statusIcon(ep.status)}`}></i>
                      <span className={statusColor(ep.status)}>
                        {ep.status === 'checking' ? 'Checking' : ep.status.toUpperCase()}
                      </span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {ep.responseTime !== undefined ? `${ep.responseTime}ms` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Backend Health Details */}
      {backendHealth && backendHealth.components && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            <i className="fas fa-heartbeat mr-2 text-red-500"></i>Backend Health Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(backendHealth.components).map(([name, comp]) => (
              <div
                key={name}
                className={`p-4 rounded-lg border ${statusBg(comp.status)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-800 capitalize">{name}</span>
                  <i className={`fas ${statusIcon(comp.status)} text-lg`}></i>
                </div>
                <span className={`text-sm font-bold ${statusColor(comp.status)}`}>
                  {comp.status}
                </span>
                {comp.details && (
                  <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                    {Object.entries(comp.details).map(([k, v]) => (
                      <div key={k}>
                        <span className="font-medium">{k}:</span>{' '}
                        <span className="break-all">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Environment Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          <i className="fas fa-cog mr-2 text-gray-500"></i>Environment
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-600">Frontend URL</span>
            <span className="font-mono text-gray-800 text-xs">{FRONTEND_DOMAIN}</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-600">Backend API URL</span>
            <span className="font-mono text-gray-800 text-xs">{BACKEND_DOMAIN}</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-600">VITE_API_URL</span>
            <span className="font-mono text-gray-800 text-xs">
              {import.meta.env.VITE_API_URL || '(not set)'}
            </span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-600">Mode</span>
            <span className="font-mono text-gray-800 text-xs">{import.meta.env.MODE}</span>
          </div>
        </div>
      </div>

      {/* ── Sensor Calibration (pH Simulation) ────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">
          <i className="fas fa-flask mr-2 text-teal-500"></i>Sensor Calibration
        </h3>
        <p className="text-sm text-gray-500 mb-5">
          Simulate pH changes for sensor testing — values update sequentially in Supabase every 3 s.
        </p>

        {/* Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          {/* Lime */}
          <button
            onClick={() => startPhSim('lime')}
            disabled={phSimActive}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition font-medium
              ${phSimMode === 'lime' && phSimActive
                ? 'border-yellow-400 bg-yellow-50 text-yellow-700 cursor-wait'
                : 'border-yellow-300 hover:border-yellow-500 hover:bg-yellow-50 text-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed'}`}
          >
            <span className="text-2xl">🍋</span>
            <span className="text-sm font-semibold">Lime (Acidic)</span>
            <span className="text-xs text-gray-500">pH → 3.0</span>
          </button>

          {/* Water */}
          <button
            onClick={() => startPhSim('water')}
            disabled={phSimActive}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition font-medium
              ${phSimMode === 'water' && phSimActive
                ? 'border-blue-400 bg-blue-50 text-blue-700 cursor-wait'
                : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50 text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'}`}
          >
            <span className="text-2xl">💧</span>
            <span className="text-sm font-semibold">Clean Water</span>
            <span className="text-xs text-gray-500">pH → 7.5</span>
          </button>

          {/* Soap */}
          <button
            onClick={() => startPhSim('soap')}
            disabled={phSimActive}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition font-medium
              ${phSimMode === 'soap' && phSimActive
                ? 'border-purple-400 bg-purple-50 text-purple-700 cursor-wait'
                : 'border-purple-300 hover:border-purple-500 hover:bg-purple-50 text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed'}`}
          >
            <span className="text-2xl">🧼</span>
            <span className="text-sm font-semibold">Soap (Alkaline)</span>
            <span className="text-xs text-gray-500">pH → 12.0</span>
          </button>
        </div>

        {/* Live pH Gauge */}
        {phCurrent !== null && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Current Simulated pH</span>
              <span className={`text-2xl font-bold tabular-nums ${
                phCurrent < 5 ? 'text-red-600'
                : phCurrent < 6.5 ? 'text-orange-500'
                : phCurrent <= 8.5 ? 'text-green-600'
                : phCurrent <= 10 ? 'text-orange-500'
                : 'text-red-600'
              }`}>
                {phCurrent.toFixed(2)}
                <span className="text-sm font-normal text-gray-500 ml-1">pH</span>
              </span>
            </div>

            {/* pH scale bar (0–14) */}
            <div className="relative h-4 rounded-full overflow-hidden mb-1"
              style={{ background: 'linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ec4899)' }}>
              <div
                className="absolute top-0 w-3 h-4 bg-white border-2 border-gray-700 rounded-sm transition-all duration-[2800ms]"
                style={{ left: `calc(${(phCurrent / 14) * 100}% - 6px)` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>0 Acidic</span>
              <span>7 Neutral</span>
              <span>14 Alkaline</span>
            </div>

            {phTarget !== null && phStart !== null && (
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-teal-500 transition-all duration-[2800ms]"
                    style={{
                      width: `${Math.max(0, Math.min(100,
                        Math.abs(phStart - phTarget) < 0.01 ? 100
                        : ((Math.abs(phStart - (phCurrent ?? phStart))) / Math.abs(phStart - phTarget)) * 100
                      ))}%`
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  Target: {phTarget.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Status bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            {phSimActive && (
              <i className="fas fa-spinner fa-spin text-teal-500"></i>
            )}
            <span className={`text-sm ${phSimActive ? 'text-teal-700' : 'text-gray-500'}`}>
              {phSimStatus || 'Click a button above to start simulation'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* DB write badge */}
            {phDbStatus !== 'idle' && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                phDbStatus === 'writing' ? 'bg-blue-100 text-blue-700'
                : phDbStatus === 'ok'    ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
              }`}>
                {phDbStatus === 'writing' ? '⏳ Writing to Supabase'
                : phDbStatus === 'ok'     ? '✓ Supabase updated'
                : '✗ DB write failed'}
              </span>
            )}
            {phSimActive && (
              <button
                onClick={stopPhSim}
                className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition"
              >
                <i className="fas fa-stop mr-1"></i>Stop
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Turbidity Normal Simulation ────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">
          <i className="fas fa-tint mr-2 text-blue-500"></i>Turbidity Calibration
        </h3>
        <p className="text-sm text-gray-500 mb-5">
          Override the turbidity sensor with simulated normal values (2–22 NTU).
          Values drift randomly every 3 s — always within the safe range.
        </p>

        {/* Start / Stop button */}
        <div className="flex items-center gap-4 mb-5">
          {!turbSimActive ? (
            <button
              onClick={startTurbSim}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 active:scale-95 transition"
            >
              <span className="text-lg">💧</span>
              Start Normal Turbidity Simulation
            </button>
          ) : (
            <button
              onClick={stopTurbSim}
              className="flex items-center gap-2 px-5 py-3 bg-red-100 text-red-700 rounded-xl font-semibold hover:bg-red-200 active:scale-95 transition"
            >
              <i className="fas fa-stop mr-1"></i>Stop Simulation
            </button>
          )}
          {turbSimActive && (
            <span className="flex items-center gap-2 text-sm text-blue-600 font-medium">
              <i className="fas fa-spinner fa-spin"></i>
              Sending random values to Supabase…
            </span>
          )}
        </div>

        {/* Live Turbidity display */}
        {turbCurrent !== null && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Current Simulated Turbidity</span>
              <span className="text-2xl font-bold tabular-nums text-green-600">
                {turbCurrent.toFixed(1)}
                <span className="text-sm font-normal text-gray-500 ml-1">NTU</span>
                <span className="ml-2 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">NORMAL</span>
              </span>
            </div>

            {/* 0–100 NTU bar; safe zone shown */}
            <div className="relative h-4 rounded-full bg-gray-200 overflow-hidden mb-1">
              {/* Safe zone highlight */}
              <div
                className="absolute top-0 h-4 bg-green-200 opacity-60"
                style={{ left: '0%', width: '25%' }}
              />
              {/* Value indicator */}
              <div
                className="absolute top-0 h-4 bg-green-500 rounded-full transition-all duration-[2800ms]"
                style={{ width: `${Math.min(100, (turbCurrent / 100) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>0 NTU</span>
              <span className="text-green-600 font-medium">Safe: 0–25 NTU</span>
              <span>100 NTU</span>
            </div>
          </div>
        )}

        {/* DB status */}
        {turbDbStatus !== 'idle' && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            turbDbStatus === 'writing' ? 'bg-blue-100 text-blue-700'
            : turbDbStatus === 'ok'    ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
          }`}>
            {turbDbStatus === 'writing' ? '⏳ Writing to Supabase'
            : turbDbStatus === 'ok'     ? '✓ Supabase updated'
            : '✗ DB write failed'}
          </span>
        )}
      </div>

      {/* ── MQ135 Butane Gas Simulation ────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">
          <i className="fas fa-fire mr-2 text-orange-500"></i>MQ135 Gas Sensor — Butane Simulation
        </h3>
        <p className="text-sm text-gray-500 mb-5">
          Simulate opening a butane lighter near the MQ135 sensor. CO₂, Ammonia and Water Quality Index
          rise sequentially with random step gaps — then use Reset to restore normal values.
        </p>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={startMq135Butane}
            disabled={mq135Mode === 'butane'}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition active:scale-95
              ${mq135Mode === 'butane'
                ? 'bg-orange-200 text-orange-700 cursor-wait'
                : 'bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50'}`}
          >
            <span className="text-lg">🔥</span>
            {mq135Mode === 'butane' ? 'Butane Mode Active…' : 'Butane Gas Mode'}
          </button>

          <button
            onClick={startMq135Reset}
            disabled={mq135Mode === 'reset'}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition active:scale-95
              ${mq135Mode === 'reset'
                ? 'bg-green-200 text-green-700 cursor-wait'
                : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'}`}
          >
            <i className={`fas ${mq135Mode === 'reset' ? 'fa-spinner fa-spin' : 'fa-undo'} mr-1`}></i>
            {mq135Mode === 'reset' ? 'Resetting…' : 'Reset to Normal'}
          </button>

          {(mq135Mode === 'butane' || mq135Mode === 'reset') && (
            <button
              onClick={stopMq135}
              className="flex items-center gap-2 px-4 py-3 bg-red-100 text-red-700 rounded-xl font-semibold hover:bg-red-200 transition active:scale-95"
            >
              <i className="fas fa-stop mr-1"></i>Stop
            </button>
          )}
        </div>

        {/* Live meters */}
        {(mq135Co2 !== null || mq135Ammonia !== null || mq135Wqi !== null) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">

            {/* CO2 */}
            <div className={`p-4 rounded-xl border-2 ${
              (mq135Co2 ?? 0) > 1000 ? 'border-red-300 bg-red-50' :
              (mq135Co2 ?? 0) > 600  ? 'border-yellow-300 bg-yellow-50' : 'border-green-300 bg-green-50'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">CO₂ Level</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  (mq135Co2 ?? 0) > 2000 ? 'bg-red-200 text-red-800' :
                  (mq135Co2 ?? 0) > 1000 ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'
                }`}>
                  {(mq135Co2 ?? 0) > 2000 ? 'DANGER' : (mq135Co2 ?? 0) > 1000 ? 'WARNING' : 'NORMAL'}
                </span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-gray-800">
                {(mq135Co2 ?? 0).toFixed(0)}
                <span className="text-sm font-normal text-gray-500 ml-1">PPM</span>
              </p>
              <div className="mt-2 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div className={`h-2 rounded-full transition-all duration-700 ${
                  (mq135Co2 ?? 0) > 2000 ? 'bg-red-500' : (mq135Co2 ?? 0) > 1000 ? 'bg-yellow-500' : 'bg-green-500'
                }`} style={{ width: `${Math.min(100, ((mq135Co2 ?? 0) / 3000) * 100)}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">Safe: 400–1000 PPM</p>
            </div>

            {/* Ammonia */}
            <div className={`p-4 rounded-xl border-2 ${
              (mq135Ammonia ?? 0) > 1.0 ? 'border-red-300 bg-red-50' :
              (mq135Ammonia ?? 0) > 0.5 ? 'border-yellow-300 bg-yellow-50' : 'border-green-300 bg-green-50'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Ammonia (NH₃)</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  (mq135Ammonia ?? 0) > 1.0 ? 'bg-red-200 text-red-800' :
                  (mq135Ammonia ?? 0) > 0.5 ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'
                }`}>
                  {(mq135Ammonia ?? 0) > 1.0 ? 'DANGER' : (mq135Ammonia ?? 0) > 0.5 ? 'WARNING' : 'NORMAL'}
                </span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-gray-800">
                {(mq135Ammonia ?? 0).toFixed(3)}
                <span className="text-sm font-normal text-gray-500 ml-1">PPM</span>
              </p>
              <div className="mt-2 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div className={`h-2 rounded-full transition-all duration-700 ${
                  (mq135Ammonia ?? 0) > 1.0 ? 'bg-red-500' : (mq135Ammonia ?? 0) > 0.5 ? 'bg-yellow-500' : 'bg-green-500'
                }`} style={{ width: `${Math.min(100, ((mq135Ammonia ?? 0) / 3) * 100)}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">Safe: 0–0.5 PPM</p>
            </div>

            {/* Water Quality Index */}
            <div className={`p-4 rounded-xl border-2 ${
              (mq135Wqi ?? 0) > 200 ? 'border-red-300 bg-red-50' :
              (mq135Wqi ?? 0) > 100 ? 'border-yellow-300 bg-yellow-50' : 'border-green-300 bg-green-50'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Water Quality Index</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  (mq135Wqi ?? 0) > 200 ? 'bg-red-200 text-red-800' :
                  (mq135Wqi ?? 0) > 100 ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'
                }`}>
                  {(mq135Wqi ?? 0) > 200 ? 'DANGER' : (mq135Wqi ?? 0) > 100 ? 'WARNING' : 'NORMAL'}
                </span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-gray-800">
                {(mq135Wqi ?? 0).toFixed(0)}
                <span className="text-sm font-normal text-gray-500 ml-1">WQI</span>
              </p>
              <div className="mt-2 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div className={`h-2 rounded-full transition-all duration-700 ${
                  (mq135Wqi ?? 0) > 200 ? 'bg-red-500' : (mq135Wqi ?? 0) > 100 ? 'bg-yellow-500' : 'bg-green-500'
                }`} style={{ width: `${Math.min(100, ((mq135Wqi ?? 0) / 450) * 100)}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">Safe: 0–100 WQI</p>
            </div>
          </div>
        )}

        {/* DB write status */}
        {mq135DbStatus !== 'idle' && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            mq135DbStatus === 'writing' ? 'bg-blue-100 text-blue-700'
            : mq135DbStatus === 'ok'    ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
          }`}>
            {mq135DbStatus === 'writing' ? '⏳ Writing to Supabase'
            : mq135DbStatus === 'ok'     ? '✓ Supabase updated'
            : '✗ DB write failed'}
          </span>
        )}
      </div>
    </div>
  );
};

export default SystemStatus;
