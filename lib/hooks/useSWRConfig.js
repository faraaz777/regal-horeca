/**
 * SWR Configuration for admin — cookie auth.
 */

'use client';

import { SWRConfig } from 'swr';
import { adminJson } from '@/lib/client/adminFetch';

const fetcher = async (url) => adminJson(url);

export const swrConfig = {
  fetcher,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
  dedupingInterval: 5000,
  errorRetryCount: 2,
  errorRetryInterval: 10000,
  onError: (error, key) => {
    console.error('SWR Error:', error, 'Key:', key);
  },
};

export function SWRProvider({ children }) {
  return <SWRConfig value={swrConfig}>{children}</SWRConfig>;
}
