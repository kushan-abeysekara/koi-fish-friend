import React, { useState, useEffect } from 'react';

interface Alert {
  id: string;
  parameter: string;
  direction: 'high' | 'low';
  magnitude: 'warning' | 'critical';
  currentValue: number;
  threshold: number;
  unit: string;
  duration: number; // minutes
  suggestedAction: string;
  timestamp: Date;
  status: 'active' | 'acknowledged' | 'snoozed' | 'resolved';
  snoozeUntil?: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

interface GroupedAlert {
  parameter: string;
  alerts: Alert[];
  count: number;
  latestTimestamp: Date;
  highestMagnitude: 'warning' | 'critical';
}

const AlertsCenter: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'acknowledged' | 'snoozed' | 'resolved'>('all');
  const [filterMagnitude, setFilterMagnitude] = useState<'all' | 'warning' | 'critical'>('all');
  const [groupDuplicates, setGroupDuplicates] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // Generate mock alerts
  useEffect(() => {
    const mockAlerts: Alert[] = [
      {
        id: 'alert-1',
        parameter: 'pH Level',
        direction: 'high',
        magnitude: 'critical',
        currentValue: 9.2,
        threshold: 8.5,
        unit: 'pH',
        duration: 45,
        suggestedAction: 'Add pH reducer immediately. Check aeration system. Perform partial water change (20%).',
        timestamp: new Date(Date.now() - 45 * 60000),
        status: 'active',
      },
      {
        id: 'alert-2',
        parameter: 'Temperature',
        direction: 'high',
        magnitude: 'warning',
        currentValue: 29.5,
        threshold: 28,
        unit: '°C',
        duration: 120,
        suggestedAction: 'Increase aeration. Add ice packs gradually. Check water pump operation.',
        timestamp: new Date(Date.now() - 120 * 60000),
        status: 'active',
      },
      {
        id: 'alert-3',
        parameter: 'Turbidity',
        direction: 'high',
        magnitude: 'warning',
        currentValue: 32,
        threshold: 25,
        unit: 'NTU',
        duration: 30,
        suggestedAction: 'Clean filter system. Check for overfeeding. Inspect water circulation.',
        timestamp: new Date(Date.now() - 30 * 60000),
        status: 'acknowledged',
        acknowledgedAt: new Date(Date.now() - 15 * 60000),
      },
      {
        id: 'alert-4',
        parameter: 'Dissolved Oxygen',
        direction: 'low',
        magnitude: 'critical',
        currentValue: 4.2,
        threshold: 6,
        unit: 'mg/L',
        duration: 25,
        suggestedAction: 'URGENT: Increase aeration immediately. Check air pump. Add emergency oxygen tablets if available.',
        timestamp: new Date(Date.now() - 25 * 60000),
        status: 'active',
      },
      {
        id: 'alert-5',
        parameter: 'pH Level',
        direction: 'high',
        magnitude: 'critical',
        currentValue: 9.1,
        threshold: 8.5,
        unit: 'pH',
        duration: 40,
        suggestedAction: 'Add pH reducer immediately. Check aeration system. Perform partial water change (20%).',
        timestamp: new Date(Date.now() - 40 * 60000),
        status: 'active',
      },
      {
        id: 'alert-6',
        parameter: 'Temperature',
        direction: 'low',
        magnitude: 'warning',
        currentValue: 14,
        threshold: 15,
        unit: '°C',
        duration: 180,
        suggestedAction: 'Check water heater. Gradually increase temperature. Monitor fish behavior.',
        timestamp: new Date(Date.now() - 180 * 60000),
        status: 'snoozed',
        snoozeUntil: new Date(Date.now() + 30 * 60000),
      },
    ];
    setAlerts(mockAlerts);
  }, []);

  // Group duplicate alerts by parameter
  const getGroupedAlerts = (): GroupedAlert[] => {
    if (!groupDuplicates) return [];

    const grouped = alerts
      .filter(a => a.status === 'active')
      .reduce((acc, alert) => {
        const key = alert.parameter;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(alert);
        return acc;
      }, {} as Record<string, Alert[]>);

    return Object.entries(grouped)
      .filter(([, alerts]) => alerts.length > 1)
      .map(([parameter, alerts]) => ({
        parameter,
        alerts,
        count: alerts.length,
        latestTimestamp: new Date(Math.max(...alerts.map(a => a.timestamp.getTime()))),
        highestMagnitude: (alerts.some(a => a.magnitude === 'critical') ? 'critical' : 'warning') as 'warning' | 'critical',
      }))
      .sort((a, b) => b.latestTimestamp.getTime() - a.latestTimestamp.getTime());
  };

