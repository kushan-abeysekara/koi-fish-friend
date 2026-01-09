import { useState, useEffect, useCallback } from 'react';
import { powerScheduleApi, sensorDeviceApi, pondApi } from '../services/api';
import type { PowerSchedule, Pond, SensorDevice } from '../services/api';
import { Edit2, Trash2, Plus, Calendar, Clock, Power, RefreshCw, Check, X } from 'lucide-react';

// Extended device state for power control
interface DeviceState extends SensorDevice {
  relayState?: 'ON' | 'OFF';
  controlMode?: 'manual' | 'schedule' | 'auto';
  scheduleCount?: number;
}

export default function PowerManagement() {
  const [activeTab, setActiveTab] = useState<'control' | 'schedules'>('control');
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [selectedPondId, setSelectedPondId] = useState<number | null>(null);
  const [device, setDevice] = useState<DeviceState | null>(null);
  const [schedules, setSchedules] = useState<PowerSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<PowerSchedule | null>(null);
  const [commandInProgress, setCommandInProgress] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    endTime: '',
    daysOfWeek: [false, false, false, false, false, false, false],
    enabled: true,
    autoMode: false
  });

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
          const budgetDevice = deviceRes.data.find(d => d.deviceType === 'BUDGET_MANAGEMENT');
          if (budgetDevice) {
            // Parse device state from response (backend may include relayState/controlMode)
            const extendedDevice: DeviceState = {
              ...budgetDevice,
              relayState: (budgetDevice as DeviceState).relayState,
              controlMode: (budgetDevice as DeviceState).controlMode,
              scheduleCount: (budgetDevice as DeviceState).scheduleCount
            };
            setDevice(extendedDevice);
          } else {
            setDevice(null);
            setError('No BUDGET_MANAGEMENT device found for this pond');
          }
        } else {
          setDevice(null);
          setError('No devices found for this pond');
        }
      } catch {
        setError('Failed to fetch device');
      } finally {
        setLoading(false);
      }
    };

    fetchDevice();
    const interval = setInterval(fetchDevice, 5000);
    return () => clearInterval(interval);
  }, [selectedPondId]);

  // Fetch schedules when device is available and schedule tab is active
  const fetchSchedules = useCallback(async () => {
    if (!device) return;

    try {
      const response = await powerScheduleApi.getByDevice(device.deviceId);
      if (response.success && response.data) {
        setSchedules(response.data);
      }
    } catch {
      setError('Failed to fetch schedules');
    }
  }, [device]);

  useEffect(() => {
    if (device && activeTab === 'schedules') {
      fetchSchedules();
    }
  }, [device, activeTab, fetchSchedules]);

  // Power Control Functions with retry and state refresh
  const handlePowerOn = async () => {
    if (!device || commandInProgress) return;

    try {
      setCommandInProgress(true);
      setLoading(true);
      setError(null);
      
      const response = await sensorDeviceApi.powerOn(device.deviceId);
      
      if (response.success) {
        // Optimistically update UI
        setDevice(prev => prev ? { ...prev, relayState: 'ON', controlMode: 'manual' } : null);
        
        // Wait a moment for device to process
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Refresh device state from backend
        if (selectedPondId) {
          const deviceRes = await sensorDeviceApi.getByPond(selectedPondId);
          if (deviceRes.success && deviceRes.data) {
            const updated = deviceRes.data.find(d => d.deviceId === device.deviceId);
            if (updated) {
              setDevice({ ...updated, relayState: (updated as DeviceState).relayState, controlMode: (updated as DeviceState).controlMode });
            }
          }
        }
        
        alert('✅ Power turned ON successfully!');
      } else {
        throw new Error(response.message || 'Failed to turn power on');
      }
    } catch (err) {
      const errorMessage = err instanceof Error && 'response' in err 
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message 
        : undefined;
      setError(errorMessage || (err instanceof Error ? err.message : 'Failed to turn power on'));
      alert('❌ Failed to turn power ON\n\n' + (errorMessage || 'Check if device is online'));
    } finally {
      setLoading(false);
      setCommandInProgress(false);
    }
  };

  const handlePowerOff = async () => {
    if (!device || commandInProgress) return;

    if (!confirm('⚠️ WARNING: Turn OFF Power?\n\nThis will CUT POWER to all connected equipment.\n\nAre you sure?')) {
      return;
    }

    try {
      setCommandInProgress(true);
      setLoading(true);
      setError(null);
      
      const response = await sensorDeviceApi.powerOff(device.deviceId);
      
      if (response.success) {
        // Optimistically update UI
        setDevice(prev => prev ? { ...prev, relayState: 'OFF', controlMode: 'manual' } : null);
        
        // Wait for device to process
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Refresh device state
        if (selectedPondId) {
          const deviceRes = await sensorDeviceApi.getByPond(selectedPondId);
          if (deviceRes.success && deviceRes.data) {
            const updated = deviceRes.data.find(d => d.deviceId === device.deviceId);
            if (updated) {
              setDevice({ ...updated, relayState: (updated as DeviceState).relayState, controlMode: (updated as DeviceState).controlMode });
            }
          }
        }
        
        alert('✅ Power turned OFF successfully!');
      } else {
        throw new Error(response.message || 'Failed to turn power off');
      }
    } catch (err) {
      const errorMessage = err instanceof Error && 'response' in err 
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message 
        : undefined;
      setError(errorMessage || (err instanceof Error ? err.message : 'Failed to turn power off'));
      alert('❌ Failed to turn power OFF\n\n' + (errorMessage || 'Check if device is online'));
    } finally {
      setLoading(false);
      setCommandInProgress(false);
    }
  };

  const handleAutoMode = async () => {
    if (!device || commandInProgress) return;

    if (!confirm('🤖 Switch to AUTO Mode?\n\nVoltage-based control (210V - 250V).\n\nContinue?')) {
      return;
    }

    try {
      setCommandInProgress(true);
      setLoading(true);
      setError(null);
      
      const response = await sensorDeviceApi.setAutoMode(device.deviceId);
      
      if (response.success) {
        setDevice(prev => prev ? { ...prev, controlMode: 'auto' } : null);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (selectedPondId) {
          const deviceRes = await sensorDeviceApi.getByPond(selectedPondId);
          if (deviceRes.success && deviceRes.data) {
            const updated = deviceRes.data.find(d => d.deviceId === device.deviceId);
            if (updated) {
              setDevice({ ...updated, relayState: (updated as DeviceState).relayState, controlMode: (updated as DeviceState).controlMode });
            }
          }
        }
        
        alert('✅ Switched to AUTO mode successfully!');
      } else {
        throw new Error(response.message || 'Failed to set auto mode');
      }
    } catch (err) {
      const errorMessage = err instanceof Error && 'response' in err 
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message 
        : undefined;
      setError(errorMessage || (err instanceof Error ? err.message : 'Failed to set auto mode'));
      alert('❌ Failed to set AUTO mode\n\n' + (errorMessage || 'Check if device is online'));
    } finally {
      setLoading(false);
      setCommandInProgress(false);
    }
  };

  const handleScheduleMode = async () => {
    if (!device || commandInProgress) return;

    if (!confirm('📅 Switch to SCHEDULE Mode?\n\nTime-based control. Requires schedules to be created.\n\nContinue?')) {
      return;
    }

    try {
      setCommandInProgress(true);
      setLoading(true);
      setError(null);
      
      const response = await sensorDeviceApi.setScheduleMode(device.deviceId);
      
      if (response.success) {
        setDevice(prev => prev ? { ...prev, controlMode: 'schedule' } : null);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (selectedPondId) {
          const deviceRes = await sensorDeviceApi.getByPond(selectedPondId);
          if (deviceRes.success && deviceRes.data) {
            const updated = deviceRes.data.find(d => d.deviceId === device.deviceId);
            if (updated) {
              setDevice({ ...updated, relayState: (updated as DeviceState).relayState, controlMode: (updated as DeviceState).controlMode });
            }
          }
        }
        
        alert('✅ Switched to SCHEDULE mode successfully!');
      } else {
        throw new Error(response.message || 'Failed to set schedule mode');
      }
    } catch (err) {
      const errorMessage = err instanceof Error && 'response' in err 
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message 
        : undefined;
      setError(errorMessage || (err instanceof Error ? err.message : 'Failed to set schedule mode'));
      alert('❌ Failed to set SCHEDULE mode\n\n' + (errorMessage || 'Check if device is online'));
    } finally {
      setLoading(false);
      setCommandInProgress(false);
    }
  };

  // Schedule Management Functions
  const handleCreateSchedule = async () => {
    if (!device) return;

    if (!formData.name.trim() || !formData.startTime || !formData.endTime) {
      alert('Please fill in all required fields');
      return;
    }

    if (!formData.daysOfWeek.some(day => day)) {
      alert('Please select at least one day');
      return;
    }

    try {
      setLoading(true);

      await powerScheduleApi.create({
        deviceId: device.deviceId,
        name: formData.name,
        startTime: formData.startTime,
        endTime: formData.endTime,
        daysOfWeek: formData.daysOfWeek,
        enabled: formData.enabled
      });

      alert('✅ Schedule created successfully!');
      setShowForm(false);
      resetForm();
      fetchSchedules();
    } catch {
      alert('❌ Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSchedule = async () => {
    if (!editingSchedule || !editingSchedule.id) return;

    try {
      setLoading(true);
      await powerScheduleApi.update(editingSchedule.id, {
        name: formData.name,
        startTime: formData.startTime,
        endTime: formData.endTime,
        daysOfWeek: formData.daysOfWeek,
        enabled: formData.enabled
      });

      alert('✅ Schedule updated successfully!');
      setShowForm(false);
      setEditingSchedule(null);
      resetForm();
      fetchSchedules();
    } catch {
      alert('❌ Failed to update schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSchedule = async (id: number) => {
    try {
      await powerScheduleApi.toggle(id);
      fetchSchedules();
    } catch {
      alert('❌ Failed to toggle schedule');
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    if (!confirm('Delete this schedule?')) return;

    try {
      await powerScheduleApi.delete(id);
      fetchSchedules();
    } catch {
      alert('❌ Failed to delete schedule');
    }
  };

  const handleSyncSchedules = async () => {
    if (!device) return;

    try {
      setLoading(true);
      await powerScheduleApi.syncToDevice(device.deviceId);
      alert('✅ Schedules synced to ESP32!');
    } catch {
      alert('❌ Failed to sync schedules');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (schedule: PowerSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      name: schedule.name,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      daysOfWeek: schedule.daysOfWeek,
      enabled: schedule.enabled,
      autoMode: (schedule as PowerSchedule & { autoMode?: boolean }).autoMode || false
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      startTime: '',
      endTime: '',
      daysOfWeek: [false, false, false, false, false, false, false],
      enabled: true,
      autoMode: false
    });
    setEditingSchedule(null);
  };

  const getStatusBadge = (status: string) => {
    const statusColors: { [key: string]: string } = {
      online: 'bg-green-500',
      offline: 'bg-red-500'
    };

    return (
      <span className={`${statusColors[status?.toLowerCase()] || 'bg-gray-500'} text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center space-x-2`}>
        <span className={`w-2 h-2 rounded-full bg-white ${status?.toLowerCase() === 'online' ? 'animate-pulse' : ''}`}></span>
        <span className="uppercase">{status || 'UNKNOWN'}</span>
      </span>
    );
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">⚡ Power Management</h1>
        <p className="text-gray-600">Complete power control and scheduling system</p>
      </div>

      {/* Pond Selection */}
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-100">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          🐟 Select Pond
        </label>
        <select
          value={selectedPondId || ''}
          onChange={(e) => setSelectedPondId(parseInt(e.target.value))}
          className="w-full max-w-md px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-xl mb-6">
          <div className="flex items-center">
            <span className="text-2xl mr-3">⚠️</span>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Device Status Card */}
      {device && (
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-gray-400 mb-1">Device ID</p>
              <p className="font-mono font-bold text-2xl">{device.deviceId}</p>
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
            {device.relayState && (
              <div>
                <p className="text-sm text-gray-400 mb-1">Relay State</p>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  device.relayState === 'ON' ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'
                }`}>
                  {device.relayState}
                </span>
              </div>
            )}
            {device.controlMode && (
              <div>
                <p className="text-sm text-gray-400 mb-1">Control Mode</p>
                <span className="px-3 py-1 rounded-full text-sm font-bold bg-blue-500 text-white uppercase">
                  {device.controlMode}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      {device && (
        <div className="bg-white rounded-2xl shadow-xl mb-6 border border-gray-100">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('control')}
              className={`flex-1 px-6 py-4 font-semibold text-lg transition-colors ${
                activeTab === 'control'
                  ? 'bg-blue-500 text-white border-b-4 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">🎛️</span>
              Manual Control
            </button>
            <button
              onClick={() => setActiveTab('schedules')}
              className={`flex-1 px-6 py-4 font-semibold text-lg transition-colors ${
                activeTab === 'schedules'
                  ? 'bg-blue-500 text-white border-b-4 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">📅</span>
              Time Schedules
            </button>
          </div>

          {/* Manual Control Tab */}
          {activeTab === 'control' && (
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <button
                  onClick={handlePowerOn}
                  disabled={loading || commandInProgress || device.status !== 'online'}
                  className={`bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white p-8 rounded-2xl font-bold transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed relative ${
                    device.controlMode === 'manual' && device.relayState === 'ON' ? 'ring-4 ring-green-300 ring-offset-4 scale-105' : ''
                  }`}
                >
                  {device.controlMode === 'manual' && device.relayState === 'ON' && (
                    <div className="absolute -top-3 right-4 bg-white text-green-600 px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                      🟢 ACTIVE
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-6xl mb-4">✅</div>
                    <div className="text-2xl mb-2">POWER ON</div>
                    <div className="text-sm font-normal opacity-90">Turn equipment ON</div>
                  </div>
                </button>

                <button
                  onClick={handlePowerOff}
                  disabled={loading || commandInProgress || device.status !== 'online'}
                  className={`bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white p-8 rounded-2xl font-bold transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed relative ${
                    device.controlMode === 'manual' && device.relayState === 'OFF' ? 'ring-4 ring-red-300 ring-offset-4 scale-105' : ''
                  }`}
                >
                  {device.controlMode === 'manual' && device.relayState === 'OFF' && (
                    <div className="absolute -top-3 right-4 bg-white text-red-600 px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                      🔴 ACTIVE
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-6xl mb-4">⛔</div>
                    <div className="text-2xl mb-2">POWER OFF</div>
                    <div className="text-sm font-normal opacity-90">Cut power completely</div>
                  </div>
                </button>

                <button
                  onClick={handleAutoMode}
                  disabled={loading || commandInProgress || device.status !== 'online'}
                  className={`bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-8 rounded-2xl font-bold transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed relative ${
                    device.controlMode === 'auto' ? 'ring-4 ring-blue-300 ring-offset-4 scale-105' : ''
                  }`}
                >
                  {device.controlMode === 'auto' && (
                    <div className="absolute -top-3 right-4 bg-white text-blue-600 px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                      🔵 ACTIVE
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-6xl mb-4">🤖</div>
                    <div className="text-2xl mb-2">AUTO MODE</div>
                    <div className="text-sm font-normal opacity-90">Voltage-based control</div>
                  </div>
                </button>

                <button
                  onClick={handleScheduleMode}
                  disabled={loading || commandInProgress || device.status !== 'online'}
                  className={`bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white p-8 rounded-2xl font-bold transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed relative ${
                    device.controlMode === 'schedule' ? 'ring-4 ring-purple-300 ring-offset-4 scale-105' : ''
                  }`}
                >
                  {device.controlMode === 'schedule' && (
                    <div className="absolute -top-3 right-4 bg-white text-purple-600 px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                      🟣 ACTIVE
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-6xl mb-4">📅</div>
                    <div className="text-2xl mb-2">SCHEDULE</div>
                    <div className="text-sm font-normal opacity-90">Time-based control</div>
                  </div>
                </button>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-xl">
                <h4 className="font-bold text-blue-900 mb-3">ℹ️ Control Modes</h4>
                <ul className="text-blue-800 space-y-2 ml-6 list-disc">
                  <li><strong>Manual ON/OFF</strong>: Direct relay control with persistent state</li>
                  <li><strong>AUTO MODE</strong>: Voltage-based (210-250V safe range)</li>
                  <li><strong>SCHEDULE MODE</strong>: Time-based control using schedules</li>
                  <li><strong>Persistence</strong>: All states saved to ESP32 flash memory</li>
                </ul>
              </div>
            </div>
          )}

          {/* Schedules Tab */}
          {activeTab === 'schedules' && (
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Power Schedules</h3>
                  <p className="text-gray-600">Create time-based power control schedules</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleSyncSchedules}
                    disabled={loading}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Sync to ESP32
                  </button>
                  <button
                    onClick={() => {
                      resetForm();
                      setShowForm(true);
                    }}
                    className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    New Schedule
                  </button>
                </div>
              </div>

              {/* Schedule Form */}
              {showForm && (
                <div className="bg-gray-50 rounded-xl p-6 mb-6 border-2 border-gray-200">
                  <h4 className="text-lg font-bold mb-4">
                    {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
                  </h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2">Schedule Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg"
                        placeholder="e.g., Morning Power"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2">Start Time</label>
                        <input
                          type="time"
                          value={formData.startTime}
                          onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                          className="w-full px-4 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-2">End Time</label>
                        <input
                          type="time"
                          value={formData.endTime}
                          onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                          className="w-full px-4 py-2 border rounded-lg"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2">Days of Week</label>
                      <div className="flex gap-2">
                        {dayNames.map((day, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              const newDays = [...formData.daysOfWeek];
                              newDays[index] = !newDays[index];
                              setFormData({ ...formData, daysOfWeek: newDays });
                            }}
                            className={`flex-1 py-2 rounded-lg font-semibold ${
                              formData.daysOfWeek[index]
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
                      <label className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="text-3xl">🤖</div>
                          <div>
                            <p className="font-bold text-blue-900">Enable Auto Mode (Voltage-Based)</p>
                            <p className="text-sm text-blue-700">
                              When active, uses voltage monitoring (210V-250V) instead of simple ON/OFF
                            </p>
                          </div>
                        </div>
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={formData.autoMode}
                            onChange={(e) => setFormData({ ...formData, autoMode: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-14 h-8 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                      </label>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={editingSchedule ? handleUpdateSchedule : handleCreateSchedule}
                        disabled={loading}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
                      >
                        <Check className="w-5 h-5" />
                        {editingSchedule ? 'Update' : 'Create'}
                      </button>
                      <button
                        onClick={() => {
                          setShowForm(false);
                          resetForm();
                        }}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
                      >
                        <X className="w-5 h-5" />
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Schedules List */}
              <div className="space-y-4">
                {schedules.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 font-semibold">No schedules created yet</p>
                    <p className="text-gray-500 text-sm">Click "New Schedule" to create one</p>
                  </div>
                ) : (
                  schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className={`bg-white rounded-xl p-6 border-2 ${
                        schedule.enabled ? 'border-green-300' : 'border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-xl font-bold text-gray-800">{schedule.name}</h4>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                schedule.enabled
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {schedule.enabled ? 'ACTIVE' : 'DISABLED'}
                            </span>
                            {(schedule as PowerSchedule & { autoMode?: boolean }).autoMode && (
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 flex items-center gap-1">
                                <span>🤖</span>
                                AUTO MODE
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-gray-600 mb-3">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              <span className="font-mono font-semibold">
                                {schedule.startTime} - {schedule.endTime}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {schedule.daysOfWeek.map((active, index) => (
                              <span
                                key={index}
                                className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                                  active
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-400'
                                }`}
                              >
                                {dayNames[index]}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => schedule.id && handleToggleSchedule(schedule.id)}
                            className={`p-2 rounded-lg ${
                              schedule.enabled
                                ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'
                                : 'bg-green-100 hover:bg-green-200 text-green-700'
                            }`}
                            title={schedule.enabled ? 'Disable' : 'Enable'}
                          >
                            <Power className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => startEdit(schedule)}
                            className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg"
                            title="Edit"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => schedule.id && handleDeleteSchedule(schedule.id)}
                            className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Device State */}
      {!loading && !device && selectedPondId && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 px-6 py-8 rounded-xl text-center">
          <div className="text-6xl mb-4">📡</div>
          <h3 className="text-xl font-bold mb-2">No Budget Management Device Found</h3>
          <p>Please assign a BUDGET_MANAGEMENT device to this pond first.</p>
        </div>
      )}
    </div>
  );
}


