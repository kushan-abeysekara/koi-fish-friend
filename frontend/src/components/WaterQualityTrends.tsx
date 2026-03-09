import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
  Scatter,
} from 'recharts';

interface DataPoint {
  timestamp: string;
  value: number;
  status: 'normal' | 'warning' | 'danger';
}

interface Event {
  id: string;
  timestamp: Date;
  type: 'feeding' | 'treatment' | 'maintenance';
  description: string;
  parameter?: string;
}

interface ParameterConfig {
  id: string;
  name: string;
  unit: string;
  color: string;
  safeRange: { min: number; max: number };
}

type TimeRange = '1h' | '24h' | '7d' | 'custom';

const WaterQualityTrends: React.FC = () => {
  const location = useLocation();
  const [selectedParameter, setSelectedParameter] = useState<string>(
    (location.state as { parameter?: string } | null)?.parameter || 'turbidity'
  );
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [showEvents, setShowEvents] = useState(true);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const parameters: ParameterConfig[] = [
    { id: 'turbidity', name: 'Turbidity', unit: 'NTU', color: '#3b82f6', safeRange: { min: 0, max: 25 } },
    { id: 'ph', name: 'pH Level', unit: 'pH', color: '#8b5cf6', safeRange: { min: 6.5, max: 8.5 } },
    { id: 'temperature', name: 'Temperature', unit: '°C', color: '#ef4444', safeRange: { min: 15, max: 28 } },
    { id: 'do', name: 'Dissolved Oxygen', unit: 'mg/L', color: '#10b981', safeRange: { min: 6, max: 12 } },
    { id: 'co2', name: 'CO₂ Level', unit: 'PPM', color: '#f59e0b', safeRange: { min: 400, max: 1000 } },
    { id: 'ammonia', name: 'Ammonia (NH₃)', unit: 'PPM', color: '#f97316', safeRange: { min: 0, max: 0.5 } },
    { id: 'aqi', name: 'Air Quality Index', unit: 'AQI', color: '#6366f1', safeRange: { min: 0, max: 100 } },
  ];

  // Generate mock historical data
  const generateHistoricalData = (paramId: string, hours: number): DataPoint[] => {
    const data: DataPoint[] = [];
    const now = new Date();
    const param = parameters.find(p => p.id === paramId);
    if (!param) return data;

    const pointsCount = hours <= 1 ? 60 : hours <= 24 ? 144 : 168;
    const intervalMinutes = (hours * 60) / pointsCount;

    for (let i = pointsCount; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * intervalMinutes * 60000);
      const midPoint = (param.safeRange.min + param.safeRange.max) / 2;
      const range = (param.safeRange.max - param.safeRange.min) / 2;
      
      // Add some variation and occasional spikes
      const variation = (Math.random() - 0.5) * range * 0.6;
      const spike = Math.random() > 0.95 ? (Math.random() - 0.5) * range * 0.8 : 0;
      let value = midPoint + variation + spike;

      // Determine status
      let status: 'normal' | 'warning' | 'danger' = 'normal';
      if (value < param.safeRange.min * 0.9 || value > param.safeRange.max * 1.1) {
        status = 'danger';
      } else if (value < param.safeRange.min || value > param.safeRange.max) {
        status = 'warning';
      }

      data.push({
        timestamp: timestamp.toISOString(),
        value: Number(value.toFixed(2)),
        status,
      });
    }
    return data;
  };

  // Generate mock events
  const generateEvents = (hours: number): Event[] => {
    const events: Event[] = [];
    const now = new Date();
    const eventCount = Math.floor(hours / 8);

    const eventTypes: Array<{ type: 'feeding' | 'treatment' | 'maintenance'; descriptions: string[] }> = [
      { type: 'feeding', descriptions: ['Morning feeding', 'Evening feeding', 'Supplemental feeding'] },
      { type: 'treatment', descriptions: ['Water conditioner added', 'pH adjuster applied', 'Algae treatment'] },
      { type: 'maintenance', descriptions: ['Filter cleaned', 'Water change 30%', 'Pump maintenance'] },
    ];

    for (let i = 0; i < eventCount; i++) {
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const description = eventType.descriptions[Math.floor(Math.random() * eventType.descriptions.length)];
      const timestamp = new Date(now.getTime() - Math.random() * hours * 3600000);

      events.push({
        id: `event-${i}`,
        timestamp,
        type: eventType.type,
        description,
      });
    }

    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  };

  const getHoursFromRange = (range: TimeRange): number => {
    switch (range) {
      case '1h':
        return 1;
      case '24h':
        return 24;
      case '7d':
        return 168;
      case 'custom':
        return 24; // Default
      default:
        return 24;
    }
  };

  const [chartData, setChartData] = useState<DataPoint[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    const hours = getHoursFromRange(timeRange);
    setChartData(generateHistoricalData(selectedParameter, hours));
    setEvents(generateEvents(hours));
  }, [selectedParameter, timeRange]);

  const currentParam = parameters.find(p => p.id === selectedParameter);

  const formatXAxis = (timestamp: string) => {
    const date = new Date(timestamp);
    if (timeRange === '1h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (timeRange === '24h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'feeding':
        return '🍽️';
      case 'treatment':
        return '💊';
      case 'maintenance':
        return '🔧';
      default:
        return '📌';
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'feeding':
        return 'border-blue-500 bg-blue-50 text-blue-700';
      case 'treatment':
        return 'border-purple-500 bg-purple-50 text-purple-700';
      case 'maintenance':
        return 'border-orange-500 bg-orange-50 text-orange-700';
      default:
        return 'border-gray-500 bg-gray-50 text-gray-700';
    }
  };

  // Prepare event markers for chart
  const eventMarkers = events.map(event => ({
    timestamp: event.timestamp.toISOString(),
    value: currentParam ? (currentParam.safeRange.min + currentParam.safeRange.max) / 2 : 0,
    type: event.type,
  }));

  const downloadData = (format: 'csv' | 'json') => {
    if (format === 'csv') {
      const headers = ['Timestamp', 'Value', 'Status'];
      const rows = chartData.map(d => [d.timestamp, d.value, d.status]);
      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedParameter}_${timeRange}_data.csv`;
      a.click();
    } else {
      const json = JSON.stringify(chartData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedParameter}_${timeRange}_data.json`;
      a.click();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">📊</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Trends & History</h2>
              <p className="text-sm text-gray-500">Historical water quality data with event markers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Parameter Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="fas fa-flask mr-2"></i>Parameter
            </label>
            <select
              value={selectedParameter}
              onChange={(e) => setSelectedParameter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {parameters.map(param => (
                <option key={param.id} value={param.id}>{param.name}</option>
              ))}
            </select>
          </div>

          {/* Time Range Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="fas fa-clock mr-2"></i>Time Range
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="1h">Last 1 Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Show Events Toggle */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="fas fa-calendar-alt mr-2"></i>Display Options
            </label>
            <button
              onClick={() => setShowEvents(!showEvents)}
              className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                showEvents
                  ? 'bg-purple-500 text-white hover:bg-purple-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {showEvents ? 'Hide Events' : 'Show Events'}
            </button>
          </div>

          {/* Export Data */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="fas fa-download mr-2"></i>Export Data
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => downloadData('csv')}
                className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
              >
                CSV
              </button>
              <button
                onClick={() => downloadData('json')}
                className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
              >
                JSON
              </button>
            </div>
          </div>
        </div>

        {/* Custom Date Range (shown when custom is selected) */}
        {timeRange === 'custom' && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="datetime-local"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="datetime-local"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">
            {currentParam?.name} Over Time
          </h3>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-200 rounded"></div>
              <span className="text-gray-600">Safe Range</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3" style={{ backgroundColor: currentParam?.color }}></div>
              <span className="text-gray-600">Current Value</span>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id="safeZone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#86efac" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#86efac" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatXAxis}
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
              label={{ value: currentParam?.unit || '', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
              }}
              labelFormatter={(label) => new Date(label).toLocaleString()}
              formatter={(value: number | undefined) => [`${value} ${currentParam?.unit}`, 'Value']}
            />
            <Legend />

            {/* Safe range zone */}
            <Area
              type="monotone"
              dataKey={() => currentParam?.safeRange.max}
              fill="url(#safeZone)"
              stroke="none"
              name="Safe Zone"
            />
            <ReferenceLine
              y={currentParam?.safeRange.min}
              stroke="#10b981"
              strokeDasharray="5 5"
              label={{ value: 'Min Safe', position: 'insideBottomLeft', fill: '#10b981' }}
            />
            <ReferenceLine
              y={currentParam?.safeRange.max}
              stroke="#10b981"
              strokeDasharray="5 5"
              label={{ value: 'Max Safe', position: 'insideTopLeft', fill: '#10b981' }}
            />

            {/* Main data line */}
            <Line
              type="monotone"
              dataKey="value"
              stroke={currentParam?.color}
              strokeWidth={2}
              dot={false}
              name={currentParam?.name}
            />

            {/* Event markers */}
            {showEvents && (
              <Scatter
                data={eventMarkers}
                dataKey="value"
                fill="#f59e0b"
                shape="star"
                name="Events"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Statistics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-chart-line text-blue-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">Average</p>
              <p className="text-xl font-bold text-gray-800">
                {(chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length).toFixed(2)} {currentParam?.unit}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-arrow-up text-green-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">Maximum</p>
              <p className="text-xl font-bold text-gray-800">
                {Math.max(...chartData.map(d => d.value)).toFixed(2)} {currentParam?.unit}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-arrow-down text-red-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">Minimum</p>
              <p className="text-xl font-bold text-gray-800">
                {Math.min(...chartData.map(d => d.value)).toFixed(2)} {currentParam?.unit}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-percent text-purple-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">In Safe Range</p>
              <p className="text-xl font-bold text-gray-800">
                {((chartData.filter(d => d.status === 'normal').length / chartData.length) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Events Timeline */}
      {showEvents && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <i className="fas fa-calendar-alt text-purple-500"></i>
            Event Timeline
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No events recorded in this time range</p>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border-l-4 ${getEventColor(event.type)}`}
                >
                  <div className="text-2xl">{getEventIcon(event.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-800 capitalize">{event.type}</span>
                      <span className="text-xs text-gray-500">
                        {event.timestamp.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{event.description}</p>
                  </div>
                  <button className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    View Details
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WaterQualityTrends;
