import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface Schedule {
  id: string;
  timeOfDay: string;
  fishStage: string;
  feedAmount: number;
  ruleNote: string;
  status: 'Active' | 'Disabled';
  pond: string;
}

const FeedingSchedule: React.FC = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [deviceId] = useState('feed_device_001');
  const [loading, setLoading] = useState(false);

  // Load schedules from localStorage on mount
  useEffect(() => {
    const savedSchedules = localStorage.getItem('feedingSchedules');
    if (savedSchedules) {
      try {
        setSchedules(JSON.parse(savedSchedules));
      } catch (error) {
        console.error('Failed to load schedules:', error);
      }
    }
  }, []);

  // Save schedules to localStorage whenever they change
  useEffect(() => {
    if (schedules.length > 0) {
      localStorage.setItem('feedingSchedules', JSON.stringify(schedules));
    }
  }, [schedules]);

  const [formData, setFormData] = useState<Omit<Schedule, 'id'>>({
    timeOfDay: '08:00',
    fishStage: 'Adult',
    feedAmount: 100,
    ruleNote: '',
    status: 'Active',
    pond: 'Pond A',
  });

  const handleCreateSchedule = () => {
    if (!formData.timeOfDay || !formData.feedAmount || formData.feedAmount <= 0) {
      alert('Please fill in all required fields correctly');
      return;
    }

    const newSchedule: Schedule = {
      id: Date.now().toString(),
      ...formData,
    };
    setSchedules([...schedules, newSchedule]);
    setShowCreateForm(false);
    setFormData({
      timeOfDay: '08:00',
      fishStage: 'Adult',
      feedAmount: 100,
      ruleNote: '',
      status: 'Active',
      pond: 'Pond A',
    });
    alert('Schedule created successfully! Remember to sync to device.');
  };

  const handleUpdateSchedule = () => {
    if (!formData.timeOfDay || !formData.feedAmount || formData.feedAmount <= 0) {
      alert('Please fill in all required fields correctly');
      return;
    }

    if (!editingSchedule) return;

    setSchedules(
      schedules.map((schedule) =>
        schedule.id === editingSchedule.id ? { ...schedule, ...formData } : schedule
      )
    );
    setEditingSchedule(null);
    setShowCreateForm(false);
    setFormData({
      timeOfDay: '08:00',
      fishStage: 'Adult',
      feedAmount: 100,
      ruleNote: '',
      status: 'Active',
      pond: 'Pond A',
    });
    alert('Schedule updated successfully! Remember to sync to device.');
  };

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      timeOfDay: schedule.timeOfDay,
      fishStage: schedule.fishStage,
      feedAmount: schedule.feedAmount,
      ruleNote: schedule.ruleNote,
      status: schedule.status,
      pond: schedule.pond,
    });
    setShowCreateForm(true);
  };

  const handleToggleStatus = (id: string) => {
    setSchedules(
      schedules.map((schedule) =>
        schedule.id === id
          ? {
              ...schedule,
              status: schedule.status === 'Active' ? 'Disabled' : 'Active',
            }
          : schedule
      )
    );
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      setSchedules(schedules.filter((schedule) => schedule.id !== id));
      alert('Schedule deleted successfully!');
    }
  };

  const cancelForm = () => {
    setShowCreateForm(false);
    setEditingSchedule(null);
    setFormData({
      timeOfDay: '08:00',
      fishStage: 'Adult',
      feedAmount: 100,
      ruleNote: '',
      status: 'Active',
      pond: 'Pond A',
    });
  };

  // Sync schedules to ESP32 device
  const syncSchedulesToDevice = async () => {
    if (schedules.length === 0) {
      alert('No schedules to sync! Create at least one schedule first.');
      return;
    }

    setSyncStatus('syncing');
    try {
      const activeSchedules = schedules.filter(s => s.status === 'Active');
      
      if (activeSchedules.length === 0) {
        alert('No active schedules to sync! Enable at least one schedule.');
        setSyncStatus('idle');
        return;
      }

      const schedulesData = {
        schedules: activeSchedules.map(s => ({
          time: s.timeOfDay,
          amount: s.feedAmount, // Already in grams
          enabled: true,
          pondId: s.pond
        }))
      };

      console.log('Syncing schedules to device:', schedulesData);
      await api.post(`/feeding/schedule?deviceId=${deviceId}`, schedulesData);
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
      
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      alert(`✅ Schedules synced successfully!\n\n📋 ${activeSchedules.length} active schedule(s) sent to device\n\n⏰ Current time: ${currentTime}\n\n⚠️ IMPORTANT:\n1. ESP32 must be connected to WiFi\n2. ESP32 must have internet access for time sync\n3. Check Serial Monitor for "Schedule triggered" message\n4. Schedules execute automatically at set time\n5. Each schedule runs once per day\n\n💡 TIP: Set a schedule 2-3 minutes from now to test!`);
    } catch (error) {
      console.error('Failed to sync schedules:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
      alert('❌ Failed to sync schedules to device\n\nPlease check:\n1. Backend is running (port 8080)\n2. MQTT broker is connected\n3. ESP32 is powered on');
    }
  };

  // Manual feed now with weight control
  const feedNow = async (schedule: Schedule) => {
    if (confirm(`Feed ${schedule.feedAmount}g now for ${schedule.pond}?`)) {
      try {
        await api.post('/feeding/start', null, {
          params: {
            deviceId: deviceId,
            targetWeight: schedule.feedAmount, // Already in grams
            stepperSpeed: 500
          }
        });
        alert(`Feeding started! Target: ${schedule.feedAmount}g`);
      } catch (error) {
        console.error('Failed to start feeding:', error);
        alert('Failed to start feeding');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">📅</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Feeding Schedule</h2>
              <p className="text-sm text-gray-500">Manage automated feeding schedules</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold flex items-center gap-2 shadow-lg"
          >
            <i className="fas fa-plus-circle"></i>
            {showCreateForm ? 'Cancel' : 'Add New Schedule'}
          </button>
          <button
            onClick={syncSchedulesToDevice}
            disabled={syncStatus === 'syncing'}
            className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 shadow-lg transition-colors ${
              syncStatus === 'syncing' 
                ? 'bg-gray-400 text-white cursor-not-allowed' 
                : syncStatus === 'success'
                ? 'bg-green-500 text-white'
                : syncStatus === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-purple-500 text-white hover:bg-purple-600'
            }`}
          >
            <i className={`fas fa-${syncStatus === 'syncing' ? 'spinner fa-spin' : syncStatus === 'success' ? 'check' : 'sync'}`}></i>
            {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'success' ? 'Synced!' : 'Sync to Device'}
          </button>
        </div>
      </div>

      {/* Create/Edit Schedule Form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <i className="fas fa-edit text-blue-500"></i>
            {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <i className="fas fa-water mr-2 text-cyan-500"></i>
                Pond
              </label>
              <select
                value={formData.pond}
                onChange={(e) => setFormData({ ...formData, pond: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Pond A">Pond A</option>
                <option value="Pond B">Pond B</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <i className="fas fa-clock mr-2 text-blue-500"></i>
                Time of Day
              </label>
              <input
                type="time"
                value={formData.timeOfDay}
                onChange={(e) => setFormData({ ...formData, timeOfDay: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <i className="fas fa-fish mr-2 text-green-500"></i>
                Fish Stage
              </label>
              <select
                value={formData.fishStage}
                onChange={(e) => setFormData({ ...formData, fishStage: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Juvenile">Juvenile</option>
                <option value="Adult">Adult</option>
                <option value="Mixed">Mixed</option>
                <option value="Breeding">Breeding</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <i className="fas fa-weight mr-2 text-purple-500"></i>
                Feed Amount (grams)
              </label>
              <input
                type="number"
                step="10"
                min="0"
                value={formData.feedAmount}
                onChange={(e) => setFormData({ ...formData, feedAmount: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 100 for 100 grams"
              />
              <p className="text-xs text-gray-500 mt-1">Enter weight in grams (e.g., 100g, 250g)</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <i className="fas fa-sticky-note mr-2 text-yellow-500"></i>
                Rule Note
              </label>
              <input
                type="text"
                value={formData.ruleNote}
                onChange={(e) => setFormData({ ...formData, ruleNote: e.target.value })}
                placeholder="e.g., Morning feeding - High protein"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2 flex gap-4">
              <button
                onClick={editingSchedule ? handleUpdateSchedule : handleCreateSchedule}
                className="flex-1 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
              >
                <i className={`fas fa-${editingSchedule ? 'save' : 'plus-circle'} mr-2`}></i>
                {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
              </button>
              <button
                onClick={cancelForm}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
              >
                <i className="fas fa-times mr-2"></i>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Active Schedules</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Pond</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Time</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Fish Stage</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Feed Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Rule Note</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                        <i className="fas fa-calendar-times text-gray-400 text-3xl"></i>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Schedules Yet</h3>
                        <p className="text-gray-500 mb-4">Create your first feeding schedule to get started</p>
                        <button
                          onClick={() => setShowCreateForm(true)}
                          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
                        >
                          <i className="fas fa-plus-circle mr-2"></i>
                          Create Schedule
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                schedules.map((schedule) => (
                <tr key={schedule.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-800">{schedule.pond}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-blue-600 flex items-center gap-2">
                      <i className="fas fa-clock"></i>
                      {schedule.timeOfDay}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                      {schedule.fishStage}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-gray-800">{schedule.feedAmount}g</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600 text-sm">{schedule.ruleNote}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        schedule.status === 'Active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {schedule.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => feedNow(schedule)}
                        className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                        title="Feed Now"
                        disabled={schedule.status === 'Disabled'}
                      >
                        <i className="fas fa-play"></i>
                      </button>
                      <button
                        onClick={() => handleEdit(schedule)}
                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                        title="Edit"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        onClick={() => handleToggleStatus(schedule.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          schedule.status === 'Active'
                            ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-600 hover:bg-green-200'
                        }`}
                        title={schedule.status === 'Active' ? 'Disable' : 'Enable'}
                      >
                        <i className={`fas fa-${schedule.status === 'Active' ? 'pause' : 'play'}`}></i>
                      </button>
                      <button
                        onClick={() => handleDelete(schedule.id)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        title="Delete"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium mb-1">Active Schedules</p>
              <p className="text-2xl font-bold text-green-800">
                {schedules.filter((s) => s.status === 'Active').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
              <i className="fas fa-check-circle text-white text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium mb-1">Total Daily Feed</p>
              <p className="text-2xl font-bold text-blue-800">
                {schedules
                  .filter((s) => s.status === 'Active')
                  .reduce((sum, s) => sum + s.feedAmount, 0)
                  .toFixed(0)}g
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
              <i className="fas fa-weight text-white text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700 font-medium mb-1">Next Feeding</p>
              <p className="text-2xl font-bold text-purple-800">
                {schedules.filter((s) => s.status === 'Active').length > 0
                  ? schedules.filter((s) => s.status === 'Active')[0].timeOfDay
                  : 'N/A'}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
              <i className="fas fa-clock text-white text-xl"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedingSchedule;
