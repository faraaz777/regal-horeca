'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import {
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Package,
  Boxes,
  FolderTree,
  Tag,
  Briefcase,
  MessageSquare,
  Store,
  ClipboardList,
  Users,
  ScrollText,
  Building2,
  LogOut,
  KeyRound,
  Plus,
  ArrowLeftRight,
  MapPin,
  Map,
  Layers,
  Inbox,
  Banknote,
  FileSpreadsheet,
} from 'lucide-react';
import { filterNavForRole, isNavItemActive } from '@/lib/admin/navConfig';
import { adminJson, adminFetch } from '@/lib/client/adminFetch';

const enquiriesFetcher = async (url) => {
  const data = await adminJson(url);
  return data;
};

/** Icon map only — labels, hrefs, and permissions stay in navConfig. */
const NAV_ICONS = {
  '/admin/dashboard': LayoutDashboard,
  '/admin/inventory': Package,
  '/admin/inventory/add': Plus,
  '/admin/inventory/movements': ArrowLeftRight,
  '/admin/inventory/locations': MapPin,
  '/admin/inventory/locator': Map,
  '/admin/inventory/product-sheet': FileSpreadsheet,
  '/admin/products': Boxes,
  '/admin/categories': FolderTree,
  '/admin/brands': Tag,
  '/admin/business-types': Briefcase,
  '/admin/enquiries': MessageSquare,
  '/admin/sales': Store,
  '/admin/inventory/requests': ClipboardList,
  '/admin/users': Users,
  '/admin/audit': ScrollText,
  '/admin/company-profile': Building2,
  '/admin/sales/collections': Layers,
  '/admin/sales/requests': Inbox,
  '/admin/sales/my-sales': Banknote,
};

function userInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'RH';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

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
  const navHrefs = useMemo(
    () =>
      navItems.flatMap((item) => [
        item.href,
        ...(item.children || []).map((child) => child.href),
      ]),
    [navItems]
  );

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

  useEffect(() => {
    if (user?.mustChangePassword) {
      router.replace('/admin/change-password');
    }
  }, [user, router]);

  const { data: enquiriesData } = useSWR(
    user && !user.mustChangePassword ? '/api/enquiries?limit=1&skip=0&status=new' : null,
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

  const closeOnMobile = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, []);

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="text-gray-600">Loading…</div>
      </div>
    );
  }

  const roleLabel = user.role.replace(/_/g, ' ');
  const expanded = isSidebarOpen;

  const navLinkClass = (isActive) =>
    `group relative flex items-center w-full text-left font-medium transition-colors rounded-lg ${
      expanded ? 'gap-3 px-3 py-2.5' : 'justify-center px-0 py-2.5'
    } ${
      isActive
        ? 'bg-shell-active text-shell-active-fg'
        : 'text-shell-muted hover:text-shell-text hover:bg-shell-raised'
    }`;

  const iconClass = (isActive) =>
    `shrink-0 ${
      isActive
        ? 'text-shell-active-fg'
        : 'text-shell-gold group-hover:text-shell-gold'
    }`;

  return (
    <div className="flex h-screen bg-gray-100 relative overflow-hidden print:h-auto print:overflow-visible print:bg-white">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden print:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden
        />
      )}

      <button
        type="button"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-shell-bg text-shell-text p-2 rounded-lg hover:bg-shell-raised transition-colors border border-shell-border print:hidden"
        aria-label="Toggle sidebar"
      >
        {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/*
        Desktop: open = labels (w-64), closed = icon rail (w-16) so icons stay.
        Mobile: closed slides fully off-canvas; open is the full drawer.
        Palette: warm espresso + gold — brand hospitality tones, not cold black/red.
      */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-shell-bg text-shell-text border-r border-shell-border
          transition-[width,transform] duration-300 ease-in-out print:hidden
          ${
            isSidebarOpen
              ? 'translate-x-0 w-64'
              : '-translate-x-full w-64 lg:translate-x-0 lg:w-16'
          }`}
      >
        <div className={expanded ? 'px-3 pt-4 pb-3 space-y-3' : 'px-2 pt-4 pb-3 flex flex-col items-center gap-3'}>
          {expanded ? (
            <>
              <div className="flex items-center justify-between gap-2 px-1">
                <Link
                  href="/admin/dashboard"
                  onClick={closeOnMobile}
                  className="min-w-0"
                  title="Regal Control Hub"
                >
                  <p className="text-[10px] font-semibold tracking-[0.28em] uppercase text-shell-gold">
                    Regal
                  </p>
                  <p className="text-xs text-shell-dim mt-0.5 truncate">Control Hub</p>
                </Link>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen((open) => !open)}
                  className="hidden lg:flex shrink-0 text-shell-dim hover:text-shell-text p-1.5 rounded-md hover:bg-shell-raised transition-colors"
                  aria-label="Collapse sidebar"
                  title="Collapse"
                >
                  <PanelLeftClose size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="lg:hidden shrink-0 text-shell-dim hover:text-shell-text p-1.5 rounded-md hover:bg-shell-raised transition-colors"
                  aria-label="Close sidebar"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex items-center gap-2.5 rounded-lg bg-shell-raised border border-shell-border/80 px-2.5 py-2">
                <div
                  className="shrink-0 h-9 w-9 rounded-full bg-shell-gold text-shell-bg flex items-center justify-center text-xs font-bold"
                  aria-hidden
                >
                  {userInitials(user.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-shell-text truncate leading-tight capitalize">
                    {user.name}
                  </p>
                  <p className="text-[10px] text-shell-dim truncate capitalize mt-0.5 leading-tight">
                    {roleLabel}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link
                href="/admin/dashboard"
                onClick={closeOnMobile}
                title={`${user.name} · ${roleLabel}`}
                className="flex justify-center"
              >
                <div
                  className="h-9 w-9 rounded-full bg-shell-gold text-shell-bg flex items-center justify-center text-xs font-bold"
                  aria-hidden
                >
                  {userInitials(user.name)}
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="hidden lg:flex text-shell-dim hover:text-shell-text p-1.5 rounded-md hover:bg-shell-raised transition-colors"
                aria-label="Expand sidebar"
                title="Expand"
              >
                <PanelLeftOpen size={16} />
              </button>
            </>
          )}
        </div>

        <div className={`h-px bg-shell-border ${expanded ? 'mx-3' : 'mx-2'}`} />

        <nav
          className={`flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-0.5 ${
            expanded ? 'px-3' : 'px-2'
          }`}
        >
          {navItems.map((item) => {
            const isActive = isNavItemActive(pathname, item.href, navHrefs);
            const Icon = NAV_ICONS[item.href] || Package;
            const showEnquiryBadge = item.href === '/admin/enquiries' && newEnquiriesCount > 0;

            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={closeOnMobile}
                  title={item.label}
                  className={navLinkClass(isActive)}
                >
                  <Icon
                    size={17}
                    strokeWidth={isActive ? 2.25 : 1.75}
                    className={iconClass(isActive)}
                  />
                  {expanded && (
                    <span className="flex-1 truncate text-[13px]">{item.label}</span>
                  )}
                  {showEnquiryBadge && (
                    <span
                      className={`text-[10px] font-bold rounded-full tabular-nums bg-accent text-white ${
                        expanded
                          ? 'ml-1 px-1.5 py-0.5'
                          : 'absolute top-1 right-1 px-1 min-w-[1rem] text-center leading-4'
                      }`}
                    >
                      {newEnquiriesCount}
                    </span>
                  )}
                </Link>

                {expanded && item.children?.length > 0 && (
                  <div className="mt-0.5 ml-4 pl-3 border-l border-shell-border space-y-0.5">
                    {item.children.map((child) => {
                      const childActive = isNavItemActive(pathname, child.href, navHrefs);
                      const ChildIcon = NAV_ICONS[child.href];
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={closeOnMobile}
                          title={child.label}
                          className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                            childActive
                              ? 'bg-shell-raised text-shell-text'
                              : 'text-shell-dim hover:text-shell-muted hover:bg-shell-raised/60'
                          }`}
                        >
                          {ChildIcon ? (
                            <ChildIcon
                              size={13}
                              strokeWidth={1.75}
                              className="shrink-0 text-shell-gold/80"
                            />
                          ) : null}
                          <span className="truncate">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {!expanded &&
                  item.children?.map((child) => {
                    const childActive = isNavItemActive(pathname, child.href, navHrefs);
                    const ChildIcon = NAV_ICONS[child.href] || Package;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={closeOnMobile}
                        title={child.label}
                        className={navLinkClass(childActive)}
                      >
                        <ChildIcon
                          size={17}
                          strokeWidth={childActive ? 2.25 : 1.75}
                          className={iconClass(childActive)}
                        />
                      </Link>
                    );
                  })}
              </div>
            );
          })}
        </nav>

        <div className={`pt-2 border-t border-shell-border pb-4 ${expanded ? 'px-3' : 'px-2'}`}>
          <Link
            href="/admin/change-password"
            title="Change password"
            className={`group flex w-full items-center rounded-lg text-[13px] font-medium text-shell-dim hover:text-shell-text hover:bg-shell-raised transition-colors ${
              expanded ? 'gap-3 px-3 py-2.5' : 'justify-center px-0 py-2.5'
            }`}
          >
            <KeyRound
              size={17}
              strokeWidth={1.75}
              className="shrink-0 text-shell-gold/70 group-hover:text-shell-gold transition-colors"
            />
            {expanded && <span>Change password</span>}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className={`group flex w-full items-center rounded-lg text-[13px] font-medium text-shell-dim hover:text-shell-text hover:bg-shell-raised transition-colors ${
              expanded ? 'gap-3 px-3 py-2.5' : 'justify-center px-0 py-2.5'
            }`}
          >
            <LogOut
              size={17}
              strokeWidth={1.75}
              className="shrink-0 text-shell-gold/70 group-hover:text-shell-gold transition-colors"
            />
            {expanded && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main
        className={`flex-1 pt-16 sm:pt-6 lg:pt-8 p-4 sm:p-6 lg:p-8 overflow-y-auto transition-all duration-300 print:ml-0 print:pt-0 print:p-0 print:overflow-visible ${
          isSidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
        }`}
      >
        <div className="max-w-full">{children}</div>
      </main>
    </div>
  );
}
