'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { Menu, X } from 'lucide-react';
import { filterNavForRole } from '@/lib/admin/navConfig';
import { adminJson, adminFetch } from '@/lib/client/adminFetch';

const enquiriesFetcher = async (url) => {
  const data = await adminJson(url);
  return data;
};

export default function AdminShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { data: meData, error: meError } = useSWR('/api/auth/me', (url) => adminJson(url), {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const user = meData?.user;
  const navItems = user ? filterNavForRole(user.role) : [];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSidebarOpen(window.innerWidth >= 1024);
    }
  }, []);

  useEffect(() => {
    if (meError) {
      router.replace('/admin/login');
    }
  }, [meError, router]);

  const { data: enquiriesData } = useSWR(
    user ? '/api/enquiries?limit=1&skip=0&status=new' : null,
    enquiriesFetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 300000,
    }
  );

  const newEnquiriesCount = enquiriesData?.statusCounts?.new || 0;

  const handleLogout = useCallback(async () => {
    try {
      await adminFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/admin/login');
      router.refresh();
    }
  }, [router]);

  const navLinkClass = (isActive) =>
    `block w-full text-left px-4 py-3 rounded-lg text-base font-medium transition-colors ${
      isActive ? 'bg-black text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
    }`;

  const subNavLinkClass = (isActive) =>
    `block w-full text-left pl-8 pr-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'
    }`;

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="text-gray-600">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 relative">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden
        />
      )}

      <button
        type="button"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-secondary text-white p-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors"
        aria-label="Toggle sidebar"
      >
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {!isSidebarOpen && (
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="hidden lg:block fixed top-4 left-4 z-50 bg-secondary text-white p-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors"
          aria-label="Open sidebar"
        >
          <Menu size={24} />
        </button>
      )}

      <aside
        className={`fixed lg:fixed inset-y-0 left-0 z-50 bg-secondary text-white flex flex-col p-4 w-64 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="py-4 px-2 flex-1">
            <Link
              href="/admin/dashboard"
              className="block"
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  setIsSidebarOpen(false);
                }
              }}
            >
              <span className="text-xs font-medium text-gray-400 tracking-[0.2em] uppercase">REGAL</span>
              <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">Control Hub</h1>
            </Link>
            <p className="text-xs text-gray-500 mt-2 truncate">{user.name}</p>
            <p className="text-[10px] text-gray-600 uppercase tracking-wide">{user.role.replace('_', ' ')}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="lg:block text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/admin/dashboard' && pathname?.startsWith(item.href));

            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={
                    item.href === '/admin/enquiries' && newEnquiriesCount > 0
                      ? `${navLinkClass(isActive)} relative`
                      : navLinkClass(isActive)
                  }
                  onClick={() => {
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                >
                  {item.href === '/admin/enquiries' ? (
                    <span className="flex items-center justify-between">
                      <span>{item.label}</span>
                      {newEnquiriesCount > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full">
                          {newEnquiriesCount}
                        </span>
                      )}
                    </span>
                  ) : (
                    item.label
                  )}
                </Link>
                {item.children?.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={subNavLinkClass(pathname === child.href)}
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        setIsSidebarOpen(false);
                      }
                    }}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-gray-700">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left px-4 py-3 rounded-lg text-base font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      <main
        className={`flex-1 pt-16 sm:pt-6 lg:pt-8 p-4 sm:p-6 lg:p-8 overflow-y-auto transition-all duration-300 ${
          isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'
        }`}
      >
        <div className="max-w-full">{children}</div>
      </main>
    </div>
  );
}
