import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import DashboardHome from '../components/DashboardHome';
import UpdateCredentials from '../components/UpdateCredentials';
import Expenditures from '../components/Expenditures';
import Inventory from '../components/Inventory';
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
import FeedTankHistory from '../components/FeedTankHistory';
import BudgetForecasting from '../components/BudgetForecasting';
import PowerManagement from '../components/PowerManagement';
import SystemStatus from '../components/SystemStatus';
import PondProfitLoss from '../components/PondProfitLoss';
import AIPredictionPanel from '../components/AIPredictionPanel';
import WeatherWidget from '../components/WeatherWidget';

/* ── Error Boundary to prevent a single page crash from blanking everything ── */
class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[RouteErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 rounded-2xl p-8 border border-red-200 text-center">
          <i className="fas fa-exclamation-triangle text-red-500 text-4xl mb-4 block" />
          <h2 className="text-xl font-bold text-red-700 mb-2">Page Error</h2>
          <p className="text-red-600 mb-4">
            Something went wrong loading this page.
          </p>
          <pre className="text-xs text-red-400 bg-red-100 p-3 rounded-lg overflow-auto max-h-32 mb-4">
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const Dashboard: React.FC = () => {
  const [currentUsername, setCurrentUsername] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Route-specific page titles
  const pageTitles: Record<string, { title: string; subtitle: string }> = useMemo(() => ({
    '/dashboard': { title: 'Dashboard', subtitle: `Welcome back, ${currentUsername}!` },
    '/dashboard/': { title: 'Dashboard', subtitle: `Welcome back, ${currentUsername}!` },
    '/dashboard/fish-count': { title: 'Fish Count', subtitle: 'Monitor fish population' },
    '/dashboard/camera': { title: 'Pond Camera', subtitle: 'Live video feed' },
    '/dashboard/boat-navigation': { title: 'Boat Navigation', subtitle: 'Control boat movement' },
    '/dashboard/water-quality-dashboard': { title: 'Water Quality', subtitle: 'Real-time water parameters' },
    '/dashboard/water-quality-trends': { title: 'Water Quality Trends', subtitle: 'Historical water data' },
    '/dashboard/sensor-care': { title: 'Sensor Care', subtitle: 'Sensor calibration & maintenance' },
    '/dashboard/treatment-dosing': { title: 'Treatment & Dosing', subtitle: 'Treatment dosing log' },
    '/dashboard/alerts-center': { title: 'Alerts Center', subtitle: 'System notifications & alerts' },
    '/dashboard/task-calendar': { title: 'Task Calendar', subtitle: 'Scheduled tasks & reminders' },
    '/dashboard/feeding-dashboard': { title: 'Feeding Dashboard', subtitle: 'Real-time feeding overview' },
    '/dashboard/feeding-schedule': { title: 'Feeding Schedule', subtitle: 'Manage automated feeding' },
    '/dashboard/manual-feeding': { title: 'Manual Feeding', subtitle: 'Trigger manual feeding outside scheduled times' },
    '/dashboard/feed-usage-logs': { title: 'Feed Usage Logs', subtitle: 'Historical feed usage data' },
    '/dashboard/feeder-health-safety': { title: 'Feeder Health', subtitle: 'Feeder system diagnostics' },
    '/dashboard/feed-tank-history': { title: 'Feed Tank History', subtitle: 'Tank level & weight history' },
    '/dashboard/expenditures': { title: 'Expenditures', subtitle: 'Track expenses & spending' },
    '/dashboard/inventory': { title: 'Inventory', subtitle: 'Manage stock & supplies' },
    '/dashboard/profit-loss': { title: 'Profit & Loss', subtitle: 'Financial overview' },
    '/dashboard/budget-forecasting': { title: 'Budget Forecasting', subtitle: 'Financial projections' },
    '/dashboard/pond-profit-loss': { title: 'Pond Profit & Loss', subtitle: 'Per-pond revenue, expenses, ROI & fish sales' },
    '/dashboard/energy-monitor': { title: 'Energy Monitor', subtitle: 'Power consumption tracking' },
    '/dashboard/power-control': { title: 'Power Management', subtitle: 'Device power control' },
    '/dashboard/power-schedules': { title: 'Power Schedules', subtitle: 'Automated power scheduling' },
    '/dashboard/realtime-current': { title: 'Realtime Current', subtitle: 'Live current readings' },
    '/dashboard/calculate-kwh': { title: 'Calculate kWh', subtitle: 'Energy consumption calculator' },
    '/dashboard/credentials': { title: 'Update Credentials', subtitle: 'Change username or password' },
    '/dashboard/profile': { title: 'Profile', subtitle: 'Your account profile' },
    '/dashboard/settings': { title: 'Settings', subtitle: 'System configuration' },
    '/dashboard/system-status': { title: 'System Status', subtitle: 'Device & service health' },
    '/dashboard/ai-predictions': { title: 'AI Predictions', subtitle: 'Smart farm insights & recommendations' },
    '/dashboard/weather': { title: 'Weather Forecast', subtitle: 'Weather conditions & fish farming impact' },
  }), [currentUsername]);

  const currentPage = pageTitles[location.pathname] ?? { title: 'Dashboard', subtitle: `Welcome back, ${currentUsername}!` };

  useEffect(() => {
    // Get username from localStorage (persists across tabs/windows)
    const storedUsername = localStorage.getItem('username');
    if (!storedUsername) {
      navigate('/login');
    } else {
      setCurrentUsername(storedUsername);
    }

    // Listen for auth changes from other tabs (login/logout)
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === 'username') {
        if (!e.newValue) {
          navigate('/login');
        } else {
          setCurrentUsername(e.newValue);
        }
      }
    };
    window.addEventListener('storage', onStorageChange);
    return () => window.removeEventListener('storage', onStorageChange);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('loginTime');
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
        <div className="bg-red-500 shadow-sm border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 md:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              {/* Hamburger Menu for Mobile */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hiddenredtext-gray-600 hover:text-gray-900 focus:outline-none"
              >
                <i className="fas fa-bars text-2xl"></i>
              </button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-800">{currentPage.title}</h1>
                <p className="text-xs md:text-sm text-gray-500">{currentPage.subtitle}</p>
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
          <RouteErrorBoundary>
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
            <Route path="/feed-tank-history" element={<FeedTankHistory />} />
            <Route path="/expenditures" element={<Expenditures />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/profit-loss" element={<ProfitLoss />} />
            <Route path="/budget-forecasting" element={<BudgetForecasting />} />
            <Route path="/pond-profit-loss" element={<PondProfitLoss />} />
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
            <Route path="/system-status" element={<SystemStatus />} />
            <Route path="/ai-predictions" element={<AIPredictionPanel />} />
            <Route path="/weather" element={<WeatherWidget />} />
          </Routes>
          </RouteErrorBoundary>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
