import { useState, useEffect } from 'react';
import { sensorDeviceApi, pondApi } from '../services/api';
import type { SensorDevice, Pond } from '../services/api';

export default function DeviceManagement() {
  const [devices, setDevices] = useState<SensorDevice[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

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
        // Check if pond already has an ONLINE device assigned
        const existingOnlineDevice = devices.find(
          d => d.pond?.id === pondId && d.status === 'online' && d.deviceId !== deviceId
        );
        if (existingOnlineDevice) {
          setError(`Pond already has online device ${existingOnlineDevice.deviceId} assigned. Only one online device per pond is allowed.`);
          setLoading(false);
          return;
        }

        await sensorDeviceApi.assignToPond(deviceId, pondId);
        setSuccessMessage('Device assigned successfully');
      }
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

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">ESP32 Device Management</h1>

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

      {/* Device Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.filter(d => d.status === 'online').length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No online devices. Devices will appear here when they are online and connected to MQTT.
          </div>
        ) : (
          devices.filter(device => device.status === 'online').map((device) => (
            <div key={device.id} className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
              {/* Device Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(device.status)}`}></div>
                  <span className="text-sm font-medium text-gray-600">
                    {getStatusText(device.status)}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {formatLastSeen(device.lastSeen)}
                </span>
              </div>

              {/* Device ID */}
              <h3 className="text-lg font-semibold mb-2 text-gray-800 truncate" title={device.deviceId}>
                {device.deviceId}
              </h3>

              {/* Device Info */}
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">IP Address:</span>
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
              </div>

              {/* Pond Assignment */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign to Pond:
                </label>
                <select
                  value={device.pond?.id || ''}
                  onChange={(e) => {
                    const pondId = e.target.value ? parseInt(e.target.value) : null;
                    handleAssignDevice(device.deviceId, pondId);
                  }}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Unassigned</option>
                  {ponds.map((pond) => (
                    <option 
                      key={pond.id} 
                      value={pond.id}
                    >
                      {pond.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Assignment Display */}
              {device.pond && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-3">
                  <div className="text-xs text-blue-600 font-medium mb-1">Currently Assigned:</div>
                  <div className="text-sm font-semibold text-blue-800">{device.pond.name}</div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2">
                <button
                  onClick={() => handleResetEnergy(device.deviceId)}
                  disabled={loading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                >
                  Reset Energy
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4">System Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{devices.filter(d => d.status === 'online').length}</div>
            <div className="text-sm text-gray-600">Online Devices</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {devices.filter(d => d.pond !== null && d.status === 'online').length}
            </div>
            <div className="text-sm text-gray-600">Assigned</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">
              {devices.filter(d => d.pond === null && d.status === 'online').length}
            </div>
            <div className="text-sm text-gray-600">Unassigned</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-600">
              {devices.filter(d => d.status === 'offline').length}
            </div>
            <div className="text-sm text-gray-600">Offline (Hidden)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
