import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import DashboardHome from '../components/DashboardHome';
import UpdateCredentials from '../components/UpdateCredentials';
import Expenditures from '../components/Expenditures';
import Inventory from '../components/Inventory';
import DeviceManagement from '../components/DeviceManagement';
import EnergyMonitor from '../components/EnergyMonitor';
import FishCount from '../components/FishCount';
import WaterQualityDashboard from '../components/WaterQualityDashboard';
import WaterQualityTrends from '../components/WaterQualityTrends';
import AlertsCenter from '../components/AlertsCenter';
import TaskCalendar from '../components/TaskCalendar';
import TreatmentDosingLog from '../components/TreatmentDosingLog';
import SensorCareCalibration from '../components/SensorCareCalibration';
import Settings from '../components/Settings';

const Dashboard: React.FC = () => {
  const [currentUsername, setCurrentUsername] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Get username from sessionStorage
    const storedUsername = sessionStorage.getItem('username');
    if (!storedUsername) {
      navigate('/login');
    } else {
      setCurrentUsername(storedUsername);
    }
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('username');
    navigate('/login');
  };

  const updateUsername = (newUsername: string) => {
    setCurrentUsername(newUsername);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar currentUsername={currentUsername} onLogout={handleLogout} />

      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Top Bar */}

        {/* Dashboard Content */}
        <div className="p-8">
          <Routes>
            <Route path="/" element={<DashboardHome username={currentUsername} />} />
            <Route path="/fish-count" element={<FishCount />} />
            <Route path="/water-quality" element={<WaterQualityDashboard />} />
            <Route path="/water-quality/trends" element={<WaterQualityTrends />} />
            <Route path="/water-quality/alerts" element={<AlertsCenter />} />
            <Route path="/water-quality/tasks" element={<TaskCalendar />} />
            <Route path="/water-quality/dosing" element={<TreatmentDosingLog />} />
            <Route path="/water-quality/calibration" element={<SensorCareCalibration />} />
            <Route path="/expenditures" element={<Expenditures />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/device-management" element={<DeviceManagement />} />
            <Route path="/energy-monitor" element={<EnergyMonitor />} />
            <Route path="/realtime-current" element={<EnergyMonitor />} />
            <Route path="/calculate-kwh" element={<EnergyMonitor />} />
            <Route
              path="/credentials"
              element={
                <UpdateCredentials
                  currentUsername={currentUsername}
                  onUsernameUpdate={updateUsername}
                  onLogout={handleLogout}
                />
              }
            />
            <Route path="/profile" element={<div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100"><h2 className="text-2xl font-bold text-gray-800">Profile - Coming Soon</h2></div>} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
