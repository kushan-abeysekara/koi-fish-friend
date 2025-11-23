import React, { useState, useEffect } from 'react';
import { pondApi } from '../services/api';

interface PowerConsumption {
  id: string;
  pondId: number;
  pondName: string;
  currentKwh: number;
  todayKwh: number;
  weekKwh: number;
  monthKwh: number;
  cost: number;
  averagePower: number;
  peakPower: number;
  lastUpdated: string;
}

interface Pond {
  id: number;
  name: string;
  color: string;
}

const CalculateKwh: React.FC = () => {
  const [consumptionData, setConsumptionData] = useState<PowerConsumption[]>([]);
  const [selectedPond, setSelectedPond] = useState<number | 'all'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [electricityRate, setElectricityRate] = useState(25); // LKR per kWh
  const [ponds, setPonds] = useState<Pond[]>([]);

  // Load ponds from API on mount
  useEffect(() => {
    loadPonds();
  }, []);

  const loadPonds = async () => {
    try {
      const response = await pondApi.getAll();
      if (response.success && response.data) {
        setPonds(response.data);
      }
    } catch (error) {
      console.error('Error loading ponds:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      alert('Failed to load ponds: ' + errorMessage);
    }
  };

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

  // Simulate sensor data for power consumption
  useEffect(() => {
    if (ponds.length === 0) return;

    const generateMockConsumption = (): PowerConsumption[] => {
      return ponds.map((pond) => {
        const currentKwh = parseFloat((Math.random() * 2 + 1).toFixed(3)); // 1-3 kWh
        const todayKwh = parseFloat((Math.random() * 20 + 40).toFixed(2)); // 40-60 kWh
        const weekKwh = parseFloat((todayKwh * 7).toFixed(2));
        const monthKwh = parseFloat((todayKwh * 30).toFixed(2));
        const cost = parseFloat((monthKwh * electricityRate).toFixed(2));
        const averagePower = parseFloat((Math.random() * 2 + 2).toFixed(2)); // 2-4 kW
        const peakPower = parseFloat((averagePower * 1.5).toFixed(2));

        return {
          id: `consumption-${pond.id}`,
          pondId: pond.id,
          pondName: pond.name,
          currentKwh,
          todayKwh,
          weekKwh,
          monthKwh,
          cost,
          averagePower,
          peakPower,
          lastUpdated: new Date().toLocaleString(),
        };
      });
    };

    setConsumptionData(generateMockConsumption());

    const interval = setInterval(() => {
      setConsumptionData(generateMockConsumption());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [electricityRate, ponds]);

  const getFilteredData = () => {
    if (selectedPond === 'all') {
      return consumptionData;
    }
    return consumptionData.filter(data => data.pondId === selectedPond);
  };

  const getTotalKwh = () => {
    const filtered = getFilteredData();
    switch (selectedPeriod) {
      case 'today':
        return filtered.reduce((sum, data) => sum + data.todayKwh, 0).toFixed(2);
      case 'week':
        return filtered.reduce((sum, data) => sum + data.weekKwh, 0).toFixed(2);
      case 'month':
        return filtered.reduce((sum, data) => sum + data.monthKwh, 0).toFixed(2);
      default:
        return '0.00';
    }
  };

  const getTotalCost = () => {
    return getFilteredData().reduce((sum, data) => sum + data.cost, 0).toFixed(2);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-green-500 to-teal-600 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <span>📊</span> Power Consumption Calculator
            </h2>
            <p className="text-green-100">Calculate kWh usage and electricity costs for your ponds</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-green-200">Total Cost (This Month)</p>
            <p className="text-4xl font-bold">{formatCurrency(parseFloat(getTotalCost()))}</p>
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
                  ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-lg'
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

          {/* Period Filter */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setSelectedPeriod('today')}
              className={`px-4 py-2 rounded-md font-semibold transition-all text-sm ${
                selectedPeriod === 'today'
                  ? 'bg-white text-green-600 shadow-md'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setSelectedPeriod('week')}
              className={`px-4 py-2 rounded-md font-semibold transition-all text-sm ${
                selectedPeriod === 'week'
                  ? 'bg-white text-green-600 shadow-md'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setSelectedPeriod('month')}
              className={`px-4 py-2 rounded-md font-semibold transition-all text-sm ${
                selectedPeriod === 'month'
                  ? 'bg-white text-green-600 shadow-md'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Electricity Rate Setting */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <i className="fas fa-dollar-sign text-green-600"></i>
              Electricity Rate
            </h3>
            <p className="text-sm text-gray-500">Set your current electricity rate per kWh</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-700">Rate:</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">
                Rs
              </span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={electricityRate}
                onChange={(e) => setElectricityRate(parseFloat(e.target.value) || 0)}
                className="w-32 pl-10 pr-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                / kWh
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-3xl">⚡</span>
            <i className="fas fa-chart-line text-2xl opacity-50"></i>
          </div>
          <h3 className="text-sm font-semibold mb-1 opacity-90">Total Consumption</h3>
          <p className="text-2xl font-bold">{getTotalKwh()} kWh</p>
          <p className="text-xs opacity-75 mt-1">
            {selectedPeriod === 'today' ? 'Today' : selectedPeriod === 'week' ? 'This Week' : 'This Month'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-3xl">💰</span>
            <i className="fas fa-money-bill-wave text-2xl opacity-50"></i>
          </div>
          <h3 className="text-sm font-semibold mb-1 opacity-90">Monthly Cost</h3>
          <p className="text-2xl font-bold">{formatCurrency(parseFloat(getTotalCost()))}</p>
          <p className="text-xs opacity-75 mt-1">Based on current rate</p>
        </div>

        <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-3xl">🏞️</span>
            <i className="fas fa-water text-2xl opacity-50"></i>
          </div>
          <h3 className="text-sm font-semibold mb-1 opacity-90">Active Ponds</h3>
          <p className="text-2xl font-bold">{getFilteredData().length}</p>
          <p className="text-xs opacity-75 mt-1">Monitoring</p>
        </div>

        <div className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-3xl">📈</span>
            <i className="fas fa-bolt text-2xl opacity-50"></i>
          </div>
          <h3 className="text-sm font-semibold mb-1 opacity-90">Avg per Pond</h3>
          <p className="text-2xl font-bold">
            {getFilteredData().length > 0 
              ? (parseFloat(getTotalKwh()) / getFilteredData().length).toFixed(2)
              : '0.00'} kWh
          </p>
          <p className="text-xs opacity-75 mt-1">
            {selectedPeriod === 'today' ? 'Today' : selectedPeriod === 'week' ? 'This Week' : 'This Month'}
          </p>
        </div>
      </div>

      {/* Consumption Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i className="fas fa-table text-green-600"></i>
          Power Consumption Details
        </h3>

        {getFilteredData().length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-gray-500 text-lg mb-2">No consumption data available</p>
            <p className="text-gray-400">Waiting for sensor data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Pond</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Today (kWh)</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Week (kWh)</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Month (kWh)</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Avg Power</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Peak Power</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Monthly Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getFilteredData().map((data) => {
                  const pond = ponds.find(p => p.id === data.pondId);
                  const pondColorClasses = pond ? pondColors[pond.color] : pondColors.blue;
                  
                  return (
                    <tr key={data.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${pondColorClasses.bg} ${pondColorClasses.text}`}>
                          <i className="fas fa-water"></i>
                          {data.pondName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-semibold text-gray-800">
                        {data.todayKwh}
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-semibold text-gray-800">
                        {data.weekKwh}
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-semibold text-gray-800">
                        {data.monthKwh}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600">
                        {data.averagePower} kW
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600">
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-semibold">
                          {data.peakPower} kW
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-green-600">
                        {formatCurrency(data.cost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-green-50 border-t-2 border-green-200">
                <tr>
                  <td className="px-6 py-4 text-left font-bold text-gray-800">TOTAL</td>
                  <td className="px-6 py-4 text-center font-bold text-gray-800">
                    {getFilteredData().reduce((sum, d) => sum + d.todayKwh, 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-gray-800">
                    {getFilteredData().reduce((sum, d) => sum + d.weekKwh, 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-gray-800">
                    {getFilteredData().reduce((sum, d) => sum + d.monthKwh, 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">-</td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">-</td>
                  <td className="px-6 py-4 text-right font-bold text-green-700 text-lg">
                    {formatCurrency(parseFloat(getTotalCost()))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Info Note */}
      <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
        <div className="flex items-start gap-3">
          <i className="fas fa-info-circle text-green-500 text-xl mt-0.5"></i>
          <div className="text-sm text-green-800">
            <p className="font-semibold mb-1">About Power Consumption Calculation</p>
            <p>
              This dashboard calculates electrical power consumption (kWh) and costs based on real-time sensor data from each pond. 
              The data includes current consumption, historical trends (daily, weekly, monthly), average and peak power usage. 
              Update the electricity rate to get accurate cost calculations for your region.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculateKwh;
