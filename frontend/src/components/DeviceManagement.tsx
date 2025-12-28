import { useState, useEffect } from 'react';
import { sensorDeviceApi, pondApi } from '../services/api';
import type { SensorDevice, Pond, DeviceType } from '../services/api';

interface PondDevice {
  pondId: number | null;
  pondName: string;
  pondColor: string;
  devices: {
    WATER_QUALITY?: SensorDevice;
    BUDGET_MANAGEMENT?: SensorDevice;
    FEEDING_MANAGEMENT?: SensorDevice;
    FISH_ANOMALY_DETECTION?: SensorDevice;
  };
}

export default function DeviceManagement() {
  const [devices, setDevices] = useState<SensorDevice[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [groupedDevices, setGroupedDevices] = useState<PondDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000); // Refresh every 2 seconds for real-time status
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Group devices by pond when devices or ponds change
    groupDevicesByPond();
  }, [devices, ponds]);

  const groupDevicesByPond = () => {
    const grouped: Map<number | null, PondDevice> = new Map();

    // Initialize with all ponds
    ponds.forEach(pond => {
      grouped.set(pond.id, {
        pondId: pond.id,
        pondName: pond.name,
        pondColor: pond.color,
        devices: {}
      });
    });

    // Add unassigned group
    grouped.set(null, {
      pondId: null,
      pondName: 'Unassigned Devices',
      pondColor: '#6B7280',
      devices: {}
    });

    // Group devices by pond and device type
    devices.forEach(device => {
      const pondId = device.pond?.id || null;
      if (!grouped.has(pondId) && pondId !== null) {
        // Pond might have been deleted
        return;
      }
      
      const group = grouped.get(pondId)!;
      if (device.deviceType) {
        group.devices[device.deviceType] = device;
      }
    });

    // Convert to array and filter out empty groups (except unassigned)
    const result = Array.from(grouped.values()).filter(group => 
      group.pondId === null || Object.keys(group.devices).length > 0
    );

    setGroupedDevices(result);
  };

  const fetchData = async () => {
    try {
      const [devicesRes, pondsRes] = await Promise.all([
        sensorDeviceApi.getAll(),
        pondApi.getAll()
      ]);

      if (devicesRes.success && devicesRes.data) {
        setDevices(devicesRes.data);
      }

      if (pondsRes.success && pondsRes.data) {
        setPonds(pondsRes.data);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch data');
    }
  };

  const handleAssignDevice = async (deviceId: string, pondId: number | null) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (pondId === null) {
        await sensorDeviceApi.unassignFromPond(deviceId);
        setSuccessMessage('Device unassigned successfully');
      } else {
        await sensorDeviceApi.assignToPond(deviceId, pondId);
        setSuccessMessage('Device assigned successfully');
      }
      
      // Wait a moment for MQTT command to reach device
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Refresh data to show updated assignment
      await fetchData();
    } catch (err) {
      console.error('Error assigning device:', err);
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to assign device');
    } finally {
      setLoading(false);
    }
  };

  const handleResetEnergy = async (deviceId: string) => {
    if (!confirm('Are you sure you want to reset the energy counter for this device?')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await sensorDeviceApi.resetEnergy(deviceId);
      setSuccessMessage('Energy counter reset successfully');
      await fetchData();
    } catch (err) {
      console.error('Error resetting energy:', err);
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to reset energy');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-gray-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    return status?.charAt(0).toUpperCase() + status?.slice(1).toLowerCase() || 'Unknown';
  };

  const formatLastSeen = (lastSeen: string) => {
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleString();
  };

  const getDeviceTypeLabel = (type: DeviceType) => {
    switch (type) {
      case 'WATER_QUALITY': return 'Water Quality Monitor';
      case 'BUDGET_MANAGEMENT': return 'Current/Voltage Monitor';
      case 'FEEDING_MANAGEMENT': return 'Feeding Controller';
      case 'FISH_ANOMALY_DETECTION': return 'Fish Anomaly Detector';
      default: return type;
    }
  };

  const getDeviceTypeIcon = (type: DeviceType) => {
    switch (type) {
      case 'WATER_QUALITY': return '💧';
      case 'BUDGET_MANAGEMENT': return '⚡';
      case 'FEEDING_MANAGEMENT': return '🍽️';
      case 'FISH_ANOMALY_DETECTION': return '🐟';
      default: return '📟';
    }
  };

  const renderDeviceModule = (deviceType: DeviceType, device?: SensorDevice, pondId?: number | null) => {
    return (
      <div className={`border rounded-lg p-4 ${device ? 'bg-white' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{getDeviceTypeIcon(deviceType)}</span>
            <div>
              <h4 className="font-semibold text-sm text-gray-800">
                {getDeviceTypeLabel(deviceType)}
              </h4>
              {device && (
                <p className="text-xs text-gray-500 truncate" title={device.deviceId}>
                  {device.deviceId}
                </p>
              )}
            </div>
          </div>
          {device && (
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(device.status)}`}></div>
              <span className="text-xs font-medium">{getStatusText(device.status)}</span>
            </div>
          )}
        </div>

        {device ? (
          <>
            {/* Device Info */}
            <div className="space-y-1 text-xs mb-3">
              <div className="flex justify-between">
                <span className="text-gray-600">IP:</span>
                <span className="font-medium">{device.ipAddress || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">RSSI:</span>
                <span className="font-medium">{device.rssi} dBm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Energy:</span>
                <span className="font-medium">{(device.energyWh / 1000).toFixed(3)} kWh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Seen:</span>
                <span className="font-medium">{formatLastSeen(device.lastSeen)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-2">
              {pondId === null && (
                <select
                  value={device.pond?.id || ''}
                  onChange={(e) => {
                    const newPondId = e.target.value ? parseInt(e.target.value) : null;
                    handleAssignDevice(device.deviceId, newPondId);
                  }}
                  disabled={loading}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Assign to Pond</option>
                  {ponds.map((pond) => (
                    <option key={pond.id} value={pond.id}>
                      {pond.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => handleResetEnergy(device.deviceId)}
                disabled={loading}
                className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-medium disabled:bg-gray-300"
                title="Reset Energy Counter"
              >
                Reset
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-6 text-gray-400 text-sm">
            No device connected
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Device Management System</h1>
      <p className="text-gray-600 mb-6">
        Each pond requires 4 ESP32 modules: Water Quality Monitor, Current/Voltage Monitor, Feeding Controller, and Fish Anomaly Detector
      </p>

      {/* Alerts */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}

      {/* Grouped Device Cards by Pond */}
      <div className="space-y-6">
        {groupedDevices.map((group) => (
          <div 
            key={group.pondId || 'unassigned'} 
            className="bg-white rounded-lg shadow-lg p-6 border-l-4"
            style={{ borderLeftColor: group.pondColor }}
          >
            {/* Pond Header */}
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                <span 
                  className="w-4 h-4 rounded-full mr-3"
                  style={{ backgroundColor: group.pondColor }}
                ></span>
                {group.pondName}
              </h2>
              {group.pondId !== null && (
                <p className="text-sm text-gray-600 mt-1">
                  Device Status: {Object.keys(group.devices).length} of 4 modules connected
                </p>
              )}
            </div>

            {/* 4 Device Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {renderDeviceModule('WATER_QUALITY', group.devices.WATER_QUALITY, group.pondId)}
              {renderDeviceModule('BUDGET_MANAGEMENT', group.devices.BUDGET_MANAGEMENT, group.pondId)}
              {renderDeviceModule('FEEDING_MANAGEMENT', group.devices.FEEDING_MANAGEMENT, group.pondId)}
              {renderDeviceModule('FISH_ANOMALY_DETECTION', group.devices.FISH_ANOMALY_DETECTION, group.pondId)}
            </div>

            {/* Unassign All Button for assigned ponds */}
            {group.pondId !== null && Object.keys(group.devices).length > 0 && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={async () => {
                    if (confirm(`Unassign all devices from ${group.pondName}?`)) {
                      setLoading(true);
                      try {
                        // Unassign devices one by one with a small delay to ensure MQTT commands are processed
                        for (const device of Object.values(group.devices)) {
                          if (device) {
                            await handleAssignDevice(device.deviceId, null);
                            // Small delay to ensure MQTT command is sent and processed
                            await new Promise(resolve => setTimeout(resolve, 500));
                          }
                        }
                      } finally {
                        setLoading(false);
                      }
                    }
                  }}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm font-medium disabled:bg-gray-300"
                >
                  Unassign All Devices
                </button>
              </div>
            )}
          </div>
        ))}

        {groupedDevices.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
            No devices or ponds available. Create ponds and connect ESP32 devices to get started.
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4">System Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {devices.filter(d => d.status === 'online').length}
            </div>
            <div className="text-sm text-gray-600">Online Devices</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {devices.filter(d => d.deviceType === 'WATER_QUALITY' && d.status === 'online').length}
            </div>
            <div className="text-sm text-gray-600">Water Quality</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600">
              {devices.filter(d => d.deviceType === 'BUDGET_MANAGEMENT' && d.status === 'online').length}
            </div>
            <div className="text-sm text-gray-600">Current/Voltage</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {devices.filter(d => d.deviceType === 'FEEDING_MANAGEMENT' && d.status === 'online').length}
            </div>
            <div className="text-sm text-gray-600">Feeding</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-pink-600">
              {devices.filter(d => d.deviceType === 'FISH_ANOMALY_DETECTION' && d.status === 'online').length}
            </div>
            <div className="text-sm text-gray-600">Fish Anomaly</div>
          </div>
        </div>
      </div>
    </div>
  );
}
