import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiApi, weatherApi, type AIPrediction, type WeatherSummary } from '../services/api';
import { fetchDeviceStatusDirect, type FeeddbRow, supabasePgQuery } from '../services/supabase';
import { supabase } from '../services/supabase';

interface WaterQualityLive {
  rainLevel: number;
  rainDetected: boolean;
  rainStatus: string;
  phValue: number;
  turbidity: number;
  waterQualityStatus: string;
}

interface DashboardHomeProps {
  username: string;
}

const DashboardHome: React.FC<DashboardHomeProps> = ({ username }) => {
  const navigate = useNavigate();
  const [weather, setWeather] = useState<WeatherSummary | null>(null);
  const [prediction, setPrediction] = useState<AIPrediction | null>(null);
  const [device, setDevice] = useState<FeeddbRow | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [loadingAI, setLoadingAI] = useState(true);
  const [waterQuality, setWaterQuality] = useState<WaterQualityLive | null>(null);
  const supabaseChannelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  const backendWsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Fetch all dashboard data in parallel
    weatherApi.getSummary()
      .then(setWeather)
      .catch(() => {})
      .finally(() => setLoadingWeather(false));

    aiApi.getPrediction()
      .then(setPrediction)
      .catch(() => {})
      .finally(() => setLoadingAI(false));

    fetchDeviceStatusDirect()
      .then(setDevice)
      .catch(() => {});
  }, []);

  // Real-time Supabase subscription for water quality / rain data
  useEffect(() => {
    const handleWqPayload = (raw: Record<string, unknown>) => {
      // Accept both camelCase (WS relay) and snake_case (Supabase Realtime)
      const devId = (raw.deviceId ?? raw.device_id ?? '') as string;
      if (!devId.startsWith('WQ_')) return;
      const ph = (raw.phValue ?? raw.ph_value) as number | undefined;
      if (ph === undefined) return;
      setWaterQuality({
        rainLevel: (raw.rainLevel ?? raw.rain_level ?? 0) as number,
        rainDetected: (raw.rainDetected ?? raw.rain_detected ?? false) as boolean,
        rainStatus: (raw.rainStatus ?? raw.rain_status ?? 'dry') as string,
        phValue: ph,
        turbidity: (raw.turbidity ?? 0) as number,
        waterQualityStatus: (raw.waterQualityStatus ?? raw.water_quality_status ?? 'normal') as string,
      });
    };

    // Fetch initial data from Supabase
    supabasePgQuery<Record<string, unknown>>(
      "SELECT * FROM sensor_live WHERE device_id LIKE 'WQ_%' LIMIT 1"
    ).then((rows) => {
      if (rows.length > 0) handleWqPayload(rows[0]);
    }).catch(() => {});

    // 1. Supabase Realtime subscription (primary)
    if (supabase) {
      const channel = supabase
        .channel('dashboard-wq-live')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'sensor_live',
        }, (payload) => {
          handleWqPayload(payload.new as Record<string, unknown>);
        })
        .subscribe();
      supabaseChannelRef.current = channel;
    }

    // 2. Backend WS relay as fallback (receives data from SupabaseRealtimePoller)
    const API_BASE: string = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8081';
    const wsUrl = API_BASE.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws/feeding';
    const ws = new WebSocket(wsUrl);
    backendWsRef.current = ws;
    ws.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data as string);
        handleWqPayload(raw);
      } catch { /* ignore */ }
    };
    ws.onclose = () => {
      setTimeout(() => {
        if (backendWsRef.current) backendWsRef.current.close();
      }, 5000);
    };

    return () => {
      if (supabaseChannelRef.current && supabase) {
        supabase.removeChannel(supabaseChannelRef.current);
        supabaseChannelRef.current = null;
      }
      if (backendWsRef.current) { backendWsRef.current.close(); backendWsRef.current = null; }
    };
  }, []);

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Determine rain intensity for animation
  const isRaining = waterQuality?.rainDetected || (waterQuality?.rainLevel ?? 0) >= 5;
  const rainIntensity: 'none' | 'light' | 'moderate' | 'heavy' =
    !isRaining ? 'none' :
    (waterQuality?.rainLevel ?? 0) < 25 ? 'light' :
    (waterQuality?.rainLevel ?? 0) < 60 ? 'moderate' : 'heavy';

  // Generate raindrop elements — memoised so they don't re-create each render
  const raindrops = useMemo(() => {
    if (rainIntensity === 'none') return null;
    const count = rainIntensity === 'light' ? 40 : rainIntensity === 'moderate' ? 90 : 160;
    const sizeClass = rainIntensity === 'light' ? 'raindrop-light' :
                      rainIntensity === 'moderate' ? 'raindrop-moderate' : 'raindrop-heavy';
    return Array.from({ length: count }, (_, i) => {
      const left = Math.random() * 100;          // 0-100 vw
      const duration = rainIntensity === 'heavy' ? 0.4 + Math.random() * 0.3 :
                       rainIntensity === 'moderate' ? 0.6 + Math.random() * 0.5 :
                       0.9 + Math.random() * 0.7;
      const delay = Math.random() * 2;
      return (
        <div
          key={i}
          className={`raindrop ${sizeClass}`}
          style={{
            left: `${left}%`,
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`,
          }}
        />
      );
    });
  }, [rainIntensity]);

  // Splash elements at the bottom
  const splashes = useMemo(() => {
    if (rainIntensity === 'none') return null;
    const count = rainIntensity === 'light' ? 8 : rainIntensity === 'moderate' ? 18 : 30;
    return Array.from({ length: count }, (_, i) => {
      const left = Math.random() * 100;
      const delay = Math.random() * 1.5;
      return (
        <div
          key={i}
          className="rain-splash"
          style={{
            left: `${left}%`,
            animationDelay: `${delay}s`,
          }}
        />
      );
    });
  }, [rainIntensity]);

  return (
    <div className="space-y-6 relative">
      {/* ─── Rain Animation Overlay ─── */}
      {isRaining && (
        <>
          <div className="rain-overlay">
            {raindrops}
            {splashes}
          </div>
          {/* Mist at the bottom */}
          <div className="rain-mist" />
          {/* Lightning flash only for heavy rain */}
          {rainIntensity === 'heavy' && <div className="rain-lightning" />}
        </>
      )}
      {/* Welcome Section */}
      <div className={`rounded-xl shadow-lg p-8 text-white transition-all duration-700 ${
        isRaining
          ? 'bg-gradient-to-r from-slate-600 via-slate-700 to-gray-800'
          : 'bg-gradient-to-r from-cyan-500 to-blue-600'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">Welcome back, {username}! 👋</h2>
            <p className={isRaining ? 'text-blue-200' : 'text-cyan-100'}>
              {isRaining
                ? `It's raining outside — ${waterQuality?.rainStatus ?? 'rain'} rain detected by pond sensor.`
                : "Here's what's happening with your fish farm today."}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3">
            {/* Rain badge (real-time sensor) */}
            {isRaining && (
              <div className="flex items-center gap-2 bg-blue-500/30 backdrop-blur-sm rounded-xl px-4 py-2 border border-blue-400/30">
                <span className="text-3xl cloud-icon">🌧️</span>
                <div>
                  <p className="text-lg font-bold">{waterQuality?.rainLevel.toFixed(0)}%</p>
                  <p className="text-xs text-blue-200">Rain Intensity</p>
                </div>
              </div>
            )}
            {/* Weather badge */}
            {weather && (
              <div className="flex items-center gap-3 bg-white/15 rounded-xl px-5 py-3 backdrop-blur-sm">
                <span className="text-4xl">{isRaining ? '🌧️' : weather.weatherIcon}</span>
                <div>
                  <p className="text-2xl font-bold">{weather.temperature}°C</p>
                  <p className="text-sm text-cyan-100">{isRaining ? 'Rainy' : weather.weatherDescription}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rain alert banner inside welcome section */}
        {isRaining && (
          <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-3 border border-white/10">
            <span className="text-2xl animate-bounce">☔</span>
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {rainIntensity === 'heavy' ? '⚠️ Heavy rain detected! Monitor pond water level and pH closely.' :
                 rainIntensity === 'moderate' ? '🌧️ Moderate rain — pond pH may shift slightly. Keep monitoring.' :
                 '🌦️ Light rain detected at the pond. No action needed.'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-300 animate-pulse"></div>
              <span className="text-[10px] text-blue-200 font-bold">LIVE SENSOR</span>
            </div>
          </div>
        )}
      </div>

      {/* Live Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Farm Health */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Farm Health</p>
              {loadingAI ? (
                <div className="h-9 w-16 bg-gray-100 rounded animate-pulse"></div>
              ) : (
                <>
                  <p className={`text-3xl font-bold ${prediction ? getHealthColor(prediction.healthScore) : 'text-gray-400'}`}>
                    {prediction?.healthScore ?? '--'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {prediction?.healthScore && prediction.healthScore >= 80 ? 'Excellent' :
                     prediction?.healthScore && prediction.healthScore >= 60 ? 'Good' : 'Needs attention'}
                  </p>
                </>
              )}
            </div>
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
              <i className="fas fa-heartbeat text-purple-600 text-2xl"></i>
            </div>
          </div>
        </div>

        {/* Device Status */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Feed Device</p>
              <p className="text-3xl font-bold text-gray-800">
                {device?.status === 'online' ? (
                  <span className="text-green-500">Online</span>
                ) : (
                  <span className="text-gray-400">Offline</span>
                )}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {device ? `Tank: ${(device.tank_percentage ?? 0).toFixed(1)}%` : 'No data'}
              </p>
            </div>
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
              <i className={`fas fa-microchip text-2xl ${device?.status === 'online' ? 'text-green-600' : 'text-gray-400'}`}></i>
            </div>
          </div>
        </div>

        {/* Weather */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Temperature</p>
              {loadingWeather ? (
                <div className="h-9 w-20 bg-gray-100 rounded animate-pulse"></div>
              ) : (
                <>
                  <p className="text-3xl font-bold text-gray-800">
                    {weather?.temperature ?? '--'}<span className="text-lg text-gray-400">°C</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Rain: {weather?.rainProbabilityNext6h ?? 0}% next 6h
                  </p>
                </>
              )}
            </div>
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
              <i className="fas fa-cloud-sun text-blue-500 text-2xl"></i>
            </div>
          </div>
        </div>

        {/* Next Feeding */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Next Feeding</p>
              {loadingAI ? (
                <div className="h-9 w-24 bg-gray-100 rounded animate-pulse"></div>
              ) : (
                <p className="text-lg font-bold text-gray-800 leading-snug">
                  {prediction?.nextFeedingTime ?? 'Check schedule'}
                </p>
              )}
            </div>
            <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center">
              <i className="fas fa-clock text-cyan-600 text-2xl"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Water Quality & Rain Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Rain Status Card */}
        <div className={`rounded-xl shadow-sm p-5 border transition hover:shadow-md ${
          !waterQuality ? 'bg-white border-gray-100' :
          waterQuality.rainLevel < 10 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' :
          waterQuality.rainLevel < 40 ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-300' :
          'bg-gradient-to-br from-red-50 to-orange-50 border-red-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-5xl">
                {!waterQuality ? '🌤️' : waterQuality.rainLevel < 10 ? '☀️' : waterQuality.rainLevel < 40 ? '🌦️' : '🌧️'}
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Rain Status <span className="text-xs">(Real-Time)</span></p>
                {waterQuality ? (
                  <>
                    <p className={`text-2xl font-bold ${
                      waterQuality.rainLevel < 10 ? 'text-green-700' :
                      waterQuality.rainLevel < 40 ? 'text-yellow-700' : 'text-red-700'
                    }`}>
                      {waterQuality.rainStatus.charAt(0).toUpperCase() + waterQuality.rainStatus.slice(1)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">Intensity: {waterQuality.rainLevel.toFixed(1)}%</span>
                      {waterQuality.rainDetected && (
                        <span className="px-1.5 py-0.5 bg-blue-200 text-blue-700 rounded text-[10px] font-bold animate-pulse">
                          RAIN
                        </span>
                      )}
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-[10px] text-green-600 font-semibold">LIVE</span>
                    </div>
                  </>
                ) : (
                  <p className="text-lg text-gray-400">Waiting for sensor...</p>
                )}
              </div>
            </div>
            {waterQuality && (
              <div className="flex flex-col items-end gap-1">
                <div className="w-24 h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      waterQuality.rainLevel < 10 ? 'bg-green-500' :
                      waterQuality.rainLevel < 40 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(waterQuality.rainLevel, 100)}%` }}
                  />
                </div>
                <button
                  onClick={() => navigate('/dashboard/water-quality-dashboard')}
                  className="text-xs text-cyan-600 hover:text-cyan-800 font-medium mt-1"
                >
                  View Details →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Water Quality Quick Status */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🌊</span>
              <p className="text-sm font-semibold text-gray-700">Water Quality <span className="text-xs text-gray-400">(Real-Time)</span></p>
            </div>
            {waterQuality && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[10px] text-green-600 font-semibold">LIVE</span>
              </div>
            )}
          </div>
          {waterQuality ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">pH</p>
                <p className={`text-lg font-bold ${
                  waterQuality.phValue >= 6.5 && waterQuality.phValue <= 8.5 ? 'text-green-600' :
                  waterQuality.phValue >= 6.0 && waterQuality.phValue <= 9.0 ? 'text-yellow-600' : 'text-red-600'
                }`}>{waterQuality.phValue.toFixed(1)}</p>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Turbidity</p>
                <p className={`text-lg font-bold ${
                  waterQuality.turbidity <= 25 ? 'text-green-600' :
                  waterQuality.turbidity <= 40 ? 'text-yellow-600' : 'text-red-600'
                }`}>{waterQuality.turbidity.toFixed(0)} <span className="text-xs text-gray-400">NTU</span></p>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Status</p>
                <p className={`text-sm font-bold ${
                  waterQuality.waterQualityStatus === 'normal' ? 'text-green-600' :
                  waterQuality.waterQualityStatus === 'warning' ? 'text-yellow-600' : 'text-red-600'
                }`}>{waterQuality.waterQualityStatus.charAt(0).toUpperCase() + waterQuality.waterQualityStatus.slice(1)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">Waiting for sensor data...</p>
          )}
          <button
            onClick={() => navigate('/dashboard/water-quality-dashboard')}
            className="w-full mt-3 text-xs text-center text-cyan-600 hover:text-cyan-800 font-medium py-1"
          >
            Open Water Quality Dashboard →
          </button>
        </div>
      </div>

      {/* AI Recommendations Banner */}
      {prediction && prediction.recommendations && prediction.recommendations.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-5 border border-purple-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
              <i className="fas fa-brain text-white text-sm"></i>
            </div>
            <h3 className="font-bold text-purple-800">AI Recommendations</h3>
            <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full">
              {prediction.source === 'flowise' ? 'AI Powered' : 'Rule-based'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {prediction.recommendations.slice(0, 4).map((rec, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <i className="fas fa-check-circle text-purple-400 mt-0.5"></i>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i className="fas fa-bolt text-yellow-500"></i>
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/dashboard/feeding-dashboard')}
            className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-left"
          >
            <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-utensils text-cyan-600 text-xl"></i>
            </div>
            <div>
              <p className="font-semibold text-gray-800">Feeding Dashboard</p>
              <p className="text-sm text-gray-500">Monitor & control feeding</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/dashboard/boat-navigation')}
            className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-left"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-ship text-blue-600 text-xl"></i>
            </div>
            <div>
              <p className="font-semibold text-gray-800">Live Camera</p>
              <p className="text-sm text-gray-500">View boat & fish feed</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/dashboard/water-quality-dashboard')}
            className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-left"
          >
            <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-tint text-teal-600 text-xl"></i>
            </div>
            <div>
              <p className="font-semibold text-gray-800">Water Quality</p>
              <p className="text-sm text-gray-500">pH, turbidity, DO</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/dashboard/ai-predictions')}
            className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-left"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-brain text-purple-600 text-xl"></i>
            </div>
            <div>
              <p className="font-semibold text-gray-800">AI Predictions</p>
              <p className="text-sm text-gray-500">Smart farm insights</p>
            </div>
          </button>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i className="fas fa-server text-green-500"></i>
          System Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-3">
              <i className="fas fa-check-circle text-green-600"></i>
              <span className="font-medium text-gray-800">Backend Server</span>
            </div>
            <span className="text-sm text-green-600 font-semibold">Online</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-3">
              <i className="fas fa-database text-green-600"></i>
              <span className="font-medium text-gray-800">Supabase DB</span>
            </div>
            <span className="text-sm text-green-600 font-semibold">Connected</span>
          </div>
          <div className={`flex items-center justify-between p-3 rounded-lg ${
            device?.status === 'online' ? 'bg-green-50' : 'bg-yellow-50'
          }`}>
            <div className="flex items-center gap-3">
              <i className={`fas fa-microchip ${device?.status === 'online' ? 'text-green-600' : 'text-yellow-600'}`}></i>
              <span className="font-medium text-gray-800">ESP32 Device</span>
            </div>
            <span className={`text-sm font-semibold ${
              device?.status === 'online' ? 'text-green-600' : 'text-yellow-600'
            }`}>
              {device?.status === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-3">
              <i className="fas fa-video text-green-600"></i>
              <span className="font-medium text-gray-800">MediaMTX Camera</span>
            </div>
            <span className="text-sm text-green-600 font-semibold">Ready</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-3">
              <i className="fas fa-database text-green-600"></i>
              <span className="font-medium text-gray-800">Supabase Realtime</span>
            </div>
            <span className="text-sm text-green-600 font-semibold">Connected</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-3">
              <i className="fas fa-brain text-green-600"></i>
              <span className="font-medium text-gray-800">AI Engine</span>
            </div>
            <span className="text-sm text-green-600 font-semibold">
              {prediction?.source === 'flowise' ? 'Flowise' : 'Rule Engine'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
