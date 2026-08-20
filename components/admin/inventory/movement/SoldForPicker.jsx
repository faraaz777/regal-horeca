'use client';

import useSWR from 'swr';
import { adminJson } from '@/lib/client/adminFetch';
import { ROLE_LABELS } from '@/lib/shared/roles';

const fetcher = (url) => adminJson(url);

/**
 * Picks the staff member a Sold movement is credited to.
 *
 * Shown only for the Sold reason — an adjustment or a showroom move is not a
 * sale and has nobody to credit. Whoever is signed in is recorded separately
 * as the person who entered the movement.
 *
 * Only active staff are listed, so a new sale can never be assigned to
 * someone who has left. Sales already recorded keep their name regardless,
 * because the name is stored on the ledger row itself.
 */
export default function SoldForPicker({ value, onChange }) {
  const { data, isLoading } = useSWR('/api/users/sold-for', fetcher, {
    revalidateOnFocus: false,
  });

  const users = data?.users || [];

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
        Whose sale is this?
      </p>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2.5 text-sm bg-white border-2 rounded-xl ${
          value ? 'border-amber-300' : 'border-gray-200'
        }`}
      >
        <option value="">{isLoading ? 'Loading staff…' : 'Select a person'}</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} — {ROLE_LABELS[user.role] || user.role}
          </option>
        ))}
      </select>
      {!isLoading && users.length === 0 ? (
        <p className="text-xs text-amber-800">
          No active staff can be credited with a sale yet.
        </p>
      ) : null}
    </div>
  );
}
