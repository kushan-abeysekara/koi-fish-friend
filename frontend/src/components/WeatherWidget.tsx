import React, { useState, useEffect, useCallback } from 'react';
import { weatherApi, type WeatherSummary, type WeatherForecast } from '../services/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';

const WeatherWidget: React.FC = () => {
  const [summary, setSummary] = useState<WeatherSummary | null>(null);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'summary' | 'forecast'>('summary');

  const fetchWeather = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [sum, fore] = await Promise.all([
        weatherApi.getSummary(),
        weatherApi.getForecast(),
      ]);
      setSummary(sum);
      setForecast(fore);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch weather data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000); // Refresh every 30 min
    return () => clearInterval(interval);
  }, [fetchWeather]);

  // Prepare chart data — next 24 hours
  const chartData = forecast?.hourly?.slice(0, 24).map((h) => ({
    time: new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    temperature: h.temperature,
    rainProb: h.precipitationProbability,
    rain: h.rain,
  })) || [];

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-500">Loading weather data...</p>
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <i className="fas fa-cloud-rain text-red-400 text-3xl mb-3 block"></i>
          <p className="text-red-700">{error}</p>
          <button onClick={fetchWeather} className="mt-3 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-400 to-cyan-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <i className="fas fa-cloud-sun"></i>
              Weather Forecast
            </h2>
            <p className="text-blue-100 mt-1">{summary?.location || 'Colombo, Sri Lanka'}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView('summary')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                view === 'summary' ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setView('forecast')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                view === 'forecast' ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              Forecast
            </button>
          </div>
        </div>
      </div>

      {/* Current Conditions */}
      {summary && view === 'summary' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Temperature */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">Temperature</span>
                <span className="text-3xl">{summary.weatherIcon}</span>
              </div>
              <div className="text-4xl font-bold text-gray-800">
                {summary.temperature}<span className="text-lg text-gray-400">°C</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{summary.weatherDescription}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                <span>↓ {summary.tempMin24h}°C</span>
                <span>•</span>
                <span>↑ {summary.tempMax24h}°C</span>
              </div>
            </div>

            {/* Rain */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">Rain Probability</span>
                <i className={`fas fa-umbrella text-xl ${
                  summary.rainProbabilityNext6h > 50 ? 'text-blue-500' : 'text-gray-300'
                }`}></i>
              </div>
              <div className="text-4xl font-bold text-gray-800">
                {summary.rainProbabilityNext6h}<span className="text-lg text-gray-400">%</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Next 6 hours</p>
              {summary.totalRainNext6h > 0 && (
                <p className="text-xs text-blue-500 mt-1">Expected: {summary.totalRainNext6h}mm</p>
              )}
            </div>

            {/* Humidity */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">Humidity</span>
                <i className="fas fa-tint text-xl text-cyan-400"></i>
              </div>
              <div className="text-4xl font-bold text-gray-800">
                {summary.humidity}<span className="text-lg text-gray-400">%</span>
              </div>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-cyan-400 transition-all"
                  style={{ width: `${summary.humidity}%` }}
                ></div>
              </div>
            </div>

            {/* Wind */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">Wind Speed</span>
                <i className="fas fa-wind text-xl text-teal-400"></i>
              </div>
              <div className="text-4xl font-bold text-gray-800">
                {summary.windSpeed}<span className="text-lg text-gray-400 ml-1">km/h</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {summary.windSpeed < 15 ? 'Calm' : summary.windSpeed < 30 ? 'Moderate' : 'Strong'}
              </p>
            </div>
          </div>

          {/* Fish Farming Weather Impact */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <i className="fas fa-fish text-cyan-500"></i>
              Impact on Fish Farm
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-lg border ${
                summary.temperature >= 20 && summary.temperature <= 28
                  ? 'bg-green-50 border-green-200'
                  : summary.temperature >= 15 && summary.temperature <= 32
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-red-50 border-red-200'
              }`}>
                <h4 className="font-medium text-gray-700 mb-1">Water Temperature</h4>
                <p className="text-sm text-gray-600">
                  {summary.temperature >= 20 && summary.temperature <= 28
                    ? '✅ Optimal range for koi fish (20-28°C)'
                    : summary.temperature < 15
                      ? '⚠️ Too cold — reduce feeding frequency'
                      : summary.temperature > 32
                        ? '🔴 Too hot — increase aeration'
                        : '⚠️ Outside optimal range — monitor fish behavior'}
                </p>
              </div>

              <div className={`p-4 rounded-lg border ${
                summary.rainProbabilityNext6h < 30
                  ? 'bg-green-50 border-green-200'
                  : summary.rainProbabilityNext6h < 70
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-red-50 border-red-200'
              }`}>
                <h4 className="font-medium text-gray-700 mb-1">Rain Impact</h4>
                <p className="text-sm text-gray-600">
                  {summary.rainProbabilityNext6h < 30
                    ? '✅ Clear conditions — normal operations'
                    : summary.rainProbabilityNext6h < 70
                      ? '⚠️ Rain possible — monitor pH levels'
                      : '🌧️ Heavy rain likely — check overflow & pH after rain'}
                </p>
              </div>

              <div className={`p-4 rounded-lg border ${
                summary.windSpeed < 20
                  ? 'bg-green-50 border-green-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <h4 className="font-medium text-gray-700 mb-1">Wind Impact</h4>
                <p className="text-sm text-gray-600">
                  {summary.windSpeed < 20
                    ? '✅ Calm — good for surface feeding'
                    : '⚠️ Windy — feed closer to sheltered area'}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Forecast Charts */}
      {view === 'forecast' && chartData.length > 0 && (
        <>
          {/* Temperature Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <i className="fas fa-thermometer-half text-red-400"></i>
              24-Hour Temperature Forecast
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} interval={2} />
                <YAxis tick={{ fontSize: 11 }} unit="°C" />
                <Tooltip
                  formatter={(value: number | undefined) => [`${value ?? 0}°C`, 'Temperature']}
                  contentStyle={{ borderRadius: 8, borderColor: '#e5e7eb' }}
                />
                <Area
                  type="monotone"
                  dataKey="temperature"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#tempGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Rain Probability Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <i className="fas fa-cloud-rain text-blue-400"></i>
              24-Hour Rain Probability
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} interval={2} />
                <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip
                  formatter={(value: number | undefined, name: string | undefined) => [
                    name === 'rainProb' ? `${value ?? 0}%` : `${value ?? 0}mm`,
                    name === 'rainProb' ? 'Rain Probability' : 'Rainfall'
                  ]}
                  contentStyle={{ borderRadius: 8, borderColor: '#e5e7eb' }}
                />
                <Bar dataKey="rainProb" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Last Updated */}
      {summary && (
        <div className="text-center text-xs text-gray-400">
          Weather data from Open-Meteo API • Updated: {new Date(summary.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default WeatherWidget;
