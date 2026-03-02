import { useState, useEffect, useCallback } from 'react';

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

const SystemStatus: React.FC = () => {
  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointCheck[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

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
    </div>
  );
};

export default SystemStatus;
