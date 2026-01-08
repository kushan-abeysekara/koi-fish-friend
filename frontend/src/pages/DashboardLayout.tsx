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
import BoatNavigation from './BoatNavigation';
import WaterQualityDashboard from '../components/WaterQualityDashboard';
import WaterQualityTrends from '../components/WaterQualityTrends';
import SensorCareCalibration from '../components/SensorCareCalibration';
import TreatmentDosingLog from '../components/TreatmentDosingLog';
import AlertsCenter from '../components/AlertsCenter';
import TaskCalendar from '../components/TaskCalendar';
import Settings from '../components/Settings';
import FeedingDashboard from '../components/FeedingDashboard';
import FeedingSchedule from '../components/FeedingSchedule';
import ManualFeeding from '../components/ManualFeeding';
import FeedUsageLogs from '../components/FeedUsageLogs';
import FeederHealthSafety from '../components/FeederHealthSafety';
import BudgetForecasting from '../components/BudgetForecasting';
import PowerManagement from '../components/PowerManagement';

const Dashboard: React.FC = () => {
  const [currentUsername, setCurrentUsername] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
      <Sidebar 
        currentUsername={currentUsername} 
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 transition-all duration-300">
        {/* Top Bar */}
        <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 md:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              {/* Hamburger Menu for Mobile */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden text-gray-600 hover:text-gray-900 focus:outline-none"
              >
                <i className="fas fa-bars text-2xl"></i>
              </button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-800">Dashboard</h1>
                <p className="text-xs md:text-sm text-gray-500">Welcome back, {currentUsername}!</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden md:flex items-center gap-2 text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-green-600 font-medium">System Online</span>
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="p-4 md:p-8">
          <Routes>
            <Route path="/" element={<DashboardHome username={currentUsername} />} />
            <Route path="/fish-count" element={<FishCount />} />
            <Route path="/camera" element={<PondCamera />} />
            <Route path="/boat-navigation" element={<BoatNavigation />} />
            <Route path="/water-quality-dashboard" element={<WaterQualityDashboard />} />
            <Route path="/water-quality-trends" element={<WaterQualityTrends />} />
            <Route path="/sensor-care" element={<SensorCareCalibration />} />
            <Route path="/treatment-dosing" element={<TreatmentDosingLog />} />
            <Route path="/alerts-center" element={<AlertsCenter />} />
            <Route path="/task-calendar" element={<TaskCalendar />} />
            <Route path="/feeding-dashboard" element={<FeedingDashboard />} />
            <Route path="/feeding-schedule" element={<FeedingSchedule />} />
            <Route path="/manual-feeding" element={<ManualFeeding />} />
            <Route path="/feed-usage-logs" element={<FeedUsageLogs />} />
            <Route path="/feeder-health-safety" element={<FeederHealthSafety />} />
            <Route path="/expenditures" element={<Expenditures />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/profit-loss" element={<ProfitLoss />} />
            <Route path="/budget-forecasting" element={<BudgetForecasting />} />
            <Route path="/device-management" element={<DeviceManagement />} />
            <Route path="/energy-monitor" element={<EnergyMonitor />} />
            <Route path="/power-control" element={<PowerManagement />} />
            <Route path="/power-schedules" element={<PowerManagement />} />
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
