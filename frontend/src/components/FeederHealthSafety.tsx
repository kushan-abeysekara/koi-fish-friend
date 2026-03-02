import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface StatusIndicator {
  id: string;
  name: string;
  status: 'OK' | 'Warning' | 'Critical';
  value: string;
  icon: string;
  color: string;
}

interface DeviceStatus {
  hopperLevel?: number;
  hopperCapacity?: number;
  hopperPercentage?: number;
  plateSpeed?: number;
  motorStatus?: string;
  feedingActive?: boolean;
  connected?: boolean;
}

interface SafetyEvent {
  id: string;
  dateTime: string;
  pond: string;
  eventType: 'Low Battery' | 'Hopper Empty' | 'Motor Jam' | 'Connection Lost' | 'System Normal';
  severity: 'Info' | 'Warning' | 'Critical';
  description: string;
  resolved: boolean;
}

const FeederHealthSafety: React.FC = () => {
  const [selectedPond, setSelectedPond] = useState<'Pond A' | 'Pond B'>('Pond A');
  const [deviceId] = useState('feed_device_001');
  const [, setDeviceStatus] = useState<DeviceStatus>({});
  const [statusIndicators, setStatusIndicators] = useState<Record<string, StatusIndicator[]>>({});

  // Fetch device status every 3 seconds for real-time updates
  useEffect(() => {
    const fetchDeviceStatus = async () => {
      try {
        const response = await api.get(`/sensors/device/${deviceId}`);
        if (response.data.success && response.data.data) {
          const device = response.data.data;
          const isOnline = device.status === 'online';
          
          setDeviceStatus({
            hopperLevel: device.hopperLevel || 0,
            hopperCapacity: device.hopperCapacity || 20000,
            hopperPercentage: device.hopperPercentage || 0,
            plateSpeed: device.plateSpeed || 0,
            motorStatus: device.motorStatus || 'STOPPED',
            feedingActive: device.feedingActive || false,
            connected: isOnline
          });

          // Update status indicators with real data
          const hopperKg = (device.hopperLevel || 0) / 1000;
          const hopperPercent = device.hopperPercentage || 0;
          
          const indicators: StatusIndicator[] = [
            {
              id: '1',
              name: 'Hopper Feed Level',
              status: isOnline ? (hopperPercent > 30 ? 'OK' : hopperPercent > 10 ? 'Warning' : 'Critical') : 'Critical',
              value: isOnline ? `${hopperKg.toFixed(2)} kg (${hopperPercent.toFixed(1)}%)` : 'Offline',
              icon: 'fa-box',
              color: isOnline ? (hopperPercent > 30 ? 'green' : hopperPercent > 10 ? 'yellow' : 'red') : 'gray',
            },
            {
              id: '2',
              name: 'Connection',
              status: isOnline ? 'OK' : 'Critical',
              value: isOnline ? 'Online' : 'Offline',
              icon: 'fa-wifi',
              color: isOnline ? 'green' : 'red',
            },
            {
              id: '3',
              name: 'Plate Speed',
              status: isOnline ? 'OK' : 'Critical',
              value: isOnline ? `${(device.plateSpeed || 0).toFixed(0)} RPM` : 'Offline',
              icon: 'fa-tachometer-alt',
              color: isOnline ? 'green' : 'gray',
            },
            {
              id: '4',
              name: 'Motor Status (NEMA17)',
              status: isOnline ? (device.motorStatus === 'RUNNING' ? 'OK' : 'OK') : 'Critical',
              value: isOnline ? (device.motorStatus || 'STOPPED') : 'Offline',
              icon: 'fa-cog',
              color: isOnline ? (device.motorStatus === 'RUNNING' ? 'blue' : 'green') : 'gray',
            },
            {
              id: '5',
              name: 'Feeding Status',
              status: isOnline ? (device.feedingActive ? 'OK' : 'OK') : 'Critical',
              value: isOnline ? (device.feedingActive ? 'Active' : 'Idle') : 'Offline',
              icon: 'fa-fish',
              color: isOnline ? (device.feedingActive ? 'blue' : 'green') : 'gray',
            },
            {
              id: '6',
              name: 'Temperature',
              status: 'OK',
              value: '24°C',
              icon: 'fa-thermometer-half',
              color: 'green',
            },
          ];

          setStatusIndicators(prev => ({
            ...prev,
            [selectedPond]: indicators
          }));
        } else {
          // Handle case when device data is not available
          const offlineIndicators: StatusIndicator[] = [
            { id: '1', name: 'Hopper Feed Level', status: 'Critical', value: 'Offline', icon: 'fa-box', color: 'gray' },
            { id: '2', name: 'Connection', status: 'Critical', value: 'Offline', icon: 'fa-wifi', color: 'red' },
            { id: '3', name: 'Plate Speed', status: 'Critical', value: 'Offline', icon: 'fa-tachometer-alt', color: 'gray' },
            { id: '4', name: 'Motor Status (NEMA17)', status: 'Critical', value: 'Offline', icon: 'fa-cog', color: 'gray' },
            { id: '5', name: 'Feeding Status', status: 'Critical', value: 'Offline', icon: 'fa-fish', color: 'gray' },
            { id: '6', name: 'Temperature', status: 'OK', value: '24°C', icon: 'fa-thermometer-half', color: 'green' },
          ];
          setStatusIndicators(prev => ({ ...prev, [selectedPond]: offlineIndicators }));
        }
      } catch (error) {
        console.error('Failed to fetch device status:', error);
        // Set offline indicators on error
        const offlineIndicators: StatusIndicator[] = [
          { id: '1', name: 'Hopper Feed Level', status: 'Critical', value: 'Offline', icon: 'fa-box', color: 'gray' },
          { id: '2', name: 'Connection', status: 'Critical', value: 'Offline', icon: 'fa-wifi', color: 'red' },
          { id: '3', name: 'Plate Speed', status: 'Critical', value: 'Offline', icon: 'fa-tachometer-alt', color: 'gray' },
          { id: '4', name: 'Motor Status (NEMA17)', status: 'Critical', value: 'Offline', icon: 'fa-cog', color: 'gray' },
          { id: '5', name: 'Feeding Status', status: 'Critical', value: 'Offline', icon: 'fa-fish', color: 'gray' },
          { id: '6', name: 'Temperature', status: 'OK', value: '24°C', icon: 'fa-thermometer-half', color: 'green' },
        ];
        setStatusIndicators(prev => ({ ...prev, [selectedPond]: offlineIndicators }));
      }
    };

    fetchDeviceStatus();
    const interval = setInterval(fetchDeviceStatus, 3000); // Update every 3 seconds
    return () => clearInterval(interval);
  }, [deviceId, selectedPond]);

  // Mock safety events history
  const [safetyEvents] = useState<SafetyEvent[]>([
    {
      id: '1',
      dateTime: '2025-12-25 14:30',
      pond: 'Pond B',
      eventType: 'Hopper Empty',
      severity: 'Critical',
      description: 'Hopper feed level below 5 kg threshold. Feeding paused automatically.',
      resolved: false,
    },
    {
      id: '2',
      dateTime: '2025-12-25 13:45',
      pond: 'Pond B',
      eventType: 'Low Battery',
      severity: 'Warning',
      description: 'Battery level at 18%. Please recharge soon.',
      resolved: false,
    },
    {
      id: '3',
      dateTime: '2025-12-24 16:20',
      pond: 'Pond A',
      eventType: 'Motor Jam',
      severity: 'Critical',
      description: 'Motor jam detected. Emergency stop activated.',
      resolved: true,
    },
    {
      id: '4',
      dateTime: '2025-12-24 09:15',
      pond: 'Pond B',
      eventType: 'Connection Lost',
      severity: 'Critical',
      description: 'Lost connection to feeder for 5 minutes. Connection restored.',
      resolved: true,
    },
    {
      id: '5',
      dateTime: '2025-12-23 18:30',
      pond: 'Pond A',
      eventType: 'System Normal',
      severity: 'Info',
      description: 'All systems operational. Daily health check passed.',
      resolved: true,
    },
    {
      id: '6',
      dateTime: '2025-12-23 11:00',
      pond: 'Pond A',
      eventType: 'Low Battery',
      severity: 'Warning',
      description: 'Battery level at 22%. Charging recommended.',
      resolved: true,
    },
  ]);

  const currentIndicators = statusIndicators[selectedPond] || [];

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'OK':
        return 'from-green-50 to-green-100 border-green-200';
      case 'Warning':
        return 'from-yellow-50 to-yellow-100 border-yellow-200';
      case 'Critical':
        return 'from-red-50 to-red-100 border-red-200';
      default:
        return 'from-gray-50 to-gray-100 border-gray-200';
    }
  };

  const getStatusIconColor = (color: string) => {
    switch (color) {
      case 'green':
        return 'bg-green-500';
      case 'yellow':
        return 'bg-yellow-500';
      case 'red':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Info':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Warning':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Critical':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const activeAlerts = safetyEvents.filter((event) => !event.resolved && event.pond === selectedPond);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-3xl">🛡️</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Feeder Health & Safety</h2>
            <p className="text-sm text-gray-500">Monitor feeder status and safety alerts</p>
          </div>
        </div>
      </div>

      {/* Pond Selector */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <i className="fas fa-water text-cyan-500"></i>
          Select Pond
        </h3>
        <div className="flex gap-4">
          <button
            onClick={() => setSelectedPond('Pond A')}
            className={`flex-1 py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
              selectedPond === 'Pond A'
                ? 'bg-cyan-500 text-white shadow-lg scale-105'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-water mr-2"></i>
            Pond A
          </button>
          <button
            onClick={() => setSelectedPond('Pond B')}
            className={`flex-1 py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
              selectedPond === 'Pond B'
                ? 'bg-cyan-500 text-white shadow-lg scale-105'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-water mr-2"></i>
            Pond B
          </button>
        </div>
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="space-y-3">
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-lg p-4 border-l-4 ${
                alert.severity === 'Critical'
                  ? 'bg-red-50 border-red-500'
                  : 'bg-yellow-50 border-yellow-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <i
                  className={`fas fa-exclamation-triangle text-2xl mt-1 ${
                    alert.severity === 'Critical' ? 'text-red-600' : 'text-yellow-600'
                  }`}
                ></i>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className={`font-semibold mb-1 ${
                        alert.severity === 'Critical' ? 'text-red-800' : 'text-yellow-800'
                      }`}>
                        {alert.eventType}
                      </h3>
                      <p className={`text-sm mb-2 ${
                        alert.severity === 'Critical' ? 'text-red-700' : 'text-yellow-700'
                      }`}>
                        {alert.description}
                      </p>
                      <p className={`text-xs ${
                        alert.severity === 'Critical' ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        <i className="fas fa-clock mr-1"></i>
                        {alert.dateTime}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getSeverityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status Indicators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentIndicators.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading device status...</p>
          </div>
        ) : (
          currentIndicators.map((indicator) => (
            <div
              key={indicator.id}
              className={`bg-gradient-to-br rounded-xl p-6 border ${getStatusBgColor(indicator.status)}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">{indicator.name}</h3>
                <div className={`w-10 h-10 ${getStatusIconColor(indicator.color)} rounded-full flex items-center justify-center`}>
                  <i className={`fas ${indicator.icon} text-white`}></i>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-2">{indicator.value}</p>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    indicator.status === 'OK'
                      ? 'bg-green-500'
                      : indicator.status === 'Warning'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  } ${indicator.status !== 'OK' ? 'animate-pulse' : ''}`}
                ></span>
                <span
                  className={`text-sm font-semibold ${
                    indicator.status === 'OK'
                      ? 'text-green-700'
                      : indicator.status === 'Warning'
                      ? 'text-yellow-700'
                      : 'text-red-700'
                  }`}
                >
                  {indicator.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Overall System Health */}
      {currentIndicators.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <i className="fas fa-heartbeat text-red-500"></i>
            Overall System Health
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 font-medium mb-1">OK Status</p>
                  <p className="text-3xl font-bold text-green-800">
                    {currentIndicators.filter((i) => i.status === 'OK').length}
                  </p>
                </div>
                <i className="fas fa-check-circle text-green-500 text-3xl"></i>
              </div>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-700 font-medium mb-1">Warnings</p>
                  <p className="text-3xl font-bold text-yellow-800">
                    {currentIndicators.filter((i) => i.status === 'Warning').length}
                  </p>
                </div>
                <i className="fas fa-exclamation-triangle text-yellow-500 text-3xl"></i>
              </div>
            </div>

            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700 font-medium mb-1">Critical</p>
                  <p className="text-3xl font-bold text-red-800">
                    {currentIndicators.filter((i) => i.status === 'Critical').length}
                  </p>
                </div>
                <i className="fas fa-times-circle text-red-500 text-3xl"></i>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Safety Events History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <i className="fas fa-history text-gray-600"></i>
            Safety Events History
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date & Time</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Pond</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Event Type</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Severity</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Description</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {safetyEvents.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-gray-600 flex items-center gap-2">
                      <i className="fas fa-clock text-blue-500"></i>
                      {event.dateTime}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-800">{event.pond}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-gray-800">{event.eventType}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getSeverityColor(event.severity)}`}>
                      {event.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600 text-sm">{event.description}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {event.resolved ? (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                        <i className="fas fa-check-circle mr-1"></i>
                        Resolved
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
                        <i className="fas fa-exclamation-circle mr-1"></i>
                        Active
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FeederHealthSafety;
