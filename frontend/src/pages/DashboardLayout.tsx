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
import ProfitLoss from '../components/ProfitLoss';
import PondCamera from '../components/PondCamera';

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
        <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
          <div className="px-8 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
              <p className="text-sm text-gray-500">Welcome back, {currentUsername}!</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-green-600 font-medium">System Online</span>
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="p-8">
          <Routes>
            <Route path="/" element={<DashboardHome username={currentUsername} />} />
            <Route path="/fish-count" element={<FishCount />} />
            <Route path="/camera" element={<PondCamera />} />
            <Route path="/expenditures" element={<Expenditures />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/profit-loss" element={<ProfitLoss />} />
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
            <Route path="/settings" element={<div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100"><h2 className="text-2xl font-bold text-gray-800">Settings - Coming Soon</h2></div>} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
