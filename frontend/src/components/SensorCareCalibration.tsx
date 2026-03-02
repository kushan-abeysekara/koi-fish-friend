import React, { useState, useEffect } from 'react';

interface CalibrationRecord {
  id: string;
  sensorType: 'pH' | 'turbidity' | 'temperature' | 'do';
  sensorName: string;
  calibrationDate: Date;
  calibratedBy: string;
  calibrationValues: Record<string, number>;
  notes: string;
  nextDueDate: Date;
  status: 'current' | 'due-soon' | 'overdue';
}

interface MaintenanceReminder {
  id: string;
  sensorType: 'pH' | 'turbidity' | 'temperature' | 'do';
  taskType: 'cleaning' | 'calibration' | 'membrane-replacement' | 'inspection';
  description: string;
  frequency: number; // days
  lastPerformed: Date;
  nextDue: Date;
  status: 'ok' | 'due-soon' | 'overdue';
}

const SensorCareCalibration: React.FC = () => {
  const [calibrationRecords, setCalibrationRecords] = useState<CalibrationRecord[]>([]);
  const [reminders, setReminders] = useState<MaintenanceReminder[]>([]);
  const [showCalibrationWizard, setShowCalibrationWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  
  // Calibration wizard form data
  const [calibrationData, setCalibrationData] = useState({
    sensorType: 'pH' as 'pH' | 'turbidity' | 'temperature' | 'do',
    point1: '',
    point2: '',
    point3: '',
    notes: '',
  });

  // Generate mock data
  useEffect(() => {
    const mockRecords: CalibrationRecord[] = [
      {
        id: 'cal-1',
        sensorType: 'pH',
        sensorName: 'pH Sensor - Main Pond',
        calibrationDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        calibratedBy: 'John Doe',
        calibrationValues: { point1: 4.0, point2: 7.0, point3: 10.0 },
        notes: 'Standard 3-point calibration completed successfully',
        nextDueDate: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000),
        status: 'current',
      },
      {
        id: 'cal-2',
        sensorType: 'turbidity',
        sensorName: 'Turbidity Sensor - Main',
        calibrationDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        calibratedBy: 'Jane Smith',
        calibrationValues: { zero: 0, span: 100 },
        notes: 'Sensor lens cleaned before calibration',
        nextDueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        status: 'due-soon',
      },
      {
        id: 'cal-3',
        sensorType: 'do',
        sensorName: 'DO Sensor - Primary',
        calibrationDate: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000),
        calibratedBy: 'John Doe',
        calibrationValues: { zero: 0, span: 100 },
        notes: 'Membrane replaced before calibration',
        nextDueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        status: 'overdue',
      },
    ];

    const mockReminders: MaintenanceReminder[] = [
      {
        id: 'rem-1',
        sensorType: 'turbidity',
        taskType: 'cleaning',
        description: 'Clean turbidity sensor lens',
        frequency: 7,
        lastPerformed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        nextDue: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        status: 'due-soon',
      },
      {
        id: 'rem-2',
        sensorType: 'pH',
        taskType: 'calibration',
        description: 'pH sensor calibration',
        frequency: 90,
        lastPerformed: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        nextDue: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000),
        status: 'ok',
      },
      {
        id: 'rem-3',
        sensorType: 'do',
        taskType: 'membrane-replacement',
        description: 'Replace DO sensor membrane',
        frequency: 180,
        lastPerformed: new Date(Date.now() - 190 * 24 * 60 * 60 * 1000),
        nextDue: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        status: 'overdue',
      },
      {
        id: 'rem-4',
        sensorType: 'temperature',
        taskType: 'inspection',
        description: 'Verify temperature sensor accuracy',
        frequency: 30,
        lastPerformed: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        nextDue: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        status: 'ok',
      },
    ];

    setCalibrationRecords(mockRecords);
    setReminders(mockReminders);
  }, []);

  const getSensorIcon = (type: string) => {
    const icons = {
      pH: '⚗️',
      turbidity: '💧',
      temperature: '🌡️',
      do: '🫧',
    };
    return icons[type as keyof typeof icons] || '📊';
  };

  const getStatusBadge = (status: string) => {
    const config = {
      current: { color: 'bg-green-100 text-green-700', icon: 'fa-check-circle', text: 'Current' },
      ok: { color: 'bg-green-100 text-green-700', icon: 'fa-check-circle', text: 'OK' },
      'due-soon': { color: 'bg-yellow-100 text-yellow-700', icon: 'fa-exclamation-triangle', text: 'Due Soon' },
      overdue: { color: 'bg-red-100 text-red-700', icon: 'fa-exclamation-circle', text: 'Overdue' },
    };
    const { color, icon, text } = config[status as keyof typeof config] || config.ok;
    return (
      <span className={`px-3 py-1 ${color} rounded-full text-xs font-semibold flex items-center gap-1`}>
        <i className={`fas ${icon}`}></i>
        {text}
      </span>
    );
  };

  const handleCalibrationSubmit = () => {
    const newRecord: CalibrationRecord = {
      id: `cal-${Date.now()}`,
      sensorType: calibrationData.sensorType,
      sensorName: `${calibrationData.sensorType.toUpperCase()} Sensor`,
      calibrationDate: new Date(),
      calibratedBy: 'Current User',
      calibrationValues: {
        point1: parseFloat(calibrationData.point1),
        point2: parseFloat(calibrationData.point2),
        point3: parseFloat(calibrationData.point3),
      },
      notes: calibrationData.notes,
      nextDueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      status: 'current',
    };

    setCalibrationRecords(prev => [newRecord, ...prev]);
    setShowCalibrationWizard(false);
    setWizardStep(1);
    setCalibrationData({ sensorType: 'pH', point1: '', point2: '', point3: '', notes: '' });
  };

  const formatDaysAgo = (date: Date) => {
    const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const formatDaysUntil = (date: Date) => {
    const days = Math.floor((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `Due in ${days} days`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">🔧</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Sensor Care & Calibration</h2>
              <p className="text-sm text-gray-500">Maintenance schedules and calibration tracking</p>
            </div>
          </div>
          <button
            onClick={() => setShowCalibrationWizard(true)}
            className="px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-semibold flex items-center gap-2"
          >
            <i className="fas fa-sliders-h"></i>
            Calibrate Sensor
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-check-circle text-green-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">Up to Date</p>
              <p className="text-xl font-bold text-gray-800">
                {calibrationRecords.filter(r => r.status === 'current').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-clock text-yellow-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">Due Soon</p>
              <p className="text-xl font-bold text-gray-800">
                {reminders.filter(r => r.status === 'due-soon').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-exclamation-circle text-red-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">Overdue</p>
              <p className="text-xl font-bold text-gray-800">
                {reminders.filter(r => r.status === 'overdue').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-calendar text-blue-600"></i>
            </div>
            <div>
              <p className="text-xs text-gray-600">This Month</p>
              <p className="text-xl font-bold text-gray-800">
                {reminders.filter(r => r.nextDue.getMonth() === new Date().getMonth()).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Urgent Actions Required */}
      {reminders.filter(r => r.status === 'overdue').length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <i className="fas fa-exclamation-triangle text-red-600 text-xl mt-1"></i>
            <div className="flex-1">
              <p className="font-semibold text-red-800 mb-2">Urgent Maintenance Required!</p>
              <div className="space-y-2">
                {reminders.filter(r => r.status === 'overdue').map(reminder => (
                  <div key={reminder.id} className="bg-white rounded p-3 border border-red-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getSensorIcon(reminder.sensorType)}</span>
                        <span className="font-semibold text-gray-800">{reminder.description}</span>
                      </div>
                      <span className="text-sm text-red-600 font-semibold">
                        {formatDaysUntil(reminder.nextDue)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Reminders */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <i className="fas fa-bell text-indigo-500"></i>
            Maintenance Schedule
          </h3>
        </div>
        <div className="divide-y divide-gray-100">
          {reminders.map((reminder) => (
            <div key={reminder.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getSensorIcon(reminder.sensorType)}</span>
                  <div>
                    <h4 className="font-bold text-gray-800">{reminder.description}</h4>
                    <p className="text-sm text-gray-600 capitalize">
                      {reminder.sensorType} Sensor • Every {reminder.frequency} days
                    </p>
                  </div>
                </div>
                {getStatusBadge(reminder.status)}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3 text-sm">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-600 font-semibold mb-1">Last Performed</p>
                  <p className="text-blue-800 font-semibold">
                    {reminder.lastPerformed.toLocaleDateString()}
                  </p>
                  <p className="text-xs text-blue-600">{formatDaysAgo(reminder.lastPerformed)}</p>
                </div>
                <div className={`rounded-lg p-3 ${
                  reminder.status === 'overdue' ? 'bg-red-50' : 
                  reminder.status === 'due-soon' ? 'bg-yellow-50' : 'bg-green-50'
                }`}>
                  <p className={`text-xs font-semibold mb-1 ${
                    reminder.status === 'overdue' ? 'text-red-600' : 
                    reminder.status === 'due-soon' ? 'text-yellow-600' : 'text-green-600'
                  }`}>Next Due</p>
                  <p className={`font-semibold ${
                    reminder.status === 'overdue' ? 'text-red-800' : 
                    reminder.status === 'due-soon' ? 'text-yellow-800' : 'text-green-800'
                  }`}>
                    {reminder.nextDue.toLocaleDateString()}
                  </p>
                  <p className={`text-xs ${
                    reminder.status === 'overdue' ? 'text-red-600' : 
                    reminder.status === 'due-soon' ? 'text-yellow-600' : 'text-green-600'
                  }`}>{formatDaysUntil(reminder.nextDue)}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-xs text-purple-600 font-semibold mb-1">Task Type</p>
                  <p className="text-purple-800 font-semibold capitalize">
                    {reminder.taskType.replace('-', ' ')}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium">
                  <i className="fas fa-check mr-2"></i>Mark Complete
                </button>
                <button className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors text-sm font-medium">
                  <i className="fas fa-tasks mr-2"></i>Create Task
                </button>
                <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium">
                  <i className="fas fa-clock mr-2"></i>Snooze
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Calibration History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <i className="fas fa-history text-indigo-500"></i>
            Calibration History
          </h3>
        </div>
        <div className="divide-y divide-gray-100">
          {calibrationRecords.map((record) => (
            <div key={record.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getSensorIcon(record.sensorType)}</span>
                  <div>
                    <h4 className="font-bold text-gray-800">{record.sensorName}</h4>
                    <p className="text-sm text-gray-600">
                      Calibrated {formatDaysAgo(record.calibrationDate)} by {record.calibratedBy}
                    </p>
                  </div>
                </div>
                {getStatusBadge(record.status)}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 font-semibold mb-1">Calibration Date</p>
                  <p className="text-gray-800 font-semibold">
                    {record.calibrationDate.toLocaleDateString()}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 font-semibold mb-1">Next Due</p>
                  <p className="text-gray-800 font-semibold">
                    {record.nextDueDate.toLocaleDateString()}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                  <p className="text-xs text-gray-600 font-semibold mb-1">Calibration Points</p>
                  <div className="flex gap-2">
                    {Object.entries(record.calibrationValues).map(([key, value]) => (
                      <span key={key} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold">
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {record.notes && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <p className="text-xs font-semibold text-blue-800 mb-1">Notes:</p>
                  <p className="text-sm text-blue-700">{record.notes}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium">
                  <i className="fas fa-sliders-h mr-2"></i>Recalibrate
                </button>
                <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium">
                  <i className="fas fa-info-circle mr-2"></i>View Details
                </button>
                <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium">
                  <i className="fas fa-download mr-2"></i>Export Certificate
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Calibration Wizard Modal */}
      {showCalibrationWizard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-500 to-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">Calibration Wizard</h3>
                  <p className="text-sm text-indigo-100">Step {wizardStep} of 3</p>
                </div>
                <button
                  onClick={() => setShowCalibrationWizard(false)}
                  className="text-white hover:text-gray-200"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <span className={`text-sm font-semibold ${wizardStep >= 1 ? 'text-indigo-600' : 'text-gray-400'}`}>
                    Select Sensor
                  </span>
                  <span className={`text-sm font-semibold ${wizardStep >= 2 ? 'text-indigo-600' : 'text-gray-400'}`}>
                    Calibration Points
                  </span>
                  <span className={`text-sm font-semibold ${wizardStep >= 3 ? 'text-indigo-600' : 'text-gray-400'}`}>
                    Confirm & Save
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(wizardStep / 3) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Step 1: Select Sensor */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 mb-4">Select Sensor to Calibrate</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {(['pH', 'turbidity', 'temperature', 'do'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setCalibrationData(prev => ({ ...prev, sensorType: type }))}
                        className={`p-6 rounded-lg border-2 transition-all ${
                          calibrationData.sensorType === type
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-4xl mb-2 block">{getSensorIcon(type)}</span>
                        <p className="font-semibold text-gray-800 capitalize">{type} Sensor</p>
                      </button>
                    ))}
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                    <p className="text-sm text-yellow-800">
                      <i className="fas fa-info-circle mr-2"></i>
                      Ensure the sensor is clean and properly prepared before starting calibration.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: Calibration Points */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 mb-4">
                    Enter Calibration Points for {calibrationData.sensorType.toUpperCase()} Sensor
                  </h4>
                  
                  {calibrationData.sensorType === 'pH' && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Point 1: pH 4.0 Buffer <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={calibrationData.point1}
                          onChange={(e) => setCalibrationData(prev => ({ ...prev, point1: e.target.value }))}
                          placeholder="4.00"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Point 2: pH 7.0 Buffer <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={calibrationData.point2}
                          onChange={(e) => setCalibrationData(prev => ({ ...prev, point2: e.target.value }))}
                          placeholder="7.00"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Point 3: pH 10.0 Buffer <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={calibrationData.point3}
                          onChange={(e) => setCalibrationData(prev => ({ ...prev, point3: e.target.value }))}
                          placeholder="10.00"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  {(calibrationData.sensorType === 'turbidity' || calibrationData.sensorType === 'do') && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Zero Point <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={calibrationData.point1}
                          onChange={(e) => setCalibrationData(prev => ({ ...prev, point1: e.target.value }))}
                          placeholder="0.00"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Span Point <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={calibrationData.point2}
                          onChange={(e) => setCalibrationData(prev => ({ ...prev, point2: e.target.value }))}
                          placeholder="100.00"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Calibration Notes
                    </label>
                    <textarea
                      rows={3}
                      value={calibrationData.notes}
                      onChange={(e) => setCalibrationData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Any observations or special conditions during calibration..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    ></textarea>
                  </div>
                </div>
              )}

              {/* Step 3: Confirm */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 mb-4">Review Calibration Data</h4>
                  
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{getSensorIcon(calibrationData.sensorType)}</span>
                      <div>
                        <p className="font-semibold text-gray-800 capitalize">{calibrationData.sensorType} Sensor</p>
                        <p className="text-sm text-gray-600">Calibration Date: {new Date().toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="border-t pt-3">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Calibration Points:</p>
                      <div className="flex gap-2 flex-wrap">
                        {calibrationData.point1 && (
                          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded font-semibold">
                            Point 1: {calibrationData.point1}
                          </span>
                        )}
                        {calibrationData.point2 && (
                          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded font-semibold">
                            Point 2: {calibrationData.point2}
                          </span>
                        )}
                        {calibrationData.point3 && (
                          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded font-semibold">
                            Point 3: {calibrationData.point3}
                          </span>
                        )}
                      </div>
                    </div>

                    {calibrationData.notes && (
                      <div className="border-t pt-3">
                        <p className="text-sm font-semibold text-gray-700 mb-1">Notes:</p>
                        <p className="text-sm text-gray-600">{calibrationData.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800">
                      <i className="fas fa-check-circle mr-2"></i>
                      Calibration data will be saved and sensor will be marked as calibrated.
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-3 pt-6 border-t mt-6">
                {wizardStep > 1 && (
                  <button
                    onClick={() => setWizardStep(prev => prev - 1)}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    <i className="fas fa-arrow-left mr-2"></i>Back
                  </button>
                )}
                <button
                  onClick={() => {
                    if (wizardStep < 3) {
                      setWizardStep(prev => prev + 1);
                    } else {
                      handleCalibrationSubmit();
                    }
                  }}
                  className="flex-1 px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium"
                >
                  {wizardStep === 3 ? (
                    <>
                      <i className="fas fa-save mr-2"></i>Save Calibration
                    </>
                  ) : (
                    <>
                      Next<i className="fas fa-arrow-right ml-2"></i>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SensorCareCalibration;
