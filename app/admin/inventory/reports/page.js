'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { useDebounce } from '@/hooks/useDebounce';

const fetcher = (url) => adminJson(url);

const TABS = [
  { id: 'sellable', label: 'Sellable stock' },
  { id: 'dead_stock', label: 'Dead stock (tagged)' },
  { id: 'sold', label: 'Sold movements' },
];

function formatMoney(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function InventoryReportsPage() {
  const [tab, setTab] = useState('sellable');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [page, setPage] = useState(1);

  const url = useMemo(() => {
    const params = new URLSearchParams({
      type: tab,
      page: String(page),
      limit: '50',
    });
    if (debouncedSearch) params.set('search', debouncedSearch);
    return `/api/admin/inventory/reports?${params}`;
  }, [tab, page, debouncedSearch]);

  const { data, isLoading, error } = useSWR(url, fetcher, { revalidateOnFocus: false });
  const items = data?.items || [];
  const pagination = data?.pagination || { page: 1, limit: 50, total: 0 };
  const totals = data?.totals;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/inventory"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-2"
          >
            <ArrowLeft size={14} /> Inventory
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Inventory reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sellable inventory, products tagged dead stock, and sold movement history.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
              tab === t.id
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search product, SKU, location…"
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg"
        />
      </div>

      {totals && (
        <div className="flex flex-wrap gap-4 text-sm text-gray-700">
          <span>
            Total qty: <strong>{totals.qty?.toLocaleString()}</strong>
          </span>
          <span>
            Valuation: <strong>{formatMoney(totals.value)}</strong>
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-50">{error.message}</div>
        )}
        {isLoading && <div className="p-6 text-sm text-gray-500">Loading…</div>}

        {!isLoading && items.length === 0 && (
          <div className="p-6 text-sm text-gray-500">No rows found.</div>
        )}

        {!isLoading && items.length > 0 && tab !== 'sold' && (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3 text-right">Qty</th>
                {tab === 'dead_stock' && <th className="px-4 py-3 text-right">Ageing (days)</th>}
                {tab === 'dead_stock' && <th className="px-4 py-3">Last movement</th>}
                <th className="px-4 py-3 text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((row) => (
                <tr key={`${row.productId}-${row.locationId || 'all'}-${row.statusBucket || 'row'}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{row.title}</p>
                    <p className="text-xs font-mono text-gray-500">{row.sku}</p>
                    {tab === 'dead_stock' && (
                      <span className="inline-flex mt-1 px-1.5 py-px rounded text-[10px] font-semibold bg-amber-100 text-amber-900">
                        ⚠ Dead stock
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.locationPath}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {row.qty} {row.stockUnit}
                  </td>
                  {tab === 'dead_stock' && (
                    <td className="px-4 py-3 text-right">{row.ageingDays ?? '—'}</td>
                  )}
                  {tab === 'dead_stock' && (
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {formatDate(row.lastLedgerAt)}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">{formatMoney(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!isLoading && items.length > 0 && tab === 'sold' && (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Qty sold</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((row) => (
                <tr key={row._id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{row.title}</p>
                    <p className="text-xs font-mono text-gray-500">{row.sku}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {row.qty} {row.stockUnit}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{formatDate(row.date)}</td>
                  <td className="px-4 py-3 text-sm text-gray-800">{row.userName}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{row.customerRef || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination.total > pagination.limit && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Page {pagination.page} · {pagination.total} rows
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page * pagination.limit >= pagination.total}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
