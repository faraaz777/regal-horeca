/**
 * Admin Password Modal
 * 
 * Simple password gate for admin access.
 * Password is stored in NEXT_PUBLIC_ADMIN_PASSWORD environment variable.
 */

'use client';

import { useState } from 'react';

export default function PasswordModal({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Get password from environment variable
  const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin123456';

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simple password check
    if (password === adminPassword) {
      // Store auth in sessionStorage (auto-clears on tab close)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('admin-auth', 'true');
      }
      onSuccess();
    } else {
      setError('Incorrect password');
      setPassword('');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Admin Access</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
              placeholder="Enter admin password"
              autoFocus
              disabled={isLoading}
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full bg-black text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Checking...' : 'Access Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}

