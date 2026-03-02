import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  path: string;
  active?: boolean;
  onClick?: () => void;
  onNavigate?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, path, active, onClick, onNavigate }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(path);
      if (onNavigate) onNavigate();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${active
          ? 'bg-cyan-500 text-white shadow-lg'
          : 'text-gray-300 hover:bg-slate-700 hover:text-white'
        }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
};

interface SubNavItemProps {
  icon: React.ReactNode;
  label: string;
  path: string;
  active?: boolean;
  onNavigate?: () => void;
}

const SubNavItem: React.FC<SubNavItemProps> = ({ icon, label, path, active, onNavigate }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(path);
    if (onNavigate) onNavigate();
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center gap-3 pl-12 pr-4 py-2.5 rounded-lg transition-all duration-200 ${active
          ? 'bg-cyan-500 text-white shadow-lg'
          : 'text-gray-300 hover:bg-slate-700 hover:text-white'
        }`}
    >
      <span className="text-base">{icon}</span>
      <span className="font-normal text-sm">{label}</span>
    </button>
  );
};

interface SidebarProps {
  currentUsername: string;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentUsername, onLogout, isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isBudgetExpanded, setIsBudgetExpanded] = useState(
    location.pathname.includes('/expenditures') || 
    location.pathname.includes('/inventory') || 
    location.pathname.includes('/profit-loss') ||
    location.pathname.includes('/energy-monitor') ||
    location.pathname.includes('/realtime-current') ||
    location.pathname.includes('/calculate-kwh') ||
    location.pathname.includes('/budget-forecasting')
  );

  const [isWaterQualityExpanded, setIsWaterQualityExpanded] = useState(
    location.pathname.includes('/water-quality-dashboard') || 
    location.pathname.includes('/water-quality-trends') || 
    location.pathname.includes('/sensor-care') ||
    location.pathname.includes('/treatment-dosing') ||
    location.pathname.includes('/alerts-center') ||
    location.pathname.includes('/task-calendar')
  );

  const [isFeedingExpanded, setIsFeedingExpanded] = useState(
    location.pathname.includes('/feeding-dashboard') || 
    location.pathname.includes('/feeding-schedule') || 
    location.pathname.includes('/manual-feeding') ||
    location.pathname.includes('/feed-usage-logs') ||
    location.pathname.includes('/feeder-health-safety')
  );

  const toggleBudgetMenu = () => {
    setIsBudgetExpanded(!isBudgetExpanded);
  };

  const toggleWaterQualityMenu = () => {
    setIsWaterQualityExpanded(!isWaterQualityExpanded);
  };

  const toggleFeedingMenu = () => {
    setIsFeedingExpanded(!isFeedingExpanded);
  };

  const _handleNavigation = (path: string) => {
    navigate(path);
    onClose(); // Close sidebar after navigation on mobile
  };

  return (
    <>
      {/* Backdrop Overlay for Mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        ></div>
      )}

      {/* Sidebar */}
      <div className={`
        w-64 h-screen bg-slate-800 text-white flex flex-col fixed left-0 top-0 z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-500 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🐟</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">KoiFishFriend</h1>
                <p className="text-xs text-gray-400">User Management System</p>
              </div>
            </div>
            {/* Close button for mobile */}
            <button
              onClick={onClose}
              className="lg:hidden text-gray-400 hover:text-white"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <NavItem
          icon={<i className="fas fa-home"></i>}
          label="Dashboard"
          path="/dashboard"
          active={location.pathname === '/dashboard'}
          onNavigate={onClose}
        />

        <NavItem
          icon={<i className="fas fa-fish"></i>}
          label="Fish Count"
          path="/dashboard/fish-count"
          active={location.pathname === '/dashboard/fish-count'}
          onNavigate={onClose}
        />

        <NavItem
          icon={<i className="fas fa-video"></i>}
          label="Camera Monitoring"
          path="/dashboard/camera"
          active={location.pathname === '/dashboard/camera'}
          onNavigate={onClose}
        />

        <NavItem
          icon={<i className="fas fa-ship"></i>}
          label="Boat Navigation"
          path="/dashboard/boat-navigation"
          active={location.pathname === '/dashboard/boat-navigation'}
          onNavigate={onClose}
        />

        {/* Water Quality Management with Sub-menu */}
        <div>
          <button
            onClick={toggleWaterQualityMenu}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              isWaterQualityExpanded || 
              location.pathname.includes('/water-quality-dashboard') || 
              location.pathname.includes('/water-quality-trends') ||
              location.pathname.includes('/sensor-care') ||
              location.pathname.includes('/treatment-dosing') ||
              location.pathname.includes('/alerts-center') ||
              location.pathname.includes('/task-calendar')
                ? 'bg-slate-700 text-white'
                : 'text-gray-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl"><i className="fas fa-tint"></i></span>
              <span className="font-medium">Water Quality</span>
            </div>
            <i className={`fas fa-chevron-${isWaterQualityExpanded ? 'down' : 'right'} text-sm transition-transform`}></i>
          </button>
          {isWaterQualityExpanded && (
            <div className="mt-1 space-y-1">
              <SubNavItem
                icon={<i className="fas fa-dashboard"></i>}
                label="Water Quality Dashboard"
                path="/dashboard/water-quality-dashboard"
                active={location.pathname === '/dashboard/water-quality-dashboard'}
                onNavigate={onClose}
              />
              <SubNavItem
                icon={<i className="fas fa-chart-area"></i>}
                label="Water Quality Trends"
                path="/dashboard/water-quality-trends"
                active={location.pathname === '/dashboard/water-quality-trends'}
                onNavigate={onClose}
              />
              <SubNavItem
                icon={<i className="fas fa-tools"></i>}
                label="Sensor Care & Calibration"
                path="/dashboard/sensor-care"
                active={location.pathname === '/dashboard/sensor-care'}
                onNavigate={onClose}
              />
              <SubNavItem
                icon={<i className="fas fa-syringe"></i>}
                label="Treatment & Dosing Log"
                path="/dashboard/treatment-dosing"
                active={location.pathname === '/dashboard/treatment-dosing'}
                onNavigate={onClose}
              />
              <SubNavItem
                icon={<i className="fas fa-bell"></i>}
                label="Alerts Center"
                path="/dashboard/alerts-center"
                active={location.pathname === '/dashboard/alerts-center'}
                onNavigate={onClose}
              />
              <SubNavItem
                icon={<i className="fas fa-calendar-check"></i>}
                label="Task Calendar"
                path="/dashboard/task-calendar"
                active={location.pathname === '/dashboard/task-calendar'}
                onNavigate={onClose}
              />
            </div>
          )}
        </div>

        {/* Feeding Management with Sub-menu */}
        <div>
          <button
            onClick={toggleFeedingMenu}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              isFeedingExpanded || 
              location.pathname.includes('/feeding-dashboard') || 
              location.pathname.includes('/feeding-schedule') ||
              location.pathname.includes('/manual-feeding') ||
              location.pathname.includes('/feed-usage-logs') ||
              location.pathname.includes('/feeder-health-safety')
                ? 'bg-slate-700 text-white'
                : 'text-gray-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl"><i className="fas fa-utensils"></i></span>
              <span className="font-medium">Feeding Management</span>
            </div>
            <i className={`fas fa-chevron-${isFeedingExpanded ? 'down' : 'right'} text-sm transition-transform`}></i>
          </button>
          {isFeedingExpanded && (
            <div className="mt-1 space-y-1">
              <SubNavItem
                icon={<i className="fas fa-home"></i>}
                label="Feeding Dashboard"
                path="/dashboard/feeding-dashboard"
                active={location.pathname === '/dashboard/feeding-dashboard'}
                onNavigate={onClose}
              />
              <SubNavItem
                icon={<i className="fas fa-calendar-alt"></i>}
                label="Feeding Schedule"
                path="/dashboard/feeding-schedule"
                active={location.pathname === '/dashboard/feeding-schedule'}
                onNavigate={onClose}
              />
              <SubNavItem
                icon={<i className="fas fa-hand-pointer"></i>}
                label="Manual Feeding"
                path="/dashboard/manual-feeding"
                active={location.pathname === '/dashboard/manual-feeding'}
                onNavigate={onClose}
              />
              <SubNavItem
                icon={<i className="fas fa-chart-bar"></i>}
                label="Feed Usage & Logs"
                path="/dashboard/feed-usage-logs"
                active={location.pathname === '/dashboard/feed-usage-logs'}
                onNavigate={onClose}
              />
              <SubNavItem
                icon={<i className="fas fa-shield-alt"></i>}
                label="Feeder Health & Safety"
                path="/dashboard/feeder-health-safety"
                active={location.pathname === '/dashboard/feeder-health-safety'}
                onNavigate={onClose}
              />
            </div>
          )}
        </div>

        {/* Budget Management with Sub-menu */}
        <div>
          <button
            onClick={toggleBudgetMenu}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              isBudgetExpanded || 
              location.pathname.includes('/expenditures') || 
              location.pathname.includes('/inventory') ||
              location.pathname.includes('/profit-loss') ||
              location.pathname.includes('/energy-monitor') ||
              location.pathname.includes('/power-control') ||
              location.pathname.includes('/power-schedules') ||
              location.pathname.includes('/budget-forecasting')
                ? 'bg-slate-700 text-white'
                : 'text-gray-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl"><i className="fas fa-chart-line"></i></span>
              <span className="font-medium">Budget Management</span>
            </div>
            <i className={`fas fa-chevron-${isBudgetExpanded ? 'down' : 'right'} text-sm transition-transform`}></i>
          </button>
          {isBudgetExpanded && (
            <div className="mt-1 space-y-1">
              <SubNavItem
                icon={<i className="fas fa-wallet"></i>}
                label="Expenditures"
                path="/dashboard/expenditures"
                active={location.pathname === '/dashboard/expenditures'}
                onNavigate={onClose}
              />
              <SubNavItem
                icon={<i className="fas fa-boxes"></i>}
                label="Inventory"
                path="/dashboard/inventory"
                active={location.pathname === '/dashboard/inventory'}
                onNavigate={onClose}
              />
              <SubNavItem
                icon={<i className="fas fa-chart-pie"></i>}
                label="Profit & Loss"
                path="/dashboard/profit-loss"
                active={location.pathname === '/dashboard/profit-loss'}
                onNavigate={onClose}
              />
              <SubNavItem
                icon={<i className="fas fa-bolt"></i>}
                label="Energy Monitor"
                path="/dashboard/energy-monitor"
                active={location.pathname === '/dashboard/energy-monitor' || 
                       location.pathname === '/dashboard/realtime-current' || 
                       location.pathname === '/dashboard/calculate-kwh'}
                onNavigate={onClose}
              />
              <SubNavItem
                icon={<i className="fas fa-power-off"></i>}
                label="Power Control"
                path="/dashboard/power-control"
                active={location.pathname === '/dashboard/power-control'}
                onNavigate={onClose}
              />
              <SubNavItem
                icon={<i className="fas fa-clock"></i>}
                label="Power Schedules"
                path="/dashboard/power-schedules"
                active={location.pathname === '/dashboard/power-schedules'}
                onNavigate={onClose}
              />
              <SubNavItem
                icon={<i className="fas fa-chart-line"></i>}
                label="Budget Forecasting"
                path="/dashboard/budget-forecasting"
                active={location.pathname === '/dashboard/budget-forecasting'}
                onNavigate={onClose}
              />
            </div>
          )}
        </div>

        <NavItem
          icon={<i className="fas fa-microchip"></i>}
          label="Device Management"
          path="/dashboard/device-management"
          active={location.pathname === '/dashboard/device-management'}
          onNavigate={onClose}
        />

        <NavItem
          icon={<i className="fas fa-user-edit"></i>}
          label="Update Credentials"
          path="/dashboard/credentials"
          active={location.pathname === '/dashboard/credentials'}
          onNavigate={onClose}
        />

        <NavItem
          icon={<i className="fas fa-user-circle"></i>}
          label="Profile"
          path="/dashboard/profile"
          active={location.pathname === '/dashboard/profile'}
          onNavigate={onClose}
        />

        <NavItem
          icon={<i className="fas fa-cog"></i>}
          label="Settings"
          path="/dashboard/settings"
          active={location.pathname === '/dashboard/settings'}
          onNavigate={onClose}
        />

        <div className="pt-4 border-t border-slate-700 mt-4">
          <NavItem
            icon={<i className="fas fa-sign-out-alt"></i>}
            label="Logout"
            path="/login"
            onClick={() => {
              onLogout();
              onClose();
            }}
          />
        </div>
      </nav>

      {/* User Info Footer */}
      <div className="p-4 border-t border-slate-700 bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-600 rounded-full flex items-center justify-center">
            <span className="text-sm font-bold">{currentUsername.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">{currentUsername}</p>
            <p className="text-xs text-gray-400">Administrator</p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default Sidebar;
