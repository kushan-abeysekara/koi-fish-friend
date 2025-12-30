import React, { useState } from 'react';

interface FeedingLog {
  id: string;
  dateTime: string;
  pond: string;
  targetFeed: number;
  actualFeed: number;
  difference: number;
  status: 'Success' | 'Interrupted' | 'Partial';
  feedType: 'Scheduled' | 'Manual';
}

const FeedUsageLogs: React.FC = () => {
  const [selectedPond, setSelectedPond] = useState<'All' | 'Pond A' | 'Pond B'>('All');
  const [selectedStatus, setSelectedStatus] = useState<'All' | 'Success' | 'Interrupted' | 'Partial'>('All');
  const [dateFrom, setDateFrom] = useState<string>('2025-12-20');
  const [dateTo, setDateTo] = useState<string>('2025-12-25');

  // Mock feeding logs data
  const [logs] = useState<FeedingLog[]>([
    {
      id: '1',
      dateTime: '2025-12-25 18:00',
      pond: 'Pond A',
      targetFeed: 4.5,
      actualFeed: 4.5,
      difference: 0.0,
      status: 'Success',
      feedType: 'Scheduled',
    },
    {
      id: '2',
      dateTime: '2025-12-25 12:00',
      pond: 'Pond A',
      targetFeed: 5.0,
      actualFeed: 4.8,
      difference: -0.2,
      status: 'Partial',
      feedType: 'Scheduled',
    },
    {
      id: '3',
      dateTime: '2025-12-25 10:30',
      pond: 'Pond A',
      targetFeed: 3.5,
      actualFeed: 3.5,
      difference: 0.0,
      status: 'Success',
      feedType: 'Manual',
    },
    {
      id: '4',
      dateTime: '2025-12-25 08:30',
      pond: 'Pond A',
      targetFeed: 3.5,
      actualFeed: 3.5,
      difference: 0.0,
      status: 'Success',
      feedType: 'Scheduled',
    },
    {
      id: '5',
      dateTime: '2025-12-25 14:00',
      pond: 'Pond B',
      targetFeed: 5.5,
      actualFeed: 2.1,
      difference: -3.4,
      status: 'Interrupted',
      feedType: 'Scheduled',
    },
    {
      id: '6',
      dateTime: '2025-12-25 09:15',
      pond: 'Pond B',
      targetFeed: 2.0,
      actualFeed: 2.0,
      difference: 0.0,
      status: 'Success',
      feedType: 'Manual',
    },
    {
      id: '7',
      dateTime: '2025-12-25 07:00',
      pond: 'Pond B',
      targetFeed: 4.0,
      actualFeed: 4.0,
      difference: 0.0,
      status: 'Success',
      feedType: 'Scheduled',
    },
    {
      id: '8',
      dateTime: '2025-12-24 18:00',
      pond: 'Pond A',
      targetFeed: 4.5,
      actualFeed: 4.3,
      difference: -0.2,
      status: 'Partial',
      feedType: 'Scheduled',
    },
    {
      id: '9',
      dateTime: '2025-12-24 12:00',
      pond: 'Pond B',
      targetFeed: 5.0,
      actualFeed: 5.0,
      difference: 0.0,
      status: 'Success',
      feedType: 'Scheduled',
    },
    {
      id: '10',
      dateTime: '2025-12-24 06:00',
      pond: 'Pond A',
      targetFeed: 3.5,
      actualFeed: 3.5,
      difference: 0.0,
      status: 'Success',
      feedType: 'Scheduled',
    },
  ]);

  const filteredLogs = logs.filter((log) => {
    const matchesPond = selectedPond === 'All' || log.pond === selectedPond;
    const matchesStatus = selectedStatus === 'All' || log.status === selectedStatus;
    const logDate = new Date(log.dateTime);
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    const matchesDateRange = logDate >= fromDate && logDate <= toDate;
    return matchesPond && matchesStatus && matchesDateRange;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Success':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'Partial':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Interrupted':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getDifferenceColor = (diff: number) => {
    if (Math.abs(diff) < 0.3) return 'text-green-600';
    if (Math.abs(diff) < 1.0) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleExportCSV = () => {
    alert('CSV export feature (UI only)');
  };

  const handleExportPDF = () => {
    alert('PDF export feature (UI only)');
  };

  // Calculate statistics
  const totalTargetFeed = filteredLogs.reduce((sum, log) => sum + log.targetFeed, 0);
  const totalActualFeed = filteredLogs.reduce((sum, log) => sum + log.actualFeed, 0);
  const successRate =
    filteredLogs.length > 0
      ? ((filteredLogs.filter((log) => log.status === 'Success').length / filteredLogs.length) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">📊</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Feed Usage & Logs</h2>
              <p className="text-sm text-gray-500">Track feeding history and usage patterns</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-semibold flex items-center gap-2"
            >
              <i className="fas fa-file-csv"></i>
              Export CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-semibold flex items-center gap-2"
            >
              <i className="fas fa-file-pdf"></i>
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium mb-1">Total Logs</p>
              <p className="text-2xl font-bold text-blue-800">{filteredLogs.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
              <i className="fas fa-list text-white text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium mb-1">Success Rate</p>
              <p className="text-2xl font-bold text-green-800">{successRate}%</p>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
              <i className="fas fa-check-circle text-white text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700 font-medium mb-1">Target Feed</p>
              <p className="text-2xl font-bold text-purple-800">{totalTargetFeed.toFixed(1)} kg</p>
            </div>
            <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
              <i className="fas fa-bullseye text-white text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl p-6 border border-cyan-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-cyan-700 font-medium mb-1">Actual Feed</p>
              <p className="text-2xl font-bold text-cyan-800">{totalActualFeed.toFixed(1)} kg</p>
            </div>
            <div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center">
              <i className="fas fa-weight text-white text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <i className="fas fa-filter text-blue-500"></i>
          Filters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Pond</label>
            <select
              value={selectedPond}
              onChange={(e) => setSelectedPond(e.target.value as 'All' | 'Pond A' | 'Pond B')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Ponds</option>
              <option value="Pond A">Pond A</option>
              <option value="Pond B">Pond B</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) =>
                setSelectedStatus(e.target.value as 'All' | 'Success' | 'Interrupted' | 'Partial')
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Success">Success</option>
              <option value="Partial">Partial</option>
              <option value="Interrupted">Interrupted</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Feeding Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Feeding Logs</h3>
          <p className="text-sm text-gray-500 mt-1">
            Showing {filteredLogs.length} of {logs.length} records
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date & Time</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Pond</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Type</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Target Feed</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Actual Feed</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Difference</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-gray-600 flex items-center gap-2">
                      <i className="fas fa-clock text-blue-500"></i>
                      {log.dateTime}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-800">{log.pond}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        log.feedType === 'Scheduled'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {log.feedType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-gray-800">{log.targetFeed.toFixed(1)} kg</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-gray-800">{log.actualFeed.toFixed(1)} kg</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-bold ${getDifferenceColor(log.difference)}`}>
                      {log.difference > 0 ? '+' : ''}
                      {log.difference.toFixed(1)} kg
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(log.status)}`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {filteredLogs.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12 border border-gray-100 text-center">
          <i className="fas fa-inbox text-6xl text-gray-300 mb-4"></i>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Logs Found</h3>
          <p className="text-gray-500">Try adjusting your filters to see more results</p>
        </div>
      )}
    </div>
  );
};

export default FeedUsageLogs;
