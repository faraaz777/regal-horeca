







/**
 * Admin Layout
 * 
 * Layout wrapper for admin pages.
 * Includes admin sidebar navigation.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { Menu, X } from 'lucide-react';
import PasswordModal from '@/components/admin/PasswordModal';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  // Sidebar closed by default on mobile, open on desktop
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Check authentication status
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const authStatus = sessionStorage.getItem('admin-auth');
      setIsAuthenticated(authStatus === 'true');
      setIsCheckingAuth(false);
      setIsSidebarOpen(window.innerWidth >= 1024);
    }
  }, []);

  // Fetch new enquiries count - MUST be called before early returns (Rules of Hooks)
  const { data: enquiriesData } = useSWR(
    isAuthenticated ? '/api/enquiries?limit=1&skip=0&status=new' : null,
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 60000, // Refresh every minute
    }
  );

  const newEnquiriesCount = enquiriesData?.statusCounts?.new || 0;

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('admin-auth');
      setIsAuthenticated(false);
    }
  };

  // Show password modal if not authenticated
  if (isCheckingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PasswordModal onSuccess={handleAuthSuccess} />;
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

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
    <div className="flex h-screen bg-gray-100 relative">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Mobile Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 lg:hidden bg-secondary text-white p-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors"
        aria-label="Toggle sidebar"
      >
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Desktop Toggle Button (when sidebar is closed) */}
      {!isSidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="hidden lg:block fixed top-4 left-4 z-50 bg-secondary text-white p-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu size={24} />
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:fixed inset-y-0 left-0 z-50 bg-secondary text-white flex flex-col p-4 w-64 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen 
            ? 'translate-x-0' 
            : '-translate-x-full'
        }`}
      >
        {/* Header with Toggle Button */}
        <div className="flex items-center justify-between mb-4">
          <div className="py-4 px-2 flex-1">
            <Link href="/admin/dashboard" className="block" onClick={() => {
              // Close sidebar on mobile when clicking logo
              if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                setIsSidebarOpen(false);
              }
            }}>
              <span className="text-xs font-medium text-gray-400 tracking-[0.2em] uppercase">REGAL</span>
              <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">Control Hub</h1>
            </Link>
          </div>
          <button
            onClick={toggleSidebar}
            className="lg:block text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
            aria-label="Toggle sidebar"
          >
            <X size={20} />
          </button>
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

          <Link href="/admin/brands" className={navLinkClass(pathname === '/admin/brands')}>
            Brands
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

        {/* Logout Button */}
        <div className="mt-auto pt-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-3 rounded-lg text-base font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            Logout
          </button>
        </div>

      </aside>
      <main className={`flex-1 pt-16 sm:pt-6 lg:pt-8 p-4 sm:p-6 lg:p-8 overflow-y-auto transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`}>
        <div className="max-w-full">
          {children}
        </div>
      </main>
    </div>
  );
}

