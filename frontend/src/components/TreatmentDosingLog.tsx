import React, { useState, useEffect } from 'react';

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
  status: 'logged' | 'verified' | 'flagged';
}

const TreatmentDosingLog: React.FC = () => {
  const [logs, setLogs] = useState<DosingLog[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
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

  const parameters = ['pH Level', 'Turbidity', 'Temperature', 'Dissolved Oxygen'];

  const units = ['ml', 'L', 'g', 'kg', 'ppm', 'mg/L', 'tablets', 'drops'];

  // Generate mock logs
  useEffect(() => {
    const mockLogs: DosingLog[] = [
      {
        id: 'log-1',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        treatmentType: 'pH Decreaser (Muriatic Acid)',
        dosage: 50,
        unit: 'ml',
        reason: 'pH level too high (9.2)',
        notes: 'Added gradually over 30 minutes. Rechecked pH after 1 hour.',
        recordedBy: 'John Doe',
        parameter: 'pH Level',
        beforeValue: 9.2,
        afterValue: 7.8,
        targetValue: 7.5,
        status: 'verified',
      },
      {
        id: 'log-2',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        treatmentType: 'Water Conditioner',
        dosage: 100,
        unit: 'ml',
        reason: 'Weekly maintenance - remove chlorine and chloramine',
        notes: 'Standard weekly treatment. Water clarity improved significantly.',
        recordedBy: 'Jane Smith',
        status: 'verified',
      },
      {
        id: 'log-3',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        treatmentType: 'Beneficial Bacteria',
        dosage: 2,
        unit: 'tablets',
        reason: 'Boost biological filtration',
        notes: 'Added after filter cleaning to restore bacterial colony.',
        recordedBy: 'John Doe',
        status: 'verified',
      },
      {
        id: 'log-4',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        treatmentType: 'Algae Treatment',
        dosage: 75,
        unit: 'ml',
        reason: 'Green water - algae bloom',
        notes: 'Turned off UV filter during treatment as per instructions.',
        recordedBy: 'Jane Smith',
        parameter: 'Turbidity',
        beforeValue: 45,
        afterValue: 18,
        targetValue: 20,
        status: 'verified',
      },
      {
        id: 'log-5',
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        treatmentType: 'Salt (NaCl)',
        dosage: 5,
        unit: 'kg',
        reason: 'Preventive treatment - reduce stress',
        notes: '0.3% salt concentration for general health. Dissolved salt before adding.',
        recordedBy: 'John Doe',
        status: 'verified',
      },
      {
        id: 'log-6',
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        treatmentType: 'Oxygen Supplement',
        dosage: 3,
        unit: 'tablets',
        reason: 'Low DO reading (4.2 mg/L)',
        notes: 'Emergency treatment. Also increased aeration.',
        recordedBy: 'Jane Smith',
        parameter: 'Dissolved Oxygen',
        beforeValue: 4.2,
        afterValue: 7.1,
        targetValue: 7.0,
        status: 'verified',
      },
    ];
    setLogs(mockLogs);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, photoFile: e.target.files![0] }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newLog: DosingLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date(),
      treatmentType: formData.treatmentType,
      dosage: parseFloat(formData.dosage),
      unit: formData.unit,
      reason: formData.reason,
      notes: formData.notes,
      recordedBy: 'Current User',
      parameter: formData.parameter || undefined,
      targetValue: formData.targetValue ? parseFloat(formData.targetValue) : undefined,
      beforeValue: formData.beforeValue ? parseFloat(formData.beforeValue) : undefined,
      photoUrl: formData.photoFile ? URL.createObjectURL(formData.photoFile) : undefined,
      status: 'logged',
    };

    setLogs(prev => [newLog, ...prev]);
    setShowAddForm(false);
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
  };

  const filteredLogs = logs.filter(log => {
    const typeMatch = filterType === 'all' || log.treatmentType === filterType;
    const paramMatch = filterParameter === 'all' || log.parameter === filterParameter;
    return typeMatch && paramMatch;
  });

  const getStatusBadge = (status: string) => {
    const config = {
      logged: { color: 'bg-blue-100 text-blue-700', icon: 'fa-file-alt' },
      verified: { color: 'bg-green-100 text-green-700', icon: 'fa-check-circle' },
      flagged: { color: 'bg-red-100 text-red-700', icon: 'fa-flag' },
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

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-flask text-green-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">Total Treatments</p>
              <p className="text-xl font-bold text-gray-800">{logs.length}</p>
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
              <p className="text-xl font-bold text-gray-800">
                {logs.filter(log => (Date.now() - log.timestamp.getTime()) < 7 * 24 * 60 * 60 * 1000).length}
              </p>
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
              <p className="text-xl font-bold text-gray-800">
                {(logs.length / Math.max(1, Math.ceil((Date.now() - Math.min(...logs.map(l => l.timestamp.getTime()))) / (7 * 24 * 60 * 60 * 1000)))).toFixed(1)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-fire text-orange-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">Most Used</p>
              <p className="text-xs font-bold text-gray-800">pH Adjuster</p>
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
          {filteredLogs.length === 0 ? (
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
                          {log.timestamp.toLocaleString()}
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
                    <button className="px-3 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors text-sm font-medium">
                      <i className="fas fa-chart-line mr-1"></i>View Impact
                    </button>
                    <button className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium">
                      <i className="fas fa-edit mr-1"></i>Edit
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Treatment Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-500 to-emerald-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">💊</span>
                  <h3 className="text-xl font-bold text-white">Log New Treatment</h3>
                </div>
                <button
                  onClick={() => setShowAddForm(false)}
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
                  className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-semibold"
                >
                  <i className="fas fa-save mr-2"></i>Save Treatment Log
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
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
                    <p className="text-sm text-green-100">{selectedLog.timestamp.toLocaleString()}</p>
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
    </div>
  );
};

export default TreatmentDosingLog;
