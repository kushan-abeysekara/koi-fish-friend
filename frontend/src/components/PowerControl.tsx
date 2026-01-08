import { useState, useEffect } from 'react';
import { sensorDeviceApi } from '../services/api';
import { pondApi } from '../services/api';

interface Pond {
  id: number;
  name: string;
  color: string;
}

interface SensorDevice {
  id: number;
  deviceId: string;
  deviceType: string;
  status: string;
  ipAddress?: string;
  lastSeen?: string;
  pondId?: number;
  pond?: Pond;
}

export default function PowerControl() {
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [selectedPondId, setSelectedPondId] = useState<number | null>(null);
  const [device, setDevice] = useState<SensorDevice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  // Fetch ponds on mount
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

  // Fetch device for selected pond
  useEffect(() => {
    if (!selectedPondId) return;

    const fetchDevice = async () => {
      setLoading(true);
      setError(null);

      try {
        const deviceRes = await sensorDeviceApi.getByPond(selectedPondId);
        if (deviceRes.success && deviceRes.data && deviceRes.data.length > 0) {
          // Find BUDGET_MANAGEMENT device
          const budgetDevice = deviceRes.data.find(d => d.deviceType === 'BUDGET_MANAGEMENT');
          if (budgetDevice) {
            setDevice(budgetDevice);
          } else {
            setDevice(null);
            setError('No BUDGET_MANAGEMENT device found for this pond');
          }
        } else {
          setDevice(null);
          setError('No devices found for this pond');
        }
      } catch (err) {
        console.error('Error fetching device:', err);
        setError('Failed to fetch device');
      } finally {
        setLoading(false);
      }
    };

    fetchDevice();
    const interval = setInterval(fetchDevice, 5000); // Update device status every 5 seconds
    return () => clearInterval(interval);
  }, [selectedPondId]);

  const handlePowerOn = async () => {
    if (!device) return;

    try {
      setLoading(true);
      setError(null);
      await sensorDeviceApi.powerOn(device.deviceId);
      setLastCommand('POWER ON');
      alert('✅ Power turned ON successfully!\n\nThe relay is now activated and equipment is powered.');
    } catch (err: any) {
      console.error('Error turning power on:', err);
      setError(err.response?.data?.message || 'Failed to turn power on');
      alert('❌ Failed to turn power ON. Please check the connection.');
    } finally {
      setLoading(false);
    }
  };

  const handlePowerOff = async () => {
    if (!device) return;

    if (!confirm('⚠️ WARNING: Turn OFF Power?\n\nThis will CUT POWER to all connected equipment.\n\nThe power will STAY OFF even after ESP32 reboot until you manually turn it back ON.\n\nAre you sure you want to proceed?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await sensorDeviceApi.powerOff(device.deviceId);
      setLastCommand('POWER OFF');
      alert('✅ Power turned OFF successfully!\n\nThe relay is now deactivated.\n\nPower state is saved to flash memory and will persist across reboots.');
    } catch (err: any) {
      console.error('Error turning power off:', err);
      setError(err.response?.data?.message || 'Failed to turn power off');
      alert('❌ Failed to turn power OFF. Please check the connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoMode = async () => {
    if (!device) return;

    if (!confirm('🤖 Switch to AUTO Mode?\n\nThe system will automatically control power based on voltage levels:\n• Safe range: 210V - 250V → Power ON\n• Outside range → Power OFF\n\nContinue?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await sensorDeviceApi.setAutoMode(device.deviceId);
      setLastCommand('AUTO MODE');
      alert('✅ Switched to AUTO mode successfully!\n\nThe system will now automatically manage power based on voltage levels.\n\nMode setting is saved and will persist across reboots.');
    } catch (err: any) {
      console.error('Error setting auto mode:', err);
      setError(err.response?.data?.message || 'Failed to set auto mode');
      alert('❌ Failed to set AUTO mode. Please check the connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleMode = async () => {
    if (!device) return;

    if (!confirm('📅 Switch to SCHEDULE Mode?\n\nThe system will control power based on time schedules:\n• Power ON/OFF at scheduled times\n• Multiple schedules supported\n• Requires schedules to be created first\n\nGo to "Power Schedules" to create schedules.\n\nContinue?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await sensorDeviceApi.setScheduleMode(device.deviceId);
      setLastCommand('SCHEDULE MODE');
      alert('✅ Switched to SCHEDULE mode successfully!\n\nThe system will now follow time-based schedules.\n\nCreate schedules in "Power Schedules" page.');
    } catch (err: any) {
      console.error('Error setting schedule mode:', err);
      setError(err.response?.data?.message || 'Failed to set schedule mode');
      alert('❌ Failed to set SCHEDULE mode. Please check the connection.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: { [key: string]: string } = {
      online: 'bg-green-500',
      offline: 'bg-red-500',
      unknown: 'bg-gray-500'
    };

    return (
      <span className={`${statusColors[status?.toLowerCase()] || 'bg-gray-500'} text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center space-x-2`}>
        <span className={`w-2 h-2 rounded-full bg-white ${status?.toLowerCase() === 'online' ? 'animate-pulse' : ''}`}></span>
        <span className="uppercase">{status || 'UNKNOWN'}</span>
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">🔌 Power Control Center</h1>
        <p className="text-gray-600">Manual and automatic power management for budget monitoring devices</p>
      </div>

      {/* Pond Selection */}
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-100">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          🐟 Select Pond
        </label>
        <select
          value={selectedPondId || ''}
          onChange={(e) => setSelectedPondId(parseInt(e.target.value))}
          className="w-full max-w-md px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        >
          {ponds.map((pond) => (
            <option key={pond.id} value={pond.id}>
              {pond.name}
            </option>
          ))}
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-xl mb-6 shadow-lg">
          <div className="flex items-center">
            <span className="text-2xl mr-3">⚠️</span>
            <div>
              <p className="font-semibold">Error</p>
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && !device && (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading device information...</p>
        </div>
      )}

      {/* No Device State */}
      {!loading && !device && selectedPondId && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 px-6 py-8 rounded-xl shadow-lg text-center">
          <div className="text-6xl mb-4">📡</div>
          <h3 className="text-xl font-bold mb-2">No Budget Management Device Found</h3>
          <p>Please assign a BUDGET_MANAGEMENT device to this pond first.</p>
          <p className="text-sm mt-2">Device Type Required: BUDGET_MANAGEMENT (BM_*)</p>
        </div>
      )}

      {/* Device Information & Controls */}
      {device && (
        <>
          {/* Device Status Card */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">Device ID</p>
                <p className="font-mono font-bold text-2xl">{device.deviceId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Device Type</p>
                <p className="font-semibold text-lg">BUDGET MANAGEMENT</p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Status</p>
                {getStatusBadge(device.status)}
              </div>
              {device.ipAddress && (
                <div>
                  <p className="text-sm text-gray-400 mb-1">IP Address</p>
                  <p className="font-mono font-semibold">{device.ipAddress}</p>
                </div>
              )}
            </div>
          </div>

          {/* Last Command Badge */}
          {lastCommand && (
            <div className="bg-blue-50 border-l-4 border-blue-500 px-6 py-3 rounded-xl mb-6 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">📝</span>
                <div>
                  <p className="text-sm font-semibold text-blue-900">Last Command Sent</p>
                  <p className="text-blue-700 font-bold">{lastCommand}</p>
                </div>
              </div>
              <button
                onClick={() => setLastCommand(null)}
                className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
              >
                Clear
              </button>
            </div>
          )}

          {/* Power Control Panel */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 border-2 border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-800 flex items-center">
                  <span className="text-4xl mr-3">⚡</span>
                  Power Control Panel
                </h2>
                <p className="text-gray-600 mt-2">Control power state with persistent memory</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {/* Power ON Button */}
              <button
                onClick={handlePowerOn}
                disabled={loading || device.status !== 'online'}
                className="bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white p-8 rounded-2xl font-bold transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <div className="text-center">
                  <div className="text-6xl mb-4">✅</div>
                  <div className="text-2xl mb-2">POWER ON</div>
                  <div className="text-sm font-normal opacity-90">Turn equipment ON</div>
                  <div className="text-xs font-normal opacity-75 mt-2">Stays ON after reboot</div>
                </div>
              </button>

              {/* Power OFF Button */}
              <button
                onClick={handlePowerOff}
                disabled={loading || device.status !== 'online'}
                className="bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white p-8 rounded-2xl font-bold transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <div className="text-center">
                  <div className="text-6xl mb-4">⛔</div>
                  <div className="text-2xl mb-2">POWER OFF</div>
                  <div className="text-sm font-normal opacity-90">Cut power completely</div>
                  <div className="text-xs font-normal opacity-75 mt-2">Stays OFF after reboot</div>
                </div>
              </button>

              {/* Auto Mode Button */}
              <button
                onClick={handleAutoMode}
                disabled={loading || device.status !== 'online'}
                className="bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-8 rounded-2xl font-bold transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <div className="text-center">
                  <div className="text-6xl mb-4">🤖</div>
                  <div className="text-2xl mb-2">AUTO MODE</div>
                  <div className="text-sm font-normal opacity-90">Voltage-based control</div>
                  <div className="text-xs font-normal opacity-75 mt-2">Mode saved to flash</div>
                </div>
              </button>

              {/* Schedule Mode Button */}
              <button
                onClick={handleScheduleMode}
                disabled={loading || device.status !== 'online'}
                className="bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white p-8 rounded-2xl font-bold transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <div className="text-center">
                  <div className="text-6xl mb-4">📅</div>
                  <div className="text-2xl mb-2">SCHEDULE</div>
                  <div className="text-sm font-normal opacity-90">Time-based control</div>
                  <div className="text-xs font-normal opacity-75 mt-2">Use predefined schedules</div>
                </div>
              </button>
            </div>

            {/* Info Alert */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 p-6 rounded-xl">
              <h4 className="font-bold text-blue-900 mb-3 flex items-center text-lg">
                <span className="mr-2">ℹ️</span>
                Power State Persistence
              </h4>
              <ul className="text-blue-800 space-y-2 ml-6 list-disc">
                <li><strong>POWER ON</strong>: Manually activate relay → Equipment gets power → State saved to flash</li>
                <li><strong>POWER OFF</strong>: Manually deactivate relay → Equipment loses power → State saved to flash</li>
                <li><strong>AUTO MODE</strong>: Automatic voltage monitoring (Safe: 210-250V) → State saved to flash</li>
                <li><strong>Persistence</strong>: Power state survives ESP32 reboots and power outages</li>
                <li><strong>Default Behavior</strong>: First boot defaults to AUTO mode with power OFF for safety</li>
              </ul>
            </div>
          </div>

          {/* Safety Information */}
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-xl mb-6">
            <h4 className="font-bold text-yellow-900 mb-3 flex items-center text-lg">
              <span className="mr-2">⚠️</span>
              Safety Guidelines
            </h4>
            <ul className="text-yellow-800 space-y-2 ml-6 list-disc">
              <li>Always verify device status is <strong>ONLINE</strong> before sending commands</li>
              <li><strong>POWER OFF</strong> requires confirmation - cuts power immediately and permanently</li>
              <li>Check ESP32 LCD display to confirm relay state changes</li>
              <li>In AUTO mode, system protects against unsafe voltage levels automatically</li>
              <li>Manual mode overrides all automatic protection - use with caution</li>
            </ul>
          </div>

          {/* Technical Details */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">🔧</span>
              Technical Specifications
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Control Modes</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• <strong>Manual Mode</strong>: Direct relay control (ON/OFF)</li>
                  <li>• <strong>Auto Mode</strong>: Voltage-based automatic switching</li>
                  <li>• <strong>Persistence</strong>: ESP32 NVS flash storage</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Voltage Protection</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• <strong>Safe Minimum</strong>: 210V</li>
                  <li>• <strong>Safe Maximum</strong>: 250V</li>
                  <li>• <strong>Protection</strong>: Auto shutdown outside range</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Communication</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• <strong>Protocol</strong>: MQTT over WiFi</li>
                  <li>• <strong>Broker</strong>: HiveMQ Public</li>
                  <li>• <strong>Response</strong>: Real-time command acknowledgment</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Device Info</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• <strong>Type</strong>: BUDGET_MANAGEMENT</li>
                  <li>• <strong>Prefix</strong>: BM_</li>
                  <li>• <strong>Display</strong>: 20x4 LCD with status indicators</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
