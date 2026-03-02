import { useState, useEffect, useCallback } from 'react';

const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8081';
const FRONTEND_URL = window.location.origin;

interface HealthComponent {
  status: string;
  details?: Record<string, unknown>;
}

interface HealthResponse {
  status: string;
  components?: Record<string, HealthComponent>;
}

interface Check {
  name: string;
  url: string;
  status: 'checking' | 'up' | 'down';
  responseTime?: number;
  statusCode?: number;
}

const InfoPage = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const ping = async (name: string, url: string): Promise<Check> => {
    const t0 = performance.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      return { name, url, status: res.ok ? 'up' : 'down', responseTime: Math.round(performance.now() - t0), statusCode: res.status };
    } catch {
      return { name, url, status: 'down', responseTime: Math.round(performance.now() - t0) };
    }
  };

  const runChecks = useCallback(async () => {
    setChecks([
      { name: 'Frontend', url: FRONTEND_URL, status: 'checking' },
      { name: 'Backend API', url: `${API_URL}/api/ponds`, status: 'checking' },
      { name: 'Backend Health', url: `${API_URL}/actuator/health`, status: 'checking' },
    ]);

    const results = await Promise.all([
      ping('Frontend', FRONTEND_URL),
      ping('Backend API', `${API_URL}/api/ponds`),
      ping('Backend Health', `${API_URL}/actuator/health`),
    ]);
    setChecks(results);

    try {
      const res = await fetch(`${API_URL}/actuator/health`);
      if (res.ok) setHealth(await res.json());
      else setHealth(null);
    } catch {
      setHealth(null);
    }

    setLastChecked(new Date());
  }, []);

  useEffect(() => { runChecks(); }, [runChecks]);
  useEffect(() => {
    const id = setInterval(runChecks, 30000);
    return () => clearInterval(id);
  }, [runChecks]);

  const backendUp = checks.find(c => c.name === 'Backend Health')?.status === 'up';
  const allUp = checks.length > 0 && checks.every(c => c.status === 'up');
  const anyChecking = checks.some(c => c.status === 'checking');

  const dot = (up: boolean) =>
    up ? 'w-3 h-3 rounded-full bg-green-500 animate-pulse' : 'w-3 h-3 rounded-full bg-red-500';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-lg font-bold">
              KF
            </div>
            <div>
              <h1 className="text-lg font-bold">Koi Fish Friend</h1>
              <p className="text-xs text-slate-400">System Info</p>
            </div>
          </div>
          <button
            onClick={runChecks}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition flex items-center gap-2"
          >
            <i className="fas fa-sync-alt"></i> Refresh
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Overall Status Banner */}
        <div className={`rounded-xl p-6 text-center border ${
          anyChecking
            ? 'bg-yellow-500/10 border-yellow-500/30'
            : allUp
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className={`inline-flex items-center gap-2 text-2xl font-bold ${
            anyChecking ? 'text-yellow-400' : allUp ? 'text-green-400' : 'text-red-400'
          }`}>
            <i className={`fas ${anyChecking ? 'fa-spinner fa-spin' : allUp ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
            {anyChecking ? 'Checking...' : allUp ? 'All Systems Operational' : 'Service Disruption'}
          </div>
          {lastChecked && (
            <p className="text-slate-400 text-sm mt-2">Last checked: {lastChecked.toLocaleTimeString()}</p>
          )}
        </div>

        {/* Connection Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`rounded-xl p-5 border ${backendUp ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={dot(backendUp)}></div>
              <span className="font-semibold text-lg">Backend Connected</span>
            </div>
            <p className={`text-sm ${backendUp ? 'text-green-400' : 'text-red-400'}`}>
              {backendUp ? 'Frontend is connected to Backend' : 'Frontend cannot reach Backend'}
            </p>
            <p className="text-xs text-slate-500 mt-2 break-all">{API_URL}</p>
          </div>

          <div className="rounded-xl p-5 border bg-blue-500/5 border-blue-500/20">
            <div className="flex items-center gap-3 mb-3">
              <div className={dot(true)}></div>
              <span className="font-semibold text-lg">Frontend</span>
            </div>
            <p className="text-sm text-blue-400">Running</p>
            <p className="text-xs text-slate-500 mt-2 break-all">{FRONTEND_URL}</p>
          </div>
        </div>

        {/* Endpoint Checks */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <i className="fas fa-signal text-indigo-400"></i> Endpoint Checks
            </h2>
          </div>
          <div className="divide-y divide-slate-700">
            {checks.map((c, i) => (
              <div key={i} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={dot(c.status === 'up')}></div>
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-blue-400 break-all">
                      {c.url}
                    </a>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                    c.status === 'up' ? 'bg-green-500/20 text-green-400' :
                    c.status === 'down' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {c.status === 'checking' ? 'CHECKING' : c.status.toUpperCase()}
                  </span>
                  {c.responseTime !== undefined && (
                    <p className="text-xs text-slate-500 mt-1">{c.responseTime}ms</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Backend Health Details */}
        {health?.components && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <i className="fas fa-heartbeat text-red-400"></i> Backend Health Details
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {Object.entries(health.components).map(([name, comp]) => (
                <div key={name} className={`rounded-lg p-4 border ${
                  comp.status === 'UP' ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium capitalize">{name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      comp.status === 'UP' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>{comp.status}</span>
                  </div>
                  {comp.details && (
                    <div className="text-xs text-slate-400 space-y-0.5 mt-2">
                      {Object.entries(comp.details).map(([k, v]) => (
                        <div key={k}><span className="text-slate-500">{k}:</span> {String(v)}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <i className="fas fa-link text-blue-400"></i> Quick Links
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5">
            <a href={FRONTEND_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-600 hover:border-blue-500 hover:bg-blue-500/5 transition">
              <i className="fas fa-desktop text-blue-400 w-5 text-center"></i>
              <span className="text-sm">Frontend App</span>
              <i className="fas fa-external-link-alt text-slate-600 ml-auto text-xs"></i>
            </a>
            <a href={API_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-600 hover:border-green-500 hover:bg-green-500/5 transition">
              <i className="fas fa-server text-green-400 w-5 text-center"></i>
              <span className="text-sm">Backend API</span>
              <i className="fas fa-external-link-alt text-slate-600 ml-auto text-xs"></i>
            </a>
            <a href={`${API_URL}/actuator/health`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-600 hover:border-emerald-500 hover:bg-emerald-500/5 transition">
              <i className="fas fa-heartbeat text-emerald-400 w-5 text-center"></i>
              <span className="text-sm">Health Check</span>
              <i className="fas fa-external-link-alt text-slate-600 ml-auto text-xs"></i>
            </a>
            <a href={`${FRONTEND_URL}/login`}
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-600 hover:border-purple-500 hover:bg-purple-500/5 transition">
              <i className="fas fa-sign-in-alt text-purple-400 w-5 text-center"></i>
              <span className="text-sm">Login to Dashboard</span>
              <i className="fas fa-arrow-right text-slate-600 ml-auto text-xs"></i>
            </a>
          </div>
        </div>

        {/* Environment */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <i className="fas fa-cog text-slate-400"></i> Environment
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between p-3 bg-slate-700/30 rounded-lg">
              <span className="text-slate-400">Frontend</span>
              <span className="font-mono text-xs text-slate-300">{FRONTEND_URL}</span>
            </div>
            <div className="flex justify-between p-3 bg-slate-700/30 rounded-lg">
              <span className="text-slate-400">Backend</span>
              <span className="font-mono text-xs text-slate-300">{API_URL}</span>
            </div>
            <div className="flex justify-between p-3 bg-slate-700/30 rounded-lg">
              <span className="text-slate-400">VITE_API_URL</span>
              <span className="font-mono text-xs text-slate-300">{import.meta.env.VITE_API_URL || '(not set)'}</span>
            </div>
            <div className="flex justify-between p-3 bg-slate-700/30 rounded-lg">
              <span className="text-slate-400">Mode</span>
              <span className="font-mono text-xs text-slate-300">{import.meta.env.MODE}</span>
            </div>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs pb-4">
          Auto-refreshes every 30 seconds
        </p>
      </div>
    </div>
  );
};

export default InfoPage;
