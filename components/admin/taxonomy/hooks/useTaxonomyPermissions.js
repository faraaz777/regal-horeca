'use client';

import useSWR from 'swr';
import { canDeleteTaxonomy } from '@/lib/shared/permissions';
import { adminJson } from '@/lib/client/adminFetch';

/**
 * Role-based permissions for taxonomy admin pages.
 */
export function useTaxonomyPermissions() {
  const { data } = useSWR('/api/auth/me', (url) => adminJson(url), {
    revalidateOnFocus: false,
  });

  const role = data?.user?.role;

  return {
    role,
    canDelete: canDeleteTaxonomy(role),
  };
}
