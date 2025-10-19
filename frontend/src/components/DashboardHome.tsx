import React from 'react';

interface DashboardHomeProps {
  username: string;
}

const DashboardHome: React.FC<DashboardHomeProps> = ({ username }) => {
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl shadow-lg p-8 text-white">
        <h2 className="text-3xl font-bold mb-2">Welcome back, {username}! 👋</h2>
        <p className="text-cyan-100">Here's what's happening with your account today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Users</p>
              <p className="text-3xl font-bold text-gray-800">1</p>
              <p className="text-xs text-green-600 mt-1">Active</p>
            </div>
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
              <i className="fas fa-users text-blue-600 text-2xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Active Sessions</p>
              <p className="text-3xl font-bold text-gray-800">1</p>
              <p className="text-xs text-green-600 mt-1">
                <i className="fas fa-circle text-green-500 text-xs mr-1 animate-pulse"></i>
                Online now
              </p>
            </div>
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
              <i className="fas fa-check-circle text-green-600 text-2xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Last Login</p>
              <p className="text-xl font-bold text-gray-800">Just now</p>
              <p className="text-xs text-gray-500 mt-1">{new Date().toLocaleString()}</p>
            </div>
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
              <i className="fas fa-clock text-purple-600 text-2xl"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i className="fas fa-bolt text-yellow-500"></i>
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-left">
            <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-user-edit text-cyan-600 text-xl"></i>
            </div>
            <div>
              <p className="font-semibold text-gray-800">Update Credentials</p>
              <p className="text-sm text-gray-500">Change your username or password</p>
            </div>
          </button>

          <button className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-left">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-user-circle text-blue-600 text-xl"></i>
            </div>
            <div>
              <p className="font-semibold text-gray-800">View Profile</p>
              <p className="text-sm text-gray-500">Check your account information</p>
            </div>
          </button>

          <button className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-left">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-cog text-purple-600 text-xl"></i>
            </div>
            <div>
              <p className="font-semibold text-gray-800">Settings</p>
              <p className="text-sm text-gray-500">Configure your preferences</p>
            </div>
          </button>

          <button className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-left">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-shield-alt text-orange-600 text-xl"></i>
            </div>
            <div>
              <p className="font-semibold text-gray-800">Security</p>
              <p className="text-sm text-gray-500">Manage security settings</p>
            </div>
          </button>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i className="fas fa-server text-green-500"></i>
          System Status
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-3">
              <i className="fas fa-check-circle text-green-600"></i>
              <span className="font-medium text-gray-800">Backend Server</span>
            </div>
            <span className="text-sm text-green-600 font-semibold">Online</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-3">
              <i className="fas fa-database text-green-600"></i>
              <span className="font-medium text-gray-800">Database</span>
            </div>
            <span className="text-sm text-green-600 font-semibold">Connected</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-3">
              <i className="fas fa-shield-alt text-green-600"></i>
              <span className="font-medium text-gray-800">Security</span>
            </div>
            <span className="text-sm text-green-600 font-semibold">Protected</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
