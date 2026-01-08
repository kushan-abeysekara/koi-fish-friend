import React, { useState, useEffect } from 'react';
import { powerScheduleApi, sensorDeviceApi, pondApi } from '../services/api';
import type { PowerSchedule, Pond, SensorDevice } from '../services/api';

const PowerScheduleManager: React.FC = () => {
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [selectedPondId, setSelectedPondId] = useState<number>(1);
  const [device, setDevice] = useState<SensorDevice | null>(null);
  const [schedules, setSchedules] = useState<PowerSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    startTime: '06:00',
    endTime: '18:00',
    daysOfWeek: [true, true, true, true, true, true, true], // All days enabled by default
  });

  const [editingId, setEditingId] = useState<number | null>(null);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Fetch ponds on mount
  useEffect(() => {
    fetchPonds();
  }, []);

  // Fetch device and schedules when pond changes
  useEffect(() => {
    if (selectedPondId) {
      fetchDevice();
    }
  }, [selectedPondId]);

  // Fetch schedules when device changes
  useEffect(() => {
    if (device) {
      fetchSchedules();
    }
  }, [device]);

  const fetchPonds = async () => {
    try {
      const response = await pondApi.getAll();
      if (response.success && response.data) {
        setPonds(response.data);
      }
    } catch (err: any) {
      setError('Failed to fetch ponds');
    }
  };

  const fetchDevice = async () => {
    try {
      setLoading(true);
      const response = await sensorDeviceApi.getByPond(selectedPondId);
      if (response.success && response.data) {
        const budgetDevice = response.data.find((d: SensorDevice) => d.deviceType === 'BUDGET_MANAGEMENT');
        if (budgetDevice) {
          setDevice(budgetDevice);
        } else {
          setDevice(null);
          setError('No budget management device found for this pond');
        }
      }
    } catch (err: any) {
      setError('Failed to fetch device');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    if (!device) return;

    try {
      setLoading(true);
      const response = await powerScheduleApi.getByDevice(device.deviceId);
      if (response.success && response.data) {
        setSchedules(response.data);
      }
    } catch (err: any) {
      setError('Failed to fetch schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!device) return;

    if (!formData.name.trim()) {
      setError('Schedule name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const scheduleData = {
        deviceId: device.deviceId,
        name: formData.name,
        startTime: formData.startTime,
        endTime: formData.endTime,
        daysOfWeek: formData.daysOfWeek,
        enabled: true,
      };

      const response = await powerScheduleApi.create(scheduleData);

      if (response.success) {
        setSuccess('Schedule created successfully!');
        setShowCreateForm(false);
        resetForm();
        fetchSchedules();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.message || 'Failed to create schedule');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSchedule = async () => {
    if (!editingId) return;

    try {
      setLoading(true);
      setError('');

      const scheduleData = {
        name: formData.name,
        startTime: formData.startTime,
        endTime: formData.endTime,
        daysOfWeek: formData.daysOfWeek,
        enabled: true,
      };

      const response = await powerScheduleApi.update(editingId, scheduleData);

      if (response.success) {
        setSuccess('Schedule updated successfully!');
        setShowCreateForm(false);
        setEditingId(null);
        resetForm();
        fetchSchedules();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.message || 'Failed to update schedule');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSchedule = async (id: number) => {
    try {
      setLoading(true);
      const response = await powerScheduleApi.toggle(id);
      if (response.success) {
        fetchSchedules();
      }
    } catch (err: any) {
      setError('Failed to toggle schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      setLoading(true);
      const response = await powerScheduleApi.delete(id);
      if (response.success) {
        setSuccess('Schedule deleted successfully!');
        fetchSchedules();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      setError('Failed to delete schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSchedule = (schedule: PowerSchedule) => {
    setFormData({
      name: schedule.name,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      daysOfWeek: schedule.daysOfWeek,
    });
    setEditingId(schedule.id || null);
    setShowCreateForm(true);
  };

  const handleSyncToDevice = async () => {
    if (!device) return;

    try {
      setLoading(true);
      const response = await powerScheduleApi.syncToDevice(device.deviceId);
      if (response.success) {
        setSuccess('Schedules synced to ESP32 successfully!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      setError('Failed to sync schedules to device');
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (index: number) => {
    const newDays = [...formData.daysOfWeek];
    newDays[index] = !newDays[index];
    setFormData({ ...formData, daysOfWeek: newDays });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      startTime: '06:00',
      endTime: '18:00',
      daysOfWeek: [true, true, true, true, true, true, true],
    });
    setEditingId(null);
  };

  const cancelForm = () => {
    resetForm();
    setShowCreateForm(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            <i className="fas fa-clock mr-3 text-blue-600"></i>
            Power Schedule Manager
          </h1>
          <p className="text-gray-600">
            Create time-based schedules to automatically control motor power ON/OFF times
          </p>
        </div>

        {/* Pond Selector */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Pond
          </label>
          <select
            value={selectedPondId}
            onChange={(e) => setSelectedPondId(Number(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {ponds.map((pond) => (
              <option key={pond.id} value={pond.id}>
                {pond.name}
              </option>
            ))}
          </select>

          {device && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-green-800">
                    <i className="fas fa-microchip mr-2"></i>
                    Device: {device.deviceId}
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    Status: {device.status} | Schedules: {schedules.length}
                  </p>
                </div>
                <button
                  onClick={handleSyncToDevice}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <i className="fas fa-sync mr-2"></i>
                  Sync to ESP32
                </button>
              </div>
            </div>
          )}

          {!device && !loading && (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-yellow-800">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                No budget management device found for this pond
              </p>
            </div>
          )}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">
              <i className="fas fa-exclamation-circle mr-2"></i>
              {error}
            </p>
            <button
              onClick={() => setError('')}
              className="mt-2 text-sm text-red-600 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800">
              <i className="fas fa-check-circle mr-2"></i>
              {success}
            </p>
          </div>
        )}

        {device && (
          <>
            {/* Create Schedule Button */}
            {!showCreateForm && (
              <div className="mb-6">
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 shadow-lg font-medium text-lg"
                >
                  <i className="fas fa-plus-circle mr-2"></i>
                  Create New Schedule
                </button>
              </div>
            )}

            {/* Create/Edit Form */}
            {showCreateForm && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  {editingId ? 'Edit Schedule' : 'Create New Schedule'}
                </h2>

                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Schedule Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Morning Feeding, Night Operation"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Time Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Time (Power ON)
                      </label>
                      <input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Time (Power OFF)
                      </label>
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Days of Week */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Active Days
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {dayNames.map((day, index) => (
                        <button
                          key={index}
                          onClick={() => toggleDay(index)}
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            formData.daysOfWeek[index]
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                        >
                          {day.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={editingId ? handleUpdateSchedule : handleCreateSchedule}
                      disabled={loading}
                      className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                    >
                      <i className={`fas ${editingId ? 'fa-save' : 'fa-plus-circle'} mr-2`}></i>
                      {editingId ? 'Update Schedule' : 'Create Schedule'}
                    </button>
                    <button
                      onClick={cancelForm}
                      disabled={loading}
                      className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Schedules List */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                <i className="fas fa-list mr-2"></i>
                Active Schedules ({schedules.length})
              </h2>

              {schedules.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <i className="fas fa-calendar-times text-6xl mb-4"></i>
                  <p className="text-lg">No schedules created yet</p>
                  <p className="text-sm">Click "Create New Schedule" to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        schedule.enabled
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-gray-50 border-gray-300 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold text-gray-800">
                            {schedule.name}
                          </h3>
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              schedule.enabled
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {schedule.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditSchedule(schedule)}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                            title="Edit"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            onClick={() => handleToggleSchedule(schedule.id!)}
                            className={`px-3 py-1 rounded ${
                              schedule.enabled
                                ? 'bg-yellow-600 hover:bg-yellow-700'
                                : 'bg-green-600 hover:bg-green-700'
                            } text-white`}
                            title={schedule.enabled ? 'Disable' : 'Enable'}
                          >
                            <i className={`fas fa-${schedule.enabled ? 'pause' : 'play'}`}></i>
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(schedule.id!)}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                            title="Delete"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
                        <div>
                          <span className="font-medium">Power ON:</span>{' '}
                          <span className="text-green-600 font-bold">{schedule.startTime}</span>
                        </div>
                        <div>
                          <span className="font-medium">Power OFF:</span>{' '}
                          <span className="text-red-600 font-bold">{schedule.endTime}</span>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {schedule.daysOfWeek.map((active, index) => (
                          <span
                            key={index}
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              active
                                ? 'bg-blue-200 text-blue-800'
                                : 'bg-gray-200 text-gray-400'
                            }`}
                          >
                            {dayNames[index].slice(0, 3)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mt-6 border border-blue-200">
              <h3 className="text-lg font-bold text-blue-900 mb-3">
                <i className="fas fa-info-circle mr-2"></i>
                How Schedules Work
              </h3>
              <ul className="space-y-2 text-blue-800 text-sm">
                <li>
                  <i className="fas fa-check text-green-600 mr-2"></i>
                  Schedules automatically turn motors ON/OFF at specified times
                </li>
                <li>
                  <i className="fas fa-check text-green-600 mr-2"></i>
                  Multiple schedules can run on different days or times
                </li>
                <li>
                  <i className="fas fa-check text-green-600 mr-2"></i>
                  ESP32 stores schedules in flash memory (persists after reboot)
                </li>
                <li>
                  <i className="fas fa-check text-green-600 mr-2"></i>
                  Enable "Schedule Mode" in Power Control to activate time-based control
                </li>
                <li>
                  <i className="fas fa-exclamation-triangle text-yellow-600 mr-2"></i>
                  Manual mode overrides schedules - switch to Schedule Mode to apply times
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PowerScheduleManager;
