'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { adminJson } from '@/lib/client/adminFetch';

const fetcher = (url) => adminJson(url);

function formatTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-gray-900 mt-1">
        {value === '—' ? (
          '—'
        ) : (
          <>
            {Number(value || 0).toLocaleString('en-IN')}
            <span className="ml-1 text-sm font-medium text-gray-500">pcs</span>
          </>
        )}
      </p>
    </div>
  );
}

export default function MySalesPage() {
  const { data, isLoading, error } = useSWR('/api/sales/my-sales', fetcher, {
    revalidateOnFocus: false,
  });

  const today = data?.today || [];

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My sales</h1>
        <p className="text-sm text-gray-500 mt-1">
          Goods that left stock under your name. Open requests are on{' '}
          <Link href="/admin/sales/requests" className="text-emerald-800 hover:underline">
            My requests
          </Link>
          .
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error.message || 'Failed to load sales'}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Today" value={isLoading ? '—' : data?.todayQty} />
        <StatCard label="This month" value={isLoading ? '—' : data?.monthQty} />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-900">Today</p>
        </div>
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-gray-500">Loading…</p>
        ) : today.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">Nothing sold under your name today.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {today.map((row) => (
              <li key={row.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{row.productTitle}</p>
                  {row.productSku ? (
                    <p className="text-xs font-mono text-gray-500">{row.productSku}</p>
                  ) : null}
                  {row.ref ? (
                    row.ref.startsWith('SR-') ? (
                      <Link
                        href={`/admin/sales/requests?q=${encodeURIComponent(row.ref)}`}
                        className="text-xs font-mono text-emerald-800 hover:underline"
                      >
                        {row.ref}
                      </Link>
                    ) : (
                      <p className="text-xs font-mono text-gray-500">{row.ref}</p>
                    )
                  ) : null}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums text-gray-900">
                    {row.qty.toLocaleString('en-IN')} pcs
                  </p>
                  <p className="text-xs text-gray-500">{formatTime(row.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
