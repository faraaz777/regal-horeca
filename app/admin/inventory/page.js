'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { Plus, Minus, Search, Package, Eye, Pencil } from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { canWriteInventory, canWriteProducts } from '@/lib/shared/permissions';

const STATUS_STYLES = {
  in_stock: 'bg-emerald-100 text-emerald-800',
  low: 'bg-amber-100 text-amber-800',
  out: 'bg-red-100 text-red-800',
};

const STATUS_LABELS = {
  in_stock: 'In stock',
  low: 'Low',
  out: 'Out',
};

const CONDITION_STYLES = {
  normal: 'bg-gray-100 text-gray-600',
  hold: 'bg-yellow-100 text-yellow-800',
  damaged: 'bg-orange-100 text-orange-800',
  dead: 'bg-pink-100 text-pink-800',
};

function formatCurrency(value) {
  const n = Number(value) || 0;
  return `₹${n.toLocaleString('en-IN')}`;
}

const fetcher = (url) => adminJson(url);

export default function AdminInventoryPage() {
  const { data: meData } = useSWR('/api/auth/me', fetcher, { revalidateOnFocus: false });
  const role = meData?.user?.role;
  const canAdjust = canWriteInventory(role);
  const canEditPrices = canWriteProducts(role);
  const canAddToInventory = canWriteInventory(role) || canWriteProducts(role);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [adjustingId, setAdjustingId] = useState(null);

  const inventoryUrl = useMemo(() => {
    const params = new URLSearchParams({ page: '1', limit: '100' });
    if (search.trim()) params.set('search', search.trim());
    if (categoryId) params.set('categoryId', categoryId);
    return `/api/admin/inventory?${params}`;
  }, [search, categoryId]);

  const { data, error, isLoading, mutate } = useSWR(inventoryUrl, fetcher, {
    revalidateOnFocus: false,
  });

  const { data: categoriesData } = useSWR('/api/categories', fetcher, { revalidateOnFocus: false });

  const items = data?.items || [];
  const totalCount = data?.pagination?.total ?? items.length;
  const categories = categoriesData?.categories || categoriesData || [];

  const handleAdjust = useCallback(
    async (productId, delta) => {
      if (!canAdjust) return;
      setAdjustingId(productId);
      try {
        await adminJson('/api/admin/inventory/adjust', {
          method: 'POST',
          body: JSON.stringify({ productId, delta }),
        });
        toast.success(delta > 0 ? 'Stock added' : 'Stock reduced');
        mutate();
      } catch (err) {
        toast.error(err.message || 'Adjustment failed');
      } finally {
        setAdjustingId(null);
      }
    },
    [canAdjust, mutate]
  );

  const handlePriceBlur = useCallback(
    async (productId, field, value) => {
      if (!canEditPrices) return;
      try {
        await adminJson('/api/admin/inventory/prices', {
          method: 'PATCH',
          body: JSON.stringify({ productId, [field]: Number(value) }),
        });
        toast.success('Price updated');
        mutate();
      } catch (err) {
        toast.error(err.message || 'Price update failed');
      }
    },
    [canEditPrices, mutate]
  );

  const handleConditionChange = useCallback(
    async (productId, condition) => {
      if (!canAdjust) return;
      try {
        await adminJson('/api/admin/inventory/condition', {
          method: 'PATCH',
          body: JSON.stringify({ productId, condition }),
        });
        toast.success('Condition updated');
        mutate();
      } catch (err) {
        toast.error(err.message || 'Condition update failed');
      }
    },
    [canAdjust, mutate]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            Live stock ledger · {totalCount} product{totalCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Name, SKU, barcode, brand…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              <option value="">All categories</option>
              {(Array.isArray(categories) ? categories : []).map((cat) => (
                <option key={cat._id || cat.id} value={cat._id || cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          {canAddToInventory && (
            <Link
              href="/admin/inventory/add"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Plus size={18} />
              Add to inventory
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-50 border-b border-red-100">
            {error.message || 'Failed to load inventory'}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 min-w-[200px]">Name</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 min-w-[140px]">Sellable</th>
                <th className="px-4 py-3">Stock status</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Selling</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
                    <p className="mt-2">Loading inventory…</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    <Package className="mx-auto text-gray-300 mb-2" size={32} />
                    No products found
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {item.brand}
                        {item.categoryName ? ` · ${item.categoryName}` : ''}
                      </div>
                      {item.condition === 'dead' && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-pink-100 text-pink-700">
                          Dead
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.sku || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-1">
                        {canAdjust && (
                          <button
                            type="button"
                            disabled={adjustingId === item._id}
                            onClick={() => handleAdjust(item._id, -1)}
                            className="p-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                            aria-label="Decrease stock"
                          >
                            <Minus size={14} />
                          </button>
                        )}
                        <span className="min-w-[2.5rem] text-center font-semibold text-gray-900">
                          {item.sellableQty}
                        </span>
                        {canAdjust && (
                          <button
                            type="button"
                            disabled={adjustingId === item._id}
                            onClick={() => handleAdjust(item._id, 1)}
                            className="p-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                            aria-label="Increase stock"
                          >
                            <Plus size={14} />
                          </button>
                        )}
                        <span className="text-xs text-gray-400 ml-1">{item.stockUnit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          STATUS_STYLES[item.stockStatus] || STATUS_STYLES.out
                        }`}
                      >
                        {item.sellableQty} Sellable
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {canEditPrices ? (
                        <input
                          type="number"
                          min="0"
                          defaultValue={item.costPrice}
                          onBlur={(e) => handlePriceBlur(item._id, 'costPrice', e.target.value)}
                          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      ) : (
                        formatCurrency(item.costPrice)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canEditPrices ? (
                        <input
                          type="number"
                          min="0"
                          defaultValue={item.sellingPrice}
                          onBlur={(e) => handlePriceBlur(item._id, 'sellingPrice', e.target.value)}
                          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      ) : (
                        formatCurrency(item.sellingPrice)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          STATUS_STYLES[item.stockStatus] || STATUS_STYLES.out
                        }`}
                      >
                        {STATUS_LABELS[item.stockStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {canAdjust ? (
                        <select
                          value={item.condition}
                          onChange={(e) => handleConditionChange(item._id, e.target.value)}
                          className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ${
                            CONDITION_STYLES[item.condition] || CONDITION_STYLES.normal
                          }`}
                        >
                          <option value="normal">Normal</option>
                          <option value="hold">Hold</option>
                          <option value="damaged">Damaged</option>
                          <option value="dead">Dead</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            CONDITION_STYLES[item.condition] || CONDITION_STYLES.normal
                          }`}
                        >
                          {item.condition === 'normal' ? 'Normal' : item.condition}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {item.slug && (
                          <a
                            href={`/products/${item.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100"
                            title="View on storefront"
                          >
                            <Eye size={14} />
                          </a>
                        )}
                        {canEditPrices && (
                          <Link
                            href="/admin/products"
                            className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100"
                            title="Edit product"
                          >
                            <Pencil size={14} />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 italic">
          Sellable qty is a live projection of the ledger. Damage/hold change condition, not quantity.
        </div>
      </div>
    </div>
  );
}
