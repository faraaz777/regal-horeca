'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { adminJson } from '@/lib/client/adminFetch';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await adminJson('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      toast.success('Password updated');
      window.location.assign('/admin/dashboard');
    } catch (err) {
      toast.error(err.message || 'Could not change password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white shadow rounded-lg p-8 border border-gray-200">
        <span className="text-xs font-medium text-gray-400 tracking-[0.2em] uppercase">REGAL</span>
        <h1 className="text-xl font-semibold text-gray-900 mt-1">Change password</h1>
        <p className="text-sm text-gray-500 mt-1">Choose a password only you know. Minimum 8 characters.</p>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 px-4 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save password'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">
          <button
            type="button"
            className="text-accent hover:underline"
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
              window.location.assign('/admin/login');
            }}
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
