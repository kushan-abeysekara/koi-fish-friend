import { useState, useEffect } from 'react';
import { sensorDataApi, sensorDeviceApi, pondApi } from '../services/api';
import type { SensorData, SensorDevice, Pond } from '../services/api';

export default function EnergyMonitor() {
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [selectedPondId, setSelectedPondId] = useState<number | null>(null);
  const [device, setDevice] = useState<SensorDevice | null>(null);
  const [latestData, setLatestData] = useState<SensorData | null>(null);
  const [historicalData, setHistoricalData] = useState<SensorData[]>([]);
  const [electricityRate, setElectricityRate] = useState<number>(25); // LKR per kWh
  const [selectedHours, setSelectedHours] = useState<number>(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'realtime' | 'analysis'>('realtime');
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  useEffect(() => {
    const fetchPonds = async () => {
      try {
        const response = await pondApi.getAll();
        if (response.success && response.data) {
          setPonds(response.data);
          if (response.data.length > 0) {
            setSelectedPondId(response.data[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching ponds:', err);
        setError('Failed to fetch ponds');
      }
    };

    fetchPonds();
  }, []);

  // Fetch device and sensor data for selected pond
  useEffect(() => {
    if (!selectedPondId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const deviceRes = await sensorDeviceApi.getByPond(selectedPondId);
        if (deviceRes.success && deviceRes.data && deviceRes.data.length > 0) {
          const onlineDevice = deviceRes.data.find(d => d.status === 'online');
          setDevice(onlineDevice || deviceRes.data[0]);
        } else {
          setDevice(null);
          setLatestData(null);
          setHistoricalData([]);
          setLoading(false);
          return;
        }

        const [latestRes, historicalRes] = await Promise.all([
          sensorDataApi.getLatestEnergyByPond(selectedPondId),
          sensorDataApi.getHistoricalEnergyData(selectedPondId, selectedHours)
        ]);

        if (latestRes.success && latestRes.data) {
          setLatestData(latestRes.data);
          setLastUpdateTime(new Date());
          setSecondsSinceUpdate(0);
          console.log('✅ Energy data loaded:', latestRes.data);
        } else {
          setLatestData(null);
          console.warn('⚠️ No energy data available:', latestRes.message);
        }

        if (historicalRes.success && historicalRes.data) {
          setHistoricalData(historicalRes.data);
          console.log('✅ Historical energy data loaded:', historicalRes.data.length, 'records');
        } else {
          setHistoricalData([]);
          console.warn('⚠️ No historical energy data available');
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 20000); // Update every 20 seconds
    return () => clearInterval(interval);
  }, [selectedPondId, selectedHours]);
  // Update seconds counter every second
  useEffect(() => {
    if (!lastUpdateTime) return;

    const timer = setInterval(() => {
      const now = new Date();
      const seconds = Math.floor((now.getTime() - lastUpdateTime.getTime()) / 1000);
      setSecondsSinceUpdate(seconds);
    }, 1000);

    return () => clearInterval(timer);
  }, [lastUpdateTime]);
  const handleResetEnergy = async () => {
    if (!device) return;

    if (!confirm('Are you sure you want to reset the energy counter? This will reset the cumulative energy to 0.')) {
      return;
    }

    try {
      await sensorDeviceApi.resetEnergy(device.deviceId);
      setError(null);
      alert('Energy counter reset successfully');
      window.location.reload();
    } catch (err) {
      console.error('Error resetting energy:', err);
      setError('Failed to reset energy counter');
    }
  };

  const calculateTotalCost = () => {
    if (!latestData) return 0;
    const kWh = latestData.energyWh / 1000;
    return kWh * electricityRate;
  };

  const calculateHistoricalEnergy = () => {
    if (historicalData.length < 2) return 0;
    const latest = historicalData[0];
    const oldest = historicalData[historicalData.length - 1];
    return (latest.energyWh - oldest.energyWh) / 1000;
  };

  const calculateHistoricalCost = () => {
    return calculateHistoricalEnergy() * electricityRate;
  };

  const calculateAveragePower = () => {
    if (historicalData.length === 0) return 0;
    const sum = historicalData.reduce((acc, data) => acc + data.power, 0);
    return sum / historicalData.length;
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'normal': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formatFullTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">⚡ Energy Monitor</h1>
        <p className="text-gray-600">Real-time power monitoring & cost analysis</p>
      </div>

      {/* Pond Selection & Controls */}
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              🐟 Select Pond
            </label>
            <select
              value={selectedPondId || ''}
              onChange={(e) => setSelectedPondId(parseInt(e.target.value))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              {ponds.map((pond) => (
                <option key={pond.id} value={pond.id}>
                  {pond.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              💰 Electricity Rate (LKR/kWh)
            </label>
            <input
              type="number"
              value={electricityRate}
              onChange={(e) => setElectricityRate(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              📊 History Period
            </label>
            <select
              value={selectedHours}
              onChange={(e) => setSelectedHours(parseInt(e.target.value))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value={1}>Last Hour</option>
              <option value={6}>Last 6 Hours</option>
              <option value={12}>Last 12 Hours</option>
              <option value={24}>Last 24 Hours</option>
              <option value={72}>Last 3 Days</option>
              <option value={168}>Last Week</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-xl mb-6 shadow-lg">
          <div className="flex items-center">
            <span className="text-2xl mr-3">⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && !latestData && (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading sensor data...</p>
        </div>
      )}

      {/* No Data State */}
      {!loading && !latestData && selectedPondId && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 px-6 py-8 rounded-xl shadow-lg text-center">
          <div className="text-6xl mb-4">📡</div>
          <h3 className="text-xl font-bold mb-2">No Active Device</h3>
          <p>Make sure a device is assigned and online for this pond.</p>
        </div>
      )}

      {/* Main Content */}
      {latestData && (
        <>
          {/* Tabs */}
          <div className="flex space-x-2 mb-6">
            <button
              onClick={() => setActiveTab('realtime')}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${
                activeTab === 'realtime'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              ⚡ Real-Time Monitor
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${
                activeTab === 'analysis'
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              📈 Cost Analysis
            </button>
          </div>

          {/* Device Status Bar */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-4">
                <div className={`w-4 h-4 rounded-full ${getStatusColor(device?.status || 'offline')} animate-pulse`}></div>
                <div>
                  <p className="text-sm text-gray-400">Device ID</p>
                  <p className="font-mono font-bold text-lg">{device?.deviceId || 'N/A'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400">Data Timestamp</p>
                <p className="font-semibold">{formatTimestamp(latestData.timestamp)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Live Update</p>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <p className="font-semibold">
                    {secondsSinceUpdate < 20 ? `${secondsSinceUpdate}s ago` : 'Updating...'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400">Status</p>
                <p className="font-semibold capitalize">{latestData.status}</p>
              </div>
              <button
                onClick={handleResetEnergy}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
              >
                🔄 Reset Energy
              </button>
            </div>
          </div>

          {/* Power Control Info Notice */}
          <div className="bg-blue-50 border-l-4 border-blue-500 px-6 py-4 rounded-xl mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">🔌</span>
              <div>
                <p className="font-semibold text-blue-900">Looking for Power Control?</p>
                <p className="text-sm text-blue-700">Manual power ON/OFF controls are now in a dedicated tab</p>
              </div>
            </div>
            <a
              href="/dashboard/power-control"
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
            >
              Go to Power Control →
            </a>
          </div>

          {/* Real-Time Tab */}
          {activeTab === 'realtime' && (
            <>
              {/* Real-Time Update Info */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-4 mb-6 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                  <div>
                    <p className="font-bold text-green-900">🔴 LIVE DATA - Updating Every 20 Seconds</p>
                    <p className="text-sm text-green-700">
                      Last updated: {lastUpdateTime ? lastUpdateTime.toLocaleTimeString() : 'Loading...'} 
                      {secondsSinceUpdate > 0 && ` (${secondsSinceUpdate}s ago)`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-green-800">Next update in</p>
                  <p className="text-2xl font-bold text-green-600">{Math.max(0, 20 - secondsSinceUpdate)}s</p>
                </div>
              </div>

              {/* Live Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                {/* Voltage Card */}
                <div className={`bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all ${secondsSinceUpdate < 1 ? 'ring-4 ring-blue-300 scale-105' : ''}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-4xl">⚡</span>
                    <span className="text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">VOLTAGE</span>
                  </div>
                  <div className="text-5xl font-bold mb-2">{latestData.voltage?.toFixed(1) || '0.0'}</div>
                  <div className="text-blue-100 text-lg">Volts</div>
                  {secondsSinceUpdate < 1 && (
                    <div className="mt-2 text-xs bg-white/20 px-2 py-1 rounded-full inline-block">🔴 LIVE</div>
                  )}
                </div>

                {/* Current Card */}
                <div className={`bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all ${secondsSinceUpdate < 1 ? 'ring-4 ring-green-300 scale-105' : ''}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-4xl">🔌</span>
                    <span className="text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">CURRENT</span>
                  </div>
                  <div className="text-5xl font-bold mb-2">{latestData.current?.toFixed(2) || '0.00'}</div>
                  <div className="text-green-100 text-lg">Amperes</div>
                  {secondsSinceUpdate < 1 && (
                    <div className="mt-2 text-xs bg-white/20 px-2 py-1 rounded-full inline-block">🔴 LIVE</div>
                  )}
                </div>

                {/* Power Card */}
                <div className={`bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all ${secondsSinceUpdate < 1 ? 'ring-4 ring-purple-300 scale-105' : ''}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-4xl">⚙️</span>
                    <span className="text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">POWER</span>
                  </div>
                  <div className="text-5xl font-bold mb-2">{latestData.power?.toFixed(1) || '0.0'}</div>
                  <div className="text-purple-100 text-lg">Watts</div>
                  {secondsSinceUpdate < 1 && (
                    <div className="mt-2 text-xs bg-white/20 px-2 py-1 rounded-full inline-block">🔴 LIVE</div>
                  )}
                </div>

                {/* Energy Card */}
                <div className={`bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all ${secondsSinceUpdate < 1 ? 'ring-4 ring-orange-300 scale-105' : ''}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-4xl">💡</span>
                    <span className="text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">ENERGY</span>
                  </div>
                  <div className="text-5xl font-bold mb-2">{((latestData.energyWh || 0) / 1000).toFixed(3)}</div>
                  <div className="text-orange-100 text-lg">kWh</div>
                  {secondsSinceUpdate < 1 && (
                    <div className="mt-2 text-xs bg-white/20 px-2 py-1 rounded-full inline-block">🔴 LIVE</div>
                  )}
                </div>
              </div>

              {/* Recent History Table */}
              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                  <span className="mr-3">📋</span>
                  Recent Readings (Last Hour)
                </h2>
                
                {historicalData.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-5xl mb-4">📊</div>
                    <p className="text-lg">Not enough data yet...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-200">
                          <th className="text-left py-4 px-4 font-semibold text-gray-700">Time</th>
                          <th className="text-right py-4 px-4 font-semibold text-gray-700">Voltage (V)</th>
                          <th className="text-right py-4 px-4 font-semibold text-gray-700">Current (A)</th>
                          <th className="text-right py-4 px-4 font-semibold text-gray-700">Power (W)</th>
                          <th className="text-right py-4 px-4 font-semibold text-gray-700">Energy (kWh)</th>
                          <th className="text-center py-4 px-4 font-semibold text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historicalData.slice(0, 20).map((data, index) => (
                          <tr 
                            key={data.id} 
                            className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                              index === 0 ? 'bg-blue-50 font-semibold' : ''
                            }`}
                          >
                            <td className="py-4 px-4">{formatTimestamp(data.timestamp)}</td>
                            <td className="text-right py-4 px-4">{data.voltage.toFixed(1)}</td>
                            <td className="text-right py-4 px-4">{data.current.toFixed(2)}</td>
                            <td className="text-right py-4 px-4">{data.power.toFixed(1)}</td>
                            <td className="text-right py-4 px-4">{(data.energyWh / 1000).toFixed(3)}</td>
                            <td className="text-center py-4 px-4">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                                data.status === 'normal' ? 'bg-green-100 text-green-800' :
                                data.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                data.status === 'critical' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
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
            </>
          )}

          {/* Cost Analysis Tab */}
          {activeTab === 'analysis' && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                {/* Total Energy */}
                <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-blue-500">
                  <div className="text-sm font-semibold text-gray-600 mb-2">💡 Total Energy</div>
                  <div className="text-4xl font-bold text-blue-600 mb-1">
                    {((latestData?.energyWh || 0) / 1000).toFixed(3)}
                  </div>
                  <div className="text-gray-500">kWh (Cumulative)</div>
                </div>

                {/* Current Power */}
                <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-green-500">
                  <div className="text-sm font-semibold text-gray-600 mb-2">⚡ Current Power</div>
                  <div className="text-4xl font-bold text-green-600 mb-1">
                    {latestData?.power?.toFixed(1) || '0.0'}
                  </div>
                  <div className="text-gray-500">Watts (Now)</div>
                </div>

                {/* Total Cost */}
                <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-purple-500">
                  <div className="text-sm font-semibold text-gray-600 mb-2">💰 Total Cost</div>
                  <div className="text-4xl font-bold text-purple-600 mb-1">
                    {calculateTotalCost().toFixed(2)}
                  </div>
                  <div className="text-gray-500">LKR (Cumulative)</div>
                </div>

                {/* Device Status */}
                <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-orange-500">
                  <div className="text-sm font-semibold text-gray-600 mb-2">📡 Device Status</div>
                  <div className="text-4xl font-bold text-orange-600 mb-1 capitalize">
                    {device?.status || 'Unknown'}
                  </div>
                  <div className="text-gray-500">Connection</div>
                </div>
              </div>

              {/* Period Analysis */}
              {historicalData.length >= 2 && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-xl p-8 mb-6 border border-indigo-100">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                    <span className="mr-3">📊</span>
                    Analysis for Selected Period ({selectedHours}h)
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-white rounded-xl p-6 shadow-lg">
                      <div className="text-sm font-semibold text-gray-600 mb-2">⚡ Energy Consumed</div>
                      <div className="text-4xl font-bold text-indigo-600 mb-1">
                        {calculateHistoricalEnergy().toFixed(3)}
                      </div>
                      <div className="text-gray-500">kWh in period</div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-lg">
                      <div className="text-sm font-semibold text-gray-600 mb-2">📈 Average Power</div>
                      <div className="text-4xl font-bold text-purple-600 mb-1">
                        {calculateAveragePower().toFixed(1)}
                      </div>
                      <div className="text-gray-500">Watts average</div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-lg">
                      <div className="text-sm font-semibold text-gray-600 mb-2">💵 Period Cost</div>
                      <div className="text-4xl font-bold text-pink-600 mb-1">
                        {calculateHistoricalCost().toFixed(2)}
                      </div>
                      <div className="text-gray-500">LKR in period</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Detailed Cost Breakdown Table */}
              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                  <span className="mr-3">💳</span>
                  Detailed Cost Breakdown
                </h2>

                {historicalData.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-5xl mb-4">📉</div>
                    <p className="text-lg">No historical data available</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-200">
                          <th className="text-left py-4 px-4 font-semibold text-gray-700">Timestamp</th>
                          <th className="text-right py-4 px-4 font-semibold text-gray-700">V</th>
                          <th className="text-right py-4 px-4 font-semibold text-gray-700">I (A)</th>
                          <th className="text-right py-4 px-4 font-semibold text-gray-700">P (W)</th>
                          <th className="text-right py-4 px-4 font-semibold text-gray-700">kWh</th>
                          <th className="text-right py-4 px-4 font-semibold text-gray-700">Cost (LKR)</th>
                          <th className="text-center py-4 px-4 font-semibold text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historicalData.map((data) => {
                          const kWh = data.energyWh / 1000;
                          const cost = kWh * electricityRate;
                          return (
                            <tr key={data.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="py-4 px-4 text-sm">{formatFullTimestamp(data.timestamp)}</td>
                              <td className="text-right py-4 px-4">{data.voltage.toFixed(1)}</td>
                              <td className="text-right py-4 px-4">{data.current.toFixed(2)}</td>
                              <td className="text-right py-4 px-4 font-semibold">{data.power.toFixed(1)}</td>
                              <td className="text-right py-4 px-4 font-semibold text-blue-600">{kWh.toFixed(3)}</td>
                              <td className="text-right py-4 px-4 font-bold text-purple-600">{cost.toFixed(2)}</td>
                              <td className="text-center py-4 px-4">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                                  data.status === 'normal' ? 'bg-green-100 text-green-800' :
                                  data.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                  data.status === 'critical' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
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

              {/* Info Box */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-xl mt-6">
                <h3 className="font-bold text-blue-900 mb-2 flex items-center">
                  <span className="mr-2">ℹ️</span>
                  How Costs Are Calculated
                </h3>
                <ul className="text-blue-800 space-y-1 ml-6 list-disc">
                  <li>Total Cost = Total Energy (kWh) × Electricity Rate (LKR/kWh)</li>
                  <li>Period Cost = Energy consumed during selected period × Rate</li>
                  <li>Average Power = Mean of all power readings in the period</li>
                  <li>Energy readings are cumulative from the last reset</li>
                </ul>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
