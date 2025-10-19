import React, { useState } from 'react';
import { updateCredentials } from '../services/api';

interface UpdateCredentialsProps {
  currentUsername: string;
  onUsernameUpdate: (newUsername: string) => void;
  onLogout: () => void;
}

const UpdateCredentials: React.FC<UpdateCredentialsProps> = ({ 
  currentUsername, 
  onUsernameUpdate,
  onLogout 
}) => {
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        
        // Update username if changed
        if (newUsername) {
          sessionStorage.setItem('username', newUsername);
          onUsernameUpdate(newUsername);
        }
        
        // Clear form
        setNewUsername('');
        setNewPassword('');
        setConfirmPassword('');
        
        // Optionally redirect to login after a delay
        setTimeout(() => {
          onLogout();
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
    <div className="max-w-2xl">
      <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
            <i className="fas fa-user-edit text-cyan-600 text-xl"></i>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Update Credentials</h2>
            <p className="text-sm text-gray-500">Change your username or password</p>
          </div>
        </div>
        
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>Current Username:</strong> <span className="font-mono text-blue-600">{currentUsername}</span>
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Confirm new password"
              disabled={!newPassword}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <i className="fas fa-check-circle"></i>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Updating...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i>
                Update Credentials
              </>
            )}
          </button>
        </form>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <i className="fas fa-info-circle text-yellow-600 mt-0.5"></i>
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

export default UpdateCredentials;