  const filteredAlerts = alerts.filter(alert => {
    const statusMatch = filterStatus === 'all' || alert.status === filterStatus;
    const magnitudeMatch = filterMagnitude === 'all' || alert.magnitude === filterMagnitude;
    
    // Don't show grouped alerts in the main list
    if (groupDuplicates) {
      const groupedParams = getGroupedAlerts().map(g => g.parameter);
      if (groupedParams.includes(alert.parameter) && alert.status === 'active') {
        return false;
      }
    }
    
    return statusMatch && magnitudeMatch;
  });

  const handleAcknowledge = (alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId
          ? { ...alert, status: 'acknowledged', acknowledgedAt: new Date() }
          : alert
      )
    );
  };

  const handleSnooze = (alertId: string, minutes: number) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId
          ? {
              ...alert,
              status: 'snoozed',
              snoozeUntil: new Date(Date.now() + minutes * 60000),
            }
          : alert
      )
    );
  };

  const handleResolve = (alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId
          ? { ...alert, status: 'resolved', resolvedAt: new Date() }
          : alert
      )
    );
  };

  const handleViewTask = (alert: Alert) => {
    setSelectedAlert(alert);
    setShowTaskModal(true);
  };

  const getMagnitudeColor = (magnitude: string) => {
    return magnitude === 'critical'
      ? 'border-red-500 bg-red-50'
      : 'border-yellow-500 bg-yellow-50';
  };

  const getMagnitudeBadge = (magnitude: string) => {
    return magnitude === 'critical' ? (
      <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">CRITICAL</span>
    ) : (
      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold">WARNING</span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Active</span>;
      case 'acknowledged':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">Acknowledged</span>;
      case 'snoozed':
        return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">Snoozed</span>;
      case 'resolved':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Resolved</span>;
      default:
        return null;
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getDirectionIcon = (direction: string) => {
    return direction === 'high' ? (
      <i className="fas fa-arrow-up text-red-500"></i>
    ) : (
      <i className="fas fa-arrow-down text-blue-500"></i>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">🚨</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Alerts Center</h2>
              <p className="text-sm text-gray-500">Monitor and manage water quality alerts</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Auto-refresh:</span>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              ON
            </span>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-exclamation-circle text-2xl text-red-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">Active Alerts</p>
              <p className="text-2xl font-bold text-gray-800">
                {alerts.filter(a => a.status === 'active').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-fire text-2xl text-orange-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">Critical</p>
              <p className="text-2xl font-bold text-gray-800">
                {alerts.filter(a => a.magnitude === 'critical' && a.status === 'active').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-check-circle text-2xl text-blue-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">Acknowledged</p>
              <p className="text-2xl font-bold text-gray-800">
                {alerts.filter(a => a.status === 'acknowledged').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-thumbs-up text-2xl text-green-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">Resolved Today</p>
              <p className="text-2xl font-bold text-gray-800">
                {alerts.filter(a => a.status === 'resolved').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="fas fa-filter mr-2"></i>Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="snoozed">Snoozed</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="fas fa-exclamation-triangle mr-2"></i>Magnitude
            </label>
            <select
              value={filterMagnitude}
              onChange={(e) => setFilterMagnitude(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Levels</option>
              <option value="critical">Critical Only</option>
              <option value="warning">Warning Only</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="fas fa-layer-group mr-2"></i>Grouping
            </label>
            <button
              onClick={() => setGroupDuplicates(!groupDuplicates)}
              className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                groupDuplicates
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {groupDuplicates ? 'Grouped' : 'Ungrouped'}
            </button>
          </div>
        </div>
      </div>

      {/* Grouped Alerts */}
      {groupDuplicates && getGroupedAlerts().length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <i className="fas fa-layer-group text-red-500"></i>
            Grouped Alerts ({getGroupedAlerts().length})
          </h3>
          <div className="space-y-3">
            {getGroupedAlerts().map((group) => (
              <div
                key={group.parameter}
                className={`p-4 rounded-lg border-l-4 ${getMagnitudeColor(group.highestMagnitude)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-copy text-xl text-gray-600"></i>
                    <div>
                      <h4 className="font-semibold text-gray-800">{group.parameter}</h4>
                      <p className="text-xs text-gray-600">
                        {group.count} similar alerts • Latest: {group.latestTimestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  {getMagnitudeBadge(group.highestMagnitude)}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => group.alerts.forEach(a => handleAcknowledge(a.id))}
                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                  >
                    Acknowledge All
                  </button>
                  <button
                    onClick={() => group.alerts.forEach(a => handleSnooze(a.id, 30))}
                    className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 transition-colors"
                  >
                    Snooze All (30m)
                  </button>
                  <button className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors">
                    View Details ({group.count})
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <i className="fas fa-list text-red-500"></i>
            All Alerts ({filteredAlerts.length})
          </h3>
        </div>
        <div className="divide-y divide-gray-100">
          {filteredAlerts.length === 0 ? (
            <div className="p-12 text-center">
              <i className="fas fa-check-circle text-6xl text-green-400 mb-4"></i>
              <p className="text-xl font-semibold text-gray-800 mb-2">No Alerts Found</p>
              <p className="text-gray-500">All parameters are within safe ranges</p>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div key={alert.id} className={`p-6 hover:bg-gray-50 transition-colors border-l-4 ${getMagnitudeColor(alert.magnitude)}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-2">
                      {getDirectionIcon(alert.direction)}
                      <h4 className="font-bold text-gray-800 text-lg">{alert.parameter}</h4>
                      {getMagnitudeBadge(alert.magnitude)}
                      {getStatusBadge(alert.status)}
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm">
                      <div>
                        <span className="text-gray-600">Current:</span>
                        <span className="ml-2 font-semibold text-gray-800">
                          {alert.currentValue} {alert.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Threshold:</span>
                        <span className="ml-2 font-semibold text-gray-800">
                          {alert.threshold} {alert.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Duration:</span>
                        <span className="ml-2 font-semibold text-gray-800">
                          {formatDuration(alert.duration)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Time:</span>
                        <span className="ml-2 font-semibold text-gray-800">
                          {alert.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    {/* Suggested Action */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                      <p className="text-sm font-semibold text-blue-800 mb-1">
                        <i className="fas fa-lightbulb mr-2"></i>Suggested Action:
                      </p>
                      <p className="text-sm text-blue-700">{alert.suggestedAction}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {alert.status === 'active' && (
                        <>
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                          >
                            <i className="fas fa-check mr-2"></i>Acknowledge
                          </button>
                          <button
                            onClick={() => handleSnooze(alert.id, 30)}
                            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-medium"
                          >
                            <i className="fas fa-clock mr-2"></i>Snooze 30m
                          </button>
                          <button
                            onClick={() => handleSnooze(alert.id, 60)}
                            className="px-4 py-2 bg-purple-400 text-white rounded-lg hover:bg-purple-500 transition-colors text-sm font-medium"
                          >
                            <i className="fas fa-clock mr-2"></i>Snooze 1h
                          </button>
                        </>
                      )}
                      {(alert.status === 'active' || alert.status === 'acknowledged') && (
                        <button
                          onClick={() => handleResolve(alert.id)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                        >
                          <i className="fas fa-check-double mr-2"></i>Resolve
                        </button>
                      )}
                      <button
                        onClick={() => handleViewTask(alert)}
                        className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors text-sm font-medium"
                      >
                        <i className="fas fa-tasks mr-2"></i>Create Task
                      </button>
                      <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium">
                        <i className="fas fa-chart-line mr-2"></i>View History
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Task Creation Modal */}
      {showTaskModal && selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">Create Maintenance Task</h3>
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Create a task to address: <span className="font-semibold">{selectedAlert.parameter}</span>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Task Title</label>
                  <input
                    type="text"
                    defaultValue={`Fix ${selectedAlert.parameter} - ${selectedAlert.direction}`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                  <textarea
                    rows={4}
                    defaultValue={selectedAlert.suggestedAction}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  ></textarea>
                </div>
                <div className="flex gap-3 pt-4">
                  <button className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors font-medium">
                    Create Task
                  </button>
                  <button
                    onClick={() => setShowTaskModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsCenter;
