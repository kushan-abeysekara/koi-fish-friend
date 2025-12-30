import React, { useState } from 'react';

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
  const [schedules, setSchedules] = useState<Schedule[]>([
    {
      id: '1',
      timeOfDay: '06:00',
      fishStage: 'Juvenile',
      feedAmount: 3.5,
      ruleNote: 'Morning feeding - High protein',
      status: 'Active',
      pond: 'Pond A',
    },
    {
      id: '2',
      timeOfDay: '12:00',
      fishStage: 'Adult',
      feedAmount: 5.0,
      ruleNote: 'Midday feeding - Standard mix',
      status: 'Active',
      pond: 'Pond A',
    },
    {
      id: '3',
      timeOfDay: '18:00',
      fishStage: 'Adult',
      feedAmount: 4.5,
      ruleNote: 'Evening feeding - Light portion',
      status: 'Active',
      pond: 'Pond A',
    },
    {
      id: '4',
      timeOfDay: '07:00',
      fishStage: 'Mixed',
      feedAmount: 4.0,
      ruleNote: 'Morning feeding',
      status: 'Active',
      pond: 'Pond B',
    },
    {
      id: '5',
      timeOfDay: '14:00',
      fishStage: 'Adult',
      feedAmount: 5.5,
      ruleNote: 'Afternoon feeding',
      status: 'Disabled',
      pond: 'Pond B',
    },
  ]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  const [formData, setFormData] = useState<Omit<Schedule, 'id'>>({
    timeOfDay: '08:00',
    fishStage: 'Adult',
    feedAmount: 5.0,
    ruleNote: '',
    status: 'Active',
    pond: 'Pond A',
  });

  const handleCreateSchedule = () => {
    const newSchedule: Schedule = {
      id: Date.now().toString(),
      ...formData,
    };
    setSchedules([...schedules, newSchedule]);
    setShowCreateForm(false);
    setFormData({
      timeOfDay: '08:00',
      fishStage: 'Adult',
      feedAmount: 5.0,
      ruleNote: '',
      status: 'Active',
      pond: 'Pond A',
    });
    alert('Schedule created successfully!');
  };

  const handleUpdateSchedule = () => {
    if (!editingSchedule) return;
    setSchedules(
      schedules.map((schedule) =>
        schedule.id === editingSchedule.id ? { ...editingSchedule, ...formData } : schedule
      )
    );
    setEditingSchedule(null);
    setFormData({
      timeOfDay: '08:00',
      fishStage: 'Adult',
      feedAmount: 5.0,
      ruleNote: '',
      status: 'Active',
      pond: 'Pond A',
    });
    alert('Schedule updated successfully!');
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
      feedAmount: 5.0,
      ruleNote: '',
      status: 'Active',
      pond: 'Pond A',
    });
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
                Feed Amount (kg)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.feedAmount}
                onChange={(e) => setFormData({ ...formData, feedAmount: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
              {schedules.map((schedule) => (
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
                    <span className="font-semibold text-gray-800">{schedule.feedAmount} kg</span>
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
              ))}
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
                  .toFixed(1)}{' '}
                kg
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
