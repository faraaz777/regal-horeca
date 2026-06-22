'use client';

import { usePathname } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';

export default function AdminLayout({ children }) {
  const pathname = usePathname();

  if (pathname?.startsWith('/admin/login')) {
    return children;
  }

  return <AdminShell>{children}</AdminShell>;
}
