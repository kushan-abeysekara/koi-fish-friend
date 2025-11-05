import React from 'react';
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
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
        active
          ? 'bg-cyan-500 text-white shadow-lg'
          : 'text-gray-300 hover:bg-slate-700 hover:text-white'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
};

interface SidebarProps {
  currentUsername: string;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentUsername, onLogout }) => {
  const location = useLocation();

  return (
    <div className="w-64 h-screen bg-slate-800 text-white flex flex-col fixed left-0 top-0">
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
        
        <NavItem
          icon={<i className="fas fa-wallet"></i>}
          label="Expenditures"
          path="/dashboard/expenditures"
          active={location.pathname === '/dashboard/expenditures'}
        />
        
        <NavItem
          icon={<i className="fas fa-bolt"></i>}
          label="Realtime Current"
          path="/dashboard/realtime-current"
          active={location.pathname === '/dashboard/realtime-current'}
        />
        
        <NavItem
          icon={<i className="fas fa-chart-bar"></i>}
          label="Calculate Kwh"
          path="/dashboard/calculate-kwh"
          active={location.pathname === '/dashboard/calculate-kwh'}
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
