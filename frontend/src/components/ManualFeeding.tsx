import React, { useState } from 'react';

const ManualFeeding: React.FC = () => {
  const [selectedPond, setSelectedPond] = useState<'Pond A' | 'Pond B'>('Pond A');
  const [feedAmount, setFeedAmount] = useState<string>('5.0');
  const [unit, setUnit] = useState<'kg' | 'g'>('kg');
  const [isFeeding, setIsFeeding] = useState(false);
  const [feedingHistory, setFeedingHistory] = useState<
    Array<{ time: string; pond: string; amount: string; unit: string }>
  >([
    { time: '2025-12-25 10:30 AM', pond: 'Pond A', amount: '3.5', unit: 'kg' },
    { time: '2025-12-25 09:15 AM', pond: 'Pond B', amount: '2000', unit: 'g' },
  ]);

  const handleFeedNow = () => {
    if (!feedAmount || parseFloat(feedAmount) <= 0) {
      alert('Please enter a valid feed amount');
      return;
    }

    if (
      confirm(
        `Are you sure you want to manually feed ${feedAmount} ${unit} to ${selectedPond}?\n\nThis requires operator confirmation.`
      )
    ) {
      setIsFeeding(true);

      // Simulate feeding
      setTimeout(() => {
        setIsFeeding(false);
        const newEntry = {
          time: new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
          pond: selectedPond,
          amount: feedAmount,
          unit: unit,
        };
        setFeedingHistory([newEntry, ...feedingHistory]);
        alert(`Manual feeding completed! ${feedAmount} ${unit} dispensed to ${selectedPond}`);
        setFeedAmount('5.0');
      }, 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-3xl">🎯</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Manual Feeding</h2>
            <p className="text-sm text-gray-500">Trigger manual feeding outside scheduled times</p>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <i className="fas fa-exclamation-triangle text-yellow-600 text-2xl mt-1"></i>
          <div>
            <h3 className="font-semibold text-yellow-800 mb-1">Operator Confirmation Required</h3>
            <p className="text-sm text-yellow-700">
              Manual feeding requires operator confirmation. Please ensure you are present at the pond before
              initiating manual feed. This will override any scheduled feeding.
            </p>
          </div>
        </div>
      </div>

      {/* Manual Feed Trigger Card */}
      <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100">
        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <i className="fas fa-hand-pointer text-orange-500"></i>
          Manual Feed Control
        </h3>

        <div className="space-y-6">
          {/* Pond Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <i className="fas fa-water mr-2 text-cyan-500"></i>
              Select Pond
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setSelectedPond('Pond A')}
                disabled={isFeeding}
                className={`py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
                  selectedPond === 'Pond A'
                    ? 'bg-cyan-500 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } ${isFeeding ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <i className="fas fa-water mr-2"></i>
                Pond A
              </button>
              <button
                onClick={() => setSelectedPond('Pond B')}
                disabled={isFeeding}
                className={`py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
                  selectedPond === 'Pond B'
                    ? 'bg-cyan-500 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } ${isFeeding ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <i className="fas fa-water mr-2"></i>
                Pond B
              </button>
            </div>
          </div>

          {/* Feed Amount Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <i className="fas fa-weight mr-2 text-purple-500"></i>
              Feed Amount
            </label>
            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={feedAmount}
                  onChange={(e) => setFeedAmount(e.target.value)}
                  disabled={isFeeding}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-lg font-semibold disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Enter amount"
                />
              </div>
              <div className="w-32">
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as 'kg' | 'g')}
                  disabled={isFeeding}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-lg font-semibold disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="kg">kg</option>
                  <option value="g">grams</option>
                </select>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              <i className="fas fa-info-circle mr-1"></i>
              Recommended: 3-7 kg per feeding for adult koi
            </p>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <i className="fas fa-bolt mr-2 text-yellow-500"></i>
              Quick Presets
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '2 kg', value: '2.0' },
                { label: '3.5 kg', value: '3.5' },
                { label: '5 kg', value: '5.0' },
                { label: '7 kg', value: '7.0' },
              ].map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => {
                    setFeedAmount(preset.value);
                    setUnit('kg');
                  }}
                  disabled={isFeeding}
                  className="py-2 px-4 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feed Now Button */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleFeedNow}
              disabled={isFeeding || !feedAmount || parseFloat(feedAmount) <= 0}
              className={`w-full py-4 rounded-xl font-bold text-xl transition-all flex items-center justify-center gap-3 ${
                isFeeding || !feedAmount || parseFloat(feedAmount) <= 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 shadow-lg hover:shadow-xl'
              }`}
            >
              {isFeeding ? (
                <>
                  <i className="fas fa-spinner fa-spin text-2xl"></i>
                  Feeding in Progress...
                </>
              ) : (
                <>
                  <i className="fas fa-play-circle text-2xl"></i>
                  Feed Now
                </>
              )}
            </button>
          </div>

          {/* Current Status */}
          {isFeeding && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <i className="fas fa-spinner fa-spin text-blue-500 text-xl"></i>
                <div>
                  <p className="text-blue-700 font-semibold">Dispensing feed...</p>
                  <p className="text-sm text-blue-600">
                    {feedAmount} {unit} being dispensed to {selectedPond}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Manual Feedings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <i className="fas fa-history text-gray-600"></i>
            Recent Manual Feedings
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Time</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Pond</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {feedingHistory.slice(0, 5).map((entry, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-gray-600 flex items-center gap-2">
                      <i className="fas fa-clock text-blue-500"></i>
                      {entry.time}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-800">{entry.pond}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-purple-600">
                      {entry.amount} {entry.unit}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safety Information */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <i className="fas fa-shield-alt text-blue-600"></i>
          Safety Guidelines
        </h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <i className="fas fa-check-circle text-green-600 mt-0.5"></i>
            <span>Always monitor the pond during manual feeding</span>
          </li>
          <li className="flex items-start gap-2">
            <i className="fas fa-check-circle text-green-600 mt-0.5"></i>
            <span>Do not exceed recommended feeding amounts</span>
          </li>
          <li className="flex items-start gap-2">
            <i className="fas fa-check-circle text-green-600 mt-0.5"></i>
            <span>Wait at least 4 hours between manual feedings</span>
          </li>
          <li className="flex items-start gap-2">
            <i className="fas fa-check-circle text-green-600 mt-0.5"></i>
            <span>Check water quality after feeding</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default ManualFeeding;
