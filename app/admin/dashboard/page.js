'use client';

import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import { adminJson } from '@/lib/client/adminFetch';
import { hasPermission } from '@/lib/shared/permissions';

const fetcher = (url) => adminJson(url);

function formatMoney(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
}

function StatCard({ name, value, sub, href }) {
  const inner = (
    <>
      <h3 className="text-sm font-medium text-gray-500">{name}</h3>
      <p className="mt-2 text-3xl font-bold tabular-nums text-gray-900">{value}</p>
      {sub ? <p className="text-xs text-gray-500 mt-1">{sub}</p> : null}
    </>
  );
  const className =
    'block p-5 bg-white rounded-lg border border-gray-200 hover:border-gray-300';
  if (!href) return <div className={className}>{inner}</div>;
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

export default function AdminDashboardPage() {
  const { data: meData } = useSWR('/api/auth/me', fetcher, { revalidateOnFocus: false });
  const role = meData?.user?.role;

  const { data: statsResponse, error: statsError, isLoading: statsLoading } = useSWR(
    '/api/admin/stats',
    fetcher,
    { revalidateOnFocus: false }
  );

  const stats = statsResponse?.stats || {};
  const recentProducts = statsResponse?.recentProducts || [];
  const statusDistribution = stats.statusDistribution || {};
  const loading = statsLoading ? '…' : null;

  const canInventory = hasPermission(role, 'inventory:read');
  const canRequests = hasPermission(role, 'inventory:requests:approve');
  const canSales = hasPermission(role, 'sales:requests:read');
  const canEnquiries = hasPermission(role, 'enquiries:read');
  const canCatalog = hasPermission(role, 'products:write') || role === 'super_admin';

  const opsCards = [];
  if (canInventory) {
    opsCards.push({
      name: 'Sellable stock',
      value: loading ?? Number(stats.sellableQty || 0).toLocaleString('en-IN'),
      sub: loading ? '' : `${formatMoney(stats.sellableValue)} at cost`,
      href: '/admin/inventory/reports',
    });
  }
  if (canInventory || canSales) {
    opsCards.push({
      name: 'Sold today',
      value: loading ?? `${Number(stats.soldTodayQty || 0).toLocaleString('en-IN')} pcs`,
      sub: loading
        ? ''
        : `This month ${Number(stats.soldMonthQty || 0).toLocaleString('en-IN')} pcs`,
      href: canSales ? '/admin/sales/my-sales' : '/admin/inventory/reports',
    });
  }
  if (canRequests || canSales) {
    opsCards.push({
      name: canRequests ? 'Requests waiting' : 'My open requests',
      value: loading ?? stats.openRequests ?? 0,
      href: canRequests ? '/admin/inventory/requests' : '/admin/sales/requests',
    });
  }
  if (canEnquiries) {
    opsCards.push({
      name: 'New enquiries',
      value: loading ?? stats.newEnquiries ?? 0,
      href: '/admin/enquiries',
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Today at a glance. Each card opens the existing page behind the number.
        </p>
      </div>

      {statsError ? (
        <p className="text-sm text-red-600">Could not load dashboard figures.</p>
      ) : null}

      {opsCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {opsCards.map((card) => (
            <StatCard key={card.name} {...card} />
          ))}
        </div>
      )}

      {canCatalog && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            name="Products"
            value={loading ?? stats.totalProducts ?? 0}
            href="/admin/products"
          />
          <StatCard
            name="Categories"
            value={loading ?? stats.totalCategories ?? 0}
            href="/admin/categories"
          />
          <StatCard
            name="Business types"
            value={loading ?? stats.totalBusinessTypes ?? 0}
            href="/admin/business-types"
          />
          <StatCard
            name="Featured"
            value={loading ?? stats.featuredProducts ?? 0}
            href="/admin/products"
          />
        </div>
      )}

      {canCatalog && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Recent products</h2>
              <Link href="/admin/products" className="text-sm text-gray-600 hover:underline">
                View all
              </Link>
            </div>
            {statsLoading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : recentProducts.length === 0 ? (
              <p className="text-sm text-gray-500">No products yet</p>
            ) : (
              <div className="space-y-2">
                {recentProducts.map((product) => (
                  <Link
                    key={product._id || product.id}
                    href="/admin/products"
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg"
                  >
                    <div className="relative h-10 w-10 flex-shrink-0">
                      {product.heroImage ? (
                        <Image
                          src={product.heroImage}
                          alt={product.title}
                          fill
                          sizes="40px"
                          unoptimized
                          className="rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-gray-100" />
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate flex-1">
                      {product.title}
                    </p>
                    <span className="text-xs text-gray-500">{product.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {(stats.totalProducts || 0) > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Catalog status</h2>
              <div className="space-y-3">
                {Object.entries(statusDistribution).map(([status, count]) => {
                  const total = stats.totalProducts || 0;
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={status} className="flex items-center gap-4">
                      <div className="w-24 text-sm text-gray-600">{status}</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gray-700"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-10 text-sm tabular-nums text-gray-700 text-right">{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
