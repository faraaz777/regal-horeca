'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { USER_ROLES, ROLE_LABELS, SALES_WORK_ROLES, ENQUIRY_ASSIGNEE_ROLES } from '@/lib/shared/roles';
import { adminJson } from '@/lib/client/adminFetch';

const fetcher = (url) => adminJson(url);

function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

export default function AdminUsersPage() {
  const [status, setStatus] = useState('active');
  const { data: meData } = useSWR('/api/auth/me', fetcher);
  const { data, mutate, isLoading } = useSWR(
    meData?.user?.role === 'super_admin' ? `/api/users?status=${status}` : null,
    fetcher
  );
  const { data: activeData } = useSWR(
    meData?.user?.role === 'super_admin' ? '/api/users?status=active' : null,
    fetcher
  );
  const [form, setForm] = useState({ name: '', email: '', role: 'data_entry' });
  const [submitting, setSubmitting] = useState(false);
  const [tempSecret, setTempSecret] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [transferFor, setTransferFor] = useState(null);
  const [transferTo, setTransferTo] = useState('');
  const [ownership, setOwnership] = useState(null);

  const users = data?.users || [];
  const activeUsers = activeData?.users || [];

  const transferCandidates = useMemo(() => {
    if (!transferFor || !ownership) return [];
    return activeUsers.filter((u) => {
      if (u.id === transferFor.id) return false;
      if (ownership.collections + ownership.draftBuckets > 0 && !SALES_WORK_ROLES.includes(u.role)) {
        return false;
      }
      if (ownership.assignedEnquiries > 0 && !ENQUIRY_ASSIGNEE_ROLES.includes(u.role)) {
        return false;
      }
      return true;
    });
  }, [activeUsers, transferFor, ownership]);

  async function handleCreate(e) {
    e.preventDefault();
    if (form.role === 'super_admin') {
      const ok = window.confirm('Create a Super Admin? They will have full access.');
      if (!ok) return;
    }
    setSubmitting(true);
    try {
      const res = await adminJson('/api/users', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setTempSecret({ email: res.user.email, password: res.temporaryPassword, reason: 'Created' });
      setForm({ name: '', email: '', role: 'data_entry' });
      mutate();
    } catch (err) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  }

  async function patchUser(id, body) {
    setBusyId(id);
    try {
      const res = await adminJson(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (res.temporaryPassword) {
        setTempSecret({
          email: res.user.email,
          password: res.temporaryPassword,
          reason: 'Password reset',
        });
      } else {
        toast.success('User updated');
      }
      mutate();
      return res;
    } catch (err) {
      toast.error(err.message || 'Update failed');
      throw err;
    } finally {
      setBusyId(null);
    }
  }

  async function startDeactivate(user) {
    setBusyId(user.id);
    try {
      const detail = await adminJson(`/api/users/${user.id}`);
      if (detail.ownership?.needsTransfer) {
        setTransferFor(user);
        setOwnership(detail.ownership);
        setTransferTo('');
        return;
      }
      if (!window.confirm(`Deactivate ${user.name}? They will lose access immediately.`)) return;
      await patchUser(user.id, { isActive: false });
    } catch (err) {
      toast.error(err.message || 'Could not load user');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmTransferDeactivate() {
    if (!transferFor || !transferTo) {
      toast.error('Choose who should receive their live work');
      return;
    }
    try {
      await patchUser(transferFor.id, { isActive: false, transferToUserId: transferTo });
      setTransferFor(null);
      setOwnership(null);
    } catch {
      /* toast already shown */
    }
  }

  async function handleDelete(user) {
    setBusyId(user.id);
    try {
      const detail = await adminJson(`/api/users/${user.id}`);
      if (!detail.canHardDelete) {
        toast.error('This user has history. Deactivate them instead.');
        return;
      }
      if (!window.confirm(`Permanently delete ${user.name}? This is only allowed because they have no history.`)) {
        return;
      }
      await adminJson(`/api/users/${user.id}`, { method: 'DELETE' });
      toast.success('User deleted');
      mutate();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  if (meData?.user && meData.user.role !== 'super_admin') {
    return <p className="text-sm text-red-600">You do not have access to user management.</p>;
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Team & access</h1>
      <p className="text-sm text-gray-600 mb-6">
        Create staff accounts, change roles, and remove access immediately. Former staff stay in Inactive
        so history still shows their name.
      </p>

      {tempSecret && (
        <div className="mb-6 border border-black/10 bg-warm-white rounded-sm p-4">
          <p className="text-sm font-semibold text-rich-black">{tempSecret.reason} — one-time password</p>
          <p className="text-xs text-black/50 mt-1">
            Share this with {tempSecret.email}. They must change it at next sign-in. It will not be shown again.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="px-3 py-2 bg-white border border-black/10 rounded-sm text-sm">{tempSecret.password}</code>
            <button
              type="button"
              className="min-h-[44px] px-3 text-sm border border-black/10 rounded-sm"
              onClick={async () => {
                await navigator.clipboard.writeText(tempSecret.password);
                toast.success('Copied');
              }}
            >
              Copy
            </button>
            <button
              type="button"
              className="min-h-[44px] px-3 text-sm text-black/50"
              onClick={() => setTempSecret(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {USER_ROLES.filter((r) => r !== 'super_admin').map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
              <option value="super_admin">{roleLabel('super_admin')}</option>
            </select>
          </div>
          <p className="text-xs text-gray-500">A temporary password is generated. They must change it at first sign-in.</p>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create user'}
          </button>
        </form>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-gray-900">Users</h2>
            <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
              {[
                ['active', 'Active'],
                ['inactive', 'Inactive'],
                ['all', 'All'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className={`px-3 py-2 ${status === value ? 'bg-black text-white' : 'bg-white text-gray-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {isLoading ? (
            <p className="p-6 text-sm text-gray-500">Loading…</p>
          ) : users.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No users in this view.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {users.map((user) => (
                <li key={user.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <input
                        className="font-medium text-gray-900 bg-transparent border-b border-transparent focus:border-gray-300 w-full text-sm"
                        defaultValue={user.name}
                        disabled={busyId === user.id}
                        onBlur={(e) => {
                          const name = e.target.value.trim();
                          if (name && name !== user.name) patchUser(user.id, { name });
                        }}
                      />
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select
                          disabled={busyId === user.id}
                          className="border border-gray-200 rounded-md px-2 py-1 text-xs"
                          value={user.role}
                          onChange={(e) => {
                            const role = e.target.value;
                            if (role === 'super_admin' && user.role !== 'super_admin') {
                              const ok = window.confirm(`Make ${user.name} a Super Admin?`);
                              if (!ok) return;
                            }
                            patchUser(user.id, { role });
                          }}
                        >
                          {USER_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {roleLabel(role)}
                            </option>
                          ))}
                        </select>
                        {!user.isActive && (
                          <span className="text-xs text-red-600 font-medium">Inactive</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {user.isActive ? (
                        <button
                          type="button"
                          disabled={busyId === user.id}
                          onClick={() => startDeactivate(user)}
                          className="text-xs px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === user.id}
                          onClick={() => patchUser(user.id, { isActive: true })}
                          className="text-xs px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                        >
                          Activate
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === user.id}
                        onClick={() => patchUser(user.id, { resetPassword: true })}
                        className="text-xs px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        disabled={busyId === user.id}
                        onClick={() => handleDelete(user)}
                        className="text-xs px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 text-red-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {transferFor && ownership && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => {
              setTransferFor(null);
              setOwnership(null);
            }}
          />
          <div className="relative bg-white w-full max-w-md rounded-lg p-5 shadow-xl">
            <h3 className="font-semibold text-gray-900">Reassign before deactivating</h3>
            <p className="text-sm text-gray-600 mt-1">
              {transferFor.name} still has live work. Move it to another active user, then they lose access
              immediately.
            </p>
            <ul className="mt-3 text-xs text-gray-500 space-y-1">
              {ownership.collections > 0 && <li>{ownership.collections} collection(s)</li>}
              {ownership.draftBuckets > 0 && <li>{ownership.draftBuckets} draft quote(s)</li>}
              {ownership.assignedEnquiries > 0 && <li>{ownership.assignedEnquiries} assigned enquiry(ies)</li>}
            </ul>
            <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">Transfer to</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
            >
              <option value="">Select user</option>
              {transferCandidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({roleLabel(u.role)})
                </option>
              ))}
            </select>
            {transferCandidates.length === 0 && (
              <p className="text-xs text-red-600 mt-2">
                No eligible active user to receive this work. Create or activate one first.
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                className="min-h-[44px] px-3 text-sm"
                onClick={() => {
                  setTransferFor(null);
                  setOwnership(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!transferTo || busyId === transferFor.id}
                onClick={confirmTransferDeactivate}
                className="min-h-[44px] px-4 text-sm bg-black text-white rounded-md disabled:opacity-50"
              >
                Transfer and deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
