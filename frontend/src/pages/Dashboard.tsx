import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateCredentials } from '../services/api';

const Dashboard: React.FC = () => {
  const [currentUsername, setCurrentUsername] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    // Validate that at least one field is filled
    if (!newUsername && !newPassword) {
      setError('Please provide a new username or password to update');
      return;
    }

    // Validate password confirmation
    if (newPassword && newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await updateCredentials(
        currentUsername,
        newUsername || '',
        newPassword || ''
      );
      
      if (response.success) {
        setMessage(response.message);
        
        // Update sessionStorage if username was changed
        if (newUsername) {
          sessionStorage.setItem('username', newUsername);
          setCurrentUsername(newUsername);
        }
        
        // Clear form
        setNewUsername('');
        setNewPassword('');
        setConfirmPassword('');
        
        // Optionally redirect to login after a delay
        setTimeout(() => {
          handleLogout();
        }, 2000);
      } else {
        setError(response.message);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { data?: { message?: string } } };
        setError(axiosError.response?.data?.message || 'Update failed. Please try again.');
      } else {
        setError('Update failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-500">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-800">Koi Fish Friend Dashboard</h1>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto mt-10 p-6">
        <div className="bg-white rounded-lg shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Update Credentials</h2>
          
          <div className="mb-6 p-4 bg-blue-100 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Current Username:</strong> <span className="font-mono">{currentUsername}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="newUsername" className="block text-sm font-medium text-gray-700 mb-2">
                New Username (optional)
              </label>
              <input
                id="newUsername"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="Enter new username"
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                New Password (optional)
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="Enter new password"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="Confirm new password"
                disabled={!newPassword}
              />
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg text-sm">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Credentials'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-yellow-100 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Note:</strong> After updating credentials, you will be logged out automatically. 
              Please login again with your new credentials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
