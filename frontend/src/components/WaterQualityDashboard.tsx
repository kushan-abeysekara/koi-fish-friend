import React, { useState, useEffect } from 'react';
import { sensorDataApi, pondApi, sensorDeviceApi } from '../services/api';
import type { Pond, SensorData } from '../services/api';

interface WaterParameter {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'danger';
  icon: string;
  safeRange: { min: number; max: number };
  warningRange: { min: number; max: number };
  lastUpdated: Date;
}

const WaterQualityDashboard: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [selectedPond, setSelectedPond] = useState<number | null>(null);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [latestData, setLatestData] = useState<SensorData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch only ponds with WATER_QUALITY devices assigned
  useEffect(() => {
    const fetchPondsWithWaterQualityDevices = async () => {
      try {
        // Fetch all devices
        const devicesResponse = await sensorDeviceApi.getAll();
        if (devicesResponse.success && devicesResponse.data) {
          // Filter for WATER_QUALITY devices that are assigned to ponds
          const waterQualityDevices = devicesResponse.data.filter(
            device => device.deviceType === 'WATER_QUALITY' && 
                     device.pond !== null &&
                     device.status?.toLowerCase() === 'online'
          );

          // Extract unique pond IDs
          const pondIds = [...new Set(waterQualityDevices.map(device => device.pond!.id))];

          // Fetch all ponds and filter to only those with water quality devices
          const pondsResponse = await pondApi.getAll();
          if (pondsResponse.success && pondsResponse.data) {
            const filteredPonds = pondsResponse.data.filter(pond => pondIds.includes(pond.id));
            setPonds(filteredPonds);
            
            // Auto-select first pond if none selected
            if (filteredPonds.length > 0 && !selectedPond) {
              setSelectedPond(filteredPonds[0].id);
            } else if (filteredPonds.length === 0) {
              // Clear selection if no ponds with water quality devices
              setSelectedPond(null);
            } else if (selectedPond && !pondIds.includes(selectedPond)) {
              // If currently selected pond no longer has water quality device, switch to first available
              setSelectedPond(filteredPonds[0].id);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching ponds with water quality devices:', error);
      }
    };
    fetchPondsWithWaterQualityDevices();
    
    // Refresh the list every 10 seconds to detect newly assigned devices
    const interval = setInterval(fetchPondsWithWaterQualityDevices, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch sensor data for selected pond
  useEffect(() => {
    if (!selectedPond) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await sensorDataApi.getLatestByPond(selectedPond);
        
        console.log('🔍 Water Quality API Response:', {
          success: response.success,
          message: response.message,
          hasData: !!response.data,
          data: response.data
        });
        
        if (response.success && response.data) {
          console.log('✅ Received water quality data:', {
            pondId: selectedPond,
            deviceId: response.data.device?.deviceId,
            deviceType: response.data.device?.deviceType,
            pH: response.data.phValue,
            turbidity: response.data.turbidity,
            ammonia: response.data.ammonia,
            timestamp: response.data.timestamp
          });
          
          setLatestData(response.data);
          setConnectionStatus('connected');
          setLastSync(new Date());
        } else {
          console.warn('⚠️ No water quality data available:', response.message);
          // Clear data if no sensor data available for this pond
          setLatestData(null);
          setConnectionStatus('disconnected');
        }
      } catch (error) {
        console.error('❌ Error fetching sensor data:', error);
        // Clear data on error to prevent showing stale/wrong data
        setLatestData(null);
        setConnectionStatus('disconnected');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000); // Refresh every 2 seconds for real-time updates
    return () => clearInterval(interval);
  }, [selectedPond]);

  // Check if we have real data
  const hasRealData = latestData && latestData.phValue !== undefined && latestData.phValue !== null;

  // Convert sensor data to parameter format - only when real data exists
  const parameters: WaterParameter[] = React.useMemo(() => {
    if (!hasRealData) {
      return []; // Return empty array when no real data
    }

    const getStatus = (value: number, safe: {min: number, max: number}, warning: {min: number, max: number}): 'normal' | 'warning' | 'danger' => {
      if (value >= safe.min && value <= safe.max) return 'normal';
      if (value >= warning.min && value <= warning.max) return 'warning';
      return 'danger';
    };

    const timestamp = new Date(latestData.timestamp);

    return [
      {
        id: 'turbidity',
        name: 'Turbidity',
        value: Number((latestData.turbidity || 0).toFixed(2)),
        unit: 'NTU',
        status: getStatus(latestData.turbidity || 0, { min: 0, max: 25 }, { min: 0, max: 40 }),
        icon: '💧',
        safeRange: { min: 0, max: 25 },
        warningRange: { min: 0, max: 40 },
        lastUpdated: timestamp,
      },
      {
        id: 'ph',
        name: 'pH Level',
        value: Number((latestData.phValue || 7.0).toFixed(2)),
        unit: 'pH',
        status: getStatus(latestData.phValue || 7.0, { min: 6.5, max: 8.5 }, { min: 6.0, max: 9.0 }),
        icon: '⚗️',
        safeRange: { min: 6.5, max: 8.5 },
        warningRange: { min: 6.0, max: 9.0 },
        lastUpdated: timestamp,
      },
      {
        id: 'ammonia',
        name: 'Ammonia (NH₃)',
        value: Number((latestData.ammonia || 0).toFixed(3)),
        unit: 'PPM',
        status: getStatus(latestData.ammonia || 0, { min: 0, max: 0.5 }, { min: 0, max: 1.0 }),
        icon: '⚠️',
        safeRange: { min: 0, max: 0.5 },
        warningRange: { min: 0, max: 1.0 },
        lastUpdated: timestamp,
      },
    ];
  }, [latestData, hasRealData]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'normal':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">NORMAL</span>;
      case 'warning':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">WARNING</span>;
      case 'danger':
        return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">DANGER</span>;
      default:
        return null;
    }
  };

  const getConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <span className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-green-600 font-medium">Connected</span>
          </span>
        );
      case 'reconnecting':
        return (
          <span className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
            <span className="text-yellow-600 font-medium">Reconnecting...</span>
          </span>
        );
      case 'disconnected':
        return (
          <span className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            <span className="text-red-600 font-medium">Disconnected</span>
          </span>
        );
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleString();
  };

  const getProgressPercentage = (value: number, min: number, max: number) => {
    return Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
  };

  return (
    <div className="space-y-6">
      {/* Header with Pond Selection and Status */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">🌊</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Water Quality Monitor</h2>
              <p className="text-sm text-gray-500">Real-time monitoring and alerts</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={selectedPond || ''}
              onChange={(e) => setSelectedPond(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
              disabled={ponds.length === 0}
            >
              {ponds.length === 0 ? (
                <option value="">No water quality sensors assigned</option>
              ) : (
                ponds.map(pond => (
                  <option key={pond.id} value={pond.id}>
                    {pond.name}
                  </option>
                ))
              )}
            </select>
            {getConnectionStatusBadge()}
            {loading && (
              <span className="text-sm text-gray-500">Loading...</span>
            )}
          </div>
        </div>
      </div>

      {/* Last Sync Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
        <i className="fas fa-info-circle text-blue-600 text-xl"></i>
        <div>
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Last updated:</span> {formatTimestamp(lastSync)}
          </p>
          <p className="text-xs text-blue-600 mt-1">Data refreshes automatically every 2 seconds (real-time)</p>
        </div>
      </div>

      {/* Water Quality Parameter Cards */}
      {!hasRealData ? (
        <div className="bg-white rounded-xl shadow-sm p-12 border-2 border-dashed border-gray-300 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
              <i className="fas fa-plug-circle-xmark text-4xl text-gray-400"></i>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Sensor Data Available</h3>
              <p className="text-gray-500 mb-1">
                {selectedPond 
                  ? 'Water quality sensor is not connected or not sending data' 
                  : ponds.length === 0
                    ? 'No ponds have a water quality sensor assigned yet'
                    : 'Please select a pond to view water quality data'}
              </p>
              <p className="text-sm text-gray-400">
                {ponds.length === 0 
                  ? 'Assign a WATER_QUALITY device to a pond in Device Management'
                  : 'Make sure the ESP32 device is powered on and connected to WiFi'}
              </p>
            </div>
            <div className="flex gap-3 mt-4">
              <button className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium transition-colors">
                <i className="fas fa-sync-alt mr-2"></i>Retry Connection
              </button>
              <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
                <i className="fas fa-book mr-2"></i>Troubleshooting Guide
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {parameters.map((param) => (
          <div
            key={param.id}
            className={`bg-white rounded-xl shadow-sm border-2 p-6 transition-all duration-300 hover:shadow-lg ${
              param.status === 'normal' ? 'border-gray-200' : 
              param.status === 'warning' ? 'border-yellow-300' : 
              'border-red-300'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-4xl">{param.icon}</div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-lg">{param.name}</h3>
                  <p className="text-xs text-gray-500">{formatTimestamp(param.lastUpdated)}</p>
                </div>
              </div>
              {getStatusBadge(param.status)}
            </div>

            {/* Value Display */}
            <div className="mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-gray-800">
                  {param.id === 'ammonia' ? param.value.toFixed(3) : param.value.toFixed(2)}
                </span>
                <span className="text-lg text-gray-600">{param.unit}</span>
              </div>
            </div>

            {/* Safe Range Indicator */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Min: {param.safeRange.min}</span>
                <span>Max: {param.safeRange.max}</span>
              </div>
              <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                {/* Safe zone (green) */}
                <div
                  className="absolute h-full bg-green-200"
                  style={{
                    left: `${getProgressPercentage(param.safeRange.min, param.warningRange.min, param.warningRange.max)}%`,
                    width: `${
                      getProgressPercentage(param.safeRange.max, param.warningRange.min, param.warningRange.max) -
                      getProgressPercentage(param.safeRange.min, param.warningRange.min, param.warningRange.max)
                    }%`,
                  }}
                />
                {/* Current value indicator */}
                <div
                  className={`absolute h-full w-1 ${
                    param.status === 'normal' ? 'bg-green-600' : 
                    param.status === 'warning' ? 'bg-yellow-600' : 
                    'bg-red-600'
                  }`}
                  style={{
                    left: `${getProgressPercentage(param.value, param.warningRange.min, param.warningRange.max)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center">
                Safe Range: {param.safeRange.min} - {param.safeRange.max} {param.unit}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
              <button className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors">
                <i className="fas fa-chart-line mr-1"></i> View Trend
              </button>
              <button className="flex-1 px-3 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs font-medium transition-colors">
                <i className="fas fa-flask mr-1"></i> Log Treatment
              </button>
            </div>
          </div>
          ))}
        </div>
      )}

      {/* Quick Actions Panel */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <i className="fas fa-bolt text-cyan-500"></i> Quick Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 rounded-lg border border-blue-200 transition-all">
            <i className="fas fa-plus-circle text-2xl text-blue-600"></i>
            <span className="text-sm font-medium text-gray-700">Add Treatment</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-lg border border-purple-200 transition-all">
            <i className="fas fa-wrench text-2xl text-purple-600"></i>
            <span className="text-sm font-medium text-gray-700">Calibrate Sensors</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 rounded-lg border border-green-200 transition-all">
            <i className="fas fa-file-export text-2xl text-green-600"></i>
            <span className="text-sm font-medium text-gray-700">Export Report</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-orange-50 to-yellow-50 hover:from-orange-100 hover:to-yellow-100 rounded-lg border border-orange-200 transition-all">
            <i className="fas fa-bell text-2xl text-orange-600"></i>
            <span className="text-sm font-medium text-gray-700">View Alerts</span>
          </button>
        </div>
      </div>

      {/* Status Summary - Only show when data is available */}
      {hasRealData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-check-circle text-2xl text-green-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-600">Normal Parameters</p>
                <p className="text-2xl font-bold text-gray-800">
                  {parameters.filter(p => p.status === 'normal').length}/{parameters.length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-exclamation-triangle text-2xl text-yellow-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-600">Warnings</p>
                <p className="text-2xl font-bold text-gray-800">
                  {parameters.filter(p => p.status === 'warning').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-exclamation-circle text-2xl text-red-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-600">Critical Alerts</p>
                <p className="text-2xl font-bold text-gray-800">
                  {parameters.filter(p => p.status === 'danger').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaterQualityDashboard;
