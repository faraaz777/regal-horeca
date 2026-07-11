'use client';

import useSWR from 'swr';
import LocatorCanvas from '@/components/admin/inventory/LocatorCanvas';
import { adminJson } from '@/lib/client/adminFetch';
import { canReadInventory } from '@/lib/shared/permissions';

const fetcher = (url) => adminJson(url);

export default function InventoryLocatorPage() {
  const { data: meData } = useSWR('/api/auth/me', fetcher, { revalidateOnFocus: false });
  const role = meData?.user?.role;
  const canView = canReadInventory(role);

  if (meData && !canView) {
    return (
      <div className="p-8 text-center text-gray-500">
        You do not have permission to view the inventory locator.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Inventory locator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Floor-plan view of racks · Branch › Floor › Rack
        </p>
      </div>
      <LocatorCanvas role={role} />
    </div>
  );
}
