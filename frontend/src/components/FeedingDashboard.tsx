import React, { useState } from 'react';
import api from '../services/api';

interface FeederStatus {
  pond: string;
  status: 'Ready' | 'Feeding' | 'Blocked';
  batteryLevel: number;
  hopperFeedLevel: number;
  lastFeedingTime: string;
  lastTargetAmount: number;
  lastActualAmount: number;
}

const FeedingDashboard: React.FC = () => {
  const [selectedPond, setSelectedPond] = useState<'Pond A' | 'Pond B'>('Pond A');
  const [feedingInProgress, setFeedingInProgress] = useState(false);
  const [deviceId] = useState('feed_device_001');

  // Mock data for feeder status
  const [feederData, setFeederData] = useState<Record<string, FeederStatus>>({
    'Pond A': {
      pond: 'Pond A',
      status: 'Ready',
      batteryLevel: 87,
      hopperFeedLevel: 45.5,
      lastFeedingTime: '2025-12-25 08:30 AM',
      lastTargetAmount: 5.0,
      lastActualAmount: 4.8,
    },
    'Pond B': {
      pond: 'Pond B',
      status: 'Ready',
      batteryLevel: 92,
      hopperFeedLevel: 38.2,
      lastFeedingTime: '2025-12-25 08:35 AM',
      lastTargetAmount: 4.5,
      lastActualAmount: 4.5,
    },
  });

  const currentFeeder = feederData[selectedPond];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ready':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'Feeding':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Blocked':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getBatteryColor = (level: number) => {
    if (level > 50) return 'text-green-600';
    if (level > 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHopperColor = (level: number) => {
    if (level > 30) return 'text-green-600';
    if (level > 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleStartFeeding = async () => {
    if (currentFeeder.status === 'Ready') {
      try {
        setFeedingInProgress(true);
        setFeederData(prev => ({
          ...prev,
          [selectedPond]: {
            ...prev[selectedPond],
            status: 'Feeding',
          },
        }));

        // Send MQTT command to start feeding
        const response = await api.post(`/feeding/start?deviceId=${deviceId}`);
        console.log('Feeding started:', response.data);
        
        alert('Feeding started successfully! Motors running at configured speeds.');
      } catch (error) {
        console.error('Failed to start feeding:', error);
        alert('Failed to start feeding. Please check backend connection.');
        setFeedingInProgress(false);
        setFeederData(prev => ({
          ...prev,
          [selectedPond]: {
            ...prev[selectedPond],
            status: 'Ready',
          },
        }));
      }
    }
  };

  const handleStopFeeding = async () => {
    try {
      setFeedingInProgress(false);
      
      // Send MQTT command to stop feeding
      const response = await api.post(`/feeding/stop?deviceId=${deviceId}`);
      console.log('Feeding stopped:', response.data);

      setFeederData(prev => ({
        ...prev,
        [selectedPond]: {
          ...prev[selectedPond],
          status: 'Ready',
          lastFeedingTime: new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      }));
      
      alert('Feeding stopped successfully. Motors are in sleep mode.');
    } catch (error) {
      console.error('Failed to stop feeding:', error);
      alert('Failed to stop feeding. Please check backend connection.');
    }
  };

  const handleEmergencyStop = async () => {
    if (confirm('Are you sure you want to execute EMERGENCY STOP?')) {
      try {
        setFeedingInProgress(false);
        
        // Send MQTT command to stop feeding immediately
        await api.post(`/feeding/stop?deviceId=${deviceId}`);
        
        setFeederData(prev => ({
          ...prev,
          [selectedPond]: {
            ...prev[selectedPond],
            status: 'Blocked',
          },
        }));
        
        alert('EMERGENCY STOP activated! All motors stopped immediately.');
      } catch (error) {
        console.error('Emergency stop failed:', error);
        alert('Emergency stop command sent, but response failed. Motors should still stop.');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-3xl">🍽️</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Floating Feeding Management</h2>
            <p className="text-sm text-gray-500">Monitor and control automatic feeding system</p>
          </div>
        </div>
      </div>

      {/* Pond Selector */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <i className="fas fa-water text-cyan-500"></i>
          Select Pond
        </h3>
        <div className="flex gap-4">
          <button
            onClick={() => setSelectedPond('Pond A')}
            className={`flex-1 py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
              selectedPond === 'Pond A'
                ? 'bg-cyan-500 text-white shadow-lg scale-105'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-water mr-2"></i>
            Pond A
          </button>
          <button
            onClick={() => setSelectedPond('Pond B')}
            className={`flex-1 py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
              selectedPond === 'Pond B'
                ? 'bg-cyan-500 text-white shadow-lg scale-105'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-water mr-2"></i>
            Pond B
          </button>
        </div>
      </div>

      {/* Feeder Status Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Feeder Status</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 font-medium">Status:</span>
              <span
                className={`px-4 py-2 rounded-lg font-semibold border-2 ${getStatusColor(
                  currentFeeder.status
                )}`}
              >
                {currentFeeder.status}
              </span>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 font-medium flex items-center gap-2">
                  <i className="fas fa-battery-three-quarters"></i>
                  Battery Level:
                </span>
                <span className={`font-bold text-xl ${getBatteryColor(currentFeeder.batteryLevel)}`}>
                  {currentFeeder.batteryLevel}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    currentFeeder.batteryLevel > 50
                      ? 'bg-green-500'
                      : currentFeeder.batteryLevel > 20
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${currentFeeder.batteryLevel}%` }}
                ></div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 font-medium flex items-center gap-2">
                  <i className="fas fa-box"></i>
                  Hopper Feed Level:
                </span>
                <span className={`font-bold text-xl ${getHopperColor(currentFeeder.hopperFeedLevel)}`}>
                  {currentFeeder.hopperFeedLevel} kg
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    currentFeeder.hopperFeedLevel > 30
                      ? 'bg-green-500'
                      : currentFeeder.hopperFeedLevel > 10
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min((currentFeeder.hopperFeedLevel / 50) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Last Feeding Summary */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Last Feeding Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600 font-medium flex items-center gap-2">
                <i className="fas fa-clock text-blue-500"></i>
                Time:
              </span>
              <span className="font-semibold text-gray-800">{currentFeeder.lastFeedingTime}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600 font-medium flex items-center gap-2">
                <i className="fas fa-bullseye text-green-500"></i>
                Target Amount:
              </span>
              <span className="font-semibold text-gray-800">{currentFeeder.lastTargetAmount} kg</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600 font-medium flex items-center gap-2">
                <i className="fas fa-check-circle text-cyan-500"></i>
                Actual Amount:
              </span>
              <span className="font-semibold text-gray-800">{currentFeeder.lastActualAmount} kg</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-600 font-medium flex items-center gap-2">
                <i className="fas fa-balance-scale text-purple-500"></i>
                Difference:
              </span>
              <span
                className={`font-semibold ${
                  Math.abs(currentFeeder.lastTargetAmount - currentFeeder.lastActualAmount) < 0.3
                    ? 'text-green-600'
                    : 'text-yellow-600'
                }`}
              >
                {(currentFeeder.lastActualAmount - currentFeeder.lastTargetAmount).toFixed(1)} kg
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleStartFeeding}
            disabled={currentFeeder.status !== 'Ready' || feedingInProgress}
            className={`py-4 px-6 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-3 ${
              currentFeeder.status === 'Ready' && !feedingInProgress
                ? 'bg-green-500 text-white hover:bg-green-600 shadow-lg hover:shadow-xl'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <i className="fas fa-play-circle text-2xl"></i>
            Start Feeding
          </button>
          <button
            onClick={handleStopFeeding}
            disabled={currentFeeder.status !== 'Feeding'}
            className={`py-4 px-6 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-3 ${
              currentFeeder.status === 'Feeding'
                ? 'bg-yellow-500 text-white hover:bg-yellow-600 shadow-lg hover:shadow-xl'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <i className="fas fa-stop-circle text-2xl"></i>
            Stop Feeding
          </button>
          <button
            onClick={handleEmergencyStop}
            className="py-4 px-6 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-3 bg-red-600 text-white hover:bg-red-700 shadow-lg hover:shadow-xl"
          >
            <i className="fas fa-exclamation-triangle text-2xl"></i>
            Emergency Stop
          </button>
        </div>
        {feedingInProgress && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
            <i className="fas fa-spinner fa-spin text-blue-500 text-xl"></i>
            <span className="text-blue-700 font-medium">Feeding in progress...</span>
          </div>
        )}
      </div>

      {/* System Status Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium mb-1">System Connection</p>
              <p className="text-2xl font-bold text-green-800">Online</p>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
              <i className="fas fa-wifi text-white text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium mb-1">Today's Feedings</p>
              <p className="text-2xl font-bold text-blue-800">3 / 4</p>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
              <i className="fas fa-calendar-check text-white text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700 font-medium mb-1">Total Feed Today</p>
              <p className="text-2xl font-bold text-purple-800">15.2 kg</p>
            </div>
            <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
              <i className="fas fa-weight text-white text-xl"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedingDashboard;
