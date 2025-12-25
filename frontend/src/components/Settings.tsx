import React, { useState } from 'react';

interface SafeBands {
  pH: { min: number; max: number };
  turbidity: { min: number; max: number };
  temperature: { min: number; max: number };
  dissolvedOxygen: { min: number; max: number };
}

interface WarningBands {
  pH: { min: number; max: number };
  turbidity: { min: number; max: number };
  temperature: { min: number; max: number };
  dissolvedOxygen: { min: number; max: number };
}

interface NotificationRecipient {
  id: string;
  name: string;
  email: string;
  phone: string;
  receiveEmail: boolean;
  receiveSMS: boolean;
  alertTypes: ('critical' | 'warning' | 'maintenance')[];
}

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'bands' | 'alerts' | 'notifications' | 'advanced' | 'feeding'>('bands');
  
  // Safe Bands State
  const [safeBands, setSafeBands] = useState<SafeBands>({
    pH: { min: 6.5, max: 8.5 },
    turbidity: { min: 0, max: 25 },
    temperature: { min: 15, max: 28 },
    dissolvedOxygen: { min: 6, max: 12 },
  });

  // Warning Bands State
  const [warningBands, setWarningBands] = useState<WarningBands>({
    pH: { min: 6.0, max: 9.0 },
    turbidity: { min: 0, max: 40 },
    temperature: { min: 10, max: 32 },
    dissolvedOxygen: { min: 4, max: 15 },
  });

  // Alert Settings
  const [alertSettings, setAlertSettings] = useState({
    cooldownPeriod: 30, // minutes
    persistenceWindow: 5, // minutes
    trendWindow: 60, // minutes
    enableAutoSnooze: false,
    autoSnoozeMinutes: 60,
  });

  // Context Rules
  const [contextRules, setContextRules] = useState({
    enableFeedingMode: true,
    feedingModeDelay: 30, // minutes
    enableMaintenanceMode: true,
    enableNightMode: true,
    nightModeStart: '22:00',
    nightModeEnd: '06:00',
  });

  // Notification Recipients
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      receiveEmail: true,
      receiveSMS: true,
      alertTypes: ['critical', 'warning'],
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '+0987654321',
      receiveEmail: true,
      receiveSMS: false,
      alertTypes: ['critical', 'maintenance'],
    },
  ]);

  const [showAddRecipient, setShowAddRecipient] = useState(false);

  // Feeding Settings State
  const [feedingSettings, setFeedingSettings] = useState({
    minFeedAmount: 0.5, // kg
    maxFeedAmount: 10.0, // kg
    batteryLowThreshold: 20, // %
    batteryWarningThreshold: 30, // %
    hopperEmptyThreshold: 5.0, // kg
    hopperWarningThreshold: 15.0, // kg
    plateSpeed: 'Medium' as 'Low' | 'Medium' | 'High',
    autoFeedingEnabled: true,
    feedingTimeout: 300, // seconds
  });

  const handleSaveBands = () => {
    // Save to API
    alert('Safe bands and warning bands saved successfully!');
  };

  const handleSaveAlertSettings = () => {
    // Save to API
    alert('Alert settings saved successfully!');
  };

  const handleSaveNotifications = () => {
    // Save to API
    alert('Notification settings saved successfully!');
  };

  const handleResetToDefaults = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      setSafeBands({
        pH: { min: 6.5, max: 8.5 },
        turbidity: { min: 0, max: 25 },
        temperature: { min: 15, max: 28 },
        dissolvedOxygen: { min: 6, max: 12 },
      });
      setWarningBands({
        pH: { min: 6.0, max: 9.0 },
        turbidity: { min: 0, max: 40 },
        temperature: { min: 10, max: 32 },
        dissolvedOxygen: { min: 4, max: 15 },
      });
      alert('Settings reset to defaults!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-gray-600 to-gray-800 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">⚙️</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">System Settings</h2>
              <p className="text-sm text-gray-500">Configure water quality monitoring parameters</p>
            </div>
          </div>
          <button
            onClick={handleResetToDefaults}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium flex items-center gap-2"
          >
            <i className="fas fa-undo"></i>
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('bands')}
              className={`px-6 py-4 font-semibold transition-colors border-b-2 ${
                activeTab === 'bands'
                  ? 'border-gray-800 text-gray-800'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="fas fa-sliders-h mr-2"></i>Safe Bands
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-6 py-4 font-semibold transition-colors border-b-2 ${
                activeTab === 'alerts'
                  ? 'border-gray-800 text-gray-800'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="fas fa-bell mr-2"></i>Alert Settings
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-6 py-4 font-semibold transition-colors border-b-2 ${
                activeTab === 'notifications'
                  ? 'border-gray-800 text-gray-800'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="fas fa-envelope mr-2"></i>Notifications
            </button>
            <button
              onClick={() => setActiveTab('advanced')}
              className={`px-6 py-4 font-semibold transition-colors border-b-2 ${
                activeTab === 'advanced'
                  ? 'border-gray-800 text-gray-800'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="fas fa-cogs mr-2"></i>Advanced
            </button>
            <button
              onClick={() => setActiveTab('feeding')}
              className={`px-6 py-4 font-semibold transition-colors border-b-2 ${
                activeTab === 'feeding'
                  ? 'border-gray-800 text-gray-800'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="fas fa-utensils mr-2"></i>Feeding System
            </button>
          </div>
        </div>

        {/* Safe Bands Tab */}
        {activeTab === 'bands' && (
          <div className="p-6 space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <i className="fas fa-info-circle mr-2"></i>
                <strong>Safe Bands:</strong> Normal operating range. Values within this range are considered safe.
                <br />
                <strong>Warning Bands:</strong> Extended range. Values outside safe but within warning trigger warnings, not critical alerts.
              </p>
            </div>

            {/* pH Settings */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>⚗️</span> pH Level
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Safe Range</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.1"
                      value={safeBands.pH.min}
                      onChange={(e) => setSafeBands(prev => ({
                        ...prev,
                        pH: { ...prev.pH, min: parseFloat(e.target.value) }
                      }))}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                    />
                    <span className="text-gray-600">to</span>
                    <input
                      type="number"
                      step="0.1"
                      value={safeBands.pH.max}
                      onChange={(e) => setSafeBands(prev => ({
                        ...prev,
                        pH: { ...prev.pH, max: parseFloat(e.target.value) }
                      }))}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                    />
                    <span className="text-gray-600">pH</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Warning Range</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.1"
                      value={warningBands.pH.min}
                      onChange={(e) => setWarningBands(prev => ({
                        ...prev,
                        pH: { ...prev.pH, min: parseFloat(e.target.value) }
                      }))}
                      className="flex-1 px-4 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <span className="text-gray-600">to</span>
                    <input
                      type="number"
                      step="0.1"
                      value={warningBands.pH.max}
                      onChange={(e) => setWarningBands(prev => ({
                        ...prev,
                        pH: { ...prev.pH, max: parseFloat(e.target.value) }
                      }))}
                      className="flex-1 px-4 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <span className="text-gray-600">pH</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Turbidity Settings */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>💧</span> Turbidity
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Safe Range</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="1"
                      value={safeBands.turbidity.min}
                      onChange={(e) => setSafeBands(prev => ({
                        ...prev,
                        turbidity: { ...prev.turbidity, min: parseFloat(e.target.value) }
                      }))}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                    />
                    <span className="text-gray-600">to</span>
                    <input
                      type="number"
                      step="1"
                      value={safeBands.turbidity.max}
                      onChange={(e) => setSafeBands(prev => ({
                        ...prev,
                        turbidity: { ...prev.turbidity, max: parseFloat(e.target.value) }
                      }))}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                    />
                    <span className="text-gray-600">NTU</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Warning Range</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="1"
                      value={warningBands.turbidity.min}
                      onChange={(e) => setWarningBands(prev => ({
                        ...prev,
                        turbidity: { ...prev.turbidity, min: parseFloat(e.target.value) }
                      }))}
                      className="flex-1 px-4 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <span className="text-gray-600">to</span>
                    <input
                      type="number"
                      step="1"
                      value={warningBands.turbidity.max}
                      onChange={(e) => setWarningBands(prev => ({
                        ...prev,
                        turbidity: { ...prev.turbidity, max: parseFloat(e.target.value) }
                      }))}
                      className="flex-1 px-4 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <span className="text-gray-600">NTU</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Temperature Settings */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>🌡️</span> Temperature
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Safe Range</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.5"
                      value={safeBands.temperature.min}
                      onChange={(e) => setSafeBands(prev => ({
                        ...prev,
                        temperature: { ...prev.temperature, min: parseFloat(e.target.value) }
                      }))}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                    />
                    <span className="text-gray-600">to</span>
                    <input
                      type="number"
                      step="0.5"
                      value={safeBands.temperature.max}
                      onChange={(e) => setSafeBands(prev => ({
                        ...prev,
                        temperature: { ...prev.temperature, max: parseFloat(e.target.value) }
                      }))}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                    />
                    <span className="text-gray-600">°C</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Warning Range</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.5"
                      value={warningBands.temperature.min}
                      onChange={(e) => setWarningBands(prev => ({
                        ...prev,
                        temperature: { ...prev.temperature, min: parseFloat(e.target.value) }
                      }))}
                      className="flex-1 px-4 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <span className="text-gray-600">to</span>
                    <input
                      type="number"
                      step="0.5"
                      value={warningBands.temperature.max}
                      onChange={(e) => setWarningBands(prev => ({
                        ...prev,
                        temperature: { ...prev.temperature, max: parseFloat(e.target.value) }
                      }))}
                      className="flex-1 px-4 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <span className="text-gray-600">°C</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dissolved Oxygen Settings */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>🫧</span> Dissolved Oxygen
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Safe Range</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.5"
                      value={safeBands.dissolvedOxygen.min}
                      onChange={(e) => setSafeBands(prev => ({
                        ...prev,
                        dissolvedOxygen: { ...prev.dissolvedOxygen, min: parseFloat(e.target.value) }
                      }))}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                    />
                    <span className="text-gray-600">to</span>
                    <input
                      type="number"
                      step="0.5"
                      value={safeBands.dissolvedOxygen.max}
                      onChange={(e) => setSafeBands(prev => ({
                        ...prev,
                        dissolvedOxygen: { ...prev.dissolvedOxygen, max: parseFloat(e.target.value) }
                      }))}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                    />
                    <span className="text-gray-600">mg/L</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Warning Range</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.5"
                      value={warningBands.dissolvedOxygen.min}
                      onChange={(e) => setWarningBands(prev => ({
                        ...prev,
                        dissolvedOxygen: { ...prev.dissolvedOxygen, min: parseFloat(e.target.value) }
                      }))}
                      className="flex-1 px-4 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <span className="text-gray-600">to</span>
                    <input
                      type="number"
                      step="0.5"
                      value={warningBands.dissolvedOxygen.max}
                      onChange={(e) => setWarningBands(prev => ({
                        ...prev,
                        dissolvedOxygen: { ...prev.dissolvedOxygen, max: parseFloat(e.target.value) }
                      }))}
                      className="flex-1 px-4 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <span className="text-gray-600">mg/L</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={handleSaveBands}
                className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-semibold"
              >
                <i className="fas fa-save mr-2"></i>Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Alert Settings Tab */}
        {activeTab === 'alerts' && (
          <div className="p-6 space-y-6">
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Alert Timing Configuration</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Alert Cooldown Period
                    <span className="text-xs text-gray-500 ml-2">(Minimum time between duplicate alerts)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={alertSettings.cooldownPeriod}
                      onChange={(e) => setAlertSettings(prev => ({ ...prev, cooldownPeriod: parseInt(e.target.value) }))}
                      className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                    />
                    <span className="text-gray-600">minutes</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Persistence Window
                    <span className="text-xs text-gray-500 ml-2">(Value must be out of range for this long to trigger alert)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={alertSettings.persistenceWindow}
                      onChange={(e) => setAlertSettings(prev => ({ ...prev, persistenceWindow: parseInt(e.target.value) }))}
                      className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                    />
                    <span className="text-gray-600">minutes</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Trend Analysis Window
                    <span className="text-xs text-gray-500 ml-2">(Time window for trend calculations)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={alertSettings.trendWindow}
                      onChange={(e) => setAlertSettings(prev => ({ ...prev, trendWindow: parseInt(e.target.value) }))}
                      className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                    />
                    <span className="text-gray-600">minutes</span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alertSettings.enableAutoSnooze}
                      onChange={(e) => setAlertSettings(prev => ({ ...prev, enableAutoSnooze: e.target.checked }))}
                      className="w-5 h-5 text-gray-800 rounded focus:ring-2 focus:ring-gray-800"
                    />
                    <span className="font-semibold text-gray-700">Enable Auto-Snooze</span>
                  </label>
                  {alertSettings.enableAutoSnooze && (
                    <div className="mt-3 ml-8">
                      <label className="block text-sm text-gray-600 mb-2">Auto-snooze duration</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={alertSettings.autoSnoozeMinutes}
                          onChange={(e) => setAlertSettings(prev => ({ ...prev, autoSnoozeMinutes: parseInt(e.target.value) }))}
                          className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                        />
                        <span className="text-gray-600">minutes</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleSaveAlertSettings}
                className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-semibold"
              >
                <i className="fas fa-save mr-2"></i>Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Notification Recipients</h3>
              <button
                onClick={() => setShowAddRecipient(true)}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium"
              >
                <i className="fas fa-plus mr-2"></i>Add Recipient
              </button>
            </div>

            <div className="space-y-4">
              {recipients.map((recipient) => (
                <div key={recipient.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-gray-800 text-lg">{recipient.name}</h4>
                      <p className="text-sm text-gray-600">{recipient.email}</p>
                      <p className="text-sm text-gray-600">{recipient.phone}</p>
                    </div>
                    <button className="text-red-600 hover:text-red-700">
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={recipient.receiveEmail}
                        className="w-4 h-4 text-gray-800 rounded"
                      />
                      <span className="text-sm text-gray-700">Email Notifications</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={recipient.receiveSMS}
                        className="w-4 h-4 text-gray-800 rounded"
                      />
                      <span className="text-sm text-gray-700">SMS Notifications</span>
                    </label>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">Alert Types:</p>
                    <div className="flex gap-2">
                      {recipient.alertTypes.map((type) => (
                        <span
                          key={type}
                          className={`px-3 py-1 rounded text-xs font-semibold ${
                            type === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : type === 'warning'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={handleSaveNotifications}
                className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-semibold"
              >
                <i className="fas fa-save mr-2"></i>Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Advanced Tab */}
        {activeTab === 'advanced' && (
          <div className="p-6 space-y-6">
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Context Rules</h3>
              
              <div className="space-y-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={contextRules.enableFeedingMode}
                    onChange={(e) => setContextRules(prev => ({ ...prev, enableFeedingMode: e.target.checked }))}
                    className="w-5 h-5 text-gray-800 rounded"
                  />
                  <div className="flex-1">
                    <span className="font-semibold text-gray-700">Feeding Mode</span>
                    <p className="text-xs text-gray-500">Temporarily adjust turbidity thresholds after feeding</p>
                  </div>
                </label>
                {contextRules.enableFeedingMode && (
                  <div className="ml-8">
                    <label className="block text-sm text-gray-600 mb-2">Delay before normal thresholds resume</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={contextRules.feedingModeDelay}
                        onChange={(e) => setContextRules(prev => ({ ...prev, feedingModeDelay: parseInt(e.target.value) }))}
                        className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                      />
                      <span className="text-gray-600">minutes</span>
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={contextRules.enableMaintenanceMode}
                    onChange={(e) => setContextRules(prev => ({ ...prev, enableMaintenanceMode: e.target.checked }))}
                    className="w-5 h-5 text-gray-800 rounded"
                  />
                  <div className="flex-1">
                    <span className="font-semibold text-gray-700">Maintenance Mode</span>
                    <p className="text-xs text-gray-500">Suppress alerts during maintenance activities</p>
                  </div>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={contextRules.enableNightMode}
                    onChange={(e) => setContextRules(prev => ({ ...prev, enableNightMode: e.target.checked }))}
                    className="w-5 h-5 text-gray-800 rounded"
                  />
                  <div className="flex-1">
                    <span className="font-semibold text-gray-700">Night Mode</span>
                    <p className="text-xs text-gray-500">Reduce alert frequency during night hours</p>
                  </div>
                </label>
                {contextRules.enableNightMode && (
                  <div className="ml-8 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-2">Start Time</label>
                      <input
                        type="time"
                        value={contextRules.nightModeStart}
                        onChange={(e) => setContextRules(prev => ({ ...prev, nightModeStart: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-2">End Time</label>
                      <input
                        type="time"
                        value={contextRules.nightModeEnd}
                        onChange={(e) => setContextRules(prev => ({ ...prev, nightModeEnd: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleSaveAlertSettings}
                className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-semibold"
              >
                <i className="fas fa-save mr-2"></i>Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Feeding System Settings Tab */}
        {activeTab === 'feeding' && (
          <div className="p-6 space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-800">
                <i className="fas fa-info-circle mr-2"></i>
                <strong>Feeding System Settings:</strong> Configure feed quantity limits, safety thresholds, and plate speed for the automated feeding system.
              </p>
            </div>

            {/* Feed Quantity Limits */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>⚖️</span> Feed Quantity Limits
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Minimum Feed Amount (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={feedingSettings.minFeedAmount}
                    onChange={(e) => setFeedingSettings(prev => ({
                      ...prev,
                      minFeedAmount: parseFloat(e.target.value)
                    }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum allowed feed quantity per feeding</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Maximum Feed Amount (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={feedingSettings.maxFeedAmount}
                    onChange={(e) => setFeedingSettings(prev => ({
                      ...prev,
                      maxFeedAmount: parseFloat(e.target.value)
                    }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum allowed feed quantity per feeding</p>
                </div>
              </div>
            </div>

            {/* Battery Thresholds */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>🔋</span> Battery Safety Thresholds
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Low Battery Threshold (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={feedingSettings.batteryLowThreshold}
                    onChange={(e) => setFeedingSettings(prev => ({
                      ...prev,
                      batteryLowThreshold: parseInt(e.target.value)
                    }))}
                    className="w-full px-4 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <p className="text-xs text-red-600 mt-1">Critical alert - feeding paused</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Battery Warning Threshold (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={feedingSettings.batteryWarningThreshold}
                    onChange={(e) => setFeedingSettings(prev => ({
                      ...prev,
                      batteryWarningThreshold: parseInt(e.target.value)
                    }))}
                    className="w-full px-4 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <p className="text-xs text-yellow-600 mt-1">Warning alert - recharge recommended</p>
                </div>
              </div>
            </div>

            {/* Hopper Thresholds */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>📦</span> Hopper Level Thresholds
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Empty Hopper Threshold (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={feedingSettings.hopperEmptyThreshold}
                    onChange={(e) => setFeedingSettings(prev => ({
                      ...prev,
                      hopperEmptyThreshold: parseFloat(e.target.value)
                    }))}
                    className="w-full px-4 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <p className="text-xs text-red-600 mt-1">Critical alert - refill required</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Low Hopper Warning (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={feedingSettings.hopperWarningThreshold}
                    onChange={(e) => setFeedingSettings(prev => ({
                      ...prev,
                      hopperWarningThreshold: parseFloat(e.target.value)
                    }))}
                    className="w-full px-4 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <p className="text-xs text-yellow-600 mt-1">Warning alert - refill soon</p>
                </div>
              </div>
            </div>

            {/* Plate Speed */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>⚡</span> Plate Speed Control
              </h3>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Feeding Plate Speed
                </label>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => setFeedingSettings(prev => ({ ...prev, plateSpeed: 'Low' }))}
                    className={`py-4 px-6 rounded-lg font-semibold transition-all ${
                      feedingSettings.plateSpeed === 'Low'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <i className="fas fa-turtle mr-2"></i>
                    Low
                  </button>
                  <button
                    onClick={() => setFeedingSettings(prev => ({ ...prev, plateSpeed: 'Medium' }))}
                    className={`py-4 px-6 rounded-lg font-semibold transition-all ${
                      feedingSettings.plateSpeed === 'Medium'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <i className="fas fa-walking mr-2"></i>
                    Medium
                  </button>
                  <button
                    onClick={() => setFeedingSettings(prev => ({ ...prev, plateSpeed: 'High' }))}
                    className={`py-4 px-6 rounded-lg font-semibold transition-all ${
                      feedingSettings.plateSpeed === 'High'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <i className="fas fa-running mr-2"></i>
                    High
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  <i className="fas fa-info-circle mr-1"></i>
                  Plate speed controls how fast feed is dispensed. Higher speeds for larger fish populations.
                </p>
              </div>
            </div>

            {/* Additional Settings */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>⚙️</span> Additional Settings
              </h3>
              <div className="space-y-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={feedingSettings.autoFeedingEnabled}
                    onChange={(e) => setFeedingSettings(prev => ({ ...prev, autoFeedingEnabled: e.target.checked }))}
                    className="w-5 h-5 text-gray-800 rounded"
                  />
                  <div className="flex-1">
                    <span className="font-semibold text-gray-700">Enable Automatic Feeding</span>
                    <p className="text-xs text-gray-500">Allow system to feed automatically based on schedule</p>
                  </div>
                </label>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Feeding Timeout (seconds)
                  </label>
                  <input
                    type="number"
                    min="60"
                    max="600"
                    value={feedingSettings.feedingTimeout}
                    onChange={(e) => setFeedingSettings(prev => ({
                      ...prev,
                      feedingTimeout: parseInt(e.target.value)
                    }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum time allowed for a feeding operation</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setFeedingSettings({
                    minFeedAmount: 0.5,
                    maxFeedAmount: 10.0,
                    batteryLowThreshold: 20,
                    batteryWarningThreshold: 30,
                    hopperEmptyThreshold: 5.0,
                    hopperWarningThreshold: 15.0,
                    plateSpeed: 'Medium',
                    autoFeedingEnabled: true,
                    feedingTimeout: 300,
                  });
                  alert('Feeding settings reset to defaults!');
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
              >
                <i className="fas fa-undo mr-2"></i>Reset to Defaults
              </button>
              <button
                onClick={() => alert('Feeding settings saved successfully!')}
                className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-semibold"
              >
                <i className="fas fa-save mr-2"></i>Save Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
