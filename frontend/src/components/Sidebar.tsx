import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  path: string;
  active?: boolean;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, path, active, onClick }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(path);
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
}

const SubNavItem: React.FC<SubNavItemProps> = ({ icon, label, path, active }) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(path)}
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
}

const Sidebar: React.FC<SidebarProps> = ({ currentUsername, onLogout }) => {
  const location = useLocation();
  const [isBudgetExpanded, setIsBudgetExpanded] = useState(
    location.pathname.includes('/expenditures') || 
    location.pathname.includes('/inventory') || 
    location.pathname.includes('/energy-monitor') ||
    location.pathname.includes('/realtime-current') ||
    location.pathname.includes('/calculate-kwh')
  );

  const [isWaterQualityExpanded, setIsWaterQualityExpanded] = useState(
    location.pathname.includes('/water-quality')
  );

  const toggleBudgetMenu = () => {
    setIsBudgetExpanded(!isBudgetExpanded);
  };

  const toggleWaterQualityMenu = () => {
    setIsWaterQualityExpanded(!isWaterQualityExpanded);
  };

  return (
    <div className="w-61 h-screen bg-slate-800 text-white flex flex-col fixed left-0 top-0">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-500 rounded-lg flex items-center justify-center">
            <span className="text-2xl">🐟</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">KoiFishFriend</h1>
            <p className="text-xs text-gray-400">User Management System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <NavItem
          icon={<i className="fas fa-home"></i>}
          label="Dashboard"
          path="/dashboard"
          active={location.pathname === '/dashboard'}
        />

        <NavItem
          icon={<i className="fas fa-fish"></i>}
          label="Fish Count"
          path="/dashboard/fish-count"
          active={location.pathname === '/dashboard/fish-count'}
        />

        {/* Water Quality Module with Sub-menu */}
        <div>
          <button
            onClick={toggleWaterQualityMenu}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              isWaterQualityExpanded || location.pathname.includes('/water-quality')
                ? 'bg-slate-700 text-white'
                : 'text-gray-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl"><i className="fas fa-water"></i></span>
              <span className="font-medium">Water Quality</span>
            </div>
            <i className={`fas fa-chevron-${isWaterQualityExpanded ? 'down' : 'right'} text-sm transition-transform`}></i>
          </button>

          {isWaterQualityExpanded && (
            <div className="mt-1 space-y-1">
              <SubNavItem
                icon={<i className="fas fa-tachometer-alt"></i>}
                label="Live Dashboard"
                path="/dashboard/water-quality"
                active={location.pathname === '/dashboard/water-quality'}
              />
              <SubNavItem
                icon={<i className="fas fa-chart-line"></i>}
                label="Trends & History"
                path="/dashboard/water-quality/trends"
                active={location.pathname === '/dashboard/water-quality/trends'}
              />
              <SubNavItem
                icon={<i className="fas fa-bell"></i>}
                label="Alerts Center"
                path="/dashboard/water-quality/alerts"
                active={location.pathname === '/dashboard/water-quality/alerts'}
              />
              <SubNavItem
                icon={<i className="fas fa-calendar-check"></i>}
                label="Task Calendar"
                path="/dashboard/water-quality/tasks"
                active={location.pathname === '/dashboard/water-quality/tasks'}
              />
              <SubNavItem
                icon={<i className="fas fa-syringe"></i>}
                label="Dosing Log"
                path="/dashboard/water-quality/dosing"
                active={location.pathname === '/dashboard/water-quality/dosing'}
              />
              <SubNavItem
                icon={<i className="fas fa-wrench"></i>}
                label="Sensor Care"
                path="/dashboard/water-quality/calibration"
                active={location.pathname === '/dashboard/water-quality/calibration'}
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
              location.pathname.includes('/energy-monitor')
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
              />
              <SubNavItem
                icon={<i className="fas fa-boxes"></i>}
                label="Inventory"
                path="/dashboard/inventory"
                active={location.pathname === '/dashboard/inventory'}
              />
              <SubNavItem
                icon={<i className="fas fa-bolt"></i>}
                label="Energy Monitor"
                path="/dashboard/energy-monitor"
                active={location.pathname === '/dashboard/energy-monitor' || 
                       location.pathname === '/dashboard/realtime-current' || 
                       location.pathname === '/dashboard/calculate-kwh'}
              />
            </div>
          )}
        </div>

        <NavItem
          icon={<i className="fas fa-microchip"></i>}
          label="Device Management"
          path="/dashboard/device-management"
          active={location.pathname === '/dashboard/device-management'}
        />

        <NavItem
          icon={<i className="fas fa-user-edit"></i>}
          label="Update Credentials"
          path="/dashboard/credentials"
          active={location.pathname === '/dashboard/credentials'}
        />

        <NavItem
          icon={<i className="fas fa-user-circle"></i>}
          label="Profile"
          path="/dashboard/profile"
          active={location.pathname === '/dashboard/profile'}
        />

        <NavItem
          icon={<i className="fas fa-cog"></i>}
          label="Settings"
          path="/dashboard/settings"
          active={location.pathname === '/dashboard/settings'}
        />

        <div className="pt-4 border-t border-slate-700 mt-4">
          <NavItem
            icon={<i className="fas fa-sign-out-alt"></i>}
            label="Logout"
            path="/login"
            onClick={onLogout}
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
  );
};

export default Sidebar;
