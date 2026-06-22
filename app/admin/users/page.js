'use client';

import { useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { USER_ROLES } from '@/lib/shared/roles';
import { adminJson } from '@/lib/client/adminFetch';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  product_manager: 'Product Manager',
  inventory_supervisor: 'Inventory Supervisor',
  data_entry: 'Data Entry',
  sales: 'Sales',
  inventory_manager: 'Inventory Manager',
  viewer: 'Viewer',
};

export default function AdminUsersPage() {
  const { data, mutate, isLoading } = useSWR('/api/users', (url) => adminJson(url));
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'data_entry',
  });
  const [submitting, setSubmitting] = useState(false);

  const users = data?.users || [];

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminJson('/api/users', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      toast.success('User created');
      setForm({ name: '', email: '', password: '', role: 'data_entry' });
      mutate();
    } catch (err) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(user) {
    try {
      await adminJson(`/api/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      toast.success(user.isActive ? 'User deactivated' : 'User activated');
      mutate();
    } catch (err) {
      toast.error(err.message || 'Update failed');
    }
  }

  async function resetPassword(user) {
    const password = window.prompt(`New password for ${user.email}`);
    if (!password) return;
    try {
      await adminJson(`/api/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      });
      toast.success('Password updated');
    } catch (err) {
      toast.error(err.message || 'Password reset failed');
    }
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Team & access</h1>
      <p className="text-sm text-gray-600 mb-8">
        Super admins can create staff accounts and assign roles. Deactivated users cannot sign in.
      </p>

      <div className="grid lg:grid-cols-2 gap-8">
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Add user</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {USER_ROLES.filter((r) => r !== 'super_admin').map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role] || role}
                </option>
              ))}
              <option value="super_admin">{ROLE_LABELS.super_admin}</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create user'}
          </button>
        </form>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Users</h2>
          </div>
          {isLoading ? (
            <p className="p-6 text-sm text-gray-500">Loading…</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {users.map((user) => (
                <li key={user.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {ROLE_LABELS[user.role] || user.role}
                        {!user.isActive && (
                          <span className="ml-2 text-red-600 font-medium">Inactive</span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleActive(user)}
                        className="text-xs px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => resetPassword(user)}
                        className="text-xs px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Reset password
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
