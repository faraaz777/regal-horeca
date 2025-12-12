







/**
 * Admin Layout
 * 
 * Layout wrapper for admin pages.
 * Includes admin sidebar navigation.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';

// SWR fetcher for enquiry counts
const fetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    return { statusCounts: {} };
  }
  return response.json();
};

export default function AdminLayout({ children }) {
  const pathname = usePathname();

  // Fetch new enquiries count
  const { data: enquiriesData } = useSWR(
    '/api/enquiries?limit=1&skip=0&status=new',
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 60000, // Refresh every minute
    }
  );

  const newEnquiriesCount = enquiriesData?.statusCounts?.new || 0;

  const navLinkClass = (isActive) =>
    `block w-full text-left px-4 py-3 rounded-lg text-base font-medium transition-colors ${
      isActive 
        ? 'bg-black text-white' 
        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
    }`;

  const subNavLinkClass = (isActive) =>
    `block w-full text-left pl-8 pr-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive 
        ? 'text-white' 
        : 'text-gray-500 hover:text-gray-300'
    }`;

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-secondary text-white flex flex-col p-4">
        <div className="py-4 px-2 mb-4">
          <Link href="/admin/dashboard" className="block">
            <span className="text-xs font-medium text-gray-400 tracking-[0.2em] uppercase">REGAL</span>
            <h1 className="text-2xl font-bold text-white mt-1">Control Hub</h1>
          </Link>
        </div>

        <nav className="flex-1 space-y-2">
          <Link href="/admin/dashboard" className={navLinkClass(pathname === '/admin/dashboard')}>
            Dashboard
          </Link>
          
          <div>
            <Link href="/admin/products" className={navLinkClass(pathname === '/admin/products')}>
              Products
            </Link>
            <Link 
              href="/admin/products/add" 
              className={subNavLinkClass(pathname === '/admin/products/add')}
            >
              + Add Product
            </Link>
          </div>

          <Link href="/admin/categories" className={navLinkClass(pathname === '/admin/categories')}>
            Categories
          </Link>

          <Link href="/admin/business-types" className={navLinkClass(pathname === '/admin/business-types')}>
            Business Types
          </Link>

          <Link 
            href="/admin/enquiries" 
            className={`${navLinkClass(pathname?.startsWith('/admin/enquiries'))} relative`}
          >
            <span className="flex items-center justify-between">
              <span>Enquiries</span>
              {newEnquiriesCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full">
                  {newEnquiriesCount}
                </span>
              )}
            </span>
          </Link>
        </nav>

      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

