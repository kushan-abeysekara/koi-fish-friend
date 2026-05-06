import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pondApi, treatmentLogApi, type TreatmentLog, type TreatmentStats } from '../services/api';

interface DosingLog {
  id: string;
  timestamp: Date;
  treatmentType: string;
  dosage: number;
  unit: string;
  reason: string;
  notes: string;
  recordedBy: string;
  parameter?: string;
  targetValue?: number;
  beforeValue?: number;
  afterValue?: number;
  photoUrl?: string;
  status: 'logged' | 'verified' | 'flagged' | 'completed';
  verifiedAt?: Date;
  verifiedBy?: string;
  completedAt?: Date;
  completedBy?: string;
}

const TreatmentDosingLog: React.FC = () => {
  const location = useLocation();

  // Get current logged-in user from localStorage
  const getCurrentUser = () => {
    return localStorage.getItem('username') || 'Admin';
  };

  const [logs, setLogs] = useState<DosingLog[]>([]);
  const [ponds, setPonds] = useState<any[]>([]);
  const [selectedPondId, setSelectedPondId] = useState<number>(1);
  const [stats, setStats] = useState<TreatmentStats>({ total: 0, thisWeek: 0, avgPerWeek: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLog, setEditingLog] = useState<DosingLog | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showAfterValueForm, setShowAfterValueForm] = useState(false);
  const [filterType, setFilterType] = useState<'all' | string>('all');
  const [filterParameter, setFilterParameter] = useState<'all' | string>('all');
  const [selectedLog, setSelectedLog] = useState<DosingLog | null>(null);
  const [showLogDetail, setShowLogDetail] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    treatmentType: '',
    dosage: '',
    unit: 'ml',
    reason: '',
    notes: '',
    parameter: '',
    targetValue: '',
    beforeValue: '',
    photoFile: null as File | null,
  });

  const treatmentTypes = [
    'pH Increaser (Sodium Carbonate)',
    'pH Decreaser (Muriatic Acid)',
    'Water Conditioner',
    'Algae Treatment',
    'Antibacterial Treatment',
    'Antifungal Treatment',
    'Salt (NaCl)',
    'Beneficial Bacteria',
    'Oxygen Supplement',
    'Water Clarifier',
    'Stress Reducer',
    'Other',
  ];

  const parameters = ['pH Level', 'Turbidity', 'Temperature', 'Dissolved Oxygen', 'CO₂ Level', 'Ammonia (NH₃)', 'Air Quality Index'];

  const units = ['ml', 'L', 'g', 'kg', 'ppm', 'mg/L', 'tablets', 'drops'];

  // Auto-open form with pre-filled parameter when navigated from sensor card
  useEffect(() => {
    const state = location.state as { openForm?: boolean; parameter?: string } | null;
    if (state?.openForm && state.parameter) {
      setFormData(prev => ({ ...prev, parameter: state.parameter! }));
      setShowAddForm(true);
      // Clear location state so re-renders don't re-trigger
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

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
      } catch (err: any) {
        console.error('Error fetching ponds:', err);
        setError('Failed to load ponds');
      }
    };
    fetchPonds();
  }, []);

  // Fetch treatment logs and stats when pond changes
  useEffect(() => {
    if (!selectedPondId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch logs
        const logsResponse = await treatmentLogApi.getByPond(selectedPondId);
        if (logsResponse.success && logsResponse.data) {
          // Convert backend format to component format
          const convertedLogs = logsResponse.data.map((log: TreatmentLog) => ({
            id: log.id.toString(),
            timestamp: new Date(log.timestamp),
            treatmentType: log.treatmentType,
            dosage: log.dosage,
            unit: log.unit,
            reason: log.reason,
            notes: log.notes || '',
            recordedBy: log.recordedBy,
            parameter: log.parameter,
            targetValue: log.targetValue,
            beforeValue: log.beforeValue,
            afterValue: log.afterValue,
            photoUrl: log.photoUrl,
            status: log.status,
            verifiedBy: log.verifiedBy,
            verifiedAt: log.verifiedAt ? new Date(log.verifiedAt) : undefined,
            completedBy: log.completedBy,
            completedAt: log.completedAt ? new Date(log.completedAt) : undefined,
          }));
          setLogs(convertedLogs);
        }

        // Fetch stats
        const statsResponse = await treatmentLogApi.getStats(selectedPondId);
        if (statsResponse.success && statsResponse.data) {
          setStats(statsResponse.data);
        }
      } catch (err: any) {
        console.error('Error fetching treatment data:', err);
        setError('Failed to load treatment logs');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedPondId, filterType, filterParameter]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, photoFile: e.target.files![0] }));
    }
  };

  const handleEditClick = (log: DosingLog) => {
    setEditingLog(log);
    setFormData({
      treatmentType: log.treatmentType,
      dosage: log.dosage.toString(),
      unit: log.unit,
      reason: log.reason,
      notes: log.notes || '',
      parameter: log.parameter || '',
      targetValue: log.targetValue?.toString() || '',
      beforeValue: log.beforeValue?.toString() || '',
      photoFile: null,
    });
    setShowEditForm(true);
  };

  const handleAfterValueClick = (log: DosingLog) => {
    setEditingLog(log);
    setShowAfterValueForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      const logData = {
        pondId: selectedPondId,
        timestamp: editingLog ? editingLog.timestamp.toISOString() : new Date().toISOString(),
        treatmentType: formData.treatmentType,
        dosage: parseFloat(formData.dosage),
        unit: formData.unit,
        reason: formData.reason,
        notes: formData.notes,
        recordedBy: editingLog ? editingLog.recordedBy : getCurrentUser(),
        parameter: formData.parameter || undefined,
        targetValue: formData.targetValue ? parseFloat(formData.targetValue) : undefined,
        beforeValue: formData.beforeValue ? parseFloat(formData.beforeValue) : undefined,
        afterValue: editingLog?.afterValue,
        photoUrl: editingLog?.photoUrl,
        status: (editingLog?.status || 'logged') as 'logged' | 'verified' | 'flagged' | 'completed',
      };

      let response;
      if (editingLog) {
        // Update existing log
        response = await treatmentLogApi.update(parseInt(editingLog.id), logData);
      } else {
        // Create new log
        response = await treatmentLogApi.create(logData);
      }
      
      if (response.success && response.data) {
        const updatedLog: DosingLog = {
          id: response.data.id.toString(),
          timestamp: new Date(response.data.timestamp),
          treatmentType: response.data.treatmentType,
          dosage: response.data.dosage,
          unit: response.data.unit,
          reason: response.data.reason,
          notes: response.data.notes || '',
          recordedBy: response.data.recordedBy,
          parameter: response.data.parameter,
          targetValue: response.data.targetValue,
          beforeValue: response.data.beforeValue,
          afterValue: response.data.afterValue,
          photoUrl: response.data.photoUrl,
          status: response.data.status,
        };
        
        if (editingLog) {
          // Update existing log in list
          setLogs(prev => prev.map(log => log.id === editingLog.id ? updatedLog : log));
        } else {
          // Add new log to list
          setLogs(prev => [updatedLog, ...prev]);
        }
        
        // Refresh stats
        const statsResponse = await treatmentLogApi.getStats(selectedPondId);
        if (statsResponse.success && statsResponse.data) {
          setStats(statsResponse.data);
        }
        
        setShowAddForm(false);
        setShowEditForm(false);
        setEditingLog(null);
        setFormData({
          treatmentType: '',
          dosage: '',
          unit: 'ml',
          reason: '',
          notes: '',
          parameter: '',
          targetValue: '',
          beforeValue: '',
          photoFile: null,
        });
      }
    } catch (err: any) {
      console.error('Error saving treatment log:', err);
      setError(editingLog ? 'Failed to update treatment log' : 'Failed to save treatment log');
    } finally {
      setLoading(false);
    }
  };

  const handleAfterValueSubmit = async (afterValue: number) => {
    if (!editingLog) return;
    
    try {
      setLoading(true);
      const currentUser = getCurrentUser();
      const response = await treatmentLogApi.update(parseInt(editingLog.id), {
        afterValue,
        status: 'verified' as const,
        verifiedBy: currentUser,
      });
      
      if (response.success && response.data) {
        const updatedLog: DosingLog = {
          ...editingLog,
          afterValue: response.data.afterValue,
          status: response.data.status,
          verifiedBy: response.data.verifiedBy,
          verifiedAt: response.data.verifiedAt ? new Date(response.data.verifiedAt) : undefined,
        };
        setLogs(prev => prev.map(log => log.id === editingLog.id ? updatedLog : log));
        setShowAfterValueForm(false);
        setEditingLog(null);
      }
    } catch (err: any) {
      console.error('Error updating after value:', err);
      setError('Failed to update after value');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('Are you sure you want to delete this treatment log?')) return;
    
    try {
      setLoading(true);
      const response = await treatmentLogApi.delete(parseInt(logId));
      
      if (response.success) {
        setLogs(prev => prev.filter(log => log.id !== logId));
        
        // Refresh stats
        const statsResponse = await treatmentLogApi.getStats(selectedPondId);
        if (statsResponse.success && statsResponse.data) {
          setStats(statsResponse.data);
        }
      }
    } catch (err: any) {
      console.error('Error deleting treatment log:', err);
      setError('Failed to delete treatment log');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkComplete = async (logId: string) => {
    try {
      setLoading(true);
      const currentUser = getCurrentUser();
      const response = await treatmentLogApi.update(parseInt(logId), {
        status: 'completed' as const,
        completedBy: currentUser,
      });
      
      if (response.success && response.data) {
        const updatedLog = logs.find(log => log.id === logId);
        if (updatedLog) {
          const newLog: DosingLog = {
            ...updatedLog,
            status: 'completed',
            completedBy: response.data.completedBy,
            completedAt: response.data.completedAt ? new Date(response.data.completedAt) : undefined,
          };
          setLogs(prev => prev.map(log => log.id === logId ? newLog : log));
        }
      }
    } catch (err: any) {
      console.error('Error marking treatment as complete:', err);
      setError('Failed to mark treatment as complete');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs
    .filter(log => {
      const typeMatch = filterType === 'all' || log.treatmentType === filterType;
      const paramMatch = filterParameter === 'all' || log.parameter === filterParameter;
      return typeMatch && paramMatch;
    })
    .sort((a, b) => {
      // Define priority: verified (1) > logged/flagged (2) > completed (3)
      const getPriority = (status: string) => {
        if (status === 'verified') return 1;
        if (status === 'completed') return 3;
        return 2; // logged or flagged
      };
      
      const aPriority = getPriority(a.status);
      const bPriority = getPriority(b.status);
      
      // Sort by priority first
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Then sort by timestamp (newest first) within same priority
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

  // Calculate unverified logs count (exclude verified and completed)
  const unverifiedCount = logs.filter(log => log.status !== 'verified' && log.status !== 'completed').length;

  const getStatusBadge = (status: string) => {
    const config = {
      logged: { color: 'bg-blue-100 text-blue-700', icon: 'fa-file-alt' },
      verified: { color: 'bg-green-100 text-green-700', icon: 'fa-check-circle' },
      flagged: { color: 'bg-red-100 text-red-700', icon: 'fa-flag' },
      completed: { color: 'bg-purple-100 text-purple-700', icon: 'fa-check-double' },
    };
    const { color, icon } = config[status as keyof typeof config] || config.logged;
    return (
      <span className={`px-3 py-1 ${color} rounded-full text-xs font-semibold flex items-center gap-1`}>
        <i className={`fas ${icon}`}></i>
        {status}
      </span>
    );
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Treatment', 'Dosage', 'Unit', 'Reason', 'Recorded By', 'Parameter', 'Before', 'After', 'Notes'];
    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.treatmentType,
      log.dosage,
      log.unit,
      log.reason,
      log.recordedBy,
      log.parameter || '',
      log.beforeValue || '',
      log.afterValue || '',
      log.notes,
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dosing_log_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">💊</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Treatment & Dosing Log</h2>
              <p className="text-sm text-gray-500">Manual water treatment tracking (Human-in-the-loop)</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-semibold flex items-center gap-2"
          >
            <i className="fas fa-plus"></i>
            Log Treatment
          </button>
        </div>
      </div>

      {/* Important Notice */}
      <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4 flex items-start gap-3">
        <i className="fas fa-exclamation-triangle text-yellow-600 text-xl mt-1"></i>
        <div>
          <p className="font-semibold text-yellow-800 mb-1">Manual Dosing Only - No Automation</p>
          <p className="text-sm text-yellow-700">
            This system does NOT automatically dose chemicals. All treatments must be manually added by authorized personnel. 
            Always follow manufacturer guidelines and safety procedures.
          </p>
        </div>
      </div>

      {/* Pond Selection */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          <i className="fas fa-water mr-2 text-blue-500"></i>Select Pond
        </label>
        <select
          value={selectedPondId}
          onChange={(e) => setSelectedPondId(Number(e.target.value))}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {ponds.map(pond => (
            <option key={pond.id} value={pond.id}>{pond.name}</option>
          ))}
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start gap-3">
          <i className="fas fa-exclamation-circle text-red-600 text-xl mt-1"></i>
          <div>
            <p className="font-semibold text-red-800 mb-1">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-flask text-green-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">Total Treatments</p>
              <p className="text-xl font-bold text-gray-800">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-calendar-week text-blue-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">This Week</p>
              <p className="text-xl font-bold text-gray-800">{stats.thisWeek}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-chart-line text-purple-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">Avg/Week</p>
              <p className="text-xl font-bold text-gray-800">{stats.avgPerWeek}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              unverifiedCount > 0 ? 'bg-yellow-100' : 'bg-green-100'
            }`}>
              <i className={`fas fa-clock ${
                unverifiedCount > 0 ? 'text-yellow-600' : 'text-green-600'
              }`}></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">Unverified</p>
              <p className={`text-xl font-bold ${
                unverifiedCount > 0 ? 'text-yellow-800' : 'text-green-800'
              }`}>{unverifiedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Export */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="fas fa-filter mr-2"></i>Treatment Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Types</option>
              {treatmentTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="fas fa-flask mr-2"></i>Parameter
            </label>
            <select
              value={filterParameter}
              onChange={(e) => setFilterParameter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Parameters</option>
              {parameters.map(param => (
                <option key={param} value={param}>{param}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="fas fa-calendar mr-2"></i>Date Range
            </label>
            <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="fas fa-download mr-2"></i>Export
            </label>
            <button
              onClick={exportToCSV}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              <i className="fas fa-file-csv mr-2"></i>Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Dosing Log List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <i className="fas fa-history text-green-500"></i>
            Treatment History ({filteredLogs.length})
          </h3>
        </div>
        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-12 text-center">
              <i className="fas fa-spinner fa-spin text-6xl text-green-500 mb-4"></i>
              <p className="text-xl font-semibold text-gray-800 mb-2">Loading...</p>
              <p className="text-gray-500">Fetching treatment logs</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center">
              <i className="fas fa-clipboard-list text-6xl text-gray-300 mb-4"></i>
              <p className="text-xl font-semibold text-gray-800 mb-2">No Treatment Logs</p>
              <p className="text-gray-500">Start logging your water treatments</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedLog(log);
                  setShowLogDetail(true);
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">💊</span>
                      <h4 className="font-bold text-gray-800 text-lg">{log.treatmentType}</h4>
                      {getStatusBadge(log.status)}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                      <div>
                        <span className="text-gray-600">Dosage:</span>
                        <span className="ml-2 font-semibold text-gray-800">
                          {log.dosage} {log.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Date/Time:</span>
                        <span className="ml-2 font-semibold text-gray-800">
                          {log.timestamp.toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })} {log.timestamp.toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Recorded By:</span>
                        <span className="ml-2 font-semibold text-gray-800">{log.recordedBy}</span>
                      </div>
                      {log.parameter && (
                        <div>
                          <span className="text-gray-600">Parameter:</span>
                          <span className="ml-2 font-semibold text-gray-800">{log.parameter}</span>
                        </div>
                      )}
                    </div>

                    {log.parameter && (log.beforeValue || log.afterValue) && (
                      <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-3 mb-3">
                        <div className="flex items-center gap-4 text-sm">
                          {log.beforeValue && (
                            <div>
                              <span className="text-blue-700 font-semibold">Before:</span>
                              <span className="ml-2 text-blue-800 font-bold">{log.beforeValue}</span>
                            </div>
                          )}
                          <i className="fas fa-arrow-right text-gray-500"></i>
                          {log.targetValue && (
                            <div>
                              <span className="text-purple-700 font-semibold">Target:</span>
                              <span className="ml-2 text-purple-800 font-bold">{log.targetValue}</span>
                            </div>
                          )}
                          {log.afterValue && (
                            <>
                              <i className="fas fa-arrow-right text-gray-500"></i>
                              <div>
                                <span className="text-green-700 font-semibold">After:</span>
                                <span className="ml-2 text-green-800 font-bold">{log.afterValue}</span>
                                {log.verifiedBy && (
                                  <span className="ml-2 text-xs text-green-600">
                                    (by {log.verifiedBy})
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm font-semibold text-amber-800 mb-1">
                        <i className="fas fa-info-circle mr-2"></i>Reason:
                      </p>
                      <p className="text-sm text-amber-700">{log.reason}</p>
                      {log.notes && (
                        <>
                          <p className="text-sm font-semibold text-amber-800 mt-2 mb-1">
                            <i className="fas fa-sticky-note mr-2"></i>Notes:
                          </p>
                          <p className="text-sm text-amber-700">{log.notes}</p>
                        </>
                      )}
                    </div>

                    {log.photoUrl && (
                      <div className="mt-3">
                        <img
                          src={log.photoUrl}
                          alt="Treatment photo"
                          className="h-32 rounded-lg border border-gray-200 object-cover"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClick(log);
                      }}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                    >
                      <i className="fas fa-edit mr-1"></i>Edit
                    </button>
                    {log.parameter && log.beforeValue && !log.afterValue && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAfterValueClick(log);
                        }}
                        className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                      >
                        <i className="fas fa-check mr-1"></i>Record After
                      </button>
                    )}
                    {log.status === 'verified' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkComplete(log.id);
                        }}
                        className="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-medium"
                      >
                        <i className="fas fa-check-double mr-1"></i>Complete
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLog(log.id);
                      }}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                    >
                      <i className="fas fa-trash mr-1"></i>Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Treatment Form Modal */}
      {(showAddForm || showEditForm) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-500 to-emerald-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">💊</span>
                  <h3 className="text-xl font-bold text-white">{editingLog ? 'Edit Treatment' : 'Log New Treatment'}</h3>
                </div>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setShowEditForm(false);
                    setEditingLog(null);
                  }}
                  className="text-white hover:text-gray-200"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <i className="fas fa-shield-alt text-red-600 text-lg mt-1"></i>
                <div>
                  <p className="text-sm font-semibold text-red-800 mb-1">Safety First!</p>
                  <p className="text-xs text-red-700">
                    Always wear protective equipment. Follow manufacturer dosing instructions. Never mix chemicals.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Treatment Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="treatmentType"
                  value={formData.treatmentType}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select treatment type</option>
                  {treatmentTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Dosage <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="dosage"
                    value={formData.dosage}
                    onChange={handleInputChange}
                    step="0.01"
                    required
                    placeholder="e.g., 50"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {units.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reason for Treatment <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., pH level too high (9.2)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Any additional observations or instructions..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                ></textarea>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Linked Parameter
                  </label>
                  <select
                    name="parameter"
                    value={formData.parameter}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">None</option>
                    {parameters.map(param => (
                      <option key={param} value={param}>{param}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Before Value
                  </label>
                  <input
                    type="number"
                    name="beforeValue"
                    value={formData.beforeValue}
                    onChange={handleInputChange}
                    step="0.1"
                    placeholder="Optional"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Target Value
                  </label>
                  <input
                    type="number"
                    name="targetValue"
                    value={formData.targetValue}
                    onChange={handleInputChange}
                    step="0.1"
                    placeholder="Optional"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Photo (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Upload a photo of the treatment product, dosage measurement, or before/after condition
                </p>
              </div>

              {formData.photoFile && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Preview:</p>
                  <img
                    src={URL.createObjectURL(formData.photoFile)}
                    alt="Preview"
                    className="h-40 rounded-lg object-cover"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-save'} mr-2`}></i>
                  {editingLog ? 'Update Treatment Log' : 'Save Treatment Log'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setShowEditForm(false);
                    setEditingLog(null);
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Detail Modal */}
      {showLogDetail && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-500 to-emerald-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">💊</span>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedLog.treatmentType}</h3>
                    <p className="text-sm text-green-100">
                      Created: {selectedLog.timestamp.toLocaleString()}
                    </p>
                    {selectedLog.completedAt && (
                      <p className="text-xs text-green-100 flex items-center gap-1 mt-1">
                        <i className="fas fa-check-double"></i>
                        Completed: {selectedLog.completedAt.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowLogDetail(false)}
                  className="text-white hover:text-gray-200"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                {getStatusBadge(selectedLog.status)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Dosage</p>
                  <p className="text-2xl font-bold text-gray-800">{selectedLog.dosage} {selectedLog.unit}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Recorded By</p>
                  <p className="text-lg font-semibold text-gray-800">{selectedLog.recordedBy}</p>
                </div>
              </div>

              {/* Timeline - Created, Verified, Completed */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <i className="fas fa-clock text-blue-600"></i>
                  Treatment Timeline
                </h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-plus text-white text-xs"></i>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Created</p>
                      <p className="text-sm text-gray-600">
                        {selectedLog.timestamp.toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })} at {selectedLog.timestamp.toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                      <p className="text-xs text-gray-500">by {selectedLog.recordedBy}</p>
                    </div>
                  </div>
                  
                  {selectedLog.verifiedAt && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-check text-white text-xs"></i>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Verified</p>
                        <p className="text-sm text-gray-600">
                          {selectedLog.verifiedAt.toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })} at {selectedLog.verifiedAt.toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                        {selectedLog.verifiedBy && (
                          <p className="text-xs text-gray-500">by {selectedLog.verifiedBy}</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {selectedLog.completedAt && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-check-double text-white text-xs"></i>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Completed</p>
                        <p className="text-sm text-gray-600">
                          {selectedLog.completedAt.toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })} at {selectedLog.completedAt.toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                        {selectedLog.completedBy && (
                          <p className="text-xs text-gray-500">by {selectedLog.completedBy}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedLog.parameter && (
                <div className="bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Parameter Impact: {selectedLog.parameter}</p>
                  <div className="flex items-center justify-between">
                    {selectedLog.beforeValue && (
                      <div className="text-center">
                        <p className="text-xs text-blue-600 font-semibold mb-1">BEFORE</p>
                        <p className="text-2xl font-bold text-blue-700">{selectedLog.beforeValue}</p>
                      </div>
                    )}
                    <i className="fas fa-arrow-right text-2xl text-gray-400"></i>
                    {selectedLog.targetValue && (
                      <div className="text-center">
                        <p className="text-xs text-purple-600 font-semibold mb-1">TARGET</p>
                        <p className="text-2xl font-bold text-purple-700">{selectedLog.targetValue}</p>
                      </div>
                    )}
                    {selectedLog.afterValue && (
                      <>
                        <i className="fas fa-arrow-right text-2xl text-gray-400"></i>
                        <div className="text-center">
                          <p className="text-xs text-green-600 font-semibold mb-1">AFTER</p>
                          <p className="text-2xl font-bold text-green-700">{selectedLog.afterValue}</p>
                          {selectedLog.verifiedBy && (
                            <p className="text-xs text-green-600 mt-1">
                              Verified by {selectedLog.verifiedBy}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-gray-800 mb-2">Reason</h4>
                <p className="text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-3">{selectedLog.reason}</p>
              </div>

              {selectedLog.notes && (
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Additional Notes</h4>
                  <p className="text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">{selectedLog.notes}</p>
                </div>
              )}

              {selectedLog.photoUrl && (
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Photo</h4>
                  <img
                    src={selectedLog.photoUrl}
                    alt="Treatment"
                    className="w-full rounded-lg border-2 border-gray-200"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <button className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors font-medium">
                  <i className="fas fa-chart-line mr-2"></i>View Impact on Timeline
                </button>
                <button
                  onClick={() => setShowLogDetail(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* After Value Update Modal */}
      {showAfterValueForm && editingLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-500 to-emerald-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">✅</span>
                  <h3 className="text-xl font-bold text-white">Record After Value</h3>
                </div>
                <button
                  onClick={() => {
                    setShowAfterValueForm(false);
                    setEditingLog(null);
                  }}
                  className="text-white hover:text-gray-200"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-800 mb-2">Treatment Details:</p>
                <p className="text-sm text-blue-700">
                  <strong>Treatment:</strong> {editingLog.treatmentType}
                </p>
                <p className="text-sm text-blue-700">
                  <strong>Dosage:</strong> {editingLog.dosage} {editingLog.unit}
                </p>
                {editingLog.parameter && (
                  <>
                    <p className="text-sm text-blue-700 mt-2">
                      <strong>Parameter:</strong> {editingLog.parameter}
                    </p>
                    <p className="text-sm text-blue-700">
                      <strong>Before:</strong> {editingLog.beforeValue}
                    </p>
                    {editingLog.targetValue && (
                      <p className="text-sm text-blue-700">
                        <strong>Target:</strong> {editingLog.targetValue}
                      </p>
                    )}
                  </>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const afterValue = parseFloat((e.target as any).afterValue.value);
                  if (!isNaN(afterValue)) {
                    handleAfterValueSubmit(afterValue);
                  }
                }}
              >
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    After Value <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="afterValue"
                    step="0.1"
                    required
                    placeholder="Enter measured value after treatment"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Measure the parameter value after the treatment has taken effect
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-check'} mr-2`}></i>
                    Save After Value
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAfterValueForm(false);
                      setEditingLog(null);
                    }}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TreatmentDosingLog;
