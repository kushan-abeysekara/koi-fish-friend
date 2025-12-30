import React, { useState, useEffect } from 'react';
import { pondApi, fishCountApi } from '../services/api';

interface FishCountRecord {
  id: number;
  pondId: number;
  pondName: string;
  count: number;
  countDate: string;
  countTime: string;
  countedBy: string;
  notes: string;
  countMethod: string;
}

interface Pond {
  id: number;
  name: string;
  color: string;
}

const FishCount: React.FC = () => {
  const [fishCountRecords, setFishCountRecords] = useState<FishCountRecord[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPondModalOpen, setIsPondModalOpen] = useState(false);
  const [selectedPond, setSelectedPond] = useState<number | 'all'>('all');
  const [newPondName, setNewPondName] = useState('');
  const [newPondColor, setNewPondColor] = useState('blue');
  const [formData, setFormData] = useState({
    pondId: '',
    count: '',
    countDate: new Date().toISOString().split('T')[0],
    countTime: new Date().toTimeString().slice(0, 5),
    countedBy: '',
    notes: '',
    countMethod: 'manual',
  });

  // Load ponds and fish counts from API on mount
  useEffect(() => {
    const loadData = async () => {
      await loadPonds();
      await loadFishCounts();
    };
    loadData();
  }, []);

  const loadPonds = async () => {
    try {
      const response = await pondApi.getAll();
      if (response.success && response.data) {
        setPonds(response.data);
      }
    } catch (error) {
      console.error('Error loading ponds:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      alert('Failed to load ponds: ' + errorMessage);
    }
  };

  const loadFishCounts = async () => {
    try {
      const response = await fishCountApi.getAll();
      if (response.success && response.data) {
        // Transform backend data to match frontend interface
        const records: FishCountRecord[] = response.data.map(fc => {
          return {
            id: fc.id,
            pondId: fc.pond.id,
            pondName: fc.pond.name,
            count: fc.count,
            countDate: fc.date,
            countTime: fc.createdAt ? new Date(fc.createdAt).toTimeString().slice(0, 5) : '00:00',
            countedBy: fc.countedBy || 'Admin',
            notes: fc.notes || '',
            countMethod: fc.countMethod || 'manual',
          };
        });
        setFishCountRecords(records);
      }
    } catch (error) {
      console.error('Error loading fish counts:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      alert('Failed to load fish counts: ' + errorMessage);
    }
  };

  const pondColors: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
    green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
    pink: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
    red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  };

  const countMethods = [
    { value: 'manual', label: 'Manual Count', icon: '👁️' },
    { value: 'net', label: 'Net Count', icon: '🎣' },
    { value: 'visual', label: 'Visual Estimate', icon: '📸' },
    { value: 'drain', label: 'Drain & Count', icon: '🚰' },
  ];

  const handleAddPond = async () => {
    if (!newPondName.trim()) {
      alert('Please enter a pond name');
      return;
    }

    try {
      const response = await pondApi.create({
        name: newPondName.trim(),
        color: newPondColor,
      });

      if (response.success) {
        // Reload ponds from database
        await loadPonds();
        setIsPondModalOpen(false);
        setNewPondName('');
        setNewPondColor('blue');
      } else {
        alert(response.message || 'Failed to create pond');
      }
    } catch (error) {
      console.error('Error creating pond:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      alert('Failed to create pond: ' + errorMessage);
    }
  };

  const openModal = () => {
    setFormData({
      pondId: selectedPond === 'all' ? '' : selectedPond.toString(),
      count: '',
      countDate: new Date().toISOString().split('T')[0],
      countTime: new Date().toTimeString().slice(0, 5),
      countedBy: '',
      notes: '',
      countMethod: 'manual',
    });
    setIsModalOpen(true);
  };

  const handleAddFishCount = async () => {
    if (!formData.pondId || !formData.count || !formData.countedBy) {
      alert('Please fill all required fields (Pond, Count, and Counted By)');
      return;
    }

    const pond = ponds.find(p => p.id === parseInt(formData.pondId));
    if (!pond) {
      alert('Invalid pond selection');
      return;
    }

    try {
      const response = await fishCountApi.create({
        date: formData.countDate,
        pondId: parseInt(formData.pondId),
        count: parseInt(formData.count),
        notes: formData.notes || undefined,
        countMethod: formData.countMethod,
        countedBy: formData.countedBy,
      });

      if (response.success) {
        // Reload fish counts from database
        await loadFishCounts();
        setIsModalOpen(false);
        setFormData({
          pondId: '',
          count: '',
          countDate: new Date().toISOString().split('T')[0],
          countTime: new Date().toTimeString().slice(0, 5),
          countedBy: '',
          notes: '',
          countMethod: 'manual',
        });
      } else {
        alert(response.message || 'Failed to add fish count');
      }
    } catch (error) {
      console.error('Error adding fish count:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      alert('Failed to add fish count: ' + errorMessage);
    }
  };

  const handleDeleteRecord = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this fish count record?')) {
      try {
        const response = await fishCountApi.delete(id);
        
        if (response.success) {
          // Reload fish counts from database
          await loadFishCounts();
        } else {
          alert(response.message || 'Failed to delete fish count');
        }
      } catch (error) {
        console.error('Error deleting fish count:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        alert('Failed to delete fish count: ' + errorMessage);
      }
    }
  };

  const getFilteredRecords = () => {
    if (selectedPond === 'all') {
      return fishCountRecords;
    }
    return fishCountRecords.filter(record => record.pondId === selectedPond);
  };

  const getLatestCountByPond = (pondId: number) => {
    const pondRecords = fishCountRecords.filter(record => record.pondId === pondId);
    if (pondRecords.length === 0) return null;
    return pondRecords.reduce((latest, current) => {
      const latestDateTime = new Date(`${latest.countDate}T${latest.countTime}`);
      const currentDateTime = new Date(`${current.countDate}T${current.countTime}`);
      return currentDateTime > latestDateTime ? current : latest;
    });
  };

  const getTotalCountAllPonds = () => {
    const latestCounts = ponds.map(pond => {
      const latest = getLatestCountByPond(pond.id);
      return latest ? latest.count : 0;
    });
    return latestCounts.reduce((sum, count) => sum + count, 0);
  };

  const getCountTrend = (pondId: number) => {
    const pondRecords = fishCountRecords
      .filter(record => record.pondId === pondId)
      .sort((a, b) => {
        const dateA = new Date(`${a.countDate}T${a.countTime}`);
        const dateB = new Date(`${b.countDate}T${b.countTime}`);
        return dateB.getTime() - dateA.getTime();
      });

    if (pondRecords.length < 2) return { trend: 'neutral', change: 0 };

    const latest = pondRecords[0].count;
    const previous = pondRecords[1].count;
    const change = latest - previous;
    const trend = change > 0 ? 'increase' : change < 0 ? 'decrease' : 'neutral';

    return { trend, change };
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <span>🐟</span> Fish Count Tracking
            </h2>
            <p className="text-blue-100">Monitor fish population across all ponds over time</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-200">
              {selectedPond === 'all' ? 'Total Fish Count' : `${ponds.find(p => p.id === selectedPond)?.name} Count`}
            </p>
            <p className="text-4xl font-bold">
              {selectedPond === 'all'
                ? getTotalCountAllPonds().toLocaleString()
                : (getLatestCountByPond(selectedPond)?.count || 0).toLocaleString()
              }
            </p>
            <p className="text-xs text-blue-200 mt-1">Latest count</p>
          </div>
        </div>
      </div>

      {/* Pond Management Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏞️</span>
            <h3 className="text-xl font-bold text-gray-800">Pond Selection</h3>
          </div>
          <button
            onClick={() => setIsPondModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg font-semibold shadow-md transform hover:scale-105 transition-all duration-200 flex items-center gap-2 text-sm"
          >
            <i className="fas fa-plus"></i>
            Add Pond
          </button>
        </div>

        {/* Pond Filter Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setSelectedPond('all')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${selectedPond === 'all'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <i className="fas fa-globe mr-2"></i>
            All Ponds ({fishCountRecords.length} records)
          </button>

          {ponds.map((pond) => {
            const pondColorClasses = pondColors[pond.color];
            const latestCount = getLatestCountByPond(pond.id);
            const recordCount = fishCountRecords.filter(r => r.pondId === pond.id).length;

            return (
              <button
                key={pond.id}
                onClick={() => setSelectedPond(pond.id)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${selectedPond === pond.id
                    ? `${pondColorClasses.bg} ${pondColorClasses.text} border-2 ${pondColorClasses.border} shadow-lg`
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <i className="fas fa-water mr-2"></i>
                {pond.name} ({recordCount})
                {latestCount && (
                  <span className="ml-2 text-xs">• {latestCount.count} fish</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {ponds.map((pond) => {
          const pondColorClasses = pondColors[pond.color];
          const latestCount = getLatestCountByPond(pond.id);
          const recordCount = fishCountRecords.filter(r => r.pondId === pond.id).length;
          const trend = getCountTrend(pond.id);

          return (
            <div
              key={pond.id}
              className={`${pondColorClasses.bg} border-2 ${pondColorClasses.border} rounded-xl p-6 hover:shadow-lg transition-all duration-200`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-4xl">🐠</span>
                <div className={`px-3 py-1 ${pondColorClasses.bg} border ${pondColorClasses.border} rounded-full`}>
                  <span className={`text-sm font-bold ${pondColorClasses.text}`}>
                    {recordCount} counts
                  </span>
                </div>
              </div>
              <h3 className={`text-lg font-bold ${pondColorClasses.text} mb-2`}>{pond.name}</h3>

              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-600">Latest Count</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {latestCount ? latestCount.count.toLocaleString() : 'N/A'}
                  </p>
                </div>

                {recordCount > 0 && trend.change !== 0 && (
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-semibold ${trend.trend === 'increase' ? 'text-green-600' : 'text-red-600'
                      }`}>
                      {trend.trend === 'increase' ? '↑' : '↓'} {Math.abs(trend.change)}
                    </span>
                    <span className="text-xs text-gray-500">vs last count</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add New Count Button */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Showing {getFilteredRecords().length} of {fishCountRecords.length} count records
        </div>
        <button
          onClick={openModal}
          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
        >
          <i className="fas fa-plus-circle"></i>
          Add Fish Count
        </button>
      </div>

      {/* Fish Count Records Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-list-ul text-blue-600"></i>
            Fish Count History
          </h3>
        </div>

        <div className="overflow-x-auto">
          {getFilteredRecords().length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🐟</div>
              <p className="text-gray-500 text-lg mb-2">
                {selectedPond === 'all'
                  ? 'No fish count records yet'
                  : `No counts recorded for ${ponds.find(p => p.id === selectedPond)?.name}`}
              </p>
              <p className="text-gray-400">Click "Add Fish Count" to start tracking</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Pond</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Fish Count</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Method</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Counted By</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Notes</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getFilteredRecords().map((record) => {
                  const pond = ponds.find(p => p.id === record.pondId);
                  const pondColorClasses = pond ? pondColors[pond.color] : pondColors.blue;
                  const method = countMethods.find(m => m.value === record.countMethod);

                  return (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div>
                          <p className="font-semibold">{new Date(record.countDate).toLocaleDateString()}</p>
                          <p className="text-xs text-gray-500">{record.countTime}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${pondColorClasses.bg} ${pondColorClasses.text}`}>
                          <i className="fas fa-water"></i>
                          {record.pondName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-2xl font-bold text-blue-600">
                          {record.count.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <span className="inline-flex items-center gap-1">
                          <span>{method?.icon}</span>
                          <span>{method?.label}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                        <i className="fas fa-user-circle mr-2 text-gray-400"></i>
                        {record.countedBy}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {record.notes || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Fish Count Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <span>🐟</span>
                  Add Fish Count
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Pond Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <i className="fas fa-water text-blue-500"></i>
                  Select Pond *
                </label>
                <select
                  value={formData.pondId}
                  onChange={(e) => setFormData({ ...formData, pondId: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  required
                >
                  <option value="">-- Select Pond --</option>
                  {ponds.map((pond) => (
                    <option key={pond.id} value={pond.id}>
                      {pond.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fish Count */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Fish Count *
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.count}
                  onChange={(e) => setFormData({ ...formData, count: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="Enter number of fish counted"
                  required
                />
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Count Date *
                  </label>
                  <input
                    type="date"
                    value={formData.countDate}
                    onChange={(e) => setFormData({ ...formData, countDate: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Count Time *
                  </label>
                  <input
                    type="time"
                    value={formData.countTime}
                    onChange={(e) => setFormData({ ...formData, countTime: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    required
                  />
                </div>
              </div>

              {/* Count Method */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Count Method *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {countMethods.map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, countMethod: method.value })}
                      className={`p-3 rounded-lg border-2 transition-all ${formData.countMethod === method.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{method.icon}</span>
                        <span className="font-semibold text-sm">{method.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Counted By */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Counted By *
                </label>
                <input
                  type="text"
                  value={formData.countedBy}
                  onChange={(e) => setFormData({ ...formData, countedBy: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="Name of person who counted"
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="Any observations, conditions, or remarks..."
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddFishCount}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white py-3 rounded-lg font-semibold shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <i className="fas fa-check"></i>
                  Save Fish Count
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 border-2 border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Pond Modal */}
      {isPondModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <i className="fas fa-water"></i>
                  Add New Pond
                </h3>
                <button
                  onClick={() => setIsPondModalOpen(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pond Name *
                </label>
                <input
                  type="text"
                  value={newPondName}
                  onChange={(e) => setNewPondName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="e.g., Pond 3, Main Pond, Breeding Pond"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Choose Color *
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {Object.entries(pondColors).map(([colorName, colorClasses]) => (
                    <button
                      key={colorName}
                      type="button"
                      onClick={() => setNewPondColor(colorName)}
                      className={`p-4 rounded-lg border-2 transition-all ${newPondColor === colorName
                          ? `${colorClasses.border} ${colorClasses.bg} ring-2 ring-offset-2`
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                        }`}
                    >
                      <div className={`w-full h-8 rounded ${colorClasses.bg} ${colorClasses.border} border-2`}></div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddPond}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white py-3 rounded-lg font-semibold shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <i className="fas fa-check"></i>
                  Add Pond
                </button>
                <button
                  onClick={() => setIsPondModalOpen(false)}
                  className="px-6 py-3 border-2 border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Note */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <div className="flex items-start gap-3">
          <i className="fas fa-info-circle text-blue-500 text-xl mt-0.5"></i>
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">About Fish Count Tracking</p>
            <p>
              Track fish population counts over time for each pond. Record multiple counts to monitor growth trends,
              mortality rates, and population changes. Use different counting methods based on your situation
              (manual count, net count, visual estimate, or drain & count). The system automatically calculates
              averages and trends to help you analyze population dynamics.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FishCount;
