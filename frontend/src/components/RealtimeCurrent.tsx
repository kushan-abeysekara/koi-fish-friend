import React, { useState, useEffect } from 'react';

interface SensorData {
  id: string;
  pondId: string;
  pondName: string;
  current: number;
  voltage: number;
  power: number;
  timestamp: string;
  status: 'normal' | 'warning' | 'critical';
}

interface Pond {
  id: string;
  name: string;
  color: string;
}

const RealtimeCurrent: React.FC = () => {
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [selectedPond, setSelectedPond] = useState<string>('all');
  const [isLive, setIsLive] = useState(true);

  // Mock ponds - In real app, fetch from backend
  const ponds: Pond[] = [
    { id: '1', name: 'Pond 1', color: 'blue' },
    { id: '2', name: 'Pond 2', color: 'green' },
  ];

  const pondColors: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
    green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
    pink: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
    red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  };

  // Simulate real-time sensor data updates
  useEffect(() => {
    const generateMockData = (): SensorData[] => {
      return ponds.map((pond) => {
        const current = parseFloat((Math.random() * 15 + 5).toFixed(2)); // 5-20 Amps
        const voltage = parseFloat((230 + Math.random() * 10 - 5).toFixed(2)); // 225-235 V
        const power = parseFloat((current * voltage / 1000).toFixed(2)); // kW
        
        let status: 'normal' | 'warning' | 'critical' = 'normal';
        if (current > 18) status = 'critical';
        else if (current > 15) status = 'warning';

        return {
          id: `sensor-${pond.id}-${Date.now()}`,
          pondId: pond.id,
          pondName: pond.name,
          current,
          voltage,
          power,
          timestamp: new Date().toLocaleTimeString(),
          status,
        };
      });
    };

    setSensorData(generateMockData());

    if (isLive) {
      const interval = setInterval(() => {
        setSensorData(generateMockData());
      }, 3000); // Update every 3 seconds

      return () => clearInterval(interval);
    }
  }, [isLive]);

  const getFilteredData = () => {
    if (selectedPond === 'all') {
      return sensorData;
    }
    return sensorData.filter(data => data.pondId === selectedPond);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      default:
        return 'bg-green-100 text-green-700 border-green-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical':
        return '🔴';
      case 'warning':
        return '🟡';
      default:
        return '🟢';
    }
  };

  const getTotalPower = () => {
    return getFilteredData().reduce((sum, data) => sum + data.power, 0).toFixed(2);
  };

  const getAverageCurrent = () => {
    const filtered = getFilteredData();
    if (filtered.length === 0) return '0.00';
    const avg = filtered.reduce((sum, data) => sum + data.current, 0) / filtered.length;
    return avg.toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <span>⚡</span> Realtime Current Monitoring
            </h2>
            <p className="text-purple-100">Live electrical current and power consumption data from pond sensors</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-purple-200">
              {isLive ? (
                <span className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  LIVE
                </span>
              ) : (
                'PAUSED'
              )}
            </p>
            <p className="text-4xl font-bold mt-1">{getTotalPower()} kW</p>
            <p className="text-sm text-purple-200">Total Power</p>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Pond Filter */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setSelectedPond('all')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
                selectedPond === 'all'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <i className="fas fa-globe mr-2"></i>
              All Ponds
            </button>

            {ponds.map((pond) => {
              const pondColorClasses = pondColors[pond.color];
              return (
                <button
                  key={pond.id}
                  onClick={() => setSelectedPond(pond.id)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
                    selectedPond === pond.id
                      ? `${pondColorClasses.bg} ${pondColorClasses.text} border-2 ${pondColorClasses.border} shadow-lg`
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <i className="fas fa-water mr-2"></i>
                  {pond.name}
                </button>
              );
            })}
          </div>

          {/* Live Toggle */}
          <button
            onClick={() => setIsLive(!isLive)}
            className={`px-6 py-2 rounded-lg font-semibold shadow-md transition-all duration-200 flex items-center gap-2 ${
              isLive
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-400 hover:bg-gray-500 text-white'
            }`}
          >
            <i className={`fas ${isLive ? 'fa-pause' : 'fa-play'}`}></i>
            {isLive ? 'Pause' : 'Resume'}
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-3xl">⚡</span>
            <i className="fas fa-bolt text-2xl opacity-50"></i>
          </div>
          <h3 className="text-lg font-semibold mb-1 opacity-90">Average Current</h3>
          <p className="text-3xl font-bold">{getAverageCurrent()} A</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-3xl">🔌</span>
            <i className="fas fa-plug text-2xl opacity-50"></i>
          </div>
          <h3 className="text-lg font-semibold mb-1 opacity-90">Total Power</h3>
          <p className="text-3xl font-bold">{getTotalPower()} kW</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-3xl">🏞️</span>
            <i className="fas fa-water text-2xl opacity-50"></i>
          </div>
          <h3 className="text-lg font-semibold mb-1 opacity-90">Active Sensors</h3>
          <p className="text-3xl font-bold">{getFilteredData().length}</p>
        </div>
      </div>

      {/* Sensor Data Cards */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i className="fas fa-chart-line text-indigo-600"></i>
          Current Sensor Readings
        </h3>

        {getFilteredData().length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📡</div>
            <p className="text-gray-500 text-lg mb-2">No sensor data available</p>
            <p className="text-gray-400">Waiting for sensor connections...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {getFilteredData().map((data) => {
              const pond = ponds.find(p => p.id === data.pondId);
              const pondColorClasses = pond ? pondColors[pond.color] : pondColors.blue;
              
              return (
                <div
                  key={data.id}
                  className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-200 hover:shadow-lg transition-all duration-200"
                >
                  {/* Pond Header */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${pondColorClasses.bg} ${pondColorClasses.text}`}>
                      <i className="fas fa-water mr-2"></i>
                      {data.pondName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${getStatusColor(data.status)}`}>
                        {getStatusIcon(data.status)} {data.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Sensor Metrics */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                          <span className="text-xl">⚡</span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-semibold">Current</p>
                          <p className="text-xl font-bold text-gray-800">{data.current} A</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xl">🔌</span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-semibold">Voltage</p>
                          <p className="text-xl font-bold text-gray-800">{data.voltage} V</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-xl">💡</span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-semibold">Power</p>
                          <p className="text-xl font-bold text-gray-800">{data.power} kW</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="mt-4 pt-3 border-t border-gray-300 flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <i className="fas fa-clock"></i>
                      Last updated: {data.timestamp}
                    </span>
                    {isLive && (
                      <span className="flex items-center gap-1 text-green-600 font-semibold">
                        <span className="animate-pulse">●</span>
                        Live
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Note */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <div className="flex items-start gap-3">
          <i className="fas fa-info-circle text-blue-500 text-xl mt-0.5"></i>
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">About Real-time Monitoring</p>
            <p>
              This dashboard shows live electrical current, voltage, and power consumption data from sensors installed in each pond. 
              Data updates every 3 seconds. Status indicators show: 🟢 Normal (&lt;15A), 🟡 Warning (15-18A), 🔴 Critical (&gt;18A).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealtimeCurrent;
